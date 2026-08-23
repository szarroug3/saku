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
// page's breadcrumb reads under "Counting"; every page carries an
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
  type CountBuildPiece,
  type CountRow,
  type IntroCountGroup,
  type IntroPara,
} from "@/data/phase-intros";
import { counterIrregulars, type NumberQuizConfig } from "@/lib/engine/number-quiz";
import {
  acceptableCounterReadings,
  acceptableNumberReadings,
  counterReading,
  numberReading,
  numberToKanji,
  type CounterKind,
} from "@/lib/number-reading";
import {
  NUMBER_CONSTRUCTION_SUBJECT,
  numberConstructionEntry,
} from "@/data/number-construction-id";
import type { EntryId } from "@/types";
// DAY/MONTH are VALUE imports of two more NumberConstruction pages
// (SAK-163's round 2); day-month-construction.ts imports this file's
// `NumberConstruction` TYPE only (erased at compile time, see `import type`
// there), so this is not a runtime circular dependency.
import { DAY, MONTH } from "@/data/day-month-construction";
// SAK-172: はたち's REAL shipped CounterForm, read straight off the curriculum
// (never re-spelled) for 〜歳's Irregular row — the same "byte-correct" rule
// day-month-construction.ts follows reading DAYS/MONTHS off @/data/counters.
// counters.ts does not import this file (only number-construction-id.ts), so
// this is not a cycle either.
import { COUNTER_CURRICULUM, type CounterForm } from "@/data/counters";

export { NUMBER_CONSTRUCTION_SUBJECT, numberConstructionEntry };

/** The subject id, in the same shape as GRAMMAR_CONCEPT_SUBJECT. It is also the
 * URL kind segment (/library/numbers/tens) and the LibEntry kind. */
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
  /** The worked examples, split into "Regular" / "Irregular" groups shown
   * underneath the prose — the grammar regular-vs-irregular treatment. A page
   * with no sound shifts (the tens, 〜枚, 〜台) carries a single group, which the
   * view renders as one untitled table (the title needs a shifting group beside
   * it to earn its place). */
  readonly exampleGroups: readonly IntroCountGroup[];
  /** The generative number-reading round the page's "Quiz me" button launches,
   * scoped to this category (the tens quiz numbers to 99, the 本 quiz counts 本,
   * day/month quiz 1-31/1-12 — src/data/day-month-construction.ts's DAY/MONTH
   * roll through their own engine, day-month-reading.ts, rather than this
   * module's counterReading(); see that file's header for why). Optional only
   * because the interface is shared with a hypothetical reference-only page;
   * every page in NUMBER_CONSTRUCTIONS today sets one, and counter-categories.ts's
   * buildCategory() asserts as much. */
  readonly quizConfig?: NumberQuizConfig;
  /** Extra strings search matches but the screen never renders. */
  readonly searchAlso?: readonly string[];
}

// ---------------------------------------------------------------------------
// COUNTER PAGES — derived from the reading engine.
// ---------------------------------------------------------------------------

/** Digit → its kanji. Used to spell the Word column: 三 in 三本, 十 in 十本. */
const KANJI_DIGIT = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

/** The full kanji spelling of an integer this file shows in the Word column — the
 * tens (11-99) and the big bases (100 … 100000): 十一, 三十四, 二百, 一万, 十万.
 * Delegates to the engine's numberToKanji so the reference tables and the quiz's
 * READ prompt spell a number the one same way. */
function numberKanji(n: number): string {
  return numberToKanji(n);
}

/** One counter's whole page metadata: the glyph, the name, what it counts (for
 * the gloss), and its authored sound-behaviour paragraph(s). The attach
 * paragraph and the example table are generated; the sound note is the copy. */
