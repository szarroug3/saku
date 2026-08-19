// Recent Sessions, one row per completed multi-round session — SAK-23.
//
// THE PROBLEM THIS SOLVES
// ========================
// `closeRound` (quiz-session.tsx) commits a durable record every time a round
// closes, on purpose: that is what lets a session abandoned between rounds
// keep the rounds it did finish, instead of losing everything the way a
// single end-of-session write used to. But it means a COMPLETED three-round
// session writes three records, and Recent Sessions — which has always shown
// one row per record — rendered three rows for the one session a learner
// actually ran, each carrying only that round's own count and score.
//
// THE FIX IS READ-SIDE, NOT WRITE-SIDE
// =====================================
// Nothing here changes what gets written, folded into the per-fact aggregate,
// or queued in the outbox — all of that keeps the per-round grain, and keeps
// the abandonment guarantee it exists for. `buildSessionListRows` only decides
// how the STORED records are grouped for display: records sharing a
// `sessionId` (minted once per StudySession, see quiz-session.tsx's
// startSession) are the same session's rounds, and are merged into one row
// with the real total/score summed across the group. A record with no
// `sessionId` — a one-off quiz, or a session recorded before this field
// existed — is its own row, unchanged.

import { totalFor, accuracyOf } from "@/lib/accuracy";
import { factKeys } from "@/lib/fact-keys";
import { mergeStats } from "@/lib/session";
import type {
  FactId,
  QuizSessionRecord,
  SessionFactCounts,
  SessionStats,
} from "@/types";

/** One Recent Sessions row: a QuizSessionRecord's shape (so every existing
 * reader — viewStoredSession, makeList, the row itself — keeps working
 * unchanged), plus the underlying record ids a delete of this row must
 * remove. */
export interface SessionListRow extends QuizSessionRecord {
  /** Every underlying record this row represents, oldest first. A standalone
   * row (no `sessionId`, or the only record with one) is just its own key. */
  ids: (string | number)[];
}

/** The stable identity a record is keyed on — matches sessions-list.tsx's
 * rowKey and history.deleteSessions' id-else-ts fallback. */
function recordKey(r: QuizSessionRecord): string | number {
  return r.id ?? r.ts;
}

function emptyCounts(): SessionFactCounts {
  return { seen: 0, missed: 0, firstTry: 0, correct: 0 };
}

/** Sum every round's per-fact counts into one map — the same COUNTS-add-up
 * reasoning session.ts's mergeStats states for FactSessionDetail, one level
 * lighter (no confusions/showings, just the four poolable numbers). */
function mergeFactCounts(
  records: readonly QuizSessionRecord[],
): Record<FactId, SessionFactCounts> {
  const out: Record<FactId, SessionFactCounts> = {};
  for (const r of records) {
    for (const f of factKeys(r.facts ?? {})) {
      const a = r.facts[f];
      const dst = out[f] ?? (out[f] = emptyCounts());
      dst.seen += a.seen;
      dst.missed += a.missed;
      dst.firstTry += a.firstTry ?? 0;
      dst.correct += a.correct ?? 0;
      // "Did any round's first showing land cold" — a display-only OR, not a
      // new scoring verdict; nothing downstream of this merged row feeds the
      // scheduler (see the header: this is read-side only).
      dst.firstTryHit = (dst.firstTryHit ?? false) || (a.firstTryHit ?? false);
    }
  }
  return out;
}

/** Merge one session's round records into a single display row. */
function mergeGroup(records: readonly QuizSessionRecord[]): SessionListRow {
  const sorted = [...records].sort((a, b) => a.ts - b.ts);
  const newest = sorted[sorted.length - 1];
  const facts = mergeFactCounts(sorted);
  const agg = totalFor({ facts }, factKeys(facts));

  // Full per-fact detail merges the same way `totalStats` accumulates across
  // rounds in the live session (session.ts's mergeStats) — real answer detail
  // in, real answer detail out. Only when every round in the group has it; an
  // older summary-only record in the mix means the row falls back to `facts`
  // alone, same as sessions-list.tsx already does for a single summary-only
  // record via viewStoredSession.
  let detail: SessionStats | undefined;
  if (sorted.every((r) => r.detail)) {
    for (const r of sorted) {
      detail = detail ? mergeStats(detail, r.detail!) : r.detail;
    }
  }

  return {
    id: newest.id,
    sessionId: newest.sessionId,
    ts: newest.ts,
    mode: newest.mode,
    redrill: sorted.some((r) => r.redrill),
    total: agg.seen,
    forgivingPct: accuracyOf(agg) ?? 0,
    strictPct: agg.seen ? Math.round((100 * agg.firstTry) / agg.seen) : 0,
    facts,
    ...(detail ? { detail } : {}),
    // Every round of a session ran the SAME frozen `planned` set (see
    // StudySession.facts) — any round's copy is the group's.
    ...(newest.planned ? { planned: newest.planned } : {}),
    rounds: sorted.length,
    ids: sorted.map(recordKey),
  };
}

/**
 * Group stored records into Recent Sessions rows — one per `sessionId`, one
 * per otherwise-standalone record. Order of the input does not matter; order
 * of the output follows the input (sessions-list.tsx sorts the result itself).
 */
export function buildSessionListRows(
  records: readonly QuizSessionRecord[],
): SessionListRow[] {
  const groups = new Map<string, QuizSessionRecord[]>();
  const rows: SessionListRow[] = [];
  for (const r of records) {
    if (!r.sessionId) {
      rows.push({ ...r, ids: [recordKey(r)] });
      continue;
    }
    const list = groups.get(r.sessionId);
    if (list) list.push(r);
    else groups.set(r.sessionId, [r]);
  }
  for (const list of groups.values()) {
    rows.push(
      list.length === 1
        ? { ...list[0], ids: [recordKey(list[0])] }
        : mergeGroup(list),
    );
  }
  return rows;
}
