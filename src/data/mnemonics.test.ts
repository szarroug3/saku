// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/mnemonics.test.ts
//
// node:test + native TypeScript stripping. No framework, no new deps — same as
// ingest.test.ts. This file cannot import the .tsx component (the runner strips
// types, not JSX), and it doesn't need to: both call sites — the lesson
// walk-through and the Library entry page — render the block ONLY when
// `getMnemonic(glyph)` is non-null, so the gate IS `getMnemonic`, and that is a
// plain function this can drive directly.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { MNEMONICS, getMnemonic, kanaScript, type SoundLine } from "./mnemonics.ts";

const VOWELS = ["あ", "い", "う", "え", "お"];

// All 46 base hiragana — the full set this table now covers.
const ALL_HIRAGANA = [
  "あ", "い", "う", "え", "お",
  "か", "き", "く", "け", "こ",
  "さ", "し", "す", "せ", "そ",
  "た", "ち", "つ", "て", "と",
  "な", "に", "ぬ", "ね", "の",
  "は", "ひ", "ふ", "へ", "ほ",
  "ま", "み", "む", "め", "も",
  "や", "ゆ", "よ",
  "ら", "り", "る", "れ", "ろ",
  "わ", "を", "ん",
];


test("getMnemonic returns null for a glyph with no entry (hide-when-absent)", () => {
  // The hide-when-absent case the Library page and the teach flow render as
  // NOTHING. No base hiragana hits this any more (all 46 are authored), so the
  // stand-ins are an un-authored katakana and a kanji glyph.
  assert.equal(getMnemonic("タ"), null);
  assert.equal(getMnemonic("生"), null); // a kanji glyph is a valid key with no row
  assert.equal(getMnemonic(""), null);
});

test("all 46 base hiragana resolve to an entry keyed by their own glyph", () => {
  for (const k of ALL_HIRAGANA) {
    const m = getMnemonic(k);
    assert.ok(m, `expected a mnemonic for ${k}`);
    assert.equal(m.glyph, k, `${k} entry should be keyed by its own glyph`);
    assert.ok(m.romaji.length > 0, `${k} should declare a romaji reading`);
    assert.ok(m.analogy.length > 0, `${k} analogy should have prose`);
    assert.ok(m.analogy.some((s) => s.accent), `${k} analogy must accent a sound`);
    // The example points at a real code point in its own word.
    const chars = [...m.example.word];
    assert.ok(
      m.example.hitIndex >= 0 && m.example.hitIndex < chars.length,
      `${k} example hitIndex out of range`,
    );
    // And that code point is the kana this entry teaches.
    assert.equal(chars[m.example.hitIndex], k, `${k} example hitIndex should land on ${k}`);
  }
  assert.equal(Object.keys(MNEMONICS).length, 69, "the 46 base hiragana and twenty-three approved katakana are authored");
});

test("Library-entry / teach-flow gate: authored kana resolve, a non-authored glyph does not", () => {
  // Exactly what app/library/[entry]/page.tsx and
  // components/lesson/lesson-item-view.tsx branch on. Authored kana mount the
  // MnemonicView; a glyph without a row mounts nothing.
  assert.notEqual(getMnemonic("あ"), null);
  assert.notEqual(getMnemonic("か"), null);
  assert.notEqual(getMnemonic("カ"), null);
  assert.equal(getMnemonic("タ"), null);
});

// EVERY kana now gets a CANDIDATE image path, derived from its own romaji. It's
// a candidate: whether the file exists is decided on disk, and the renderers
// fall back to the glyph when it 404s (MnemonicImage / KanaHero's onError). So
// there is nothing per-kana to maintain here — the path is a pure function of
// the romaji, and adding a drawing never touches this test.
test("every hiragana yields the /mnemonics/hiragana/<romaji>.webp path derived from its romaji", () => {
  for (const k of ALL_HIRAGANA) {
    const m = getMnemonic(k);
    assert.ok(m);
    assert.equal(
      m.image,
      `/mnemonics/hiragana/${m.romaji}.webp`,
      `${k} should expose the candidate path keyed by its script + romaji (${m.romaji})`,
    );
    // The romaji goes into the path VERBATIM — the Hepburn spelling (shi/chi/
    // tsu/fu/wo), which is the filename the owner must save. Guard the ones that
    // differ from a naive consonant+vowel guess so the two can't drift.
    assert.ok(m.image!.endsWith(`/${m.romaji}.webp`), `${k} path must use romaji verbatim`);
  }
  // The four irregular readings, pinned: filenames the owner saves as-is,
  // under the hiragana/ prefix.
  assert.equal(getMnemonic("し")!.image, "/mnemonics/hiragana/shi.webp");
  assert.equal(getMnemonic("ち")!.image, "/mnemonics/hiragana/chi.webp");
  assert.equal(getMnemonic("つ")!.image, "/mnemonics/hiragana/tsu.webp");
  assert.equal(getMnemonic("ふ")!.image, "/mnemonics/hiragana/fu.webp");
  assert.equal(getMnemonic("を")!.image, "/mnemonics/hiragana/wo.webp");
});

