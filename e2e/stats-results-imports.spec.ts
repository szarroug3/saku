import { test, expect, type Page } from "./helpers/app";

/**
 * STATS + RESULTS + IMPORTS — the read-only surfaces the mirror specs skip.
 *
 * progress.spec.ts is about mid-quiz PERSISTENCE, not these pages. Nothing else
 * in the suite renders /stats, /results or the settings pages, so this covers:
 *
 *   /stats ............ the By-subject bar (met vs standing, claimed drawn grey)
 *                       and the "What you know" knowledge-base card.
 *   /results .......... the results board — reachable two ways, both asserted:
 *                       its no-session guard redirect, and a seeded board render.
 *   /settings ......... the settings controls and the import door.
 *   /settings/import .. the import screen's key controls.
 *
 * Signed out, so a little history is seeded through localStorage the same way
 * helpers/app.ts documents. A CLAIM is the cheapest thing that both counts as
 * "met" on By subject (see by-subject.tsx `met`) and lands a fact in the
 * "claimed" bucket the knowledge base draws grey — so a handful of claims is all
 * the seed either card needs.
 */

/** Facts to claim so the two Progress cards have something to show. Kana facts,
 * so `met` for the Kana row is exactly this many. */
const CLAIMED = ["kana:あ/reading", "kana:い/reading", "kana:う/reading"];

test("/stats renders the by-subject bar and the knowledge-base card", async ({
  page,
  seed,
}) => {
  await seed({ claims: CLAIMED });
  await page.goto("/stats");

  // The page is titled "Progress" (the route is /stats; the heading is not).
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Progress");

  // The knowledge-base card is populated, not its empty state, and it shows the
  // "claimed" bucket — the grey one, tone "mute" (see stats/tally.ts +
  // library/standing.ts): a claim is skipped-not-tested, so it is never counted
  // as knowledge earned, and the card names it as such.
  await expect(page.getByText("What you know")).toBeVisible();
  await expect(
    page.getByText("Nothing yet. Drill something and it will show up here."),
  ).toHaveCount(0);
  // SAK-78 title-cased the bucket labels ("a count sits under a BUTTON now,
  // not a sentence" — tally.ts's BUCKET_LABEL), so the card reads "Claimed",
  // not "claimed".
  await expect(page.getByText("Claimed", { exact: true })).toBeVisible();

  // The By subject card: its label, the Kana row, and that row's coverage count.
  // Three kana facts claimed means the Kana row reads "3 of <total>"; no other
  // subject has a record, so "3 of" is unambiguous.
  await expect(page.getByText("By subject")).toBeVisible();
  // The subject name is a <th scope="row">, i.e. a rowheader. SAK-25 grouped
  // Kana into its own group row (Hiragana/Katakana as children beneath it),
  // so a substring match on "Kana" now also catches "Katakana" — exact:true
  // pins it to the group row this claim actually landed on. The same split
  // means "3 of <n>" now appears on BOTH the Kana group row and its Hiragana
  // child row (the three claimed facts are hiragana), so the coverage count
  // is read from within the Kana row itself rather than matched loose on the
  // page.
  const kanaRowheader = page.getByRole("rowheader", { name: "Kana", exact: true });
  await expect(kanaRowheader).toBeVisible();
  const kanaRow = page.locator("tr", { has: kanaRowheader });
  await expect(kanaRow.getByText(/\b3 of [\d,]+/)).toBeVisible();
});

/**
 * THE RESULTS BOARD'S NO-SESSION GUARD.
 *
 * /results has nothing to show without a finished session, and its own effect
 * sends an empty visit home: `if (restored && !results) router.replace("/")`.
 * With no session seeded, the page must land back on "/". This is the reachable
 * behaviour that needs no fragile payload.
 */
test("/results with no finished session redirects home", async ({ page }) => {
  await page.goto("/results");
  await expect(page).toHaveURL(/\/$/);
  // Landed on the signed-out landing, not a blank/error page.
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Library" }),
  ).toBeVisible();
});

/**
 * THE RESULTS BOARD RENDERS FROM A STORED SESSION.
 *
 * The board reads its payload from the quiz-session snapshot in localStorage
 * ("saku-session"; see lib/settings-keys.ts SESSION_KEY): on mount the provider
 * does `if (saved.results) setResults(saved.results)`, and the page renders
 * ResultsView once `results` is non-null. So a minimal but valid ResultsPayload
 * seeded there is enough to reach the board without driving a whole quiz to its
 * end. `summaryOnly` short-circuits the heavy per-run analysis (analyzeRun),
 * which keeps this seed small and robust; the board still renders its "Results"
 * title, the accuracy ring card and the triage sections from the stored stats.
 *
 * FLAG: this proves the board is REACHABLE and MOUNTS from a stored payload. It
 * does not exercise a payload produced organically by finishing a limited-length
 * quiz (the STEADY_CFG the suite seeds elsewhere is endless, so it never
 * finishes). A full setup → drill → finish → /results flow is left uncovered
 * here.
 */
async function seedStoredResults(page: Page) {
  // A valid ResultsPayload: two real kana facts with well-formed
  // FactSessionDetail records, a recent ts, drill mode, summary-only so the
  // board takes the light analysis path.
  const payload = {
    mode: "drill",
    redrill: false,
    ts: Date.now(),
    stats: {
      "kana:あ/reading": {
        seen: 2,
        misses: 1,
        everCorrect: true,
        firstTryCorrect: false,
        firstTryCount: 1,
        correct: 2,
        confused: {},
      },
      "kana:い/reading": {
        seen: 1,
        misses: 0,
        everCorrect: true,
        firstTryCorrect: true,
        firstTryCount: 1,
        correct: 1,
        confused: {},
      },
    },
    summaryOnly: { forgivingPct: 100, strictPct: 50 },
  };
  await page.addInitScript((body: string) => {
    window.localStorage.setItem("saku-session", body);
  }, JSON.stringify({ results: payload }));
}

test("/results renders the board from a stored session", async ({ page }) => {
  await seedStoredResults(page);
  await page.goto("/results");

  // Not bounced home — the guard only fires when there is no stored payload.
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results");
  // The subtitle names the mode and question count the stored stats sum to.
  await expect(page.getByText(/Drill · \d+ questions/)).toBeVisible();
});

test("/settings renders its controls", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
  // The settings card's first group and control.
  await expect(page.getByText("Appearance")).toBeVisible();
  await expect(page.getByText("Theme")).toBeVisible();
  // Import used to live here; it moved to the list view. Settings no longer
  // carries an import door.
  await expect(page.getByRole("link", { name: /Import a list/ })).toHaveCount(0);
});

test("/lists/import renders the import controls", async ({ page }) => {
  await page.goto("/lists/import");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Import a list",
  );
  // The two-state screen's first state: the drop zone and its file picker.
  await expect(page.getByText("Drop a file here")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose a file" }),
  ).toBeVisible();
});
