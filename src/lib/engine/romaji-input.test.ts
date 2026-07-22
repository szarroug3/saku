// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/engine/romaji-input.test.ts
//
// WHEN A TYPED BOX CONVERTS ROMAJI TO KANA, AND WHY IT IS NOT A DIRECTION.
//
// The drill used to convert whenever `dir === "en2jp"`. That is wrong in both
// directions at once. It left a jp2en typed card — a kanji reading, a word
// reading, a grammar production — as a latin box, so a learner with no Japanese
// keyboard could not answer it at all. And the obvious repair, converting on
// every typed card, breaks the four card kinds whose answer is ENGLISH: type
// "life" on a kanji meaning card, watch it become らいふ, get marked wrong. That
// is the same failure as the P0 this branch fixes, just arriving through the
// keyboard instead of the grader.
//
// The axis is the (fact, direction) pair, and the question it answers is "is
// the expected answer written in Japanese". `answerIsJapanese` is the one place
// that is decided, and this file is the table of what it decides.
//
// THE OWNER'S CONDITION on granting conversion: "so long as it's not going to
// let them answer the question by typing the question, like we had with the
// kana". That is not assumed here, it is asserted — and asserted against the
// CONVERTED prompt, since conversion changes what typing the prompt produces.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_SUBJECT, kanaFact } from "@/data/characters";
import { GRAMMAR_SUBJECT, patternMeaningFactId, patternProductionFactId } from "@/data/grammar";
import { KANJI_SUBJECT, meaningFactId, readingFactId } from "@/data/kanji";
import { VOCAB_SUBJECT, wordMeaningFactId, wordReadingFactId } from "@/data/vocab";
import { ALL_FACTS, factInfo } from "@/lib/facts";
import { toKana } from "@/lib/romaji";
import { answerIsJapanese, en2jpTypeable, questionsFor, type GrammarVehicle } from "./question";
import type { Direction, FactId } from "@/types";

const DIRS: Direction[] = ["jp2en", "en2jp"];

const TABERU: GrammarVehicle = { surface: "食べる", kana: "たべる", cls: "v1" };

