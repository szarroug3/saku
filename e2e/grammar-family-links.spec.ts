import { test, expect } from "./helpers/app";

import { patternEntry } from "@/data/grammar";
import { entryHref } from "@/lib/library/href";

/**
 * A GRAMMAR MEMBER PAGE: the family "which one?" note, and where links live.
 *
 * 〜ば is one of four ways to say "if" (ば / たら / と / なら, the `conditionals`
 * cluster). Its Library page is where three deliberate choices show:
 *
 *  1. the family's `feel` note is surfaced under the comparison table, as the
 *     "Which one?" answer to "there are several, which do I use?";
 *  2. the family's EXTERNAL reference (Tae Kim on conditionals) is NOT repeated
 *     here — it is family-level material that lives on the cluster page, one hop
 *     from the "Family →" row;
 *  3. the Links box is the LAST thing on the page, under the "Ways to say this"
 *     table, not wedged between the teaching and it.
 *
 * All three were changed together and none had coverage; a future edit could
 * silently undo any of them.
 */

const BA = entryHref(patternEntry("ba"));

test("a member page answers 'which one?' with the family's feel note", async ({
  page,
}) => {
  await page.goto(BA);
  // The comparison table is present (guards the rest against a vacuous pass). The
  // redesigned GrammarEntryView prints the label twice — the Section eyebrow and
  // PatternFamily's own <Lbl> — so match the first.
  await expect(
    page.getByText("Ways to say this", { exact: true }).first(),
  ).toBeVisible();
  // The note sits under it, labelled, with the authored substance — not just an
  // empty heading. The conditionals feel ends on this exact clause.
  await expect(page.getByText("Which one?", { exact: true })).toBeVisible();
  await expect(page.getByText(/overlap is large and real/)).toBeVisible();
});

test("the family's external reference lives on the cluster page, not the member page", async ({
  page,
}) => {
  // Absent here: the redesigned member page (GrammarEntryView) does not repeat the
  // family's external reference — it carries no Links/reference card at all…
  await page.goto(BA);
  await expect(page.getByRole("link", { name: /Tae Kim/ })).toHaveCount(0);
  // …it lives on the cluster page's own reference card, so the reference was moved,
  // not lost.
  await page.goto("/grammar/conditionals");
  await expect(page.getByRole("link", { name: /Tae Kim/ })).toBeVisible();
});

// REMOVED: "the Links box sits below the 'Ways to say this' table". The redesigned
// grammar member page (GrammarEntryView) renders only "How it's formed" and "Ways
// to say this" — it no longer carries a per-entry Links footer (EntryLinks moved
// off the pattern page; the family's references now live on the cluster page, as
// the test above checks). With no Links box on the member page there is nothing to
// order, so this case is deleted.
