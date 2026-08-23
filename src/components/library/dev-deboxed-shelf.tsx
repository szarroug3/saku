"use client";

// DEV-ONLY, used only by /dev/library. The REDESIGNED, de-boxed Library shelf.
//
// THE TILE IS THE BOX. De-boxing the section <Card> was near-invisible in kiri (a
// Card there is already a transparent hole with a faint border), so what actually
// reads as "boxy" is each TILE — a rounded, outlined bg-card cell with a ✓ corner
// and two always-on 🔊/↗ buttons crammed inside. So the redesigned tile
// (DeboxedTile) drops the border and fill entirely: glyph + romaji on the mesh, a
// flat hover tint for the select target (no shadow — the density rule), an accent
// wash when selected, and the actions revealed only on hover. The row kinds
// (grammar) get the SAME treatment via DeboxedRow: hairline-separated list, but
// the select checkbox and ↗ are hover-revealed, not always-on furniture.
//
// COLLAPSIBLE, like the shipped shelf. Kana keeps its two-level structure —
// collapsible Hiragana / Katakana script headers, and a collapse chevron on every
// section — because a 46-kana shelf you can fold is easier to navigate than one
// long scroll. Section ids start with "hiragana"/"katakana", the same grouping
// key shelves.tsx uses.

// SAK-170: HearButtons on this shelf stay generic (no `downstep`/pitch line),
// same call as entry-tile.tsx and for the same reasons — a dev-only,
// mixed-kind, dense tile/row comparison shelf is the wrong place to introduce
// per-tile pitch decoration; see entry-tile.tsx's header comment for the full
// reasoning (per-tile fetch cost + the shelf's own deliberate no-decoration
// design call).

import { useMemo, useState } from "react";