describe("the seven card kinds", () => {
  // One row per line of the ruling. Each names a real fact, so a re-cut of the
  // data that removes the fact fails here rather than silently testing nothing.
  const ROWS: [string, FactId, Direction, boolean][] = [
    ["kanji reading (せい)", readingFactId("生", "先生"), "jp2en", true],
    ["word reading (せんせい)", wordReadingFactId("先生"), "jp2en", true],
    ["grammar production (行ってから)", patternProductionFactId("te-kara"), "jp2en", true],
    ["kana (a)", kanaFact("あ"), "jp2en", false],
    ["kanji meaning (life)", meaningFactId("生"), "jp2en", false],
    ["word meaning (teacher)", wordMeaningFactId("先生"), "jp2en", false],
    ["grammar meaning (after doing X)", patternMeaningFactId("te-kara"), "jp2en", false],
  ];

  for (const [name, fact, dir, want] of ROWS) {
    test(`${name} ${want ? "converts" : "does NOT convert"}`, () => {
      assert.ok(factInfo(fact), `no such fact: ${fact}`);
      assert.equal(answerIsJapanese(fact, dir), want);
    });
  }

  test("en2jp is Japanese by construction, for every subject", () => {
    // The direction's definition is "produce the Japanese", so there is nothing
    // to decide on that side and no subject may disagree.
    const bad = ALL_FACTS.filter((f) => !answerIsJapanese(f, "en2jp"));
    assert.deepEqual(bad, []);
  });

  test("jp2en splits on readings vs meanings, with no ragged middle", () => {
    // Every fact of a kind agrees with every other fact of that kind. A mixed
    // kind would mean the predicate was reading something incidental.
    const byKind = new Map<string, Set<boolean>>();
    for (const f of ALL_FACTS) {
      const info = factInfo(f);
      if (!info) continue;
      const kind = `${info.subject}/${f.replace(/^[^:]*:/, "").replace(/^.*?\//, "").replace(/@.*$/, "")}`;
      (byKind.get(kind) ?? byKind.set(kind, new Set()).get(kind)!).add(
        answerIsJapanese(f, "jp2en"),
      );
    }
    const ragged = [...byKind.entries()].filter(([, v]) => v.size > 1).map(([k]) => k);
    assert.deepEqual(ragged, []);

    // And the split falls exactly where the ruling puts it: a card that asks
    // for a READING or a PRODUCTION converts, a card that asks for a MEANING
    // does not. (Transitivity is fixedDir en2jp and mcOnly, so it is never a
    // jp2en typed box at all; it is listed here only because it has facts.)
    const converts = [...byKind.entries()].filter(([, v]) => v.has(true)).map(([k]) => k);
    const doesnt = [...byKind.entries()].filter(([, v]) => v.has(false)).map(([k]) => k);
    for (const k of converts) {
      assert.ok(
        /reading|production|^transitivity/.test(k),
        `${k} converts but asks for neither a reading nor a production`,
      );
    }
    for (const k of doesnt) {
      // Kana is the one non-meaning card here, and for the same reason: its
      // jp2en answer is the romaji itself, so converting the box would take the
      // answer away.
      //
      // Keigo is a MEANING card by nature: a recognition item's answer is the
      // English gloss with its register ("eat / drink (honorific)"), so it does
      // not convert, exactly like the other meaning cards. Its fact-id side is
      // the keigo word's own key rather than the literal "meaning" (a set carries
      // several words under one entry), so it is registered here by subject.
      assert.ok(
        /meaning/.test(k) || k === "kana/reading" || k.startsWith("keigo/"),
        `${k} does not convert but is neither a meaning nor kana`,
      );
    }
    assert.ok(converts.includes("kanji/reading"));
    assert.ok(converts.includes("word/reading"));
    assert.ok(converts.includes("grammar/production"));
    assert.ok(doesnt.includes("kana/reading"), "kana's jp2en answer is romaji");
    assert.ok(doesnt.includes("kanji/meaning"));
    assert.ok(doesnt.includes("word/meaning"));
    assert.ok(doesnt.includes("grammar/meaning"));
  });
});

