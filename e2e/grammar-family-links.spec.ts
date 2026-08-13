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
 *  2. the family's EXTERNAL reference (Tae Kim on conditionals) now rides the
 *     member page under "Read about it" — it used to live on the word-cluster's
 *     own page, but those were removed, so it moved here rather than being lost.
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

test("a member page carries the family's external reference", async ({
  page,
}) => {
  // The family's external reference (Tae Kim on conditionals) USED to live on the
  // word-cluster's side-by-side page. Those word-cluster pages were removed, so the
  // reference now rides each member page under a "Read about it" section instead of
  // being lost. 〜ば is in the conditionals family, which carries a link.
  await page.goto(BA);
  await expect(page.getByText("Read about it", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Tae Kim/ })).toBeVisible();
});

// REMOVED: "the Links box sits below the 'Ways to say this' table". The redesigned
// grammar member page (GrammarEntryView) renders only "How it's formed" and "Ways
// to say this" — it no longer carries a per-entry Links footer (EntryLinks moved
// off the pattern page; the family's references now live on the cluster page, as
// the test above checks). With no Links box on the member page there is nothing to
// order, so this case is deleted.
