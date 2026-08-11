// itemHeadline — the one line a Library/Learn header shows for any item, so a
// shared header stays consistent across every content type.
//
// THE RULE (owner's): a big glyph on the left; to its right the HEADLINE (the
// main thing about the item) with a sound button ONLY when the item has one
// unambiguous pronunciation, then the type beneath. No trailing detail — the
// readings/forms/meanings live in the body below, not the header.
//
// So the headline is:
//   - a READING (spoken) for an item with exactly one pronunciation that differs
//     from its glyph — a word (せんせい), a single-reading number (さん), a kana
//     whose glyph is あ but reads "a";
//   - otherwise the MEANING / summary / rule, with NO sound — a many-reading
//     kanji (person), a counter whose glyph already IS its kana reading (one
//     thing), keigo (eat / drink), grammar (want to), a verb pair (open), a
//     sentence tier (its ordering rule).
// A kana-only glyph is still speakable even when its headline is a meaning (you
// can say ひとつ), so `speak` is set there; a kanji/keigo/… headline is not.

import { teachUnitsOf } from "./teach-unit";
import { factInfo } from "@/lib/facts";
import { meaningFactId, kanjiRow } from "@/data/kanji";
import { keigoSetForEntry } from "@/data/keigo";
import { grammarUnitsOf } from "./grammar-unit";
import type { ContentItem } from "./item";

const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ーゝゞ〜]+$/u;

/** The kanji's English meaning, or null — for a verb pair, whose headline is the
 * shared kanji's sense ("open" for 開). */
function kanjiMeaning(glyph: string): string | null {
  if (!kanjiRow(glyph)) return null;
  return factInfo(meaningFactId(glyph))?.meaning ?? null;
}

/** The first definition-fact gloss on the item, or null. */
function firstDefinition(item: ContentItem): string | null {
  const def = item.facts.find((f) => f.kind === "definition");
  return def ? (factInfo(def.id)?.meaning ?? null) : null;
}

export interface Headline {
  /** The main line — a reading or a meaning/summary. */
  readonly text: string;
  /** The glyph to SPEAK when a sound button applies, else null. */
  readonly speak: string | null;
}

export function itemHeadline(item: ContentItem): Headline {
  const units = teachUnitsOf(item);
  const pron = units.filter((u) => u.kind === "pronunciation");

  if (pron.length) {
    const readings = [...new Set(pron.map((u) => u.reading).filter((r): r is string => !!r))];
    const meanings = pron.flatMap((u) => u.meanings.map((m) => m.label));
    // Exactly one reading, and it isn't just the glyph again → show + speak it.
    if (readings.length === 1 && readings[0] !== item.glyph) {
      return { text: readings[0], speak: item.glyph };
    }
    // Many readings (a kanji), or none distinct from the glyph (a kana counter)
    // → the meaning leads; a kana glyph is still speakable.
    return { text: meanings[0] ?? item.glyph, speak: KANA_ONLY.test(item.glyph) ? item.glyph : null };
  }

  // The non-pronunciation kinds: a rule/pattern/set, no single sound.
  switch (item.kind) {
    case "grammar":
      return { text: grammarUnitsOf(item)[0]?.summary ?? item.glyph, speak: null };
    case "sentence-ordering":
      // The tier name IS the glyph ("Simple sentences"); the ordering rule is
      // long and lives in the body, so the header carries no headline line.
      return { text: "", speak: null };
    case "keigo":
      return { text: keigoSetForEntry(item.entry)?.meaning ?? item.glyph, speak: null };
    case "transitivity":
      return { text: kanjiMeaning(item.glyph) ?? item.glyph, speak: null };
    default:
      return { text: firstDefinition(item) ?? item.glyph, speak: null };
  }
}