import { HearButton } from "@/components/ui/hear-button";
import { Hint, Lbl } from "@/components/ui";
import { KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { GRAMMAR_CONCEPT_SUBJECT } from "@/data/grammar-concepts";
import { KEIGO_SUBJECT } from "@/data/keigo";
import { MARK_SUBJECT } from "@/data/marks";
import { TERM_SUBJECT } from "@/data/terms";
import { TRANSITIVITY_SUBJECT } from "@/data/transitivity-facts";
import {
  entryName,
  SENTENCE_RULE_KIND,
  type Kind,
  type LibEntry,
} from "@/lib/library/entries";
import { EntryLink } from "@/components/library/entry-link";
import { japaneseFontClass } from "@/lib/japanese-text";
import { resolveHrefs } from "@/lib/library/server-lookups";
import { subLabel } from "@/lib/library/sub-label";
import { sectionState, type Selection } from "@/lib/library/selection";
import { useServerLookup } from "@/lib/library/use-server-lookup";
import type { ShelfSection } from "@/lib/library/shelf-view";
import type { EntryId } from "@/types";

/** A collapse/expand chevron, matching the shipped shelf's affordance. */
function Chevron({
  expanded,
  onClick,
  label,
}: {
  expanded: boolean;
  onClick(): void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={label}
      onClick={onClick}
      className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-lg leading-none text-text-muted hover:bg-panel hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span
        aria-hidden
        className={`block transition-transform ${expanded ? "rotate-90" : ""}`}
      >
        ›
      </span>
    </button>
  );
}

export function DeboxedShelf({
  kind,
  sections,
  selected,
  onToggleEntry,
  onToggleSection,
  voice,
}: {
  kind: Kind;
  sections: readonly ShelfSection[];
  selected: Selection;
  onToggleEntry(id: EntryId, shiftKey: boolean): void;
  onToggleSection(ids: readonly EntryId[]): void;
  voice: string;
}) {
  const [collapsedSections, setCollapsedSections] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [collapsedScripts, setCollapsedScripts] = useState<ReadonlySet<string>>(
    new Set(),
  );

  // SAK-118: every tile/row on this shelf renders its own EntryLink (the ↗
  // "open" target) — collected and resolved ONCE here, batched, instead of one
  // getEntryHref Server Action call per rendered entry (this dev shelf can hold
  // as many entries as the shipped one). Passed down as `href` so EntryLink
  // skips its own per-instance fetch entirely.
  const allIds = useMemo(
    () => sections.flatMap((s) => s.entries.map((e) => e.id)),
    [sections],
  );
  const hrefs = useServerLookup(resolveHrefs, [allIds]) ?? {};
  const toggle = (
    set: ReadonlySet<string>,
    apply: (s: ReadonlySet<string>) => void,
    id: string,
  ) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  };

  // Same kind → rows decision the shipped shelf makes (see shelves.tsx `asRows`).
  const asRows =
    kind === GRAMMAR_SUBJECT ||
    kind === MARK_SUBJECT ||
    kind === SENTENCE_RULE_KIND ||
    kind === TRANSITIVITY_SUBJECT ||
    kind === KEIGO_SUBJECT ||
    kind === TERM_SUBJECT ||
    kind === GRAMMAR_CONCEPT_SUBJECT;

  /** One de-boxed section: a quiet header (collapse chevron + select-all eyebrow +
   * count), then — unless collapsed — the tile grid or the row list. `first`
   * drops the top hairline so groups butt cleanly against a script header. */
  const sectionBlock = (section: ShelfSection, first: boolean) => {
    const ids = section.entries.map((e) => e.id);
    const state = sectionState(selected, ids);
    const expanded = !collapsedSections.has(section.id);
    const sectionAsRows =
      asRows || section.asRows || section.entries.every((e) => !e.glyph);
    return (
      <section
        key={section.id}
        className={first ? "" : "mt-4 border-t border-white/[0.08] pt-4"}
      >
        <div className="mb-2 flex items-center gap-1.5">
          <Chevron
            expanded={expanded}
            onClick={() =>
              toggle(collapsedSections, setCollapsedSections, section.id)
            }
            label={`${expanded ? "Collapse" : "Expand"} ${section.label}`}
          />
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
          sectionAsRows ? (
            kind === GRAMMAR_SUBJECT ? (
              <div className="grid grid-cols-[max-content_max-content_minmax(0,1fr)_auto] gap-x-4">
                {section.entries.map((entry) => (
                  <DeboxedRow
                    key={entry.id}
                    entry={entry}
                    href={hrefs[entry.id as unknown as string]}
                    grid
                    selected={selected.has(entry.id)}
                    onToggle={(shift) => onToggleEntry(entry.id, shift)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col">
                {section.entries.map((entry) => (
                  <DeboxedRow
                    key={entry.id}
                    entry={entry}
                    href={hrefs[entry.id as unknown as string]}
                    selected={selected.has(entry.id)}
                    onToggle={(shift) => onToggleEntry(entry.id, shift)}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
              {section.entries.map((entry) => (
                <DeboxedTile
                  key={entry.id}
                  entry={entry}
                  href={hrefs[entry.id as unknown as string]}
                  voice={voice}
                  selected={selected.has(entry.id)}
                  onToggle={(shift) => onToggleEntry(entry.id, shift)}
                />
              ))}
            </div>
          )
        ) : null}
      </section>
    );
  };

  // Kana keeps its collapsible Hiragana / Katakana script headers; every other
  // kind is a flat list of sections.
  if (kind === KANA_SUBJECT) {
    return (
      <div>
        {(["hiragana", "katakana"] as const).map((script, scriptIdx) => {
          const scriptSections = sections.filter((s) => s.id.startsWith(script));
          if (!scriptSections.length) return null;
          const expanded = !collapsedScripts.has(script);
          return (
            <div key={script} className={scriptIdx === 0 ? "" : "mt-5"}>
              <div className="flex items-center gap-1.5 pb-1">
                <Chevron
                  expanded={expanded}
                  onClick={() =>
                    toggle(collapsedScripts, setCollapsedScripts, script)
                  }
                  label={`${expanded ? "Collapse" : "Expand"} ${script}`}
                />
                <Lbl>{script === "hiragana" ? "Hiragana" : "Katakana"}</Lbl>
              </div>
              {expanded
                ? scriptSections.map((section, i) => sectionBlock(section, i === 0))
                : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>{sections.map((section, i) => sectionBlock(section, i === 0))}</div>
  );
}

/** The redesigned, BORDERLESS tile — the subject of this comparison. No outline,
 * no fill: glyph + romaji sit straight on the mesh. The whole cell is the SELECT
 * target, signalled by a flat hover tint (never a shadow) and an accent wash when
 * on. The 🔊 / ↗ actions are hidden at rest and revealed on hover/focus. Glyph
 * shrink-to-fit is copied from EntryTile so sizing matches the boxed side. */
function DeboxedTile({
  entry,
  href,
  voice,
  selected,
  onToggle,
}: {
  entry: LibEntry;
  /** Pre-resolved by DeboxedShelf's batched lookup — see its own header. */
  href: string | undefined;
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
        <EntryLink
          id={entry.id}
          href={href}
          onClick={(e) => e.stopPropagation()}
          ariaLabel={`Open ${entryName(entry)}`}
          className="inline-flex size-5 items-center justify-center rounded-md text-[11px] leading-none text-text-muted no-underline hover:text-text"
        >
          ↗
        </EntryLink>
      </div>
    </div>
  );
}

/** The row twin of DeboxedTile, for the kinds that read as a list (grammar). A
 * hairline-separated line — the list separator was never the box — but the select
 * checkbox and the ↗ are hover-revealed, and the whole row carries the same flat
 * hover tint / accent-on-select as the tiles, so a row shelf and a tile shelf feel
 * like one system. `grid` opts into the parent's subgrid so the pattern column
 * aligns down the list. */
function DeboxedRow({
  entry,
  href,
  selected,
  grid = false,
  onToggle,
}: {
  entry: LibEntry;
  /** Pre-resolved by DeboxedShelf's batched lookup — see its own header. */
  href: string | undefined;
  selected: boolean;
  grid?: boolean;
  onToggle(shiftKey: boolean): void;
}) {
  const meaning = entry.meanings.slice(0, 3).join(", ") || entry.sub;
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
      className={`group cursor-pointer select-none items-center border-b border-white/[0.06] py-2 text-text transition-colors last:border-b-0 ${
        grid ? "col-span-full grid grid-cols-subgrid" : "flex gap-3 px-1"
      } ${selected ? "bg-accent-bg" : "hover:bg-white/[0.04]"}`}
    >
      {/* Select box — hover/selected reveal, so at rest the row is just its text. */}
      <span
        className={`flex h-4 w-4 flex-none items-center justify-center rounded text-[10px] leading-none transition-opacity ${
          selected
            ? "bg-accent text-bg opacity-100"
            : "border border-border text-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        }`}
        aria-hidden
      >
        ✓
      </span>
      {entry.glyph ? (
        <span
          className={`whitespace-nowrap text-[19px] ${
            grid ? "" : "max-w-[150px] flex-none truncate"
          } ${japaneseFontClass(entry.glyph)}`}
        >
          {entry.glyph}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-[13px]">{meaning}</span>
      <EntryLink
        id={entry.id}
        href={href}
        onClick={(e) => e.stopPropagation()}
        ariaLabel={`Open ${entryName(entry)}`}
        className="inline-flex size-5 flex-none items-center justify-center rounded-md text-[11px] leading-none text-text-muted no-underline opacity-0 transition-opacity hover:text-text group-hover:opacity-100 group-focus-within:opacity-100"
      >
        ↗
      </EntryLink>
    </div>
  );
}
