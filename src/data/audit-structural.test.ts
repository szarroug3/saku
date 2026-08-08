// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/data/audit-structural.test.ts
//
// Structural / computed-data guards for the layers that had no direct test of
// their own: the kana curriculum in characters.ts and dakuten-rows.ts, the
// context-pronunciation notes in kana-context.ts, and the generated pitch,
// primitive-stroke and variant-position tables. node:test + node:assert, run by
// the same hook every other data test uses. No framework, no fixtures — the real
// shipped tables are the subject, because the failure modes here (a mistyped
// romaji, a wrong dakuten pair, a pitch downstep past the end of the word) all
// type-check and would ship silently otherwise.
//
// What each block promises, and why it is HERE and not elsewhere:
//   - characters.ts / dakuten-rows.ts have no direct test; the romaji and the
//     conversion pairs are checked against the app's own converter and a
//     hand-written reference, so kana and its typing layer cannot drift apart.
//   - stroke-order coverage for kanji is already pinned by src/lib/strokes.test.ts
//     and radical structure by src/data/radicals.test.ts; those are NOT repeated.
//   - the one primitive-strokes completeness check the docstring in components.ts
//     promises ("see components.test.ts") had no file behind it — it lives here.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import kanjiComponentsJson from "./generated/kanji-components.json" with { type: "json" };
import pitchJson from "./generated/pitch.json" with { type: "json" };
import {
  CHAR_INDEX,
  KANA_FACTS,
  SETS,
  noteFor,
} from "./characters.ts";
import {
  DAKUTEN_ROWS,
  DAKUTEN_SECTIONS,
  dakutenRowFor,
} from "./dakuten-rows.ts";
import { contextPronunciation } from "./kana-context.ts";
import { PRIMITIVE_STROKES, isPrimitive } from "./components.ts";
import { KANJI, variantOriginal } from "./kanji.ts";
import { VOCAB, vocabRow } from "./vocab.ts";
import { wordPitch } from "./pitch.ts";
import { isKanaOnly, toKana } from "../lib/romaji.ts";

// ---------------------------------------------------------------------------
// Kana romaji — every character in characters.ts must be reachable by TYPING,
// and every romaji it lists must convert back to kana.
// ---------------------------------------------------------------------------

