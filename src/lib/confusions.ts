// The confusion lifecycle — how a mix-up between two characters is born,
// tracked, beaten, and finally forgotten.
//
// Pure TypeScript, no React, no DOM. Results renders these; it does not define
// them. Home's Confusions card and Weakest 20 can read the same records
// through `activeWeaknessPairs` without duplicating the walk.
//
// THE FIVE STATES
// ===============
// A pair moves through these, and `cfg.graduateRuns` (default 10) is the
// graduation threshold:
//
//   weakness  — mixed up THIS run, and in earlier qualifying runs
//   new       — mixed up this run, clean in every earlier qualifying run
//   improving — not mixed up this run, was a weakness, 1..graduateRuns-1 clean
//   cleared   — the graduation run: the clean streak hits graduateRuns exactly
//   retired   — past graduation. Reports NOTHING, anywhere.
//
// The rule that holds the screen together: a pair you got RIGHT this run and
// that was never a weakness is not shown at all. A results screen reports THIS
// run; history only changes how seriously to take what happened.
//
// THE DENOMINATOR RULE
// ====================
// A run only counts toward a pair's history if its `detail` CONTAINED at least
// one of the pair's two entries. Otherwise a week of hiragana-only practice
// would quietly graduate a katakana pair that never had a chance to appear.
// Sessions with no `detail` at all are skipped rather than read as clean —
// absent evidence is not evidence of absence.
//
// TWO KEY SPACES
// ==============
// A pair is keyed by ENTRY (生, 待つ). A run's `detail` is keyed by FACT. They
// are not the same strings and they are not interchangeable, so every function
// here that reads across them takes an `entryOf` and says so in its signature.
//
// That is not decoration. `qualifies` used to read `a in detail || b in detail`
// — a character key tested against a character-keyed map. Re-keying `detail` by
// fact makes that expression return false forever: the keys became
// `kanji:生/reading@学生` and no entry id will ever match one. Nothing throws.
// No pair qualifies, so no pair accrues a clean run, so nothing graduates, and
// the five-state lifecycle above quietly stops existing while every screen
// still renders. The signature is what turns that silent `false` into a
// compile error.
//
// `entryOf` is injected rather than imported so this file stays subject-
// agnostic (and testable without the whole character table). It is the only
// thing here that knows facts and entries are related at all.

import type { EntryId, FactId, HistoryFile, SessionStats } from "@/types";

/** Resolves a fact to the entry it belongs to — src/lib/facts.ts `entryOf`. */
export type EntryOf = (fact: FactId) => EntryId;

/** Pair-key separator. A sorted join, so "a said for b" and "b said for a"
 * land in one symmetric bucket. */
const SEP = "·";

/** An opaque key for one confusion, whichever way round it happened. */
export type PairKey = string;

/** The two entries, sorted and joined — one key per confusion. */
export function pairKey(a: EntryId, b: EntryId): PairKey {
  return [a, b].sort().join(SEP);
}

/** The key's two entries, in key order. */
export function pairEntries(key: PairKey): [EntryId, EntryId] {
  const [a, b] = key.split(SEP) as [EntryId, EntryId];
  return [a, b];
}

/** Mix-up counts for one pair, split by which entry was on screen. */
export interface PairCounts {
  /** First entry of the sorted key. */
  a: EntryId;
  b: EntryId;
  /** Times `a` was shown and answered as `b`. */
  aAsB: number;
  /** Times `b` was shown and answered as `a`. */
  bAsA: number;
  /** aAsB + bAsA. */
  total: number;
}

export interface RunPair extends PairCounts {
  key: PairKey;
}

function emptyPair(key: PairKey): RunPair {
  const [a, b] = pairEntries(key);
  return { key, a, b, aAsB: 0, bAsA: 0, total: 0 };
}

/** Every pair one run's detail mixed up, most mix-ups first. */
export function pairsThisRun(
  stats: SessionStats,
  entryOf: EntryOf,
): RunPair[] {
  return [...indexPairs(stats, entryOf).values()].sort(
    (p, q) => q.total - p.total || p.key.localeCompare(q.key),
  );
}

/**
 * key → counts for one session's detail.
 *
 * `detail[fact].confused[entry] = n` means "this FACT was on screen and you
 * answered as that ENTRY" — the two key spaces meeting, one map inside the
 * other. Resolving the outer key through `entryOf` puts both sides in entry
 * space, where the pair lives; the sorted key then merges the pair while the
 * a/b split remembers which way it went.
 */
