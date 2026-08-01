// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/grammar-library.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// Grammar folded INTO the Library — patterns are entries, they surface in
// search, and a selected pattern DRILLS rather than falling through to kana's
// rules and rendering no options. Three things have to hold and none is visible
// in one function:
//
//   1. A pattern is a Library entry (browsable, no pronunciation).
//   2. Search finds it three ways the owner asked for — by the pattern, by its
//      English meaning, and by its cluster name — and finds it WELL (the pattern
//      itself surfaces as an exact hit, not buried under containment).
//   3. The drill routes a grammar fact to the grammar question type, not kana's
//      fallback, and grades it against a real answer with real distractors.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  GRAMMAR_SUBJECT,
  classProductionFactId,
  patternEntry,
  patternMeaningFactId,
} from "@/data/grammar";
import { buildDeck, buildMcOptions, checkTyped, questionsFor } from "@/lib/engine";
import { factInfo } from "@/lib/facts";
import { LIB_ENTRIES, clusterOf, libEntry } from "@/lib/library/entries";
import { search } from "@/lib/library/search";

/** A section's entries as a flat set of glyphs, for asserting membership. */
function glyphsIn(sections: ReturnType<typeof search>): Set<string> {
  const out = new Set<string>();
  for (const s of sections) for (const h of s.hits) out.add(h.entry.glyph);
  return out;
}

/** The section a given glyph landed in, or undefined. */
function sectionOf(sections: ReturnType<typeof search>, glyph: string) {
  return sections.find((s) => s.hits.some((h) => h.entry.glyph === glyph))?.why;
}

describe("grammar is a Library kind", () => {
  test("every pattern is a browsable entry with no pronunciation", () => {
    const te = libEntry(patternEntry("te-kara"));
    assert.ok(te, "〜てから resolves as a Library entry");
    assert.equal(te.kind, GRAMMAR_SUBJECT);
    assert.equal(te.glyph, "〜てから");
    assert.equal(te.meanings[0], "after doing X");
    // No reading — a pattern has no single pronunciation, which is what tells
    // the tile/row to omit the 🔊.
    assert.equal(te.readings.length, 0);
  });

  test("patterns lead a meaning search — they are not buried under incidental hits", () => {
    const grammar = LIB_ENTRIES.filter((e) => e.kind === GRAMMAR_SUBJECT);
    assert.ok(grammar.length >= 80, "all recipes are entries");
    // The search tie-break is weight-ascending, so a LOW weight is what puts a
    // pattern in front of a word like "muster" for the query "must".
    const meaningSection = search("must").find((s) => s.why === "meaning");
    assert.ok(meaningSection, "there is a meaning section");
    assert.equal(
      meaningSection.hits[0].entry.kind,
      GRAMMAR_SUBJECT,
      "a pattern is the first thing 'must' surfaces",
    );
  });

  test("a pattern's cluster is reachable for the entry-page link", () => {
    assert.equal(clusterOf(libEntry(patternEntry("nakya"))!), "obligation");
    assert.equal(clusterOf(libEntry(patternEntry("wo"))!), null);
  });
});

describe("search surfaces grammar", () => {
  test('"must" surfaces the obligation family, by meaning', () => {
    const found = glyphsIn(search("must"));
    for (const p of ["〜なければならない", "〜なきゃ", "〜なくちゃ"]) {
      assert.ok(found.has(p), `"must" surfaces ${p}`);
    }
  });

  test('"てから" surfaces 〜てから as an EXACT hit, not buried inside', () => {
    const sections = search("てから");
    assert.ok(glyphsIn(sections).has("〜てから"), "〜てから is in the results");
    // The 〜 is a slot marker nobody types, so the bare form must match as if it
    // were the whole glyph — an exact hit, in front, not an "Appears inside" one.
    assert.equal(sectionOf(sections, "〜てから"), "exact");
  });

  test('"seems" surfaces the whole evidential family via cluster name', () => {
    const found = glyphsIn(search("seems"));
    // そう-hearsay's gloss is "I hear that X" — the word "seems" is nowhere in
    // it, so only the cluster-name index can pull it in.
    for (const p of ["〜そうだ (伝聞)", "〜らしい", "〜かもしれない"]) {
      assert.ok(found.has(p), `"seems" surfaces ${p}`);
    }
  });

  test("restricting to the grammar kind still finds a pattern", () => {
    const found = glyphsIn(search("must", { kind: GRAMMAR_SUBJECT }));
    assert.ok(found.has("〜なければならない"));
  });
});

