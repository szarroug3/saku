// Run: node --test src/lib/library/entries.test.ts
//
// The entry page's facts table, as data. The table is GENERIC ACROSS KINDS —
// one component renders a kanji's readings, a word's reading-and-meaning and a
// grammar pattern's meaning-and-form — and the two ways that goes wrong are
// both invisible from any single page:
//
//  - A HEADED SECTION WITH NO ROWS. The kanji meaning row used to guarantee
//    every kanji at least one row. It is gone, so 114 jōyō kanji with no
//    everyday-word-attested reading now produce none, and a grammar pattern
//    with no recipe never did. The page must render nothing there, not an empty
//    box; this file asserts the emptiness so the page's guard has something to
//    guard against.
//  - A TITLE THAT DESCRIBES A DIFFERENT TABLE. "Readings" over a pattern's
//    meaning row is the same class of lie the old "Reading" column told about
//    the meaning row it sat above.

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { KANJI, KANJI_SUBJECT } from "@/data/kanji";
import {
  builtFrom,
  confusableWith,
  factRows,
  factsColumnHeader,
  factsTitle,
  libEntry,
  quizTrackLabel,
  subjectLabel,
  trackLabel,
  LIB_ENTRIES,
  COUNTER_KIND,
  NUMBER_CONSTRUCTION_KIND,
  SENTENCE_RULE_KIND,
  type LibEntry,
  type Kind,
} from "./entries.ts";
import { kanjiEntry } from "@/data/kanji";
import { kanaEntry, KANA_SUBJECT } from "@/data/characters";
import { wordEntry, VOCAB_SUBJECT } from "@/data/vocab";
import { factInfo } from "@/lib/facts.ts";
import { kanaFact } from "@/data/characters";
import { meaningFactId } from "@/data/kanji";
import { wordMeaningFactId } from "@/data/vocab";
import { RADICAL_SUBJECT, radicalEntry, radicalMeaningFactId } from "@/data/radicals";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { GRAMMAR_CONCEPT_SUBJECT } from "@/data/grammar-concepts";
import { TERM_SUBJECT } from "@/data/terms";
import { PRIMITIVE_SUBJECT } from "@/data/components";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { KEIGO_SUBJECT } from "@/data/keigo";
import { MARK_SUBJECT } from "@/data/marks";
import type { FactInfo } from "@/types";

const need = (e: LibEntry | undefined): LibEntry => {
  assert.ok(e);
  return e;
};

// ---- builtFrom: the kanji page's "Built from" shape decomposition ----

const built = (glyph: string) => builtFrom(need(libEntry(kanjiEntry(glyph))));

test("builtFrom keeps radical pieces — 何 is 亻 + 可, each linked with a meaning", () => {
  // The whole point of feeding this from madeOf rather than the kanji-only
  // teachableParts: 亻 is a bound form with no card, but it is half of 何 and a
  // learner needs it. It links through to the character it stands for (人).
  const p = built("何");
  assert.deepEqual(p.map((x) => x.c), ["亻", "可"]);
  assert.ok(p.every((x) => x.id !== null), "every piece of 何 should link");
  assert.equal(p[0]!.meaning, "person"); // 亻 → 人
  assert.ok(p[1]!.meaning.length > 0, "可 should carry a meaning");
});

test("a variant piece carries its note — 何's 亻 says it is 人 in its left form", () => {
  // Surface #2: the variant piece 亻 carries the character it stands for and where
  // it sits, so the "Built from" tile can say 亻 is 人 in its left form. The plain
  // piece 可 carries none.
  const p = built("何");
  const person = p[0]!;
  assert.equal(person.c, "亻");
  assert.ok(person.variant, "亻 should carry a variant note");
  assert.equal(person.variant!.original, "人");
  assert.equal(person.variant!.position, "left");
  assert.equal(person.variant!.name, "にんべん");
  assert.equal(p[1]!.variant, undefined, "the plain piece 可 carries no variant note");
});

test("builtFrom on 明 is 日 + 月, two taught kanji", () => {
  const p = built("明");
  assert.deepEqual(p.map((x) => x.c), ["日", "月"]);
  assert.ok(p.every((x) => x.id !== null));
});

test("builtFrom applies the #32 frame-dedup — 可 is 丁 + 口, not 丁 + 口 + 丁", () => {
  // madeOf reads the raw KanjiVG comps (丁,口,丁); deframe collapses the single
  // enclosure written twice.
  const p = built("可");
  assert.deepEqual(p.map((x) => x.c), ["丁", "口"]);
  assert.equal(p[0]!.meaning, "street"); // 丁
  assert.equal(p[1]!.meaning, "mouth"); // 口
});