function indexPairs(
  detail: SessionStats,
  entryOf: EntryOf,
): Map<PairKey, RunPair> {
  const pairs = new Map<PairKey, RunPair>();
  for (const [fact, d] of Object.entries(detail)) {
    const shown = entryOf(fact as FactId);
    for (const [x, n] of Object.entries(d?.confused ?? {})) {
      const said = x as EntryId;
      if (shown === said || !n) continue;
      const key = pairKey(shown, said);
      const p = pairs.get(key) ?? emptyPair(key);
      if (shown === p.a) p.aAsB += n;
      else p.bAsA += n;
      p.total += n;
      pairs.set(key, p);
    }
  }
  return pairs;
}

// ---------- direction ----------

/** Share of one direction at or above which the pair is called lopsided. */
export const ONE_WAY_SHARE = 0.75;

/** Mix-ups needed before a direction is claimed at all. Calling a pair
 * "nearly always" one-way off a single data point is a lie dressed as
 * a finding — one mix-up is 100% one-way by arithmetic, not by evidence. */
export const DIRECTION_MIN = 3;

export type PairDirection =
  /** Lopsided: `shown` is the entry you don't recognise, and you fall back on
   * `readAs`, the one you do. Drill `shown`. */
  | { kind: "one-way"; shown: EntryId; readAs: EntryId; share: number }
  /** Neither shape is anchored — you're guessing between the two. */
  | { kind: "mixed" }
  /** Too few mix-ups to say. */
  | { kind: "unknown" };

/** Which way a confusion goes, when there's enough of it to tell. */
export function directionOf(p: PairCounts): PairDirection {
  if (p.total < DIRECTION_MIN) return { kind: "unknown" };
  const lead = Math.max(p.aAsB, p.bAsA);
  const share = lead / p.total;
  if (share < ONE_WAY_SHARE) return { kind: "mixed" };
  const aLeads = p.aAsB >= p.bAsA;
  return {
    kind: "one-way",
    shown: aLeads ? p.a : p.b,
    readAs: aLeads ? p.b : p.a,
    share,
  };
}

// ---------- the record ----------

/**
 * A pair's standing, folded over the qualifying runs.
 *
 * Everything except `cleanStreak` describes the CURRENT record — the one that
 * opened at the pair's most recent first mix-up. A graduated pair's old misses
 * are dropped the moment a new mix-up opens a fresh record, which is what
 * "cleared means cleared" costs: those 90 old misses stop counting in Patterns,
 * in Home's Confusions card and in Weakest 20. Statistics still remembers,
 * because remembering is that page's job.
 */
export interface PairRecord extends PairCounts {
  key: PairKey;
  /** An open weakness record exists: mixed up since the last graduation, and
   * not yet graduated again. */
  tracked: boolean;
  /** The pair has been mixed up at least once, ever. */
  everMixedUp: boolean;
  /** Consecutive most-recent qualifying runs with no mix-up. Counts from the
   * very first qualifying run, so it also answers "first time in N runs". */
  cleanStreak: number;
  /** Qualifying runs folded into the current record. */
  qualifyingRuns: number;
  /** Of those, the ones that had a mix-up. */
  runsMixedUp: number;
}

export function emptyRecord(key: PairKey): PairRecord {
  return {
    ...emptyPair(key),
    tracked: false,
    everMixedUp: false,
    cleanStreak: 0,
    qualifyingRuns: 0,
    runsMixedUp: 0,
  };
}

/**
 * Fold one qualifying run into a record. `run` is null (or zeroed) for a run
 * that showed the characters and did not mix them up.
 *
 * The record is NOT zeroed at graduation — the "cleared" row still has to
 * report what it beat. It is zeroed lazily, when a mix-up arrives with no open
 * record: that is the moment the old failures stop counting.
 */
function step(
  rec: PairRecord,
  run: PairCounts | null,
  graduateRuns: number,
): PairRecord {
  const next = { ...rec };
  if (run && run.total > 0) {
    if (!next.tracked) {
      // Never a weakness, or cleared and retired: start a clean sheet.
      next.qualifyingRuns = 0;
      next.runsMixedUp = 0;
      next.aAsB = 0;
      next.bAsA = 0;
      next.total = 0;
    }
    next.tracked = true;
    next.everMixedUp = true;
    next.cleanStreak = 0;
    next.qualifyingRuns++;
    next.runsMixedUp++;
    next.aAsB += run.aAsB;
    next.bAsA += run.bAsA;
    next.total += run.total;
  } else {
    next.cleanStreak++;
    if (next.tracked) {
      next.qualifyingRuns++;
      // Graduation. The record retires; `tracked` false is what makes every
      // later clean run report nothing.
      if (next.cleanStreak >= graduateRuns) next.tracked = false;
    }
  }
  return next;
}

