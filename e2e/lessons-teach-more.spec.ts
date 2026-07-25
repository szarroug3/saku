import { test, expect, stepToHeadword } from "./helpers/lessons";

/**
 * THE "TEACH ME N" PATH: a lesson started from the Library, not the Home feed.
 *
 * A multi-fact Library slice offers "Teach me N" (slice-bar.tsx), which builds a
 * normal teaching SESSION over that slice's material — the same teach walk the
 * Home cards reach through Start, entered from a different door. This guards that
 * door: the button is offered on a fresh (unlearned) multi-fact entry, and it
 * lands in the teach walk for that entry.
 *
 * 生 is the canonical multi-fact kanji (one glyph, many readings), so from an
 * empty history its whole slice is unlearned and drillable.
 */

test("Library 'Teach me N' opens the teach walk for the slice", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });
  await page.goto("/library/kanji/生");

  // The teach button, offered because nothing in this slice is known yet. N is
  // the real count, so match the shape rather than a fixed number.
  const teach = page.getByRole("button", { name: /^Teach me \d+$/ });
  await expect(teach).toBeVisible();
  await teach.click();

  // It builds a session and drops into the teach walk — not a straight quiz.
  await page.waitForURL("**/session");
  // The teach HUD's position, proving this is the stepped walk and not the drill.
  await expect(page.getByText(/^\d+ of \d+$/)).toBeVisible();
  // The walk teaches 生 (it may open on a concept-card intro first).
  await stepToHeadword(page, "生");
});
