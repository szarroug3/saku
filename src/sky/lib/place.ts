// Where the learner was, whatever they were doing (SAK-444).
//
// SAK-404 wrote down a quiz left part way through and nothing else, so the
// one offer a learner came back to was always the quiz. Start a lesson on
// top of that, walk three stars in, leave, and there was no way back into
// the lesson at all: the offer pointed at the old quiz, and the lesson's own
// place had never been written anywhere.
//
// So the thing that is kept is a PLACE, and a place has two slots: the quiz
// left part way through, and the lesson left part way through. One of each,
// never two of either, for the reason the column gives below.
//
// ONE DOCUMENT, WITH A VERSION. The account's `session` column holds one JSON
// document and the browser's copy is that same document under one key, so the
// two slots ride together or not at all. The document says which version it
// is, and a document with no version is SAK-404's bare run, which reads as a
// place holding that quiz and no lesson. That migration is the whole reason
// the version is there: a learner who was halfway through a run when this
// shipped keeps it.
//
// WHY ONE QUIZ AND NOT A LIST. The column is last-writer-wins over one
// document (see `writeSessionRow`), and a list of unfinished runs would need
// a rule for how long a run stays in it and a way to throw the oldest out.
// One of each kind needs neither, and the one case it costs anything -- a
// second quiz started while the first is unfinished -- is the case the quiz
// already asks about before it replaces anything.
//
// PURE, and knows nothing about where it is stored or what a URL looks like.
// The browser's copy and the account's column are the route layer's business
// (quiz-run-store.ts), and so is the href each entry is continued at.

import { readRun, runNote, type SavedRun } from "./quiz-run";

/** A lesson part way through, as it is written down.
 *
 * The picks are what the lesson was asked for, which is what sends the
 * learner back to the same lesson, the way a run's source does for a quiz.
 * The step is kept twice over: as the star, which is what the way back opens
 * on, and as its place in the order, which is what the offer can say out loud
 * without loading the whole lesson to work it out. */
export interface SavedLesson {
  /** What the lesson was asked for, in the order it was picked. */
  picks: readonly string[];
  /** Which step of the order the learner was on, from zero. */
  at: number;
  /** How many steps the order held when they left. */
  steps: number;
  /** The star that step is, so the way back opens on it. */
  star: string;
  /** When the lesson was last stepped. */
  leftAt: number;
}

/** Everything left part way through: one quiz, one lesson, either of them
 * null. */
export interface SavedPlace {
  quiz: SavedRun | null;
  lesson: SavedLesson | null;
}

/** Nothing left anywhere. A constant, so a component that takes a place can
 * be handed the same object every render. */
export const NO_PLACE: SavedPlace = { quiz: null, lesson: null };

/** Which shape the document is in. 1 was SAK-404's bare run, which was never
 * written with a version at all, so it is known by what it is missing. */
const PLACE_VERSION = 2;

const isIds = (v: unknown): v is readonly string[] => Array.isArray(v) && v.every((s) => typeof s === "string");

/** A stored lesson read back, or null when there is nothing usable there.
 *
 * A lesson of no picks is nothing to come back to, and neither is one on the
 * first step: that learner opened the lesson and left, and the way back to
 * "the very beginning" is the lesson itself. */
function readLesson(raw: unknown): SavedLesson | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Partial<SavedLesson>;
  if (!isIds(l.picks) || l.picks.length === 0) return null;
  if (typeof l.star !== "string" || !l.star) return null;
  const steps = typeof l.steps === "number" && l.steps > 0 ? Math.floor(l.steps) : 0;
  const at = typeof l.at === "number" && l.at > 0 ? Math.floor(l.at) : 0;
  if (at === 0 || at >= steps) return null;
  return { picks: l.picks, at, steps, star: l.star, leftAt: typeof l.leftAt === "number" ? l.leftAt : 0 };
}