export type PairState =
  | "weakness"
  | "new"
  | "improving"
  | "cleared"
  | "retired";

/**
 * Where the pair stands after `run`, given the record from every earlier
 * qualifying run. Null when the pair has nothing to say: it wasn't in this run,
 * or it was clean this run and has never been a weakness.
 *
 * `qualifies` is the denominator rule applied to the run being reported — did
 * it actually show one of the two entries.
 */
export function pairStateOf(
  prior: PairRecord,
  run: PairCounts | null,
  qualifies: boolean,
  graduateRuns: number,
): PairState | null {
  if (!qualifies) return null;
  if (run && run.total > 0) {
    // A mix-up with no open record is new, however long the pair's rap sheet
    // was before it graduated — that record is spent.
    return prior.tracked && prior.runsMixedUp > 0 ? "weakness" : "new";
  }
  if (!prior.everMixedUp) return null; // clean, and never a weakness
  if (!prior.tracked) return "retired"; // graduated on an earlier run
  // `tracked` implies prior.cleanStreak < graduateRuns, so this run either
  // lands on graduation exactly or is still climbing.
  return prior.cleanStreak + 1 >= graduateRuns ? "cleared" : "improving";
}

// ---------- reading history ----------

export interface RecordOpts {
  /** Resolves the fact keys of a run's `detail` into the entry space the pairs
   * are keyed in. Required, and injected rather than imported: it is the only
   * thing that bridges the two key spaces, so it is stated rather than
   * assumed. */
  entryOf: EntryOf;
  /** Skip this session. The run being reported may already have been POSTed to
   * history, and a run must not appear in its own history. */
  excludeTs?: number;
  /** Track these pairs too, even if history never mixed them up. A pair you
   * mixed up for the FIRST time today has no record, but it does have a past:
   * without this it can't say "first time in 12 runs", which is the whole
   * difference between a slip and a problem. */
  keys?: Iterable<PairKey>;
}

interface Slice {
  detail: SessionStats;
  pairs: Map<PairKey, RunPair>;
  /** The entries this run SHOWED. Precomputed per run rather than per pair:
   * the denominator rule asks this question once for every pair being folded,
   * and the answer only depends on the run. */
  shown: Set<EntryId>;
}

function slices(history: HistoryFile, opts: RecordOpts): Slice[] {
  return history.sessions
    .filter((s) => s.detail && s.ts !== opts.excludeTs)
    .sort((p, q) => p.ts - q.ts)
    .map((s) => ({
      detail: s.detail!,
      pairs: indexPairs(s.detail!, opts.entryOf),
      shown: entriesShown(s.detail!, opts.entryOf),
    }));
}

/** The entries a run put on screen, whichever of their facts it asked. */
function entriesShown(detail: SessionStats, entryOf: EntryOf): Set<EntryId> {
  const shown = new Set<EntryId>();
  for (const fact of Object.keys(detail)) shown.add(entryOf(fact as FactId));
  return shown;
}

/**
 * Whether a run could have produced this pair — the denominator rule. Either
 * entry being SHOWN is enough.
 *
 * Takes `shown` (entry space) rather than `detail` (fact space) deliberately.
 * The old signature took `detail` and two characters and tested `a in detail`,
 * which was correct only while a character was simultaneously the identity and
 * the key. Handing it fact-keyed detail would have made it answer `false` to
 * everything, silently, forever — killing graduation while every screen kept
 * rendering. Now the argument is already in the pair's own key space, and there
 * is nothing left to get wrong.
 */
function qualifies(shown: Set<EntryId>, a: EntryId, b: EntryId): boolean {
  return shown.has(a) || shown.has(b);
}

/**
 * Every pair history has ever mixed up, folded to its current record.
 *
 * Walks the sessions oldest-first, the same history-walking shape
 * decks.confusionDecks() uses, but per pair and with the denominator rule: runs
 * that never showed either character are skipped, not counted as clean.
 */
