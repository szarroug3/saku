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
// one of the pair's two characters. Otherwise a week of hiragana-only practice
// would quietly graduate a katakana pair that never had a chance to appear.
// Sessions with no `detail` at all (written by very old versions) are skipped
// rather than read as clean — absent evidence is not evidence of absence.

import type { HistoryFile, SessionStats } from "@/types";

/** Pair-key separator. Mirrors engine.confusionPairs(), which is where this
 * key shape comes from — a sorted join, so "a said for b" and "b said for a"
 * land in one symmetric bucket. */
const SEP = "·";

/** The two characters, sorted and joined — one key per confusion, whichever
 * way round it happened. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join(SEP);
}

/** The key's two characters, in key order. */
export function pairChars(key: string): [string, string] {
  const [a, b] = key.split(SEP);
  return [a, b];
}

/** Mix-up counts for one pair, split by which character was on screen. */
export interface PairCounts {
  /** First character of the sorted key. */
  a: string;
  b: string;
  /** Times `a` was shown and answered with `b`'s reading. */
  aAsB: number;
  /** Times `b` was shown and answered with `a`'s reading. */
  bAsA: number;
  /** aAsB + bAsA. */
  total: number;
}

export interface RunPair extends PairCounts {
  key: string;
}

function emptyPair(key: string): RunPair {
  const [a, b] = pairChars(key);
  return { key, a, b, aAsB: 0, bAsA: 0, total: 0 };
}

/** Every pair one run's detail mixed up, most mix-ups first. */
export function pairsThisRun(stats: SessionStats): RunPair[] {
  return [...indexPairs(stats).values()].sort(
    (p, q) => q.total - p.total || p.key.localeCompare(q.key),
  );
}

/** key → counts for one session's detail. `detail[c].confused[x] = n` means
 * "c was on screen and answered as x" — one direction, so the sorted key both
 * merges the pair and remembers which way it went. */
function indexPairs(detail: SessionStats): Map<string, RunPair> {
  const pairs = new Map<string, RunPair>();
  for (const [c, d] of Object.entries(detail)) {
    for (const [x, n] of Object.entries(d?.confused ?? {})) {
      if (c === x || !n) continue;
      const key = pairKey(c, x);
      const p = pairs.get(key) ?? emptyPair(key);
      if (c === p.a) p.aAsB += n;
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
  /** Lopsided: `shown` is the character you don't recognise, and you fall
   * back on `readAs`, the one you do. Drill `shown`. */
  | { kind: "one-way"; shown: string; readAs: string; share: number }
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
  key: string;
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

export function emptyRecord(key: string): PairRecord {
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
 * it actually show one of the two characters.
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
  /** Skip this session. The run being reported may already have been POSTed to
   * history, and a run must not appear in its own history. */
  excludeTs?: number;
  /** Track these pairs too, even if history never mixed them up. A pair you
   * mixed up for the FIRST time today has no record, but it does have a past:
   * without this it can't say "first time in 12 runs", which is the whole
   * difference between a slip and a problem. */
  keys?: Iterable<string>;
}

interface Slice {
  detail: SessionStats;
  pairs: Map<string, RunPair>;
}

function slices(history: HistoryFile, opts: RecordOpts): Slice[] {
  return history.sessions
    .filter((s) => s.detail && s.ts !== opts.excludeTs)
    .sort((p, q) => p.ts - q.ts)
    .map((s) => ({ detail: s.detail!, pairs: indexPairs(s.detail!) }));
}

/** Whether a run's detail could have produced this pair — the denominator
 * rule. Either character being SHOWN is enough. */
function qualifies(detail: SessionStats, a: string, b: string): boolean {
  return a in detail || b in detail;
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
  opts: RecordOpts = {},
): Map<string, PairRecord> {
  const runs = slices(history, opts);
  const keys = new Set<string>(opts.keys ?? []);
  for (const r of runs) for (const key of r.pairs.keys()) keys.add(key);

  const records = new Map<string, PairRecord>();
  for (const key of keys) {
    const [a, b] = pairChars(key);
    let rec = emptyRecord(key);
    for (const r of runs) {
      if (!qualifies(r.detail, a, b)) continue;
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
): PairRecord[] {
  return [...pairRecords(history, graduateRuns).values()]
    .filter((r) => r.tracked && r.runsMixedUp > 0)
    .sort((p, q) => q.total - p.total || p.key.localeCompare(q.key));
}

// ---------- one run, read against history ----------

export interface PairRow {
  key: string;
  a: string;
  b: string;
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
  opts: { graduateRuns: number; excludeTs?: number },
): RunAnalysis {
  const { graduateRuns } = opts;
  const thisRun = indexPairs(stats);
  const records = pairRecords(history, graduateRuns, {
    excludeTs: opts.excludeTs,
    keys: thisRun.keys(),
  });

  const rows: PairRow[] = [];
  for (const key of records.keys()) {
    const [a, b] = pairChars(key);
    const prior = records.get(key) ?? emptyRecord(key);
    const run = thisRun.get(key) ?? emptyPair(key);
    const state = pairStateOf(
      prior,
      run,
      qualifies(stats, a, b),
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
