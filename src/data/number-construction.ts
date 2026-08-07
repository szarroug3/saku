// NUMBER CONSTRUCTION — the "how numbers and counts are BUILT" reference pages.
//
// WHAT THIS IS, AND WHY IT IS ONE PAGE PER CATEGORY
// ================================================
// Past ten, and at every counter, a Japanese number is built rather than
// memorised: a digit in front of じゅう, a digit in front of ひゃく, a number in
// front of 〜本. Each of those rules is its own thing to learn, so each gets its
// own reference page — the tens, the big base words, and one page per counter —
// exactly the way a lesson's rule cards are separate cards rather than one wall
// of prose. A prior version of this shipped as a single grammar-concept blob;
// the owner rejected it for being one unbroken page, having no worked examples,
// and reading "Grammar concepts" in its breadcrumb. This file is the fix: it is
// its OWN Library kind (NUMBER_CONSTRUCTION_KIND, wired in entries.ts), so a
// page's breadcrumb reads under "Numbers and counters"; every page carries an
// example table; and the categories are separate pages.
//
// THE PROSE AND THE EXAMPLES ARE DATA, NOT A SECOND COPY
// =====================================================
// The tens and big pages reuse the phase-intro cards the lesson already teaches
// with (NUMBERS_COMPOSE / NUMBERS_BIG in phase-intros.ts) — their body and their
// examples verbatim, so the reference and the lesson cannot drift. The counter
// pages are DERIVED: every example reading comes from counterReading() (the pure
// engine cross-checked against counters.ts), and which counts shift is read off
// counterIrregulars(), so a page can never state a reading the app does not also
// ship. The counter prose is a short authored note about how the counter attaches
// and how its sound behaves.
//
// READ-ONLY, EXCEPT FOR "QUIZ ME". A construction page mints no facts (factRows
// returns [] for the kind) and is never known-tracked; the one action it offers
// is a "Quiz me" button that launches the generative number-reading round scoped
// to this category (see quizConfig and number-construction-view.tsx).

import {
  NUMBERS_BIG,
  NUMBERS_COMPOSE,
  type IntroExample,
  type IntroPara,
} from "@/data/phase-intros";
import { counterIrregulars, type NumberQuizConfig } from "@/lib/engine/number-quiz";
import { counterReading, type CounterKind } from "@/lib/number-reading";
import { entryId } from "@/lib/fact-id";
import type { EntryId } from "@/types";

/** The subject id, in the same shape as GRAMMAR_CONCEPT_SUBJECT. It is also the
 * URL kind segment (/library/numbers/tens) and the LibEntry kind. */
export const NUMBER_CONSTRUCTION_SUBJECT = "numbers";

/** Mint a construction page's entry id. The ONLY place a construction id is
 * built; everything downstream resolves it by lookup, never by taking it apart. */
export function numberConstructionEntry(id: string): EntryId {
  return entryId(NUMBER_CONSTRUCTION_SUBJECT, id);
}

/** One "how to build it" reference page — a category of number construction. */
export interface NumberConstruction {
  /** Stable id — the URL slug, the React key, and what a test names. */
  readonly id: string;
  /** What it is CALLED. The entry's title and shelf-row name. */
  readonly name: string;
  /** One line, for the shelf row and the entry page's sub-heading. */
  readonly summary: string;
  /** The plate shown beside the row and as the page hero — 十〜, 百〜, 〜本. */
  readonly glyph: string;
  /** The teaching prose, as paragraphs, rendered through the lesson's own
   * IntroBody so a construction page reads exactly like a lesson rule card. */
  readonly body: readonly IntroPara[];
  /** The worked examples, shown as a table underneath the prose. */
  readonly examples: readonly IntroExample[];
  /** The generative number-reading round the page's "Quiz me" button launches,
   * scoped to this category (the tens quiz numbers to 99, the 本 quiz counts 本). */
  readonly quizConfig: NumberQuizConfig;
  /** Extra strings search matches but the screen never renders. */
  readonly searchAlso?: readonly string[];
}

// ---------------------------------------------------------------------------
// COUNTER PAGES — derived from the reading engine.
// ---------------------------------------------------------------------------

/** Digit → its kanji, for the equation's left ("三 + 本") and result ("三本"). */
const KANJI_DIGIT = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
/** Digit → its English number word, for the gloss ("three long things"). */
const EN_NUM = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** One counter's whole page metadata: the glyph, the name, what it counts (for
 * the gloss), and its authored sound-behaviour paragraph(s). The attach
 * paragraph and the example table are generated; the sound note is the copy. */
interface CounterSpec {
  readonly kind: CounterKind;
  /** The counter kanji — 人, 本, 匹 … */
  readonly glyph: string;
  readonly name: string;
  /** What one of them is, and what many of them are — for the example gloss. */
  readonly noun: readonly [singular: string, plural: string];
  /** The sound-behaviour paragraph(s), authored per counter. */
  readonly sound: readonly IntroPara[];
  /** Override the generated "how it attaches" paragraph (people, whose low
   * counts are irregular and cannot be shown as the plain rule). */
  readonly attach?: IntroPara;
}

