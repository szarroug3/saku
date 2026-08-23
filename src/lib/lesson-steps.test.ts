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
import { COUNTER_CURRICULUM, COUNTER_FACTS, counterEntry } from "../data/counters.ts";
import { DAKUTEN_ROWS, dakutenRowFor, hookRuns } from "../data/dakuten-rows.ts";
import { kanjiTeachOrder } from "../data/kanji.ts";
import { INTRO_AFTER, INTRO_BEFORE } from "../data/phase-intros.ts";
import { termEntry } from "../data/terms.ts";
import { TSU_INTRO } from "../data/track-intros.ts";
import { radicalMeaningFactId } from "../data/radicals.ts";
import { wordReadingFactId } from "../data/vocab.ts";
import { packLessons } from "./kanji-lesson.ts";
import { KANA_GROUPS, groupOfFact, scriptSoFar, widerScope } from "./lesson.ts";
import { itemsFromFacts } from "./lesson-items.ts";
import { hasOkurigana, hasRendaku, lessonSteps } from "./lesson-steps.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

/** A learner who has met exactly these facts, by the weakest record that
 * counts, "quiz me" — the same shape spine-intros.test.ts's `met` uses. Enough
 * to make a fact non-fresh, which is all `yoonScriptMet`/`startedTracks` ask. */
function met(facts: Iterable<FactId>): HistoryFile {
  const seen: Record<string, number> = {};
  for (const f of facts) seen[f] = 1;
  return { sessions: [], facts: {}, seen: seen as HistoryFile["seen"] };
}

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

// SAK-74: きゃ used to be met with no explanation at all when it wasn't the
// literal first item of its own teach set — the opensOn path above (INTRO_BEFORE
// keyed on "h-kya"/"k-kya") only fires when a lesson's facts happen to START
// exactly there. A learner whose lesson batches an earlier leftover kana ahead of
// きゃ, or whose combos arrive a section late (h-sha, h-pya, …) because the
// budget grouped multiple sections into one lesson, met the combo with zero
// setup. This is the mid-lesson insertion dakuten's `conversion` step already
// had (via `dakutenRowFor` inside the per-item loop) and combos did not.
describe("the yōon card rides the first combo, wherever it lands in the walk", () => {
  test("it leads a combo that is NOT the teach set's first item", () => {
    // A base kana ahead of きゃ — the shape a mixed lesson batch takes. History
    // marks hiragana as an already-open track (met あ elsewhere) so the walk's
    // OWN track-intro cards stay out of the way and this test can check the
    // combo card alone; that history is also what turns the per-item combo
    // check on in the first place — see yoonScriptMet's history gate.
    const g = group("h-kya");
    const leading = kanaFact("か");
    const steps = lessonSteps([leading, ...g.facts], met([kanaFact("あ")]));
    const introIds = steps
      .filter((s) => s.type === "intro")
      .map((s) => (s.type === "intro" ? s.intro.id : null));
    assert.deepEqual(introIds, ["intro-combo-hiragana"]);
    // The base kana leads, the combo card comes before the first combo
    // character, and every character still appears.
    const shape = steps.map((s) =>
      s.type === "item" ? s.item.glyph : s.type === "intro" ? s.intro.id : s.type,
    );
    assert.deepEqual(shape, ["か", "intro-combo-hiragana", ...g.chars]);
  });

  test("it fires once per SCRIPT, not once per combo section", () => {
    // Two combo sections in one teach set (h-kya then h-sha) — only the first
    // combo ever met gets the card, the same "once, not per row" shape dakuten's
    // rowsSeen enforces for conversions.
    const facts = [...group("h-kya").facts, ...group("h-sha").facts];
    const steps = lessonSteps(facts, met([]));
    const combos = steps.filter(
      (s) => s.type === "intro" && s.intro.id === "intro-combo-hiragana",
    );
    assert.equal(combos.length, 1);
  });

  test("katakana gets its own card, independent of hiragana's", () => {
    const facts = [...group("h-kya").facts, ...group("k-kya").facts];
    const steps = lessonSteps(facts, met([]));
    const introIds = steps
      .filter((s) => s.type === "intro")
      .map((s) => (s.type === "intro" ? s.intro.id : null));
    assert.deepEqual(introIds, ["intro-combo-hiragana", "intro-combo-katakana"]);
  });

  test("already met in an earlier lesson — the card does not fire again", () => {
    // h-sha taught on its own, as its own later lesson, with history recording
    // that h-kya (the script's first combo section) was already taught earlier.
    // Without this, h-sha's own teach set would look like the first combo ever,
    // the same false positive the h-pya/k-pya regression test below guards.
    const g = group("h-sha");
    const history = met(group("h-kya").facts);
    const steps = lessonSteps(g.facts, history);
    assert.ok(
      steps.every((s) => !(s.type === "intro" && s.intro.id === "intro-combo-hiragana")),
    );
  });

  test("no history: only the opensOn path fires, same as before this fix", () => {
    // A caller with no history to read (SSR, a test naming one section's teach
    // set) gets the pre-history walk — the same default markedPitch/markedOnyomi
    // already take. h-pya is the LAST hiragana combo section: taught alone, with
    // no history, it must not show the card a second time.
    const steps = lessonSteps(group("h-pya").facts);
    assert.ok(steps.every((s) => s.type !== "intro" || s.intro.id !== "intro-combo-hiragana"));
  });

  test("no double card when the teach set genuinely opens on h-kya, with history", () => {
    // The opensOn path (INTRO_BEFORE) and the per-item path both know about this
    // exact combo; only one card should land.
    const g = group("h-kya");
    const steps = lessonSteps(g.facts, met([]));
    const combos = steps.filter(
      (s) => s.type === "intro" && s.intro.id === "intro-combo-hiragana",
    );
    assert.equal(combos.length, 1);
    assert.equal(steps[0].type, "intro");
  });

  test("a combo item still gets its own character card behind the concept card", () => {
    // Unlike dakuten's conversion (which REPLACES the row's item steps), yōon
    // has no per-combo hook — each combo is still a real new shape to drill, so
    // it keeps its ordinary "item" step. The concept card only adds a step, the
    // same non-destructive shape the other word/section-gated intros use.
    const g = group("h-kya");
    const steps = lessonSteps(g.facts, met([]));
    const itemGlyphs = steps
      .filter((s) => s.type === "item")
      .map((s) => (s.type === "item" ? s.item.glyph : null));
    assert.deepEqual(itemGlyphs, g.chars);
  });
});

