// What a lesson step actually teaches, when one character teaches several things
// at once.
//
// ONE CHARACTER, SEVERAL ROLES, ONE SCREEN
// ========================================
// The unified spine folds a character's radical card, its kanji card and its
// one-character word into a single step. 人 is all three: a shape other kanji
// are built around, a character with its own readings, and a word with a sound
// and a meaning. A badge on the lesson said so for a while (the role headings
// say it now, and the badge is gone). The BODY did
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
// ask (`teachableParts`, `formsOfWord`, `splitsIntoKanji`). Each component already
// returns null when it has nothing, which is enough to keep a hole off the page
// but not enough to know whether a ROLE has anything to show at all, and a role
// heading over three absent sections is worse than no heading.
//
// A LESSON IS NOT THE LIBRARY, AND THIS IS WHERE THEY PART
// =======================================================
// Folding three cards into one step made the step carry all three cards' worth
// of material, and for 人 that came to a sense table, a sound explainer, an
// example sentence, five rows of in-word readings and a list of the kanji built
// on the shape. The owner's read of it: fine on a page you went looking for,
// too much on a page you were handed.
//
// So this function answers for the LESSON only, and it answers smaller. The list
// of kanji built on the shape is the Library's alone: an exhaustive catalogue,
// 22 entries deep for 人, that you consult once you already know the character.
// What the lesson keeps in its place is the point of each role, said in a line
// (see RoleBlock), plus the character's own definition.
//
// THE TABLE OF IN-WORD READINGS IS THE LIBRARY'S, and stays there: "for the
// lesson i don't want the kanji readings. just keep the meaning of the kanji and
// then the definition of it as a word and how to say it." So the kanji block is
// a line and a definition, and there is no `kanji-readings` section.
//
// WHICH IS ALSO WHY THE SENSE TABLE LEFT THE WORD BLOCK. It sat under "Word"
// listing ひと, じん and にん, which says you can say じん by itself. You cannot:
// じん and にん are bound, they only ever occur welded into a longer word. What is
// left in the word block is the readings that genuinely stand alone, which is
// one for 人 and four for 主; see `standaloneSenses`.
//
// AND THE BREAKDOWN NARROWED TO COMPOUNDS. `word-built-from` is the Library's
// "Built from" box, asked for by name for the case it answers: 問題 is 問 もん
// and 題 だい, and which character is making which sound is a real question about
// a word written with several of them. A word written with one kanji has no such
// question, so the section is gated on there being two; see `splitsIntoKanji`.
//
// The Library entry page never called this function and still does not — it
// assembles its own sections from `KanjiReadings` and `ComponentUses` — so the
// divergence needed no flag threaded through a shared component. It is simply
// that this list got shorter and that one did not.

import { kanjiEntry, kanjiRow } from "@/data/kanji";
import { radicalByGlyph } from "@/data/radicals";
import { vocabRow, type VocabRow, type WordSense } from "@/data/vocab";
import { ROLE_ORDER, characterRoles, type RoleName } from "@/lib/character-role";
import { teachableParts, type KanjiPart } from "@/lib/kanji-parts";
import { showsHowItsWritten, type LessonItem } from "@/lib/lesson-items";
import { libEntry } from "@/lib/library/entries";
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

/** What the character means as a character, from the kanji entry, whichever
 * track the step arrived on. Empty for a step with no kanji card. */
export function kanjiMeanings(item: LessonItem): readonly string[] {
  return kanjiEntryOf(item)?.meanings ?? [];
}

