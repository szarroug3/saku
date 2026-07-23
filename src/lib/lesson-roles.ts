// What a lesson step actually teaches, when one character teaches several things
// at once.
//
// ONE CHARACTER, SEVERAL ROLES, ONE SCREEN
// ========================================
// The unified spine folds a character's radical card, its kanji card and its
// one-character word into a single step. 人 is all three: a shape other kanji
// are built around, a character with its own readings, and a word with a sound
// and a meaning. The badge on the lesson has said so for a while. The BODY did
// not: the view branched on `LessonItem.kind`, an item carries exactly one kind,
// so a folded character rendered exactly one role's material and the other two
// were promised and never delivered.
//
// So the roles come from `characterRoles` (the one source of role membership)
// and the SECTIONS come from the roles. This module answers both questions as
// plain functions, which is the only way either is testable: the view is a
// client component with no renderer in the unit harness, and the previous
// attempt at pinning its behaviour was a regex over its source.
//
// A STEP KEEPS ITS OWN TRACK'S ROLE. `characterRoles` is pure glyph membership,
// so it says nothing about 学生: no radical row, no kanji row, no one-character
// word. That step is still teaching a word, so its own kind is added back. The
// tables decide the EXTRA roles a step plays; they never take away the one it
// was scheduled for.
//
// EMPTINESS IS DECIDED HERE TOO, from the same helpers the sections themselves
// ask (`teachableParts`, `readingRowsOf`, `usedAsPartIn`, `formsOfWord`). Each
// component already returns null when it has nothing, which is enough to keep a
// hole off the page but not enough to know whether a ROLE has anything to show
// at all, and a role heading over three absent sections is worse than no
// heading.

import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { vocabRow, type VocabRow } from "@/data/vocab";
import { exampleFor } from "@/data/word-examples";
import { ROLE_ORDER, characterRoles, type RoleName } from "@/lib/character-role";
import { teachableParts } from "@/lib/kanji-parts";
import { showsHowItsWritten, type LessonItem } from "@/lib/lesson-items";
import { usedAsPartIn } from "@/lib/library/components";
import { libEntry, readingRowsOf } from "@/lib/library/entries";
import { formsOfWord } from "@/lib/word-forms";

/** The kinds that name a role. A step on one of these tracks plays that role
 * even when the glyph tables have never heard of its glyph. */
const ROLE_KINDS: readonly RoleName[] = ROLE_ORDER;

/**
 * The roles this step teaches, in ROLE_ORDER: the roles the character plays
 * plus, always, the role its own track named.
 */
export function lessonRoles(item: LessonItem): RoleName[] {
  const roles = new Set<RoleName>(characterRoles(item.glyph));
  if ((ROLE_KINDS as readonly string[]).includes(item.kind)) {
    roles.add(item.kind as RoleName);
  }
  return ROLE_ORDER.filter((r) => roles.has(r));
}

/** The word row a step teaches as a word, if it has one. The word's material
 * lives under a different entry than the kanji's (kanji:人 and word:人 are two
 * ids), which is exactly why folding the two left the word side unrendered: the
 * step carries the kanji entry, so the word has to be looked up by glyph. */
export function lessonWord(item: LessonItem): VocabRow | undefined {
  return lessonRoles(item).includes("word") ? vocabRow(item.glyph) : undefined;
}

/**
 * The Library entry holding the CHARACTER's material, which is not always the
 * entry the step arrived on.
 *
 * A step carries one entry id, and a folded character has several: 人 is
 * kanji:人, radical:人 and word:人. The kanji entry is where the meaning and the
 * table of in-word readings live, so a step that reaches this character from the
 * radical track or the words track asks for it by glyph and gets the same
 * material the kanji step shows. Null for a character with no kanji card.
 */
export function kanjiEntryOf(item: LessonItem) {
  if (!kanjiRow(item.glyph)) return null;
  return libEntry(kanjiEntry(item.glyph)) ?? null;
}

/** Every section a step can show, in the order the lesson prints them. The word
 * comes first because it is the most concrete thing a character can be, and the
 * badge's own sentence for a three-role character says the same three things in
 * the same order. */
export const SECTION_ORDER = [
  "word-sense",
  "word-forms",
  "word-readings",
  "word-example",
  "kanji-parts",
  "kanji-readings",
  "radical-kanji",
  "grammar-build",
  "grammar-example",
  "grammar-family",
  "how-its-written",
] as const;

export type LessonSection = (typeof SECTION_ORDER)[number];

/** Which role a section belongs to, for the role headings. The grammar and
 * stroke sections belong to no role: a pattern plays none, and how a character
 * is written is true of the shape however many roles it plays. */
const SECTION_ROLE: Partial<Record<LessonSection, RoleName>> = {
  "word-sense": "word",
  "word-forms": "word",
  "word-readings": "word",
  "word-example": "word",
  "kanji-parts": "kanji",
  "kanji-readings": "kanji",
  "radical-kanji": "radical",
};

/**
 * The sections a step shows, in SECTION_ORDER, with the empty ones already
 * dropped.
 *
 * The one section gated on something other than data is `word-sense`, the
 * reading-and-meaning panel. A word that is only a word says both in its header
 * already (学生 prints "noun · student" beside its reading), so the panel would
 * say them twice. A character with a kanji card spends its header on the
 * character's meaning, and then the panel is the only place the word it also is
 * gets taught.
 */