describe("kana romaji round-trips through the app's converter", () => {
  // Walk the real SETS in the same script each glyph belongs to, because the
  // converter emits hiragana or katakana depending on the target.
  function eachChar(fn: (setId: string, kata: boolean, c: string, r: string[]) => void) {
    for (const set of SETS) {
      const kata = set.id === "katakana";
      for (const sec of set.sections) {
        for (const ch of sec.chars) fn(set.id, kata, ch.c, ch.r);
      }
    }
  }

  test("every kana is reachable by at least one of its own romaji, exact glyph", () => {
    // The strong invariant: a learner can TYPE this character. Homophone rows
    // (じ/ぢ, ず/づ, を/お) share romaji and lose the collision to first-wins,
    // but each still keeps one romaji that reaches its exact glyph — di/du/wo —
    // and if it ever didn't, the character would be untypeable in the drill.
    const unreachable: string[] = [];
    eachChar((_set, kata, c, r) => {
      const ok = r.some((one) => toKana(one, { katakana: kata }) === c);
      if (!ok) unreachable.push(`${c} [${r.join(",")}]`);
    });
    assert.deepEqual(unreachable, [], `untypeable kana: ${unreachable.join("; ")}`);
  });

  test("every listed romaji converts to pure kana (nothing left as latin)", () => {
    const stray: string[] = [];
    eachChar((_set, kata, c, r) => {
      for (const one of r) {
        const produced = toKana(one, { katakana: kata });
        if (!isKanaOnly(produced)) stray.push(`${c}: "${one}" -> "${produced}"`);
      }
    });
    assert.deepEqual(stray, [], `romaji left latin behind: ${stray.join("; ")}`);
  });

  test("the documented homophone collisions fold the way romaji.ts says", () => {
    // These are the seven irregular sounds the NOTES table calls out, verified
    // through the converter rather than by eye: し/shi, つ/tsu, ふ/fu, and the
    // ji/zu collisions where the z-row wins and d-row needs di/du.
    assert.equal(toKana("shi"), "し");
    assert.equal(toKana("tsu"), "つ");
    assert.equal(toKana("fu"), "ふ");
    assert.equal(toKana("si"), "し"); // the alternate spelling still lands right
    assert.equal(toKana("ji"), "じ"); // z-row wins the collision
    assert.equal(toKana("zu"), "ず");
    assert.equal(toKana("di"), "ぢ"); // d-row only reachable by di/du
    assert.equal(toKana("du"), "づ");
    assert.equal(toKana("o"), "お"); // vowel row wins over を
    assert.equal(toKana("wo"), "を");
    // yoon and ん, the other places a beginner meets a surprise.
    assert.equal(toKana("ja"), "じゃ");
    assert.equal(toKana("kya"), "きゃ");
    assert.equal(toKana("nn"), "ん");
    // Katakana long mark and small tsu the table doesn't carry.
    assert.equal(toKana("ra-men", { katakana: true }), "ラーメン");
    assert.equal(toKana("kitto"), "きっと");
  });

  test("the seven sound-notes name the sound they correct", () => {
    // A content check on characters.ts NOTES: the call-out for an irregular kana
    // must actually contain the correct sound, so a future edit can't quietly
    // swap し's note to say "si".
    for (const c of ["し", "シ"]) assert.match(noteFor(c) ?? "", /shi/);
    for (const c of ["つ", "ツ"]) assert.match(noteFor(c) ?? "", /tsu/);
    for (const c of ["ふ", "フ"]) assert.match(noteFor(c) ?? "", /fu/);
    for (const c of ["ち", "チ"]) assert.match(noteFor(c) ?? "", /chi/);
    for (const c of ["じ", "ジ"]) assert.match(noteFor(c) ?? "", /ji/);
    assert.match(noteFor("は") ?? "", /wa/); // topic particle
    assert.match(noteFor("へ") ?? "", /\be\b/); // direction particle
  });

  test("kana facts and the char index cover exactly the 214 taught glyphs", () => {
    // 46 base + dakuten/handakuten + yoon, per script. This is the count the
    // rest of the app iterates; pin it so a dropped row is caught.
    assert.equal(KANA_FACTS.length, 214);
    const glyphs = new Set(KANA_FACTS.map((f) => f.glyph));
    assert.equal(glyphs.size, 214, "no duplicate glyphs across the facts");
    for (const g of glyphs) assert.ok(CHAR_INDEX[g], `${g} missing from CHAR_INDEX`);
  });
});

// ---------------------------------------------------------------------------
// Dakuten / handakuten — the conversion the row cards teach must be the real
// voicing, checked against a hand-written base→voiced reference.
// ---------------------------------------------------------------------------

describe("dakuten and handakuten conversions are the real voicings", () => {
  // Fold either script to hiragana so one reference table covers both.
  function toHira(s: string): string {
    return [...s]
      .map((c) => {
        const cp = c.codePointAt(0)!;
        return cp >= 0x30a1 && cp <= 0x30f6 ? String.fromCodePoint(cp - 0x60) : c;
      })
      .join("");
  }

  // か→が, は→ば AND は→ぱ. A hand table, not derived from the data under test.
  const VOICE: Record<string, string[]> = {
    か: ["が"], き: ["ぎ"], く: ["ぐ"], け: ["げ"], こ: ["ご"],
    さ: ["ざ"], し: ["じ"], す: ["ず"], せ: ["ぜ"], そ: ["ぞ"],
    た: ["だ"], ち: ["ぢ"], つ: ["づ"], て: ["で"], と: ["ど"],
    は: ["ば", "ぱ"], ひ: ["び", "ぴ"], ふ: ["ぶ", "ぷ"], へ: ["べ", "ぺ"], ほ: ["ぼ", "ぽ"],
  };

  test("all 50 pairs map a real base to its correct voiced form", () => {
    let pairs = 0;
    const wrong: string[] = [];
    for (const row of DAKUTEN_ROWS) {
      for (const [base, conv] of row.pairs) {
        pairs++;
        const bh = toHira(base);
        const ch = toHira(conv);
        const expected = VOICE[bh];
        if (!expected || !expected.includes(ch)) {
          wrong.push(`${row.id}: ${base}->${conv} (folded ${bh}->${ch})`);
        }
        assert.ok(CHAR_INDEX[base], `${base} not a real kana (${row.id})`);
        assert.ok(CHAR_INDEX[conv], `${conv} not a real kana (${row.id})`);
      }
    }
    assert.equal(pairs, 50, "5 conversions x 5 chars x 2 scripts");
    assert.deepEqual(wrong, [], `wrong voicings: ${wrong.join("; ")}`);
  });

  test("every converted glyph resolves back to its own row, and handakuten only for は-row", () => {
    for (const row of DAKUTEN_ROWS) {
      for (const [, conv] of row.pairs) {
        assert.equal(dakutenRowFor(conv)?.id, row.id, `${conv} should resolve to ${row.id}`);
      }
      // The p-row is the handakuten; every other conversion is the dakuten.
      const mark = row.conv === "p" ? "゜" : "゛";
      assert.equal(row.mark, mark, `${row.id} carries the wrong mark`);
    }
    // ぱ-row bases are the は-row, the only row that takes the circle.
    const pRow = DAKUTEN_ROWS.find((r) => r.conv === "p" && r.setId === "hiragana")!;
    assert.deepEqual(pRow.pairs.map(([b]) => b), [..."はひふへほ"]);
  });

  test("a base kana is not itself a converted glyph", () => {
    for (const base of [..."かきくけこさしすせそはひふへほ"]) {
      assert.equal(dakutenRowFor(base), null, `${base} is a base, not a conversion`);
    }
  });

  test("the dakuten section ids are exactly the converted sections", () => {
    // What lesson.ts skips when walking sections must be the g/z/d/bp sections
    // in both scripts (bp is shared by b and p, so it appears once per script).
    assert.deepEqual(
      [...DAKUTEN_SECTIONS].sort(),
      ["h-bp", "h-d", "h-g", "h-z", "k-bp", "k-d", "k-g", "k-z"],
    );
  });
});

