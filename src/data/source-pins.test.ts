// Every sourced fact the app teaches, pinned to the file it came from
// (SAK-418).
//
// WHAT THIS IS FOR, AND WHAT IT IS NOT
// ====================================
// The repo already has plenty of tests over this data. Almost all of them check
// SHAPE (a grade is 1-6 or 8), INTERNAL CONSISTENCY (every kanji is filed under
// a real radical) or EQUIVALENCE (the committed cache equals what the code would
// compute today). Those catch a great deal. None of them catches a value that
// changed on its way from the dictionary to the screen: if the transform in
// kanji.ts started dropping the second meaning of every kanji, or a hand-edit
// retyped a reading, every one of those tests would still pass.
//
// So this file makes the one claim they do not: FOR EACH SOURCED FACT KIND, THE
// VALUE THE APP TEACHES EQUALS THE VALUE IN THE FILE IT CAME FROM. It reads the
// generated JSON directly, on the left, and the app's own exported table on the
// right, and compares them.
//
// THE LIMIT, STATED PLAINLY
// =========================
// The raw upstream archives are not in this repo: scripts/ingest/build.py takes
// kanjidic2.xml, JMdict_e and KRADFILE by --src, and grammar.py takes the
// Tatoeba dump the same way. Nothing here can reach them. So the pin is to the
// COMMITTED REDUCTION under src/data/generated, and it covers every step after
// that reduction, which is where the app's own transforms, the hand-written
// override tables and the merges live. The reduction itself stays unpinned, and
// re-running an ingest against a newer upstream is still an unchecked step. See
// docs/content-review-2026-09.md.
//
// A FAILURE HERE IS A CONTENT BUG, NOT A TEST BUG. The fix is to make the app
// serve what the source says, or to record the deliberate difference in the
// pinned table the failing assertion names.

import assert from "node:assert/strict";
import test from "node:test";

import kanjiJson from "./generated/kanji.json" with { type: "json" };
import kanjiComponentsJson from "./generated/kanji-components.json" with { type: "json" };
import readingsJson from "./generated/readings.json" with { type: "json" };
import vocabJson from "./generated/vocab.json" with { type: "json" };
import wordSensesJson from "./generated/word-senses.json" with { type: "json" };
import pitchJson from "./generated/pitch.json" with { type: "json" };
import pitchPairsJson from "./generated/pitch-pairs.json" with { type: "json" };
import radicalEnrichmentJson from "./generated/radical-enrichment.json" with { type: "json" };
import etymologyJson from "./generated/kanji-etymology.json" with { type: "json" };
import etymologyManualJson from "./generated/kanji-etymology-manual.json" with { type: "json" };
import wordExamplesJson from "./generated/word-examples.json" with { type: "json" };

import { KANJI, READINGS } from "./kanji";
import { VOCAB, vocabRow } from "./vocab";
import { wordPitch } from "./pitch";
import { pitchPairsFor } from "./pitch-pairs";
import { RADICALS, bushuName, radicalVariants } from "./radicals";
import { etymologyOf } from "./kanji-etymology";
import { exampleFor } from "./word-examples";

// ---------------------------------------------------------------------------
// KANJIDIC2, via generated/kanji.json.
// ---------------------------------------------------------------------------

interface RawKanji {
  readonly c: string;
  readonly meanings: readonly string[];
  readonly grade: number;
  readonly strokes: number;
  readonly newspaperFreq: number | null;
  readonly comps: readonly string[];
  readonly on: readonly string[];
  readonly kun: readonly string[];
}

const RAW_KANJI = kanjiJson as readonly RawKanji[];
const RAW_BY_C = new Map(RAW_KANJI.map((k) => [k.c, k]));

test("kanji.json pins the character set the app teaches", () => {
  assert.deepEqual(
    KANJI.map((k) => k.c),
    RAW_KANJI.map((k) => k.c),
    "KANJI is the source file in the source file's order, and neither adds nor drops a character.",
  );
});

