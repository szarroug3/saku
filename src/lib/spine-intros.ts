// The three concept cards the curriculum spine owes, and when each is due.
//
// WHAT BROKE, AND WHY THE OLD GATE COULD NOT SURVIVE THE SPINE
// ===========================================================
// "What a radical is", "What kanji are" and "What this track teaches" used to be
// TRACK intros: track-open.ts walked history, read each met fact's SUBJECT, and
// a track whose subject appeared nowhere was a track about to open. That worked
// while the three were separate tracks that opened at separate moments.
//
// On one spine they are not tracks any more, and the subject gate fails twice
// over:
//
//   1. A subject is no longer a track. Radicals, kanji and words arrive in the
//      same lesson, so "the kanji subject has never been touched" stops being
//      the question. What a learner needs explained is the ROLE the thing in
//      front of them plays.
//   2. It was poisoned on day one. The very first lesson teaches 人, which is a
//      word, and starting it unlocks the kanji READINGS that word proves (see
//      word-unlock.ts and startCurriculumLesson in home-feed.tsx). Those are
//      `kanji` facts, they are marked seen BEFORE the walk renders, and they are
//      not part of the teach set the gate excludes. So the gate read the kanji
//      subject as already touched at the exact moment the kanji card was due,
//      and both the kanji and the radical card went missing for good. That is
//      the reported regression.
//
// AN ANCHOR, NOT A SUBJECT SCAN
// =============================
// CURRICULUM_SEQUENCE already carries the answer: each item says which roles it
// plays. So each card is ANCHORED to one item, the FIRST in the whole sequence
// carrying that role, exactly the way a phase intro is anchored to the first
// word that puts its rule in play. The anchor is a property of the shipped data
// and is computed once here.
//
// A card fires when the walk reaches its anchor and nowhere else. That alone
// gives "exactly once, in the first lesson that introduces the role, before the
// item", with nothing to keep in step and nothing a stray fact can poison: no
// other lesson contains the anchor, so no other lesson can show the card.
//
// HISTORY IS THE RE-TEACH GATE, AND IT READS ONE ITEM
// ===================================================
// The anchor pins WHERE. History answers whether the learner has already been
// there: if the anchor item has been learned outside the lesson in hand, the
// card has done its job and stays quiet. That is the same once-ever guarantee
// the track gate gave, and it keeps the same deliberate exception the rest of
// the app's concept cards keep: a learner who resets and re-walks the opening
// lesson sees the cards again, because the alternative is dropping someone into
// 人 亅 丁 with the word "radical" undefined (see the head of track-open.ts).
//
// The gate reads the anchor's own MEANING facts, and only those. Not "any fact
// whose glyph is the anchor", which is what would let an unlocked reading like
// `kanji:人/reading@外国人` stand in for having been taught 人. Being taught an
// item is its meaning being met; a reading is something a later word proves.

import { meaningFactId } from "@/data/kanji";
import { radicalMeaningFactId } from "@/data/radicals";
import { wordMeaningFactId } from "@/data/vocab";
import { TRACK_INTROS } from "@/data/track-intros";
import type { PhaseIntro } from "@/data/phase-intros";
import { effectiveState } from "@/lib/claims";
import { CURRICULUM_SEQUENCE, type CurriculumRole } from "@/lib/curriculum-order";
import { ROLE_ORDER } from "@/lib/character-role";
import type { FactId, HistoryFile } from "@/types";

/** One card, and the item that owes it. */
export interface SpineAnchor {
  /** The role this card explains. */
  role: CurriculumRole;
  /** The glyph the card fires ahead of. See ANCHOR_RULE. */
  glyph: string;
  /**
   * The facts that mean "this item has been taught": the meaning fact of every
   * role it plays. A folded item like 人 has two (its kanji meaning and its word
   * meaning), and either one being met is the learner having been there.
   */
  facts: readonly FactId[];
  intro: PhaseIntro;
}

/** The meaning facts of one item, by the roles it plays. A radical that is also
 * a kanji is taught as its kanji, so it mints no radical meaning fact, which is
 * the same call curriculum-lesson.ts makes when it builds the lesson. */
function meaningFacts(glyph: string, roles: readonly CurriculumRole[]): FactId[] {
  const facts: FactId[] = [];
  if (roles.includes("kanji")) facts.push(meaningFactId(glyph));
  else if (roles.includes("radical")) facts.push(radicalMeaningFactId(glyph));
  if (roles.includes("word")) facts.push(wordMeaningFactId(glyph));
  return facts;
}

/** A written form containing at least one kanji. */
const HAS_KANJI = /\p{Script=Han}/u;