// Approved katakana image paths carry the katakana/ folder, keeping matching
// hiragana and katakana readings from sharing one filename.
test("kanaScript classifies script by Unicode block, and katakana derives the katakana/ folder", () => {
  assert.equal(kanaScript("か"), "hiragana");
  assert.equal(kanaScript("カ"), "katakana");
  assert.equal(kanaScript("生"), null); // kanji — no script folder
  assert.equal(kanaScript(""), null);
  assert.equal(kanaScript("かa"), null); // multi-code-point, not a single glyph
  assert.equal(getMnemonic("カ")!.image, "/mnemonics/katakana/ka.webp");
  assert.notEqual(getMnemonic("か")!.image, getMnemonic("カ")!.image);
  const approvedKatakana = [
    ["ア", "a"], ["イ", "i"], ["ウ", "u"], ["エ", "e"], ["オ", "o"],
    ["カ", "ka"], ["キ", "ki"], ["ク", "ku"], ["ケ", "ke"], ["コ", "ko"],
    ["サ", "sa"], ["シ", "shi"], ["ス", "su"], ["セ", "se"], ["ソ", "so"],
    ["ツ", "tsu"], ["テ", "te"], ["ト", "to"],
    ["ナ", "na"], ["ニ", "ni"], ["ネ", "ne"],
    ["ヌ", "nu"], ["ノ", "no"],
  ];
  for (const [glyph, romaji] of approvedKatakana) {
    assert.equal(getMnemonic(glyph)!.image, `/mnemonics/katakana/${romaji}.webp`);
    const image = new URL(`../../public/mnemonics/katakana/${romaji}.webp`, import.meta.url);
    assert.ok(existsSync(fileURLToPath(image)));
  }
});

// The eight drawings that ship today must still be on disk under the exact
// romaji-keyed name getMnemonic derives — the guarantee that the migration
// didn't change which kana show a picture. Reads public/mnemonics directly:
// these files ARE the registry now.
test("the eight shipped drawings (a/e/i/ka/ku/sa/u/wa) resolve to files on disk", () => {
  const hiraganaDir = fileURLToPath(new URL("../../public/mnemonics/hiragana/", import.meta.url));
  for (const glyph of ["あ", "え", "い", "か", "く", "さ", "う", "わ"]) {
    const romaji = getMnemonic(glyph)!.romaji;
    assert.equal(getMnemonic(glyph)!.image, `/mnemonics/hiragana/${romaji}.webp`);
    assert.ok(
      existsSync(`${hiraganaDir}${romaji}.webp`),
      `${glyph}: public/mnemonics/hiragana/${romaji}.webp should exist so the drawing shows`,
    );
  }
});

test("every vowel is approved (no draft flag); every た–ん entry is flagged draft", () => {
  for (const v of VOWELS) {
    assert.notEqual(getMnemonic(v)!.draft, true, `${v} is approved, not draft`);
  }
  // あ–そ (through そ) are approved; た onward are draft.
  const approvedThroughSo = ALL_HIRAGANA.slice(0, ALL_HIRAGANA.indexOf("そ") + 1);
  for (const k of approvedThroughSo) {
    assert.notEqual(getMnemonic(k)!.draft, true, `${k} (あ–そ) should not be draft`);
  }
  const draftFromTa = ALL_HIRAGANA.slice(ALL_HIRAGANA.indexOf("た"));
  for (const k of draftFromTa) {
    assert.equal(getMnemonic(k)!.draft, true, `${k} (た–ん) should be flagged draft`);
  }
});