interface CounterSpec {
  readonly kind: CounterKind;
  /** The counter kanji — 人, 本, 匹 … */
  readonly glyph: string;
  readonly name: string;
  /** What one of them is, and what many of them are — the first column's noun
   * ("1 person" / "3 people", "1 long thin object" / "3 long thin objects"). */
  readonly noun: readonly [singular: string, plural: string];
  /** The sound-behaviour paragraph(s), authored per counter. */
  readonly sound: readonly IntroPara[];
  /** Override the generated "how it attaches" paragraph (people, whose low
   * counts are irregular and cannot be shown as the plain rule). */
  readonly attach?: IntroPara;
  /** Set when the counter's irregular counts are their OWN words rather than a
   * sound-shifted reading of number + counter — 〜人's ひとり / ふたり / よにん. Those
   * rows drop the build equation (a "よん + にん" derivation would be a lie) and
   * show the count mapping straight to the word instead. A sound-shift counter
   * (本, 匹 …) leaves this unset: its equation genuinely shows the shift. */
  readonly suppletive?: boolean;
  /**
   * SAK-172: a suppletive Irregular row OUTSIDE the 1–10 sweep — 〜歳's only
   * case, 二十歳/はたち (count 20). counterGroups' derived 1..10 loop cannot
   * produce this on its own (it only walks counts 1-10, and the reading engine
   * deliberately does not model count 20 for "sai" — see number-reading.test.ts's
   * cross-check skip), so it is appended afterward, straight off the REAL
   * shipped CounterForm (never re-spelled) the same way day-month-
   * construction.ts's dayRow reads 20日's suppletive はつか off DAYS. Undefined
   * for every other counter. */
  readonly extraIrregular?: { readonly count: number; readonly form: CounterForm };
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

/** A counter's bare reading, DERIVED from the engine (never hardcoded): the tail
 * of a regular count once its plain number prefix is stripped — にほん minus に is
 * ほん, さんにん minus さん is にん. Picks the first non-shifting count so a sound
 * change never contaminates the base. This is the "+ ほん" / "+ にん" piece the
 * build equation appends after the number. */
function counterBase(kind: CounterKind): string {
  const shifts = new Set(counterIrregulars(kind));
  for (let k = 2; k <= 10; k++) {
    if (shifts.has(k)) continue;
    const full = counterReading(k, kind);
    const prefix = numberReading(k);
    if (full && full.startsWith(prefix)) return full.slice(prefix.length);
  }
  return counterReading(1, kind) ?? "";
}

/** One counter row: the count with its English noun in column 1, the kanji word
 * with its reading in column 2, and the build "[number] (n) + [counter] → [full]
 * (n)" in column 3. The counter piece carries no numeric annotation; the number
 * and the result carry the count. For a SOUND-SHIFT irregular row the pieces are
 * still the naive number + counter, and the result is the actual shifted reading,
 * so the equation SHOWS the shift the Irregular table exists to teach.
 *
 * A SUPPLETIVE row (〜人's ひとり / ふたり / よにん) has no additive equation to show —
 * the word is not number + counter at all — so its build is empty and the view
 * renders the count mapping straight to the word ("1 → ひとり"). */
function counterRow(n: number, spec: CounterSpec, base: string, suppletive: boolean): CountRow {
  const [singular, plural] = spec.noun;
  const reading = counterReading(n, spec.kind)!;
  return {
    label: `${n} ${n === 1 ? singular : plural}`,
    word: `${KANJI_DIGIT[n]}${spec.glyph}`,
    reading,
    alternateReadings: acceptableCounterReadings(n, spec.kind).filter(
      (candidate) => candidate !== reading,
    ),
    build: suppletive ? [] : [{ kana: numberReading(n), value: String(n) }, { kana: base }],
    result: { kana: reading, value: String(n) },
  };
}

/** One suppletive Irregular row OUTSIDE the 1-10 sweep — 〜歳's はたち (count
 * 20). Like a 〜人 suppletive row (counterRow's `suppletive` branch) and
 * day-month-construction.ts's toBuild for 20日's はつか, there is no additive
 * equation to show: the word is not number + counter at all, so `build` is
 * empty and the view renders the count mapping straight to the word. */
function extraIrregularRow(spec: CounterSpec, count: number, form: CounterForm): CountRow {
  const [, plural] = spec.noun;
  return {
    label: `${count} ${plural}`,
    word: form.glyph,
    reading: form.reading,
    build: [],
    result: { kana: form.reading, value: String(count) },
  };
}

/** The example tables for a counter — counts 1 to 10 split into a Regular table
 * and an Irregular table, the way grammar splits regular conjugation from its
 * exceptions. A count is irregular exactly when counterIrregulars() names it (the
 * sound shift the counter exists to teach); the title carries what "(shift)" used
 * to say inline, and is shown only when both tables exist. A counter with no
 * shifts (〜枚, 〜台) yields only Regular, rendered untitled. `extraIrregular`
 * (only 〜歳's はたち, SAK-172) appends one more Irregular row beyond the 1-10
 * sweep — a genuinely suppletive whole word, the same treatment day-of-month's
 * table already gives 20日's はつか. */
function counterGroups(spec: CounterSpec): IntroCountGroup[] {
  const shifts = new Set(counterIrregulars(spec.kind));
  const base = counterBase(spec.kind);
  const regular: CountRow[] = [];
  const irregular: CountRow[] = [];
  for (let n = 1; n <= 10; n++) {
    if (counterReading(n, spec.kind) === null) continue;
    const isIrregular = shifts.has(n);
    // A suppletive counter's irregular counts are their own words; its regular
    // counts still build additively, so the flag rides only on the shifting rows.
    const suppletive = spec.suppletive === true && isIrregular;
    (isIrregular ? irregular : regular).push(counterRow(n, spec, base, suppletive));
  }
  if (spec.extraIrregular) {
    irregular.push(extraIrregularRow(spec, spec.extraIrregular.count, spec.extraIrregular.form));
  }
  const groups: IntroCountGroup[] = [{ title: "Regular", counter: true, examples: regular }];
  if (irregular.length) groups.push({ title: "Irregular", counter: true, examples: irregular });
  return groups;
}

// ---------------------------------------------------------------------------
// NUMBER-RANGE PAGES (tens, big) — the equations and readings are DERIVED from
// numberReading(), never hardcoded, so a page can never state a reading the app
// does not also ship. The tens page is all regular (no sound shifts); the big
// page splits the plain hundreds/thousands from the five that harden.
// ---------------------------------------------------------------------------

/** The build equation for a big base value — one annotated piece against its base
 * word, then the total. The base word reads whole (にひゃく), so the piece is that
 * whole reading annotated with its decomposition: 200 is "2 × 100", 100 is "100",
 * 100000 is "10 × 10000". The result repeats the reading with the plain total. */
function bigBuild(n: number): { build: CountBuildPiece[]; result: CountBuildPiece } {
  const kana = numberReading(n);
  let value: string;
  if (n < 1000) {
    const m = n / 100;
    value = m === 1 ? "100" : `${m} × 100`;
  } else if (n < 10000) {
    const m = n / 1000;
    value = m === 1 ? "1000" : `${m} × 1000`;
  } else {
    const m = n / 10000;
    value = m === 1 ? "10000" : `${m} × 10000`;
  }
  return { build: [{ kana, value }], result: { kana, value: String(n) } };
}

function bigRow(n: number): CountRow {
  const reading = numberReading(n);
  return {
    label: String(n),
    word: numberKanji(n),
    reading,
    alternateReadings: acceptableNumberReadings(n).filter(
      (candidate) => candidate !== reading,
    ),
    ...bigBuild(n),
  };
}

/** The big page's Regular then Irregular tables. Regular = the plain hundreds,
 * thousands and myriads; Irregular = the five that harden at the seam. */
const BIG_REGULAR = [100, 200, 400, 500, 700, 1000, 2000, 4000, 5000, 7000, 10000, 100000];
const BIG_IRREGULAR = [300, 600, 800, 3000, 8000];

const BIG_GROUPS: readonly IntroCountGroup[] = [
  { title: "Regular", counter: false, examples: BIG_REGULAR.map(bigRow) },
  { title: "Irregular", counter: false, examples: BIG_IRREGULAR.map(bigRow) },
];

/** The tens page's single table — a representative spread 11-99, all regular
 * (past ten there is no sound shift), so it renders untitled. The build is the
 * tens word annotated with its make-up (じゅう is "10", にじゅう is "2 × 10") plus
 * the ones word when present; the result is the whole reading with its total. */
function tensBuild(n: number): { build: CountBuildPiece[]; result: CountBuildPiece } {
  const t = Math.floor(n / 10);
  const o = n % 10;
  const build: CountBuildPiece[] = [
    { kana: numberReading(t * 10), value: t === 1 ? "10" : `${t} × 10` },
  ];
  if (o !== 0) build.push({ kana: numberReading(o), value: String(o) });
  return { build, result: { kana: numberReading(n), value: String(n) } };
}

function tensRow(n: number): CountRow {
  const reading = numberReading(n);
  return {
    label: String(n),
    word: numberKanji(n),
    reading,
    alternateReadings: acceptableNumberReadings(n).filter(
      (candidate) => candidate !== reading,
    ),
    ...tensBuild(n),
  };
}

// The spread includes a ones-place 4, 7 and 9 so every digit with a second
// pronunciation has a worked compound example (34, 47, 99 respectively).
const TENS_SPREAD: readonly number[] = [11, 12, 20, 34, 47, 58, 99];

const TENS_GROUPS: readonly IntroCountGroup[] = [
  { title: "Regular", counter: false, examples: TENS_SPREAD.map(tensRow) },
];

// The ten counters, in the shelf's teaching order: the taught-as-a-system set
// (人 本 匹 枚) first, then the tail (個 台 冊 杯 回 歳). 〜つ is deliberately
// absent: it is native memorisation (ひとつ…とお), not a generative construction,
// so there is no rule to show and no round to launch.
/** 二十歳's real shipped CounterForm (counters.ts's COUNTER_CURRICULUM/TAIL),
 * read once here so the sai spec below and extraIrregularRow never re-spell
 * its glyph/reading. */
const HATACHI: CounterForm = COUNTER_CURRICULUM.find((f) => f.key === "counter:sai:20")!;

const COUNTER_SPECS: readonly CounterSpec[] = [
  {
    kind: "nin",
    glyph: "人",
    name: "Counting people (〜人)",
    noun: ["person", "people"],
    // ひとり / ふたり / よにん are their own words, not number + にん, so their rows
    // show the count → word directly instead of a made-up additive equation.
    suppletive: true,
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
    // SAK-172: 二十歳/はたち folded in as a genuine Irregular row (below), the
    // same treatment day-of-month's table gives 20日's suppletive はつか. The
    // sound paragraph no longer needs its own parenthetical naming it — the
    // table row now says so directly.
    extraIrregular: { count: 20, form: HATACHI },
    sound: [
      {
        lead: "It doubles after 1, 8 and 10.",
        text: "A small っ lands before 歳 there, so 一歳 is いっさい and 八歳 is はっさい. 六歳 stays regular at ろくさい, and there is no voicing after 3.",
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
    exampleGroups: counterGroups(spec),
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
  summary: "Past ten, you build numbers instead of memorizing them.",
  glyph: "十〜",
  body: NUMBERS_COMPOSE.body,
  exampleGroups: TENS_GROUPS,
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
  exampleGroups: BIG_GROUPS,
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

/** Every construction page, in shelf order: the two ranges, the counters, then
 * DAY and MONTH last. They sit at the end because a day/month reading builds
 * on everything above it (a plain number plus にち/がつ), matching
 * counter-lesson.ts's own schedule order — and, like every page above them,
 * they carry a quizConfig and mint their own drillable category fact (see
 * counter-categories.ts); day-month-construction.ts's header explains why
 * that round is rolled through a sibling engine (day-month-reading.ts) rather
 * than this file's shared counterReading(). */
export const NUMBER_CONSTRUCTIONS: readonly NumberConstruction[] = [
  TENS,
  BIG,
  ...COUNTER_SPECS.map(counterConstruction),
  DAY,
  MONTH,
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

// SAK-172: numberConstructionForCounterGlyph (SAK-35) used to let a memorised
// counted form's own standalone page (二十歳) link OUT to its counter's
// construction page (〜歳), which already explained はたち's irregularity in
// prose. That gap is closed differently now: はたち is a genuine Irregular row
// ON the 〜歳 page itself (see the `sai` CounterSpec's `extraIrregular` above),
// and 二十歳 no longer has a standalone page to link FROM (see
// COUNTER_TAIL_FORM_ALIASES in counters.ts and entries.ts's COUNTER_CURRICULUM
// walk). Nothing calls this join any more — counter-entry-view.tsx's Related
// section was its only reader — so it was removed rather than left dead.