/**
 * The place as it comes back out of storage, whatever shape it is in.
 *
 * Three cases, and all three are this app's own writing rather than a
 * stranger's, so this guards against an older shape rather than against an
 * attacker. Nothing at all is an empty place. A document of this version is
 * read slot by slot. Anything else is SAK-404's bare run, which is a place
 * holding that quiz and no lesson; a run too far gone for `readRun` reads as
 * an empty place, which is what it read as before.
 */
export function readPlace(raw: unknown): SavedPlace {
  if (!raw || typeof raw !== "object") return NO_PLACE;
  const doc = raw as { v?: unknown; quiz?: unknown; lesson?: unknown };
  if (doc.v !== PLACE_VERSION) return { quiz: readRun(raw), lesson: null };
  return { quiz: readRun(doc.quiz), lesson: readLesson(doc.lesson) };
}

/** The place as it goes into storage, or null when there is nothing left
 * anywhere and the whole document should go. An empty slot is left out
 * rather than written as null, so a document is as small as what is in it. */
export function placeDoc(place: SavedPlace): unknown {
  if (!place.quiz && !place.lesson) return null;
  return { v: PLACE_VERSION, ...(place.quiz ? { quiz: place.quiz } : {}), ...(place.lesson ? { lesson: place.lesson } : {}) };
}

/** The lesson as it should be written after a step, or null when there is
 * nothing worth keeping: a lesson still on its first step is one the learner
 * opened and left, and the way back to the very beginning is the lesson
 * itself. The LAST step is kept, because the thing waiting there is the
 * drill; pressing it is what clears the lesson. */
export function lessonToKeep(picks: readonly string[], at: number, steps: number, star: string, now: number): SavedLesson | null {
  if (picks.length === 0 || at <= 0 || at >= steps) return null;
  return { picks, at, steps, star, leftAt: now };
}

/** Whether a lesson was asked for in the same words: the same picks, in the
 * same order. A lesson only picks up a place of its own, the way a quiz only
 * picks up a run from the same source. */
export function samePicks(a: readonly string[], b: readonly string[]): boolean {
  return a.join(",") === b.join(",");
}

/** Whether anything at all was left part way through. What a page asks
 * before it decides between the browser's place and the account's: the
 * browser's wins whole when it holds anything, the way SAK-404 had it. */
export function hasPlace(place: SavedPlace): boolean {
  return !!(place.quiz || place.lesson);
}

/** One thing left part way through, whichever kind it is. */
export type PlaceEntry =
  | { kind: "quiz"; run: SavedRun }
  | { kind: "lesson"; lesson: SavedLesson };

/** The word for each kind, for a row that has to say which it is. */
export const PLACE_KIND: Record<PlaceEntry["kind"], string> = { quiz: "Quiz", lesson: "Lesson" };

/** Everything left part way through, newest first. */
export function placeEntries(place: SavedPlace): PlaceEntry[] {
  const entries: PlaceEntry[] = [
    ...(place.lesson ? [{ kind: "lesson", lesson: place.lesson } as const] : []),
    ...(place.quiz ? [{ kind: "quiz", run: place.quiz } as const] : []),
  ];
  return entries.sort((a, b) => leftAt(b) - leftAt(a));
}

/** The one thing Continue offers: the newest of them, or nothing. */
export function newestPlace(place: SavedPlace): PlaceEntry | null {
  return placeEntries(place)[0] ?? null;
}

function leftAt(entry: PlaceEntry): number {
  return entry.kind === "quiz" ? entry.run.leftAt : entry.lesson.leftAt;
}

/** How far in, in the app's words: "12 of 30" for a quiz, "step 3 of 7" for
 * a lesson. */
export function placeNote(entry: PlaceEntry): string {
  return entry.kind === "quiz" ? runNote(entry.run) : `step ${entry.lesson.at + 1} of ${entry.lesson.steps}`;
}

/** What the one Continue button says: "Continue your lesson (step 3 of 7)". */
export function placeLabel(entry: PlaceEntry): string {
  return `Continue your ${entry.kind} (${placeNote(entry)})`;
}