describe("a selected pattern DRILLS", () => {
  test("a grammar fact routes to the grammar question type, not kana's", () => {
    const mean = patternMeaningFactId("te-kara");
    assert.equal(questionsFor(mean).id, "grammar");
    // te-kara's production is per-ending now; the per-ending fact must route too.
    const prod = classProductionFactId("te-kara", "v5u");
    assert.equal(questionsFor(prod).id, "grammar");
  });

  test("a MEANING question grades the gloss and offers distinct-gloss options", () => {
    const fact = patternMeaningFactId("te-kara");
    assert.ok(checkTyped(fact, "after doing X", "jp2en"), "own gloss is accepted");
    const opts = buildMcOptions(fact);
    assert.ok(opts.length > 1, "meaning is real multiple choice");
    assert.ok(opts.includes(fact), "the answer is on the board");
    // NO co-correct option: every distractor's gloss differs from the answer's,
    // which is what keeps the seven identical "must" patterns off each other's
    // boards.
    const answerGloss = factInfo(fact)!.answers[0];
    for (const o of opts) {
      if (o === fact) continue;
      assert.notEqual(factInfo(o)!.answers[0], answerGloss);
    }
  });

  test("obligation members never distract each other (identical English)", () => {
    const fact = patternMeaningFactId("nakereba-naranai");
    const opts = buildMcOptions(fact);
    const siblings = new Set([
      patternMeaningFactId("nakereba-ikenai"),
      patternMeaningFactId("nakute-wa-naranai"),
      patternMeaningFactId("nakucha"),
      patternMeaningFactId("nakya"),
    ]);
    for (const o of opts) {
      if (o === fact) continue;
      assert.ok(!siblings.has(o), "no same-cluster sibling as a distractor");
    }
  });

  test("a PRODUCTION question grades the engine-built form, in kanji or kana", () => {
    // 〜たい, a non-te verb pattern still baked on the fixed 行く (行きたい). te-form
    // production is per-ending and baked on the ending's godan anchor, exercised
    // in te-endings.test.ts; this checks the generic host-baked production path.
    const fact = classProductionFactId("tai", "v5k");
    // 行きたい is [stem] + たい (行く → 行き), so this proves the engine picks the
    // stem, not just string-concatenation onto the dictionary form.
    assert.ok(checkTyped(fact, "書きたい", "en2jp"), "kanji surface is accepted");
    assert.ok(checkTyped(fact, "かきたい", "en2jp"), "kana reading is accepted");
    assert.ok(!checkTyped(fact, "書くたい", "en2jp"), "the naive (wrong) form is rejected");
  });

  test("PRODUCTION distractors are other forms of the SAME verb", () => {
    const fact = classProductionFactId("tai", "v5k");
    const opts = buildMcOptions(fact);
    // Every option is a form of 行く (the fixed verb), one of which is 行きたい.
    for (const o of opts) {
      assert.match(factInfo(o)!.glyph, /^書/, "options are all forms of 書く");
    }
    assert.ok(opts.includes(fact));
    // And none shares the answer string — no two-right-answers board.
    const answer = factInfo(fact)!.glyph;
    assert.equal(opts.filter((o) => factInfo(o)!.glyph === answer).length, 1);
  });

  test("a built deck of grammar facts asks real questions, never zero-option ones", () => {
    // The bug this guards: a grammar fact used to fall through to kanaQuestions
    // and render with no options. Every grammar fact must now yield either a
    // gradeable typed answer or a multi-option board.
    const facts = [
      patternMeaningFactId("te-kara"),
      // A per-ending te-form production fact is exactly the kind that must not
      // fall back to a zero-answer card, so it is included here on purpose.
      classProductionFactId("te-kara", "v5u"),
      classProductionFactId("tai", "v5k"),
      patternMeaningFactId("nakya"),
    ];
    for (const f of buildDeck(facts, {
      length: "endless",
      limType: "count",
      limCount: 0,
      mode: "drill",
    } as never)) {
      const info = factInfo(f)!;
      // A real answer to grade against (gloss, or built form) — never the empty
      // string the fallback would have shown.
      assert.ok(info.answers[0] && info.answers[0].length > 0);
    }
  });
});
