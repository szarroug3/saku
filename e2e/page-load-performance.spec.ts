import {
  test,
  expect,
  waitForHydration,
  STEADY_CFG,
  direction,
  style,
  startVowelLessonDrill,
  answerDrillCard,
} from "./helpers/app";
import { kanaFact } from "@/data/characters";

/**
 * Page load performance tests.
 *
 * Ensures that main application pages and representative library pages load
 * within acceptable time limits. These thresholds catch regressions that could
 * impact user experience.
 *
 * Tested routes:
 * - Main pages: home, learn, quiz, practice, settings, progress, library
 * - Library sub-pages: from kana, kanji, and grammar sections
 * - Grammar pages: sample grammar cluster
 * - Heavy data scenarios: pages with 100+ facts loaded
 *
 * SAK-264: load time is measured from navigation start to the app's own
 * hydration-complete marker (waitForHydration, e2e/helpers/app.ts), NOT
 * `waitForLoadState("networkidle")`. networkidle used to produce the same
 * route measuring up to 20x apart between runs, because it waits on ALL
 * network activity in the tab (analytics, Speed Insights, background
 * revalidation) rather than anything that actually gates interactivity — see
 * waitForHydration's own doc comment for the full explanation. The marker
 * fires once, deterministically, per navigation, so these numbers are stable
 * run to run on the same route; that is what the budgets below are
 * calibrated against.
 */

type PageLoadTest = {
  name: string;
  url: string;
  maxLoadTimeMs: number;
  seed?: { seen?: string[] };
};

const TEST_PAGES: PageLoadTest[] = [
  // Main navigation pages
  {
    name: "Home page",
    url: "/",
    maxLoadTimeMs: 2000,
  },
  {
    name: "Learn page",
    url: "/learn",
    maxLoadTimeMs: 2000,
  },
  {
    name: "Settings page",
    url: "/settings",
    maxLoadTimeMs: 2000,
  },
  {
    // SAK-152: /stats moved to /progress; /stats is now a redirect shim
    // (src/app/stats/page.tsx). Point straight at /progress so this measures
    // the real page render, not the extra redirect hop.
    name: "Progress page",
    url: "/progress",
    maxLoadTimeMs: 3000,
  },
  {
    name: "Library root page",
    url: "/library",
    maxLoadTimeMs: 3000,
  },
  {
    name: "Sessions/History page",
    url: "/sessions",
    maxLoadTimeMs: 3000,
  },

  // Quiz/Practice flow (need some drillable facts)
  {
    name: "Quiz selection page",
    url: "/quiz",
    maxLoadTimeMs: 2500,
    seed: { seen: ["hiragana.a", "hiragana.i"] },
  },
  {
    name: "Practice selector page",
    url: "/practice",
    maxLoadTimeMs: 2500,
    seed: { seen: ["hiragana.a", "hiragana.i"] },
  },

  // Library pages - Kana section
  {
    name: "Library: hiragana entry",
    url: "/library/hiragana/a",
    maxLoadTimeMs: 2500,
  },
  {
    name: "Library: katakana entry",
    url: "/library/katakana/a",
    maxLoadTimeMs: 2500,
  },

  // Library pages - Kanji section
  {
    name: "Library: kanji entry",
    url: "/library/kanji/生",
    maxLoadTimeMs: 3000,
  },
  {
    name: "Library: radical entry",
    url: "/library/radical/一",
    maxLoadTimeMs: 2500,
  },

  // Library pages - Word section
  {
    name: "Library: vocabulary entry",
    url: "/library/word/知る",
    maxLoadTimeMs: 3000,
  },

  // Library pages - Grammar section
  {
    name: "Library: grammar entry",
    url: "/library/grammar/te-request",
    maxLoadTimeMs: 3000,
  },

  // Library pages - Verb pairs and keigo
  {
    name: "Library: verb pair entry",
    url: "/library/transitivity/開く-開ける",
    maxLoadTimeMs: 3000,
  },
  {
    name: "Library: writing rule entry",
    url: "/library/writing-rule/dakuten",
    maxLoadTimeMs: 2500,
  },

  // Grammar cluster page (transitivity is the one remaining map-only cluster;
  // は/が and に/で gained members and their standalone maps now 404)
  {
    name: "Grammar cluster page",
    url: "/grammar/transitivity",
    maxLoadTimeMs: 3000,
  },

  // Resources page
  {
    name: "Resources page",
    url: "/resources",
    maxLoadTimeMs: 2500,
  },

  // Lists/Import page
  {
    name: "Lists import page",
    url: "/lists/import",
    maxLoadTimeMs: 2000,
  },

  // SAK-228: bare /lists (ManageLists) had NO load-time budget assertion at
  // all before this, despite route_sizes.mjs confirming it as the single
  // heaviest route in the app (~23MB, still carrying the vocabulary
  // dictionary — see docs/perf-library-list-bundle.md's "still deferred"
  // list). This is exactly the shape of gap the ticket is about: a route
  // this heavy could regress further and nothing would notice. Renders fine
  // with an empty list (no seed needed) — no redirect, unlike /session below.
  {
    name: "Lists page (bare)",
    url: "/lists",
    maxLoadTimeMs: 4500,
  },
];

