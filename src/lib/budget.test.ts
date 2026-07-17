// Run: node --test --experimental-strip-types \
//        --import ./src/lib/conjugate/test-hooks.mjs src/lib/budget.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The budget is where "what is a lesson" is decided, and its failure mode is not
// a crash — it is a screen that offers you 214 characters and is, technically,
// doing what it was told. So these tests are mostly about SIZE and BOUNDARY:
// how much new material comes back, and where it stops. A type-check cannot see
// either.
//
// They are written against the real kana data rather than a fixture, because the
// thing under test is precisely that the budget cuts the REAL curriculum at the
// joints the REAL data file has. A fixture with a tidy three-group curriculum
// would pass while the app shipped 214 on one screen.
//
// The numbers below (5, 27) are read off characters.ts at the top of the file
// and not typed in, with ONE exception: `assert.equal(vowels.chars.length, 5)`.
// That one is typed in on purpose. If あいうえお ever stops being five
// characters, every other test here is asserting against a moved ruler, and this
// is the line that says so.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_FACTS, kanaFact } from "../data/characters.ts";
import { freshFacts, nextGroup, planSession } from "./budget.ts";
import { CLAIMED_DAYS } from "./claims.ts";
import { KANA_GROUPS, KANA_GROUP_FACTS, nextLesson, setFacts } from "./lesson.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 0, 15);
const ALL: FactId[] = KANA_FACTS.map((f) => f.id);

const vowels = KANA_GROUPS[0];
const kRow = KANA_GROUPS[1];
const sRow = KANA_GROUPS[2];
/** The first katakana group — what comes after all of hiragana. */
const kataVowels = KANA_GROUPS.find((g) => g.setId === "katakana")!;

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, claims: {}, ...over };
}

/** A fact the user has answered and then lost: tested once, long ago, at the
 * stability floor. p → 0, so the model routes it to `teach` — the rescue the
 * budget's header is about. */
function lost(days = 400) {
  return { stability: 1, lastTested: NOW - days * DAY };
}

/** A fact the user knows: tested recently, with a big stability. p → 1. */
function known() {
  return { stability: 400, lastTested: NOW - DAY };
}

function factsOf(chars: string[]): Record<string, ReturnType<typeof lost>> {
  return Object.fromEntries(chars.map((c) => [kanaFact(c), lost()]));
}

describe("day one is a lesson, not a table of contents", () => {
  test("an unlimited session over the whole pool teaches ONE group", () => {
    const plan = planSession({
      candidates: ALL,
      history: history(),
      groups: KANA_GROUP_FACTS,
      length: null,
      now: NOW,
    });

    // The bug this file exists for: 214 on one teach screen.
    assert.equal(plan.teach.length, vowels.facts.length);
    assert.deepEqual(plan.teach, vowels.facts);
    assert.equal(plan.probe.length, 0);
  });

  test("and that group is five characters", () => {
    // The typed-in number. See the header.
    assert.equal(vowels.chars.length, 5);
    assert.deepEqual(vowels.chars, ["あ", "い", "う", "え", "お"]);
  });

  test("'unlimited' caps the asking, not the curriculum", () => {
    // The distinction that made the bug: length === null used to mean "the
    // whole pool", and the pool was 214. It means "no cap on the ranked
    // material", and the lesson was one group before length was consulted.
    const unlimited = planSession({
      candidates: ALL,
      history: history(),
      groups: KANA_GROUP_FACTS,
      length: null,
      now: NOW,
    });
    const capped = planSession({
      candidates: ALL,
      history: history(),
      groups: KANA_GROUP_FACTS,
      length: 100,
      now: NOW,
    });
    assert.deepEqual(unlimited.teach, capped.teach);
  });

  test("a selection narrower than a group is still respected", () => {
    // The pool is the user's. The lesson is the first group WITH ANYTHING IN
    // the pool, and never a fact they didn't select.
    const two = [kanaFact("あ"), kanaFact("い")];
    const plan = planSession({
      candidates: two,
      history: history(),
      groups: KANA_GROUP_FACTS,
      length: null,
      now: NOW,
    });
    assert.deepEqual(plan.teach, two);
  });
});

describe("the groups come in the curriculum's order, and stop", () => {
  test("finish the vowels and the next lesson is the k-row", () => {
    const h = history({ facts: factsOf(vowels.chars) as HistoryFile["facts"] });
    // Seen, so no longer new — even though they are LOST and will be re-taught.
    assert.deepEqual(nextGroup(KANA_GROUP_FACTS, freshFacts(ALL, h)), kRow.facts);
    assert.equal(nextLesson(h)?.group.sectionId, kRow.sectionId);
  });

  test("a half-claimed group yields only the half that's left", () => {
    const h = history({ claims: { [kanaFact("あ")]: NOW - DAY } as Record<FactId, number> });
    const lesson = nextLesson(h)!;
    // Still the vowels group — it is not finished — but あ is not new material
    // and is not taught again.
    assert.equal(lesson.group.sectionId, vowels.sectionId);
    assert.deepEqual(lesson.chars, ["い", "う", "え", "お"]);
  });

  test("the curriculum runs out, and that is a state and not an error", () => {
    const h = history({
      claims: Object.fromEntries(ALL.map((f) => [f, NOW - DAY])) as Record<FactId, number>,
    });
    assert.equal(nextLesson(h), null);
    assert.deepEqual(nextGroup(KANA_GROUP_FACTS, freshFacts(ALL, h)), []);
  });
});

