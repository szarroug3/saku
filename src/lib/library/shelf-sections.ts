// shelfSections — how each Library shelf is cut into sections — lifted out of
// components/library/shelves.tsx (which still re-exports it) so it is a plain
// data function with no React import edge. It was already pure; the only
// reason it lived in a "use client" component file was proximity to the one
// renderer that calls it. Moving it here lets non-component code (group-nav.ts,
// and the node:test harness that runs group-nav.test.ts, which cannot resolve
// a .tsx module — see src/lib/conjugate/test-hooks.mjs) depend on it without
// pulling React along.
//
// See shelves.tsx's own file header for what a "section" means and why each
// kind is cut the way it is; nothing about that reasoning changed in the move.

import {
  COUNTER_KIND,
  entryForGlyph,
  GRAMMAR_CONCEPT_SUBJECT,
  GRAMMAR_SUBJECT,
  KANJI_SUBJECT,
  libEntry,
  LIB_ENTRIES_BY_KIND,
  NUMBER_CONSTRUCTION_KIND,
  SENTENCE_RULE_KIND,
  VOCAB_SUBJECT,
} from "@/lib/library/library-index";
import { KANA_SUBJECT, SETS } from "@/data/characters";
import { MARK_SUBJECT, MARKS, markEntry } from "@/data/marks";
import { TERM_SUBJECT, TERMS, termEntry } from "@/data/terms";
import { RADICAL_SUBJECT, RADICALS, radicalEntry } from "@/data/radicals";
import { TRANSITIVITY_SUBJECT, pairEntry } from "@/data/transitivity-facts";
import { CURRICULUM_PAIRS } from "@/lib/transitivity-lesson";
import { KEIGO_SUBJECT } from "@/data/keigo";
import { grammarShelfSections } from "@/lib/library/grammar-shelf";
import type { Kind, LibEntry } from "@/lib/library/entries";
import { PRIMITIVE_SUBJECT } from "@/data/components";
import { counterShelfSections } from "@/lib/library/counter-shelf";
import { keigoShelfSections } from "@/lib/library/keigo-shelf";
import { kanjiCuts } from "@/lib/library/kanji-shelf";
import type { ShelfSection } from "@/lib/library/shelf-view";
import { curriculumRank, rangedGroups, wordClimbRank } from "@/lib/library/ranged-groups";

import type { EntryId, NewKanjiOrder } from "@/types";

/** The sections of a shelf.
 *
 * `kanjiOrder` is the one thing here that is a SETTING and not data — the kanji
 * shelf is cut by the order the reader is studying in (see shelves.tsx's file
 * header). The other four kinds ignore it, and should keep ignoring it. */
