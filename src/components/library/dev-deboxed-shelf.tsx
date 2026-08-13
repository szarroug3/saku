"use client";

// DEV-ONLY, used only by /dev/library. The REDESIGNED, de-boxed Library shelf —
// the same tiles and rows the shipped Shelf draws, but with the per-section
// <Card> taken off. This is the last box holdout in an app that went boxless
// everywhere else (the Learn feed, the Library entry pages), so the redesign
// sits the sections straight on the mesh: a quiet uppercase eyebrow for the
// section name, its count beside it, a hairline border-top between groups, then
// the tile grid or row list. No Card, no fill, no rounded panel, and — the hard,
// learned rule — NO shadow/blur/glow on tiles or sections, because a kanji shelf
// is thousands of tiles and any blurred shadow on scrolling content reintroduces
// severe scroll jank. Separation is hairline borders + whitespace only.
//
// THE TILE IS THE BOX. De-boxing the SECTIONS changed almost nothing in kiri: a
// <Card> there is already a transparent hole with a faint 1px border, so removing
// it is invisible. What actually reads as "boxy" is each TILE — a rounded,
// outlined bg-card cell with a ✓ corner and two always-on 🔊/↗ buttons crammed
// inside. So the redesigned tile (DeboxedTile below) drops the border and fill
// entirely: just the glyph and its romaji sitting on the mesh, a flat hover tint
// for the select target (no shadow — the density rule), an accent wash when
// selected, and the 🔊/↗ actions revealed only on hover so the resting shelf is
// clean glyphs, not a grid of boxes. Rows keep the shipped EntryRow (a list is
// honestly a list; its hairlines were never the problem). Standings run through
// the same entryStanding the live shelf uses.

import Link from "next/link";

import { EntryRow } from "@/components/library/entry-tile";
import { HearButton } from "@/components/lesson/hear-button";
import { Hint } from "@/components/ui";
import { entryHref } from "@/lib/library/href";
import { japaneseFontClass } from "@/lib/japanese-text";
import { subLabel } from "@/lib/library/sub-label";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { GRAMMAR_CONCEPT_SUBJECT } from "@/data/grammar-concepts";
import { KEIGO_SUBJECT } from "@/data/keigo";
import { MARK_SUBJECT } from "@/data/marks";
import { TERM_SUBJECT } from "@/data/terms";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { entryName, SENTENCE_RULE_KIND, type Kind, type LibEntry } from "@/lib/library/entries";
import { sectionState, type Selection } from "@/lib/library/selection";
import type { ShelfSection } from "@/lib/library/shelf-view";
import { entryStanding } from "@/lib/library/standing";
import { factsOf } from "@/lib/facts";
import type { AccuracyMetric, EntryId, FactAggregate } from "@/types";