test("builtFrom keeps a genuine repetition — 品 stays 口 + 口 + 口", () => {
  assert.deepEqual(built("品").map((x) => x.c), ["口", "口", "口"]);
});

test("builtFrom is empty for an atomic kanji — no section", () => {
  // 一 has no components; the page renders nothing rather than an empty card.
  assert.deepEqual(built("一"), []);
});

test("builtFrom is empty for every number kanji — memorised wholes, no pieces", () => {
  // 四…十 DO have KanjiVG comps (四 → 囗 儿, 六 → 亠 八), but those pieces are
  // shape-only and mislead, so the number kanji are taught whole and show no
  // "Built from" (src/data/number-kanji.ts). Contrast the counter kanji below.
  for (const n of ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]) {
    assert.deepEqual(built(n), [], `${n} shows no Built from`);
  }
  // A counter kanji is NOT a number kanji: 回 still decomposes into 囗 + 口.
  assert.deepEqual(built("回").map((x) => x.c), ["囗", "口"]);
});

test("a kanji's table is readings only — the meaning row is gone", () => {
  // 一 is the case the owner reported: its first row was the MEANING, under a
  // column headed "Reading", and the meaning KANJIDIC2 gave was "one, one
  // radical (no.1)". Every row here is now a reading.
  const one = need(libEntry(kanjiEntry("一")));
  const rows = factRows(one);
  assert.ok(rows.length > 0);
  assert.ok(
    rows.every((r) => r.label !== "Meaning"),
    "a meaning row survived in the kanji table",
  );
  assert.ok(rows.some((r) => r.label === "いち"));
  assert.equal(factsColumnHeader(one), "Reading");
  assert.equal(factsTitle(one, rows), "Readings");
});

test("each reading says where its sound came from, in words a beginner knows", () => {
  const rows = factRows(need(libEntry(kanjiEntry("一"))));
  const by = new Map(rows.map((r) => [r.label, r]));
  // The jargon is on'yomi and kun'yomi. It is never what ships.
  assert.equal(by.get("いち")?.origin, "from Chinese");
  assert.equal(by.get("ひと")?.origin, "native Japanese");
  for (const r of rows) {
    assert.ok(!/yomi/i.test(r.origin ?? ""), `jargon leaked: ${r.origin}`);
  }
});

test("only rows that are Japanese sound get a speaker", () => {
  // A reading and a kana are speakable. A meaning is English and a pattern is a
  // shape, not a sound — the page omits its Hear-it button for grammar for the
  // same reason.
  const kanji = factRows(need(libEntry(kanjiEntry("一"))));
  assert.ok(kanji.every((r) => r.speak === r.label));

  const kana = factRows(need(libEntry(kanaEntry("し"))));
  assert.equal(kana[0]?.speak, "し");

  const word = factRows(need(libEntry(wordEntry("先生"))));
  // The word row speaks its READING. A synthesiser handed 先生 has to guess.
  assert.equal(word.find((r) => r.label === "Reading")?.speak, "せんせい");
  assert.equal(word.find((r) => r.label === "Meaning")?.speak, null);
});

test("a word keeps both its rows — dropping one would not leave a table", () => {
  const w = need(libEntry(wordEntry("先生")));
  const rows = factRows(w);
  assert.deepEqual(rows.map((r) => r.label), ["Reading", "Meaning"]);
  assert.equal(factsTitle(w, rows), "Reading and meaning");
  assert.equal(factsColumnHeader(w), "What it asks");
});

test("no kind renders a headed table with no rows", () => {
  // Every entry either has rows, or has none and the page renders nothing.
  // The assertion that matters is the second half being REAL: if this count
  // ever hits zero the page's guard is dead code and will rot.
  const empty = KANJI.filter((k) => factRows(need(libEntry(kanjiEntry(k.c)))).length === 0);
  assert.ok(empty.length > 0, "expected some kanji with no attested reading");
  assert.ok(
    empty.length < KANJI.length / 4,
    `${empty.length} kanji have no readings at all — the join broke`,
  );
  // And their meaning is still a scored fact, still shown, just not in a table:
  // it is the chip beside the definition. Losing it is the regression this
  // guards.
  const first = need(libEntry(kanjiEntry(empty[0]!.c)));
  assert.ok(first.meanings.length > 0);
});

