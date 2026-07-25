import {
  test,
  expect,
  STEADY_CFG,
  direction,
  style,
} from "./helpers/app";
import {
  seedQuiz,
  ask,
  subjectOnly,
  instruction,
  startQuizDrill,
} from "./helpers/quiz";
import { readingFactId } from "@/data/kanji";

/**
 * THE INSTRUCTION NAMES THE TYPE.
 *
 * Every card says, in words, what kind of answer it wants — the fix for the bug
 * where "one" with a text box gave the learner no way to know it wanted the
 * KANJI 一 and not its reading いち. quiz-instruction.test.ts unit-tests the
 * sentence; these e2e tests prove the drill actually renders it, on the card
 * shapes a learner meets, so a wiring regression (the line dropped, or the wrong
 * mode branch chosen) is caught here.
 *
 * The instruction is the white line under the halo (see drill-screen.tsx). Every
 * fixture pins one direction, one style and a tiny pool so the card is
 * deterministic.
 */

const JP2EN_TYPED = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
};

test("a kanji meaning card: 'Type what this kanji means.'", async ({
  page,
}) => {
  await seedQuiz(page, { seen: ["kanji:一/meaning"], cfg: JP2EN_TYPED });
  await startQuizDrill(page);
  await expect(instruction(page)).toHaveText("Type what this kanji means.");
});

test("a word meaning card: 'Type what this word means.'", async ({ page }) => {
  await seedQuiz(page, { seen: ["word:これ/meaning"], cfg: JP2EN_TYPED });
  await startQuizDrill(page);
  await expect(instruction(page)).toHaveText("Type what this word means.");
});

test("a kana reading card: 'Type how this kana is said.'", async ({ page }) => {
  await seedQuiz(page, { seen: ["kana:あ/reading"], cfg: JP2EN_TYPED });
  await startQuizDrill(page);
  await expect(instruction(page)).toHaveText("Type how this kana is said.");
});

/**
 * A kanji reading is asked ONLY inside a word (task #22), and the instruction
 * says so — "in this word" — where a kana or a whole-word reading, which is the
 * entire sound, takes no such qualifier.
 *
 * Seeding trick (see helpers/quiz.ts): the reading fact 病/reading@病院 is only
 * askable once 病院 is a KNOWN multi-part word, so 病院's meaning is baked as a
 * known aggregate — and the selection is pinned to `subjects: ["kanji"]` so the
 * word itself stays out of the pool. The reading card is then the only card the
 * drill can draw.
 */
test("a kanji-in-word reading card: '…said in this word.'", async ({ page }) => {
  const reading = readingFactId("病", "病院");
  await seedQuiz(page, {
    seen: [reading],
    known: ["word:病院/meaning"],
    cfg: { ...JP2EN_TYPED, ...subjectOnly("kanji") },
  });
  await startQuizDrill(page);
  await expect(instruction(page)).toHaveText(
    "Type how this kanji is said in this word.",
  );
});

/**
 * The multiple-choice branch names the ROLE too — "what this KANJI means" — for
 * the reason the copy exists: the same glyph means different things as different
 * roles, and a bare "what it means" left the learner unable to tell which was
 * asked. A meaning board of five kanji so buildMcOptions has distractors to draw.
 */
test("a multiple-choice meaning card: 'Which of these is what this kanji means?'", async ({
  page,
}) => {
  const pool = ["一", "二", "三", "四", "五"].map((k) => `kanji:${k}/meaning`);
  await seedQuiz(page, {
    seen: pool,
    cfg: { ...STEADY_CFG, ...ask({ jpAnswers: ["mc"] }) },
  });
  await startQuizDrill(page);
  await expect(instruction(page)).toHaveText(
    "Which of these is what this kanji means?",
  );
});
