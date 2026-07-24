// The three concept cards the curriculum spine owes, and when each is due.
//
// WHAT THIS HAS TAKEN THREE GOES TO GET RIGHT
// ===========================================
// "What kanji are", "What a radical is" and "What words add" are once-ever
// introductions, so two questions have to be answered: WHERE does each one fire,
// and HAS it fired already. Each earlier cut got one of them wrong.
//
//   1. Subject gate. track-open.ts read each met fact's SUBJECT, and a subject
//      nowhere in history was a track about to open. On one spine a subject is
//      not a track, and worse, the first lesson teaches a word whose kanji
//      READINGS are unlocked and written to history before the walk renders. So
//      "the kanji subject has been touched" was true at the exact moment the
//      kanji card was due, and two cards vanished on day one.
//   2. Anchor character gate. Each card was pinned to one item and asked whether
//      that item had been learned. For a learner starting from zero that is the
//      same question as "have you been shown this card". For anyone with prior
//      progress it is a different question, and only the wrong one was being
//      asked. A learner who did the old separate radical track has met 亅, so
//      the radical card was treated as outgrown by someone nobody had ever told
//      what a radical is. It was worse than a mis-gate: an item already learned
//      is filtered out of the lesson entirely (see nextCurriculumLesson), so the
//      anchor was not even in the walk and there was nothing to fire against.
//
// So the two questions are now answered by two different things, which is what
// they always needed.
//
// HAS IT FIRED: THE CARD'S OWN RECORD
// ===================================
// src/lib/intro-shown.ts remembers, per card id, that the card has been through
// a walk. That is the only thing that actually means "shown", and a card the
// learner never read is not a card they have outgrown. History is not consulted
// for this and cannot be: it records what a learner LEARNED, and these cards are
// about what they were TOLD.
//
// WHERE IT FIRES: THE SHARPEST ITEM THE WALK HAS
// ==============================================
// Each card names the shape of item it is ABOUT (ANCHOR_RULE), and fires ahead of
// the first such item in the walk. That is the doctrine the rest of the walk's
// cards already follow: okurigana waits for the first kana tail, rendaku for the
// first voiced seam. The alternative, firing at the first item that merely
// CARRIES the role, put all three explainers ahead of the first four characters
// and landed each where its own copy was only half true.
//
// AND THE FALLBACK, WHICH IS THE WHOLE FIX FOR PRIOR PROGRESS
// ===========================================================
// A learner who already met the sharp item will never be shown it again, so a
// card that insists on it waits for a lesson that can never come. When the sharp
// item has gone past, the card rides the first item in the walk that carries the
// role at all. For the learner who met 亅 in the old radical track, that is 人,
// which her first lesson labels "Radical · Kanji · Word" and which is the exact
// character that made her ask how something can be both.
//
// The fallback is deliberately narrow. It opens ONLY when the sharp item is
// already learned, so a learner starting from zero still gets each card where it
// reads best and never three at once.

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
 *   KANJI   the first item taught as a kanji. A kanji is exactly what this item
 *           is, and it opens the whole curriculum.
 *   RADICAL the first item that plays the radical role AT ALL, folded characters
 *           included. It was once the first shape that is ONLY a radical, on the
 *           argument that "a piece other kanji are built from" is visible there
 *           and invisible on a character that is also a kanji and a word. Good
 *           copy logic, and it lost to the screen: 人 opens lesson one with a
 *           tile reading "Radical · Kanji · Word", so the label arrives two steps
 *           before anything has said what a radical is. A term shown before its
 *           definition is the exact failure these cards exist to prevent, so the
 *           card leads and the copy carries the distinction instead.
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
  radical: (it) => it.roles.includes("radical"),
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

/** The walk-step kinds this file speaks for: the three roles of the spine, whose
 * subject ids are the role names themselves. A keigo or counter step is neither,
 * even when its written form is also a curriculum word. */
const SPINE_KINDS: ReadonlySet<string> = new Set(ROLE_ORDER);

/** Every curriculum item by glyph, so the walk's glyphs can be asked what roles
 * they play. Built once; the sequence is shipped data. */
const ITEM_OF: ReadonlyMap<string, (typeof CURRICULUM_SEQUENCE)[number]> = new Map(
  CURRICULUM_SEQUENCE.map((it) => [it.glyph, it]),
);

/**
 * WHERE EACH DUE CARD GOES IN ONE WALK: item index to the cards owed ahead of it.
 *
 * Planned over the whole walk at once, because choosing a card's position needs
 * to know what else the walk contains. A card fires ahead of the sharpest item
 * present (ANCHOR_RULE), and falls back to the first item carrying its role only
 * when the sharp item has already been learned and so can never appear again. See
 * the header.
 *
 * `glyphs` are the walk's items in order, `shown` the cards already read (see
 * intro-shown.ts), and `exclude` the teach set of the lesson being walked. The
 * exclusion matters for the fallback test alone: the app marks a lesson's facts
 * seen before the walk renders, so that starting it unlocks the readings its
 * words prove, and without the exclusion every sharp item would read as already
 * learned the instant its own lesson opened.
 */
export function spineIntroPlan(
  walk: readonly { kind: string; glyph: string }[],
  history: HistoryFile,
  exclude: ReadonlySet<FactId>,
  shown: ReadonlySet<string>,
): Map<number, PhaseIntro[]> {
  const plan = new Map<number, PhaseIntro[]>();
  /** The curriculum item behind a walk step, for the steps this file speaks for.
   * A step of any other subject resolves to nothing, however its glyph reads: a
   * keigo verb and a counter can share a written form with a curriculum word, and
   * a keigo lesson is not where the app explains what a word is. */
  const itemAt = (i: number) => {
    const step = walk[i];
    return SPINE_KINDS.has(step.kind) ? ITEM_OF.get(step.glyph) : undefined;
  };
  // CARD_ORDER, so two cards landing on one item read down the hierarchy.
  for (const anchor of SPINE_ANCHORS) {
    if (shown.has(anchor.intro.id)) continue;
    // The sharp item, matched on the ROLES the character plays and not on the
    // kind its step arrived under. A folded character is one step now (see
    // itemsFromFacts), and its kind names only the role it led with, so a kind
    // test would hide the radical card behind a character stepping as a kanji.
    let at = walk.findIndex((_, i) => {
      const item = itemAt(i);
      return item !== undefined && ANCHOR_RULE[anchor.role](item);
    });
    if (at < 0) {
      // No sharp item here. Wait for the lesson that has one, UNLESS it has
      // already gone past, in which case ride whatever carries the role.
      const learned = anchor.facts.some((f) => !exclude.has(f) && met(f, history));
      if (!learned) continue;
      // Anything on this card that PLAYS the role, whichever role it is stepping
      // in. For the radical card that is the point: a learner whose 亅 was
      // filtered out still has 人 in front of her, labelled "Radical · Kanji ·
      // Word", which is the label the card exists to explain.
      at = walk.findIndex((_, i) => itemAt(i)?.roles.includes(anchor.role));
    }
    if (at < 0) continue;
    const due = plan.get(at);
    if (due) due.push(anchor.intro);
    else plan.set(at, [anchor.intro]);
  }
  return plan;
}