test("the subject pip splits kana by script and singularises words", () => {
  // Kana is the whole point of the split: the same "Kana" shelf reads
  // "Hiragana" or "Katakana" in the header, decided by the character itself.
  assert.equal(subjectLabel(factInfo(kanaFact("し"))), "Hiragana");
  assert.equal(subjectLabel(factInfo(kanaFact("シ"))), "Katakana");
  // A lesson teaches ONE word, so the "Words" shelf reads "Word" here.
  assert.equal(subjectLabel(factInfo(wordMeaningFactId("先生"))), "Word");
  // Kanji already reads right as a shelf label.
  assert.equal(subjectLabel(factInfo(meaningFactId("一"))), "Kanji");
  // A fact the data no longer has has no label rather than throwing.
  assert.equal(subjectLabel(undefined), undefined);
});

// ---- speakable: does one INSTANCE of this entry have a real pronunciation
// worth a 🔊, per SAK-79 ----
//
// The bug: `speakable()` in entry-tile.tsx used to infer this from `kind`, but
// `kind` answers "which shelf", a different question — and COUNTER_KIND shelves
// TWO populations under it: real counted words (一本 · いっぽん, speakable) and
// counter CONSTRUCTION/rule pages (〜枚, a placeholder glyph over prose about a
// sound shift — not speakable). A kind check cannot tell those apart, so a
// construction page wrongly got a speaker.
//
// The fix moved the decision onto LibEntry itself (`speakable`), set once by
// whichever population's construction code in `build()` actually knows the
// answer. These tests assert the WHOLE generated index agrees, per kind — not
// just the one reported glyph — because the bug class is "kind conflates two
// questions", which a single regression pin does not guard against.
const SPEAKABLE_BY_KIND: Record<Kind, boolean> = {
  [KANA_SUBJECT]: true,
  [RADICAL_SUBJECT]: false,
  // A bare kanji glyph has no single pronunciation of its own (on'yomi vs.
  // kun'yomi is context-dependent) — see LibEntry.speakable.
  [KANJI_SUBJECT]: false,
  [VOCAB_SUBJECT]: true,
  // The real counted words (一本 · いっぽん) — see NUMBER_CONSTRUCTION_KIND
  // below for the reference pages that share this shelf but not this kind.
  [COUNTER_KIND]: true,
  // The confirmed SAK-79 case: 〜枚 and its siblings are rule pages, not words.
  [NUMBER_CONSTRUCTION_KIND]: false,
  [SENTENCE_RULE_KIND]: false,
  [GRAMMAR_SUBJECT]: false,
  [GRAMMAR_CONCEPT_SUBJECT]: false,
  // A pair names two words (開く / 開ける); its one glyph is a representative
  // fragment, not the whole entry's sound.
  [TRANSITIVITY_SUBJECT]: false,
  // A set names multiple words (honorific and humble forms), same reasoning.
  [KEIGO_SUBJECT]: false,
  [MARK_SUBJECT]: false,
  [TERM_SUBJECT]: false,
  [PRIMITIVE_SUBJECT]: false,
};

test("every entry's speakable flag matches its kind's real-pronunciation status", () => {
  const byKind = new Map<Kind, LibEntry[]>();
  for (const e of LIB_ENTRIES) {
    const list = byKind.get(e.kind);
    if (list) list.push(e);
    else byKind.set(e.kind, [e]);
  }
  for (const kind of Object.keys(SPEAKABLE_BY_KIND) as Kind[]) {
    const expected = SPEAKABLE_BY_KIND[kind];
    const entries = byKind.get(kind) ?? [];
    // A kind with zero entries makes the assertion below vacuously true, which
    // would hide a build() regression that stopped minting a population
    // entirely — so this must find something for every kind checked.
    assert.ok(entries.length > 0, `no entries built for kind "${kind}" — test is vacuous`);
    for (const e of entries) {
      assert.equal(
        e.speakable,
        expected,
        `${kind} entry ${e.id} (glyph "${e.glyph}") expected speakable=${expected}, got ${e.speakable}`,
      );
    }
  }
});

