// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/assembly.test.ts
//
// THE CRUX for assembly, and the reason it is allowed to exist beside the
// never-mark-wrong rule: every item has EXACTLY ONE accepted order, and the
// gate never serves an item with a word the learner has not met.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ASSEMBLY,
  SENTENCE_ORDERING_TIERS,
  assemblyFacts,
  assemblyReadable,
  canonicalOrder,
  gradeAssembly,
  pickAssembly,
  pickAssemblyForTiers,
  readableAssembly,
  readableAssemblyForTier,
  readableAssemblyForTiers,
  sentenceOrderingTierForItem,
  tierAssemblyFacts,
  type AssemblyItem,
} from "./assembly.ts";
import { patternMeaningFactId } from "./grammar/index.ts";
import { STOCK_NAMES } from "../lib/grammar/readable.ts";
import { factInfo } from "../lib/facts.ts";
import { CURRICULUM_PATTERNS } from "../lib/grammar-lesson.ts";
import { CURRICULUM_WORDS } from "../lib/word-lesson.ts";
import { applyClaims, emptyHistory } from "../lib/history-ops.ts";
import { isProducible } from "./grammar/recipes.ts";
import { VOCAB, wordMeaningFactId } from "./vocab.ts";
import type { HistoryFile } from "../types/index.ts";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const NOBODY: HistoryFile = { sessions: [], facts: {} };

/** A learner who has claimed every vocabulary word — reads everything. */
const OMNISCIENT: HistoryFile = {
  sessions: [],
  facts: {},
  claims: Object.fromEntries(VOCAB.map((w) => [wordMeaningFactId(w.keb), 1_700_000_000_000])),
};

describe("sentence-ordering follows the grammar teaching order", () => {
  test("simple is first, then tiers follow their earliest taught prerequisite", () => {
    assert.equal(SENTENCE_ORDERING_TIERS[0]?.id, "simple");

    // The sentence-ordering tiers sequence on the PRODUCIBLE teaching order — the
    // patterns the grammar track actually drills. CURRICULUM_PATTERNS now holds
    // all recipes (the non-producible ones are taught by meaning too), but a
    // meaning-only pattern does not move a tier's unlock: the `reported` tier's
    // prereqs (to-omou, rashii, kamoshirenai, deshou) are all non-producible, and
    // it sits last because none of them is a drilled prerequisite. Filtering to
    // producible keeps this measuring the same teaching order it always did; the
    // relative order of the producible patterns inside CURRICULUM_PATTERNS is
    // unchanged by the expansion (the sort is stable). Re-ordering the tiers to
    // account for when a meaning-only pattern is introduced is an assembly-track
    // decision, tracked separately.
    const curriculumIndex = new Map(
      CURRICULUM_PATTERNS.filter(isProducible).map((pattern, index) => [pattern.id, index]),
    );
    const ordered = SENTENCE_ORDERING_TIERS.slice(1).map((tier) => {
      const taught = tier.grammarPrereqs
        .map((id) => curriculumIndex.get(id))
        .filter((index): index is number => index !== undefined);
      return {
        id: tier.id,
        firstPrerequisite: taught.length ? Math.min(...taught) : Number.POSITIVE_INFINITY,
      };
    });

    assert.deepEqual(
      ordered.map(({ id }) => id),
      [
        "sequential",
        "request",
        "desire",
        "conditional",
        "causal",
        "giving",
        "contrast",
        "obligation",
        "reported",
      ],
    );
    for (let i = 1; i < ordered.length; i += 1) {
      assert.ok(
        ordered[i - 1].firstPrerequisite <= ordered[i].firstPrerequisite,
        `${ordered[i].id} appears before an earlier grammar prerequisite`,
      );
    }
  });

});

describe("sentence-ordering quiz hints", () => {
  const itemWithPatterns = (patterns: readonly string[]): AssemblyItem => ({
    id: -1,
    en: "",
    jp: "",
    pieces: [],
    v: [],
    p: patterns,
  });

  test("each tier's pattern selects that tier's Think hint", () => {
    for (const tier of SENTENCE_ORDERING_TIERS) {
      assert.equal(
        sentenceOrderingTierForItem(itemWithPatterns([tier.patterns[0]])),
        tier.id,
      );
    }
  });

  test("a sentence spanning multiple lessons stays out of single-tier drills", () => {
    assert.equal(
      sentenceOrderingTierForItem(itemWithPatterns(["wo", "tara"])),
      null,
    );
    assert.equal(
      sentenceOrderingTierForItem(itemWithPatterns(["ba", "te-ageru"])),
      null,
    );
  });

  test("an unsupported way-of-doing sentence stays unclassified", () => {
    assert.equal(sentenceOrderingTierForItem(itemWithPatterns(["kata"])), null);
  });

  test("negative requests stay with requests, not without/contrast", () => {
    assert.equal(
      sentenceOrderingTierForItem(itemWithPatterns(["nai-request"])),
      "request",
    );
  });
});

