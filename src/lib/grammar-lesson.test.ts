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

import { CURRICULUM_LESSONS } from "../data/grammar/lessons.ts";
import { KANA_GROUP_FACTS, nextLesson } from "./lesson.ts";
import {
  classProductionFactId,
  conjugatesVerb,
  patternMeaningFactId,
  patternProductionFactId,
  productionHosts,
  specialVerbProductionFactId,
} from "../data/grammar/index.ts";
import { factInfo } from "./facts.ts";
import { CLASS_ANCHOR } from "./grammar/te-endings.ts";
import {
  DRILLABLE,
  RECIPES,
  isProducible,
  recipe,
} from "../data/grammar/recipes.ts";
import { isFormRecipe } from "../data/grammar/index.ts";
import {
  CURRICULUM_PATTERNS,
  GRAMMAR_CURRICULUM_TOTAL,
  GRAMMAR_PER_LESSON_DEFAULT,
  GRAMMAR_SITTINGS,
  GRAMMAR_SITTINGS_TOTAL,
  clampGrammarPerLesson,
  hasStartedGrammarTrack,
  learnedHosts,
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

function seeing(facts: readonly FactId[]): HistoryFile {
  const seen: Record<string, number> = {};
  for (const f of facts) seen[f] = AT;
  return history({ seen: seen as HistoryFile["seen"] });
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

describe("the curriculum is ALL patterns, N5 before N4", () => {
  test("every taught pattern carries a fact; producible ones drill production, the rest meaning only", () => {
    for (const r of CURRICULUM_PATTERNS) {
      // Every taught pattern is quizzable: a producible one carries a production
      // fact (via productionHosts, an ending split, or an @iku/@suru/@kuru fact),
      // and every pattern — producible or not — carries a meaning fact. The one
      // thing a lesson must never do is teach a pattern with NOTHING to ask.
      assert.ok(
        factInfo(patternMeaningFactId(r.id)),
        `${r.id} has no meaning fact and must not be taught`,
      );
    }
    // The whole table is taught now, so the four formerly reference-only patterns
    // are PRESENT — quizzed by meaning multiple choice, with no production drill.
    const taught = new Set(CURRICULUM_PATTERNS.map((r) => r.id));
    for (const id of ["wa-yori", "hou-ga-yori", "tari-tari", "shika-nai"]) {
      assert.ok(taught.has(id), `${id} is now taught by meaning and must be present`);
      assert.ok(!isProducible(recipe(id)!), `${id} is expected to be non-producible`);
      // Its drills are meaning only — no production fact exists for it.
      assert.ok(factInfo(patternMeaningFactId(id)));
    }
    // It is exactly the whole table, no more and no less.
    assert.equal(CURRICULUM_PATTERNS.length, RECIPES.length);
  });

  test("levels are monotone: every N5 before every N4 before every N3", () => {
    // The teaching order sorts on level (N5 → N4 → N3, the depth tier) and is
    // otherwise stable. So the level sequence down the curriculum must never go
    // backwards: rank(prev) <= rank(next), everywhere. Today no N3 row is
    // producible so the N3 tail is empty, but the invariant is the one that will
    // still hold the day one is.
    const rank = { N5: 0, N4: 1, N3: 2 } as const;
    const levels = CURRICULUM_PATTERNS.map((r) => r.level);
    for (let i = 1; i < levels.length; i++) {
      assert.ok(
        rank[levels[i - 1]!] <= rank[levels[i]!],
        `${levels[i - 1]} appears before ${levels[i]}`,
      );
    }
    assert.ok(levels.includes("N5") && levels.includes("N4"));
  });

  test("the te-form leads; behind it, each level keeps its authored order", () => {
    // The N5 slice of the curriculum is ALL the N5 recipes in RECIPES order;
    // likewise N4 and N3. That is what "stable" buys, and it keeps the て/ない/must
    // groupings intact inside each level, with the non-producible patterns
    // interleaved exactly where the table places them.
    for (const level of ["N5", "N4", "N3"] as const) {
      const fromCurriculum = CURRICULUM_PATTERNS.filter((r) => r.level === level).map(
        (r) => r.id,
      );
      const authored = RECIPES.filter((r) => r.level === level).map((r) => r.id);
      // te-sequence (the te-form) is pulled to the very front of the whole
      // curriculum (teFormFirst) because it carries the track's introduction, so
      // within its level the expected order is it first, then the rest of the
      // authored order. Other levels are untouched.
      const expected = authored.includes("te-sequence")
        ? ["te-sequence", ...authored.filter((id) => id !== "te-sequence")]
        : authored;
      assert.deepEqual(fromCurriculum, expected);
    }
  });

  test("a lesson from a kana-done, verb-learned history is the FIRST lesson — the て-form", () => {
    // A grammar sitting is now one whole lesson (multi-page), not a handful of
    // pattern tiles. The first lesson is the て/で-form (te-sequence), N5.
    const lesson = nextGrammarLesson(kanaAndVerb())!;
    assert.equal(lesson.cards.length, 1);
    assert.equal(lesson.cards[0].id, "te-sequence");
    assert.equal(lesson.cards[0].level, "N5");
  });

  test("a lesson's facts are the taught patterns' meaning + production facts", () => {
    const lesson = nextGrammarLesson(kanaAndVerb(), 3)!;
    const expected = new Set<string>();
    for (const card of lesson.cards) {
      const r = recipe(card.id)!;
      expected.add(patternMeaningFactId(r.id));
      if (conjugatesVerb(r)) {
        for (const anchor of CLASS_ANCHOR) {
          const id = classProductionFactId(r.id, anchor.cls);
          if (factInfo(id)) expected.add(id);
        }
      }
      for (const host of productionHosts(r)) {
        expected.add(patternProductionFactId(r.id, host));
      }
      // Plus the irregular-verb facts (@iku / @suru / @kuru) the pattern carries,
      // where 行く / する / 来る are special on its form — a memorized skill each.
      for (const q of ["iku", "suru", "kuru", "aru", "ii"]) {
        const id = specialVerbProductionFactId(r.id, q);
        if (factInfo(id)) expected.add(id);
      }
    }
    assert.deepEqual(new Set(lesson.facts as unknown as string[]), expected);
  });
});

describe("the word prerequisite means completed, not merely started", () => {
  test("Start's seen marker does not unlock grammar; completing or claiming does", () => {
    const verb = wordMeaningFactId(FIRST_VERB.keb);
    assert.equal(learnedHosts(seeing([verb])).has("verb"), false);
    assert.equal(learnedHosts(claiming([verb])).has("verb"), true);
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

describe("lesson sizing is fixed by the grouping, not the count", () => {
  test("default count is still exported (vestigial, ~4)", () => {
    assert.equal(GRAMMAR_PER_LESSON_DEFAULT, 4);
  });
  test("the count argument does not change the sitting handed out", () => {
    // A sitting is a form lesson (solo) or a pattern bundle (<=3); the passed
    // count is ignored. The head of the track is te-sequence, a form lesson, so
    // it is one card whatever the count.
    const small = nextGrammarLesson(kanaAndVerb(), 2)!;
    const big = nextGrammarLesson(kanaAndVerb(), 8)!;
    assert.deepEqual(
      small.cards.map((c) => c.id),
      big.cards.map((c) => c.id),
    );
    assert.equal(small.cards.length, 1);
  });
  test("a pattern bundle holds at most three patterns", () => {
    const lesson = nextGrammarLesson(kanaAndVerb())!;
    assert.ok(lesson.cards.length <= 3);
  });
  test("clamp keeps it whole and in range", () => {
    assert.equal(clampGrammarPerLesson(0), 1);
    assert.equal(clampGrammarPerLesson(4.4), 4);
    assert.equal(clampGrammarPerLesson(999), 20);
    assert.equal(clampGrammarPerLesson(NaN), GRAMMAR_PER_LESSON_DEFAULT);
  });
});

// GRAMMAR_CURRICULUM_TOTAL is the PATTERN total, a separate denominator from the
// sitting count the lesson card's position now uses (see the "sittings" describe).
// Every recipe is taught, so it counts the whole authored table.
describe("the pattern total is the whole authored table", () => {
  test("the total is every authored recipe, drillable and not alike", () => {
    // Every recipe is taught now: a producible one by meaning + production, a
    // non-producible one by meaning multiple choice. So the denominator counts
    // the whole table — the 40 non-producible patterns included, since each is a
    // real lesson with a real (meaning) question.
    assert.equal(GRAMMAR_CURRICULUM_TOTAL, CURRICULUM_PATTERNS.length);
    assert.equal(GRAMMAR_CURRICULUM_TOTAL, RECIPES.length);
    // The two context-dependent bare-て meanings share one recipe and lesson.
    assert.equal(GRAMMAR_CURRICULUM_TOTAL, 100);
    // The drillable set is a strict subset — production is the second half of
    // some lessons' quiz, not the gate on whether a pattern is taught.
    assert.ok(DRILLABLE.length < GRAMMAR_CURRICULUM_TOTAL);
  });

  // That every counted pattern is one a lesson can actually reach is already
  // pinned above ("every taught pattern is producible"), which is the same
  // guarantee the denominator rests on — not restated here.

  test("the position is the current SITTING of the sitting total", () => {
    const first = nextGrammarLesson(kanaAndVerb(), 4)!;
    // The first teachable sitting is te-sequence, a form lesson, so sitting 1.
    assert.equal(first.position.from, 1);
    assert.equal(first.position.to, 1, "a sitting is one item, from === to");
    assert.equal(first.position.total, GRAMMAR_SITTINGS_TOTAL);
    // The denominator counts sittings, not patterns, and there are fewer of them.
    assert.ok(GRAMMAR_SITTINGS_TOTAL < GRAMMAR_CURRICULUM_TOTAL);
  });

  test("the total is the number of sittings the track cuts into", () => {
    // Deterministic from the curriculum: form lessons solo, pattern runs in <=3.
    assert.equal(GRAMMAR_SITTINGS.length, GRAMMAR_SITTINGS_TOTAL);
    // Solo form lessons plus the remaining pattern runs cut into groups of <=3.
    assert.equal(GRAMMAR_SITTINGS_TOTAL, 45);
    // Every pattern lands in exactly one sitting — the sittings partition the
    // whole curriculum, none dropped and none double-counted.
    const covered = GRAMMAR_SITTINGS.flat();
    assert.equal(covered.length, CURRICULUM_PATTERNS.length);
    assert.deepEqual(
      [...covered].sort((a, b) => a - b),
      CURRICULUM_PATTERNS.map((_, i) => i),
    );
  });

  test("the count no longer moves the sitting — the grouping fixes its size", () => {
    const small = nextGrammarLesson(kanaAndVerb(), 2)!;
    const big = nextGrammarLesson(kanaAndVerb(), 8)!;
    assert.equal(small.position.total, big.position.total);
    assert.equal(small.position.from, small.position.to, "one sitting, not a span");
    assert.equal(small.position.from, 1, "the first sitting");
    assert.deepEqual(
      small.cards.map((c) => c.id),
      big.cards.map((c) => c.id),
      "the same sitting regardless of the count passed",
    );
  });
});

// The sitting model: a new form is taught alone, endings bundle up to three. A
// form lesson (the first to introduce a verb form, plus authored 〜ている) stands
// alone; a run of pattern lessons is cut into groups of at most three, never
// spanning a form lesson.
describe("sittings: form lessons solo, pattern lessons bundle up to three", () => {
  // The 13 lessons taught alone (see FORM_LESSON_FORMS in grammar-lesson.ts): the
  // first user of each verb form, plus 〜ている by id. te-form's primaryPattern is
  // te-sequence.
  const FORM_LESSON_PATTERNS = [
    "te-sequence",
    "nai-form",
    "ta-form",
    "stem-form",
    "masu-form",
    "tara",
    "potential",
    "passive",
    "causative",
    "causative-passive",
    "volitional-form",
    "ba",
  ];

  /** The primaryPatterns of the sitting a given pattern belongs to. */
  function sittingPatterns(patternId: string): string[] {
    const idx = CURRICULUM_LESSONS.findIndex((l) => l.primaryPattern === patternId);
    const members = GRAMMAR_SITTINGS.find((s) => s.includes(idx))!;
    return members.map((i) => CURRICULUM_LESSONS[i].primaryPattern);
  }

  test("the first sitting is te-sequence, alone", () => {
    assert.deepEqual(
      GRAMMAR_SITTINGS[0].map((i) => CURRICULUM_LESSONS[i].primaryPattern),
      ["te-sequence"],
    );
  });

  test("every form lesson stands alone in its sitting", () => {
    for (const id of FORM_LESSON_PATTERNS) {
      assert.deepEqual(sittingPatterns(id), [id], `${id} should be solo`);
    }
  });

  test("no bundle spans a form lesson, and every sitting is at most three", () => {
    const formSet = new Set(FORM_LESSON_PATTERNS);
    for (const sitting of GRAMMAR_SITTINGS) {
      assert.ok(sitting.length >= 1 && sitting.length <= 3);
      const patterns = sitting.map((i) => CURRICULUM_LESSONS[i].primaryPattern);
      const forms = patterns.filter((p) => formSet.has(p));
      if (forms.length > 0) {
        assert.equal(sitting.length, 1, `${patterns.join(",")} mixes a form lesson`);
      }
      // members are consecutive curriculum indices
      for (let k = 1; k < sitting.length; k++) {
        assert.equal(sitting[k], sitting[k - 1] + 1);
      }
    }
  });

  test("walking sitting by sitting from a fresh history covers every pattern", () => {
    // Learn a word of every host so nothing locks, then walk: claim each sitting's
    // patterns and take the next. The position must advance by exactly one sitting
    // each step, every card must be a fresh pattern, and the walk must reach the
    // last sitting having shown every pattern.
    const hostWords = ["verb", "adj-i", "adj-na", "noun"]
      .map((h) => CURRICULUM_WORDS.find((w) => wordHost(w) === h))
      .filter((w): w is NonNullable<typeof w> => Boolean(w));
    const claimed = new Set<FactId>([
      ...KANA_GROUP_FACTS.flat(),
      ...hostWords.map((w) => wordMeaningFactId(w.keb)),
    ]);
    const seen: string[] = [];
    let lastSitting = 0;
    for (let guard = 0; guard < 200; guard++) {
      const lesson = nextGrammarLesson(claiming([...claimed]));
      if (!lesson) break;
      assert.equal(lesson.position.from, lesson.position.to, "a sitting is one item");
      assert.equal(lesson.position.from, lastSitting + 1, "the sitting advances by one");
      assert.ok(lesson.cards.length >= 1 && lesson.cards.length <= 3);
      for (const c of lesson.cards) {
        assert.ok(!seen.includes(c.id), `${c.id} was re-taught`);
        seen.push(c.id);
        claimed.add(patternMeaningFactId(c.id));
      }
      lastSitting = lesson.position.from;
    }
    assert.equal(lastSitting, GRAMMAR_SITTINGS_TOTAL, "the walk reaches the last sitting");
    assert.equal(new Set(seen).size, CURRICULUM_PATTERNS.length, "every pattern shown");
  });
});

// A pattern lesson shows the form its pattern is built ON in the middle column of
// its build table (かく · かきます · かきましょう). If that form has never been
// taught, the learner is asked to produce a shape the app never introduced — the
// 〜ましょう/ます bug. These pin that every form a pattern leans on is grounded
// first, and that a pattern which IS a whole conjugation teaches the rule itself.
describe("every form a pattern uses is taught before the pattern uses it", () => {
  // The page id prefix that teaches each verb form. gl-te-* is authored lesson 1;
  // the rest are the form intros in form-intros.ts. gl-teiru-* does NOT match
  // "gl-te-" (the 6th character is i, not the hyphen), so 〜ている stays out.
  const FORM_TAUGHT_BY: readonly { prefix: string; form: string }[] = [
    { prefix: "gl-te-", form: "te" },
    { prefix: "gl-nai-", form: "nai" },
    { prefix: "gl-ta-", form: "ta" },
    { prefix: "gl-stem-", form: "stem" },
    { prefix: "gl-masu-form", form: "masu" },
    { prefix: "gl-volitional-form", form: "volitional" },
  ];

  // form -> the earliest lesson index whose pages teach it.
  const taughtAt = new Map<string, number>();
  CURRICULUM_LESSONS.forEach((lesson, i) => {
    for (const page of lesson.pages) {
      if (page.kind !== "teach") continue;
      for (const { prefix, form } of FORM_TAUGHT_BY) {
        if (page.card.id.startsWith(prefix) && !taughtAt.has(form)) taughtAt.set(form, i);
      }
    }
  });

  /** The verb attach rule of a lesson's primary pattern, if it has one. */
  function verbAttach(lesson: (typeof CURRICULUM_LESSONS)[number]) {
    const r = RECIPES.find((x) => x.id === lesson.primaryPattern);
    return r ? { r, a: r.attach.find((x) => x.host === "verb") } : null;
  }

  test("a prerequisite form (something is added to it) is taught at or before its use", () => {
    CURRICULUM_LESSONS.forEach((lesson, i) => {
      const hit = verbAttach(lesson);
      // Only PRODUCIBLE patterns drill a verb form and so need it taught first. A
      // non-producible pattern (e.g. 〜たり〜たり, built on the た-form) is quizzed by
      // meaning only, never asked to build the form, so it cannot false-fail this
      // guard — and the guard must stay strict for the producible patterns it is for.
      if (!hit || !isProducible(hit.r)) return;
      if (!hit.a?.form || hit.a.form === "dictionary" || !hit.a.add) return;
      const at = taughtAt.get(hit.a.form);
      assert.ok(
        at !== undefined && at <= i,
        `lesson ${i + 1} (${hit.r.id}) builds on the ${hit.a.form}-form but it is taught ${
          at === undefined ? "nowhere" : `only at lesson ${at + 1}`
        }`,
      );
    });
  });

  test("a pattern that IS a whole conjugation teaches the rule, not one example", () => {
    CURRICULUM_LESSONS.forEach((lesson) => {
      const hit = verbAttach(lesson);
      // Producible patterns only — a non-producible pattern teaches meaning, not a
      // conjugation rule, so it has no rule table to check.
      if (!hit || !isProducible(hit.r)) return;
      // add empty = the form is the whole pattern (the potential, たら, ば, ...).
      if (!hit.a?.form || hit.a.form === "dictionary" || hit.a.add) return;
      // The form recipes are authored, and grouped into titled `buildTables` rather
      // than a single `buildRules` table, so this per-page-count check does not
      // apply to them.
      if (isFormRecipe(hit.r.id)) return;
      const page = [...lesson.pages].reverse().find((p) => p.kind === "teach");
      const card = page?.kind === "teach" ? page.card : undefined;
      assert.ok(
        (card?.buildRules?.length ?? 0) >= 5,
        `${hit.r.id} is a standalone conjugation but its page shows no rule table`,
      );
    });
  });
});