for (const page of TEST_PAGES) {
  test(`${page.name} loads within acceptable time`, async ({ page: browserPage, seed }) => {
    // Seed if provided (for pages that need drillable content)
    if (page.seed) {
      await seed(page.seed);
    }

    // Measure load time from navigation start
    const startTime = Date.now();

    const response = await browserPage.goto(page.url);

    // SAK-264: wait for the app's hydration-complete marker, not networkidle.
    await waitForHydration(browserPage);

    // Verify page loaded successfully
    expect(response, `no response for ${page.url}`).not.toBeNull();
    expect(response!.status(), `bad status for ${page.url}`).toBeLessThan(400);

    // Verify navigation element is visible (proof of successful render).
    //
    // SAK-228: this check must happen BEFORE loadTimeMs is captured, not
    // after. It used to run after the stopwatch had already been read, which
    // silently exempted the entire cost of whatever renders between "React
    // hydrated" (the marker) and "the nav is actually painted and visible" —
    // client-side data loading, a heavy component's own render, images —
    // from the budget below. A route that hydrates fast but then blocks on
    // several seconds of that work would still report a fast loadTimeMs and
    // pass; the very failure mode a bundle-size regression like the 27MB bug
    // produces (hydration itself proceeds, but real interactivity is stalled
    // behind more JS than the marker's own commit accounts for).
    const navLibraryLink = browserPage.getByRole("navigation").getByRole("link", {
      name: "Library",
    });
    await expect(navLibraryLink, `nav not visible on ${page.url}`).toBeVisible({
      timeout: 5000,
    });

    const loadTimeMs = Date.now() - startTime;

    // Check load time
    expect(loadTimeMs, `${page.name} took ${loadTimeMs}ms (limit: ${page.maxLoadTimeMs}ms)`).toBeLessThanOrEqual(
      page.maxLoadTimeMs,
    );

    // Log the actual load time for monitoring
    console.log(`✓ ${page.name}: ${loadTimeMs}ms (limit: ${page.maxLoadTimeMs}ms)`);
  });
}

/**
 * HEAVY DATA SCENARIOS
 *
 * Test that pages with larger datasets (100+ facts) still load performantly.
 * These scenarios are more representative of real usage after significant
 * practice/study, and catch performance issues that only manifest with heavy
 * data loads (e.g., large list rendering, complex calculations).
 */