test("kanji.json pins grade, stroke count and newspaper rank, unchanged", () => {
  const changed: string[] = [];
  for (const k of KANJI) {
    const raw = RAW_BY_C.get(k.c);
    assert.ok(raw, `${k.c} is taught but is not in kanji.json.`);
    if (k.grade !== raw.grade) changed.push(`${k.c} grade ${raw.grade} -> ${k.grade}`);
    if (k.strokes !== raw.strokes) changed.push(`${k.c} strokes ${raw.strokes} -> ${k.strokes}`);
    if (k.newspaperFreq !== raw.newspaperFreq) {
      changed.push(`${k.c} newspaperFreq ${raw.newspaperFreq} -> ${k.newspaperFreq}`);
    }
  }
  assert.deepEqual(changed, [], "These values differ between kanji.json and what the app serves.");
});

test("kanji.json pins on'yomi and kun'yomi, unchanged", () => {
  const changed: string[] = [];
  for (const k of KANJI) {
    const raw = RAW_BY_C.get(k.c);
    if (!raw) continue;
    if (k.on.join("|") !== raw.on.join("|")) changed.push(`${k.c} on ${raw.on} -> ${k.on}`);
    if (k.kun.join("|") !== raw.kun.join("|")) changed.push(`${k.c} kun ${raw.kun} -> ${k.kun}`);
  }
  assert.deepEqual(changed, [], "These reading lists differ between kanji.json and the app.");
});

test("a kanji's meanings are a prefix-preserving subset of KANJIDIC2's, never new text", () => {
  // kanji.ts strips catalogue metadata senses ("one radical (no.1)", "counter
  // for articles") unless that would leave nothing. That is a documented,
  // subtractive transform, so the taught list must be the source list in the
  // source order with some entries removed, and never a word nobody wrote.
  const invented: string[] = [];
  const empty: string[] = [];
  let trimmed = 0;
  for (const k of KANJI) {
    const raw = RAW_BY_C.get(k.c);
    if (!raw) continue;
    if (k.meanings.length === 0) empty.push(k.c);
    let at = 0;
    for (const m of k.meanings) {
      const found = raw.meanings.indexOf(m, at);
      if (found === -1) {
        invented.push(`${k.c}: "${m}" is not one of KANJIDIC2's meanings, in order.`);
        break;
      }
      at = found + 1;
    }
    if (k.meanings.length !== raw.meanings.length) trimmed += 1;
  }
  assert.deepEqual(invented, []);
  assert.deepEqual(empty, [], "Every kanji keeps at least one meaning.");
  // The count is pinned so a transform that suddenly strips ten times as much
  // fails here rather than shipping.
  assert.equal(trimmed, 66, "Number of kanji whose meaning list the metadata strip shortens.");
});

test("kanji-components.json pins what a kanji is 'made of'", () => {
  const source = (kanjiComponentsJson as { comps: Record<string, readonly string[]> }).comps;
  // kanji.ts carries a hand-written COMPS_OVERRIDE for glyphs whose KanjiVG
  // depth-1 split is wrong or meaningless. Every difference must be one of
  // those, and the SET of overridden kanji is pinned: a new silent override
  // fails here.
  const overridden: string[] = [];
  for (const k of KANJI) {
    const want = source[k.c] ?? [];
    if (k.comps.join("|") !== want.join("|")) overridden.push(k.c);
  }
  assert.deepEqual(
    overridden.join(""),
    "五亜修充兆匠匹区医匿午卵可吏哀囚四回因団困囲図固国圏園塞威寒巨平年幽式弐必憩成我戒戚戴挿斎曲束東栽武歳母氷準滅為爽甘由畿菌蔵術街衛衝衡表衰衷裁裏褒謄載随黙",
    "The kanji whose taught decomposition is hand-overridden rather than KanjiVG's.",
  );
  for (const c of overridden) {
    assert.ok(KANJI.find((k) => k.c === c), `${c} is in the override list but not taught.`);
  }
});

