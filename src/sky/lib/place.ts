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
// A LESSON IS ONE SITTING, NOT ONE SCREEN (Sam, 2026-09-17). The first cut of
// this file kept only a step number, so the lesson vanished from the offer
// the moment the drill was opened, and a learner resting between rounds was
// offered nothing at all. A lesson runs from its first step to the end of its
// last round: the steps, round 1, a break, round 2, a break, round 3. The
// lesson slot holds the whole of that, as the picks plus which PART of the
// sitting the learner is in, so one button goes back to wherever they left.
//
// ONE DOCUMENT, WITH A VERSION. The account's `session` column holds one JSON
// document and the browser's copy is that same document under one key, so the
// two slots ride together or not at all. The document says which version it
// is, and there are two older shapes to read: version 2 is the lesson as a
// bare step, which becomes a sitting on its steps, and a document with no
// version at all is SAK-404's bare run, which is a place holding that quiz
// and no lesson. That is the whole reason the version is there: a learner who
// was halfway through something when this shipped keeps it.
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

import { readRun, resumeAt, runNote, type SavedRun } from "./quiz-run";
import { LESSON_ROUNDS, restLeft } from "./rest";

/** Which part of the sitting the learner was in.
 *
 * Three, and they are the three things a lesson can be showing: the stars
 * being taught, a round of the drill, or the break between two rounds.
 * A round carries the run itself, which is the same envelope the quiz slot
 * holds, so a round picked up again asks the same cards in the same order
 * with the same answers already given. A break carries only the clock, since
 * the round it leads into has not been dealt yet. */
export type LessonPart =
  | {
      kind: "steps";
      /** Which step of the order the learner was on, from zero. */
      at: number;
      /** How many steps the order held when they left. */
      steps: number;
      /** The star that step is, so the way back opens on it. */
      star: string;
    }
  | {
      kind: "round";
      /** Which round of the drill, from one. */
      round: number;
      /** The round as it was dealt and answered. */
      run: SavedRun;
    }
  | {
      kind: "break";
      /** The round that just ended, from one. */
      round: number;
      /** When the break began, so a changed length counts from the same start. */
      startedAt: number;
      /** When the break is over. */
      until: number;
    };

/** A lesson part way through, as it is written down.
 *
 * The picks are what the lesson was asked for, which is what sends the
 * learner back to the same lesson, the way a run's source does for a quiz. */
export interface SavedLesson {
  /** What the lesson was asked for, in the order it was picked. */
  picks: readonly string[];
  /** Which part of the sitting they were in. */
  part: LessonPart;
  /** When the lesson last moved. */
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
 * written with a version at all, so it is known by what it is missing; 2 was
 * the lesson as a step and nothing else. */
const PLACE_VERSION = 3;

const isIds = (v: unknown): v is readonly string[] => Array.isArray(v) && v.every((s) => typeof s === "string");

const whole = (v: unknown, least: number): number | null => (typeof v === "number" && Number.isFinite(v) && v >= least ? Math.floor(v) : null);

/** A part of the sitting read back, or null when there is nothing usable.
 *
 * Version 2 knew nothing about parts and wrote the step straight onto the
 * lesson, so a part with no `kind` is read as that shape's steps. */
function readPart(raw: unknown): LessonPart | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as { kind?: unknown; at?: unknown; steps?: unknown; star?: unknown; round?: unknown; run?: unknown; startedAt?: unknown; until?: unknown };
  if (p.kind === "round") {
    const round = whole(p.round, 1);
    const run = readRun(p.run);
    return round && run ? { kind: "round", round, run } : null;
  }
  if (p.kind === "break") {
    const round = whole(p.round, 1);
    const until = whole(p.until, 0);
    if (!round || until === null) return null;
    return { kind: "break", round, startedAt: whole(p.startedAt, 0) ?? until, until };
  }
  // steps, whether this version wrote the kind or version 2 did not
  const steps = whole(p.steps, 1);
  const at = whole(p.at, 0);
  if (!steps || at === null || at >= steps) return null;
  if (typeof p.star !== "string" || !p.star) return null;
  return { kind: "steps", at, steps, star: p.star };
}

/** A stored lesson read back, or null when there is nothing usable there.
 *
 * A lesson of no picks is nothing to come back to. A lesson on its FIRST step
 * is: it was opened, and opening it is where the sitting starts (Sam,
 * 2026-09-17). Version 2 threw that one away, which is why a lesson opened
 * and left offered nothing. */