describe("SAK-18: every sentence-ordering tier pattern is a real, creditable fact", () => {
  // The bug: "simple" (SENTENCE_ORDERING_TIERS[0].id) was ALSO used as an
  // item.p pattern tag on that tier's curated items. patternMeaningFactId maps
  // an item.p entry to a grammar fact id by looking it up in the registered
  // recipes (src/data/grammar/recipes.ts) — "simple" was never one of them, so
  // the id it produced had no factInfo and assemblyFacts() filtered it out,
  // leaving rt.stats completely empty for every "Simple sentences" showing.
  // The round summary and session-complete screens read directly off rt.stats
  // (via mergeStats/roundCompleteView, src/lib/session.ts), so a learner who
  // built every sentence correctly still saw "0 forms · 0 solid · 0 needs
  // work" / "finished on 0 correct".
  //
  // This is a general invariant, not just a "simple"-tier fix: EVERY pattern id
  // any tier lists must resolve to a real fact, or crediting silently breaks
  // for that pattern exactly the way it did here. Fails on the pre-fix code
  // (which listed "simple") and passes once every tier only lists registered
  // recipe ids.
  test("every tier's classification patterns resolve to a registered fact", () => {
    for (const tier of SENTENCE_ORDERING_TIERS) {
      for (const pattern of tier.patterns) {
        assert.ok(
          factInfo(patternMeaningFactId(pattern)),
          `${tier.id}'s pattern "${pattern}" has no registered grammar fact — ` +
            `assemblyFacts() will silently credit nothing for it`,
        );
      }
    }
  });

  // The concrete regression: the six hand-curated "Simple sentences" items
  // (ids -1, -2, -3, -101, -102, -103) must each credit at least one real
  // fact. Before the fix every one of these returned [] here.
  test("every curated Simple-sentences item credits a real fact", () => {
    const simpleTier = SENTENCE_ORDERING_TIERS[0];
    assert.equal(simpleTier.id, "simple");
    const curatedSimpleItems = ASSEMBLY.filter(
      (item) => item.id < 0 && sentenceOrderingTierForItem(item) === "simple",
    );
    // Guard the guard: this must actually find the six curated items, or the
    // rest of this test would vacuously pass.
    assert.equal(curatedSimpleItems.length, 6);
    for (const item of curatedSimpleItems) {
      const facts = assemblyFacts(item);
      assert.ok(
        facts.length > 0,
        `item ${item.id} (${item.jp}) credits no facts — the exact SAK-18 bug`,
      );
    }
  });

  // tierAssemblyFacts feeds sentenceLessonFacts (src/lib/sentence-ordering-plan.ts),
  // which is what the "Simple sentences" lesson launch and the practice-corpus
  // runtime (assembly-screen.tsx buildRuntime) key their stats off. Empty here
  // is exactly the state that produced the bug's symptom.
  test("the simple tier's readable facts are non-empty for a learner who can read them", () => {
    const simpleTier = SENTENCE_ORDERING_TIERS[0];
    assert.ok(tierAssemblyFacts(simpleTier, OMNISCIENT).length > 0);
  });

  // No item may carry the bare tier id as a pattern tag going forward — that
  // is precisely how "simple" ended up unregistered and un-creditable.
  test("no assembly item is tagged with a bare tier id", () => {
    const tierIds = new Set(SENTENCE_ORDERING_TIERS.map((tier) => tier.id));
    for (const item of ASSEMBLY) {
      for (const pattern of item.p) {
        assert.ok(
          !tierIds.has(pattern) || factInfo(patternMeaningFactId(pattern)),
          `item ${item.id} is tagged "${pattern}", a tier id with no matching fact`,
        );
      }
    }
  });

  // Regression: an already-working tier (conditional: tara/ba/nara) must be
  // completely unaffected by the simple-tier fix.
  test("an unaffected tier (conditional) still credits its patterns", () => {
    const conditionalTier = SENTENCE_ORDERING_TIERS.find(
      (tier) => tier.id === "conditional",
    )!;
    const pool = readableAssemblyForTier(conditionalTier, OMNISCIENT);
    assert.ok(pool.length > 0);
    for (const item of pool.slice(0, 10)) {
      assert.ok(
        assemblyFacts(item).length > 0,
        `item ${item.id} (${item.jp}) credits no facts`,
      );
    }
  });
});

