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

import {
  GRAMMAR_CONCEPT_SUBJECT,
  SENTENCE_RULE_KIND,
} from "@/lib/library/library-index";
import { KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT } from "@/lib/library/library-index";
import { MARK_SUBJECT } from "@/data/marks";
import { TERM_SUBJECT } from "@/data/terms";
import { TRANSITIVITY_SUBJECT, pairForEntry } from "@/data/transitivity-facts";
import { KEIGO_SUBJECT, keigoSetForEntry } from "@/data/keigo";
import { entryHref } from "@/lib/library/href";
import { japaneseFontClass } from "@/lib/japanese-text";
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
import type { Kind, LibEntry } from "@/lib/library/entries";
import { filterSections, type ShelfSection } from "@/lib/library/shelf-view";
import { sectionState, type Selection } from "@/lib/library/selection";

import type { EntryId } from "@/types";

/** One cut of a shelf: a name and the entries under it. Its type and the view
 * math that reads it live in @/lib/library/shelf-view so they can be unit-tested;
 * this file only builds and renders them. */

/** The sections of a shelf — the actual cut logic now lives in
 * @/lib/library/shelf-sections, a plain data module with no React import edge,
 * so group-nav.ts (and its node:test suite, which cannot resolve a .tsx module)
 * can depend on it without pulling this component along. Re-exported here so
 * every existing caller of `shelves.tsx`'s `shelfSections` keeps working
 * unchanged. */
export { shelfSections } from "@/lib/library/shelf-sections";

/**
 * Defer a heavy section body until it is near the viewport, then mount it ONCE.
 *
 * MODULE SCOPE, deliberately — NOT nested in Shelf. A component declared inside
 * its parent is a fresh function every render, so React unmounts and remounts it
 * each time: a selection, filter or search would reset every deferred section to
 * its placeholder and re-mount it, flickering the whole table exactly like a
 * fresh page load. Hoisted, it keeps its `mounted` state across the parent's
 * re-renders, so a section mounts once and stays.
 *
 * `reserve` is the section's estimated height, held by the placeholder so the
 * real mount does not resize the document — the layout shift that made the
 * deferral so obvious. `eager` mounts immediately and skips the observer.
 */
function DeferredSectionBody({
  eager,
  reserve,
  children,
}: {
  eager: boolean;
  reserve: number;
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
      {mounted ? children : <div style={{ height: reserve }} aria-hidden="true" />}
    </div>
  );
}

export function Shelf({
  kind,
  sections,
  selected,
  onToggleEntry,
  onToggleSection,
  voice,
  keep,
  filter = "",
  selectMode,
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
  /** The active Status selection, already formatted as words ("known, solid",
   * "no status") — for the empty-state copy only. The predicate above does the
   * filtering; the Status dropdown is now a genuine multi-select (SAK-63), so
   * this is a caller-built label rather than one enum value this file could
   * switch on. Empty string means "no filter description needed" (nothing has
   * been narrowed enough for a shelf to ever come up empty from it). */
  filter?: string;
  /** Whether a plain click on a tile/row currently toggles selection (true) or
   * opens the entry (false, the default — see entry-tile.tsx's file header). */
  selectMode: boolean;
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
      selected={selected.has(entry.id)}
      selectMode={selectMode}
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
      selectMode={selectMode}
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
      selectMode={selectMode}
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
        selectMode={selectMode}
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
        selectMode={selectMode}
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

  // The whole shelf renders up front UNLESS it is genuinely huge. Every subject
  // but vocab — kana, kanji (~2k), radicals, counters, keigo, grammar, marks,
  // terms — is at most a couple thousand entries, small enough to mount in one
  // pass, so the shelf appears COMPLETE with no on-scroll pop-in (the visible
  // jank the deferral used to cause). Only the ~30k-word vocab shelf keeps
  // deferring off-screen sections; even it mounts enough to fill the first screen
  // and reserves each deferred section's real height so nothing shifts.
  const shelfEntryTotal = shownSections.reduce((n, s) => n + s.entries.length, 0);
  const eagerAll = shelfEntryTotal <= 3000;

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
    // A rough height for the deferred placeholder, so mounting the real body does
    // not resize the page. Rows run ~44px each; tiles pack ~8 to a wide row at
    // ~92px tall. Plus the header. Only read when this section actually defers.
    const reserve = sectionAsRows
      ? section.entries.length * 44 + 40
      : Math.ceil(section.entries.length / 8) * 92 + 40;
    return (
      // NO Card — de-boxed. A quiet header (collapse chevron + plain-eyebrow
      // select-all + count) over a real hairline between sections; the first in a
      // group has none. The tile grid / row list carries the shelf now, not a box.
      <section
        key={section.id}
        className={`kq-defer ${first ? "" : "mt-1.5 border-t border-white/[0.08] pt-1.5"}`}
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
          <DeferredSectionBody eager={eagerAll || index < 3} reserve={reserve}>
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
              // Kana are simple, single glyphs — a smaller square keeps them from
              // floating in too much space; kanji/radicals want the roomier cell.
              // (Both class strings are literal so Tailwind JIT sees them.)
              <div
                className={`grid ${
                  kind === KANA_SUBJECT
                    ? "grid-cols-[repeat(auto-fill,minmax(60px,1fr))]"
                    : "grid-cols-[repeat(auto-fill,minmax(84px,1fr))]"
                } items-start gap-x-2 gap-y-1 pl-[26px]`}
              >
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

/** What the shelf says when the Status filter removed everything on it. Only
 * reached with a filter active — every status checked never empties a shelf —
 * so it always names the filter (already formatted by the caller — see
 * Shelf's `filter` prop) and points at the way out. */
function FilterEmpty({ filter }: { filter: string }) {
  return (
    <p className="text-[13px] text-text-muted">
      Nothing on this shelf matches the {filter} filter.{" "}
      <Hint>Check more boxes in the Status dropdown to see the whole shelf, or search.</Hint>
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
  selectMode = false,
}: {
  lead: string;
  gloss: string;
  note?: string;
  href: string;
  select?: { selected: boolean; onToggle: (shiftKey: boolean) => void };
  /** Whether a plain click currently toggles selection (true) or opens the
   * entry (false, the default). Only meaningful when `select` is given — a
   * cluster-map row with no `select` at all always opens, mode or not. */
  selectMode?: boolean;
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
        // Only rendered while selecting — a "peek" so the entry can be opened
        // without dropping the selection being built. Off select mode the row
        // itself already opens the entry (see the `select` branch below), so
        // this slot renders nothing rather than a now-redundant arrow.
        selectMode ? (
          <Link
            href={href}
            aria-label={`Open ${lead}`}
            onClick={(e) => e.stopPropagation()}
            className={`relative z-10 ${arrowCls}`}
          >
            ↗
          </Link>
        ) : null
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
        selectMode={selectMode}
        href={href}
        openLabel={`Open ${lead}`}
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