function readLesson(raw: unknown): SavedLesson | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as { picks?: unknown; part?: unknown; leftAt?: unknown };
  if (!isIds(l.picks) || l.picks.length === 0) return null;
  // version 2 wrote the step onto the lesson itself, so the lesson IS the part
  const part = readPart(l.part ?? raw);
  if (!part) return null;
  return { picks: l.picks, part, leftAt: whole(l.leftAt, 0) ?? 0 };
}

/**
 * The place as it comes back out of storage, whatever shape it is in.
 *
 * Every case is this app's own writing rather than a stranger's, so this
 * guards against an older shape rather than against an attacker. Nothing at
 * all is an empty place. A document of this version is read slot by slot, and
 * so is version 2, whose lesson carried a step where this one carries a part.
 * Anything else is SAK-404's bare run, which is a place holding that quiz and
 * no lesson; a run too far gone for `readRun` reads as an empty place, which
 * is what it read as before.
 */
export function readPlace(raw: unknown): SavedPlace {
  if (!raw || typeof raw !== "object") return NO_PLACE;
  const doc = raw as { v?: unknown; quiz?: unknown; lesson?: unknown };
  if (doc.v !== PLACE_VERSION && doc.v !== 2) return { quiz: readRun(raw), lesson: null };
  return { quiz: readRun(doc.quiz), lesson: readLesson(doc.lesson) };
}

/** The place as it goes into storage, or null when there is nothing left
 * anywhere and the whole document should go. An empty slot is left out
 * rather than written as null, so a document is as small as what is in it. */
export function placeDoc(place: SavedPlace): unknown {
  if (!place.quiz && !place.lesson) return null;
  return { v: PLACE_VERSION, ...(place.quiz ? { quiz: place.quiz } : {}), ...(place.lesson ? { lesson: place.lesson } : {}) };
}

/** The lesson as it should be written now, or null when there is nothing
 * worth keeping.
 *
 * One writer for all three parts, because all three are the same lesson in
 * the same slot and only the part differs. A lesson of no picks is the only
 * thing that is not worth keeping: a lesson on step one is, since that is a
 * lesson the learner started. */
export function lessonAt(picks: readonly string[], part: LessonPart, now: number): SavedLesson | null {
  return picks.length === 0 ? null : { picks, part, leftAt: now };
}

/** The lesson slot when it holds THIS lesson, else null.
 *
 * The same picks in the same order, which is how a lesson recognizes its own
 * place, the way a run recognizes its own source. */
export function lessonFor(place: SavedPlace, picks: readonly string[]): SavedLesson | null {
  const kept = place.lesson;
  return kept && kept.picks.join(",") === picks.join(",") ? kept : null;
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

/** How many whole minutes of a break are left, never below one while any of
 * it remains: "0 min left" on a clock still running would be a lie. */
function minutesLeft(until: number, now: number): number {
  return Math.ceil(restLeft(until, now) / 60_000);
}

/**
 * How far in, in the app's words: "12 of 30" for a quiz, and for a lesson
 * whichever part of the sitting it is in.
 *
 * `now` is the clock a break is measured against, and it is null while there
 * is no browser to ask: the server renders a signed-in learner's button, and
 * a minute counted there is the server's minute rather than the reader's. So
 * the break says which break it is until the page is mounted, and gains the
 * minutes after. The same trade the sessions list makes for its timestamps.
 */
export function placeNote(entry: PlaceEntry, now: number | null): string {
  if (entry.kind === "quiz") return runNote(entry.run);
  const part = entry.lesson.part;
  if (part.kind === "steps") return `step ${part.at + 1} of ${part.steps}`;
  if (part.kind === "round") return `round ${part.round}, card ${resumeAt(part.run) + 1} of ${part.run.deck.length}`;
  const next = `round ${part.round + 1} of ${LESSON_ROUNDS}`;
  if (now === null) return `break before ${next}`;
  const left = minutesLeft(part.until, now);
  return left > 0 ? `break before ${next}, ${left} min left` : next;
}

/** What the one Continue button says: "Continue your lesson (step 3 of 7)". */
export function placeLabel(entry: PlaceEntry, now: number | null): string {
  return `Continue your ${entry.kind} (${placeNote(entry, now)})`;
}