// Helper to generate a large pool of fact IDs (kana characters)
// Hiragana + Katakana = ~100 facts total
function generateLargeFactPool(): string[] {
  const HIRAGANA = [
    "あ", "い", "う", "え", "お",
    "か", "き", "く", "け", "こ",
    "が", "ぎ", "ぐ", "げ", "ご",
    "さ", "し", "す", "せ", "そ",
    "ざ", "じ", "ず", "ぜ", "ぞ",
    "た", "ち", "つ", "て", "と",
    "だ", "ぢ", "づ", "で", "ど",
    "な", "に", "ぬ", "ね", "の",
    "は", "ひ", "ふ", "へ", "ほ",
    "ば", "び", "ぶ", "べ", "ぼ",
    "ぱ", "ぴ", "ぷ", "ぺ", "ぽ",
    "ま", "み", "む", "め", "も",
    "や", "ゆ", "よ",
    "ら", "り", "る", "れ", "ろ",
    "わ", "ゐ", "ゑ", "を", "ん",
  ];
  const KATAKANA = [
    "ア", "イ", "ウ", "エ", "オ",
    "カ", "キ", "ク", "ケ", "コ",
    "ガ", "ギ", "グ", "ゲ", "ゴ",
    "サ", "シ", "ス", "セ", "ソ",
    "ザ", "ジ", "ズ", "ゼ", "ゾ",
    "タ", "チ", "ツ", "テ", "ト",
    "ダ", "ヂ", "ヅ", "デ", "ド",
    "ナ", "ニ", "ヌ", "ネ", "ノ",
    "ハ", "ヒ", "フ", "ヘ", "ホ",
    "バ", "ビ", "ブ", "ベ", "ボ",
    "パ", "ピ", "プ", "ペ", "ポ",
    "マ", "ミ", "ム", "メ", "モ",
    "ヤ", "ユ", "ヨ",
    "ラ", "リ", "ル", "レ", "ロ",
    "ワ", "ヰ", "ヱ", "ヲ", "ン",
  ];

  return [
    ...HIRAGANA.map(c => kanaFact(c)),
    ...KATAKANA.map(c => kanaFact(c)),
  ];
}

const HEAVY_DATA_FACTS = generateLargeFactPool();

test("Quiz selection page with 100+ facts loads within acceptable time", async ({
  page: browserPage,
  seed,
}) => {
  // Seed with large fact pool
  await seed({ seen: HEAVY_DATA_FACTS });

  const startTime = Date.now();

  const response = await browserPage.goto("/quiz");

  await waitForHydration(browserPage);

  expect(response, "no response for /quiz").not.toBeNull();
  expect(response!.status(), "bad status for /quiz").toBeLessThan(400);

  // SAK-228: capture loadTimeMs AFTER this visibility check, not before — see
  // the fix's comment on the main TEST_PAGES loop above for why.
  await expect(
    browserPage.getByRole("navigation").getByRole("link", { name: "Library" }),
  ).toBeVisible({ timeout: 5000 });

  const loadTimeMs = Date.now() - startTime;

  // Heavier data should take a bit longer but still be reasonable
  const maxLoadTime = 3500;
  expect(loadTimeMs, `Quiz page with heavy data took ${loadTimeMs}ms (limit: ${maxLoadTime}ms)`).toBeLessThanOrEqual(
    maxLoadTime,
  );

  console.log(`✓ Quiz page (heavy data, ${HEAVY_DATA_FACTS.length} facts): ${loadTimeMs}ms (limit: ${maxLoadTime}ms)`);
});

test("Practice selector page with 100+ facts loads within acceptable time", async ({
  page: browserPage,
  seed,
}) => {
  await seed({ seen: HEAVY_DATA_FACTS });

  const startTime = Date.now();

  const response = await browserPage.goto("/practice");

  await waitForHydration(browserPage);

  expect(response, "no response for /practice").not.toBeNull();
  expect(response!.status(), "bad status for /practice").toBeLessThan(400);

  // SAK-228: capture loadTimeMs AFTER this visibility check, not before — see
  // the fix's comment on the main TEST_PAGES loop above for why.
  await expect(
    browserPage.getByRole("navigation").getByRole("link", { name: "Library" }),
  ).toBeVisible({ timeout: 5000 });

  const loadTimeMs = Date.now() - startTime;

  const maxLoadTime = 3500;
  expect(loadTimeMs, `Practice page with heavy data took ${loadTimeMs}ms (limit: ${maxLoadTime}ms)`).toBeLessThanOrEqual(
    maxLoadTime,
  );

  console.log(`✓ Practice page (heavy data, ${HEAVY_DATA_FACTS.length} facts): ${loadTimeMs}ms (limit: ${maxLoadTime}ms)`);
});