test("kanji.json's KRADFILE decomposition survives untouched as costParts", () => {
  const changed: string[] = [];
  for (const k of KANJI) {
    const raw = RAW_BY_C.get(k.c);
    if (!raw) continue;
    if (k.costParts.join("|") !== raw.comps.join("|")) changed.push(k.c);
  }
  assert.deepEqual(changed, []);
});

// ---------------------------------------------------------------------------
// KANJIDIC2 + JMdict, via generated/readings.json.
// ---------------------------------------------------------------------------

interface RawReading {
  readonly k: string;
  readonly base: string;
  readonly nWords: number;
}

test("readings.json pins which (kanji, reading) pairs the app can quiz", () => {
  const source = (readingsJson as readonly RawReading[]).map((r) => `${r.k}|${r.base}`);
  const served = READINGS.map((r) => `${r.k}|${r.base}`);
  // kanji.ts re-derives each row's ANCHOR word and its evidence list from the
  // vocabulary; it must not add, drop or rename a reading while doing so.
  assert.deepEqual(served, source);
});

test("readings.json pins the reading each row states, character for character", () => {
  const source = readingsJson as readonly RawReading[];
  const bad: string[] = [];
  READINGS.forEach((r, i) => {
    if (r.base !== source[i].base) bad.push(`${r.k}: ${source[i].base} -> ${r.base}`);
  });
  assert.deepEqual(bad, []);
});

// ---------------------------------------------------------------------------
// JMdict, via generated/vocab.json and generated/word-senses.json.
// ---------------------------------------------------------------------------

interface RawWord {
  readonly keb: string;
  readonly reb: string;
  readonly glosses: readonly string[];
  readonly pos: readonly string[];
  readonly newspaperBand: number | null;
  readonly align: readonly (readonly [string, string, string])[] | null;
  readonly beginnerRank: number;
}

const RAW_VOCAB = vocabJson as readonly RawWord[];

test("vocab.json pins the written forms the app teaches", () => {
  const source = new Set(RAW_VOCAB.map((w) => w.keb));
  const extra = VOCAB.filter((w) => !source.has(w.keb)).map((w) => w.keb);
  // vocab-build.ts adds two rows by hand, for words the JMdict cut left out and
  // the curriculum needs (see its SUPPLEMENT). The SET is pinned, so a third
  // hand-typed word cannot arrive without this failing.
  assert.deepEqual(extra, ["えっ", "いらっしゃる"], "Words the app serves that JMdict's cut does not contain.");
});

test("word-senses.json pins each word's readings, glosses and part-of-speech tags", () => {
  const senses = wordSensesJson as Record<
    string,
    readonly { reb: string; glosses: readonly string[]; pos: readonly string[] }[]
  >;
  const wrong: string[] = [];
  let checked = 0;
  for (const w of VOCAB) {
    const source = senses[w.keb];
    if (!source) continue;
    for (const sense of w.senses) {
      // A written form can carry several senses under ONE reading (カラー is
      // both color and collar), so the served sense has to equal SOME sense the
      // file files under that reading, not the first one.
      const candidates = source.filter((s) => s.reb === sense.reb);
      if (candidates.length === 0) {
        wrong.push(`${w.keb}: served reading ${sense.reb} is in no word-senses.json sense.`);
        continue;
      }
      checked += 1;
      const hit = candidates.find(
        (s) =>
          s.glosses.join("|") === sense.glosses.join("|") && s.pos.join("|") === sense.pos.join("|"),
      );
      if (!hit) {
        wrong.push(
          `${w.keb}/${sense.reb}: served glosses [${sense.glosses}] + pos [${sense.pos}] match no ` +
            `sense word-senses.json files under that reading.`,
        );
      }
    }
  }
  assert.deepEqual(wrong.slice(0, 20), []);
  // word-senses.json is the small file of written forms JMdict files under more
  // than one reading, so the reachable count is in the hundreds, not thousands.
  assert.equal(checked, 243, "senses compared against word-senses.json");
});

