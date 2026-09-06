// Recent sessions' model (SAK-347): what the learner has done, newest
// first, each session as the cards it asked and how each went, in the
// quiz's own grades. The route reads the app's session records into this;
// this only says what a session looks like under the sky.

import type { Grade } from "./quiz";
import type { SkyItem } from "./types";

export type SessionKind = "quiz" | "ordering" | "other";

export const SESSION_KIND: Record<SessionKind, string> = { quiz: "Quiz", ordering: "Sentence ordering", other: "Session" };

export interface SessionCard {
  /** The fact asked. */
  id: string;
  item: SkyItem;
  grade: Grade;
  /** Showings of it in this session. */
  seen: number;
}

export interface SkySession {
  id: string;
  when: number;
  kind: SessionKind;
  cards: readonly SessionCard[];
}

/** How a session went: the grades, counted. */
export function tally(session: SkySession): Record<Grade, number> {
  const t: Record<Grade, number> = { clean: 0, help: 0, missed: 0 };
  for (const c of session.cards) t[c.grade]++;
  return t;
}

/** The grade the quiz would give a fact from a session's counts: never
 * right is missed, every showing right first time is perfect, else help. */
export function gradeFromCounts(counts: { seen: number; correct: number; firstTry: number }): Grade {
  if (counts.correct === 0) return "missed";
  return counts.firstTry >= counts.seen ? "clean" : "help";
}

/**
 * "Sep 6, 9:17 PM", or "Sep 6, 2025, 9:17 PM" when it was not this year.
 *
 * The year only when it is needed, because a list of this week's sessions
 * does not want it on every row, and a session from last September read
 * exactly like one from this September without it (SAK-355).
 *
 * In the reader's own timezone, which means it can only be called in a
 * browser: see `useMounted`, and the callers that use it.
 */
export function formatWhen(ts: number, now = Date.now()): string {
  const then = new Date(ts);
  const thisYear = then.getFullYear() === new Date(now).getFullYear();
  return then.toLocaleString([], {
    month: "short",
    day: "numeric",
    ...(thisYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}
