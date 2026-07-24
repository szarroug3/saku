// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/lesson-resume.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The lesson card and the Continue button beside it are computed separately —
// the button from the open RUN, the card body from the next-lesson query — and
// starting a lesson is a write that moves the second one and not the first. Both
// ways that has gone wrong are pinned here, because both look identical from
// inside the component (a well-typed lesson object, rendered):
//
//   the card shows the FOLLOWING set while Continue resumes the earlier one
//   (the spine always has a next lesson, so nothing was ever null), and
//
//   the card disappears entirely because the track's frontier went quiet with a
//   session still resting inside it (the original bug the masking was written
//   for, which must keep working).
//
// The scenario is built the way the app builds it: startCurriculumLesson marks
// the lesson's facts SEEN before the teach walk, which is the write that
// advances the frontier off the set the run opens on. So these tests seed `seen`
// and assert on the glyphs, never on a hand-written expectation of which lesson
// comes second.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { curriculum, nextCurriculumLesson } from "./curriculum-lesson.ts";
import { LESSON_RANGE_DEFAULT } from "./lesson-sizing.ts";
import { KANA_GROUPS, nextLesson } from "./lesson.ts";
import { resumeLesson, withoutFacts } from "./lesson-resume.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const RANGE = LESSON_RANGE_DEFAULT;

/** History as it stands after pressing Start: the lesson's facts are seen, and
 * nothing has been answered yet. */
function seen(facts: readonly FactId[]): HistoryFile {
  const rec: Record<string, number> = {};
  for (const f of facts) rec[f] = Date.UTC(2026, 0, 1);
  return { sessions: [], facts: {}, seen: rec as HistoryFile["seen"] };
}

const glyphs = (items: readonly { glyph: string }[]) => items.map((it) => it.glyph);

describe("a curriculum session left open keeps its own set on the card", () => {
  // The mechanism, asserted on its own so a failure downstream is not ambiguous:
  // marking the lesson seen IS what moves the frontier to the following set.
  test("starting a lesson advances the live frontier past it", () => {
    const [first, second] = curriculum(RANGE);
    const frontier = nextCurriculumLesson(seen(first.facts), RANGE);
    assert.equal(frontier?.group.index, second.index);
  });

  test("the card shows the resting set, not the one after it", () => {
    const [first, second] = curriculum(RANGE);
    const history = seen(first.facts);
    const frontier = nextCurriculumLesson(history, RANGE);
    const run = { facts: first.facts };

    const shown = resumeLesson(history, frontier, run, (h) =>
      nextCurriculumLesson(h, RANGE),
    );

    assert.deepEqual(glyphs(shown?.cards ?? []), glyphs(first.items));
    assert.equal(shown?.group.index, first.index);
    // And explicitly not the following set, which is what the card was printing.
    assert.notDeepEqual(glyphs(shown?.cards ?? []), glyphs(second.items));
  });

  test("a run resting several lessons back still names its own set", () => {
    const groups = curriculum(RANGE);
    const resting = groups[2];
    // Everything up to and including the resting lesson has been met, so the
    // live frontier is well past it.
    const history = seen(groups.slice(0, 4).flatMap((g) => g.facts));
    const shown = resumeLesson(
      history,
      nextCurriculumLesson(history, RANGE),
      { facts: resting.facts },
      (h) => nextCurriculumLesson(h, RANGE),
    );
    assert.equal(shown?.group.index, resting.index);
  });

  test("with no open run the card is the live frontier, untouched", () => {
    const [first] = curriculum(RANGE);
    const history = seen(first.facts);
    const frontier = nextCurriculumLesson(history, RANGE);
    assert.equal(resumeLesson(history, frontier, undefined, () => null), frontier);
  });
});

describe("a card that would disappear still comes back", () => {
  // The original bug: a track whose next lesson goes null while a session is
  // resting inside it. Kana at its last group is the case that shipped.
  test("kana's last group returns with its session still open", () => {
    const last = KANA_GROUPS[KANA_GROUPS.length - 1];
    const history = seen(KANA_GROUPS.flatMap((g) => g.facts));
    assert.equal(nextLesson(history), null, "the frontier really has gone quiet");

    const shown = resumeLesson(history, nextLesson(history), { facts: last.facts }, (h) =>
      nextLesson(h),
    );
    assert.equal(shown?.group.label, last.label);
  });

  test("a rebuild that names nothing falls back to the frontier", () => {
    const history = seen([]);
    const frontier = nextCurriculumLesson(history, RANGE);
    assert.ok(frontier);
    // A stale run whose facts no longer name any lesson must not blank a card
    // that would otherwise have rendered.
    const shown = resumeLesson(history, frontier, { facts: ["nope" as FactId] }, () => null);
    assert.equal(shown, frontier);
  });
});

describe("withoutFacts masks every trace of a fact", () => {
  test("aggregate, claim and seen all go", () => {
    const id = "kana:あ:meaning" as FactId;
    const other = "kana:い:meaning" as FactId;
    const history = {
      sessions: [],
      facts: { [id]: { asked: 1 }, [other]: { asked: 1 } },
      claims: { [id]: 1, [other]: 1 },
      seen: { [id]: 1, [other]: 1 },
    } as unknown as HistoryFile;

    const masked = withoutFacts(history, [id]);
    assert.equal(masked.facts[id], undefined);
    assert.equal(masked.claims?.[id], undefined);
    assert.equal(masked.seen?.[id], undefined);
    assert.ok(masked.facts[other], "an untouched fact is left alone");
    assert.ok(masked.claims?.[other]);
    assert.ok(masked.seen?.[other]);
  });

  test("nothing to mask returns the same object", () => {
    const history = seen([]);
    assert.equal(withoutFacts(history, []), history);
  });
});