/** Written forms whose taught reading CEJC's conversation counts override. */
const CEJC_REREAD = ["四", "七", "九"];

test("vocab.json pins the reading, glosses and newspaper band of a single-sense word", () => {
  // A word JMdict files under exactly one reading has nothing to merge, so the
  // row the app serves must be the row the file holds, field for field. That is
  // most of the vocabulary and it is the strictest comparison available here.
  const senses = wordSensesJson as Record<string, readonly unknown[]>;
  const wrong: string[] = [];
  let checked = 0;
  for (const raw of RAW_VOCAB) {
    if ((senses[raw.keb]?.length ?? 1) !== 1) continue;
    const served = vocabRow(raw.keb);
    if (!served) continue;
    checked += 1;
    // The taught reading, and only the taught reading, may differ from
    // vocab.json: cejc-reading-frequency.json overrides it where conversation
    // says a different pronunciation is the everyday one (JMdict files 四 under
    // し; people say よん). The SET is pinned, because a silent fourth entry
    // would be a reading nobody chose.
    if (served.reb !== raw.reb && !CEJC_REREAD.includes(raw.keb)) {
      wrong.push(`${raw.keb}: reb ${raw.reb} -> ${served.reb}`);
    }
    if (served.glosses.join("|") !== raw.glosses.join("|")) {
      wrong.push(`${raw.keb}: glosses ${raw.glosses} -> ${served.glosses}`);
    }
    if (served.newspaperBand !== raw.newspaperBand) {
      wrong.push(`${raw.keb}: band ${raw.newspaperBand} -> ${served.newspaperBand}`);
    }
    if (JSON.stringify(served.align) !== JSON.stringify(raw.align)) {
      wrong.push(`${raw.keb}: align differs from vocab.json`);
    }
  }
  assert.deepEqual(wrong.slice(0, 20), []);
  assert.ok(checked > 5000, `Only ${checked} single-sense words checked; expected thousands.`);
});

