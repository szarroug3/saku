import { test, expect, type Page } from "./app";

import { KANA_GROUPS } from "@/lib/lesson";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
import {
  UNIT_TRACKS,
  simulateLessons,
  type SimulatedLesson,
} from "@/lib/content/unit-tracks";
import type { FactId } from "@/types";

/**
 * Helpers for driving the LESSON surface (`/learn` → `/session` teach walk).
 *
 * A lesson is a pure function of history, so to reach the step that teaches a
 * particular character these helpers compute the exact `seen` set that makes that
 * character's lesson the frontier — every fact of every lesson ahead of it, and
 * nothing of the lesson itself. On the CONTENT MODEL the curriculum spine is the
 * "vocab" UnitTrack; its lesson boundaries come from the app's own forward walk
 * (`simulateLessons` → `nextTrackLesson`), so the seeds follow the scheduler
 * exactly and fail loudly (not silently) if a target ever leaves the curriculum.
 */

export { test, expect };
export type { Page };

/** Every kana fact — a kana-complete history, which is what opens the curriculum
 * spine (past the kana gate) so a vocab lesson is up next. */
export const KANA_FACTS: FactId[] = KANA_GROUPS.flatMap((g) => g.facts);

/** The content-model vocab (curriculum-spine) track. */
const VOCAB_TRACK = UNIT_TRACKS.find((t) => t.id === "vocab")!;

/** The vocab track's full lesson sequence from empty history, exactly as the app
 * would hand it out lesson by lesson (`nextTrackLesson`). Computed once, lazily,
 * and cached — the walk is O(units) so this is a single up-front pass. The cap is
 * generous enough to cover any glyph the specs target deep in the spine. */
let VOCAB_LESSONS: SimulatedLesson[] | null = null;
function vocabLessons(): SimulatedLesson[] {
  if (!VOCAB_LESSONS) {
    VOCAB_LESSONS = simulateLessons(VOCAB_TRACK, LESSON_RANGE_DEFAULT, 10_000);
  }
  return VOCAB_LESSONS;
}

/** The curriculum (vocab) lesson that first teaches `glyph`, with its position in
 * the lesson sequence. Throws if no lesson teaches it, so a stale target is a red
 * test rather than a seed that quietly reaches the wrong lesson. */
export function curriculumLessonOf(glyph: string): {
  index: number;
  group: SimulatedLesson;
} {
  const lessons = vocabLessons();
  const index = lessons.findIndex((l) => l.units.some((u) => u.item.glyph === glyph));
  if (index < 0) throw new Error(`no curriculum lesson teaches "${glyph}"`);
  return { index, group: lessons[index] };
}

/**
 * The `seen` set that makes the curriculum lesson teaching `glyph` the next one:
 * kana complete, plus every fact of every earlier vocab lesson. The target
 * lesson's own facts are left fresh, so the vocab card lands on it.
 */
export function seenToReachCurriculum(glyph: string): FactId[] {
  const { index } = curriculumLessonOf(glyph);
  const before = vocabLessons()
    .slice(0, index)
    .flatMap((l) => l.units.flatMap((u) => u.facts as FactId[]));
  return [...KANA_FACTS, ...before];
}

/** The `seen` set that makes the kana group teaching `kanaGlyph` the next kana
 * lesson: every fact of every earlier kana group. */
export function seenToReachKana(kanaGlyph: string): FactId[] {
  const idx = KANA_GROUPS.findIndex((g) =>
    g.facts.some((f) => f.includes(kanaGlyph)),
  );
  if (idx < 0) throw new Error(`no kana group teaches "${kanaGlyph}"`);
  return KANA_GROUPS.slice(0, idx).flatMap((g) => g.facts);
}

/**
 * The lesson CARD on `/learn` for a track, found by a label fragment it renders.
 * On the content-model feed every track's card is the `NextLessonPreview`
 * component — a `[data-learn-card]` (the stable e2e hook). The de-box redesign
 * dropped the literal "Up next" eyebrow (the heading is now the track title and
 * the eyebrow a position line), so the card is disambiguated by the label
 * fragment alone — the target glyph in a curriculum tile, "grammar" in a tile's
 * type label, "Counter"/"Hiragana" in the eyebrow/position line.
 */
export function lessonCard(page: Page, labelFragment: string) {
  return page
    .locator("[data-learn-card]")
    .filter({ hasText: labelFragment });
}

/**
 * The teach-walk headword. The redesigned walk renders each item as its entry
 * page (ContentEntryHeader), whose hero is the glyph in a large
 * `font-light leading-none` div — the old "Open X in the Library" link is gone.
 * Match that hero by its EXACT glyph text, so a concept term step (whose hero is a
 * name) or a step teaching a different glyph both read as "not here".
 */
export function headword(page: Page, glyph: string) {
  const escaped = glyph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page
    .locator("article .font-light.leading-none")
    .filter({ hasText: new RegExp(`^${escaped}$`) })
    .first();
}

/**
 * Walk the teach steps forward until the step teaching `glyph` is on screen.
 *
 * The walk may open on a phase-intro card and interleave more of them, so this
 * clicks "Next" until the headword arrives rather than assuming a position, and
 * fails loudly if it never does. Mirrors lesson-roles.spec.ts.
 */
export async function stepToHeadword(page: Page, glyph: string, max = 16) {
  const target = headword(page, glyph);
  for (let i = 0; i < max && !(await target.isVisible()); i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(
    target,
    `the teach walk never reached the step teaching "${glyph}"`,
  ).toBeVisible();
  return target;
}