// THE EMPHASIS RULE, encoded.
//
// A SoundLine is an ordered array of spans; `accent: true` paints a span in the
// accent colour, and the accent colour is reserved for the sound. There is no
// "shape" emphasis to express. What the DATA must hold:
//   • every line is a non-empty array of {text, accent?} spans, none empty;
//   • the analogy carries at least one accent span whose text contains the
//     entry's own sound token — the explicit phonetic cue is always present;
//   • the mnemonic MAY carry zero accent spans (a story naming only the shape).
// In-word accent spans need NOT contain the token literally: they carry the
// sound phonetically (the "a" in father is the sound without spelling "ah").
test("every line is a well-formed span array; the analogy always cues its sound", () => {
  for (const [glyph, m] of Object.entries(MNEMONICS)) {
    const token = m.sound.toLowerCase();
    assert.ok(token.length > 0, `${glyph} must declare its accented sound token`);

    const lines: Array<[string, SoundLine]> = [
      ["analogy", m.analogy],
      ["mnemonic", m.mnemonic],
    ];
    for (const [name, line] of lines) {
      assert.ok(Array.isArray(line) && line.length > 0, `${glyph} ${name} should be a non-empty span array`);
      for (const span of line) {
        assert.deepEqual(
          Object.keys(span).sort().filter((k) => k !== "accent" && k !== "href"),
          ["text"],
          `${glyph} ${name} span should be a SoundSpan (text, optional accent, optional href)`,
        );
        assert.equal(typeof span.text, "string");
        assert.ok(span.text.length > 0, `${glyph} ${name} has an empty-text span`);
        if ("accent" in span) {
          assert.equal(typeof span.accent, "boolean", `${glyph} ${name} accent must be a boolean when present`);
        }
        if ("href" in span) {
          assert.ok(
            typeof span.href === "string" && /^https:\/\/\S+$/.test(span.href),
            `${glyph} ${name} href must be an absolute https URL`,
          );
        }
      }
    }

    // The analogy always cues the sound: at least one accent span whose text
    // carries the entry's own token (the explicit "say it like…" phonetic cue).
    assert.ok(
      m.analogy.some((s) => s.accent && s.text.toLowerCase().includes(token)),
      `${glyph} analogy must accent a span carrying the sound "${m.sound}"`,
    );
    // The mnemonic MAY accent nothing — a story that names only the shape.
  }
});

// THE LINK SPAN.
//
// Some sounds have no English equivalent to point at — ら's tapped r is the
// case that forced this — so a span may carry an `href` and become a link to a
// real explanation instead of a fake analogy. Two things must hold: the
// renderer turns such a span into an anchor that leaves the app safely, and the
// accent invariant is unaffected — a linked span can ALSO be the accented sound
// cue, and a line with links still has to cue its sound.
test("an href span renders as a safe anchor, and links don't weaken the accent rule", () => {
  // The renderer. Read as source because node:test strips types, not JSX, so
  // the .tsx cannot be imported here (see this file's header).
  const card = readFileSync(
    fileURLToPath(new URL("../components/lesson/mnemonic-card.tsx", import.meta.url)),
    "utf-8",
  );
  const lineFn = card.slice(card.indexOf("export function Line("), card.indexOf("export function MnemonicCard("));
  assert.ok(lineFn.length > 0, "Line renderer not found in mnemonic-card.tsx");
  assert.match(lineFn, /span\.href/, "Line must branch on span.href");
  assert.match(lineFn, /<a\b/, "an href span must render as an anchor");
  assert.match(lineFn, /href=\{span\.href\}/, "the anchor must carry the span's href");
  assert.match(lineFn, /target="_blank"/, "the link must open in a new tab");
  assert.match(lineFn, /rel="noopener noreferrer"/, "the link must not leak the opener");

  // A span that is BOTH the sound and the link still satisfies the invariant
  // every analogy is held to above.
  const cuesSound = (line: SoundLine, sound: string) =>
    line.some((s) => s.accent && s.text.toLowerCase().includes(sound.toLowerCase()));
  const linked: SoundLine = [
    { text: "There is a guide on " },
    { text: "Tofugu", href: "https://www.tofugu.com/japanese/japanese-r-sound/" },
    { text: " for the " },
    { text: "ra", accent: true, href: "https://www.tofugu.com/japanese/japanese-r-sound/" },
    { text: " sound." },
  ];
  assert.ok(cuesSound(linked, "ra"), "an accented link still cues the sound");
  assert.ok(!cuesSound([{ text: "Tofugu", href: "https://www.tofugu.com/" }], "ra"),
    "an unaccented link is not a sound cue — it cannot stand in for the accent span");

  // And every shipped href is a real absolute URL (shape checked per-span above).
  for (const [glyph, m] of Object.entries(MNEMONICS)) {
    for (const span of [...m.analogy, ...m.mnemonic]) {
      if (span.href) assert.doesNotThrow(() => new URL(span.href!), `${glyph} href must parse`);
    }
  }
});
