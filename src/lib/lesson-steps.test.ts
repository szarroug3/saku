// Run: node --test --experimental-strip-types \
//        --import ./src/lib/conjugate/test-hooks.mjs src/lib/lesson-steps.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// Two things that a type-check cannot see and that a screenshot would only
// catch once:
//
//   1. The は row takes BOTH marks and is therefore ONE group. It used to be
//      two, and the count the lesson card prints ("group N of M") is derived
//      from the section list, so the merge has to be visible in the curriculum
//      and not just in a label.
//
//   2. A phase intro lands in the right PLACE. The failure mode isn't a crash —
//      it's a dakuten card that shows up in the middle of the k-row, or a walk
//      that says "1 of 5" over six steps. Both are silent, so they are asserted
//      here against the real curriculum rather than a fixture.
//
// Written against the real data, deliberately: the thing under test is that the
// intros are anchored to sections the data file actually has.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SETS, kanaFact, noteFor } from "../data/characters.ts";
import { DAKUTEN_ROWS, dakutenRowFor, hookRuns } from "../data/dakuten-rows.ts";
import { INTRO_AFTER, INTRO_BEFORE } from "../data/phase-intros.ts";
import { wordReadingFactId } from "../data/vocab.ts";
import { KANA_GROUPS, groupOfFact, scriptSoFar, widerScope } from "./lesson.ts";
import { itemsFromFacts } from "./lesson-items.ts";
import { lessonSteps } from "./lesson-steps.ts";

/** A group by its id — the unit the budget hands out. Outside the dakuten
 * phase that id is a section of the data file; inside it, a conversion. */
function group(id: string) {
  const g = KANA_GROUPS.find((x) => x.sectionId === id);
  assert.ok(g, `no group ${id}`);
  return g;
}

describe("the は row is ONE section wearing two marks", () => {
  for (const [set, secId, chars] of [
    ["hiragana", "h-bp", "ばびぶべぼぱぴぷぺぽ"],
    ["katakana", "k-bp", "バビブベボパピプペポ"],
  ] as const) {
    test(`${set}: ば and ぱ are one row of the data file`, () => {
      const section = SETS.find((s) => s.id === set)!.sections.find(
        (s) => s.id === secId,
      );
      assert.ok(section, `no section ${secId}`);
      assert.deepEqual(
        section.chars.map((c) => c.c),
        [...chars],
      );
      // Both marks named in the one label — the contrast IS the teaching point.
      assert.match(section.label, /Dakuten/);
      assert.match(section.label, /Handakuten/);
    });
  }

  test("the separate dakuten-B and handakuten-P sections are gone", () => {
    const ids = SETS.flatMap((s) => s.sections.map((x) => x.id));
    for (const gone of ["h-b", "h-p", "k-b", "k-p"]) {
      assert.ok(!ids.includes(gone), `${gone} should have been merged away`);
    }
  });

  test("…and it is still TWO lessons, one per mark", () => {
    // The merge is about the base row; the teaching unit is the conversion.
    // ば and ぱ share a section and do not share a card or a drill.
    const b = groupOfFact(kanaFact("ば"))!;
    const p = groupOfFact(kanaFact("ぱ"))!;
    assert.notEqual(b.sectionId, p.sectionId);
    assert.equal(b.chars.length, 5);
    assert.equal(p.chars.length, 5);
    assert.equal(p.index, b.index + 1);
  });
});

