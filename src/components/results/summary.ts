// What this run means — derived once, rendered by results-view.
//
// Pure: no React, no DOM. The summary sentence is the reason this file exists.
// It CASCADES: it leads with the most useful TRUE thing it can say, so the
// order of the branches in `summarize` is the design, not an implementation
// detail. Keeping it out of the view is what lets it be read as a cascade.

import { CHAR_INDEX } from "@/data/characters";
import { accuracyFor, accuracyOf, EMPTY_AGGREGATE } from "@/lib/accuracy";
import { BEHAVIOR } from "@/lib/config";
import { DECKS } from "@/lib/decks";
import { computeResults } from "@/lib/engine";
import type { PairRow } from "@/lib/confusions";
import type { ResultsPayload } from "@/lib/quiz-session";
import type {
  AccuracyMetric,
  CharAggregate,
  CharSessionDetail,
  HistoryFile,
  SessionStats,
} from "@/types";

/** How the chosen metric reads in a sentence — the chip's own words, so the
 * hero and the chip below it can't drift apart. */
export function metricWords(metric: AccuracyMetric): string {
  return metric === "firstTry" ? "first try" : "eventually right";
}

function s(n: number): string {
  return n === 1 ? "" : "s";
}

/** "1 miss" / "4 misses" — the kit's plural() appends a bare "s". */
function misses(n: number): string {
  return `${n} ${n === 1 ? "miss" : "misses"}`;
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** The character's canonical romaji, for "you answered "shi"". */
export function reading(char: string): string {
  return CHAR_INDEX[char]?.r[0] ?? char;
}

/**
 * History as it stood BEFORE this run.
 *
 * A run must not appear in its own history: the session is POSTed the instant
 * it finishes, so by the time this screen fetches, it may already be in there —
 * and then "historically weakest" and "your first clean pass" would be reading
 * the very run they are meant to judge. Rebuilds the per-character aggregates
 * from the surviving sessions, the same fold history.deleteSessions() does
 * server-side.
 */
export function historyBefore(history: HistoryFile, ts: number): HistoryFile {
  const sessions = history.sessions.filter((x) => x.ts !== ts);
  const chars: Record<string, CharAggregate> = {};
  for (const session of sessions) {
    for (const [c, a] of Object.entries(session.chars ?? {})) {
      const agg = (chars[c] ??= { ...EMPTY_AGGREGATE });
      agg.seen += a.seen ?? 0;
      agg.missed += a.missed ?? 0;
      agg.slow += a.slow ?? 0;
      agg.firstTry += a.firstTry ?? 0;
    }
  }
  return { sessions, chars };
}

// ---------- the run ----------

export interface RunFacts {
  metric: AccuracyMetric;
  chars: string[];
  total: number;
  /** Characters answered right on the first attempt. */
  firstTry: number;
  /** Characters answered right at some point. */
  eventually: number;
  /** Slow-but-right answers, summed over characters. */
  slowEvents: number;
  /** Wrong attempts across the run — the truth the metric can't soften. */
  totalMisses: number;
  /** The ring, through accuracy.ts. */
  pct: number | null;
  /** Set for a stored session that kept percentages and no detail. Everything
   * per-character below it is inference; these two numbers are fact. */
  stored?: { forgivingPct: number; strictPct: number };
  /** Characters that count as missed under `metric`, worst first. */
  missed: string[];
  /** Right, but at least once over BEHAVIOR.slowAnswerMs. */
  slowOnly: string[];
  /** missed ∪ slowOnly — the Needs work board, and what Redrill offers. */
  needsWork: string[];
  /** Everything else. */
  solid: string[];
}

/**
 * Whether a character counts as missed under `metric`.
 *
 * Deliberately NOT engine.missedChars(stats, "forg"), which counts any wrong
 * attempt and so returns almost exactly the strict list — the two chips would
 * pick the same characters and the toggle would be decoration. The forgiving
 * reading here is the one computeResults() itself uses for its forgiving count
 * (`everCorrect`) and the one the chip promises: you got there in the end.
 */
function isMissed(st: CharSessionDetail, metric: AccuracyMetric): boolean {
  return metric === "firstTry" ? st.firstTryCorrect !== true : !st.everCorrect;
}

/**
 * The per-character detail this screen is allowed to believe.
 *
 * A summary-only session never stored any: quiz-session's viewStoredSession
 * SYNTHESIZES `everCorrect` from the session's overall percentage (so every
 * character of an 88% session claims it was never landed) and leaves
 * `firstTryCorrect` null (so every character claims it wasn't first try).
 * Both are artefacts. Wrong ATTEMPTS are real — they come from the stored
 * aggregate — so misses are all we let the screen read, and the rest is
 * normalised to "we don't know of a problem" rather than shown as a board of
 * red "never" cells for a session that went fine.
 */
export function readableStats(results: ResultsPayload): SessionStats {
  if (!results.summaryOnly) return results.stats;
  const out: SessionStats = {};
  for (const [c, st] of Object.entries(results.stats)) {
    out[c] = { ...st, everCorrect: true, firstTryCorrect: !st.misses };
  }
  return out;
}

/** This run as a CharAggregate, built exactly as quiz-session writes it to
 * history — so the ring, the drill HUD pill you just watched, and the numbers
 * Home shows tomorrow are the same measurement. */
function runAggregate(stats: SessionStats): CharAggregate {
  const agg = { ...EMPTY_AGGREGATE };
  for (const st of Object.values(stats)) {
    agg.seen += st.seen;
    agg.missed += st.misses;
    agg.slow += st.slow;
    agg.firstTry += st.firstTryCorrect === true ? 1 : 0;
  }
  return agg;
}

export function deriveRun(
  results: ResultsPayload,
  metric: AccuracyMetric,
): RunFacts {
  const { summaryOnly } = results;
  const stats = readableStats(results);
  const r = computeResults(stats);

  const missed = r.chars
    .filter((c) => isMissed(stats[c], metric))
    // Worst first, the order engine.missedChars() uses; a character you never
    // landed leads its miss-count group, since not knowing beats fumbling.
    .sort(
      (a, b) =>
        stats[b].misses - stats[a].misses ||
        Number(stats[a].everCorrect) - Number(stats[b].everCorrect),
    );
  const missedSet = new Set(missed);
  const slowOnly = r.chars
    .filter((c) => stats[c].slow > 0 && !missedSet.has(c))
    .sort((a, b) => stats[b].slow - stats[a].slow);
  const needsWork = [...missed, ...slowOnly];
  const workSet = new Set(needsWork);

  return {
    metric,
    chars: r.chars,
    total: r.total,
    firstTry: r.strict,
    eventually: r.forg,
    slowEvents: r.slow,
    totalMisses: r.chars.reduce((n, c) => n + stats[c].misses, 0),
    // Summary-only sessions kept percentages and nothing to recompute from.
    pct: summaryOnly
      ? metric === "firstTry"
        ? summaryOnly.strictPct
        : summaryOnly.forgivingPct
      : accuracyOf(runAggregate(stats), metric),
    stored: summaryOnly,
    missed,
    slowOnly,
    needsWork,
    solid: r.chars.filter((c) => !workSet.has(c)),
  };
}

// ---------- picking the worst ----------

export interface Worst {
  /** One character, or the tie. */
  chars: string[];
  /** "never" outranks any miss count — you don't know it at all. */
  kind: "never" | "misses";
  /** Wrong attempts each of them cost. */
  misses: number;
}

/**
 * The worst character of the run, by the ladder — first rung that separates
 * two characters wins:
 *
 *   1. never got it        — not knowing beats fumbling, whatever the counts
 *   2. most misses         — among the ones you did get, how hard it fought
 *   3. historically weakest — your history's vote, through accuracy.ts
 *   4. slowest             — last resort
 *   5. still tied          — then say so, and name them
 *
 * So history BREAKS ties and never WRITES the line: `prior` only ever narrows a
 * pool of characters that all really cost you today. Naming a character you
 * nailed this run would import a problem you didn't have.
 */
export function worstOf(
  facts: RunFacts,
  stats: SessionStats,
  prior: HistoryFile,
): Worst | null {
  if (!facts.missed.length) return null;

  // 1 · never got it
  const never = facts.missed.filter((c) => !stats[c].everCorrect);
  let pool = never.length ? never : facts.missed;
  const kind: Worst["kind"] = never.length ? "never" : "misses";

  // 2 · most misses
  const most = Math.max(...pool.map((c) => stats[c].misses));
  pool = pool.filter((c) => stats[c].misses === most);

  // 3 · historically weakest. No history is not weakness — an unpractised
  // character can't win this rung, so it sorts as unbeatable.
  if (pool.length > 1) {
    const acc = (c: string) => accuracyFor(prior, [c], facts.metric) ?? Infinity;
    const worstAcc = Math.min(...pool.map(acc));
    pool = pool.filter((c) => acc(c) === worstAcc);
  }

  // 4 · slowest. No latency is stored, only how often an answer ran over
  // BEHAVIOR.slowAnswerMs — that is the whole "took longest to recall" signal
  // this app has.
  if (pool.length > 1) {
    const slowest = Math.max(...pool.map((c) => stats[c].slow));
    pool = pool.filter((c) => stats[c].slow === slowest);
  }

  // 5 · genuinely identical — the caller names them all.
  return { chars: pool, kind, misses: most };
}

// ---------- the sentence ----------

/** A run of sentence, `em` for the characters the eye should land on. */
export interface Bit {
  t: string;
  em?: boolean;
}

export type SummaryState = "misses" | "slow" | "retries" | "perfect";

export interface Summary {
  state: SummaryState;
  headline: string;
  /** The diagnosis line. Null when there is nothing true left to say. */
  detail: Bit[] | null;
  /** The counts line, or the achievement on a perfect run. */
  counts: Bit[];
}

/** "ツ" · "ツ and ソ" · "ツ, ソ and 2 others" — a list stops being a headline
 * past two names. */
function nameList(chars: string[]): Bit[] {
  const [a, b] = chars;
  if (chars.length === 1) return [{ t: a, em: true }];
  if (chars.length === 2) {
    return [{ t: a, em: true }, { t: " and " }, { t: b, em: true }];
  }
  return [
    { t: a, em: true },
    { t: ", " },
    { t: b, em: true },
    { t: ` and ${chars.length - 2} other${s(chars.length - 2)}` },
  ];
}

/** How a single worst character was actually got wrong: "every time you
 * answered "shi"". Only claimed when one wrong reading really does account for
 * the misses. */
function confusionTail(st: CharSessionDetail, count: number): string {
  const entries = Object.entries(st.confused ?? {}).sort((a, b) => b[1] - a[1]);
  const [top] = entries;
  if (!top || !count) return "";
  const [other, n] = top;
  if (n >= count) return `, every time you answered "${reading(other)}"`;
  if (n / count >= 0.75) return `, mostly answered "${reading(other)}"`;
  return "";
}

function worstBits(worst: Worst, stats: SessionStats): Bit[] {
  const names = nameList(worst.chars);
  const many = worst.chars.length > 1;
  const each = many ? " each" : "";
  if (worst.kind === "never") {
    // "ヂャ never landed — 4 tries, no luck"
    const tail = worst.misses
      ? `${worst.misses} tr${worst.misses === 1 ? "y" : "ies"}${each}, no luck`
      : `${many ? "they" : "it"} never got an answer`;
    return [...names, { t: ` never landed — ${tail}` }];
  }
  if (many) {
    // "ツ and ソ tied for worst — 4 misses each"
    return [...names, { t: ` tied for worst — ${misses(worst.misses)} each` }];
  }
  // "ツ cost you the most — 4 misses, every time you answered "shi""
  const tail = confusionTail(stats[worst.chars[0]], worst.misses);
  return [
    ...names,
    { t: ` cost you the most — ${misses(worst.misses)}${tail}` },
  ];
}

/** "ゑ took over 5s though — speed is what's left". No latency is stored, so
 * the threshold is the number that can honestly be quoted. */
function slowBits(facts: RunFacts, stats: SessionStats): Bit[] {
  const most = Math.max(...facts.slowOnly.map((c) => stats[c].slow));
  const chars = facts.slowOnly.filter((c) => stats[c].slow === most);
  const secs = BEHAVIOR.slowAnswerMs / 1000;
  return [
    ...nameList(chars),
    { t: ` took over ${secs}s though — speed is what's left` },
  ];
}

/** The counts line: how the run reads under the chosen chip, plus anything the
 * Progress section earned. */
function countBits(facts: RunFacts, progress: PairRow[]): Bit[] {
  const got = facts.metric === "firstTry" ? facts.firstTry : facts.eventually;
  const beaten = progress.length;
  return [
    // A stored session counted nothing per character, so "0 / 12 first try"
    // would be an invention. Report the two percentages it did keep.
    facts.stored
      ? { t: `${facts.stored.strictPct}% first try · ${facts.stored.forgivingPct}% eventually right` }
      : { t: `${got} / ${facts.total} ${metricWords(facts.metric)}` },
    ...(facts.slowEvents
      ? [{ t: ` · ${facts.slowEvents} slow but right` }]
      : []),
    ...(beaten
      ? [
          {
            t: ` · ${beaten} old weakness${beaten === 1 ? "" : "es"} beaten`,
          },
        ]
      : []),
  ];
}

/**
 * What a perfect run earned. Nothing to diagnose, so the line reports the
 * achievement instead — and it has to be true, so it is read off history: the
 * biggest deck this run covered end to end, and whether it has ever been
 * covered cleanly before.
 */
function perfectBits(facts: RunFacts, prior: HistoryFile): Bit[] {
  const ran = new Set(facts.chars);
  const deck = [...DECKS]
    .sort((a, b) => b.chars.length - a.chars.length)
    .find((d) => d.chars.every((c) => ran.has(c)));
  const clean = (pct: number) => pct === 100;
  const pctOf = (x: { forgivingPct: number; strictPct: number }) =>
    facts.metric === "firstTry" ? x.strictPct : x.forgivingPct;

  if (deck) {
    const before = prior.sessions.filter(
      (x) => clean(pctOf(x)) && deck.chars.every((c) => c in (x.chars ?? {})),
    ).length;
    const label = deck.label.toLowerCase();
    return [
      {
        t: before
          ? `your ${ordinal(before + 1)} clean pass over ${label}`
          : `your first clean pass over ${label}`,
      },
    ];
  }
  const before = prior.sessions.filter((x) => clean(pctOf(x))).length;
  return [
    { t: before ? `your ${ordinal(before + 1)} perfect run` : "your first perfect run" },
  ];
}

/**
 * The summary line, in every state. Leads with the most useful TRUE thing:
 *
 *   misses  → what needs another pass, and which character cost the most
 *   slow    → nothing missed; speed is the frontier that's left
 *   retries → nothing left unlanded under "Eventually right", but it wasn't free
 *   perfect → nothing to diagnose, so report the achievement
 *
 * The "retries" state is what the forgiving chip creates: everything landed in
 * the end, so nothing counts as missed — but the run was not clean and the ring
 * is not 100%, and a "Perfect run" headline over a 92% ring is a lie.
 */
export function summarize(
  facts: RunFacts,
  stats: SessionStats,
  prior: HistoryFile,
  progress: PairRow[],
): Summary {
  const counts = countBits(facts, progress);

  if (facts.missed.length) {
    const worst = worstOf(facts, stats, prior);
    const n = facts.needsWork.length;
    return {
      state: "misses",
      headline: `${n} character${s(n)} need${n === 1 ? "s" : ""} another pass`,
      detail: worst ? worstBits(worst, stats) : null,
      counts,
    };
  }

  if (facts.slowOnly.length) {
    return {
      state: "slow",
      headline: facts.totalMisses
        ? "Everything landed in the end"
        : "Clean run — nothing missed",
      detail: slowBits(facts, stats),
      counts,
    };
  }

  if (facts.totalMisses) {
    // Nothing unlanded and nothing slow, but retries happened: name what they
    // cost rather than calling it perfect.
    const worst = worstOf(
      { ...facts, missed: facts.chars.filter((c) => stats[c].misses > 0) },
      stats,
      prior,
    );
    return {
      state: "retries",
      headline: "Everything landed in the end",
      detail: worst
        ? [
            ...nameList(worst.chars),
            {
              t: ` took the most retries — ${misses(worst.misses)}${
                worst.chars.length > 1 ? " each" : ""
              }, but you got there`,
            },
          ]
        : null,
      counts,
    };
  }

  const beat = progress[0];
  return {
    state: "perfect",
    headline: "Perfect run",
    detail: [
      {
        t: `${facts.total} / ${facts.total} ${metricWords(facts.metric)}, none slow`,
      },
      ...(beat
        ? ([
            { t: " — and you beat " },
            { t: `${beat.a} ↔ ${beat.b}`, em: true },
          ] as Bit[])
        : []),
    ],
    counts: perfectBits(facts, prior),
  };
}
