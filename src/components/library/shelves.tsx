"use client";

// The shelves — what the Library is when you haven't typed anything.
//
// A shelf is a Kind, cut where a cut MEANS something to the person reading it.
// Usually that is a cut the data already has: the kana shelf's sections are the
// gojūon rows because kana genuinely comes in rows, and grammar's are JLPT
// levels because the recipes carry them. The words shelf has no sections,
// because the data gives it none; it shows the first screenful of everyday
// words and sends you to search for the rest, instead of pretending to be
// browsable. A shelf you cannot honestly cut is a search box, and saying so is
// cheaper than a fake hierarchy.
//
// THE KANJI SHELF IS THE EXCEPTION, AND IT IS CUT BY THE TEACHING ORDER. It used
// to be cut into jōyō grades, because that is what KANJIDIC2 records — and both
// halves of that were wrong for the reader. "Jōyō" is the 2,136-kanji list that
// is the entire contents of this app, so the word distinguishes nothing; and a
// grade is the school year a Japanese CHILD meets it, a curriculum for people
// who already speak the language. Worse, it was not the order she was studying
// in: kanji arrive in the `everyday` order, and under grade sections the kanji
// she will actually meet next were scattered across seven cards, one of which
// held 1,110 of the 2,136 and showed 60 of them.
//
// So `shelfSections` takes the order, and the kanji shelf is cut into
// consecutive hundreds OF THAT ORDER, labelled by range ("1–100", "101–200").
// Reading the shelf left to right, top to bottom, is reading the order you will
// meet them in. IT STOPS AFTER THREE OF THEM, because 2,136 kanji is 22 cards
// nobody scrolls and 300 is plenty to have on a page; a counted line says how
// many are left and sends you to search, which is what the words shelf has
// always done with its 12,553.
//
// SECTIONS AND TILES ARE MULTI-SELECT TOGGLES. You BUILD a drill by turning
// things on: a section header toggles its whole row (hiragana vowels, the
// k-row, kanji 101–200), and a single tile toggles just that glyph. Several can be on at
// once, across kinds — the set lives on the page (see lib/library/selection.ts),
// not here, so this file only draws the on/some/off state and reports toggles
// up. The bar downstream unions everything on into one Slice, so "mark as known"
// and "drill this" stay hierarchical without a hierarchy feature: the user's own
// "i know all hiragana, i know all hiragana vowels, i know all k-rows" is three
// depths of the same set.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { KANJI_SUBJECT } from "@/data/kanji";
import { KANA_SUBJECT, SETS } from "@/data/characters";
import { getMnemonic } from "@/data/mnemonics";
import { VOCAB, VOCAB_SUBJECT, wordEntry } from "@/data/vocab";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { MARK_SUBJECT, MARKS, markEntry } from "@/data/marks";
import { TERM_SUBJECT, TERMS, termEntry } from "@/data/terms";
import {
  GRAMMAR_CONCEPT_SUBJECT,
  GRAMMAR_CONCEPTS,
  grammarConceptEntry,
} from "@/data/grammar-concepts";
import { RADICAL_SUBJECT, RADICALS, radicalEntry } from "@/data/radicals";
import { TRANSITIVITY_SUBJECT, pairEntry, pairForEntry } from "@/data/transitivity-facts";
import { CURRICULUM_PAIRS } from "@/lib/transitivity-lesson";
import { KEIGO_SUBJECT, keigoSetForEntry } from "@/data/keigo";
import { entryHref } from "@/lib/library/href";
import { japaneseFontClass } from "@/lib/japanese-text";
import { grammarShelfSections } from "@/lib/library/grammar-shelf";
import {
  EntryRow,
  EntryTile,
  ShelfRow,
  VerbPairHeader,
  VerbPairRow,
  KeigoSetHeader,
  KeigoSetRow,
} from "@/components/library/entry-tile";
import { Card, Hint, Lbl } from "@/components/ui";
import {
  COUNTER_KIND,
  NUMBER_CONSTRUCTION_KIND,
  SENTENCE_RULE_KIND,
  entryForGlyph,
  libEntry,
  LIB_ENTRIES_BY_KIND,
  type Kind,
  type LibEntry,
} from "@/lib/library/entries";
import { PRIMITIVE_SUBJECT } from "@/data/components";
import { counterShelfSections } from "@/lib/library/counter-shelf";
import { keigoShelfSections } from "@/lib/library/keigo-shelf";
import { kanjiCuts } from "@/lib/library/kanji-shelf";
import { filterSections, type ShelfSection } from "@/lib/library/shelf-view";
import { curriculumRank, rangedGroups, wordClimbRank } from "@/lib/library/ranged-groups";
import { sectionState, type Selection } from "@/lib/library/selection";
import type { KnowledgeFilter } from "@/lib/library/url-state";