test("SAK-79: a counter construction page (〜枚) is silent, a real counted word is not", () => {
  const construction = LIB_ENTRIES.find(
    (e) => e.kind === NUMBER_CONSTRUCTION_KIND && e.glyph === "〜枚",
  );
  assert.ok(construction, "expected the 〜枚 construction page to exist");
  assert.equal(construction!.speakable, false, "a rule page has no pronunciation");

  // SAK-172: COUNTER_CURRICULUM's one counted (non-kana) form, 二十歳 (はたち —
  // see COUNTER_CURRICULUM's TAIL), no longer mints its own COUNTER_KIND Library
  // entry at all (it folded into 〜歳's construction page as an Irregular row
  // instead — see entries.test.ts's "SAK-172" describe block below). So every
  // remaining COUNTER_KIND entry is a kana form (ひとつ…), whose glyph IS its
  // reading; the "counted form carries its own separate reading" half of the
  // SAK-79 regression this test pins is now covered structurally by the
  // exhaustive, non-vacuous "every entry's speakable flag matches its kind"
  // test above, not by a single named example here any more.
  const kanaForm = LIB_ENTRIES.find((e) => e.kind === COUNTER_KIND && e.glyph === "ひとつ");
  assert.ok(kanaForm, "expected the kana form ひとつ to exist");
  assert.equal(kanaForm!.speakable, true, "a kana form's glyph IS its reading");
  assert.equal(kanaForm!.readings.length, 0, "a kana form's reading IS its glyph — no separate entry");
});

describe("SAK-169: 一人/二人/一つ…九つ no longer duplicate onto the Words shelf", () => {
  const DUPLICATE_KEBS = [
    "一人", "二人", "一つ", "二つ", "三つ", "四つ", "五つ", "六つ", "七つ", "八つ", "九つ",
  ];

  test("none of them is a VOCAB_SUBJECT (\"word\") entry any more", () => {
    for (const keb of DUPLICATE_KEBS) {
      const asWord = LIB_ENTRIES.find((e) => e.kind === VOCAB_SUBJECT && e.glyph === keb);
      assert.equal(asWord, undefined, `${keb} must not appear on the Words shelf`);
    }
  });

  test("each is still reachable — a searchAlso alias on the entry it duplicates", () => {
    for (const keb of DUPLICATE_KEBS) {
      const holder = LIB_ENTRIES.find((e) => e.searchAlso?.includes(keb));
      assert.ok(holder, `${keb} must ride as a searchAlso alias somewhere, not vanish`);
    }
  });

  test("〜つ's kanji spellings alias their OWN kana counter entry, not a stranger's", () => {
    const kebToKana: Record<string, string> = {
      一つ: "ひとつ", 二つ: "ふたつ", 三つ: "みっつ", 四つ: "よっつ", 五つ: "いつつ",
      六つ: "むっつ", 七つ: "ななつ", 八つ: "やっつ", 九つ: "ここのつ",
    };
    for (const [keb, kana] of Object.entries(kebToKana)) {
      const holder = LIB_ENTRIES.find((e) => e.kind === COUNTER_KIND && e.searchAlso?.includes(keb));
      assert.ok(holder, `${keb} must alias a COUNTER_KIND entry`);
      assert.equal(holder!.glyph, kana, `${keb} must alias its own kana form ${kana}, not another`);
    }
  });

  test("一人/二人 alias the 〜人 construction page, where their irregular readings are shown", () => {
    for (const keb of ["一人", "二人"]) {
      const holder = LIB_ENTRIES.find(
        (e) => e.kind === NUMBER_CONSTRUCTION_KIND && e.searchAlso?.includes(keb),
      );
      assert.ok(holder, `${keb} must alias the 〜人 construction page`);
      assert.equal(holder!.glyph, "〜人");
    }
  });
});

describe("SAK-172: 二十歳 no longer has a standalone Library page — it aliases into 〜歳's page", () => {
  test("二十歳 is not a COUNTER_KIND entry any more", () => {
    const own = LIB_ENTRIES.find((e) => e.kind === COUNTER_KIND && e.glyph === "二十歳");
    assert.equal(own, undefined, "二十歳 must not appear on the Counting shelf as its own entry");
  });

  test("二十歳 is not any kind of standalone entry — no glyph collision elsewhere either", () => {
    const anyEntry = LIB_ENTRIES.find((e) => e.glyph === "二十歳");
    assert.equal(anyEntry, undefined, "二十歳 must not mint a Library entry under any kind");
  });

  test("二十歳 is still reachable — a searchAlso alias on 〜歳's construction page", () => {
    const holder = LIB_ENTRIES.find(
      (e) => e.kind === NUMBER_CONSTRUCTION_KIND && e.searchAlso?.includes("二十歳"),
    );
    assert.ok(holder, "二十歳 must ride as a searchAlso alias, not vanish");
    assert.equal(holder!.glyph, "〜歳", "二十歳 must alias 〜歳's own page, not another counter's");
  });
});