describe("one grouping at a time — card, drill, card, drill", () => {
  test("each conversion is its own group of five", () => {
    for (const row of DAKUTEN_ROWS) {
      const g = group(row.id);
      assert.equal(g.setId, row.setId);
      assert.equal(g.chars.length, 5);
      assert.deepEqual(
        g.chars,
        row.pairs.map(([, c]) => c),
      );
      // Extended — built from a base row with a mark added, which is what the
      // lesson card's "you already half know these" line reads off.
      assert.equal(g.extended, true);
    }
  });

  test("a conversion lesson is ONE card, not five character cards", () => {
    // The whole point: か・き・く・け・こ are already known, so the lesson is
    // the rule, once — not five new stories.
    const steps = lessonSteps(group("h-conv-z").facts);
    assert.equal(steps.length, 1);
    assert.equal(steps[0].type, "conversion");
    assert.equal(steps[0].type === "conversion" && steps[0].row.conv, "z");
  });

  test("the counter the card prints is counted, not written down", () => {
    for (const set of SETS) {
      const groups = KANA_GROUPS.filter((g) => g.setId === set.id);
      // 10 base + 5 conversions + 12 combos. Not asserted as 27 — asserted as
      // "what the list actually holds", so the counter can never promise a
      // number the list can't produce.
      for (const [i, g] of groups.entries()) {
        assert.equal(g.index, i + 1);
        assert.equal(g.total, groups.length);
      }
      // The dakuten SECTIONS are replaced by the dakuten ROWS, and は's single
      // section becomes two lessons. Everything else is one section, one group.
      const rows = DAKUTEN_ROWS.filter((r) => r.setId === set.id);
      const covered = new Set(rows.map((r) => r.sectionId)).size;
      assert.equal(groups.length, set.sections.length - covered + rows.length);
    }
    // Every character still ships exactly once.
    const all = KANA_GROUPS.flatMap((g) => g.chars);
    assert.equal(new Set(all).size, all.length);
    assert.ok(all.includes("ぱ") && all.includes("ば"));
  });

  test("every converted kana is reachable, and only through its own row", () => {
    for (const row of DAKUTEN_ROWS) {
      for (const [, c] of row.pairs) {
        assert.equal(dakutenRowFor(c)?.id, row.id);
      }
    }
    // A base kana is not a conversion — か is taught as a character.
    for (const c of "かきさしたはアカサ") {
      assert.equal(dakutenRowFor(c), null, `${c} is not a converted kana`);
    }
  });
});

describe("the hook's brackets are notation, never characters", () => {
  test("a bracketed consonant becomes an emphasised run", () => {
    assert.deepEqual(hookRuns("The [k]arate kick"), [
      { text: "The ", hit: false },
      { text: "k", hit: true },
      { text: "arate kick", hit: false },
    ]);
  });

  test("no bracket survives into the rendered text", () => {
    for (const row of DAKUTEN_ROWS) {
      const rendered = hookRuns(row.hook)
        .map((r) => r.text)
        .join("");
      assert.ok(!/[[\]]/.test(rendered), `brackets leaked in ${row.id}`);
    }
  });

  test("an unauthored hook is empty, not a placeholder", () => {
    // Four of the five lines are still being written. The card must render
    // without one rather than with "TODO" on screen.
    assert.deepEqual(hookRuns(""), []);
  });
});

describe("a phase intro opens the phase it introduces", () => {
  for (const [phase, groupId, introId] of [
    ["dakuten", "h-conv-g", "intro-dakuten-hiragana"],
    ["combos", "h-kya", "intro-combo-hiragana"],
    ["dakuten", "k-conv-g", "intro-dakuten-katakana"],
    ["combos", "k-kya", "intro-combo-katakana"],
  ] as const) {
    test(`${groupId}: the ${phase} card is step ONE`, () => {
      const g = group(groupId);
      const steps = lessonSteps(g.facts);
      assert.equal(steps[0].type, "intro");
      assert.equal(steps[0].type === "intro" && steps[0].intro.id, introId);
      // The intro ADDS a step; it never reorders or replaces what follows.
      assert.ok(steps.length > 1);
      assert.notEqual(steps[1].type, "intro");
    });
  }

  test("a combo lesson keeps its characters behind the intro", () => {
    const g = group("h-kya");
    const steps = lessonSteps(g.facts);
    assert.deepEqual(
      steps.slice(1).map((s) => (s.type === "item" ? s.item.glyph : null)),
      g.chars,
    );
    assert.equal(steps.length, itemsFromFacts(g.facts).length + 1);
  });

  test("the phase's SECOND group gets no card — it is said once", () => {
    const steps = lessonSteps(group("h-conv-z").facts);
    assert.ok(steps.every((s) => s.type !== "intro"));
  });
});