import type { EntryId, NewKanjiOrder } from "@/types";

/** One cut of a shelf: a name and the entries under it. Its type and the view
 * math that reads it live in @/lib/library/shelf-view so they can be unit-tested;
 * this file only builds and renders them. */

/** The sections of a shelf.
 *
 * `kanjiOrder` is the one thing here that is a SETTING and not data — the kanji
 * shelf is cut by the order the reader is studying in (see the file header).
 * The other four kinds ignore it, and should keep ignoring it. */
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
      return [
        {
          id: "grammar-concepts",
          label: "Grammar concepts",
          entries: GRAMMAR_CONCEPTS.flatMap((c) =>
            resolve(grammarConceptEntry(c.id)),
          ),
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
      return rangedGroups(
        VOCAB.flatMap((w) => resolve(wordEntry(w.keb))),
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

export function Shelf({
  kind,
  sections,
  selected,
  onToggleEntry,
  onToggleSection,
  voice,
  keep,
  filter = "all",
}: {
  kind: Kind;
  sections: readonly ShelfSection[];
  /** The global, cross-kind selection this shelf draws its on-state from. */
  selected: Selection;
  onToggleEntry(id: EntryId, shiftKey: boolean): void;
  onToggleSection(ids: readonly EntryId[]): void;
  voice: string;
  /** The knowledge filter, as a predicate. Undefined is All — the shelf shows
   * every entry, which is what it did before this existed. Known / Not known
   * pass a test built from `entryStanding` upstream (see library-page): the shelf
   * itself no longer paints standing, but it is still what the filter selects by. */
  keep?: (entry: LibEntry) => boolean;
  /** Which filter is active, for the empty-state copy. The predicate above does
   * the work; this only picks the words when it removes everything. */
  filter?: KnowledgeFilter;
}) {
  // Shelves arrive open so their contents remain part of the server-rendered
  // first paint. A disclosure only removes the body after the learner asks;
  // selection remains a separate action on the labelled button beside it.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggleCollapsed = (sectionId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  // For kana: separate hiragana/katakana into collapsible script groups.
  const [collapsedScripts, setCollapsedScripts] = useState<ReadonlySet<string>>(() => new Set());
  const toggleScript = (script: string) =>
    setCollapsedScripts((prev) => {
      const next = new Set(prev);
      if (next.has(script)) next.delete(script); else next.add(script);
      return next;
    });

  const tile = (entry: LibEntry) => (
    <EntryTile
      key={entry.id}
      entry={entry}
      voice={voice}
      mnemonic={mnemonicOf(kind, entry)}
      selected={selected.has(entry.id)}
      onToggleSelect={(shift) => onToggleEntry(entry.id, shift)}
    />
  );

  // A grammar pattern is a phrase, not a glyph — 〜なければならない does not fit a
  // 100px tile — so the Grammar shelf lays its patterns out as ROWS (the same
  // shape search results use), which have room for the pattern and its gloss.
  //
  // `grid` OPTS THE ROW INTO A SHARED SUBGRID so the pattern column sizes to the
  // WIDEST pattern across every row — see the grammar branch below and EntryRow.
  // The flat search list leaves it off; only the grammar shelf, which is one kind
  // and wants its patterns aligned, turns it on.
  const row = (entry: LibEntry, grid = false) => (
    <EntryRow
      key={entry.id}
      entry={entry}
      voice={voice}
      note={entry.sub}
      grid={grid}
      selected={selected.has(entry.id)}
      onToggleSelect={(shift) => onToggleEntry(entry.id, shift)}
    />
  );

  // The grammar shelf uses the shared GrammarShelfRow (the same row the cluster
  // families use), not EntryRow — the pattern, its gloss, the tick-to-drill and
  // the open ↗, compact and column-aligned. `note` (entry.sub) rides a sub-line
  // only when it differs from the gloss.
  const grammarRow = (entry: LibEntry) => (
    <GrammarShelfRow
      key={entry.id}
      lead={entry.glyph}
      gloss={entry.meanings.slice(0, 3).join(", ") || entry.sub}
      note={entry.sub}
      href={entryHref(entry.id)}
      select={{
        selected: selected.has(entry.id),
        onToggle: (shift) => onToggleEntry(entry.id, shift),
      }}
    />
  );

  // A verb pair is neither a glyph nor a phrase but a CONTRAST — two verbs and
  // one event — so it gets its own row, two cells wide, each verb with its own
  // reading, speaker and English cue.
  const pairRow = (entry: LibEntry) => {
    const pair = pairForEntry(entry.id);
    if (!pair) return null;
    return (
      <VerbPairRow
        key={entry.id}
        entry={entry}
        pair={pair}
        voice={voice}
        selected={selected.has(entry.id)}
        onToggleSelect={(shift) => onToggleEntry(entry.id, shift)}
      />
    );
  };

  const keigoRow = (entry: LibEntry) => {
    const set = keigoSetForEntry(entry.id);
    if (!set) return null;
    return (
      <KeigoSetRow
        key={entry.id}
        entry={entry}
        set={set}
        voice={voice}
        selected={selected.has(entry.id)}
        onToggleSelect={(shift) => onToggleEntry(entry.id, shift)}
      />
    );
  };

  // ROWS, NOT TILES, for grammar, marks AND verb pairs — the same argument all
  // three times. A tile is a 100px box built around a character; a grammar
  // pattern is a phrase, a mark is a NAME ("Long vowels"), and a verb pair is two
  // words and a tail-shift note ("出る / 出す", "-る → -す") — none fit. The mark
  // case is the stronger one: long vowels has no glyph at all, so its tile would
  // be an empty box with a caption; a pair has no glyph either. A row leads with
  // the glyph when there is one and reads its name and its rule across the line
  // when there isn't, which is the honest shape for these shelves.
  const asRows =
    kind === GRAMMAR_SUBJECT ||
    kind === MARK_SUBJECT ||
    kind === SENTENCE_RULE_KIND ||
    kind === TRANSITIVITY_SUBJECT ||
    kind === KEIGO_SUBJECT ||
    kind === TERM_SUBJECT ||
    kind === GRAMMAR_CONCEPT_SUBJECT;

  // Every matching section stays in the scroll. Distant sections are mounted
  // near the viewport instead of being omitted or capped.
  const filtered = filterSections(sections, keep);
  const shownSections = filtered;

  // Everything on the shelf fell outside the filter. The clusters card still
  // renders above (it is a reference, not filtered content), but the shelf itself
  // needs to say why it is empty rather than show nothing.
  const shelfEmpty = shownSections.length === 0;

  /**
   * Defer heavy section-body mount until the section is near viewport.
   * Keep the first two sections eager so the top of the shelf paints instantly.
   */
  function DeferredSectionBody({
    eager,
    children,
  }: {
    eager: boolean;
    children: React.ReactNode;
  }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [mounted, setMounted] = useState(eager);

    useEffect(() => {
      if (mounted) return;
      const node = ref.current;
      if (!node) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setMounted(true);
            io.disconnect();
          }
        },
        { rootMargin: "700px 0px" },
      );
      io.observe(node);
      return () => io.disconnect();
    }, [mounted]);

    return (
      <div ref={ref}>
        {mounted ? children : <div className="h-10" aria-hidden="true" />}
      </div>
    );
  }

  const sectionCard = (section: ShelfSection, index: number) => {
    const ids = section.entries.map((e) => e.id);
    const state = sectionState(selected, ids);
    const shown = section.entries;
    const expanded = !collapsed.has(section.id);
    // `first` drops the top hairline so a section butts cleanly against the top
    // of its group (the shelf, or a kana script header). `index` is per-group at
    // both call sites, so `index === 0` is the first section in that group.
    const first = index === 0;
    // A tile is a 100px box built around a glyph. A section whose entries have no
    // glyph would tile as empty boxes with a caption, so it reads as ROWS even on
    // a tile shelf, the same honest shape a mark or a term takes. A section can
    // also OPT into rows (section.asRows) when its entries carry a glyph but read
    // better across a line — the counters shelf's leading "How to build them"
    // reference, whose pages wear a 十〜 / 〜本 plate but are named references.
    const sectionAsRows =
      asRows || section.asRows || section.entries.every((e) => !e.glyph);
    return (
      // NO Card — de-boxed. A quiet header (collapse chevron + plain-eyebrow
      // select-all + count) over a real hairline between sections; the first in a
      // group has none. The tile grid / row list carries the shelf now, not a box.
      <section
        key={section.id}
        className={`kq-defer ${first ? "" : "mt-2 border-t border-white/[0.08] pt-2"}`}
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${section.label}`}
            onClick={() => toggleCollapsed(section.id)}
            className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-lg leading-none text-text-muted hover:bg-panel hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span
              aria-hidden
              className={`block transition-transform ${expanded ? "rotate-90" : ""}`}
            >
              ›
            </span>
          </button>
          <button
            type="button"
            onClick={() => onToggleSection(ids)}
            aria-pressed={state === "all"}
            className={`cursor-pointer text-[11px] font-medium uppercase tracking-[0.08em] ${
              state === "all"
                ? "text-accent"
                : state === "some"
                  ? "text-warning"
                  : "text-text-muted hover:text-text"
            }`}
          >
            {section.label}
          </button>
          <Hint>{section.entries.length}</Hint>
        </div>
        {expanded ? (
          <DeferredSectionBody eager={index < 2}>
            {sectionAsRows ? (
              kind === TRANSITIVITY_SUBJECT ? (
                <div className="flex flex-col">
                  {/* The transitivity concept map (開ける/開く) lives here, on the
                      Verb pairs shelf that lists the pairs it explains — not as a
                      row on the grammar shelf. */}
                  <Link
                    href="/grammar/transitivity"
                    className="mb-2 self-start text-[13px] text-accent no-underline hover:underline"
                  >
                    How verb pairs work: 開ける vs 開く →
                  </Link>
                  <VerbPairHeader />
                  {shown.map(pairRow)}
                </div>
              ) : kind === KEIGO_SUBJECT ? (
                <div className="flex flex-col">
                  {section.id !== "keigo-phrases" && <KeigoSetHeader />}
                  {shown.map(keigoRow)}
                </div>
              ) : kind === GRAMMAR_SUBJECT ? (
                <div className={GRAMMAR_ROWS}>{shown.map(grammarRow)}</div>
              ) : (
                <div className="flex flex-col">
                  {shown.map((entry) => row(entry))}
                </div>
              )
            ) : (
              // pl matches the header's chevron gutter (size-5 + gap-1.5) so the
              // first tile lines up under the section LABEL, not under the chevron
              // — the same tab-in the grammar rows use, so a header sits over the
              // content it heads instead of a step to its left.
              <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-x-2 gap-y-1 pl-[26px]">
                {shown.map(tile)}
              </div>
            )}
          </DeferredSectionBody>
        ) : null}
      </section>
    );
  };

  return (
    <>
      {shelfEmpty ? (
        <Card>
          <FilterEmpty filter={filter} />
        </Card>
      ) : null}
      {kind === KANA_SUBJECT ? (
        // Group kana sections under collapsible Hiragana / Katakana headers.
        ["hiragana", "katakana"].map((script) => {
          const scriptSections = shownSections.filter((s) =>
            s.id.startsWith(script),
          );
          if (!scriptSections.length) return null;
          const scriptExpanded = !collapsedScripts.has(script);
          const label = script === "hiragana" ? "Hiragana" : "Katakana";
          return (
            <div key={script}>
              {/* SAME chevron size + gap + left edge as the section header below
                  (size-5 / gap-1.5 / no px), so the script label lines up with its
                  sections instead of sitting indented to their right. */}
              <div className="flex items-center gap-1.5 pb-1 pt-2">
                <button
                  type="button"
                  aria-expanded={scriptExpanded}
                  onClick={() => toggleScript(script)}
                  className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-lg leading-none text-text-muted hover:bg-panel hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span
                    aria-hidden
                    className={`block transition-transform ${scriptExpanded ? "rotate-90" : ""}`}
                  >
                    ›
                  </span>
                </button>
                <Lbl>{label}</Lbl>
              </div>
              {scriptExpanded &&
                scriptSections.map((section, index) =>
                  sectionCard(section, index),
                )}
            </div>
          );
        })
      ) : (
        // The grammar shelf's particles are now a real, selectable "Particles"
        // section emitted by grammarShelfSections (grammar-shelf.ts) at the top,
        // rendered through the shared sectionCard like every other section — no
        // bespoke leading block any more.
        shownSections.map((section, index) => sectionCard(section, index))
      )}
    </>
  );
}

/** What the shelf says when the knowledge filter removed everything on it. Only
 * reached with a filter active — All never empties a shelf — so it always names
 * the filter and points at the way out. */
function FilterEmpty({ filter }: { filter: KnowledgeFilter }) {
  const label =
    filter === "unknown"
      ? "not-known"
      : filter === "getting-there"
        ? "getting-there"
        : filter === "mixup"
          ? "mix-up"
          : filter;
  return (
    <p className="text-[13px] text-text-muted">
      Nothing on this shelf matches the {label} filter.{" "}
      <Hint>Switch the filter to All to see the whole shelf, or search.</Hint>
    </p>
  );
}

/** The way into the cluster maps, now that Grammar is a Library shelf rather
 * than a tab. The maps are uniquely grammar — "the seven ways to say must", side
 * by side — and do not fit a tile grid, so they stay their own view and this is
 * the door to it.
 *
 * EVERY CLUSTER IS NAMED HERE, and that is the change: this card used to be one
 * sentence and a single link to the index, so the twelve maps existed but could
 * only be found by someone who already knew to go looking. Naming them makes the
 * Library the place they are discovered, which is what a Library is for, and a
 * cluster's name is short enough that all twelve fit in a wrapped row.
 *
 * A CLUSTER IS NOT A SIXTH `Kind`, on purpose. The temptation is real — the
 * shelf switcher would then list it beside Kana and Kanji — but a `Kind` is a
 * thing with an `EntryId`, a page under /library/[...entry], and (for four of the
 * five) FACTS the scheduler asks about. A cluster has no facts by construction:
 * it is a MAP, it never touches the scheduler, and that independence is the
 * whole promise of the page. It also already has a home at /grammar/[id], so a
 * sixth kind would need `entryHref` to carry a per-kind escape hatch for the one
 * kind whose pages are not where every other kind's pages are. A row of links to
 * the maps that exist costs none of that. */
// ONE row for every GRAMMAR-shelf table piece — the cluster families AND the
// form patterns — so the whole shelf reads as a single table. A compact line,
// tabbed in under its section header (the pl gutter), whose columns
// (lead · gloss · open-↗) line up down the list. NO visible tick: the whole row
// is the select target and its accent highlight is the state, so `select` still
// wires tick-to-drill without a checkbox. A cluster with no members omits it, so
// the whole row is the link to its map instead. The trailing ↗ — the open
// control — is revealed on hover only.
// No px on the grid itself — that insets the row's accent wash too, leaving the
// text/↗ flush to the highlight edges. Instead the wash spans full width and the
// FIRST cell (lead) and LAST cell (↗) carry the inset, so content sits off the
// highlight's sides. pl-6 on the lead keeps the tab-in under the section header.
const GRAMMAR_ROWS =
  "grid grid-cols-[max-content_minmax(0,1fr)_auto] items-baseline gap-x-2.5";

function GrammarShelfRow({
  lead,
  gloss,
  note,
  href,
  select,
}: {
  lead: string;
  gloss: string;
  note?: string;
  href: string;
  select?: { selected: boolean; onToggle: (shiftKey: boolean) => void };
}) {
  // The row's own layout — a subgrid band of the shared GRAMMAR_ROWS grid — on
  // top of the shared ShelfRow shell (accent hover + selected wash, hairline, the
  // whole-row select target with no checkbox). The pl-6/pr-3 horizontal inset
  // lives on the parent GRAMMAR_ROWS grid, so the lead and ↗ sit off the edges.
  const layout = "col-span-full grid grid-cols-subgrid items-baseline py-1.5";
  // ↗ reveals on ROW hover, or on the arrow's OWN keyboard focus — never on the
  // row's focus (clicking to select focuses the row, and group-focus-within kept
  // the ↗ stuck on the last-selected row).
  const arrowCls =
    "mr-4 inline-flex size-5 flex-none items-center justify-center self-center rounded-md text-[11px] leading-none text-text-muted no-underline opacity-0 transition-opacity hover:text-text group-hover:opacity-100 focus-visible:opacity-100";
  const cells = (
    <>
      <span
        className={`whitespace-nowrap pl-6 text-[15px] font-medium text-text group-hover:text-accent ${japaneseFontClass(lead)}`}
      >
        {lead}
      </span>
      <span className="min-w-0 text-[13px] text-text-muted">
        <span className="block truncate">{gloss}</span>
        {note && note !== gloss ? (
          <span className="block truncate text-text-muted/70">{note}</span>
        ) : null}
      </span>
      {select ? (
        <Link
          href={href}
          aria-label="Open"
          onClick={(e) => e.stopPropagation()}
          className={arrowCls}
        >
          ↗
        </Link>
      ) : (
        <span aria-hidden className={arrowCls}>
          ↗
        </span>
      )}
    </>
  );
  if (select) {
    return (
      <ShelfRow
        selected={select.selected}
        onToggleSelect={select.onToggle}
        className={layout}
      >
        {cells}
      </ShelfRow>
    );
  }
  return (
    <ShelfRow href={href} className={layout}>
      {cells}
    </ShelfRow>
  );
}

/** The tile's hover hint.
 *
 * The hint comes from src/data/mnemonics.ts — the ONE authored source for what a
 * character's story is. This used to read from a second, older table of short
 * shape hooks, which drifted: あ's tile promised "an antenna poking out of a TV"
 * while its entry page told the acrobat-and-father story. One character, two
 * stories, and no way to notice. Deriving from `getMnemonic` means editing the
 * mnemonic updates the tooltip too.
 *
 * `object` — the thing the drawing depicts ("father") — is the short hook a
 * tooltip can carry; the mnemonic prose is a full sentence and belongs on the
 * card, not in a title attribute. A glyph with nothing authored (katakana,
 * kanji, words) gets NO invented hint — just the speaker affordance. */
function mnemonicOf(kind: Kind, entry: LibEntry): string | undefined {
  if (kind !== KANA_SUBJECT) return undefined;
  const hear = "tap the speaker to hear it";
  const object = getMnemonic(entry.glyph)?.object;
  return object ? `${object} · ${hear}` : hear;
}
