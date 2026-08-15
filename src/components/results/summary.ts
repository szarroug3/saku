// What this run means — derived once, rendered by results-view.
//
// Pure: no React, no DOM. The summary sentence is the reason this file exists.
// It CASCADES: it leads with the most useful TRUE thing it can say, so the
// order of the branches in `summarize` is the design, not an implementation
// detail. Keeping it out of the view is what lets it be read as a cascade.

import { accuracyOf, EMPTY_COUNTS } from "@/lib/accuracy";
import { foldSessions } from "@/lib/aggregate";
import { DECKS } from "@/lib/decks";
import { computeResults } from "@/lib/engine";
import { firstTryShowings } from "@/lib/first-try";
import {
  entryOf,
  factInfo,
  factKeys,
  glyphOf,
  readingOfEntry,
} from "@/lib/facts";
import { nounFor } from "@/lib/quiz-instruction";
import type { PairRow } from "@/lib/confusions";
import type { ResultsPayload } from "@/lib/quiz-session";
import type {
  EntryId,
  FactCounts,
  FactId,
  FactSessionDetail,
  HistoryFile,
  SessionStats,
} from "@/types";

/** The hero's own words for the score. */
export function metricWords(): string {
  return "score";
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
 * the very run they are meant to judge.
 *
 * Rebuilds the per-fact aggregates from the surviving sessions via
 * aggregate.foldSessions — literally the same function history.deleteSessions()
 * calls server-side, where this used to be a hand-rolled copy of the same five
 * `+=` lines. That copy was survivable while the fold was a commutative sum. It
 * would not have survived the ranking model: the fold now replays scoring
 * evidence in time order, so a second implementation that merely LOOKED right
 * would hand this screen a set of stabilities nobody else in the app agrees
 * with, and the only symptom would be a weakest list that is subtly wrong.
 */
export function historyBefore(history: HistoryFile, ts: number): HistoryFile {
  const sessions = history.sessions.filter((x) => x.ts !== ts);
  return { sessions, facts: foldSessions(sessions) };
}

// ---------- the run ----------

/** What this run did. (The name predates "Fact" being domain vocabulary — these
 * are facts ABOUT the run, and `facts` below is the other sense. Renaming it is
 * churn for a later pass; the field is the one that matters.) */
export interface RunFacts {
  /** The facts this run asked. */
  facts: FactId[];
  /** Showings/questions this run asked. */
  questionsTotal: number;
  /** Showings landed on first attempt. */
  questionsFirstTry: number;
  total: number;
  /** Facts answered right on the first attempt. */
  firstTry: number;
  /** Wrong attempts across the run. */
  totalMisses: number;
  /** The ring, through accuracy.ts. */
  pct: number | null;
  /** Set for a stored session that kept percentages and no detail. Everything
   * per-fact below it is inference; these two numbers are measured. */
  stored?: { forgivingPct: number; strictPct: number };
  /** Facts missed on first try, worst first. */
  missed: FactId[];
  /** Facts that needed another look this run (any miss/retry) — Needs work. */
  needsWork: FactId[];
  /** Everything else. */
  solid: FactId[];
}

/** Whether a fact was missed — not landed on the first attempt. */
function isMissed(st: FactSessionDetail): boolean {
  return st.firstTryCorrect !== true;
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

/** This run's COUNTS, built exactly as quiz-session writes them to history — so
 * the ring, the drill HUD pill you just watched, and the numbers Home shows
 * tomorrow are the same measurement. Counts and not a FactAggregate: this is a
 * pool across every fact in the run, and a pool has no scoring state (see
 * accuracy.totalFor).
 *
 * "Exactly as" is load-bearing and was for a while merely aspirational: this
 * read `firstTryCorrect === true ? 1 : 0` — a per-run flag — while `seen` next
 * to it counted showings, so the ring disagreed with the pill it sat under by
 * more the harder you had practised. The numerator is `firstTryShowings`, the
 * same reader the pill and the writer both use, because three copies of the
 * same measurement agree by sharing the arithmetic or they do not agree. */
function runAggregate(stats: SessionStats): FactCounts {
  const agg = { ...EMPTY_COUNTS };
  for (const st of Object.values(stats)) {
    agg.seen += st.seen;
    agg.missed += st.misses;
    agg.firstTry += firstTryShowings(st);
  }
  return agg;
}

export function deriveRun(
  results: ResultsPayload,
): RunFacts {
  const { summaryOnly } = results;
  const stats = readableStats(results);
  const r = computeResults(stats);
  const agg = runAggregate(stats);

  const missed = r.facts
    .filter((f) => isMissed(stats[f]))
    // Worst first, the order engine.missedFacts() uses; a fact you never
    // landed leads its miss-count group, since not knowing beats fumbling.
    .sort(
      (a, b) =>
        stats[b].misses - stats[a].misses ||
        Number(stats[a].everCorrect) - Number(stats[b].everCorrect),
    );
  // Board split is about what needed another look in THIS run, not the score
  // shown up top. A fact can be first-try on one showing and still cost
  // retries on another; misses>0 keeps that visible.
  const needsWork = r.facts
    .filter((f) => stats[f].misses > 0)
    .sort(
      (a, b) =>
        stats[b].misses - stats[a].misses ||
        Number(stats[a].everCorrect) - Number(stats[b].everCorrect),
    );
  const workSet = new Set(needsWork);

  return {
    facts: r.facts,
    questionsTotal: agg.seen,
    questionsFirstTry: agg.firstTry,
    total: r.total,
    firstTry: r.strict,
    totalMisses: r.facts.reduce((n, f) => n + stats[f].misses, 0),
    // Summary-only sessions kept percentages and nothing to recompute from.
    pct: summaryOnly ? summaryOnly.strictPct : accuracyOf(runAggregate(stats)),
    stored: summaryOnly,
    missed,
    needsWork,
    solid: r.facts.filter((f) => !workSet.has(f)),
  };
}

// ---------- picking the worst ----------

export interface Worst {
  /** One entry, or the tie. */
  entries: EntryId[];
  /** Facts contributing to each tied entry's total miss count. */
  byEntry: Record<EntryId, FactId[]>;
  /** "never" outranks any miss count — you don't know it at all. */
  kind: "never" | "misses";
  /** Wrong attempts each tied entry cost. */
  misses: number;
}

/**
 * The worst character of the run, by the ladder — first rung that separates
 * two characters wins:
 *
 *   1. never got it        — not knowing beats fumbling, whatever the counts
 *   2. most misses         — among the ones you did get, how hard it fought
 *   3. still tied          — then say so, and name them
 *
 * Ties are kept and named: if two or more facts share the top miss count in
 * this run, the line says so instead of pretending one "cost the most".
 */
export function worstOf(
  run: RunFacts,
  stats: SessionStats,
  prior: HistoryFile,
): Worst | null {
  if (!run.missed.length) return null;

  // 1 · never got it
  const never = run.missed.filter((f) => !stats[f].everCorrect);
  const pool = never.length ? never : run.missed;
  const kind: Worst["kind"] = never.length ? "never" : "misses";

  // 2 · most misses, by ENTRY (sum of this run's missed questions over all
  // facts of that entry that missed).
  const byEntry = new Map<EntryId, { misses: number; facts: FactId[] }>();
  for (const f of pool) {
    const e = entryOf(f);
    const row = byEntry.get(e) ?? { misses: 0, facts: [] };
    row.misses += stats[f].misses;
    row.facts.push(f);
    byEntry.set(e, row);
  }
  const most = Math.max(...[...byEntry.values()].map((x) => x.misses));
  const entries = [...byEntry.entries()]
    .filter(([, x]) => x.misses === most)
    .map(([e]) => e);

  void prior;
  // 3 · genuinely identical on this run — the caller names them all.
  return {
    entries,
    byEntry: Object.fromEntries(
      entries.map((e) => [e, byEntry.get(e)?.facts ?? []]),
    ) as Record<EntryId, FactId[]>,
    kind,
    misses: most,
  };
}

// ---------- the sentence ----------

/** A run of sentence, `em` for the characters the eye should land on. */
export interface Bit {
  t: string;
  em?: boolean;
}

export type SummaryState = "misses" | "retries" | "perfect";

export interface Summary {
  state: SummaryState;
  headline: string;
  /** The diagnosis line. Null when there is nothing true left to say. */
  detail: Bit[] | null;
  /** The counts line, or the achievement on a perfect run. */
  counts: Bit[];
}

/** A natural-language entry list: "ツ (kana)", "ツ (kana) and ソ (kana)",
 * "可 (kanji), 可 (word), and ソ (kana)".
 * Takes facts and renders GLYPHS: an id is an identity, never something a
 * sentence says out loud. */
function nameList(
  entries: EntryId[],
  byEntry: Record<EntryId, FactId[]>,
): Bit[] {
  const renderOne = (entry: EntryId): Bit[] => {
    const sample = byEntry[entry]?.[0];
    const noun = sample ? nounFor(sample) : "entry";
    return [{ t: glyphOf(entry), em: true }, { t: ` (${noun})` }];
  };

  if (entries.length === 0) return [];
  if (entries.length === 1) return renderOne(entries[0]);
  if (entries.length === 2) {
    return [...renderOne(entries[0]), { t: " and " }, ...renderOne(entries[1])];
  }

  const bits: Bit[] = [];
  entries.forEach((entry, i) => {
    bits.push(...renderOne(entry));
    if (i < entries.length - 2) bits.push({ t: ", " });
    else if (i === entries.length - 2) bits.push({ t: ", and " });
  });
  return bits;
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
  const names = nameList(worst.entries, worst.byEntry);
  const many = worst.entries.length > 1;
  const each = many ? " each" : "";
  if (worst.kind === "never") {
    // "ヂャ never landed: 4 tries, no luck"
    const tail = worst.misses
      ? `${worst.misses} tr${worst.misses === 1 ? "y" : "ies"}${each}, no luck`
      : `${many ? "they" : "it"} never got an answer`;
    return [...names, { t: ` never landed: ${tail}` }];
  }
  if (many) {
    // "可 (word) and とお (word) tied for worst: 3 misses each"
    return [...names, { t: ` tied for worst: ${misses(worst.misses)} each` }];
  }
  // "ツ (kana) cost you the most: 4 misses, every time you answered "shi""
  const one = worst.entries[0];
  const oneFacts = worst.byEntry[one] ?? [];
  if (!oneFacts.length) {
    return [...names, { t: ` cost you the most: ${misses(worst.misses)}` }];
  }
  const confusion: Record<EntryId, number> = {} as Record<EntryId, number>;
  for (const f of oneFacts) {
    for (const [e, n] of Object.entries(stats[f].confused ?? {}) as Array<[EntryId, number]>) {
      confusion[e] = (confusion[e] ?? 0) + n;
    }
  }
  const tail = confusionTail({ ...stats[oneFacts[0]], confused: confusion }, worst.misses);
  return [
    ...names,
    { t: ` cost you the most: ${misses(worst.misses)}${tail}` },
  ];
}

/** The counts line: how the run reads under the chosen chip, plus anything the
 * Progress section earned. */
function countBits(run: RunFacts, progress: PairRow[]): Bit[] {
  const got =
    run.questionsFirstTry;
  const beaten = progress.length;
  return [
    // A stored session counted nothing per fact, so "0 / 12 score"
    // would be an invention. Report the two percentages it did keep.
    run.stored
      ? { t: `${run.stored.strictPct}% score` }
      : { t: `${got} / ${run.questionsTotal} ${"score"}` },
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
    x.strictPct;

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
 *   retries → nothing left unlanded, but it wasn't free
 *   perfect → nothing to diagnose, so report the achievement
 *
 * The "retries" state is for runs where everything landed in
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
    const worst = worstOf({ ...run, missed: run.needsWork }, stats, prior);
    const n = run.needsWork.length;
    return {
      state: "misses",
      // "things", not "characters": a run can hold 生's readings, a word or a
      // grammar pattern, and the old wording called all of them characters.
      // Same word selection.whatSentence settled on, for the same reason.
      headline: `${n} thing${s(n)} need${n === 1 ? "s" : ""} another pass`,
      detail: worst ? worstBits(worst, stats) : null,
      counts,
    };
  }

  if (run.totalMisses) {
    // Nothing unlanded, but retries happened: name what they
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
            ...nameList(worst.entries, worst.byEntry),
            {
              t: ` took the most retries: ${misses(worst.misses)}${
                worst.entries.length > 1 ? " each" : ""
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
        t: `${run.questionsTotal} / ${run.questionsTotal} ${"score"}`,
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