test("Progress page with 100+ known facts loads within acceptable time", async ({
  page: browserPage,
  seed,
}) => {
  // For progress, we need facts that have been "seen" (practiced)
  // This simulates a learner who has practiced many facts
  await seed({ seen: HEAVY_DATA_FACTS });

  const startTime = Date.now();

  // SAK-152: /stats moved to /progress (see the main-page test above).
  const response = await browserPage.goto("/progress");

  await waitForHydration(browserPage);

  expect(response, "no response for /progress").not.toBeNull();
  expect(response!.status(), "bad status for /progress").toBeLessThan(400);

  // SAK-228: capture loadTimeMs AFTER this visibility check, not before — see
  // the fix's comment on the main TEST_PAGES loop above for why.
  await expect(
    browserPage.getByRole("navigation").getByRole("link", { name: "Library" }),
  ).toBeVisible({ timeout: 5000 });

  const loadTimeMs = Date.now() - startTime;

  const maxLoadTime = 4000;
  expect(loadTimeMs, `Progress page with heavy data took ${loadTimeMs}ms (limit: ${maxLoadTime}ms)`).toBeLessThanOrEqual(
    maxLoadTime,
  );

  console.log(`✓ Progress page (heavy data, ${HEAVY_DATA_FACTS.length} facts): ${loadTimeMs}ms (limit: ${maxLoadTime}ms)`);
});

test("Library root with 100+ known facts loads within acceptable time", async ({
  page: browserPage,
  seed,
}) => {
  // Library shows knowledge status for facts, so heavier data affects rendering
  await seed({ seen: HEAVY_DATA_FACTS });

  const startTime = Date.now();

  const response = await browserPage.goto("/library");

  await waitForHydration(browserPage);

  expect(response, "no response for /library").not.toBeNull();
  expect(response!.status(), "bad status for /library").toBeLessThan(400);

  // SAK-228: capture loadTimeMs AFTER this visibility check, not before — see
  // the fix's comment on the main TEST_PAGES loop above for why.
  await expect(
    browserPage.getByRole("navigation").getByRole("link", { name: "Library" }),
  ).toBeVisible({ timeout: 5000 });

  const loadTimeMs = Date.now() - startTime;

  const maxLoadTime = 4000;
  expect(loadTimeMs, `Library page with heavy data took ${loadTimeMs}ms (limit: ${maxLoadTime}ms)`).toBeLessThanOrEqual(
    maxLoadTime,
  );

  console.log(`✓ Library page (heavy data, ${HEAVY_DATA_FACTS.length} facts): ${loadTimeMs}ms (limit: ${maxLoadTime}ms)`);
});

test("Library all tab with 100+ known facts loads within acceptable time", async ({
  page: browserPage,
  seed,
}) => {
  // Library "all" tab with search/filtering on large dataset
  await seed({ seen: HEAVY_DATA_FACTS });

  const startTime = Date.now();

  const response = await browserPage.goto("/library?kind=all");

  await waitForHydration(browserPage);

  expect(response, "no response for /library?kind=all").not.toBeNull();
  expect(response!.status(), "bad status for /library?kind=all").toBeLessThan(400);

  // SAK-228: capture loadTimeMs AFTER this visibility check, not before — see
  // the fix's comment on the main TEST_PAGES loop above for why.
  await expect(
    browserPage.getByRole("navigation").getByRole("link", { name: "Library" }),
  ).toBeVisible({ timeout: 5000 });

  const loadTimeMs = Date.now() - startTime;

  const maxLoadTime = 4500;
  expect(loadTimeMs, `Library all tab with heavy data took ${loadTimeMs}ms (limit: ${maxLoadTime}ms)`).toBeLessThanOrEqual(
    maxLoadTime,
  );

  console.log(`✓ Library all tab (heavy data, ${HEAVY_DATA_FACTS.length} facts): ${loadTimeMs}ms (limit: ${maxLoadTime}ms)`);
});

