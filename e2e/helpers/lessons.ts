import { test, expect, type Page } from "./app";

import { curriculum, type CurriculumLessonGroup } from "@/lib/curriculum-lesson";
import { KANA_GROUPS } from "@/lib/lesson";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
import { wordMeaningFactId } from "@/data/vocab";
import type { FactId } from "@/types";

/**
 * Helpers for driving the LESSON surface (`/learn` → `/session` teach walk).
 *
 * A lesson is a pure function of history (curriculum-lesson.ts), so to reach the
 * step that teaches a particular character these helpers compute the exact
 * `seen` set that makes that character's lesson the frontier — every fact of
 * every lesson ahead of it, and nothing of the lesson itself — the same trick
 * lesson-roles.spec.ts uses to reach 人. Nothing is hard-coded to a table
 * position: the seeds are derived from the shipped curriculum, so they follow
 * the data when it moves and fail loudly (not silently) if a target character
 * ever leaves the curriculum.
 */

export { test, expect };
export type { Page };

/** Every kana fact — a kana-complete history, which is what puts the curriculum
 * spine (rather than a kana group) up next. */
export const KANA_FACTS: FactId[] = KANA_GROUPS.flatMap((g) => g.facts);

/** The whole packed curriculum at the default lesson length, computed once. */
const GROUPS: CurriculumLessonGroup[] = curriculum(LESSON_RANGE_DEFAULT);

/** The curriculum lesson that teaches `glyph`, with its packing index. Throws if
 * no lesson teaches it, so a stale target is a red test rather than a seed that
 * quietly reaches the wrong lesson. */
export function curriculumLessonOf(glyph: string): {
  index: number;
  group: CurriculumLessonGroup;
} {
  const index = GROUPS.findIndex((g) => g.items.some((it) => it.glyph === glyph));
  if (index < 0) throw new Error(`no curriculum lesson teaches "${glyph}"`);
  return { index, group: GROUPS[index] };
}

/**
 * The `seen` set that makes the curriculum lesson teaching `glyph` the next one:
 * kana complete, plus every fact of every earlier curriculum lesson. The target
 * lesson's own facts are left fresh, so `nextCurriculumLesson` lands on it.
 */
export function seenToReachCurriculum(glyph: string): FactId[] {
  const { index } = curriculumLessonOf(glyph);
  const before = GROUPS.slice(0, index).flatMap((g) => g.facts);
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

/** Kana complete AND one verb (言う) met — the state that opens the head of the
 * grammar track, whose first patterns all attach to a verb. Mirrors the
 * grammar-lesson unit test's `kanaAndVerb`. */
export function seenKanaAndVerb(): FactId[] {
  return [...KANA_FACTS, wordMeaningFactId("言う")];
}

/**
 * The lesson CARD on `/learn` for a track, found by the label its `<Lbl>` prints.
 * Every track's card is a `div.kq-material` whose eyebrow starts "Up next", so
 * the label fragment ("hiragana", "grammar", the target glyph in a curriculum
 * tile) is what tells them apart once several tracks are unlocked at once.
 */
export function lessonCard(page: Page, labelFragment: string) {
  return page
    .locator("div.kq-material")
    .filter({ hasText: "Up next" })
    .filter({ hasText: labelFragment });
}

/** The teach-walk headword — a Library link labelled by the glyph it teaches. */
export function headword(page: Page, glyph: string) {
  return page.getByRole("link", { name: `Open ${glyph} in the Library` });
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
