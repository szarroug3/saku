import {
  test,
  expect,
  seenToReachCurriculum,
  lessonCard,
  stepToHeadword,
  headword,
  teachMeFromShelf,
  teachPosition,
} from "./helpers/lessons";

/**
 * TWO PROPERTIES OF THE TEACH WALK: it can be BUILT from the Library SHELF over a
 * chosen slice, and once entered it REMEMBERS where you left it.
 *
 * "Teach me N" (slice-bar.tsx, variant="bar") is the Library door into a teaching
 * session: SELECTING one or more shelf rows builds a selection slice, and the
 * shelf action bar offers "Teach me N" over it — the same walk the Home cards
 * reach through Start. (The redesign moved this verb off the entry page, which
 * now offers only "Quiz me"; see lessons-teach-more.spec.ts.) That spec proves
 * the door opens the walk; this adds that a MULTI-fact slice actually stacks its
 * material into the session (the HUD's "N of M" reports more than one card),
 * which is the whole reason a "Teach me N" over a folded character is not just a
 * single card.
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

test("Library shelf 'Teach me N' builds a multi-card teach walk over the slice", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library?kind=kanji");

  // entry-tile.tsx: "VIEW IS THE DEFAULT CLICK; SELECT IS AN OPT-IN" — a plain
  // click on a tile/row now opens its entry page, so building a selection
  // needs "Select multiple" turned on first; only then does the row's whole
  // body (ShelfRow, aria-pressed) toggle into the selection instead.
  await page.getByRole("button", { name: "Select multiple", exact: true }).click();

  // Select the kanji row on the shelf (reached through search — the browse shelf
  // mounts distant sections lazily). Selecting builds the slice the bar acts on.
  await page.getByPlaceholder(/Search anything/).fill(MULTI_FACT_KANJI);
  const row = page.getByRole("button", { name: new RegExp(`^${MULTI_FACT_KANJI}`) }).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(
    page.getByRole("button", { name: /Clear \d+ selected/ }),
  ).toBeVisible();

  // Offered because nothing in this slice is known yet; clicking it lands in the
  // stepped walk (not a straight drill), told by the teach HUD's "N of M". See
  // teachMeFromShelf for why the click retries.
  await teachMeFromShelf(page);
  const hud = teachPosition(page);
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
  await seed({ seen: seenToReachCurriculum("人"), cfg: {} });

  await page.goto("/learn");
  const card = lessonCard(page, "人");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  // Walk all the way to the last item (人) and record the HUD
  // position there. 人 is the final teach card, so this is resume at the boundary
  // with the quiz.
  await stepToHeadword(page, "人");
  const position = await teachPosition(page).innerText();

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
  await expect(teachPosition(page)).toHaveText(position);
});