/** counterReading, non-null asserted — every count 1..10 reads for every counter
 * this file lists (all have numberMax ≥ 10). */
function cr(kind: CounterKind, n: number): string {
  return counterReading(n, kind)!;
}

/** The generated "put the number in front" paragraph — two regular low counts
 * (2 and 5 read plainly for every counter here bar 人, which overrides it). */
function attachPara(kind: CounterKind, glyph: string): IntroPara {
  return {
    lead: `Put the number in front of 〜${glyph}.`,
    text: `A count is the plain number said before it: 二${glyph} is ${cr(kind, 2)} and 五${glyph} is ${cr(kind, 5)}.`,
  };
}

/** The example table for a counter — rows 1 to 10, each read off the engine, the
 * shifting counts flagged "(shift)" in the gloss the way NUMBERS_BIG flags its. */
function counterExamples(spec: CounterSpec): IntroExample[] {
  const shifts = new Set(counterIrregulars(spec.kind));
  const [singular, plural] = spec.noun;
  const rows: IntroExample[] = [];
  for (let n = 1; n <= 10; n++) {
    const reading = counterReading(n, spec.kind);
    if (reading === null) continue;
    const shift = shifts.has(n) ? " (shift)" : "";
    rows.push({
      from: `${KANJI_DIGIT[n]} + ${spec.glyph}`,
      to: `${KANJI_DIGIT[n]}${spec.glyph}`,
      reading,
      gloss: `${EN_NUM[n]} ${n === 1 ? singular : plural}${shift}`,
      say: reading,
    });
  }
  return rows;
}

// The ten counters, in the shelf's teaching order: the taught-as-a-system set
// (人 本 匹 枚) first, then the tail (個 台 冊 杯 回 歳). 〜つ is deliberately
// absent: it is native memorisation (ひとつ…とお), not a generative construction,
// so there is no rule to show and no round to launch.
const COUNTER_SPECS: readonly CounterSpec[] = [
  {
    kind: "nin",
    glyph: "人",
    name: "Counting people (〜人)",
    noun: ["person", "people"],
    attach: {
      lead: "Put the number in front of 〜人.",
      text: "Most counts are the plain number said before it: 三人 is さんにん and 五人 is ごにん.",
    },
    sound: [
      {
        lead: "Three counts are their own words.",
        text: "一人 is ひとり, 二人 is ふたり, and 四人 is よにん, never よんにん. Everything else is the plain number plus にん.",
      },
    ],
  },
  {
    kind: "hon",
    glyph: "本",
    name: "Long things (〜本)",
    noun: ["long thin object", "long thin objects"],
    sound: [
      {
        lead: "It hardens after 1, 6, 8 and 10.",
        text: "本 becomes a small っ plus ぽん there, so 一本 is いっぽん and 六本 is ろっぽん. After 3 it voices to ぼん instead, so 三本 is さんぼん. It is the same shift 匹 and 杯 take.",
      },
    ],
  },
  {
    kind: "hiki",
    glyph: "匹",
    name: "Small animals (〜匹)",
    noun: ["small animal", "small animals"],
    sound: [
      {
        lead: "It hardens after 1, 6, 8 and 10.",
        text: "匹 becomes a small っ plus ぴき there, so 一匹 is いっぴき and 六匹 is ろっぴき. After 3 it voices to びき instead, so 三匹 is さんびき. It is the same shift 本 takes.",
      },
    ],
  },
  {
    kind: "mai",
    glyph: "枚",
    name: "Flat things (〜枚)",
    noun: ["flat object", "flat objects"],
    sound: [
      {
        lead: "It never shifts.",
        text: "枚 begins with ま, not an h-sound, so it stays まい after every number: 一枚 is いちまい and 三枚 is さんまい. When a counter starts with an h-sound expect a change; otherwise, like this one, read it straight.",
      },
    ],
  },
  {
    kind: "ko",
    glyph: "個",
    name: "Small objects (〜個)",
    noun: ["small object", "small objects"],
    sound: [
      {
        lead: "It doubles after 1, 6, 8 and 10.",
        text: "A small っ lands before 個 there, so 一個 is いっこ and 六個 is ろっこ. There is no voicing after 3, so 三個 stays さんこ. 冊, 回 and 歳 double the same way.",
      },
    ],
  },
  {
    kind: "dai",
    glyph: "台",
    name: "Machines and vehicles (〜台)",
    noun: ["machine or vehicle", "machines or vehicles"],
    sound: [
      {
        lead: "It never shifts.",
        text: "台 begins with だ, so it stays だい after every number: 一台 is いちだい and 三台 is さんだい. Read every count as the plain number plus だい.",
      },
    ],
  },
  {
    kind: "satsu",
    glyph: "冊",
    name: "Books and volumes (〜冊)",
    noun: ["book or volume", "books or volumes"],
    sound: [
      {
        lead: "It doubles after 1, 8 and 10.",
        text: "A small っ lands before 冊 there, so 一冊 is いっさつ and 八冊 is はっさつ. 六冊 stays regular at ろくさつ, and there is no voicing after 3.",
      },
    ],
  },
  {
    kind: "hai",
    glyph: "杯",
    name: "Cupfuls (〜杯)",
    noun: ["cupful", "cupfuls"],
    sound: [
      {
        lead: "It hardens after 1, 6, 8 and 10.",
        text: "杯 becomes a small っ plus ぱい there, so 一杯 is いっぱい and 六杯 is ろっぱい. After 3 it voices to ばい instead, so 三杯 is さんばい. It is the same shift 本 and 匹 take.",
      },
    ],
  },
  {
    kind: "kai",
    glyph: "回",
    name: "Times (〜回)",
    noun: ["time", "times"],
    sound: [
      {
        lead: "It doubles after 1, 6, 8 and 10.",
        text: "A small っ lands before 回 there, so 一回 is いっかい and 六回 is ろっかい. There is no voicing after 3, so 三回 stays さんかい.",
      },
    ],
  },
  {
    kind: "sai",
    glyph: "歳",
    name: "Years of age (〜歳)",
    noun: ["year old", "years old"],
    sound: [
      {
        lead: "It doubles after 1, 8 and 10.",
        text: "A small っ lands before 歳 there, so 一歳 is いっさい and 八歳 is はっさい. 六歳 stays regular at ろくさい, and there is no voicing after 3. (二十歳, twenty years old, has its own reading はたち.)",
      },
    ],
  },
];