// ---------------------------------------------------------------------------
// Kana context pronunciation — the ん / っ sound-in-stream rules.
// ---------------------------------------------------------------------------

describe("context pronunciation: only ん and っ, with the right sounds", () => {
  test("exactly ん/ン and っ/ッ carry a context rule, nothing else", () => {
    // The four that must carry one. っ/ッ are the sokuon and live outside the
    // base grid, so they are not in CHAR_INDEX — probe them by name.
    for (const g of ["ん", "ン", "っ", "ッ"]) {
      assert.ok(contextPronunciation(g), `${g} should carry a context rule`);
    }
    // No taught base kana OTHER than ん/ン may carry one — a regular kana sounds
    // the same wherever it sits.
    for (const g of Object.keys(CHAR_INDEX)) {
      if (g === "ん" || g === "ン") continue;
      assert.equal(contextPronunciation(g), null, `${g} should have no context rule`);
    }
  });

  test("ん's rule covers the m / ng / n assimilations", () => {
    const ctx = contextPronunciation("ん")!;
    assert.ok(ctx.summary.length > 0);
    const before = ctx.rules.map((r) => r.when).join(" | ");
    const sounds = ctx.rules.map((r) => r.sounds).join(" | ");
    assert.match(before, /b, p, or m/); // the surprising "m" case
    assert.match(sounds, /\bm\b/);
    assert.match(before, /k or g/); // the "ng" case
    assert.match(sounds, /ng/);
    assert.match(before, /t, d, n, s, z, or r/); // the plain "n" case
    // ン points at the same object, so both scripts share one source.
    assert.equal(contextPronunciation("ン"), ctx);
  });

  test("っ's rule is the consonant-doubling sokuon", () => {
    const ctx = contextPronunciation("っ")!;
    assert.match(ctx.summary, /double/i);
    assert.equal(ctx.rules.length, 1);
    assert.match(ctx.rules[0].sounds, /double/i);
    assert.equal(contextPronunciation("ッ"), ctx);
  });
});

// ---------------------------------------------------------------------------
// Pitch accent — generated Kanjium data. Coverage, range and no-drift.
// ---------------------------------------------------------------------------

