// The post-quiz table, as data — one ROW per word (entry), its facts as cells.
//
// WHY A TABLE, NOT A FLAT LIST
// ============================
// The results and retry screens used to be a flat row of chips: 口's meaning,
// 可's meaning, 生's reading, all shoulder to shoulder. Sam: "break this up into
// a table separated by word and then show the chip on how you did for each." A
// word's facts belong together — 生 asked for its meaning and 生 asked for its
// reading are one character studied two ways — so they group under one row, and
// each cell says how that showing went.
//
// This module is the pure half: it groups the facts and reads the per-fact
// outcome and confusions off the stats. The rendering (colours, selection, the
// glyphs of what you confused it for) is the components' business.

import { entryOf } from "@/lib/facts";
import type { EntryId, FactId, FactSessionDetail, SessionStats } from "@/types";

/** One word's row: the entry, and the facts of it this screen is showing, in
 * the order they arrived. */
export interface EntryRow {
  entry: EntryId;
  facts: FactId[];
}

/**
 * Group facts into rows by their entry, keeping first-seen order for both the
 * rows and the facts within each. A stable grouping: the same input always
 * lays out the same way, so the table does not reshuffle between renders.
 */
export function groupByEntry(facts: readonly FactId[]): EntryRow[] {
  const rows: EntryRow[] = [];
  const byEntry = new Map<EntryId, EntryRow>();
  for (const fact of facts) {
    const entry = entryOf(fact);
    let row = byEntry.get(entry);
    if (!row) {
      row = { entry, facts: [] };
      byEntry.set(entry, row);
      rows.push(row);
    }
    row.facts.push(fact);
  }
  return rows;
}

/** How one showing went, in the four states the cell colour reads from. */
export type Outcome = "first-try" | "recovered" | "missed" | "unseen";

/**
 * Derive a fact's outcome from its session stat — the same signal the old
 * chips' selected / needs-work state came from, named.
 *
 *   unseen     — in the selection but never put on screen (an early-ended round
 *                still offers it; nothing happened to it).
 *   missed     — shown and never landed this run.
 *   first-try  — landed cold, no miss, no hint forfeit.
 *   recovered  — landed, but needed another look (a miss, or a hinted answer).
 *
 * Not "the score": both first-try and recovered count as correct there (see
 * accuracy.ts / summary.isMissed). This is the finer, presentational read the
 * per-cell colour and the redrill candidates need — whether THIS showing cost
 * you a retry, which a plain correct/not-correct verdict can't say.
 */
export function outcomeOf(st?: FactSessionDetail): Outcome {
  if (!st || st.seen === 0) return "unseen";
  if (!(st.correct ?? 0)) return "missed";
  if (st.misses === 0 && st.firstTryCorrect === true) return "first-try";
  return "recovered";
}

/** True for the two outcomes that count as a miss you might want to redrill. */
export function isMiss(outcome: Outcome): boolean {
  return outcome === "missed";
}

/**
 * The entries you answered INSTEAD on this fact — what you confused it for,
 * most-confused first. Keyed by entry, because a confusion is a failure to tell
 * two entries apart (see FactSessionDetail.confused). Empty when the miss was
 * just wrong or blank, with no single entry to name.
 */
export function confusedEntries(st?: FactSessionDetail): EntryId[] {
  if (!st?.confused) return [];
  return (Object.entries(st.confused) as Array<[EntryId, number]>)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([e]) => e);
}

/** A small stats reader that tolerates the loose Record the screens hold. */
export function statFor(
  stats: SessionStats,
  fact: FactId,
): FactSessionDetail | undefined {
  return stats[fact];
}