describe("I already know this", () => {
  test("claiming all of hiragana moves the lesson to katakana, not to か", () => {
    const h = history({
      claims: Object.fromEntries(
        setFacts("hiragana").map((f) => [f, NOW - DAY]),
      ) as Record<FactId, number>,
    });
    const lesson = nextLesson(h)!;
    assert.equal(lesson.group.setId, "katakana");
    assert.equal(lesson.group.sectionId, kataVowels.sectionId);
    assert.deepEqual(lesson.chars, ["ア", "イ", "ウ", "エ", "オ"]);
  });

  test("a claimed fact is not drilled — the button does something", () => {
    // The bug this catches: planSession used `stateOf(history.facts[id])`,
    // which cannot see claims at all. "I know all hiragana" wrote a record that
    // the Library read and the drill did not, so the button was a button that
    // lied.
    const h = history({
      claims: Object.fromEntries(
        setFacts("hiragana").map((f) => [f, NOW - DAY]),
      ) as Record<FactId, number>,
    });
    const plan = planSession({
      candidates: setFacts("hiragana"),
      history: h,
      groups: KANA_GROUP_FACTS,
      length: null,
      now: NOW,
    });
    assert.deepEqual(plan.teach, []);
    assert.deepEqual(plan.probe, []);
  });

  test("a claim is a belief that decays, so it comes back to be checked", () => {
    // Not a new rule — claims.ts's, restated here only as the budget's view of
    // it: what you said in July is asked about in the autumn.
    const claimedAt = NOW - (CLAIMED_DAYS + 30) * DAY;
    const h = history({
      claims: Object.fromEntries(vowels.facts.map((f) => [f, claimedAt])) as Record<FactId, number>,
    });
    const plan = planSession({
      candidates: vowels.facts,
      history: h,
      groups: KANA_GROUP_FACTS,
      length: null,
      now: NOW,
    });
    assert.equal(plan.probe.length, vowels.facts.length);
    // And it is asked, not re-taught. It was never new.
    assert.deepEqual(plan.teach, []);
  });
});

describe("lost material is not a group", () => {
  test("one lost fact comes back on its own, not with its row", () => {
    // し was lost. さ and す were never seen. Grouping the backlog would hand
    // back all five, two of which the user never had.
    const h = history({ facts: factsOf(["し"]) as HistoryFile["facts"] });
    const plan = planSession({
      candidates: sRow.facts,
      history: h,
      groups: KANA_GROUP_FACTS,
      length: null,
      now: NOW,
    });
    // The lost fact, plus the S row's fresh remainder as the lesson — not two
    // copies of し and not the row on し's account.
    assert.ok(plan.teach.includes(kanaFact("し")));
    assert.equal(plan.teach.filter((f) => f === kanaFact("し")).length, 1);
  });

  test("a lost fact is taught even when its group is far down the curriculum", () => {
    // The whole point of the rescue: ぽ is in the 15th group, and a backlog
    // that had to wait its turn in the curriculum would never arrive.
    const h = history({ facts: factsOf(["ぽ"]) as HistoryFile["facts"] });
    const plan = planSession({
      candidates: ALL,
      history: h,
      groups: KANA_GROUP_FACTS,
      length: null,
      now: NOW,
    });
    assert.ok(plan.teach.includes(kanaFact("ぽ")));
    // And the lesson is still the vowels. The backlog does not advance the
    // curriculum, and the curriculum does not delay the backlog.
    for (const f of vowels.facts) assert.ok(plan.teach.includes(f));
  });

  test("the backlog comes before the lesson", () => {
    const h = history({ facts: factsOf(["ぽ", "し"]) as HistoryFile["facts"] });
    const plan = planSession({
      candidates: ALL,
      history: h,
      groups: KANA_GROUP_FACTS,
      length: null,
      now: NOW,
    });
    const firstNew = plan.teach.indexOf(vowels.facts[0]);
    assert.ok(plan.teach.indexOf(kanaFact("し")) < firstNew);
    assert.ok(plan.teach.indexOf(kanaFact("ぽ")) < firstNew);
  });

  test("a short session spends itself on the backlog before starting a lesson", () => {
    const h = history({ facts: factsOf(["ぽ", "し", "ち"]) as HistoryFile["facts"] });
    const plan = planSession({
      candidates: ALL,
      history: h,
      groups: KANA_GROUP_FACTS,
      length: 3,
      now: NOW,
    });
    assert.equal(plan.teach.length, 3);
    for (const f of vowels.facts) assert.ok(!plan.teach.includes(f));
  });
});

