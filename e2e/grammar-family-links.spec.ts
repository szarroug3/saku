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

test("a member page does not carry the family's external reference", async ({
  page,
}) => {
  // The redesigned member page (GrammarEntryView) carries no Links/reference card.
  // The family's external reference (Tae Kim on conditionals) used to live on the
  // word-cluster's side-by-side page, which has since been removed (only the
  // map-only families keep a /grammar page), so it is not surfaced on the member
  // page either — the reference data stays in clusters.ts, just unshown.
  await page.goto(BA);
  await expect(page.getByRole("link", { name: /Tae Kim/ })).toHaveCount(0);
});

// REMOVED: "the Links box sits below the 'Ways to say this' table". The redesigned
// grammar member page (GrammarEntryView) renders only "How it's formed" and "Ways
// to say this" — it no longer carries a per-entry Links footer (EntryLinks moved
// off the pattern page; the family's references now live on the cluster page, as
// the test above checks). With no Links box on the member page there is nothing to
// order, so this case is deleted.
