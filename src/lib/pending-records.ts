// Records that have been MADE but not yet ACKNOWLEDGED by the server.
//
// WHAT THIS REPLACES
// ==================
//
//     fetch("/api/session", …).catch(() => {});
//
// One line, and it was the whole durability story for a finished session. Offline,
// server down, tab closed while the request was in flight, a 503 because
// history.json is unreadable — in every one of those the local state moved on as
// if the write had happened, the record was gone from memory, and nothing
// anywhere had a copy. The learner was told nothing.
//
// So a record is written HERE first, synchronously, before anything is posted.
// It leaves only when the server says it has it. Until then it survives a
// reload, a crash and a week offline, and it is retried on the next mount, the
// next commit, and the moment the browser says it is back online.
//
// A SEPARATE KEY FROM THE SESSION SNAPSHOT, ON PURPOSE
// ====================================================
// The quiz snapshot (`kanaquiz-session`) is the subject of a cross-tab
// adoption protocol that took a write storm to get right — see the storm note
// in quiz-session.tsx. This queue must not go anywhere near it. It has its own
// key, no adoption, no owner stamp, and the only cross-tab hazard it has is two
// tabs posting the same record at once, which is settled on the SERVER by the
// record's id rather than here by a lock (see history.saveSession).
//
// Every function is a read-modify-write against live storage rather than
// against a cached list, for the same reason: the other tab may have queued
// something since we last looked, and losing it would defeat the point.
//
// PURE OF THE BROWSER. `localStorage` is passed in, so the whole queue is
// testable in plain Node — see pending-records.test.ts.

import type { QuizSessionRecord } from "@/types";

/** The localStorage key. Deliberately not the session snapshot's. */
export const PENDING_KEY = "kanaquiz-pending-records";

/**
 * How many unsent records to keep.
 *
 * There IS a cap, and it does drop the oldest, and that is a real (bounded)
 * loss rather than a tidy-up. The alternative is worse: records carry full
 * per-fact `detail`, localStorage is a few megabytes, and an unbounded queue
 * eventually throws on `setItem` — at which point NOTHING can be queued and
 * every subsequent round is lost instead of the fiftieth-oldest one. Fifty
 * rounds is many days of unsent work; anyone who reaches it has a broken server
 * and has been told so on every screen since the first failure.
 */
export const MAX_PENDING = 50;

/** The two localStorage methods this module needs. Injected so the queue can be
 * tested without a browser. */
export interface RecordStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * The queue, oldest first.
 *
 * A queue that cannot be parsed is treated as EMPTY — the opposite of the rule
 * for history.json, and deliberately. history.json is the durable copy and
 * losing it is the whole bug; this is a retry buffer whose contents have
 * already failed to reach the server once, and a client that refuses to start
 * because its outbox is malformed is a client that can never queue anything
 * again.
 */
export function readPending(store: RecordStore): QuizSessionRecord[] {
  try {
    const raw = store.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QuizSessionRecord[]) : [];
  } catch {
    return [];
  }
}

/** Replace the queue. Silent on failure — a full or unavailable storage is
 * already the caller's problem, and it is reported through the save status
 * rather than thrown from here. */
function writePending(store: RecordStore, list: QuizSessionRecord[]): boolean {
  try {
    store.setItem(PENDING_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/**
 * Add a record to the queue, re-reading storage first.
 *
 * Idempotent on `id`: queueing the same record twice leaves one copy. That is
 * not paranoia — React effects run twice in development, and a commit path that
 * fires once per state change is exactly the shape that fires more than once.
 *
 * Returns the new queue, or null if it could not be stored at all — which the
 * caller must treat as "this record is not safe anywhere" and say so.
 */
export function enqueuePending(
  store: RecordStore,
  record: QuizSessionRecord,
): QuizSessionRecord[] | null {
  const list = readPending(store);
  if (record.id && list.some((r) => r.id === record.id)) return list;
  const next = [...list, record].slice(-MAX_PENDING);
  return writePending(store, next) ? next : null;
}

/**
 * Drop a record the server has acknowledged.
 *
 * By id, and only by id. Dropping "the one we just posted" by position would
 * drop whatever the other tab queued in the meantime, which is the one way a
 * retry buffer can itself lose work.
 */
export function acknowledgePending(
  store: RecordStore,
  id: string | undefined,
): QuizSessionRecord[] {
  const list = readPending(store);
  if (!id) return list;
  const next = list.filter((r) => r.id !== id);
  if (next.length !== list.length) writePending(store, next);
  return next;
}
