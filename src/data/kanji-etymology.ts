// The FUNCTION each component plays in a kanji — semantic (it carries the
// meaning), phonetic (it once carried the sound), or form (a structural shell) —
// and the SENSE of the component that applies. Parsed from English Wiktionary's
// Translingual `{{Han compound}}` glyph-origin markup by
// scripts/ingest/kanji-etymology.mjs into generated/kanji-etymology.json.
//
// WHY THIS IS A SEPARATE LAYER FROM "Built from"
// ==============================================
// The app already knows the SHAPES a kanji is drawn from — KanjiVG's depth-1
// decomposition, in `KanjiRow.comps` (河 = 氵 + 可, 明 = 日 + 月). What it never
// knew is what each shape is DOING there. Wiktionary's glyph origin is the
// source that says: in 河, 氵 is semantic (water) and 可 is only the sound; in
// 明, both 日 and 月 are semantic (sun, moon).
//
// This module joins the two. It does NOT replace `comps`; it annotates it. The
// join is BY GLYPH, normalising the radical/variant forms so KanjiVG's 氵 meets
// Wiktionary's 水 and KanjiVG's flesh 月 meets Wiktionary's 肉/⺼. A shape piece
// is labelled ONLY when it matches a Wiktionary component — the discipline this
// whole codebase keeps: an unmatched piece is left unlabelled, never guessed.
//
// The 服 case is the reason that rule is load-bearing. Wiktionary derives 服
// from 凡 + 𠬝; its visible 月 is a late corruption of 舟, matching NEITHER
// component. So 服's 月 gets no label here — the honest answer — rather than
// being mislabelled "flesh" because a 月 happens to be on the page.
//
// LICENCE: the DATA (generated/kanji-etymology.json) is CC BY-SA, derived from
// Wiktionary. This CODE is MIT like the rest of src/. See src/data/attribution.ts.

import etymologyJson from "./generated/kanji-etymology.json" with { type: "json" };
import kanjiComponentsJson from "./generated/kanji-components.json" with { type: "json" };
import { kanjiRow, READINGS } from "./kanji";

/** What a component contributes to the kanji it sits in. */
export type ComponentFunction = "semantic" | "phonetic" | "form";

/** One component of a kanji, as Wiktionary's glyph origin describes it. `glyph`
 * is the component's canonical character (肉, not the display form ⺼); `function`
 * is null when the source names the component but not its role. */
export interface EtymologyComponent {
  readonly glyph: string;
  readonly function: ComponentFunction | null;
  readonly sense: string | null;
}

/** A kanji's glyph origin: the overall structure `type` (phono-semantic,
 * ideogrammic, pictographic, …), the components it is built from, and the
 * plain-language explanation from Wiktionary's Glyph-origin section. */
export interface KanjiEtymology {
  readonly type: string | null;
  readonly components: readonly EtymologyComponent[];
  /** The Glyph-origin section's raw wikitext, kept so nothing upstream is lost
   * and a later pass can re-clean it. Not for display. */
  readonly originRaw: string | null;
  /** A mechanically cleaned, learner-facing version of `originRaw`: markup and
   * scholarly reconstructions stripped, the dictionary's own wording kept. Null
   * when nothing readable survived. Some run long or still read awkwardly — a
   * human/LLM pass is expected to polish these before they surface. */
  readonly originText: string | null;
}

/** The role a specific KanjiVG shape piece plays, once matched to a Wiktionary
 * component. Only produced for pieces that matched AND whose role is known. */
export interface PieceRole {
  /** The shape piece as it appears in `KanjiRow.comps` (the drawn form, e.g. 氵). */
  readonly piece: string;
  /** semantic / phonetic / form. */
  readonly function: ComponentFunction;
  /** The applicable sense of the component, when Wiktionary gives one. */
  readonly sense: string | null;
  /** The Wiktionary component this piece matched (the canonical form, e.g. 水). */
  readonly matched: string;
}

const RAW: Readonly<Record<string, KanjiEtymology>> = (
  etymologyJson as { data: Record<string, KanjiEtymology> }
).data;

/** KanjiVG's variant form → the character it is a form of (亻→人, 氵→水, 月→肉). */
const VARIANTS: Readonly<Record<string, string>> = (
  kanjiComponentsJson as { variants: Record<string, string> }
).variants;

/**
 * Radical/variant forms Wiktionary writes with a DIFFERENT codepoint than the
 * one KanjiVG uses, collapsed to a shared representative so the two sides of the
 * join meet. The `variants` map above already handles KanjiVG's own forms; this
 * fills the gap on Wiktionary's side — chiefly the CJK Radicals Supplement block
 * (⺼, ⺡, …) and a few base-radical characters (辵, 艸) Wiktionary prefers over
 * the everyday form. Every entry maps a form to the SAME target the `variants`
 * map (or plain identity) would give the everyday form, so nothing new is
 * invented: it only lets 肝's ⺼ reach the 肉 that KanjiVG's 月 also reaches.
 */