describe("the drill's wider scope is cumulative, and script-separate", () => {
  test("'all hiragana so far' is everything up to and including this group", () => {
    const zRow = group("h-conv-z");
    const soFar = scriptSoFar(zRow);
    // All ten base rows (46 characters — や and わ rows are three each), plus
    // が行, plus ざ行. The owner's own example of what "so far" means.
    assert.equal(soFar.length, 46 + 5 + 5);
    assert.ok(soFar.includes(kanaFact("あ")));
    assert.ok(soFar.includes(kanaFact("が")));
    assert.ok(soFar.includes(kanaFact("ざ")));
    // …and nothing from later in the curriculum.
    assert.ok(!soFar.includes(kanaFact("だ")));
    assert.ok(!soFar.includes(kanaFact("きゃ")));
  });

  test("a katakana drill never reaches back into hiragana", () => {
    const soFar = scriptSoFar(group("k-conv-g"));
    assert.ok(soFar.includes(kanaFact("ガ")));
    assert.ok(soFar.includes(kanaFact("ア")));
    assert.ok(!soFar.includes(kanaFact("あ")));
    assert.ok(!soFar.includes(kanaFact("が")));
  });

  test("the first lesson's wider scope is just itself — no empty offer", () => {
    const first = group("h-vowels");
    assert.deepEqual(scriptSoFar(first), first.facts);
  });

  test("the last lesson's wider scope is the whole script", () => {
    const last = group("h-pya");
    const all = KANA_GROUPS.filter((g) => g.setId === "hiragana").flatMap(
      (g) => g.facts,
    );
    assert.deepEqual(scriptSoFar(last), all);
  });

  test("the opening group of each script offers NO fork", () => {
    // "Quiz me on all hiragana so far" and "Quiz me on these only" select the
    // same facts at group one, so the screen would be offering a choice between
    // two identical drills. widerScope returns null and the UI collapses to a
    // plain "Quiz me" — see widerScope() in lesson.ts.
    for (const secId of ["h-vowels", "k-vowels"]) {
      assert.equal(widerScope(group(secId)), null, `${secId} offered a fake fork`);
    }
  });

  test("the second group onward does offer one, and it is genuinely wider", () => {
    // The other half of the claim: the fork collapsing at group one is not the
    // fork being broken everywhere.
    for (const secId of ["h-k", "k-k", "h-conv-z", "h-pya"]) {
      const g = group(secId);
      const wide = widerScope(g);
      assert.ok(wide, `${secId} lost its fork`);
      assert.ok(
        wide.length > g.facts.length,
        `${secId} offered a fork that isn't wider`,
      );
      // It really is a superset — the group itself plus what came before.
      for (const f of g.facts) assert.ok(wide.includes(f));
    }
  });

  test("a fork is offered exactly when the two scopes differ", () => {
    // The invariant behind the rule, stated over the whole curriculum rather
    // than the two ends of it: no group has a null fork while its scopes differ,
    // and none offers a fork while they match. This is what an index check
    // would start getting wrong if the curriculum were ever regrouped.
    for (const g of KANA_GROUPS) {
      const differs = scriptSoFar(g).length !== g.facts.length;
      assert.equal(widerScope(g) !== null, differs, `${g.sectionId} disagrees`);
    }
  });

  test("every group's scope grows and never shrinks", () => {
    for (const setId of ["hiragana", "katakana"]) {
      const groups = KANA_GROUPS.filter((g) => g.setId === setId);
      let prev = 0;
      for (const g of groups) {
        const n = scriptSoFar(g).length;
        assert.ok(n > prev, `${g.sectionId} did not widen the scope`);
        prev = n;
      }
    }
  });
});