describe("sentence-ordering quiz scope", () => {
  // The curated items (SAK-45) are natural, imitable sentences Sam approved
  // directly — they no longer have to draw from the first N Vocabulary-track
  // words by curriculum rank (see assembly.ts's CURATED_ASSEMBLY comment).
  // These tests claim exactly the words a tier's curated items need, rather
  // than a CURRICULUM_WORDS-rank slice, so "a small foundation unlocks the
  // tier" is still asserted without depending on where those specific words
  // happen to fall in curriculum rank.
  const SIMPLE_TIER_WORDS = ["私", "水", "飲む", "何", "本", "読む"];

  function wordsHistory(words: readonly string[]): HistoryFile {
    return applyClaims(emptyHistory(), words.map(wordMeaningFactId), 1);
  }

  test("the basic sentence lesson needs a small grammatical foundation, not sushi", () => {
    const simple = SENTENCE_ORDERING_TIERS[0];
    assert.equal(simple.id, "simple");

    // Missing even one of the three curated items' words is not enough to
    // supply all three reviewed examples.
    assert.ok(
      readableAssemblyForTier(simple, wordsHistory(SIMPLE_TIER_WORDS.slice(0, -1))).length <
        simple.minReadable,
    );
    const pool = readableAssemblyForTier(simple, wordsHistory(SIMPLE_TIER_WORDS));
    assert.ok(pool.length >= simple.minReadable);
    assert.ok(pool.slice(0, simple.minReadable).every((item) => item.id > -100));
    assert.ok(pool.slice(0, simple.minReadable).every((item) => !item.v.includes("寿司")));

    const nounLike = SIMPLE_TIER_WORDS.filter((keb) =>
      CURRICULUM_WORDS.some(
        (word) => word.keb === keb && word.pos.some((pos) => /noun|pronoun/i.test(pos)),
      ),
    );
    const verbs = SIMPLE_TIER_WORDS.filter((keb) =>
      CURRICULUM_WORDS.some(
        (word) =>
          word.keb === keb && word.pos.some((pos) => /verb/i.test(pos) && !/adverb/i.test(pos)),
      ),
    );
    assert.ok(nounLike.length >= 2);
    assert.ok(verbs.length >= 1);
  });

  test("every sentence tier has a reviewed drill reachable once its curated vocabulary is known", () => {
    // A "beginner" here is someone who knows exactly the words the curated
    // (hand-authored) assembly items use — not the full VOCAB (OMNISCIENT,
    // used elsewhere for corpus-wide checks) and not a curriculum-rank slice.
    const curatedWords = new Set<string>();
    for (const item of ASSEMBLY) {
      if (item.id < 0) for (const lemma of item.v) curatedWords.add(lemma);
    }
    const beginner = wordsHistory([...curatedWords]);
    for (const tier of SENTENCE_ORDERING_TIERS) {
      assert.ok(
        readableAssemblyForTier(tier, beginner).length >= tier.minReadable,
        `${tier.id} still depends on vocabulary its own curated items don't use`,
      );
    }
  });

  test("a tier-scoped pool contains only that sentence type", () => {
    for (const tier of SENTENCE_ORDERING_TIERS) {
      const pool = readableAssemblyForTiers([tier.id], OMNISCIENT);
      assert.ok(pool.length > 0, `${tier.id} should have readable exercises`);
      for (const item of pool) {
        assert.equal(sentenceOrderingTierForItem(item), tier.id);
      }
    }
  });

  test("the picker never crosses into an unrequested tier", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const item = pickAssemblyForTiers(
        OMNISCIENT,
        ["conditional"],
        seeded(seed),
      );
      assert.ok(item);
      assert.equal(sentenceOrderingTierForItem(item), "conditional");
    }
  });

  test("no learned sentence types means no sentence question", () => {
    assert.equal(pickAssemblyForTiers(OMNISCIENT, [], seeded(1)), null);
  });

  test("conditional prompts state a condition in English", () => {
    const tier = SENTENCE_ORDERING_TIERS.find(
      (candidate) => candidate.id === "conditional",
    )!;
    const pool = readableAssemblyForTier(tier, OMNISCIENT);
    assert.ok(pool.length >= tier.minReadable);
    for (const item of pool) {
      assert.match(item.en, /\b(if|when|unless|provided|in case)\b/i);
    }
    assert.ok(!pool.some((item) => item.en === "The box is in the storeroom."));
  });
});