describe("SAK-176: １万/１０万/１００万/１００億 no longer duplicate onto the Words shelf", () => {
  const DUPLICATE_KEBS = ["１万", "１０万", "１００万", "１００億"];

  test("none of them is a VOCAB_SUBJECT (\"word\") entry any more", () => {
    for (const keb of DUPLICATE_KEBS) {
      const asWord = LIB_ENTRIES.find((e) => e.kind === VOCAB_SUBJECT && e.glyph === keb);
      assert.equal(asWord, undefined, `${keb} must not appear on the Words shelf`);
    }
  });

  test("each aliases the big-numbers construction page, where its exact reading is shown", () => {
    for (const keb of DUPLICATE_KEBS) {
      const holder = LIB_ENTRIES.find(
        (e) => e.kind === NUMBER_CONSTRUCTION_KIND && e.searchAlso?.includes(keb),
      );
      assert.ok(holder, `${keb} must ride as a searchAlso alias, not vanish`);
      assert.equal(holder!.glyph, "百〜", `${keb} must alias the big-numbers page, not another`);
    }
  });
});

describe("SAK-177: １割/二割/１階/二階/一円/１０００円 no longer duplicate onto the Words shelf", () => {
  const KEB_TO_GLYPH: Record<string, string> = {
    "１割": "〜割", "二割": "〜割",
    "１階": "〜階", "二階": "〜階",
    "一円": "〜円", "１０００円": "〜円",
  };

  test("none of them is a VOCAB_SUBJECT (\"word\") entry any more", () => {
    for (const keb of Object.keys(KEB_TO_GLYPH)) {
      const asWord = LIB_ENTRIES.find((e) => e.kind === VOCAB_SUBJECT && e.glyph === keb);
      assert.equal(asWord, undefined, `${keb} must not appear on the Words shelf`);
    }
  });

  test("bare 円 and 階 (the ordinary nouns) still DO appear on the Words shelf", () => {
    // Only the counted forms are excluded — the bare nouns are real, separate
    // vocabulary the words track still teaches (see counters.ts's doc comment).
    assert.ok(LIB_ENTRIES.some((e) => e.kind === VOCAB_SUBJECT && e.glyph === "円"));
    assert.ok(LIB_ENTRIES.some((e) => e.kind === VOCAB_SUBJECT && e.glyph === "階"));
  });

  test("each aliases its own construction page, where its exact reading is shown", () => {
    for (const [keb, glyph] of Object.entries(KEB_TO_GLYPH)) {
      const holder = LIB_ENTRIES.find(
        (e) => e.kind === NUMBER_CONSTRUCTION_KIND && e.searchAlso?.includes(keb),
      );
      assert.ok(holder, `${keb} must ride as a searchAlso alias, not vanish`);
      assert.equal(holder!.glyph, glyph, `${keb} must alias its own counter's page, not another`);
    }
  });
});

describe("SAK-171: 一時/４時/７時 no longer duplicate onto the Words shelf", () => {
  const DUPLICATE_KEBS = ["一時", "４時", "７時"];

  test("none of them is a VOCAB_SUBJECT (\"word\") entry any more", () => {
    for (const keb of DUPLICATE_KEBS) {
      const asWord = LIB_ENTRIES.find((e) => e.kind === VOCAB_SUBJECT && e.glyph === keb);
      assert.equal(asWord, undefined, `${keb} must not appear on the Words shelf`);
    }
  });

  test("each aliases the 〜時 construction page, where its exact reading is shown", () => {
    for (const keb of DUPLICATE_KEBS) {
      const holder = LIB_ENTRIES.find(
        (e) => e.kind === NUMBER_CONSTRUCTION_KIND && e.searchAlso?.includes(keb),
      );
      assert.ok(holder, `${keb} must ride as a searchAlso alias, not vanish`);
      assert.equal(holder!.glyph, "〜時", `${keb} must alias the ji construction page, not another`);
    }
  });

  test("何時 (なんじ, \"what time\") is untouched — still an ordinary Words-shelf entry", () => {
    // The ticket's own explicit carve-out: 何時 is a genuine independent
    // interrogative word, unrelated to the 〜時 counting rule, and needs no
    // dedup, no alias, and no change at all.
    const nanji = LIB_ENTRIES.find((e) => e.kind === VOCAB_SUBJECT && e.glyph === "何時");
    assert.ok(nanji, "何時 must still appear on the Words shelf");
    assert.deepEqual(nanji!.readings, ["なんじ"]);
    // And it must NOT ride as a searchAlso alias of the 〜時 construction page —
    // it is not a duplicate of anything that page teaches.
    const ji = LIB_ENTRIES.find((e) => e.kind === NUMBER_CONSTRUCTION_KIND && e.glyph === "〜時");
    assert.ok(ji, "the 〜時 construction page must exist");
    assert.ok(!ji!.searchAlso?.includes("何時"), "何時 must not alias 〜時's page");
  });
});