describe("the particle reading rule — は/へ/を change sound as particles", () => {
  test("the rule card opens the は row, ahead of は itself", () => {
    const g = group("h-h");
    const steps = lessonSteps(g.facts);
    assert.equal(steps[0].type, "intro");
    assert.equal(
      steps[0].type === "intro" && steps[0].intro.id,
      "intro-particle-reading",
    );
    // It ADDS a step; は and the rest of the row follow untouched.
    assert.notEqual(steps[1].type, "intro");
    assert.deepEqual(
      steps.slice(1).map((s) => (s.type === "item" ? s.item.glyph : null)),
      g.chars,
    );
  });

  test("the rule card names all three readings and the day-one word", () => {
    const g = group("h-h");
    const steps = lessonSteps(g.facts);
    const card = steps[0].type === "intro" ? steps[0].intro : null;
    const prose = (card?.body ?? []).map((p) => p.text).join(" ");
    assert.match(prose, /は is normally “ha”.*read “wa”/);
    assert.match(prose, /へ is normally “he”.*read “e”/);
    assert.match(prose, /を is only ever used for this job.*read “o”/);
    assert.match(prose, /私は/);
    // The reading rule is not an em-dash sentence, and never teaches "wo".
    assert.ok(!prose.includes("—"), "no em dashes in learner copy");
    assert.ok(!/\bwo\b/i.test(prose), "を is /o/, never wo");
  });

  test("は and へ carry both readings on their own cards; を is untouched", () => {
    // Reinforcement, so a learner who meets は later reads the same rule the
    // opening card taught. を already teaches its particle role on its mnemonic
    // card (mnemonics.ts), so it gets no NOTES entry here.
    const ha = noteFor("は") ?? "";
    assert.match(ha, /"ha"/);
    assert.match(ha, /"wa"/);
    const he = noteFor("へ") ?? "";
    assert.match(he, /"he"/);
    assert.match(he, /"e"/);
    assert.equal(noteFor("を"), null);
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
    // は and へ are deliberately absent: they now carry the particle-reading
    // note (は ha/wa, へ he/e), so they are no longer in the silent majority.
    // See the particle-reading describe block above.
    for (const c of "あかさたなまやらわがざだばぱアカサタナハマ") {
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

describe("々 and rendaku each ride the first word that shows them", () => {
  // Neither rule has a kana section to anchor to — they are about kanji and
  // compounds — so each rides the first WORD that puts it on screen, and the two
  // are decoupled: 々 fires on the first word spelled with 々, rendaku on the
  // first word that actually voices at a seam. Those are different words: rendaku
  // first shows at 仕事 (し + こと → しごと, rank 22), long before any 々 word, so
  // 々 no longer drags rendaku in with it. See phase-intros.ts / lesson-steps.ts.
  test("時々 opens the iteration card alone (its repeat is not rendaku)", () => {
    // 時々's align stores the repeat as already-voiced (どき/どき), so there is no
    // unvoiced-to-voiced seam for hasRendaku to see: it is a 々 word, not a
    // rendaku one.
    const steps = lessonSteps([wordReadingFactId("時々")]);
    assert.deepEqual(
      steps.map((s) =>
        s.type === "intro" ? s.intro.id : s.type === "item" ? s.item.glyph : s.type,
      ),
      ["intro-iteration-mark", "時々"],
    );
  });

  test("仕事 opens the rendaku term page alone (no 々)", () => {
    // Rendaku is taught on its term page now, so its step reads out as the
    // rendaku entry id rather than the old intro id.
    const steps = lessonSteps([wordReadingFactId("仕事")]);
    assert.deepEqual(
      steps.map((s) =>
        s.type === "intro"
          ? s.intro.id
          : s.type === "term"
            ? String(s.entry)
            : s.type === "item"
              ? s.item.glyph
              : s.type,
      ),
      [String(termEntry("rendaku")), "仕事"],
    );
  });

  test("a plain word gets neither card", () => {
    // The gate is the spelling, not the subject — an ordinary word teaches
    // nothing about either rule, so the walk is the item alone.
    const steps = lessonSteps([wordReadingFactId("先生")]);
    assert.deepEqual(
      steps.map((s) => (s.type === "item" ? s.item.glyph : s.type)),
      ["先生"],
    );
  });

  test("in one set each card fires once, on its own first word", () => {
    // 時々 opens the iteration card (it has 々 but does not voice); 様々 opens the
    // rendaku card (さま → ざま, the first voicing seam in the set); 我々 has 々 but
    // the card already fired and it does not voice, so it stands plain.
    const steps = lessonSteps([
      wordReadingFactId("時々"),
      wordReadingFactId("様々"),
      wordReadingFactId("我々"),
    ]);
    assert.deepEqual(
      steps.map((s) =>
        s.type === "intro"
          ? s.intro.id
          : s.type === "term"
            ? String(s.entry)
            : s.type === "item"
              ? s.item.glyph
              : s.type,
      ),
      ["intro-iteration-mark", "時々", String(termEntry("rendaku")), "様々", "我々"],
    );
  });
});

describe("the つ counter intro rides the first つ-counter item", () => {
  test("fires once, immediately before ひとつ, in the full counters curriculum", () => {
    // The full counters curriculum opens on its track term page ("counter"),
    // then every つ form in COUNTER_CURRICULUM order (ひとつ…とお), then the one
    // TAIL form (二十歳, counter 歳). TSU_INTRO must land exactly once, right
    // before ひとつ, the first item whose counterForm().counter is "つ", and
    // must not fire again on any later つ item, or on 二十歳. The track's own
    // term step only fires with a history to gate it against, the same "no
    // history, no track card" default the other TRACK_TERM_INTROS tracks take
    // (see track-intros.test.ts's BLANK), so a blank history opens the track here.
    const BLANK: HistoryFile = { sessions: [], facts: {} };
    const steps = lessonSteps(
      COUNTER_FACTS.map((f) => f.id),
      BLANK,
    );
    // Every non-つ form after ひとつ…とお — just 二十歳 now (SAK-163 round 4):
    // day-of-month and month-of-year are generative categories, gated by their
    // own MARKER pseudo-fact, so they never appear in COUNTER_FACTS/
    // COUNTER_CURRICULUM at all and cannot show up in a walk built from facts
    // the way this test builds one. Their rule card is exercised by the
    // generative-marker branch instead (see counter-categories.test.ts and
    // day-month-construction.test.ts's "the lesson rule card is now DERIVED"),
    // not by this fact-driven walk.
    const afterTsu: string[] = [];
    for (const f of COUNTER_CURRICULUM.filter((form) => form.counter !== "つ")) {
      afterTsu.push(f.glyph);
    }
    assert.deepEqual(
      steps.map((s) =>
        s.type === "intro"
          ? s.intro.id
          : s.type === "term"
            ? String(s.entry)
            : s.type === "item"
              ? s.item.glyph
              : s.type,
      ),
      [
        String(termEntry("counter")),
        TSU_INTRO.id,
        ...COUNTER_CURRICULUM.filter((f) => f.counter === "つ").map((f) => f.glyph),
        ...afterTsu,
      ],
    );
  });

  test("a walk with no つ item gets no card", () => {
    // 二十歳 alone (counter 歳, not つ) proves the check is the real counterForm
    // lookup and not a glyph/kana pattern match: the form is plain kanji, no つ
    // in sight, and the card must not fire.
    const tail = COUNTER_CURRICULUM.find((f) => f.glyph === "二十歳")!;
    const tailEntry = counterEntry(tail);
    const facts = COUNTER_FACTS.filter((f) => f.entry === tailEntry);
    const steps = lessonSteps(facts.map((f) => f.id));
    assert.ok(
      !steps.some((s) => s.type === "intro" && s.intro.id === TSU_INTRO.id),
      "TSU_INTRO should not fire for a non-つ counter",
    );
  });
});

// The combined radical/kanji track, at the walk layer. The packing tests
// (kanji-lesson.test.ts) prove a group's FACTS come out radical-before-kanji;
// these prove the last hop the session actually renders — lessonSteps turning
// those facts into steps — keeps a radical-only shape's step ahead of the kanji
// that uses it, and does not conjure a second step for a both-role character
// that is taught once as its kanji. This is the layer the walk reads (session
// page → lessonSteps(session.teach)), so it is where the owner's "I'm not seeing
// the radical intro before the kanji intro" is either true or false.
describe("a mixed radical/kanji set steps the radical ahead of its kanji", () => {
  const ORDER = kanjiTeachOrder("everyday");
  // Pinned to a 6–12 budget: these assert the packer's hand-worked set
  // compositions (人 大 日 一 first, 气 气 山 as the first woven set), which are a
  // function of the packing granularity, not the shipped config default (5–7).
  const GROUPS = packLessons(ORDER, { min: 6, max: 12 });

  test("the first woven-radical set walks 气 before 気 (everyday, 6–12 budget)", () => {
    // The earliest set that carries a radical-only shape. Under the everyday
    // order and a 6–12 budget that set opens 气 気 山: 气 (steam) is the
    // radical 気 (spirit) is built around, and it has no card of its own anywhere
    // else, so the walk is where the learner meets it — immediately before 気.
    // (乙 乞 are worded kanji in their own right and pack a set earlier, with 不;
    // only the radical-only 气 is welded to 気.)
    const target = GROUPS.find((g) => g.items.some((it) => it.kind === "radical"));
    assert.ok(target, "some everyday set weaves in a radical-only shape");
    const steps = lessonSteps(target.facts);
    assert.deepEqual(
      steps.map((s) =>
        s.type === "item" ? `${s.item.kind}:${s.item.glyph}` : `${s.type}:${s.key}`,
      ),
      ["radical:气", "kanji:気", "kanji:山"],
    );
  });

  test("every set: each radical step precedes the kanji step it feeds", () => {
    // The general invariant, over the whole curriculum: within a set, a radical
    // item never steps after a kanji item. A radical is woven in only ahead of a
    // kanji that uses it, so a radical trailing every kanji in its set would be a
    // component taught after the shape it builds — the one thing the weave forbids.
    for (const g of GROUPS) {
      const steps = lessonSteps(g.facts).filter((s) => s.type === "item");
      const lastRadical = steps.map((s) => s.type === "item" && s.item.kind).lastIndexOf("radical");
      if (lastRadical === -1) continue;
      const firstKanji = steps.map((s) => s.type === "item" && s.item.kind).indexOf("kanji");
      assert.ok(
        firstKanji === -1 || lastRadical < steps.length - 1,
        `set ${g.index} ends on a radical step with no kanji after it`,
      );
    }
  });

  test("a both-role first set is four kanji steps, no separate radical step", () => {
    // The owner's "first set" confusion, pinned. 人 大 日 一 are each a Kangxi
    // radical AND a jōyō kanji; the dedup teaches each once, as the kanji, so the
    // walk is four kanji steps and NOT eight. The radical role rides the card's
    // own "Radical · Kanji" label (see character-role.ts / RoleBadge), not a
    // duplicate step for the same glyph.
    const first = GROUPS[0];
    assert.deepEqual(first.chars, ["人", "大", "日", "一"]);
    const steps = lessonSteps(first.facts);
    assert.deepEqual(
      steps.map((s) => (s.type === "item" ? `${s.item.kind}:${s.item.glyph}` : s.type)),
      ["kanji:人", "kanji:大", "kanji:日", "kanji:一"],
    );
  });

  test("the radical step teaches the radical's own meaning fact", () => {
    // The step must carry the radical's own fact (radical:气 meaning) — the drill
    // and the walk read the same fact, so the shape shown and the meaning asked
    // stay one thing.
    const target = GROUPS.find((g) => g.items.some((it) => it.kind === "radical"))!;
    const steps = lessonSteps(target.facts);
    const rad = steps.find((s) => s.type === "item" && s.item.kind === "radical");
    assert.ok(rad && rad.type === "item");
    assert.deepEqual(rad.item.facts, [radicalMeaningFactId(rad.item.glyph)]);
  });
});

// THE THREE CONCEPT CARDS MOVED OUT. "What a radical is", "What kanji are" and
// "What this track teaches" used to be gated here on a subject nobody had
// touched. On one ordered curriculum they are anchored to the first item that
// plays each role instead, and the whole story of when they fire is pinned in
// src/lib/spine-intros.test.ts, against the lessons the app actually ships.

describe("hasRendaku reads voicing off a word's align", () => {
  test("flags a word whose non-first element voices at the seam", () => {
    // 仕事 し + こと → しごと (こ → ご), 手紙 て + かみ → てがみ (か → が), 言葉
    // こと + は → ことば (は → ば), 人々 ひと + ひと → ひとびと (ひ → び), 様々 さま +
    // さま → さまざま (さ → ざ).
    for (const w of ["仕事", "手紙", "言葉", "人々", "様々"]) {
      assert.equal(hasRendaku(w), true, w);
    }
  });

  test("does not flag a word with no voicing seam", () => {
    // 先生 せんせい reads straight; 我々 われわれ repeats without voicing; 時々's
    // repeat is stored already voiced (どき/どき), so there is no unvoiced base to
    // detect a shift against.
    for (const w of ["先生", "我々", "時々"]) {
      assert.equal(hasRendaku(w), false, w);
    }
  });
});

describe("hasOkurigana reads a kanji stem with a kana tail", () => {
  test("a kanji followed by a hiragana tail is okurigana", () => {
    // The four the phase-intro copy is written on: a verb, an い-adjective, a
    // counter and a godan verb. All are one kanji plus a trailing kana.
    for (const w of ["生きる", "高い", "一つ", "言う"]) {
      assert.ok(hasOkurigana(w), `${w} carries a kana tail`);
    }
  });

  test("pure kana and tail-less kanji are not okurigana", () => {
    // No kanji at all (これ, katakana), or a kanji with nothing hiragana after
    // it (先生), or only 々 after the kanji (時々 — that is the iteration mark, a
    // different gate). None of these is a kana tail on a kanji.
    for (const w of ["これ", "ラーメン", "先生", "日本", "々", "時々"]) {
      assert.ok(!hasOkurigana(w), `${w} is not okurigana`);
    }
  });

  test("a hiragana in FRONT of the kanji does not count", () => {
    // The tail has to come after the kanji. お茶 leads with a hiragana and ends
    // on the kanji, so there is no trailing kana to teach.
    assert.ok(!hasOkurigana("お茶"));
    // …but a lead hiragana does not blind it to a real tail later.
    assert.ok(hasOkurigana("お書き"));
  });
});

describe("okurigana words no longer fire intro cards in the word walk", () => {
  // The three okurigana cards (intro, moving, fixed) now live in grammar lesson 1
  // (LESSON_PRENOMINAL_FORM) as pages 2–4. The word walk emits the word alone.
  const label = (s: ReturnType<typeof lessonSteps>[number]) =>
    s.type === "intro" ? s.intro.id : s.type === "item" ? s.item.glyph : s.type;

  test("言う gets no okurigana cards in the word walk", () => {
    const steps = lessonSteps([wordReadingFactId("言う")]);
    assert.deepEqual(steps.map(label), ["言う"]);
    assert.ok(
      !steps.some((s) => s.type === "intro" && s.intro.id.startsWith("intro-okurigana")),
      "an okurigana card fired in the word walk",
    );
  });

  test("a batch of okurigana words emits no okurigana intro cards", () => {
    const steps = lessonSteps(
      ["生きる", "高い", "言う"].map(wordReadingFactId),
    );
    assert.ok(
      !steps.some((s) => s.type === "intro" && s.intro.id.startsWith("intro-okurigana")),
      "an okurigana card fired in the word walk",
    );
    assert.deepEqual(steps.map(label), ["生きる", "高い", "言う"]);
  });

  test("a word with no kana tail still gets no okurigana card", () => {
    const steps = lessonSteps([wordReadingFactId("先生")]);
    assert.deepEqual(steps.map(label), ["先生"]);
  });
});

