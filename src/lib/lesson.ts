// The lesson: what new material arrives in, and where you go to learn it.
//
// THE UNIT IS A GROUP, AND THE GROUPS ALREADY EXISTED
// ==================================================
// Nothing here invents an order or a boundary. `src/data/characters.ts` has
// shipped kana as sections since the port — Vowels あ, K か, S さ, in Tofugu's
// order, labelled — and every one of them is a real group of real characters.
// This file's whole job is to publish that shape as a CURRICULUM so the budget
// can hand it out one group at a time, instead of drawing from a flat pool of
// 214 and calling the result a lesson.
//
// So there is no lesson DATA file and there must never be one. A second list of
// what belongs with what is a second list to keep in step with the first, and
// the first is the one the quiz already draws from.
//
// WHY THIS IS NOT IN characters.ts
// ================================
// Kana publishes facts and keeps everything else private — that is the seam the
// data file already draws, and it is about to matter, because kanji's lessons
// are NOT its data order (parts before wholes, capped by stroke count) and
// grammar's are neither. "How this subject is cut into lessons" is a per-subject
// answer. This is kana's, and it is nearly free precisely because kana's
// sections are already right.
//
// WHAT THE CARD IS ALLOWED TO SAY
// ===============================
// Everything on the lesson card is read off the data or counted from it: the
// label, the characters, the readings, which group of how many. No prose is
// written per group and none should be — 54 hand-written blurbs is 54 chances
// to be wrong about a row of the data file, and the row can say what it is.

import { KANA_SUBJECT, SETS, isExtendedSection, kanaFact } from "@/data/characters";
import { freshFacts, nextGroup } from "@/lib/budget";
import type { FactId, HistoryFile } from "@/types";

/**
 * Where to go and learn something before being quizzed on it.
 *
 * `lastVerified` is not decoration. Every link in the app is a bet on someone
 * else's site still being there and still using the same slug, and this one is
 * pointed AT A BEGINNER on their first screen — the worst possible audience for
 * a 404, because they have no idea whether the app is broken or they are. The
 * date is what turns "it 404s" into "it 404s and nobody has checked since July",
 * which is a fixable statement.
 */
export interface LearnLink {
  url: string;
  /** What the link says it is. Named for the destination, not "click here". */
  label: string;
  /** ISO date the URL was last confirmed to resolve. */
  lastVerified: string;
}

/**
 * The guides, per script.
 *
 * There is no combined kana guide to link — Tofugu has two separate trees and
 * `/japanese/learn-japanese-kana/` is not one of them (it 404s). The hiragana
 * guide hands off to katakana at the end, which is why linking hiragana on day
 * one is not a compromise: it is the route Tofugu itself sends you down.
 */
export const LEARN_LINKS: Record<string, LearnLink> = {
  hiragana: {
    url: "https://www.tofugu.com/japanese/learn-hiragana/",
    label: "Tofugu — Learn Hiragana",
    lastVerified: "2026-07-17",
  },
  katakana: {
    url: "https://www.tofugu.com/japanese/learn-katakana/",
    label: "Tofugu — Learn Katakana",
    lastVerified: "2026-07-17",
  },
};

/** One group of the curriculum — a section of the data file, with the counting
 * done. */
export interface LessonGroup {
  setId: string;
  /** "Hiragana". The script this group belongs to. */
  setLabel: string;
  sectionId: string;
  /** "Vowels あ" — the data file's own label, not a restatement of it. */
  label: string;
  chars: string[];
  facts: FactId[];
  /** 1-based position within its own script, and how many that script has.
   * Counted, so it cannot promise ten groups and then produce a
   * twenty-seventh. */
  index: number;
  total: number;
  /**
   * A dakuten, handakuten or combo row: built from a base kana rather than a
   * new shape to learn. `isExtendedSection` is the data file's own test — the
   * character picker has split on it for as long as it has existed.
   */
  extended: boolean;
}

/** Kana's curriculum: every group, in teaching order, hiragana then katakana. */
export const KANA_GROUPS: LessonGroup[] = buildGroups();

/** The same thing with everything the budget doesn't need taken off — the shape
 * `PlanQuery.groups` asks for. */
export const KANA_GROUP_FACTS: readonly FactId[][] = KANA_GROUPS.map(
  (g) => g.facts,
);

function buildGroups(): LessonGroup[] {
  const groups: LessonGroup[] = [];
  for (const set of SETS) {
    set.sections.forEach((section, i) => {
      groups.push({
        setId: set.id,
        setLabel: set.label,
        sectionId: section.id,
        label: section.label,
        chars: section.chars.map((c) => c.c),
        facts: section.chars.map((c) => kanaFact(c.c)),
        index: i + 1,
        total: set.sections.length,
        extended: isExtendedSection(section.label),
      });
    });
  }
  return groups;
}

/** What the next lesson actually is — the group, narrowed to the part of it you
 * have not seen. */
export interface Lesson {
  group: LessonGroup;
  /** The characters this lesson will teach: the group's, minus any you have
   * already seen or claimed. Usually the whole group; not always, and the card
   * counts these rather than the group. */
  chars: string[];
  facts: FactId[];
  /** The guide for this script. */
  learn: LearnLink;
}

/**
 * The next lesson, or null when there is no new material left.
 *
 * Reads `freshFacts` and `nextGroup` from the budget rather than deciding
 * anything itself, so the card that says "Vowels あ" and the session that starts
 * are answering one question with one function. If this file picked its own
 * group they would drift the first time either definition of "new" moved.
 *
 * Null means done — every group claimed or seen. A real state, and the caller
 * renders nothing rather than an empty lesson.
 */
export function nextLesson(history: HistoryFile): Lesson | null {
  const fresh = freshFacts(
    KANA_GROUPS.flatMap((g) => g.facts),
    history,
  );
  const facts = nextGroup(KANA_GROUP_FACTS, fresh);
  if (!facts.length) return null;

  const group = KANA_GROUPS.find((g) => g.facts.includes(facts[0]));
  if (!group) return null;

  const chars = group.chars.filter((c) => facts.includes(kanaFact(c)));
  return {
    group,
    chars,
    facts,
    learn: LEARN_LINKS[group.setId] ?? LEARN_LINKS.hiragana,
  };
}

/** Every fact in a script — what "I know all of hiragana" claims. */
export function setFacts(setId: string): FactId[] {
  return KANA_GROUPS.filter((g) => g.setId === setId).flatMap((g) => g.facts);
}

/** The subject these lessons belong to. Re-exported so a caller holding a
 * lesson never has to reach into the data file to name it. */
export { KANA_SUBJECT };
