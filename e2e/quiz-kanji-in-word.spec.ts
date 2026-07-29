import { test, expect, STEADY_CFG, direction, style } from "./helpers/app";
import { seedQuiz, subjectOnly, startQuizDrill } from "./helpers/quiz";
import { readingFactId } from "@/data/kanji";

/**
 * THE KANJI-IN-WORD READING CARD (task #22).
 *
 * A kanji reading is asked inside a KNOWN, multi-part word, and the prompt shows
 * the WHOLE WORD (病院) with the asked kanji (病) lit and the rest dimmed. The
 * word is context, not a leak: the highlighted glyph's reading is the answer and
 * is never printed. The old "in 病院" subtext is dropped — the word is right
 * there with the kanji lit, so repeating it underneath was noise.
 *
 * Seeding (see helpers/quiz.ts): 病院's meaning is baked KNOWN so the reading
 * unlocks and anchors on it; the selection is pinned to kanji so the word itself
 * cannot be drawn. The reading card is the only card the drill has.
 */

const READING = readingFactId("病", "病院");
const CFG = {
  ...STEADY_CFG,
  ...direction("jp2en"),
  ...style("jp2en", "typed"),
  ...subjectOnly("kanji"),
};

test("the prompt shows the whole word, not the lone kanji", async ({ page }) => {
  await seedQuiz(page, { seen: [READING], known: ["word:病院/meaning"], cfg: CFG });
  const glyph = await startQuizDrill(page);
  // The halo's glyph is the WORD 病院, so the reading is asked in context.
  await expect(glyph).toHaveText("病院");
});

test("the asked kanji is highlighted and the rest of the word is dimmed", async ({
  page,
}) => {
  await seedQuiz(page, { seen: [READING], known: ["word:病院/meaning"], cfg: CFG });
  const glyph = await startQuizDrill(page);

  // A highlighted glyph is drawn at full --text with a glow; a dimmed one at
  // --text-muted with 0.6 opacity (see drill-halo.tsx PromptGlyph). The word
  // renders as one whitespace-nowrap wrapper span holding a span PER CHARACTER;
  // target those per-character spans (not every span under .kq-glyph, which also
  // counts the wrapper), and exactly the asked kanji is the lit one.
  const chars = glyph.locator("span.whitespace-nowrap > span");
  await expect(chars).toHaveCount(2);
  const lit = chars.filter({ hasText: "病" });
  const dim = chars.filter({ hasText: "院" });
  await expect(lit).toHaveText("病");
  await expect(dim).toHaveText("院");
  // The dimmed piece carries the muted colour; the lit piece does not.
  await expect(dim).toHaveCSS("opacity", "0.6");
});

test("no 'in 病院' subtext is repeated under the word", async ({ page }) => {
  await seedQuiz(page, { seen: [READING], known: ["word:病院/meaning"], cfg: CFG });
  await startQuizDrill(page);
  // The word is in the halo with the kanji lit, so the muted context sublabel is
  // dropped. It never says "in 病院" anywhere on the card.
  await expect(page.getByText(/in 病院/)).toHaveCount(0);
  await expect(page.getByText(/on its own/)).toHaveCount(0);
});