describe("SAK-175: grammar-covered particles/connectives no longer duplicate onto the Words shelf", () => {
  // Every kana-only, multi-character VOCAB keb confirmed (by exact match
  // against src/data/grammar/recipes.ts, then checked for a real independent
  // sense — see GRAMMAR_VOCAB_DUPLICATE_KEBS's doc comment in
  // src/data/grammar/index.ts) to be a pure duplicate of a recipe's own
  // pattern, mapped to the pattern's own Library glyph.
  const KEB_TO_PATTERN: Record<string, string> = {
    "まで": "〜まで",
    "だけ": "〜だけ",
    "しか": "〜しか〜ない",
    // から shares its bare pattern with kara-source (起点); kara-reason (理由)
    // is the primary (first-in-array) recipe, so its own SENSE-qualified label
    // is what the entry's glyph actually renders — see entries.ts's grammar
    // loop, which reads glyph off the entry's first fact (patternLabel(r)).
    "から": "〜から (理由)",
    "ので": "〜ので",
    "のに": "〜のに",
    "たら": "〜たら",
    "たり": "〜たり〜たり",
    "ながら": "〜ながら",
    "にくい": "〜にくい",
    "たい": "〜たい",
    "たがる": "〜たがる",
    "させる": "〜させる",
    "らしい": "〜らしい",
    "かもしれない": "〜かもしれない",
    "でしょう": "〜でしょう",
    "ませんか": "〜ませんか",
    "ましょうか": "〜ましょうか",
    "ことができる": "〜ことができる",
    "ことにする": "〜ことにする",
    "ことになる": "〜ことになる",
    "なければならない": "〜なければならない",
    "なくてはならない": "〜なくてはならない",
    "なくてはいけない": "〜なくてはいけない",
    "ために": "〜ために",
    "おかげで": "〜おかげで",
    "ようになる": "〜ようになる",
    "ようにする": "〜ようにする",
    "について": "〜について",
    "として": "〜として",
  };

  test("none of the 30 confirmed matches is a VOCAB_SUBJECT (\"word\") entry any more", () => {
    for (const keb of Object.keys(KEB_TO_PATTERN)) {
      const asWord = LIB_ENTRIES.find((e) => e.kind === VOCAB_SUBJECT && e.glyph === keb);
      assert.equal(asWord, undefined, `${keb} must not appear on the Words shelf`);
    }
  });

  test("each is still reachable — a searchAlso alias on its own recipe's Grammar entry", () => {
    for (const [keb, pattern] of Object.entries(KEB_TO_PATTERN)) {
      const holder = LIB_ENTRIES.find(
        (e) => e.kind === GRAMMAR_SUBJECT && e.searchAlso?.includes(keb),
      );
      assert.ok(holder, `${keb} must ride as a searchAlso alias, not vanish`);
      assert.equal(holder!.glyph, pattern, `${keb} must alias its OWN recipe, not a stranger's`);
    }
  });

  test("そう/そうだ/つもり/はず/なら matched a recipe too but were checked and kept — real vocabulary, untouched", () => {
    // Each has a genuine independent sense the matching recipe does not
    // teach (see GRAMMAR_VOCAB_DUPLICATE_KEBS's doc comment for the
    // word-senses.json / CEJC evidence for each). They must still be plain
    // Words-shelf entries, not aliases.
    for (const keb of ["そう", "そうだ", "つもり", "はず", "なら"]) {
      const asWord = LIB_ENTRIES.find((e) => e.kind === VOCAB_SUBJECT && e.glyph === keb);
      assert.ok(asWord, `${keb} must still appear on the Words shelf — it has a real standalone sense`);
    }
  });

  test("genuine standalone vocabulary that merely LOOKS particle-ish is untouched", () => {
    // The large majority of kana-only multi-character words are real
    // vocabulary with no matching recipe at all — spot-check a few so this
    // fix cannot silently widen into judgment calls on words that only
    // "feel" grammatical. あそこ/うさぎ/しんどい/きゅうり are the ticket's own
    // named examples of what must NOT be touched.
    for (const keb of ["あそこ", "うさぎ", "しんどい", "きゅうり"]) {
      const asWord = LIB_ENTRIES.find((e) => e.kind === VOCAB_SUBJECT && e.glyph === keb);
      assert.ok(asWord, `${keb} is genuine vocabulary and must still appear on the Words shelf`);
    }
  });
});

