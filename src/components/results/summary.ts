// What this run means — derived once, rendered by results-view.
//
// Pure: no React, no DOM. The summary sentence is the reason this file exists.
// It CASCADES: it leads with the most useful TRUE thing it can say, so the
// order of the branches in `summarize` is the design, not an implementation
// detail. Keeping it out of the view is what lets it be read as a cascade.

import { accuracyFor, accuracyOf, EMPTY_AGGREGATE } from "@/lib/accuracy";
import { BEHAVIOR } from "@/lib/config";
import { DECKS } from "@/lib/decks";
import { computeResults } from "@/lib/engine";
import {
  entryOf,
  factInfo,
  factKeys,
  glyphOf,
  readingOfEntry,
} from "@/lib/facts";
import type { PairRow } from "@/lib/confusions";
import type { ResultsPayload } from "@/lib/quiz-session";
import type {
  AccuracyMetric,
  EntryId,
  FactAggregate,
  FactId,
  FactSessionDetail,
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

/** An entry's canonical romaji, for "you answered "shi"". */
export function reading(entry: EntryId): string {
  return readingOfEntry(entry);
}

/** What a fact looks like on screen. */
export function glyphOfFact(fact: FactId): string {
  return factInfo(fact)?.glyph ?? glyphOf(entryOf(fact));
}

/**
 * History as it stood BEFORE this run.
 *
 * A run must not appear in its own history: the session is POSTed the instant
 * it finishes, so by the time this screen fetches, it may already be in there —
 * and then "historically weakest" and "your first clean pass" would be reading
 * the very run they are meant to judge. Rebuilds the per-fact aggregates from
 * the surviving sessions, the same fold history.deleteSessions() does
 * server-side.
 */
export function historyBefore(history: HistoryFile, ts: number): HistoryFile {
  const sessions = history.sessions.filter((x) => x.ts !== ts);
  const facts: Record<FactId, FactAggregate> = {};
  for (const session of sessions) {
    for (const [key, a] of Object.entries(session.facts ?? {})) {
      const f = key as FactId;
      const agg = (facts[f] ??= { ...EMPTY_AGGREGATE });
      agg.seen += a.seen ?? 0;
      agg.missed += a.missed ?? 0;
      agg.slow += a.slow ?? 0;
      agg.firstTry += a.firstTry ?? 0;
      agg.correct += a.correct ?? 0;
    }
  }
  return { sessions, facts };
}

// ---------- the run ----------

/** What this run did. (The name predates "Fact" being domain vocabulary — these
 * are facts ABOUT the run, and `facts` below is the other sense. Renaming it is
 * churn for a later pass; the field is the one that matters.) */
export interface RunFacts {
  metric: AccuracyMetric;
  /** The facts this run asked. */
  facts: FactId[];
  total: number;
  /** Facts answered right on the first attempt. */
  firstTry: number;
  /** Facts answered right at some point. */
  eventually: number;
  /** Slow-but-right answers, summed over facts. */
  slowEvents: number;
  /** Wrong attempts across the run — the truth the metric can't soften. */
  totalMisses: number;
  /** The ring, through accuracy.ts. */
  pct: number | null;
  /** Set for a stored session that kept percentages and no detail. Everything
   * per-fact below it is inference; these two numbers are measured. */
  stored?: { forgivingPct: number; strictPct: number };
  /** Facts that count as missed under `metric`, worst first. */
  missed: FactId[];
  /** Right, but at least once over BEHAVIOR.slowAnswerMs. */
  slowOnly: FactId[];
  /** missed ∪ slowOnly — the Needs work board, and what Redrill offers. */
  needsWork: FactId[];
  /** Everything else. */
  solid: FactId[];
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
function isMissed(st: FactSessionDetail, metric: AccuracyMetric): boolean {
  return metric === "firstTry" ? st.firstTryCorrect !== true : !st.everCorrect;
}

/**
 * The per-character detail this screen is allowed to believe.
 *
 * A summary-only session never stored any: quiz-session's viewStoredSession
 * SYNTHESIZES `everCorrect` from the session's overall percentage (so every
 * fact of an 88% session claims it was never landed) and leaves
 * `firstTryCorrect` null (so every fact claims it wasn't first try).
 * Both are artefacts. Wrong ATTEMPTS are real — they come from the stored
 * aggregate — so misses are all we let the screen read, and the rest is
 * normalised to "we don't know of a problem" rather than shown as a board of
 * red "never" cells for a session that went fine.
 */
export function readableStats(results: ResultsPayload): SessionStats {
  if (!results.summaryOnly) return results.stats;
  const out: SessionStats = {};
  for (const f of factKeys(results.stats)) {
    const st = results.stats[f];
    out[f] = { ...st, everCorrect: true, firstTryCorrect: !st.misses };
  }
  return out;
}

/** This run as a FactAggregate, built exactly as quiz-session writes it to
 * history — so the ring, the drill HUD pill you just watched, and the numbers
 * Home shows tomorrow are the same measurement. */
function runAggregate(stats: SessionStats): FactAggregate {
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

  const missed = r.facts
    .filter((f) => isMissed(stats[f], metric))
    // Worst first, the order engine.missedFacts() uses; a fact you never
    // landed leads its miss-count group, since not knowing beats fumbling.
    .sort(
      (a, b) =>
        stats[b].misses - stats[a].misses ||
        Number(stats[a].everCorrect) - Number(stats[b].everCorrect),
    );
  const missedSet = new Set(missed);
  const slowOnly = r.facts
    .filter((f) => stats[f].slow > 0 && !missedSet.has(f))
    .sort((a, b) => stats[b].slow - stats[a].slow);
  const needsWork = [...missed, ...slowOnly];
  const workSet = new Set(needsWork);

  return {
    metric,
    facts: r.facts,
    total: r.total,
    firstTry: r.strict,
    eventually: r.forg,
    slowEvents: r.slow,
    totalMisses: r.facts.reduce((n, f) => n + stats[f].misses, 0),
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
    solid: r.facts.filter((f) => !workSet.has(f)),
  };
}

// ---------- picking the worst ----------

export interface Worst {
  /** One fact, or the tie. */
  facts: FactId[];
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
 * pool of facts that all really cost you today. Naming a fact you nailed this
 * run would import a problem you didn't have.
 */
export function worstOf(
  run: RunFacts,
  stats: SessionStats,
  prior: HistoryFile,
): Worst | null {
  if (!run.missed.length) return null;

  // 1 · never got it
  const never = run.missed.filter((f) => !stats[f].everCorrect);
  let pool = never.length ? never : run.missed;
  const kind: Worst["kind"] = never.length ? "never" : "misses";

  // 2 · most misses
  const most = Math.max(...pool.map((f) => stats[f].misses));
  pool = pool.filter((f) => stats[f].misses === most);

  // 3 · historically weakest. A single-fact list, so this is that fact's own
  // ratio — a real accuracy, not an entry summary. No history is not weakness:
  // an unpractised fact can't win this rung, so it sorts as unbeatable.
  if (pool.length > 1) {
    const acc = (f: FactId) => accuracyFor(prior, [f], run.metric) ?? Infinity;
    const worstAcc = Math.min(...pool.map(acc));
    pool = pool.filter((f) => acc(f) === worstAcc);
  }

  // 4 · slowest. No latency is stored, only how often an answer ran over
  // BEHAVIOR.slowAnswerMs — that is the whole "took longest to recall" signal
  // this app has.
  if (pool.length > 1) {
    const slowest = Math.max(...pool.map((f) => stats[f].slow));
    pool = pool.filter((f) => stats[f].slow === slowest);
  }

  // 5 · genuinely identical — the caller names them all.
  return { facts: pool, kind, misses: most };
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
 * past two names. Takes facts and renders GLYPHS: an id is an identity, never
 * something a sentence says out loud. */
function nameList(facts: FactId[]): Bit[] {
  const [a, b] = facts.map(glyphOfFact);
  if (facts.length === 1) return [{ t: a, em: true }];
  if (facts.length === 2) {
    return [{ t: a, em: true }, { t: " and " }, { t: b, em: true }];
  }
  return [
    { t: a, em: true },
    { t: ", " },
    { t: b, em: true },
    { t: ` and ${facts.length - 2} other${s(facts.length - 2)}` },
  ];
}

/** How a single worst fact was actually got wrong: "every time you answered
 * "shi"". Only claimed when one wrong reading really does account for the
 * misses. `confused` is keyed by ENTRY — what you said instead. */
function confusionTail(st: FactSessionDetail, count: number): string {
  const entries = (Object.entries(st.confused ?? {}) as Array<
    [EntryId, number]
  >).sort((a, b) => b[1] - a[1]);
  const [top] = entries;
  if (!top || !count) return "";
  const [other, n] = top;
  if (n >= count) return `, every time you answered "${reading(other)}"`;
  if (n / count >= 0.75) return `, mostly answered "${reading(other)}"`;
  return "";
}

function worstBits(worst: Worst, stats: SessionStats): Bit[] {
  const names = nameList(worst.facts);
  const many = worst.facts.length > 1;
  const each = many ? " each" : "";
  if (worst.kind === "never") {
    // "ヂャ never landed: 4 tries, no luck"
    const tail = worst.misses
      ? `${worst.misses} tr${worst.misses === 1 ? "y" : "ies"}${each}, no luck`
      : `${many ? "they" : "it"} never got an answer`;
    return [...names, { t: ` never landed: ${tail}` }];
  }
  if (many) {
    // "ツ and ソ tied for worst: 4 misses each"
    return [...names, { t: ` tied for worst: ${misses(worst.misses)} each` }];
  }
  // "ツ cost you the most: 4 misses, every time you answered "shi""
  const tail = confusionTail(stats[worst.facts[0]], worst.misses);
  return [
    ...names,
    { t: ` cost you the most: ${misses(worst.misses)}${tail}` },
  ];
}

/** "ゑ took over 5s though, and speed is what's left". No latency is stored, so
 * the threshold is the number that can honestly be quoted. */
function slowBits(run: RunFacts, stats: SessionStats): Bit[] {
  const most = Math.max(...run.slowOnly.map((f) => stats[f].slow));
  const slowest = run.slowOnly.filter((f) => stats[f].slow === most);
  const secs = BEHAVIOR.slowAnswerMs / 1000;
  return [
    ...nameList(slowest),
    { t: ` took over ${secs}s though, and speed is what's left` },
  ];
}

/** The counts line: how the run reads under the chosen chip, plus anything the
 * Progress section earned. */
function countBits(run: RunFacts, progress: PairRow[]): Bit[] {
  const got = run.metric === "firstTry" ? run.firstTry : run.eventually;
  const beaten = progress.length;
  return [
    // A stored session counted nothing per fact, so "0 / 12 first try"
    // would be an invention. Report the two percentages it did keep.
    run.stored
      ? { t: `${run.stored.strictPct}% first try · ${run.stored.forgivingPct}% eventually right` }
      : { t: `${got} / ${run.total} ${metricWords(run.metric)}` },
    ...(run.slowEvents
      ? [{ t: ` · ${run.slowEvents} slow but right` }]
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
function perfectBits(run: RunFacts, prior: HistoryFile): Bit[] {
  const ran = new Set(run.facts);
  const deck = [...DECKS]
    .sort((a, b) => b.facts.length - a.facts.length)
    .find((d) => d.facts.every((f) => ran.has(f)));
  const clean = (pct: number) => pct === 100;
  const pctOf = (x: { forgivingPct: number; strictPct: number }) =>
    run.metric === "firstTry" ? x.strictPct : x.forgivingPct;

  if (deck) {
    const before = prior.sessions.filter(
      (x) => clean(pctOf(x)) && deck.facts.every((f) => f in (x.facts ?? {})),
    ).length;
    const label = deck.label.toLowerCase();
    return [
      {
        t: before
          ? `Your ${ordinal(before + 1)} clean pass over ${label}`
          : `Your first clean pass over ${label}`,
      },
    ];
  }
  const before = prior.sessions.filter((x) => clean(pctOf(x))).length;
  return [
    { t: before ? `Your ${ordinal(before + 1)} perfect run` : "Your first perfect run" },
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
  run: RunFacts,
  stats: SessionStats,
  prior: HistoryFile,
  progress: PairRow[],
): Summary {
  const counts = countBits(run, progress);

  if (run.missed.length) {
    const worst = worstOf(run, stats, prior);
    const n = run.needsWork.length;
    return {
      state: "misses",
      headline: `${n} character${s(n)} need${n === 1 ? "s" : ""} another pass`,
      detail: worst ? worstBits(worst, stats) : null,
      counts,
    };
  }

  if (run.slowOnly.length) {
    return {
      state: "slow",
      headline: run.totalMisses
        ? "Everything landed in the end"
        : "Clean run, nothing missed",
      detail: slowBits(run, stats),
      counts,
    };
  }

  if (run.totalMisses) {
    // Nothing unlanded and nothing slow, but retries happened: name what they
    // cost rather than calling it perfect.
    const worst = worstOf(
      { ...run, missed: run.facts.filter((f) => stats[f].misses > 0) },
      stats,
      prior,
    );
    return {
      state: "retries",
      headline: "Everything landed in the end",
      detail: worst
        ? [
            ...nameList(worst.facts),
            {
              t: ` took the most retries: ${misses(worst.misses)}${
                worst.facts.length > 1 ? " each" : ""
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
        t: `${run.total} / ${run.total} ${metricWords(run.metric)}, none slow`,
      },
      ...(beat
        ? ([
            { t: ", and you beat " },
            { t: `${glyphOf(beat.a)} ↔ ${glyphOf(beat.b)}`, em: true },
          ] as Bit[])
        : []),
    ],
    counts: perfectBits(run, prior),
  };
}