describe("long vowels then small っ close the script", () => {
  for (const [secId, longId, sokuonId] of [
    ["h-pya", "intro-long-vowel-hiragana", "intro-sokuon-hiragana"],
    ["k-pya", "intro-long-vowel-katakana", "intro-sokuon-katakana"],
  ] as const) {
    test(`${secId}: both cards trail every shape, long vowels then っ`, () => {
      const g = group(secId);
      // It really is the last group of its script — the claim both cards make.
      assert.equal(g.index, g.total);
      const steps = lessonSteps(g.facts);
      // The two closing cards, in order, with the characters ahead of them.
      const tail = steps.slice(-2);
      assert.deepEqual(
        tail.map((s) => (s.type === "intro" ? s.intro.id : s.type)),
        [longId, sokuonId],
      );
      // THE COUNT INVARIANT. The HUD's "n of N" is steps.length from this very
      // call, so this is really asserting that adding a closing card moved BOTH
      // the render and the count together — the reason this helper exists at all
      // rather than the walk and the HUD each counting for themselves. The
      // after-run is the source of truth for how many cards close the script:
      // hiragana closes on three (punctuation, long vowels, small っ) and
      // katakana on two.
      const after = INTRO_AFTER[secId] ?? [];
      assert.equal(steps.length, g.chars.length + after.length);
      // And nothing crept in among the characters: everything before the whole
      // after-run is still a glyph step, one for one.
      assert.ok(steps.slice(0, -after.length).every((s) => s.type === "item"));
    });
  }

  test("punctuation leads the hiragana close, ahead of the two word marks", () => {
    // Punctuation is script-neutral and rides the front of the hiragana
    // after-run only — it is about the whole sentence a learner can now read,
    // while long vowels and small っ refine single words. It is not in the
    // katakana run, because it is not a per-script rule to be taught twice.
    const h = lessonSteps(group("h-pya").facts).slice(-3);
    assert.deepEqual(
      h.map((s) => (s.type === "intro" ? s.intro.id : s.type)),
      ["intro-punctuation", "intro-long-vowel-hiragana", "intro-sokuon-hiragana"],
    );
    const k = lessonSteps(group("k-pya").facts);
    assert.ok(
      k.every((s) => s.type !== "intro" || s.intro.id !== "intro-punctuation"),
      "punctuation leaked into the katakana run",
    );
  });

  test("long vowels are not drillable — no fact was invented for them", () => {
    // The card teaches a rule. If this ever fails, something turned a rule into
    // a graded question without a word to ask it about; see the note at the
    // bottom of phase-intros.ts.
    const glyphs = new Set(KANA_GROUPS.flatMap((g) => g.chars));
    for (const c of ["ー", "ああ", "うう"]) {
      assert.ok(!glyphs.has(c), `${c} should not be a drillable kana`);
    }
  });
});

describe("a lesson with no intro behaves exactly as before", () => {
  test("the base rows step characters only, one for one", () => {
    for (const secId of ["h-vowels", "h-k", "h-w", "k-vowels", "k-r"]) {
      const g = group(secId);
      const steps = lessonSteps(g.facts);
      assert.equal(steps.length, g.chars.length);
      assert.deepEqual(
        steps.map((s) => (s.type === "item" ? s.item.glyph : null)),
        g.chars,
      );
    }
  });

  test("an empty teach set is still an empty walk", () => {
    assert.deepEqual(lessonSteps([]), []);
  });

  test("a partial group — the budget's usual case — keeps its opening card", () => {
    // The budget hands over only what you have not seen. Opening on が still
    // opens on the dakuten phase, so the intro belongs; and が and ぎ are one
    // conversion, so they are one card between them rather than two steps.
    const steps = lessonSteps([kanaFact("が"), kanaFact("ぎ")]);
    assert.deepEqual(
      steps.map((s) => s.type),
      ["intro", "conversion"],
    );
  });

  test("a set that merely CONTAINS が, without opening on it, gets no intro", () => {
    // Mixed review material is not a phase starting. The anchor is the edge of
    // the teach set, not its membership — but が is still taught as its row.
    const steps = lessonSteps([kanaFact("あ"), kanaFact("が")]);
    assert.deepEqual(
      steps.map((s) => s.type),
      ["item", "conversion"],
    );
  });
});

