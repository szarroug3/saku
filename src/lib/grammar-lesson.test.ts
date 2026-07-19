// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/grammar-lesson.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The grammar track has three properties that all type-check when broken:
//
//   ORDER      it teaches N5 before N4 (a beginner meets the easy half first),
//              preserving the authored within-level grouping.
//   DRILLABLE  it teaches ONLY producible patterns — never a reference-only
//              wrap or a vacuous pattern the drill would forever refuse to quiz.
//   THE GATE   it opens after kana is done AND at least one word is learned, so
//              grammar lessons start with known material.
//
// So these pin the order, the drillable filter, the count sizing, and — using
// the exact gate src/app/page.tsx applies.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_GROUP_FACTS, nextLesson } from "./lesson.ts";
import {
  patternMeaningFactId,
  patternProductionFactId,
  productionHosts,
} from "../data/grammar/index.ts";
import {
  DRILLABLE,
  RECIPES,
  isProducible,
  recipe,
} from "../data/grammar/recipes.ts";
import {
  CURRICULUM_PATTERNS,
  GRAMMAR_CURRICULUM_TOTAL,
  GRAMMAR_PER_LESSON_DEFAULT,
  clampGrammarPerLesson,
  hasStartedGrammarTrack,
  nextGrammarLesson,
  nextGrammarLock,
  wordHost,
} from "./grammar-lesson.ts";
import { CURRICULUM_WORDS } from "./word-lesson.ts";
import { wordMeaningFactId } from "../data/vocab.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const AT = Date.UTC(2026, 0, 1);

/** The first curriculum word of each host — the cheapest way to hand the gate a
 * learned word of a given type. 言う (a verb) unlocks the head of the order;
 * 大丈夫 (a な-adjective) is what 〜ので waits on. */
const FIRST_VERB = CURRICULUM_WORDS.find((w) => wordHost(w) === "verb")!;
const FIRST_ADJ_NA = CURRICULUM_WORDS.find((w) => wordHost(w) === "adj-na")!;

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, claims: {}, ...over };
}

/** Claim these facts known — the cheap way to move history forward, mirroring
 * /api/claim. A claim is non-fresh, so it counts as "met". */
function claiming(facts: readonly FactId[]): HistoryFile {
  const claims: Record<string, number> = {};
  for (const f of facts) claims[f] = AT;
  return history({ claims: claims as HistoryFile["claims"] });
}

/** "I finished the kana track" — every kana fact claimed, which is exactly the
 * state that makes nextLesson (the kana lesson) return null. This is the gate
 * src/app/page.tsx reads to open both kanji and grammar. */
function allKanaClaimed(): HistoryFile {
  return claiming(KANA_GROUP_FACTS.flat());
}

/** Kana done AND one verb learned — the state that opens the HEAD of the grammar
 * curriculum, whose first patterns all attach to a verb (〜て family). This is
 * the real gate for a teachable lesson: kana alone leaves grammar LOCKED now,
 * because a pattern needs a real word of its host type behind it. */
function kanaAndVerb(): HistoryFile {
  return claiming([...KANA_GROUP_FACTS.flat(), wordMeaningFactId(FIRST_VERB.keb)]);
}