/**
 * WHERE EACH CARD FIRES: the first item the role is the POINT of, and not merely
 * the first item the role is true of.
 *
 * The first cut of this module anchored each card to the first item carrying the
 * role at all. Every one of those is the very first item of the sequence, which
 * plays all three roles at once, so a learner met three full-screen explainers
 * before the first four characters and each one landed where its own copy was
 * only half true. Each rule below picks the first item where the card has
 * something real to point at, which is the doctrine the rest of the walk's cards
 * already follow (okurigana waits for the first fixed tail, rendaku for the first
 * voiced seam).
 *
 *   KANJI   the first item taught as a kanji. Unchanged: a kanji is exactly what
 *           this item is, and it opens the whole curriculum.
 *   RADICAL the first item that is a radical and NOTHING ELSE. This is the card
 *           that has to explain that "radical" describes what other kanji are
 *           built from and says nothing about standing alone. On a character that
 *           is also a kanji and also a word, that point is invisible; on a shape
 *           that is only ever a part, it is the shape in front of you.
 *   WORD    the first word written with kanji that is not a single kanji folded
 *           into its own character. A one-character word is the kanji you have
 *           just been taught wearing a second label, and the card's whole subject
 *           is that a word waits for the characters it is spelled with, which
 *           nothing has waited for yet. The first written form built out of
 *           characters already in hand is where that is true.
 *
 * Each falls back to the plain "carries the role" item if its rule matches
 * nothing, so a re-cut curriculum degrades to an early card and never to a
 * missing one.
 */
const ANCHOR_RULE: Readonly<
  Record<CurriculumRole, (item: (typeof CURRICULUM_SEQUENCE)[number]) => boolean>
> = {
  kanji: (it) => it.roles.includes("kanji"),
  radical: (it) => it.roles.length === 1 && it.roles[0] === "radical",
  word: (it) =>
    it.roles.includes("word") && !it.roles.includes("kanji") && HAS_KANJI.test(it.glyph),
};

/**
 * The order the cards are emitted in when more than one comes due at the same
 * item: DOWN THE HIERARCHY, each card introducing what the thing above it is
 * built from.
 *
 * Words are what a learner is here for, kanji are what words are written with,
 * radicals are what kanji are drawn from. So a walk that owes two cards reads as
 * one step down and not as two unrelated announcements, and the copy can hand off
 * in that direction.
 *
 * It is the reverse of ROLE_ORDER, which the composite label prints and which
 * runs smallest piece first. Two different orders for two different jobs: a label
 * lists what is on the card, and this teaches.
 */
const CARD_ORDER: readonly CurriculumRole[] = [...ROLE_ORDER].reverse();

/**
 * The three cards, in CARD_ORDER, each anchored by ANCHOR_RULE.
 *
 * Computed once at module load. It is a property of the shipped sequence, and no
 * user input reaches it.
 */
export const SPINE_ANCHORS: readonly SpineAnchor[] = CARD_ORDER.flatMap((role) => {
  const item =
    CURRICULUM_SEQUENCE.find(ANCHOR_RULE[role]) ??
    CURRICULUM_SEQUENCE.find((it) => it.roles.includes(role));
  // A role no item plays at all has no anchor and no card. It cannot happen over
  // the shipped tables (spine-intros.test.ts asserts all three are anchored), and
  // dropping it beats minting a card with nowhere to fire.
  if (!item) return [];
  const anchor: SpineAnchor = {
    role,
    glyph: item.glyph,
    facts: meaningFacts(item.glyph, item.roles),
    intro: TRACK_INTROS[role],
  };
  return [anchor];
});

/** Has the app any record of this fact: answered, claimed, or "quiz me"'d? The
 * one definition of "met", the same `lastTested !== 0` rule every other gate in
 * the app reads. */
function met(fact: FactId, history: HistoryFile): boolean {
  const state = effectiveState(
    history.facts[fact],
    history.claims?.[fact],
    history.seen?.[fact],
  );
  return state.lastTested !== 0;
}

/**
 * The cards owed ahead of this glyph, in ROLE_ORDER, or empty for the glyph that
 * anchors none.
 *
 * `exclude` is the teach set of the lesson being walked, and it is why the card
 * survives its own lesson: the app marks a lesson's facts seen before the walk
 * renders (so that starting it unlocks the readings its words prove, whichever
 * button was pressed), and counting those would suppress the card at the exact
 * moment it is due. The same exclusion `startedTracks` makes, for the same
 * reason.
 */
export function spineIntrosFor(
  glyph: string,
  history: HistoryFile,
  exclude: ReadonlySet<FactId>,
): PhaseIntro[] {
  const due: PhaseIntro[] = [];
  for (const anchor of SPINE_ANCHORS) {
    if (anchor.glyph !== glyph) continue;
    const learned = anchor.facts.some((f) => !exclude.has(f) && met(f, history));
    if (learned) continue;
    due.push(anchor.intro);
  }
  return due;
}
