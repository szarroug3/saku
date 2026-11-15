// What GET /api/slotes/activity sends: the owner's quiz records as rows
// for Slotes, the owner's private dashboard, which calls the route server
// to server with a bearer token and shows them beside the rest of the week.
//
// Pure, so the route stays a thin shell around one read: the bearer check and
// the shaping both live here and are tested here. The contract is Slotes'
// (its `saku` fetcher was deployed against it first), so the field names and
// meanings below follow it rather than this app's own vocabulary.
//
// QUIZZES ONLY. Saku keeps no log of lessons: opening a star stamps its facts
// in `seen`, one timestamp per fact that moves forward each time, and the one
// lesson left part way through is kept as a place, not as a history. Neither
// says "a lesson happened at this time", so no lesson rows are made up from
// them. Nor is there a streak anywhere in the app, so the response leaves the
// optional `streak` out.

import { createHash, timingSafeEqual } from "node:crypto";

import type { QuizMode } from "@/types/sky";
import type { QuizSessionRecord } from "@/types/store";

/** One row of the response, in the contract's shape. */
export interface SlotesActivity {
  id: string;
  at: string;
  kind: "quiz";
  title: string;
  total: number;
  correct: number;
  accuracy: number;
  note?: string;
  url?: string;
}

/**
 * Whether an `Authorization` header carries the expected bearer token.
 *
 * False when no token is configured at all, so an unset env var locks the
 * route rather than opening it. Both sides are hashed before the compare so
 * `timingSafeEqual` always gets equal lengths, and the time it takes says
 * nothing about how long the real token is or how much of it matched.
 */
export function bearerMatches(header: string | null, expected: string | undefined): boolean {
  if (!expected) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header?.trim() ?? "");
  if (!match) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(match[1]), digest(expected));
}

/** The mode in words. "Quiz" for a drill, which is what the Sky's own
 * Sessions list calls one; the rest are older screens' records. */
const MODE_TITLE: Record<QuizMode, string> = {
  drill: "Quiz",
  pairs: "Pairs",
  grid: "Grid",
  assembly: "Sentence ordering",
  substitution: "Substitution",
  "listen-sentence": "Listening",
};

/** What a row calls itself. A practice run is recorded as a drill and told
 * apart only by its mark, so the mark wins, with the saved deck's name after
 * it when it has one: "Practice: Evening drill". */
export function activityTitle(record: QuizSessionRecord): string {
  if (record.practice) {
    return record.practice.name ? `Practice: ${record.practice.name}` : "Practice";
  }
  return MODE_TITLE[record.mode] ?? "Session";
}

/** The second line: a redrill says so, and a run of several rounds says how
 * many. Absent when there is nothing to add. */
function activityNote(record: QuizSessionRecord): string | undefined {
  const parts: string[] = [];
  if (record.redrill) parts.push("Redrill");
  if (record.rounds && record.rounds > 1) parts.push(`${record.rounds} rounds`);
  return parts.length ? parts.join(" · ") : undefined;
}

/**
 * One record as a row.
 *
 * The score is `forgivingPct`, the number buildSessionRecord takes from the
 * same pooling the results screen shows the learner, and `correct` is read
 * back from it against `total` (showings), so the three always agree with
 * each other. A record written before ids existed gets one from its time and
 * mode, which is the same on every read.
 */
export function toActivity(record: QuizSessionRecord, sessionsUrl?: string): SlotesActivity {
  const total = record.total;
  const accuracy = Math.max(0, Math.min(100, Math.round(record.forgivingPct)));
  const note = activityNote(record);
  return {
    id: record.id ?? `${record.ts}-${record.mode}`,
    at: new Date(record.ts).toISOString(),
    kind: "quiz",
    title: activityTitle(record),
    total,
    correct: Math.round((total * accuracy) / 100),
    accuracy,
    ...(note ? { note } : {}),
    ...(sessionsUrl ? { url: sessionsUrl } : {}),
  };
}

/** Every record at or after `sinceMs`, newest first, as rows. */
export function activitySince(
  sessions: readonly QuizSessionRecord[],
  sinceMs: number,
  sessionsUrl?: string,
): SlotesActivity[] {
  return sessions
    .filter((r) => Number.isFinite(r.ts) && r.ts >= sinceMs)
    .sort((a, b) => b.ts - a.ts)
    .map((r) => toActivity(r, sessionsUrl));
}