export function lessonSections(item: LessonItem): LessonSection[] {
  if (item.kind === "transitivity" || item.kind === "keigo") return [];

  const roles = lessonRoles(item);
  const word = roles.includes("word") ? vocabRow(item.glyph) : undefined;
  const out = new Set<LessonSection>();

  if (word) {
    if (roles.includes("kanji") || roles.includes("radical")) out.add("word-sense");
    if (formsOfWord(word)?.length) out.add("word-forms");
    if (word.align?.length) out.add("word-readings");
    if (exampleFor(word.keb)) out.add("word-example");
  }
  if (roles.includes("kanji")) {
    const shape = kanjiEntryOf(item);
    if (teachableParts(item.glyph)) out.add("kanji-parts");
    if (shape && readingRowsOf(shape).length) out.add("kanji-readings");
  }
  if (roles.includes("radical") && usedAsPartIn(item.glyph).length) {
    out.add("radical-kanji");
  }
  if (item.kind === "grammar") {
    out.add("grammar-build");
    out.add("grammar-example");
    out.add("grammar-family");
  }
  // The stroke section follows the shape, so a character that arrived on the
  // words track and turns out to have a kanji card still gets it.
  if (showsHowItsWritten(item.kind) || roles.includes("kanji") || roles.includes("radical")) {
    out.add("how-its-written");
  }

  return SECTION_ORDER.filter((s) => out.has(s));
}

/** Does this role have anything on this step? Drives the role heading, which
 * only appears when a character plays more than one role and only over material
 * that is really there. */
export function roleHasSections(
  role: RoleName,
  sections: readonly LessonSection[],
): boolean {
  return sections.some((s) => SECTION_ROLE[s] === role);
}

/**
 * What KIND of word this is, in a beginner's words: "verb", "noun", "suffix".
 *
 * JMdict's tags are written for a lexicographer ("noun (common) (futsuumeishi)",
 * "Godan verb - -aru special class"), so they are read down to the one word a
 * learner needs. The tail cases earn their line: 人's only vocabulary row is the
 * じん SUFFIX, and an unmatched tag used to come out as "noun", which told a
 * reader that 人 stands alone in a sentence the way 山 does.
 */
export function wordTypeOf(word: VocabRow): string {
  const pos = word.pos[0]?.toLowerCase() ?? "";
  // ADVERB BEFORE VERB, because "adverb" ends in "verb" and 何's lead tag is
  // "adverb (fukushi)". Testing for the verb first called 何 a verb.
  if (pos.includes("adjective")) return "adjective";
  if (pos.includes("adverb")) return "adverb";
  if (pos.includes("verb")) return "verb";
  if (pos.includes("particle")) return "particle";
  if (pos.includes("expression")) return "expression";
  if (pos.includes("suffix")) return "suffix";
  if (pos.includes("prefix")) return "prefix";
  if (pos.includes("pronoun")) return "pronoun";
  if (pos.includes("conjunction")) return "conjunction";
  // "counter" is deliberately not on the list. 山's first tag is `ctr` and 山 is
  // a mountain long before it is a way of counting heaps, so a word whose lead
  // tag is a counter falls through to the noun it also is.
  return "noun";
}

/**
 * Can this step be played out loud?
 *
 * A kana is a sound, and a character that stands alone as a word has one too.
 * This used to be `kind === "kana" || kind === "word"`, which silently muted
 * every folded character: 人 arrives on the kanji track, so it offered no
 * speaker on a screen whose whole subject is a word you can say.
 */
export function canHearItem(item: LessonItem): boolean {
  return item.kind === "kana" || lessonRoles(item).includes("word");
}

/**
 * The one-line reading or meaning under the headword.
 *
 * Read off the Library entry so the walk and the reference cannot disagree. A
 * character with a kanji or radical card leads with the CHARACTER's meaning,
 * taken from the kanji entry whichever track the step arrived on, and when it is
 * also a word its reading is printed beside the speaker instead of here, so the
 * sound is said once and next to the control that plays it.
 */
export function headwordSubtitle(item: LessonItem): string {
  const entry = libEntry(item.entry);
  if (item.kind === "kana") return entry?.readings.join(" · ") ?? "";
  if (item.kind === "grammar") return entry?.meanings[0] ?? "";
  // Transitivity pairs and keigo sets get their own card before the shared
  // hero, so they never ask for a subtitle.
  if (item.kind === "transitivity" || item.kind === "keigo") return "";

  const roles = lessonRoles(item);
  if (roles.includes("kanji") || roles.includes("radical")) {
    // The kanji entry first: a radical that is taught as its own kanji has no
    // radical page in the Library, and a character with no meaning line at all
    // would leave the headword bare.
    const shape = kanjiEntryOf(item) ?? entry;
    return shape?.meanings.slice(0, 4).join(" · ") ?? "";
  }
  if (!entry) return "";
  return [entry.readings[0], entry.meanings.slice(0, 3).join(", ")]
    .filter(Boolean)
    .join(": ");
}