/**
 * The readings of a one-character word you can actually say ON THEIR OWN.
 *
 * 人 has three readings on file and only ひと is a word: じん is the -ian suffix
 * and にん counts people, and both are BOUND — they exist only welded into
 * something longer (外国人, 三人). Printing all three under "Word" told a reader
 * that 人 said じん is a thing you can utter, which it is not.
 *
 * THE RULE IS "SHARES A PART OF SPEECH WITH THE PRIMARY", NOT A LIST OF BOUND
 * TAGS. The obvious implementation — drop anything tagged suffix or counter — is
 * wrong on the data: 山, 手, 口 and 川 all carry a counter tag and are four of the
 * plainest standalone nouns in the language (see wordTypeOf, which already had to
 * work around exactly this). So no tag is read as bound in isolation. A sense
 * qualifies when it shares at least one tag with `senses[0]`, the reading the
 * word is filed and drilled under: it is the same KIND of word as the one that
 * demonstrably stands alone.
 *
 * It keeps 主 whole, which is the case that kills every one-reading shortcut:
 * あるじ, おも, しゅ and ぬし are four real words, all four carrying the noun tag
 * the primary carries, and all four come back. 中 keeps なか and ちゅう and drops
 * じゅう, which is tagged suffix and nothing else.
 *
 * Never empty: the primary is always in, by construction.
 */
export function standaloneSenses(word: VocabRow): readonly WordSense[] {
  const [primary, ...rest] = word.senses;
  if (!primary) return [];
  const free = new Set(primary.pos.map((p) => p.toLowerCase()));
  return [primary, ...rest.filter((s) => s.pos.some((p) => free.has(p.toLowerCase())))];
}

/** Every section a step can show, in the order the lesson prints them.
 *
 * THE RADICAL COMES FIRST NOW, THEN THE KANJI, THEN THE WORD — ROLE_ORDER, the
 * ladder the concept cards teach and the composite label on the lesson card
 * spells out: radicals build kanji, kanji build words. It used to run the other
 * way, word first, on the reasoning that a word is the most concrete thing a
 * character can be. That put the page's order at odds with every other place the
 * app names these three, and a reader of 人 met "As a word / As a kanji / As a
 * building block" under a badge reading "Radical · Kanji · Word": the same three
 * things, in reverse, in different words. Smallest-first, and one vocabulary.
 *
 * `radical-note` is the odd one: it has no panel behind it. Since the lesson
 * stopped listing the kanji built on the shape, the radical role has no material
 * left, and a role the page names and never explains is the gap that started all
 * of this. So the role's block is its heading and its one line, and this entry is
 * how a role with nothing under it still claims one. `roleHasSections` is the
 * only thing that reads it. */
export const SECTION_ORDER = [
  "radical-note",
  "kanji-meaning",
  "kanji-parts",
  "word-sense",
  "word-forms",
  "word-built-from",
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
  "radical-note": "radical",
  "kanji-meaning": "kanji",
  "kanji-parts": "kanji",
  "word-sense": "word",
  "word-forms": "word",
  "word-built-from": "word",
};

/**
 * Is this word written with more than one KANJI, so that taking it apart says
 * something the word itself does not?
 *
 * MULTI-KANJI, NOT MULTI-CHARACTER, and the difference is 食べる. The old rule
 * asked whether the written form was longer than one character, so 食べる passed
 * on the strength of its okurigana and got a breakdown with one row in it: 食 is
 * た. The owner asked for the breakdown "only for multi-kanji words", and one row
 * is the shape she is ruling out — there is no split to see when there is one
 * piece. 問題 is the case it exists for: 問 もん beside 題 だい, plus the line
 * naming the pattern the pair follows.
 *
 * So the count is of kanji, off `align` (the per-character [character, in-word,
 * base] table vocab.ts ships, which has one entry per kanji and none for kana).
 * No align at all means a word that cannot be split — the jukujikun, where おとな
 * belongs to 大人 and to neither character — and those show nothing either.
 */
function splitsIntoKanji(word: VocabRow): boolean {
  return (word.align?.length ?? 0) > 1;
}

/**
 * The sections a step shows, in SECTION_ORDER, with the empty ones already
 * dropped.
 *
 * `word-sense`, the reading-and-meaning panel, is the one section gated on
 * something other than data: a word that is only a word says both in its header
 * already (学生 prints "noun · student" beside its reading), so the panel would
 * say them twice. A character with a kanji card spends its header on the
 * character's meaning, and then the panel is the only place the word it also is
 * gets taught.
 *
 * `kanji-meaning` and `radical-note` USED TO BE gated on the step playing
 * several roles, on the reasoning that a lone kanji's definition is the headword
 * line an inch above and the badge in the corner already says what a kanji is
 * for. The badge is gone, and its job passed to the role headings, so a role now
 * has to be able to claim its block on a step where it is the only role: 乞 is a
 * kanji and nothing else, and the heading over its definition is the only thing
 * on the page that tells the reader so. The headword repeats one word; the
 * alternative repeated nothing and named nothing.
 */