/**
 * SAK-228: /session had NO load-time budget assertion at all before this,
 * despite route_sizes.mjs confirming it as one of the two heaviest routes in
 * the app (~15-20MB — still carrying the vocabulary dictionary for grading,
 * see docs/perf-library-list-bundle.md's "still deferred" list).
 *
 * /session can't be added to TEST_PAGES above: a bare `goto("/session")` with
 * no active quiz session redirects straight to "/" (see the
 * `router.replace("/")` in src/app/session/page.tsx) before the route's own
 * heavy code ever renders anything to measure. Reaching the real screen
 * needs a genuine in-progress round, the same way session-loop.spec.ts and
 * quiz-flow-performance.spec.ts do it.
 *
 * The measurement itself is a fresh navigation (`page.reload()`), not the
 * in-app transition quiz-flow-performance.spec.ts already times — that file
 * answers "is the SPA transition into this screen fast", this answers "how
 * long does loading this route's own bundle take", which is what a bundle-
 * size regression like the 27MB bug actually costs.
 *
 * CAVEAT, honestly: because this reload happens in the SAME browser context
 * that already visited /learn → /quiz → /session once to build the round
 * state, the route's static JS chunks may already be in the browser's HTTP
 * cache, so this under-counts pure network-transfer time versus a genuinely
 * cold visitor. It does NOT under-count the JS parse/execute cost, which a
 * full page navigation always pays fresh regardless of cache — and that
 * parse/execute cost, not download time, is what production TTFB
 * measurements (see this ticket's own investigation) confirmed is the real
 * bottleneck. A route that regresses to 27MB will still take meaningfully
 * longer to parse and hydrate here even warm. Getting a fully cold
 * measurement would need seeding the quiz-session localStorage snapshot
 * directly rather than driving it through the UI once first — left as a
 * follow-up rather than hand-authoring that snapshot's shape here.
 */
test("/session (round-complete) reload loads within acceptable time", async ({
  page,
  seed,
}) => {
  const VOWELS = ["あ", "い", "う", "え", "お"];
  const VOWEL_FACTS = VOWELS.map((k) => `kana:${k}/reading`);

  const CFG = {
    ...STEADY_CFG,
    ...direction("jp2en"),
    ...style("jp2en", "typed"),
    length: "limited",
    limType: "cov",
  };

  await seed({ seen: [], cfg: CFG });
  await startVowelLessonDrill(page);

  for (let i = 0; i < VOWELS.length; i++) {
    await answerDrillCard(page, VOWEL_FACTS, {
      last: i === VOWELS.length - 1,
      finishUrl: "**/session",
    });
  }

  // Real round-complete state is now live (and persisted to localStorage,
  // src/lib/quiz-session.tsx) — reload the route fresh and time THAT.
  const startTime = Date.now();

  const response = await page.reload();

  await waitForHydration(page);

  expect(response, "no response reloading /session").not.toBeNull();
  expect(response!.status(), "bad status reloading /session").toBeLessThan(400);

  // Interactive = the round-complete fork restored from the localStorage
  // snapshot and its primary button is on screen — the same signal
  // quiz-flow-performance.spec.ts uses for the SPA-transition version of
  // this screen.
  await expect(
    page.getByRole("button", { name: "Complete round", exact: true }),
  ).toBeVisible();

  const loadTimeMs = Date.now() - startTime;
  const maxLoadTime = 8000;

  console.log(`✓ /session reload (round-complete): ${loadTimeMs}ms (limit: ${maxLoadTime}ms)`);
  expect(
    loadTimeMs,
    `/session reload took ${loadTimeMs}ms (limit: ${maxLoadTime}ms)`,
  ).toBeLessThanOrEqual(maxLoadTime);
});