export function pairRecords(
  history: HistoryFile,
  graduateRuns: number,
  opts: RecordOpts,
): Map<PairKey, PairRecord> {
  const runs = slices(history, opts);
  const keys = new Set<PairKey>(opts.keys ?? []);
  for (const r of runs) for (const key of r.pairs.keys()) keys.add(key);

  const records = new Map<PairKey, PairRecord>();
  for (const key of keys) {
    const [a, b] = pairEntries(key);
    let rec = emptyRecord(key);
    for (const r of runs) {
      if (!qualifies(r.shown, a, b)) continue;
      rec = step(rec, r.pairs.get(key) ?? null, graduateRuns);
    }
    records.set(key, rec);
  }
  return records;
}

/**
 * The pairs that still count against you — an open record, cleared and retired
 * ones dropped. Worst first.
 *
 * This is the list Home's Confusions card and a weakness deck should draw
 * from: `decks.confusionDecks()` sums every mix-up ever recorded, which keeps
 * surfacing pairs you have already beaten.
 */
export function activeWeaknessPairs(
  history: HistoryFile,
  graduateRuns: number,
  entryOf: EntryOf,
): PairRecord[] {
  return [...pairRecords(history, graduateRuns, { entryOf }).values()]
    .filter((r) => r.tracked && r.runsMixedUp > 0)
    .sort((p, q) => q.total - p.total || p.key.localeCompare(q.key));
}

// ---------- one run, read against history ----------

export interface PairRow {
  key: PairKey;
  a: EntryId;
  b: EntryId;
  state: PairState;
  /** This run's mix-ups. Zeroed for improving/cleared. */
  run: RunPair;
  /** The record with this run folded in — what the row's numbers report. */
  record: PairRecord;
  /** Which way the confusion goes, over the whole open record. */
  direction: PairDirection;
  /** Clean qualifying runs before this one: the "first time in N runs" number
   * a `new` row needs. */
  cleanRunsBefore: number;
  /** Qualifying runs up to and including the last mix-up — the denominator for
   * "4 of your last 6 runs" and "missed it 8 times in 10". */
  runsToLastMixUp: number;
}

export interface RunAnalysis {
  /** Mixed up in this run: weakness | new. Patterns. */
  patterns: PairRow[];
  /** Old weaknesses this run left alone: improving | cleared. Progress. */
  progress: PairRow[];
}

/**
 * This run's confusions, annotated with what history makes of them.
 *
 * Everything in `patterns` happened in this run. Everything in `progress` is a
 * pair this run had a chance to break and didn't. Nothing else is returned:
 * retired pairs, and pairs that were never a weakness, say nothing.
 */
export function analyzeRun(
  stats: SessionStats,
  history: HistoryFile,
  opts: { graduateRuns: number; entryOf: EntryOf; excludeTs?: number },
): RunAnalysis {
  const { graduateRuns, entryOf } = opts;
  const thisRun = indexPairs(stats, entryOf);
  const shown = entriesShown(stats, entryOf);
  const records = pairRecords(history, graduateRuns, {
    entryOf,
    excludeTs: opts.excludeTs,
    keys: thisRun.keys(),
  });

  const rows: PairRow[] = [];
  for (const key of records.keys()) {
    const [a, b] = pairEntries(key);
    const prior = records.get(key) ?? emptyRecord(key);
    const run = thisRun.get(key) ?? emptyPair(key);
    const state = pairStateOf(
      prior,
      run,
      qualifies(shown, a, b),
      graduateRuns,
    );
    if (!state || state === "retired") continue; // retired reports nothing
    const record = step(prior, run, graduateRuns);
    rows.push({
      key,
      a,
      b,
      state,
      run,
      record,
      direction: directionOf(record),
      cleanRunsBefore: prior.cleanStreak,
      runsToLastMixUp: record.qualifyingRuns - record.cleanStreak,
    });
  }

  const patterns = rows
    .filter((r) => r.state === "weakness" || r.state === "new")
    .sort((p, q) => q.run.total - p.run.total || p.key.localeCompare(q.key));
  const progress = rows
    .filter((r) => r.state === "improving" || r.state === "cleared")
    // The graduation row leads: it is the one that only ever shows once.
    .sort(
      (p, q) =>
        Number(q.state === "cleared") - Number(p.state === "cleared") ||
        q.record.total - p.record.total ||
        p.key.localeCompare(q.key),
    );
  return { patterns, progress };
}