describe("the curriculum is the drillable patterns, N5 before N4", () => {
  test("every taught pattern is producible — no reference-only rows", () => {
    for (const r of CURRICULUM_PATTERNS) {
      assert.ok(isProducible(r), `${r.id} is not producible and must not be taught`);
    }
    // The known reference-only patterns are explicitly absent: the two vacuous
    // comparisons, the two order-free/data-blocked wraps.
    const taught = new Set(CURRICULUM_PATTERNS.map((r) => r.id));
    for (const id of ["wa-yori", "hou-ga-yori", "tari-tari", "shika-nai"]) {
      assert.ok(!taught.has(id), `${id} is reference-only and must not be taught`);
    }
    // It is exactly the drillable set, no more and no less.
    assert.equal(CURRICULUM_PATTERNS.length, DRILLABLE.length);
  });

  test("all N5 patterns come before all N4 patterns", () => {
    const levels = CURRICULUM_PATTERNS.map((r) => r.level);
    const firstN4 = levels.indexOf("N4");
    if (firstN4 !== -1) {
      for (let i = firstN4; i < levels.length; i++) {
        assert.equal(levels[i], "N4", "an N5 pattern appears after an N4 one");
      }
    }
    assert.ok(levels.includes("N5") && levels.includes("N4"));
  });

  test("within a level, the authored (grouped) order is preserved — stable sort", () => {
    // The N5 slice of the curriculum is the N5 drillable recipes in RECIPES order;
    // likewise N4. That is what "stable" buys, and it keeps the て/ない/must
    // groupings intact inside each level.
    for (const level of ["N5", "N4"] as const) {
      const fromCurriculum = CURRICULUM_PATTERNS.filter((r) => r.level === level).map(
        (r) => r.id,
      );
      const fromAuthored = RECIPES.filter(
        (r) => r.level === level && isProducible(r),
      ).map((r) => r.id);
      assert.deepEqual(fromCurriculum, fromAuthored);
    }
  });

  test("a lesson from a kana-done, verb-learned history is the head of the order — all N5", () => {
    const lesson = nextGrammarLesson(kanaAndVerb(), 4)!;
    assert.equal(lesson.cards.length, 4);
    for (const card of lesson.cards) {
      assert.equal(card.level, "N5");
    }
    // It is the literal prefix of the curriculum.
    assert.deepEqual(
      lesson.cards.map((c) => c.id),
      CURRICULUM_PATTERNS.slice(0, 4).map((r) => r.id),
    );
  });

  test("a lesson's facts are the taught patterns' meaning + production facts", () => {
    const lesson = nextGrammarLesson(kanaAndVerb(), 3)!;
    const expected = new Set<string>();
    for (const card of lesson.cards) {
      const r = recipe(card.id)!;
      expected.add(patternMeaningFactId(r.id));
      // Every drillable pattern carries a production fact per HOST it teaches a
      // separate rule for — usually one (the verb), three for 〜そう. Derived
      // from productionHosts rather than assumed to be one, because a lesson
      // that seeded only the verb fact would leave the adjective rule unmet
      // forever: the lesson is where a fact is first introduced.
      for (const host of productionHosts(r)) {
        expected.add(patternProductionFactId(r.id, host));
      }
    }
    assert.deepEqual(new Set(lesson.facts as unknown as string[]), expected);
  });
});

describe("the gate: a pattern waits for a word of its host type", () => {
  test("kana incomplete → the caller keeps grammar hidden", () => {
    const h = history(); // nothing learned — kana is the first front
    assert.notEqual(nextLesson(h), null, "kana should be incomplete on empty history");
    // The kana gate is the caller's (src/app/page.tsx); the lib itself is pure
    // of kana and only reports whether the track has been started.
    assert.equal(hasStartedGrammarTrack(h), false);
  });

  test("kana done but no word learned → head lesson is LOCKED, lock names the verb", () => {
    const h = allKanaClaimed();
    assert.equal(nextLesson(h), null, "kana should be complete");
    // The first patterns attach to a verb; with no verb learned there is nothing
    // teachable, and the lock says exactly what is missing.
    assert.equal(nextGrammarLesson(h, GRAMMAR_PER_LESSON_DEFAULT), null);
    const lock = nextGrammarLock(h, GRAMMAR_PER_LESSON_DEFAULT);
    assert.notEqual(lock, null);
    assert.ok(lock!.hosts.includes("verb"));
  });

  test("kana done and one verb learned → grammar unlocks, no lock", () => {
    const h = kanaAndVerb();
    const opened = nextGrammarLesson(h, GRAMMAR_PER_LESSON_DEFAULT);
    assert.notEqual(opened, null);
    assert.ok(opened!.cards.length > 0);
    assert.equal(nextGrammarLock(h, GRAMMAR_PER_LESSON_DEFAULT), null);
  });

  test("a pattern that needs a な-adjective locks until one is learned", () => {
    // Meet every pattern except 〜ので (node), and learn a verb but no
    // な-adjective. node is the one pattern whose host is a な-adjective, so it is
    // the next fresh pattern and it is locked.
    const base: FactId[] = [
      ...KANA_GROUP_FACTS.flat(),
      wordMeaningFactId(FIRST_VERB.keb),
      ...CURRICULUM_PATTERNS.filter((r) => r.id !== "node").map((r) =>
        patternMeaningFactId(r.id),
      ),
    ];
    const locked = claiming(base);
    assert.equal(nextGrammarLesson(locked, 4), null);
    assert.deepEqual(nextGrammarLock(locked, 4)!.hosts, ["adj-na"]);

    // Learn a な-adjective and node opens as the last teachable pattern.
    const opened = claiming([...base, wordMeaningFactId(FIRST_ADJ_NA.keb)]);
    const lesson = nextGrammarLesson(opened, 4)!;
    assert.equal(lesson.cards.length, 1);
    assert.equal(lesson.cards[0].id, "node");
  });

  test("hasStartedGrammarTrack flips once a pattern is met", () => {
    assert.equal(hasStartedGrammarTrack(kanaAndVerb()), false);
    const met = claiming([
      ...KANA_GROUP_FACTS.flat(),
      wordMeaningFactId(FIRST_VERB.keb),
      patternMeaningFactId(CURRICULUM_PATTERNS[0].id),
    ]);
    assert.equal(hasStartedGrammarTrack(met), true);
  });
});

