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
// TILES STAY FLAT AND SHIPPED. The tiles and rows are the unchanged EntryTile /
// EntryRow from entry-tile.tsx, and their standing runs through the SAME
// entryStanding the live shelf uses (see shelves.tsx) — so this is a faithful
// density comparison, not a re-skin.

import {
  EntryRow,
  EntryTile,
} from "@/components/library/entry-tile";
import { Hint } from "@/components/ui";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { GRAMMAR_CONCEPT_SUBJECT } from "@/data/grammar-concepts";
import { KEIGO_SUBJECT } from "@/data/keigo";
import { MARK_SUBJECT } from "@/data/marks";
import { TERM_SUBJECT } from "@/data/terms";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import { SENTENCE_RULE_KIND, type Kind, type LibEntry } from "@/lib/library/entries";
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
    <EntryTile
      key={entry.id}
      entry={entry}
      voice={voice}
      standing={entryStanding(factsOf(entry.id), facts, claims, metric, now)}
      showStatus={false}
      selected={selected.has(entry.id)}
      onToggleSelect={(shift) => onToggleEntry(entry.id, shift)}
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