export function DeboxedShelf({
  kind,
  sections,
  selected,
  onToggleEntry,
  onToggleSection,
  facts,
  claims,
  metric,
  now,
  voice,
}: {
  kind: Kind;
  sections: readonly ShelfSection[];
  selected: Selection;
  onToggleEntry(id: EntryId, shiftKey: boolean): void;
  onToggleSection(ids: readonly EntryId[]): void;
  facts: Record<EntryId | string, FactAggregate>;
  claims: Record<string, number>;
  metric: AccuracyMetric;
  now: number;
  voice: string;
}) {
  // Same kind → rows decision the shipped shelf makes (see shelves.tsx `asRows`).
  const asRows =
    kind === GRAMMAR_SUBJECT ||
    kind === MARK_SUBJECT ||
    kind === SENTENCE_RULE_KIND ||
    kind === TRANSITIVITY_SUBJECT ||
    kind === KEIGO_SUBJECT ||
    kind === TERM_SUBJECT ||
    kind === GRAMMAR_CONCEPT_SUBJECT;

  const tile = (entry: LibEntry) => (
    <DeboxedTile
      key={entry.id}
      entry={entry}
      voice={voice}
      selected={selected.has(entry.id)}
      onToggle={(shift) => onToggleEntry(entry.id, shift)}
    />
  );

  const row = (entry: LibEntry, grid = false) => (
    <EntryRow
      key={entry.id}
      entry={entry}
      voice={voice}
      note={entry.sub}
      grid={grid}
      standing={entryStanding(factsOf(entry.id), facts, claims, metric, now)}
      showStatus={false}
      selected={selected.has(entry.id)}
      onToggleSelect={(shift) => onToggleEntry(entry.id, shift)}
    />
  );

  return (
    <div>
      {sections.map((section, index) => {
        const ids = section.entries.map((e) => e.id);
        const state = sectionState(selected, ids);
        const sectionAsRows =
          asRows || section.asRows || section.entries.every((e) => !e.glyph);
        return (
          // A REAL CSS hairline border-top separates groups; the first has none.
          // No Card, no fill, no rounded panel, no shadow.
          <section
            key={section.id}
            className={
              index === 0 ? "" : "mt-4 border-t border-white/[0.08] pt-4"
            }
          >
            {/* The quiet section-head: name as a small uppercase eyebrow (which
                doubles as the select-all toggle the shipped shelf's header is),
                the count beside it as a Hint. */}
            <div className="mb-2 flex items-baseline gap-2">
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
            {sectionAsRows ? (
              kind === GRAMMAR_SUBJECT ? (
                <div className="grid grid-cols-[auto_max-content_minmax(0,1fr)_auto_auto] gap-x-3 max-[600px]:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                  {section.entries.map((entry) => row(entry, true))}
                </div>
              ) : (
                <div className="flex flex-col">
                  {section.entries.map((entry) => row(entry))}
                </div>
              )
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                {section.entries.map(tile)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** The redesigned, BORDERLESS tile — the actual subject of this comparison. No
 * outline, no fill: the glyph and its romaji sit straight on the mesh. The whole
 * cell is still the SELECT target, signalled by a flat hover tint (never a
 * shadow) and an accent wash when on. The 🔊 / ↗ actions are hidden at rest and
 * revealed on hover/focus, so a resting shelf reads as clean glyphs rather than a
 * grid of boxes. Glyph shrink-to-fit is copied from EntryTile so the sizing
 * matches the boxed side exactly — only the container changes. */
function DeboxedTile({
  entry,
  voice,
  selected,
  onToggle,
}: {
  entry: LibEntry;
  voice: string;
  selected: boolean;
  onToggle(shiftKey: boolean): void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={(e) => onToggle(e.shiftKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle(e.shiftKey);
        }
      }}
      className={`group relative cursor-pointer select-none rounded-[10px] px-1.5 pb-1.5 pt-2 text-center [container-type:inline-size] transition-colors ${
        selected ? "bg-accent-bg" : "hover:bg-white/[0.04]"
      }`}
    >
      <div
        className={`select-none whitespace-nowrap leading-[1.25] ${
          selected ? "text-accent" : "text-text"
        } ${japaneseFontClass(entry.glyph)}`}
        style={{
          ["--chars" as string]: [...entry.glyph].length,
          fontSize: "clamp(12px, calc(90cqi / var(--chars)), 26px)",
        }}
      >
        {entry.glyph}
      </div>
      <div className="truncate text-xs text-text-muted">{subLabel(entry)}</div>
      {/* Actions occupy layout at all times (so hovering doesn't reflow the grid)
          but are invisible until hover/focus — the resting shelf stays clean. */}
      <div className="mt-1 flex items-center justify-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <HearButton
          glyph={entry.glyph}
          voiceName={voice}
          stopPropagation
          label={`Hear ${entryName(entry)}`}
        />
        <Link
          href={entryHref(entry.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Open ${entryName(entry)}`}
          className="inline-flex size-5 items-center justify-center rounded-md text-[11px] leading-none text-text-muted no-underline hover:text-text"
        >
          ↗
        </Link>
      </div>
    </div>
  );
}