/** The generative round a counter page's "Quiz me" launches: this counter's
 * counts to 99, mixed read / write / hear. */
function counterQuizConfig(kind: CounterKind): NumberQuizConfig {
  return {
    count: 10,
    includeCounters: true,
    counters: [kind],
    numberMax: 99,
    directions: ["read", "write", "hear"],
  };
}

function counterConstruction(spec: CounterSpec): NumberConstruction {
  return {
    id: spec.kind,
    name: spec.name,
    summary: `How to say a count with 〜${spec.glyph}, and how its sound shifts.`,
    glyph: `〜${spec.glyph}`,
    body: [spec.attach ?? attachPara(spec.kind, spec.glyph), ...spec.sound],
    examples: counterExamples(spec),
    quizConfig: counterQuizConfig(spec.kind),
    searchAlso: [spec.kind, `〜${spec.glyph}`, spec.glyph, "counter", "counting"],
  };
}

// ---------------------------------------------------------------------------
// THE PAGES — the two number ranges, then one per counter.
// ---------------------------------------------------------------------------

/** The tens page (11–99), reusing the lesson's own NUMBERS_COMPOSE card. */
const TENS: NumberConstruction = {
  id: "tens",
  name: "Numbers 11–99",
  summary: "Past ten, you build numbers instead of memorising them.",
  glyph: "十〜",
  body: NUMBERS_COMPOSE.body,
  examples: NUMBERS_COMPOSE.examples ?? [],
  quizConfig: {
    count: 10,
    includeCounters: false,
    counters: [],
    numberMax: 99,
    directions: ["read", "write", "hear"],
  },
  searchAlso: [
    "tens",
    "teens",
    "eleven to ninety-nine",
    "じゅう",
    "compose numbers",
    "building numbers",
  ],
};

/** The big page (hundreds and up), reusing the lesson's own NUMBERS_BIG card. */
const BIG: NumberConstruction = {
  id: "big",
  name: "Hundreds and up",
  summary: "The big steps are their own words. Everything between builds from them.",
  glyph: "百〜",
  body: NUMBERS_BIG.body,
  examples: NUMBERS_BIG.examples ?? [],
  quizConfig: {
    count: 10,
    includeCounters: false,
    counters: [],
    numberMax: 9999,
    directions: ["read", "write", "hear"],
  },
  searchAlso: [
    "hundreds",
    "thousands",
    "ten thousand",
    "man",
    "まん",
    "ひゃく",
    "せん",
    "big numbers",
  ],
};

/** Every construction page, in shelf order: the two ranges, then the counters. */
export const NUMBER_CONSTRUCTIONS: readonly NumberConstruction[] = [
  TENS,
  BIG,
  ...COUNTER_SPECS.map(counterConstruction),
];

const BY_ID: ReadonlyMap<string, NumberConstruction> = new Map(
  NUMBER_CONSTRUCTIONS.map((c) => [c.id, c]),
);

const BY_ENTRY: ReadonlyMap<EntryId, NumberConstruction> = new Map(
  NUMBER_CONSTRUCTIONS.map((c) => [numberConstructionEntry(c.id), c]),
);

/** The construction page an entry id names, or undefined. A lookup, never a
 * parse — the same rule every other id resolution in the app follows. */
export function numberConstructionFor(entry: EntryId): NumberConstruction | undefined {
  return BY_ENTRY.get(entry);
}

/** A construction page by its short id — for tests and callers holding the id. */
export function numberConstructionRow(id: string): NumberConstruction | undefined {
  return BY_ID.get(id);
}