export function lessonSections(item: LessonItem): LessonSection[] {
  if (item.kind === "transitivity" || item.kind === "keigo") return [];

  const roles = lessonRoles(item);
  const word = roles.includes("word") ? vocabRow(item.glyph) : undefined;
  const out = new Set<LessonSection>();

  if (word) {
    if (roles.includes("kanji") || roles.includes("radical")) out.add("word-sense");
    if (formsOfWord(word)?.length) out.add("word-forms");
    // "Built from" only when there are pieces to see. 電車 is 電 でん plus 車
    // しゃ and the box is the answer to which character is making which sound;
    // 人 has one character and 食べる has one kanji, and for both the box would
    // be the word handed back with a border round it.
    if (splitsIntoKanji(word)) out.add("word-built-from");
  }
  if (roles.includes("kanji")) {
    if (kanjiMeanings(item).length) out.add("kanji-meaning");
    if (teachableParts(item.glyph)) out.add("kanji-parts");
  }
  if (roles.includes("radical")) out.add("radical-note");
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

/**
 * What "how it's written" can honestly say about a glyph with no stroke diagram
 * ingested: its component breakdown, its stroke count, or nothing but that it is
 * learned whole.
 *
 * IT LIVES HERE BECAUSE IT IS A ROLE QUESTION, AND IT WAS ANSWERED AS A KIND ONE.
 * The component used to ask `item.kind === "kanji"` for the breakdown and the
 * count, and `item.kind === "radical"` for the radical's count. A step carries
 * one kind and the folded curriculum picks it by whichever role the character was
 * scheduled as, so 人 reached on the words track matched neither branch and got
 * "Learned as a whole shape" for a character with a stroke count on file. Same
 * class of bug as the sections had, same fix: read the role set.
 *
 * `reference` is the Library entry page, which suppresses the breakdown because
 * its Links card already carries a "Made of" row.
 */
export type StrokeFallback =
  | { show: "parts"; parts: KanjiPart[] }
  | { show: "strokes"; strokes: number }
  | { show: "whole" };

export function strokeFallbackOf(item: LessonItem, reference = false): StrokeFallback {
  const roles = lessonRoles(item);
  const isKanji = roles.includes("kanji");
  const parts = isKanji && !reference ? teachableParts(item.glyph) : null;
  if (parts) return { show: "parts", parts };
  const strokes =
    (isKanji ? kanjiRow(item.glyph)?.strokes : undefined) ??
    (roles.includes("radical") ? radicalByGlyph(item.glyph)?.strokes : undefined);
  if (strokes !== undefined) return { show: "strokes", strokes };
  return { show: "whole" };
}

/** Does this role have anything on this step? Drives the role block, which
 * appears over material that is really there. Every role a character plays now
 * has at least its own line to show, so this comes back true for each of them;
 * it still answers honestly for a role the character does not play, which is
 * what the view asks it. */
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
 * learner needs. The tail cases earn their line: 人 read じん is a SUFFIX, and an
 * unmatched tag used to come out as "noun", which told a reader that 人 in that
 * reading stands alone in a sentence the way 山 does.
 *
 * Takes anything carrying `pos`, so the sense table can label each of 人's three
 * readings — noun, suffix, counter — from the one implementation.
 */
export function wordTypeOf(word: Pick<VocabRow, "pos">): string {
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
  // "counter" is deliberately not tested on the LEAD tag. 山's first tag is
  // `ctr` and 山 is a mountain long before it is a way of counting heaps, so a
  // word whose lead tag is a counter falls through to the noun it also is. A
  // sense that is nothing BUT a counter is a different case and says so: 人 read
  // にん counts people and is not a word you can put in a sentence alone.
  if (word.pos.length && word.pos.every((p) => p.toLowerCase().includes("counter"))) {
    return "counter";
  }
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