describe("no card can be answered by typing its own prompt", () => {
  /**
   * Whether the subject refuses a typed answer in THIS direction.
   *
   * `mcOnly` is a plain boolean on this branch. fix/kana-en2jp-mc widens it to
   * `boolean | Direction` so a subject can refuse typing in one direction only,
   * and its own note says to never truthiness-test the result — a Direction is
   * truthy, so `if (qt.mcOnly)` would silently drop every direction of every
   * such subject out of the set below and quietly shrink what this file
   * asserts. Written as an explicit comparison, it is right under both shapes.
   */
  function mcOnlyHere(mcOnly: unknown, dir: Direction): boolean {
    return mcOnly === true || mcOnly === dir;
  }

  /**
   * Every (fact, direction) that the drill would show as a TYPED box, paired
   * with whether that box converts.
   *
   * Typeability is read through `en2jpTypeable`, the same call
   * drill-screen.nextQuestion makes, so this is the set of cards a learner can
   * actually type into rather than a set this test invented. MC cards are out
   * of scope: you cannot type a prompt into a board.
   */
  const TYPED: { fact: FactId; dir: Direction; converts: boolean }[] = (() => {
    const out: { fact: FactId; dir: Direction; converts: boolean }[] = [];
    for (const fact of ALL_FACTS) {
      const qt = questionsFor(fact);
      for (const dir of DIRS) {
        if (mcOnlyHere(qt.mcOnly, dir)) continue;
        if (qt.fixedDir && qt.fixedDir !== dir) continue;
        if (dir === "en2jp" && !en2jpTypeable(fact)) continue;
        out.push({ fact, dir, converts: answerIsJapanese(fact, dir) });
      }
    }
    return out;
  })();

  /** What the learner's box would hold if she read the prompt and typed it
   * back. With conversion on, that is the prompt run through the converter —
   * which is the whole reason this cannot be argued from the old behaviour. */
  function retyped(shown: string, converts: boolean): string {
    return converts ? toKana(shown) : shown;
  }

  function violations(only: (c: (typeof TYPED)[number]) => boolean): string[] {
    const out: string[] = [];
    for (const c of TYPED) {
      if (!only(c)) continue;
      const qt = questionsFor(c.fact);
      const shown = qt.prompt(c.fact, c.dir).glyph;
      if (!shown.trim()) continue;
      for (const given of new Set([shown, retyped(shown, c.converts)])) {
        if (qt.check(c.fact, c.dir, given)) {
          out.push(`${c.fact} ${c.dir}: shows ${shown}, accepts ${given}`);
        }
      }
    }
    return out;
  }

  test("THE RULING'S CONDITION: no jp2en typed card accepts its prompt", () => {
    // The direction this change hands conversion to. Zero, and structurally so:
    // a jp2en prompt is a kanji glyph or a pattern name, romaji can only produce
    // kana, so the box can never hold the thing on screen.
    assert.deepEqual(violations((c) => c.dir === "jp2en"), []);
  });

  test("and no card GAINS one: every card that converts is clean", () => {
    // Stated over the converting set rather than over a direction, because the
    // converting set is what this change actually decides. en2jp cards that
    // convert are included, so this covers the old behaviour too.
    const bad = violations((c) => c.converts && c.dir === "jp2en");
    assert.deepEqual(bad, []);
  });

  test("grammar production accepts neither its vehicle nor a romaji of it", () => {
    // The one converting card whose prompt is sometimes KANA (する, ある), so
    // the structural argument above needs checking rather than asserting: the
    // learner really can type this prompt back. She still cannot answer with it,
    // because a recipe that leaves the vehicle unchanged is not producible.
    const fact = patternProductionFactId("te-kara");
    const qt = questionsFor(fact);
    const ctx = { grammarVehicle: TABERU };
    const shown = qt.prompt(fact, "jp2en", ctx).glyph;
    assert.equal(shown, "食べる");
    for (const given of [shown, toKana(shown), "たべる", "taberu"]) {
      assert.equal(qt.check(fact, "jp2en", given, ctx), false, `accepted ${given}`);
    }
    // And the answer it does want is reachable by typing.
    assert.equal(qt.check(fact, "jp2en", "tabetekara", ctx), true);
  });

  test("the en2jp typed violations are the known ones, and no new shape", () => {
    // NOT a claim that en2jp is clean — it is not, and this change does not
    // touch it. Kana en2jp prompts its own romaji and accepts it back (fixed on
    // fix/kana-en2jp-mc, which makes that card multiple choice), and a handful
    // of loanwords gloss as their own romanization (ramen → ラーメン).
    //
    // Asserted as a SHAPE rather than a count, deliberately: a count would go
    // stale the moment the kana branch merges and would then fail for the right
    // thing being fixed. What must not happen is a NEW kind of self-answering
    // card, and that is exactly what this catches.
    const bad = violations((c) => c.dir === "en2jp");
    const unexplained = bad.filter((line) => {
      const fact = line.split(" ")[0] as FactId;
      const subject = factInfo(fact)?.subject;
      return (
        subject !== KANA_SUBJECT &&
        subject !== VOCAB_SUBJECT &&
        subject !== GRAMMAR_SUBJECT
      );
    });
    assert.deepEqual(
      unexplained,
      [],
      "a NEW shape of self-answering card appeared — investigate, do not re-pin",
    );
    // Kanji is clean in both directions and stays that way.
    assert.deepEqual(
      bad.filter((line) => factInfo(line.split(" ")[0] as FactId)?.subject === KANJI_SUBJECT),
      [],
    );
  });
});
