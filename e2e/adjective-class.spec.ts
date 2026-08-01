import {
  expect,
  lessonCard,
  seenToReachCurriculum,
  stepToHeadword,
  test,
} from "./helpers/lessons";

import { patternMeaningFactId } from "@/data/grammar";
import { wordEntry } from "@/data/vocab";
import { entryHref } from "@/lib/library/href";

const WORD = "嫌い";
const CLASS_NOTE = "It ends in い, but it is a な-adjective";

test("an ambiguous adjective is identified in its word lesson and Library page", async ({
  page,
  seed,
}) => {
  // The adjective-class page belongs to lesson 1, so completing that lesson is
  // what makes this otherwise held-back word teachable.
  await seed({
    seen: [
      ...seenToReachCurriculum(WORD),
      patternMeaningFactId("prenominal-form"),
    ],
  });
  await page.goto("/learn");

  const card = lessonCard(page, WORD);
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");
  await stepToHeadword(page, WORD);
  await expect(page.getByText(CLASS_NOTE, { exact: false })).toBeVisible();

  await page.goto(entryHref(wordEntry(WORD)));
  await expect(page.getByText(CLASS_NOTE, { exact: false })).toBeVisible();
});
