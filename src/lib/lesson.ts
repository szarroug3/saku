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
import { DAKUTEN_ROWS, DAKUTEN_SECTIONS, type DakutenRow } from "@/data/dakuten-rows";
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

/**
 * The label a conversion group wears — "Dakuten G が", "Handakuten P ぱ".
 *
 * Built from the row rather than read off a section, because a conversion is
 * NOT a section: は takes both marks, so the merged `h-bp` section holds ten
 * characters and two conversions, and the two are separate lessons. Everything
 * outside the dakuten phase still takes the data file's own section label.
 */
function conversionLabel(row: DakutenRow): string {
  const kind = row.markName === "handakuten" ? "Handakuten" : "Dakuten";
  return `${kind} ${row.to.toUpperCase()} ${row.pairs[0][1]}`;
}

function buildGroups(): LessonGroup[] {
  const groups: LessonGroup[] = [];
  for (const set of SETS) {
    const out: Omit<LessonGroup, "index" | "total">[] = [];
    const rows = DAKUTEN_ROWS.filter((r) => r.setId === set.id);
    let dakutenDone = false;

    for (const section of set.sections) {
      // The dakuten phase is paced by conversion, not by section — emitted in
      // one go at the position of its first section, and its sections then
      // skipped so nothing is taught twice.
      if (DAKUTEN_SECTIONS.has(section.id)) {
        if (dakutenDone) continue;
        dakutenDone = true;
        // ONE GROUPING AT A TIME: card k→g, drill those five, card s→z, drill
        // those five. The rhythm the rest of the curriculum already has — a
        // group is read, then it is drilled — extended to a phase whose unit is
        // a conversion rather than a section.
        for (const row of rows) {
          const chars = row.pairs.map(([, c]) => c);
          out.push({
            setId: set.id,
            setLabel: set.label,
            sectionId: row.id,
            label: conversionLabel(row),
            chars,
            facts: chars.map(kanaFact),
            extended: true,
          });
        }
        continue;
      }

      out.push({
        setId: set.id,
        setLabel: set.label,
        sectionId: section.id,
        label: section.label,
        chars: section.chars.map((c) => c.c),
        facts: section.chars.map((c) => kanaFact(c.c)),
        extended: isExtendedSection(section.label),
      });
    }

    // Counted, never written down — the same rule the lesson card's "group N of
    // M" has always followed. Pacing the dakuten rows changed M, and nothing
    // had to be told.
    out.forEach((g, i) => groups.push({ ...g, index: i + 1, total: out.length }));
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

/**
 * WHAT A DRILL IS ALLOWED TO COVER
 * ================================
 * Every kana drill offers two scopes: the group you were just taught, and
 * everything in that script up to and including it. The second is what makes a
 * lesson stop being an island — five characters drilled alone are five
 * characters you can tell apart from each other, which is not the same skill as
 * telling が from か from さ.
 *
 * SCRIPT-SEPARATE, AND CUMULATIVE IN LESSON ORDER. Not "everything in the app"
 * (that is the Everything deck, and it is a different offer), not "everything
 * history has seen" (that would grow with claims and make the button mean a
 * different thing on different days), and not hiragana-plus-katakana at a
 * katakana drill — which would change what the drill measures, at the one
 * moment the learner is trying to find out whether katakana stuck.
 */

/** The group a fact belongs to, or null for a fact outside the curriculum. */
export function groupOfFact(f: FactId): LessonGroup | null {
  return KANA_GROUPS.find((g) => g.facts.includes(f)) ?? null;
}

/**
 * Everything in this group's script taught up to and INCLUDING it — the wider
 * of the two scopes a lesson's drill offers.
 *
 * A function of the curriculum's order, not of history: it means the same thing
 * on day one and in year two, which is what lets one short label ("all hiragana
 * so far") be honest without a paragraph under it.
 */
export function scriptSoFar(group: LessonGroup): FactId[] {
  return KANA_GROUPS.filter(
    (g) => g.setId === group.setId && g.index <= group.index,
  ).flatMap((g) => g.facts);
}

/** Every fact in a script — what "I know all of hiragana" claims. */
export function setFacts(setId: string): FactId[] {
  return KANA_GROUPS.filter((g) => g.setId === setId).flatMap((g) => g.facts);
}

/** The subject these lessons belong to. Re-exported so a caller holding a
 * lesson never has to reach into the data file to name it. */
export { KANA_SUBJECT };
