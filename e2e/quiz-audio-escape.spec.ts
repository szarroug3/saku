import { test, expect } from "./helpers/app";
import { seedQuiz, startQuizDrill } from "./helpers/quiz";
import { kanaFact } from "@/data/characters";

/**
 * THE AUDIO ESCAPE HATCH (task #61, from the from-scratch naive-learner audit).
 *
 * Audio prompts default ON, so a fresh learner meets listening cards (the glyph
 * is hidden and the word is played). A learner who cannot hear — no speakers, a
 * noisy room, a hearing impairment — was trapped: Skip only re-queues the card,
 * and the one off-switch lived in Settings, a screen away, with the mid-drill
 * gear exposing nothing but cosmetic HUD rows.
 *
 * The fix surfaces the SAME live toggle inside the mid-drill gear. This asserts
 * it is there and that flipping it writes the real config (audioPrompts off, and
 * the derived ask collapsed to text only), exactly as the Settings page does —
 * so the next cards come as text, without leaving the drill.
 */

test("the mid-drill gear can turn Audio prompts off without leaving the drill", async ({
  page,
}) => {
  await seedQuiz(page, {
    seen: [kanaFact("あ")],
    // Audio is on by default; make it explicit so the toggle starts at "On".
    cfg: { audioPrompts: true },
  });
  await startQuizDrill(page);

  // Open the mid-drill gear.
  await page.getByRole("button", { name: "Mid-drill settings" }).click();

  // The Audio-prompts row is present (the discoverability fix) and reads "On".
  const row = page.getByText("Audio prompts").locator("..");
  const toggle = row.getByRole("button", { name: /^(On|Off)$/ });
  await expect(toggle).toHaveText("On");

  // Flip it off, live, without ending the drill.
  await toggle.click();
  await expect(toggle).toHaveText("Off");

  // It wrote the real config: audioPrompts off, and ask regenerated to text-only
  // (askFromAudioPrompts(false)) — the same update the Settings toggle makes.
  const cfg = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("saku-cfg") ?? "null"),
  );
  expect(cfg.audioPrompts).toBe(false);
  expect(cfg.ask.japanese.prompts).toEqual(["text"]);
});