test("every per-kanji reading the app shows is a reading KANJIDIC2 gives that kanji", () => {
  // `align` is the app's own heuristic alignment of a word's kana onto its
  // kanji (scripts/ingest/aligner.py), so the SPLIT is not sourced. The base
  // reading each slot names is, and it must be one KANJIDIC2 lists.
  const bad: string[] = [];
  for (const w of VOCAB) {
    for (const [c, , base] of w.align ?? []) {
      const raw = RAW_BY_C.get(c);
      if (!raw) continue; // non-jouyou kanji are not in the taught set
      if (!raw.on.includes(base) && !raw.kun.includes(base)) {
        bad.push(`${w.keb} (${w.reb}): ${c} is read ${base}, which KANJIDIC2 does not list.`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 20), []);
});

// ---------------------------------------------------------------------------
// Kanjium, via generated/pitch.json and generated/pitch-pairs.json.
// ---------------------------------------------------------------------------

test("pitch.json pins every downstep the app draws", () => {
  const source = pitchJson as Record<string, number>;
  const wrong: string[] = [];
  for (const [keb, downstep] of Object.entries(source)) {
    const served = wordPitch(keb);
    if (served !== downstep) wrong.push(`${keb}: ${downstep} -> ${served}`);
  }
  assert.deepEqual(wrong, []);
  // And nothing is invented: a word with no row gets no mark.
  const outside = VOCAB.filter((w) => wordPitch(w.keb) !== null && source[w.keb] === undefined);
  assert.deepEqual(outside.map((w) => w.keb), []);
});

test("pitch-pairs.json pins the homophone pairs a pitch question may use", () => {
  const source = pitchPairsJson as unknown as readonly (readonly [string, string, string])[];
  const wrong: string[] = [];
  for (const [a, b, reading] of source) {
    const forA = pitchPairsFor(a);
    if (!forA.some((p) => p.partner === b && p.reading === reading)) {
      wrong.push(`${a}/${b} (${reading}) is in the file but the app does not serve it.`);
    }
    const forB = pitchPairsFor(b);
    if (!forB.some((p) => p.partner === a && p.reading === reading)) {
      wrong.push(`${b}/${a} (${reading}) is in the file but the app does not serve it.`);
    }
  }
  assert.deepEqual(wrong, []);
  const served = new Set<string>();
  for (const w of VOCAB) for (const p of pitchPairsFor(w.keb)) served.add([w.keb, p.partner].sort().join("/"));
  const known = new Set(source.map(([a, b]) => [a, b].sort().join("/")));
  assert.deepEqual([...served].filter((k) => !known.has(k)), [], "No pair is invented.");
});

// ---------------------------------------------------------------------------
// Unicode UCD + KANJIDIC2, via generated/radical-enrichment.json.
// ---------------------------------------------------------------------------

test("radical-enrichment.json pins the bushu name and variant forms of every radical", () => {
  // Keyed by Kangxi radical NUMBER, so the glyph the app names has to be
  // reached through RADICALS rather than assumed.
  const source = radicalEnrichmentJson as unknown as Record<
    string,
    { name: { kana: string; romaji: string }; variants: readonly { glyph: string }[] } | string
  >;
  const wrong: string[] = [];
  let checked = 0;
  for (const r of RADICALS) {
    const row = source[String(r.num)];
    if (!row || typeof row === "string") continue;
    checked += 1;
    const served = bushuName(r.glyph);
    if (served === null) {
      wrong.push(`${r.glyph} (#${r.num}): the file names it ${row.name.kana}, the app serves none.`);
      continue;
    }
    if (served.kana !== row.name.kana) wrong.push(`${r.glyph}: ${row.name.kana} -> ${served.kana}`);
    if (served.romaji !== row.name.romaji) {
      wrong.push(`${r.glyph}: ${row.name.romaji} -> ${served.romaji}`);
    }
    const servedGlyphs = radicalVariants(r.glyph).map((v) => v.glyph).join("|");
    const fileGlyphs = row.variants.map((v) => v.glyph).join("|");
    if (servedGlyphs !== fileGlyphs) {
      wrong.push(`${r.glyph}: variants ${fileGlyphs} -> ${servedGlyphs}`);
    }
  }
  assert.deepEqual(wrong.slice(0, 20), []);
  assert.equal(checked, 214, "Every Kangxi radical is checked against the file.");
});

// ---------------------------------------------------------------------------
// English Wiktionary, via generated/kanji-etymology.json.
// ---------------------------------------------------------------------------

test("kanji-etymology.json pins the glyph type and components of every etymology", () => {
  interface EtymologyRecord {
    readonly type: string | null;
    readonly components?: readonly unknown[];
    readonly originText?: string | null;
  }
  const source = (etymologyJson as { data: Record<string, EtymologyRecord> }).data;
  // kanji-etymology-manual.json re-maps the same Wiktionary prose onto the
  // visible modern glyph for the kanji whose by-glyph join the crawl could not
  // make. Those records legitimately differ from the crawled ones, so they are
  // the source of truth where they exist, and their key set is pinned here.
  const manual = (etymologyManualJson as { data: Record<string, EtymologyRecord> }).data;
  assert.equal(Object.keys(manual).length, 23, "hand-remapped etymology records");
  const wrong: string[] = [];
  for (const [kanji, raw] of Object.entries(source)) {
    const want = manual[kanji] ?? raw;
    const served = etymologyOf(kanji);
    if (!served) {
      wrong.push(`${kanji}: the file carries an etymology but the app serves none.`);
      continue;
    }
    if (served.type !== want.type) wrong.push(`${kanji}: type ${want.type} -> ${served.type}`);
    if (JSON.stringify(served.components) !== JSON.stringify(want.components ?? [])) {
      wrong.push(`${kanji}: the component roles differ from the file.`);
    }
  }
  assert.deepEqual(wrong.slice(0, 20), []);
});

test("a kanji's origin story is Wiktionary's own text, a hand-written replacement, or nothing", () => {
  // The hand-written layers (PROSE_OVERRIDE, MANUAL_ORIGIN) are the app's, not
  // the source's, and they are reviewed as prose elsewhere. What must not
  // happen is a THIRD kind of text: a story that is neither the file's nor one
  // of those tables', which would mean a transform is editing prose in flight.
  interface TextRecord {
    readonly originText?: string | null;
  }
  const source = (etymologyJson as { data: Record<string, TextRecord> }).data;
  const manual = (etymologyManualJson as { data: Record<string, TextRecord> }).data;
  let fromFile = 0;
  let replaced = 0;
  let suppressed = 0;
  for (const kanji of Object.keys(source)) {
    const served = etymologyOf(kanji);
    if (!served) continue;
    const fileText = manual[kanji]?.originText ?? source[kanji].originText ?? null;
    if (served.originText === null) suppressed += 1;
    else if (served.originText === fileText) fromFile += 1;
    else replaced += 1;
  }
  assert.equal(fromFile + replaced + suppressed, Object.keys(source).length);
  // Pinned so that a jump in `replaced` (prose written for kanji nobody
  // reviewed) is visible rather than silent.
  // As of this pin, EVERY crawled etymology reaches the learner as hand-written
  // prose: none of Wiktionary's own wording is shown, and none is suppressed
  // without a replacement. That is a fact worth failing on if it changes.
  assert.equal(replaced, 2015, "kanji whose origin story is hand-written, not the file's.");
  assert.equal(suppressed, 0, "kanji whose origin is suppressed with nothing in its place.");
  assert.equal(fromFile, 0, "kanji still showing the file's own text.");
});

// ---------------------------------------------------------------------------
// Tatoeba, via generated/word-examples.json.
// ---------------------------------------------------------------------------

test("word-examples.json pins the example sentence shown on a word page", () => {
  const source = wordExamplesJson as unknown as Record<
    string,
    readonly [number, string, string, number | null, number | null, unknown]
  >;
  const wrong: string[] = [];
  for (const [keb, row] of Object.entries(source)) {
    const served = exampleFor(keb);
    if (!served) {
      wrong.push(`${keb}: the file holds a sentence but the app shows none.`);
      continue;
    }
    if (served.jp !== row[1]) wrong.push(`${keb}: jp text differs from the file.`);
    if (served.en !== row[2]) wrong.push(`${keb}: en translation differs from the file.`);
    if (served.id !== row[0]) wrong.push(`${keb}: Tatoeba id ${row[0]} -> ${served.id}`);
  }
  assert.deepEqual(wrong.slice(0, 20), []);
});

test("every example sentence highlights the word it is an example of", () => {
  // The span is what the page underlines. An off-by-one underlines the wrong
  // characters and nothing else would notice.
  //
  // WordExample's own doc says the span is where the word's LITERAL written
  // form appears, and is absent when the sentence inflects it. That is not what
  // the file holds: 818 of the 2,990 spans cover an inflected surface
  // instead (ある is underlined in ありません, いただく in いただきます). The
  // underline is still on the right word, so this pins the weaker, true claim
  // and the count, and the mismatch with the comment is written up in
  // docs/content-review-2026-09.md rather than papered over here.
  const bad: string[] = [];
  let spanned = 0;
  let literal = 0;
  for (const keb of Object.keys(wordExamplesJson as Record<string, unknown>)) {
    const ex = exampleFor(keb);
    if (!ex?.span) continue;
    spanned += 1;
    const [start, end] = ex.span;
    if (start < 0 || end > ex.jp.length || end <= start) {
      bad.push(`${keb}: span [${start}, ${end}) is outside a sentence of ${ex.jp.length}.`);
      continue;
    }
    if (ex.jp.slice(start, end) === keb) literal += 1;
  }
  assert.deepEqual(bad.slice(0, 20), []);
  assert.equal(spanned, 2990, "sentences that carry a highlight span");
  assert.equal(literal, 2172, "spans that cover the word's dictionary spelling exactly");
});