describe("the assembly corpus is well-formed", () => {
  test("it ships items", () => {
    assert.ok(ASSEMBLY.length > 100, `expected a real corpus, got ${ASSEMBLY.length}`);
  });

  test("every item is a rebuildable, single-order sentence", () => {
    for (const it of ASSEMBLY) {
      const surfaces = it.pieces.map((p) => p.t);
      // At least three pieces — a two-piece order is trivial.
      assert.ok(surfaces.length >= 3, `item ${it.id} has too few pieces`);
      // Pieces join to the canonical sentence: segmentation lost nothing.
      assert.equal(surfaces.join(""), it.jp, `item ${it.id} does not reassemble`);
      // NO REPEATED PIECE. This is what makes "the" order unique: if two chips
      // read identically, swapping them yields the same string and there would
      // be two accepted orders, not one.
      assert.equal(
        new Set(surfaces).size,
        surfaces.length,
        `item ${it.id} repeats a piece, so its order is not unique`,
      );
    }
  });
});

describe("EXACTLY ONE accepted order", () => {
  test("the canonical order grades true; every wrong order grades false", () => {
    for (const it of ASSEMBLY) {
      const canon = canonicalOrder(it);
      assert.ok(gradeAssembly(it, canon), `item ${it.id}: canonical order must be accepted`);
      // Every single adjacent swap is a DIFFERENT order (pieces are unique) and
      // must be rejected. Proving one accepted order means proving the near
      // neighbours are not also accepted.
      for (let i = 0; i + 1 < canon.length; i++) {
        const swapped = canon.slice();
        [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
        assert.equal(
          gradeAssembly(it, swapped),
          false,
          `item ${it.id}: swapping pieces ${i},${i + 1} must be wrong`,
        );
      }
      // The full reverse (for length >= 2) is also wrong.
      assert.equal(gradeAssembly(it, canon.slice().reverse()), false, `item ${it.id}: reverse`);
    }
  });
});

describe("the known-words gate never serves an unknown word", () => {
  test("a learner who knows nothing is served nothing", () => {
    assert.equal(readableAssembly(NOBODY).length, 0);
    assert.equal(pickAssembly(NOBODY, seeded(1)), null);
  });

  test("every served item's words are ALL in the known set", () => {
    // A concrete mid-beginner: claims on the first 1,500 words by beginnerRank.
    const knownKebs = new Set<string>();
    for (const w of VOCAB) if (w.beginnerRank <= 1500) knownKebs.add(w.keb);
    const claims: Record<string, number> = {};
    for (const keb of knownKebs) claims[wordMeaningFactId(keb)] = 1_700_000_000_000;
    const history: HistoryFile = { sessions: [], facts: {}, claims };

    // Independent membership check, re-derived from raw vocab (NOT via the same
    // lemmaKnown the gate uses): a lemma is known iff some vocab row spelled that
    // way has a claimed keb, or it is a stock name.
    const isKnownLemma = (lemma: string): boolean =>
      STOCK_NAMES.has(lemma) ||
      VOCAB.some((w) => (w.keb === lemma || w.reb === lemma) && knownKebs.has(w.keb));

    const served = readableAssembly(history);
    assert.ok(served.length > 0, "a mid-beginner should be able to read some items");
    assert.ok(served.length < ASSEMBLY.length, "the gate must actually exclude items");
    for (const it of served) {
      for (const lemma of it.v) {
        assert.ok(isKnownLemma(lemma), `item ${it.id} served with unknown word ${lemma}`);
      }
    }
    // And the gate genuinely blocks: at least one full-corpus item is unreadable.
    assert.ok(
      ASSEMBLY.some((it) => !assemblyReadable(it, history)),
      "the gate should exclude at least one item for a mid-beginner",
    );
  });

  test("pickAssembly returns a readable item", () => {
    const item = pickAssembly(OMNISCIENT, seeded(42)) as AssemblyItem;
    assert.ok(item);
    assert.ok(assemblyReadable(item, OMNISCIENT));
  });
});

describe("pinned segmentation — a wrong boundary would be a wrong order", () => {
  const byId = new Map(ASSEMBLY.map((it) => [it.id, it]));
  const cases: { id: number; pieces: string[] }[] = [
    { id: 4812, pieces: ["日本へ", "行けたら", "いいのに"] },
    { id: 6001, pieces: ["薬を", "飲まなければ", "なりません"] },
  ];
  for (const c of cases) {
    test(`item ${c.id} breaks into ${c.pieces.join(" / ")}`, () => {
      const it = byId.get(c.id);
      assert.ok(it, `pinned item ${c.id} is no longer in the corpus`);
      assert.deepEqual(it.pieces.map((p) => p.t), c.pieces);
    });
  }
});
