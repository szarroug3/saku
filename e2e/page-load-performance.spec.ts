import { test, expect } from "./helpers/app";
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
 * Load time is measured from navigation start to networkidle (all network
 * requests complete and no new ones initiated for at least 500ms).
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

    // Wait for network to be idle (all requests complete, no new ones for 500ms)
    await browserPage.waitForLoadState("networkidle");

    const loadTimeMs = Date.now() - startTime;

    // Verify page loaded successfully
    expect(response, `no response for ${page.url}`).not.toBeNull();
    expect(response!.status(), `bad status for ${page.url}`).toBeLessThan(400);

    // Verify navigation element is visible (proof of successful render)
    const navLibraryLink = browserPage.getByRole("navigation").getByRole("link", {
      name: "Library",
    });
    await expect(navLibraryLink, `nav not visible on ${page.url}`).toBeVisible({
      timeout: 5000,
    });

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

  await browserPage.waitForLoadState("networkidle");

  const loadTimeMs = Date.now() - startTime;

  expect(response, "no response for /quiz").not.toBeNull();
  expect(response!.status(), "bad status for /quiz").toBeLessThan(400);

  await expect(
    browserPage.getByRole("navigation").getByRole("link", { name: "Library" }),
  ).toBeVisible({ timeout: 5000 });

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

  await browserPage.waitForLoadState("networkidle");

  const loadTimeMs = Date.now() - startTime;

  expect(response, "no response for /practice").not.toBeNull();
  expect(response!.status(), "bad status for /practice").toBeLessThan(400);

  await expect(
    browserPage.getByRole("navigation").getByRole("link", { name: "Library" }),
  ).toBeVisible({ timeout: 5000 });

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

  await browserPage.waitForLoadState("networkidle");

  const loadTimeMs = Date.now() - startTime;

  expect(response, "no response for /progress").not.toBeNull();
  expect(response!.status(), "bad status for /progress").toBeLessThan(400);

  await expect(
    browserPage.getByRole("navigation").getByRole("link", { name: "Library" }),
  ).toBeVisible({ timeout: 5000 });

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

  await browserPage.waitForLoadState("networkidle");

  const loadTimeMs = Date.now() - startTime;

  expect(response, "no response for /library").not.toBeNull();
  expect(response!.status(), "bad status for /library").toBeLessThan(400);

  await expect(
    browserPage.getByRole("navigation").getByRole("link", { name: "Library" }),
  ).toBeVisible({ timeout: 5000 });

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

  await browserPage.waitForLoadState("networkidle");

  const loadTimeMs = Date.now() - startTime;

  expect(response, "no response for /library?kind=all").not.toBeNull();
  expect(response!.status(), "bad status for /library?kind=all").toBeLessThan(400);

  await expect(
    browserPage.getByRole("navigation").getByRole("link", { name: "Library" }),
  ).toBeVisible({ timeout: 5000 });

  const maxLoadTime = 4500;
  expect(loadTimeMs, `Library all tab with heavy data took ${loadTimeMs}ms (limit: ${maxLoadTime}ms)`).toBeLessThanOrEqual(
    maxLoadTime,
  );

  console.log(`✓ Library all tab (heavy data, ${HEAVY_DATA_FACTS.length} facts): ${loadTimeMs}ms (limit: ${maxLoadTime}ms)`);
});
