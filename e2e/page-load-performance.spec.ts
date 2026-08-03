import { test, expect } from "./helpers/app";

/**
 * Page load performance tests.
 *
 * Ensures that main application pages and representative library pages load
 * within acceptable time limits. These thresholds catch regressions that could
 * impact user experience.
 *
 * Tested routes:
 * - Main pages: home, learn, quiz, practice, settings, stats, library
 * - Library sub-pages: from kana, kanji, and grammar sections
 * - Grammar pages: sample grammar cluster
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
    name: "Stats page",
    url: "/stats",
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

  // Grammar cluster page
  {
    name: "Grammar cluster page",
    url: "/grammar/obligation",
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