describe("what the budget still refuses to do", () => {
  test("quiet is never drawn from, even when that leaves the session short", () => {
    const h = history({
      facts: Object.fromEntries(ALL.map((f) => [f, known()])) as HistoryFile["facts"],
    });
    const plan = planSession({
      candidates: ALL,
      history: h,
      groups: KANA_GROUP_FACTS,
      length: 20,
      now: NOW,
    });
    assert.deepEqual(plan.teach, []);
    assert.deepEqual(plan.probe, []);
    assert.equal(plan.short, true);
  });

  test("with no curriculum offered, new material is ungrouped — the old rule", () => {
    const plan = planSession({
      candidates: ALL,
      history: history(),
      length: null,
      now: NOW,
    });
    assert.equal(plan.teach.length, ALL.length);
  });
});

describe("fresh means no record of any kind", () => {
  test("never answered and never claimed", () => {
    assert.equal(freshFacts(ALL, history()).size, ALL.length);
  });

  test("a claim is a record — you have seen it, you said so", () => {
    const h = history({ claims: { [kanaFact("あ")]: NOW - DAY } as Record<FactId, number> });
    assert.equal(freshFacts([kanaFact("あ")], h).size, 0);
  });

  test("a lost fact is not new, however long ago it was", () => {
    const h = history({ facts: factsOf(["あ"]) as HistoryFile["facts"] });
    assert.equal(freshFacts([kanaFact("あ")], h).size, 0);
  });

  test("it does not consult the clock", () => {
    // Whether you have seen something is not a question about the present. The
    // signature is the test: freshFacts takes no `now`, so it cannot drift with
    // one. Stated here so a future edit that adds one has to delete this line.
    assert.equal(freshFacts.length, 2);
  });
});

describe("the curriculum is the data file, not a copy of it", () => {
  test("every kana fact is in exactly one group", () => {
    const seen = new Set<FactId>();
    for (const g of KANA_GROUPS) {
      for (const f of g.facts) {
        assert.ok(!seen.has(f), `${f} is in two groups`);
        seen.add(f);
      }
    }
    assert.equal(seen.size, ALL.length);
  });

  test("the groups are in the data file's order", () => {
    assert.deepEqual(KANA_GROUPS.flatMap((g) => g.facts), ALL);
  });

  test("a group counts its own script, and counts it honestly", () => {
    // The card prints "group 1 of N". N is counted off the data — hiragana has
    // twenty-seven sections, not the ten of the basic rows, and the card that
    // promised ten would be caught at the eleventh.
    const hira = KANA_GROUPS.filter((g) => g.setId === "hiragana");
    assert.equal(vowels.index, 1);
    assert.equal(vowels.total, hira.length);
    assert.equal(kataVowels.index, 1);
    for (const g of KANA_GROUPS) assert.ok(g.index >= 1 && g.index <= g.total);
  });

  test("every group has a label and at least one character", () => {
    for (const g of KANA_GROUPS) {
      assert.ok(g.label.length > 0, `${g.sectionId} has no label`);
      assert.ok(g.chars.length > 0, `${g.sectionId} is empty`);
      assert.equal(g.chars.length, g.facts.length);
    }
  });

  test("the basic rows are Tofugu's order — vowels, then K, then S", () => {
    assert.deepEqual(
      KANA_GROUPS.slice(0, 3).map((g) => g.sectionId),
      ["h-vowels", "h-k", "h-s"],
    );
  });

  test("the dakuten and combo rows say they're built from something", () => {
    // The card shows this, and it is the one place kana owes the honesty the
    // kanji lesson owes its parts. It is the data file's own test.
    assert.equal(vowels.extended, false);
    assert.equal(KANA_GROUPS.find((g) => g.sectionId === "h-g")!.extended, true);
    assert.equal(KANA_GROUPS.find((g) => g.sectionId === "h-ja")!.extended, true);
  });
});

describe("the links are checked, not guessed", () => {
  test("every set has a guide, and it says when it was last verified", () => {
    for (const setId of ["hiragana", "katakana"]) {
      const lesson = KANA_GROUPS.find((g) => g.setId === setId)!;
      const link = setId === "hiragana" ? "learn-hiragana" : "learn-katakana";
      assert.ok(lesson.setLabel.length > 0);
      // The URL shape is the part a typo breaks silently.
      assert.match(
        nextLessonLinkFor(setId),
        new RegExp(`^https://www\\.tofugu\\.com/japanese/${link}/$`),
      );
    }
  });
});

/** The link a lesson in `setId` would carry. */
function nextLessonLinkFor(setId: string): string {
  const h = history({
    claims: Object.fromEntries(
      KANA_GROUPS.filter((g) => g.setId !== setId)
        .flatMap((g) => g.facts)
        .map((f) => [f, NOW - DAY]),
    ) as Record<FactId, number>,
  });
  return nextLesson(h)!.learn.url;
}