describe("lessons advance without a cursor", () => {
  test("a met pattern is skipped, not re-taught", () => {
    const first = nextGrammarLesson(kanaAndVerb(), 3)!;
    // Meet the first lesson (claim its patterns' meaning), and the next call moves
    // past them. Keep the learned verb so the next set stays teachable.
    const met = claiming([
      ...KANA_GROUP_FACTS.flat(),
      wordMeaningFactId(FIRST_VERB.keb),
      ...first.cards.map((c) => patternMeaningFactId(c.id)),
    ]);
    const second = nextGrammarLesson(met, 3)!;
    const firstIds = new Set(first.cards.map((c) => c.id));
    for (const card of second.cards) {
      assert.ok(!firstIds.has(card.id), `${card.id} was re-taught`);
    }
    // The position moves forward by the patterns actually met, not by a lesson
    // ordinal: the second lesson starts where the first one ended.
    assert.equal(second.position.from, first.position.to + 1);
  });

  test("null once every pattern is met — the curriculum finishes", () => {
    const all = claiming([
      ...KANA_GROUP_FACTS.flat(),
      ...CURRICULUM_PATTERNS.map((r) => patternMeaningFactId(r.id)),
    ]);
    assert.equal(nextGrammarLesson(all, 4), null);
  });
});

describe("lesson sizing is a count, clamped", () => {
  test("default is a small count (~4)", () => {
    assert.equal(GRAMMAR_PER_LESSON_DEFAULT, 4);
  });
  test("a lesson holds at most `count` patterns", () => {
    const lesson = nextGrammarLesson(kanaAndVerb(), 2)!;
    assert.ok(lesson.cards.length <= 2);
  });
  test("clamp keeps it whole and in range", () => {
    assert.equal(clampGrammarPerLesson(0), 1);
    assert.equal(clampGrammarPerLesson(4.4), 4);
    assert.equal(clampGrammarPerLesson(999), 20);
    assert.equal(clampGrammarPerLesson(NaN), GRAMMAR_PER_LESSON_DEFAULT);
  });
});

// The card counts PATTERNS — "3–7 of 53" — where it used to say "lesson 3" and
// deliberately withhold a total.
describe("the position counts PATTERNS, and the total is the drillable set", () => {
  test("the total is the 53 drillable recipes, not the 81 authored ones", () => {
    // The 28 reference-only recipes are shown on cluster pages and never
    // taught, so counting them would promise 28 lessons that cannot exist —
    // data/grammar/index.ts mints no production fact for them.
    assert.equal(GRAMMAR_CURRICULUM_TOTAL, CURRICULUM_PATTERNS.length);
    assert.equal(GRAMMAR_CURRICULUM_TOTAL, DRILLABLE.length);
    assert.equal(GRAMMAR_CURRICULUM_TOTAL, 53);
    assert.equal(RECIPES.length, 81);
    assert.ok(GRAMMAR_CURRICULUM_TOTAL < RECIPES.length);
  });

  // That every counted pattern is one a lesson can actually reach is already
  // pinned above ("every taught pattern is producible"), which is the same
  // guarantee the denominator rests on — not restated here.

  test("the span is as wide as the lesson, and starts at patterns-met + 1", () => {
    const first = nextGrammarLesson(kanaAndVerb(), 4)!;
    assert.equal(first.position.from, 1);
    assert.equal(first.position.to, first.cards.length);
    assert.equal(first.position.total, GRAMMAR_CURRICULUM_TOTAL);
  });

  test("the total is the same whatever the lesson size — only the span moves", () => {
    const small = nextGrammarLesson(kanaAndVerb(), 2)!;
    const big = nextGrammarLesson(kanaAndVerb(), 8)!;
    assert.equal(small.position.total, big.position.total);
    assert.equal(small.position.to, 2);
    assert.equal(big.position.to, 8);
  });
});