export function shelfSections(kind: Kind, kanjiOrder: NewKanjiOrder): ShelfSection[] {
  switch (kind) {
    case KANA_SUBJECT:
      return SETS.flatMap((set) =>
        set.sections.map((section) => ({
          id: `${set.id}-${section.id}`,
          label: `${set.label} · ${section.label}`,
          entries: section.chars
            .map((ch) => entryForGlyph(KANA_SUBJECT, ch.c))
            .flatMap((id) => resolve(id)),
        })),
      );
    case KANJI_SUBJECT: {
      const cuts = kanjiCuts(kanjiOrder);
      return cuts.map((cut) => ({
        id: cut.id,
        label: cut.label,
        entries: cut.glyphs.flatMap((c) => resolve(entryForGlyph(KANJI_SUBJECT, c))),
        isRangeLabel: cut.isRangeLabel,
      }));
    }
    case GRAMMAR_SUBJECT:
      // By the FORM each pattern is built on (see grammar-shelf.ts), not by JLPT
      // level: the level is opinion the app otherwise refuses to print, and now
      // that each verb form is a first-class lesson the cut that means something
      // is "which form does this build on". The four form recipes head their own
      // sections; the plain-form, noun and particle patterns trail in "Other
      // patterns". Sections and the patterns inside them run in teaching order.
      return grammarShelfSections();
    // ONE SECTION, holding all five. Not "no sections" like words — that branch
    // means "too many to browse, go and search", which is the opposite of the
    // truth here: five entries is the whole subject and it fits on a shelf twice
    // over. And not five sections of one, which would be a hierarchy invented to
    // look like the other shelves have one. The data offers no cut, so the shelf
    // takes none, and the section header still earns its place as the
    // select-them-all toggle every other shelf has.
    case MARK_SUBJECT:
      return [
        {
          id: "writing-rules",
          label: "Writing rules",
          entries: MARKS.filter((m) => m.shelf === "writing").flatMap((m) =>
            resolve(markEntry(m.id)),
          ),
        },
      ];
    case SENTENCE_RULE_KIND:
      return [
        {
          id: "sentence-rules",
          label: "Sentence rules",
          entries: MARKS.filter((m) => m.shelf === "sentence").flatMap((m) =>
            resolve(markEntry(m.id)),
          ),
        },
      ];
    // ONE SECTION, holding every pair, for the same reason marks take one: the
    // whole subject fits on a shelf and offers no cut worth inventing. Rendered
    // as rows (see asRows) because a pair has no glyph to tile — its name is
    // "出る / 出す" and its note is the tail-shift, both of which read across a
    // line, not inside a 100px box.
    case TRANSITIVITY_SUBJECT:
      return [
        {
          id: "verb-pairs",
          label: "Verb pairs",
          entries: CURRICULUM_PAIRS.flatMap((p) => resolve(pairEntry(p))),
        },
      ];
    // ONE SECTION, holding every definition — marks' argument again. The whole
    // subject is a short glossary that fits on a shelf, and it offers no cut
    // worth inventing. Rendered as rows (see asRows) because a term has no glyph
    // to tile — its name and its one-line summary read across a line.
    case TERM_SUBJECT:
      return [
        {
          id: "terms",
          label: "Terms",
          entries: TERMS.flatMap((t) => resolve(termEntry(t.id))),
        },
      ];
    // ONE SECTION, holding every grammar concept — marks' and terms' argument
    // again. A short set of idea pages that fits on a shelf and offers no cut
    // worth inventing. Rendered as rows (see asRows) because a concept has no
    // glyph to tile: its name and its one-line summary read across a line.
    case GRAMMAR_CONCEPT_SUBJECT:
      // Equivalent to GRAMMAR_CONCEPTS.flatMap((c) => resolve(grammarConceptEntry(c.id))):
      // entries.ts's concept loop is unfiltered, one row per GRAMMAR_CONCEPTS
      // item, in order — see library-index.equiv.test.ts.
      return [
        {
          id: "grammar-concepts",
          label: "Grammar concepts",
          entries: [...(LIB_ENTRIES_BY_KIND.get(GRAMMAR_CONCEPT_SUBJECT) ?? [])],
        },
      ];
    // EVERY word, in the curriculum CLIMB — the order the Learn feed teaches, so
    // 人 opens the shelf (word 1 on the Learn card) instead of frequency burying
    // it — cut into ranges of GROUP_SIZE ("1–50", "51–100") like the kanji
    // shelf's hundreds, and shown WHOLE, all 12,553, not the old top-120
    // "Everyday words" card. The ranges flow through the generic deferred section
    // render below and inherit its select-all header. See ranged-groups.ts for
    // the climb rank (spine order first, beginnerRank tail) and chunking.
    case VOCAB_SUBJECT:
      // Equivalent to VOCAB.flatMap((w) => resolve(wordEntry(w.keb))): build()
      // creates exactly one LIB_ENTRIES row per VOCAB row (entries.ts's word
      // loop, unfiltered, in VOCAB's own order), so the precomputed per-kind
      // bucket already IS that same list, same order — see
      // library-index.equiv.test.ts's LIB_ENTRIES_BY_KIND assertion.
      return rangedGroups(
        [...(LIB_ENTRIES_BY_KIND.get(VOCAB_SUBJECT) ?? [])],
        wordClimbRank,
      );
    // Numbers and counters, cut into the groups the track teaches (see
    // counter-shelf.ts). Rendered as TILES like kana and kanji, not rows: a
    // counter is a glyph (一本, ひとつ) with a reading under it, which is what a
    // tile is for. The whole subject is 87 entries across seven small sections,
    // so every section shows whole — no cap, like radicals.
    case COUNTER_KIND:
    // The construction pages have no shelf chip of their own — they browse ON
    // the counters shelf (injected by counterShelfSections). This case exists so
    // the switch stays exhaustive over Kind and a stray /library?kind=numbers URL
    // resolves to the shelf the pages actually live on, rather than 404-ing.
    case NUMBER_CONSTRUCTION_KIND:
      return counterShelfSections();
    // Keigo, cut into verb sets and set phrases (see keigo-shelf.ts). Rendered as
    // ROWS like verb pairs, not tiles: a set has no glyph, it is a plain verb and
    // its politeness forms read across the line. A small subject, shown whole.
    case KEIGO_SUBJECT:
      return keigoShelfSections();
    // All 214, in the order the curriculum TEACHES them — each radical woven in
    // at the moment the first character needs it (curriculumRank over the spine)
    // — cut into ranges like words and kanji. It used to cut by stroke count,
    // which is how a radical chart is PRINTED but not the order a learner MEETS
    // them; #27 makes every browsable subject read in teaching order. 214 is
    // small, so every range shows whole (no cap). See ranged-groups.ts.
    case RADICAL_SUBJECT:
      return rangedGroups(
        RADICALS.flatMap((r) => resolve(radicalEntry(r.glyph))),
        curriculumRank,
      );
    // ONE SECTION, holding the 278 shapes that appear in kanji decompositions
    // but are not kanji or radicals themselves. Grouped in ranges of 50, sorted
    // by stroke count (fewest first). Shown whole — no cap.
    case PRIMITIVE_SUBJECT:
      return rangedGroups(
        [...LIB_ENTRIES_BY_KIND.get(PRIMITIVE_SUBJECT) ?? []],
        // weight = 900 + strokes; subtract 900 to rank by stroke count
        (e) => e.weight - 900,
      );
  }
}

function resolve(id: EntryId | null): LibEntry[] {
  if (!id) return [];
  const e = libEntry(id);
  return e ? [e] : [];
}
