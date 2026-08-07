// A variant form is the shape a character takes when it sits inside a bigger
// kanji: 人 becomes 亻 on the left of 体, 水 becomes 氵 on the left of 海, 心
// becomes 忄 on the left of 情 and ⺗ under 慕. The character is the same; only
// its drawing changes with where it lands.
//
// WHAT THIS MODULE IS FOR
// =======================
// The data has always known which shape is a form of which character — KanjiVG
// records it as `kvg:original`, ingested into the `variants` map (亻→人), and the
// "Built from" row already links 亻 through to 人 (see variantTaughtKanji in
// kanji.ts). What it never did was SAY so: a learner met 亻 linked to 人 with
// nothing telling them the two are one character. This module is the teaching
// side of that map — for a character, the forms it takes (`variantsOf`); for a
// form, the character it belongs to, where it sits, and a kanji it shows up in
// (`variantForm`).
//
// EVERYTHING BUT THE NAME IS DERIVED
// ==================================
//   original  the character the form belongs to — the `variants` map (kvg:original).
//   position  where the form sits inside its host — KanjiVG's `kvg:position`,
//             ingested into `variantPositions`, with a small authored fallback for
//             the handful the source leaves unpositioned.
//   example   a kanji the form appears in — the EARLIEST one in teaching order
//             (order.json) whose components include the form, the base character
//             itself excluded, so the example is a real second character and not
//             the one being taught.
//   name?     the Japanese position-name (にんべん, さんずい). This is the one thing
//             no data source carries, so it is an authored table filled only with
//             names verified by hand. A form with no name is taught positionally
//             ("on the left"), never with a guess.

import kanjiComponentsJson from "./generated/kanji-components.json" with { type: "json" };
import { KANJI, orderRow } from "./kanji";

/** Where a form sits inside its host, from KanjiVG's `kvg:position`. `nyo` is the
 * wrap that runs along the bottom and up the left (辶, 走); `tare` hangs from the
 * top down the left (广, 尸). The panel that renders these turns each into plain
 * words (see variant-forms-panel.tsx). */
export type VariantPosition =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "nyo"
  | "tare";

/** One variant form and everything a lesson says about it. */
export interface VariantForm {
  /** The form as it is written — 亻, 氵, 忄. */
  readonly glyph: string;
  /** The character it is a form of — 人, 水, 心. From the `variants` map. */
  readonly original: string;
  /** Where it sits inside a host character, when known. */
  readonly position?: VariantPosition;
  /** The Japanese position-name, where one is verified and authored. Absent for
   * most forms, which are taught by position instead. */
  readonly name?: string;
  /** A kanji the form appears in — the earliest in teaching order, the base
   * character excluded. Present for every form the map carries (see the test). */
  readonly example?: string;
}

const VARIANTS: Readonly<Record<string, string>> = (
  kanjiComponentsJson as { variants: Record<string, string> }
).variants;

const VARIANT_POSITIONS: Readonly<Record<string, string>> = (
  kanjiComponentsJson as { variantPositions: Record<string, string> }
).variantPositions;

const POSITION_VALUES: ReadonlySet<string> = new Set<VariantPosition>([
  "left",
  "right",
  "top",
  "bottom",
  "nyo",
  "tare",
]);

/**
 * Positions for the forms KanjiVG leaves unpositioned. Five of the fifty-eight
 * carry no `kvg:position` on any host, so the source cannot place them and the
 * ingest emits nothing. These are placed by hand — each is a rare or bound shape,
 * and this keeps the "Built from" note from having to omit the position clause
 * for them.
 */
const FALLBACK_POSITION: Readonly<Record<string, VariantPosition>> = {
  "𦥑": "top", // caps 興 and its kin, two hands over
  "𩵋": "left", // the fish form, on the left
  "匸": "left", // the left-hanging enclosure of 匚
  "厶": "bottom",
  "戍": "right",
};

/**
 * The Japanese position-name of a form, where it is verified. NOT derived: no
 * data source carries these, so this table is authored and holds only names
 * checked by hand. Filling it wrong would teach a learner a name the app made up,
 * so a form absent here is taught by position instead — which is always true and
 * never invented. Keyed on the exact form glyph in the `variants` map.
 */
