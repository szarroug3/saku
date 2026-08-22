import { test, expect, STEADY_CFG, direction, style, answerBox } from "./helpers/app";
import { seedQuiz, startQuizDrill } from "./helpers/quiz";
import { wordMeaningFactId } from "@/data/vocab";
import { factInfo } from "@/lib/facts";
import type { FactId } from "@/types";

/**
 * SAK-139: every real view has a page title, not just the bare app name.
 *
 * The root layout composes "Saku · %s" from each route's own metadata
 * fragment (src/app/layout.tsx); a route that sets nothing falls through to
 * the bare "Saku" default. /quiz, /results, /session and /sessions all did,
 * until SAK-139 gave each a sibling layout.tsx (the three "use client" pages)
 * or a direct `metadata` export (/sessions, a Server Component). This pins
 * the fix so a future refactor that drops one of those layout.tsx files (or
 * un-exports the metadata) fails here instead of only being noticed by eye.
 *
 * /quiz, /results and /session each redirect away the instant there is no
 * active quiz/results/session (see each page.tsx's own useEffect guard) — a
 * cold `page.goto` to any of them looks briefly right, then the title flips
 * to the redirect target's own. So these are checked while genuinely
 * ON that screen with real state behind it, the same way a learner actually
 * gets there, not by navigating to the bare URL.
 */

const WORD = "水";

test("the library, practice, settings and sessions routes carry a descriptive title", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });

  await page.goto("/library");
  await expect(page).toHaveTitle("Saku · Library");

  await page.goto("/practice");
  await expect(page).toHaveTitle("Saku · Practice");

  await page.goto("/settings");
  await expect(page).toHaveTitle("Saku · Settings");

  // A plain Server Component (no redirect guard), so a cold visit is fine.
  await page.goto("/sessions");
  await expect(page).toHaveTitle("Saku · Recent sessions");
});

test("a library entry page's title names the specific glyph, not just the section", async ({
  page,
  seed,
}) => {
  await seed({ seen: [], cfg: {} });

  await page.goto("/library/kanji/花");
  await expect(page).toHaveTitle("Saku · 花");

  await page.goto("/library/word/人");
  await expect(page).toHaveTitle("Saku · 人");
});

test("/quiz and /results carry their title while a real one-off quiz is active", async ({
  page,
  seed,
}) => {
  await seedQuiz(page, {
    seen: [wordMeaningFactId(WORD)],
    cfg: {
      ...STEADY_CFG,
      length: "limited",
      limType: "cov",
      ...direction("jp2en"),
      ...style("jp2en", "typed"),
    },
  });
  await startQuizDrill(page);
  await expect(page).toHaveTitle("Saku · Quiz");

  const answer = factInfo(wordMeaningFactId(WORD) as FactId)!.answers[0];
  await answerBox(page).fill(answer);
  await answerBox(page).press("Enter");
  await page.waitForURL("**/results");
  await expect(page).toHaveTitle("Saku · Results");
});

test("/session carries its title while a real taught session is active", async ({
  page,
  seed,
}) => {
  // Empty history: day one offers the kana track's card-0 teaser, same as
  // lesson.spec.ts's own opening. Only needs to LAND on /session, not walk
  // the whole lesson.
  await seed({ seen: [], cfg: {} });
  await page.goto("/learn");
  await page.getByRole("button", { name: "Start track", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");
  await expect(page).toHaveTitle("Saku · Session");
});