test("a verb pair and a keigo set are not speakable as one entry — each names more than one word", () => {
  const pair = LIB_ENTRIES.find((e) => e.kind === TRANSITIVITY_SUBJECT);
  assert.ok(pair, "expected at least one verb pair entry");
  assert.equal(pair!.speakable, false);

  const keigo = LIB_ENTRIES.find((e) => e.kind === KEIGO_SUBJECT);
  assert.ok(keigo, "expected at least one keigo set entry");
  assert.equal(keigo!.speakable, false);
});

test("a radical and a kanji part are shapes, not sounds — no speaker either", () => {
  const radical = LIB_ENTRIES.find((e) => e.kind === RADICAL_SUBJECT);
  assert.ok(radical, "expected at least one radical entry");
  assert.equal(radical!.speakable, false);

  const primitive = LIB_ENTRIES.find((e) => e.kind === PRIMITIVE_SUBJECT);
  assert.ok(primitive, "expected at least one kanji-part entry");
  assert.equal(primitive!.speakable, false);
});

// ---- confusableWith: hand-authored radical lookalike pairs (SAK-155) ----
//
// 口 (mouth, Kangxi 30) is merged into its own kanji card (isRadicalTaughtAs-
// Kanji), so its one Library page is a KANJI_SUBJECT entry; 囗 (enclosure,
// Kangxi 31) has no kanji role at all, so its page is RADICAL_SUBJECT. The
// pair must show up on BOTH pages regardless of which SUBJECT each glyph
// happens to resolve to — see confusableWith's own "WHY THE RADICAL PAIR
// CHECK RUNS FOR BOTH..." doc. Same shape for 日 (sun, merged) / 曰 (say,
// radical-only), which additionally already carries an UNRELATED existing
// kanji lookalike (目) that must survive alongside the new pairing.

describe("SAK-155 — 口/囗 and 日/曰 radical lookalike pairs", () => {
  test("口's page (a KANJI_SUBJECT entry, since 口 is merged) lists 囗", () => {
    const mouth = need(libEntry(kanjiEntry("口")));
    assert.equal(mouth.kind, KANJI_SUBJECT);
    assert.ok(
      confusableWith(mouth).includes(radicalEntry("囗")),
      "口's confusables should include 囗's radical entry",
    );
  });

  test("囗's page (a RADICAL_SUBJECT entry — no kanji role) lists 口", () => {
    const enclosure = need(libEntry(radicalEntry("囗")));
    assert.equal(enclosure.kind, RADICAL_SUBJECT);
    assert.ok(
      confusableWith(enclosure).includes(kanjiEntry("口")),
      "囗's confusables should include 口's kanji entry",
    );
  });

  test("日's page keeps its existing 目 lookalike AND picks up 曰", () => {
    const sun = need(libEntry(kanjiEntry("日")));
    assert.equal(sun.kind, KANJI_SUBJECT);
    const ids = confusableWith(sun);
    assert.ok(ids.includes(kanjiEntry("目")), "日 should still list its existing 目 pairing");
    assert.ok(ids.includes(radicalEntry("曰")), "日 should also list its new 曰 pairing");
  });

  test("曰's page (radical-only) lists 日, and only 日 — no unrelated 目 leak", () => {
    const say = need(libEntry(radicalEntry("曰")));
    assert.equal(say.kind, RADICAL_SUBJECT);
    const ids = confusableWith(say);
    assert.deepEqual(ids, [kanjiEntry("日")]);
  });

  test("an unrelated radical (勹) has no pair partner — confusableWith stays empty", () => {
    const wrap = need(libEntry(radicalEntry("勹")));
    assert.equal(wrap.kind, RADICAL_SUBJECT);
    assert.deepEqual(confusableWith(wrap), []);
  });
});