describe("the irregular sounds are called out where they are met", () => {
  test("each named exception carries a note, in both scripts", () => {
    for (const c of "しちつふじぢづシチツフジヂヅ") {
      assert.ok(noteFor(c), `${c} should carry a call-out`);
    }
  });

  test("the regular majority say nothing", () => {
    for (const c of "あかさたなはまやらわがざだばぱアカサタナハマ") {
      assert.equal(noteFor(c), null, `${c} should have no call-out`);
    }
  });

  test("ぢ and づ explain how they are actually typed", () => {
    // The romaji layer already enforces this — "di" is the only way to reach
    // ぢ. The note is what makes that a rule rather than a bug report.
    assert.match(noteFor("ぢ")!, /"di"/);
    assert.match(noteFor("づ")!, /"du"/);
  });
});

describe("every intro is anchored to a section that exists", () => {
  test("no card is stranded on an id the data file dropped", () => {
    // Intros are anchored to SECTIONS (that is what lesson-steps resolves a
    // glyph to), not to lesson groups — which is why the dakuten intro survived
    // the phase being regrouped by conversion without its key moving.
    const ids = new Set(SETS.flatMap((s) => s.sections.map((x) => x.id)));
    for (const secId of [...Object.keys(INTRO_BEFORE), ...Object.keys(INTRO_AFTER)]) {
      assert.ok(ids.has(secId), `intro anchored to missing section ${secId}`);
    }
  });
});

describe("々 and rendaku ride the first 々 word", () => {
  // These two rules have no kana section to anchor to — they are about kanji and
  // compounds. Their home is the first WORD whose spelling uses 々 (時々, rank
  // 154), the first place both are provably in play at once: ときどき is 々 AND the
  // と → ど voicing rendaku does. See phase-intros.ts and lesson-steps.ts.
  test("時々 opens both cards, in order, ahead of the word", () => {
    const steps = lessonSteps([wordReadingFactId("時々")]);
    assert.deepEqual(
      steps.map((s) =>
        s.type === "intro" ? s.intro.id : s.type === "item" ? s.item.glyph : s.type,
      ),
      ["intro-iteration-mark", "intro-rendaku", "時々"],
    );
  });

  test("a word with no 々 gets neither card", () => {
    // The gate is the glyph, not the subject — an ordinary word teaches nothing
    // about 々, so the walk is the item alone.
    const steps = lessonSteps([wordReadingFactId("先生")]);
    assert.deepEqual(
      steps.map((s) => (s.type === "item" ? s.item.glyph : s.type)),
      ["先生"],
    );
  });

  test("a teach set full of 々 words teaches the pair once", () => {
    // The cards ride the FIRST 々 word only; the rest are plain items, so a
    // review batch of 々 words does not re-explain the rules before each one.
    const steps = lessonSteps([
      wordReadingFactId("時々"),
      wordReadingFactId("様々"),
      wordReadingFactId("我々"),
    ]);
    const intros = steps.filter((s) => s.type === "intro");
    assert.deepEqual(
      intros.map((s) => (s.type === "intro" ? s.intro.id : null)),
      ["intro-iteration-mark", "intro-rendaku"],
    );
    // And they lead the run: the two cards, then the three words in order.
    assert.deepEqual(
      steps.map((s) =>
        s.type === "intro" ? "intro" : s.type === "item" ? s.item.glyph : s.type,
      ),
      ["intro", "intro", "時々", "様々", "我々"],
    );
  });
});