const EXTRA_FORMS: Readonly<Record<string, string>> = {
  "⺼": "肉", // CJK radical MEAT → flesh (KanjiVG 月 → 肉 via variants; meet there)
  "⺡": "水", // CJK radical WATER ONE → water
  "氵": "水", // (also in variants; kept explicit)
  "每": "毎", // orthodox 每 ↔ shinjitai 毎 (Wiktionary writes 每; KanjiVG draws 毎)
  "靑": "青", // orthodox 靑 ↔ shinjitai 青
  "⺾": "艸", // CJK radical GRASS forms → grass
  "艹": "艸", // everyday grass top → 艸 (Wiktionary's grass component)
  "⺻": "聿",
  "⺗": "心", // bottom heart
  "忄": "心", // left heart
  "辶": "辵", // walk radical everyday → 辵 (Wiktionary's base)
  "⻌": "辵",
  "⻍": "辵",
  "𠆢": "人",
  "⺅": "人",
  "王": "玉", // king-radical form of jade
  "礻": "示",
  "衤": "衣",
  "钅": "金",
  "飠": "食",
  "⻞": "食",
  "纟": "糸",
};

/** Collapse a glyph to the representative both sides of the join agree on.
 * Follows the KanjiVG variants map and the Wiktionary-form table, transitively
 * (氵 → 水; ⺼ → 肉; 辶 → 辵), with a small guard against cycles. */
function canonical(glyph: string): string {
  let g = glyph;
  for (let i = 0; i < 4; i++) {
    const next = EXTRA_FORMS[g] ?? VARIANTS[g];
    if (next === undefined || next === g) break;
    g = next;
  }
  return g;
}

/** A kanji's raw glyph origin, or undefined when Wiktionary carries none. */
export function etymologyOf(kanji: string): KanjiEtymology | undefined {
  return RAW[kanji];
}

/**
 * The role of each of a kanji's KanjiVG shape pieces, in the order `comps` lists
 * them. An entry is null when that piece did not match any Wiktionary component
 * (or matched one whose role Wiktionary leaves unstated) — the unlabelled pieces
 * the brief insists stay unlabelled rather than be guessed.
 *
 * Matching is by canonical glyph, each Wiktionary component consumed at most
 * once so repeated pieces (林 = 木 + 木) each claim their own.
 */
export function builtFromRoles(kanji: string): readonly (PieceRole | null)[] {
  const row = kanjiRow(kanji);
  const etym = RAW[kanji];
  const pieces = row?.comps ?? [];
  if (!etym) return pieces.map(() => null);

  const remaining = etym.components.map((c) => ({
    canon: canonical(c.glyph),
    fn: c.function,
    sense: c.sense,
    used: false,
  }));

  return pieces.map((piece) => {
    const pc = canonical(piece);
    const hit = remaining.find((r) => !r.used && r.canon === pc);
    if (!hit) return null;
    hit.used = true;
    if (hit.fn === null) return null; // matched, but role unknown → leave unlabelled
    return { piece, function: hit.fn, sense: hit.sense, matched: hit.canon };
  });
}

/** True when Wiktionary gives this kanji a glyph origin we could parse. */
export function hasEtymology(kanji: string): boolean {
  return kanji in RAW;
}

// ── Phonetic reading: the sound a phonetic component lends its host ──────────
//
// A phonetic component was chosen, historically, because it SOUNDS like the
// whole character: 河 (か) takes 可 (か), 校 (こう) takes 交 (こう). The reading a
// learner should see beside the sound piece is therefore the component's
// on-reading that ALSO reads the host — derived here from the app's own readings
// data (READINGS), never invented. When no on-reading is shared (the sound
// drifted over three thousand years, or the component is non-jōyō and outside
// our readings data), the label is null: the piece is still shown as phonetic,
// just without a reading we can stand behind.

/** A kanji's on-readings (on'yomi, plus the handful KANJIDIC2 files as both). */
const ON_READINGS: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const map = new Map<string, Set<string>>();
  for (const r of READINGS) {
    if (r.type !== "on" && r.type !== "both") continue;
    const set = map.get(r.k) ?? new Set<string>();
    set.add(r.base);
    map.set(r.k, set);
  }
  return map;
})();

function onReadingsOf(k: string): ReadonlySet<string> {
  return ON_READINGS.get(k) ?? ON_READINGS.get(canonical(k)) ?? new Set();
}

/**
 * The reading a phonetic `piece` lends its `host`: the component on-reading that
 * also reads the host. Null when they share none (drifted sound) or the
 * component has no reading in our data (non-jōyō phonetic).
 */
export function phoneticReading(host: string, piece: string): string | null {
  const hostOns = onReadingsOf(host);
  if (hostOns.size === 0) return null;
  for (const r of onReadingsOf(piece)) if (hostOns.has(r)) return r;
  return null;
}

/** One shape piece a learner is shown, with its role and the one-word label the
 * UX puts beside it: the sense for a meaning piece, the lent reading for a sound
 * piece (null when it can't be derived). */
export interface BuiltPiece {
  /** The piece as drawn (the KanjiVG form, e.g. 氵). */
  readonly glyph: string;
  readonly role: "semantic" | "phonetic";
  /** Sense gloss (semantic) or lent reading (phonetic); null when unavailable. */
  readonly label: string | null;
}

/**
 * A kanji's shape pieces that CARRY a glyph-origin role, in `comps` order —
 * the semantic and phonetic pieces, each with its display label. Form pieces and
 * pieces that matched no Wiktionary component are dropped (this is the UX
 * lookup; `builtFromRoles` is the lower-level aligned view that keeps the nulls).
 */
export function builtPieces(kanji: string): readonly BuiltPiece[] {
  const out: BuiltPiece[] = [];
  for (const role of builtFromRoles(kanji)) {
    if (!role || role.function === "form") continue;
    out.push({
      glyph: role.piece,
      role: role.function,
      label:
        role.function === "phonetic"
          ? phoneticReading(kanji, role.piece)
          : role.sense,
    });
  }
  return out;
}