describe("pitch accent stays in range and only on kept words", () => {
  const PITCH = pitchJson as Record<string, number>;

  // A word's downstep can never fall past its last mora (odaka = mora count).
  // Kana are one mora each EXCEPT the small y-glides (きゃ) and small vowels (ファ)
  // that form a yōon and ride the preceding kana; ー, small っ, and ん each keep
  // their own mora. Mirror scripts/ingest/pitch.mjs so the guard and the ingest
  // measure the same beats.
  function moraCount(reb: string): number {
    let n = 0;
    for (const c of reb) {
      if ("ゃゅょャュョぁぃぅぇぉァィゥェォ".includes(c)) continue;
      n++;
    }
    return n;
  }

  test("every stored downstep is a non-negative integer", () => {
    for (const [w, p] of Object.entries(PITCH)) {
      assert.ok(Number.isInteger(p), `${w} pitch ${p} not an integer`);
      assert.ok(p >= 0, `${w} pitch ${p} negative`);
    }
  });

  // UNIVERSAL INVARIANT, no exceptions. A downstep is measured against the
  // reading the word is TAUGHT with (vocabRow's reb, the one the mark renders
  // on), and can only fall on morae 0..moraCount. The ingest drops any row that
  // violates this — including 面, whose Kanjium pitch 3 was matched on おもて (3
  // morae) but which is taught as めん (2). Nothing here should be out of range.
  test("no downstep falls past the taught reading's last mora", () => {
    const offenders: string[] = [];
    for (const [keb, p] of Object.entries(PITCH)) {
      const row = vocabRow(keb);
      if (!row) continue;
      if (p > moraCount(row.reb)) offenders.push(`${keb}(${row.reb})=${p}`);
    }
    assert.deepEqual(offenders, [], `out-of-range downstep(s): ${offenders.join(", ")}`);
  });

  test("pitch is only stored for words the app actually teaches", () => {
    const kebs = new Set(VOCAB.map((w) => w.keb));
    const orphans = Object.keys(PITCH).filter((k) => !kebs.has(k));
    assert.deepEqual(orphans, [], `pitch for non-vocab words: ${orphans.slice(0, 5).join(", ")}`);
  });

  test("coverage matches the documented Kanjium ingest (8,682 words)", () => {
    assert.equal(Object.keys(PITCH).length, 8682);
  });

  test("spot-checks against the reference values in pitch.ts", () => {
    assert.equal(wordPitch("箸"), 1); // atamadaka
    assert.equal(wordPitch("橋"), 2); // odaka
    assert.equal(wordPitch("端"), 0); // heiban
    assert.equal(wordPitch("__not_a_word__"), null);
  });
});

// ---------------------------------------------------------------------------
// Primitive strokes & variant positions — generated from KanjiVG. The
// completeness guard components.ts's docstring promises, plus variant sanity.
// ---------------------------------------------------------------------------

describe("primitive strokes: complete map, no spares", () => {
  const comps = (kanjiComponentsJson as { comps: Record<string, string[]> }).comps;
  const jouyou = new Set(KANJI.map((k) => k.c));

  // Every distinct component used anywhere in the decomposition.
  const usedComponents = new Set<string>();
  for (const parts of Object.values(comps)) for (const c of parts) usedComponents.add(c);

  test("every non-kanji component has a stroke count", () => {
    const missing = [...usedComponents].filter(
      (c) => !jouyou.has(c) && !isPrimitive(c),
    );
    assert.deepEqual(missing, [], `components with no stroke count: ${missing.join(", ")}`);
  });

  test("no primitive is a spare — every one is actually used", () => {
    const spares = [...PRIMITIVE_STROKES.keys()].filter((c) => !usedComponents.has(c));
    assert.deepEqual(spares, [], `unused primitives: ${spares.join(", ")}`);
  });

  test("no primitive shadows a taught kanji, and all counts are positive", () => {
    for (const [c, n] of PRIMITIVE_STROKES) {
      assert.ok(!jouyou.has(c), `${c} is a jōyō kanji, not a primitive`);
      assert.ok(Number.isInteger(n) && n > 0, `${c} has a bad stroke count ${n}`);
    }
    assert.equal(PRIMITIVE_STROKES.size, 362, "the documented primitive count");
  });
});

describe("variant positions map to real variant glyphs", () => {
  const variants = (kanjiComponentsJson as { variants: Record<string, string> }).variants;
  const positions = (kanjiComponentsJson as { variantPositions: Record<string, string> })
    .variantPositions;
  const VALID = new Set(["left", "right", "top", "bottom", "nyo", "tare"]);

  test("every positioned glyph is a glyph the variants map knows", () => {
    const orphan = Object.keys(positions).filter((g) => !(g in variants));
    assert.deepEqual(orphan, [], `positions for unknown glyphs: ${orphan.join(", ")}`);
  });

  test("every position is one the panel can phrase", () => {
    for (const [g, pos] of Object.entries(positions)) {
      assert.ok(VALID.has(pos), `${g} has an unrenderable position "${pos}"`);
    }
  });

  test("every variant names a non-empty original, reachable through variantOriginal", () => {
    for (const [form, original] of Object.entries(variants)) {
      assert.ok(original.length > 0, `${form} has an empty original`);
      assert.equal(variantOriginal(form), original, `${form} should resolve to ${original}`);
    }
  });
});