// ---- quizTrackLabel: SAK-145 round 3 — the quiz/drill HUDs' track name over
// a WHOLE fact pool, not a lesson's single teach fact ----
//
// A no-track fixture for the "skip, don't disagree" cases below. None of
// TERM_SUBJECT/GRAMMAR_CONCEPT_SUBJECT/MARK_SUBJECT/PRIMITIVE_SUBJECT mints
// its own FactId (see TRACK_LABEL's own doc — none of those is directly
// askable), so there is no real fact to look up; a hand-built FactInfo with
// the bare `subject` this function actually reads is the only way to name one
// in a test at all, and it is enough — quizTrackLabel never looks past
// `subject`.
function untrackedInfo(subject: string): FactInfo {
  return {
    id: "untracked" as unknown as FactInfo["id"],
    entry: "untracked" as unknown as FactInfo["entry"],
    glyph: "x",
    answers: ["x"],
    subject,
    meaning: null,
  };
}

describe("quizTrackLabel — the quiz HUDs' track name over a fact pool", () => {
  test("an empty pool has no track", () => {
    assert.equal(quizTrackLabel([]), undefined);
  });

  test("a pool of only unresolved facts has no track", () => {
    assert.equal(quizTrackLabel([undefined, undefined]), undefined);
  });

  test("a single-subject pool (all kana) names its track", () => {
    const infos = [factInfo(kanaFact("し")), factInfo(kanaFact("か"))];
    assert.equal(quizTrackLabel(infos), "Kana");
  });

  test("kanji and word facts are DIFFERENT kinds but the SAME track — still names it", () => {
    // Exactly the point of TRACK_LABEL's own doc: radicals, kanji and words
    // are three different subjectLabel kinds but one track, "Vocabulary" — a
    // quiz mixing a kanji reading and a word from the same lesson must still
    // read as one track, not bail out as "mixed" the way a genuine kana+
    // vocab mix does below.
    const infos = [factInfo(meaningFactId("一")), factInfo(wordMeaningFactId("先生"))];
    assert.equal(quizTrackLabel(infos), "Vocabulary");
  });

  test("a genuinely mixed pool (kana + vocabulary) has no single track", () => {
    // The real-world case this exists for: Practice's "Due for review"
    // one-click shortcut pulls due facts across every list at once, which is
    // routinely kana AND vocabulary in the same run. Naming it after either
    // would be a wrong label, not just an imprecise one, so this must return
    // undefined rather than guess.
    const infos = [factInfo(kanaFact("し")), factInfo(wordMeaningFactId("先生"))];
    assert.equal(quizTrackLabel(infos), undefined);
  });

  test("a mixed pool stays mixed even when one side also has an untracked fact riding along", () => {
    const infos = [
      factInfo(kanaFact("し")),
      factInfo(wordMeaningFactId("先生")),
      untrackedInfo(TERM_SUBJECT),
    ];
    assert.equal(quizTrackLabel(infos), undefined);
  });

  test("an untracked fact (grammar concept, term, mark, kanji part) does not disagree — it is skipped", () => {
    // A pool that is otherwise single-track must not lose its label just
    // because one confusable-distractor fact along for the ride has no track
    // of its own — see quizTrackLabel's own doc.
    const infos = [
      factInfo(meaningFactId("一")),
      untrackedInfo(GRAMMAR_CONCEPT_SUBJECT),
      untrackedInfo(TERM_SUBJECT),
      untrackedInfo(MARK_SUBJECT),
      untrackedInfo(PRIMITIVE_SUBJECT),
    ];
    assert.equal(quizTrackLabel(infos), "Vocabulary");
  });

  test("a pool of ONLY untracked facts has no track", () => {
    const infos = [untrackedInfo(TERM_SUBJECT), untrackedInfo(MARK_SUBJECT)];
    assert.equal(quizTrackLabel(infos), undefined);
  });

  test("a radical and a kanji fact together still read as one Vocabulary track", () => {
    const infos = [factInfo(radicalMeaningFactId("勹")), factInfo(meaningFactId("一"))];
    assert.equal(quizTrackLabel(infos), "Vocabulary");
  });

  test("agrees with trackLabel for a single fact — same function, no separate mapping to drift", () => {
    const info = factInfo(meaningFactId("一"));
    assert.equal(quizTrackLabel([info]), trackLabel(info));
  });
});
