// Where a radical's variant sits in a kanji, worked out from its bushu name.
// Moved here from lib/library/character-entry-content.ts (SAK-398): teach.ts
// was the only thing on a page that still read it, and reaching for it there
// pulled the old content library onto every Sky route.

export const POSITION: Record<string, { en: string; rank: number }> = {
  "": { en: "Alternate", rank: 0 },
  kanmuri: { en: "Top", rank: 1 },
  hen: { en: "Left", rank: 2 },
  tsukuri: { en: "Right", rank: 3 },
  ashi: { en: "Bottom", rank: 4 },
  nyou: { en: "Bottom Left", rank: 5 },
};

/**
 * Bushu (radical) position names are standard Japanese terminology, not
 * something invented for this codebase: a variant's kana name reliably ends
 * (or, for あし, sometimes starts) with a suffix naming where it sits in the
 * character — へん (left), つくり (right), かんむり/がしら (top), あし/した
 * (bottom), にょう (bottom-left). Checked as exact suffixes/prefixes, longest
 * first, so e.g. a name ending in にょう is never mistaken for one ending in
 * simply う, and a name that happens to contain "へん" mid-string (there are
 * none in the current data, but nothing here should assume that) is not
 * matched unless it's the actual trailing morpheme.
 *
 * へん and つくり also each have a voiced (rendaku) spelling — べん and づくり
 * — that shows up after certain preceding sounds (亻 is にんべん, not
 * "にへん"; 攵 is ぼくづくり, not "ぼくつくり"), so both spellings are checked.
 * A few bushu names are genuine historical exceptions that don't carry any
 * positional suffix at all despite having a position (さんずい for 氵,
 * りっとう for 刂, れっか for 灬, ひとやね for 𠆢) — those rely on the
 * enrichment JSON's explicit `position` field and always have one; this
 * function is only ever reached when no explicit field exists.
 */
export function derivePosition(nameKana: string): { en: string; rank: number } {
  if (nameKana.endsWith("にょう")) return POSITION.nyou;
  if (nameKana.endsWith("へん") || nameKana.endsWith("べん")) return POSITION.hen;
  if (nameKana.endsWith("つくり") || nameKana.endsWith("づくり")) return POSITION.tsukuri;
  if (nameKana.endsWith("がしら") || nameKana.endsWith("かんむり")) return POSITION.kanmuri;
  if (nameKana.startsWith("した") || nameKana.endsWith("あし")) return POSITION.ashi;
  return POSITION[""];
}
