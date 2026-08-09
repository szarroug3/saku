// The TRACK contract — a track supplies only its teaching ORDER; the shared
// engine derives every lesson from it.
//
// Today each track (words, kanji, counters, keigo, grammar, …) hand-rolls its own
// scheduler: fact assembly, cost budgeting, marker/prep-only state. That is where
// ordering bugs live (a rule card reachable before its prereqs; 10+ taught before
// 5). Under this contract a track answers ONE question — "in what order?" — and
// `nextLesson` (Stage 3) does the rest once, for all of them: take the next
// unlearned items in order, cost-budgeted to the LessonRange, prereqs guaranteed.
//
// Stage 0 of docs/architecture-refactor.md: additive, not yet consumed.

import type { HistoryFile } from "@/types";
import type { ContentItem } from "./item";

export interface Track {
  /** Stable id — the track a session and its progress belong to. */
  readonly id: string;
  /**
   * The full teaching sequence for this track, most-fundamental first. A PURE
   * function of history (so a prereq already known drops out), returning items —
   * generative-rule units included. It does NOT decide lesson boundaries, budget,
   * or resume position; the engine owns those so they cannot drift per track.
   */
  order(history: HistoryFile): readonly ContentItem[];
}