const NAME: Readonly<Record<string, string>> = {
  "亻": "にんべん",
  "冫": "にすい",
  "刂": "りっとう",
  "扌": "てへん",
  "氵": "さんずい",
  "忄": "りっしんべん",
  "礻": "しめすへん",
  "衤": "ころもへん",
  "王": "おうへん",
  "月": "にくづき",
  "灬": "れっか",
  "攵": "ぼくづくり",
  "艹": "くさかんむり",
  "⺗": "したごころ",
  "⺨": "けものへん",
  "⻖": "こざとへん",
  "⻏": "おおざと",
  "飠": "しょくへん",
  "耂": "おいかんむり",
};

/**
 * The earliest kanji, by teaching order, whose components include each variant
 * form — the form's worked example. The base character is skipped (a host that IS
 * the form's own original would make the example the very character being taught),
 * so the example is always a second, different kanji.
 *
 * Built once from the component lists KanjiVG gives every jōyō kanji. Every form
 * the `variants` map carries resolves one; variant-forms.test.ts pins that.
 */
const EXAMPLE: ReadonlyMap<string, string> = (() => {
  const best = new Map<string, { glyph: string; order: number }>();
  for (const k of KANJI) {
    const order = orderRow(k.c)?.i;
    if (order === undefined) continue;
    for (const c of k.comps) {
      const original = VARIANTS[c];
      if (original === undefined || original === k.c) continue;
      const cur = best.get(c);
      if (!cur || order < cur.order) best.set(c, { glyph: k.c, order });
    }
  }
  const out = new Map<string, string>();
  for (const [c, { glyph }] of best) out.set(c, glyph);
  return out;
})();

/** The position of a form: KanjiVG's, then the authored fallback. Undefined only
 * for a form neither source places, which the panel and the note both tolerate. */
function positionOf(glyph: string): VariantPosition | undefined {
  const raw = VARIANT_POSITIONS[glyph];
  if (raw !== undefined && POSITION_VALUES.has(raw)) return raw as VariantPosition;
  return FALLBACK_POSITION[glyph];
}

/**
 * The form a glyph is, or undefined if it is not a variant form the map names.
 * 亻 → { 人, left, にんべん, 化 }; a plain kanji → undefined.
 */
export function variantForm(glyph: string): VariantForm | undefined {
  const original = VARIANTS[glyph];
  if (original === undefined) return undefined;
  return {
    glyph,
    original,
    position: positionOf(glyph),
    name: NAME[glyph],
    example: EXAMPLE.get(glyph),
  };
}

/** Forms grouped by the character they belong to, so the inverse can be read once
 * at load rather than scanned per call. Ordered by POSITION_ORDER then codepoint,
 * so a multi-form character reads left form first (心 → 忄 then ⺗). */
const POSITION_ORDER: readonly VariantPosition[] = [
  "left",
  "right",
  "top",
  "bottom",
  "nyo",
  "tare",
];

const BY_ORIGINAL: ReadonlyMap<string, readonly VariantForm[]> = (() => {
  const map = new Map<string, VariantForm[]>();
  for (const glyph of Object.keys(VARIANTS)) {
    const form = variantForm(glyph);
    if (!form) continue;
    const list = map.get(form.original);
    if (list) list.push(form);
    else map.set(form.original, [form]);
  }
  const rank = (p: VariantPosition | undefined) =>
    p === undefined ? POSITION_ORDER.length : POSITION_ORDER.indexOf(p);
  for (const list of map.values()) {
    list.sort(
      (a, b) =>
        rank(a.position) - rank(b.position) ||
        (a.glyph.codePointAt(0) ?? 0) - (b.glyph.codePointAt(0) ?? 0),
    );
  }
  return map;
})();

/**
 * The forms a character takes as a component — 人 → [亻], 心 → [忄, ⺗], 水 → [氵,
 * 氺]. Empty for a character with no variant form on file, which is most of them.
 */
export function variantsOf(original: string): readonly VariantForm[] {
  return BY_ORIGINAL.get(original) ?? [];
}
