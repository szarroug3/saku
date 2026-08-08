import {
  test,
  expect,
  KANA_FACTS,
  lessonCard,
  stepToHeadword,
  headword,
} from "./helpers/lessons";

/**
 * TWO PROPERTIES OF THE TEACH WALK: it can be BUILT from the Library over a
 * chosen slice, and once entered it REMEMBERS where you left it.
 *
 * "Teach me N" (slice-bar.tsx) is the Library door into a teaching session: it
 * builds a normal teach walk over the slice's material, the same walk the Home
 * cards reach through Start. lessons-teach-more.spec.ts proves the door opens the
 * walk; this adds that a MULTI-fact slice actually stacks its material into the
 * session (the HUD's "N of M" reports more than one card), which is the whole
 * reason a "Teach me N" over a folded character is not just a single card.
 *
 * The second test is the resume property. The walk's position lives on the
 * session (session.teachStep) in localStorage, so leaving and returning must land
 * on the SAME card, not restart at item 1. lessons-resume.spec.ts leaves on the
 * 亅 card; this leaves on the LAST teach card of the group (丁), the step right
 * before the quiz, because a resume that silently snapped back to item 1 would be
 * most damaging there and a position-vs-frontier confusion is most visible there.
 */

/** The canonical multi-fact kanji: one glyph, many readings, so from an empty
 * history its whole Library slice is unlearned and its teach walk is more than
 * one card. Mirrors lessons-teach-more.spec.ts's target. */
const MULTI_FACT_KANJI = "生";

test("Library 'Teach me N' builds a multi-card teach walk over the slice", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto(`/library/kanji/${MULTI_FACT_KANJI}`);

  // Offered because nothing in this slice is known yet. N is the real fact count,
  // so match the shape rather than a fixed number.
  const teach = page.getByRole("button", { name: /^Teach me \d+$/ });
  await expect(teach).toBeVisible();
  await teach.click();

  // It lands in the stepped walk, not a straight drill: the teach HUD's "N of M"
  // is the tell.
  await page.waitForURL("**/session");
  const hud = page.getByText(/^\d+ of \d+$/);
  await expect(hud).toBeVisible();

  // The slice added its material: a folded character's walk has more than one
  // card, so M is at least 2. Reading M off the HUD proves the session was built
  // over the slice rather than reduced to a single card.
  const total = Number((await hud.innerText()).split(" of ")[1]);
  expect(total).toBeGreaterThan(1);

  // And the walk genuinely teaches 生 (it may open on a concept intro first).
  await stepToHeadword(page, MULTI_FACT_KANJI);
});

test("leaving on the last teach card and continuing resumes that same card", async ({
  page,
  seed,
}) => {
  // Kana complete, so the frontier is the first curriculum group, whose last
  // teach card is what this test rests on.
  await seed({ seen: KANA_FACTS, cfg: {} });

  await page.goto("/learn");
  const card = lessonCard(page, "人");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // Walk all the way to the last item (人) and record the HUD
  // position there. 人 is the final teach card, so this is resume at the boundary
  // with the quiz.
  await stepToHeadword(page, "人");
  const position = await page.getByText(/^\d+ of \d+$/).innerText();

  // Leave the walk for Home WITHOUT ending it: the session rests where it is.
  await page.goto("/learn");
  const resumeCard = lessonCard(page, "人");
  const cont = resumeCard.getByRole("button", {
    name: "Continue session",
    exact: true,
  });
  await expect(cont).toBeVisible();
  await cont.click();
  await page.waitForURL("**/session");

  // Back on the EXACT card, not item 1: 人 is on screen and the HUD reads the same
  // "N of M" it did before leaving.
  await expect(headword(page, "人")).toBeVisible();
  await expect(page.getByText(/^\d+ of \d+$/)).toHaveText(position);
});
