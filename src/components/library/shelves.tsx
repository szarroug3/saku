"use client";

// The shelves — what the Library is when you haven't typed anything.
//
// A shelf is a Kind, cut into sections that the DATA already has. That
// qualifier is the whole design of this file: the kana shelf's sections are the
// gojūon rows because kana genuinely comes in rows, and the kanji shelf's are
// jōyō grades because that is what KANJIDIC2 records. The words shelf has no
// sections, because the data gives it none; it shows the first screenful of
// everyday words and sends you to search for the rest, instead of pretending to
// be browsable. A shelf you cannot honestly cut is a search box, and saying so
// is cheaper than a fake hierarchy.
//
// SECTIONS AND TILES ARE MULTI-SELECT TOGGLES. You BUILD a drill by turning
// things on: a section header toggles its whole row (hiragana vowels, the k-row,
// a jōyō grade), and a single tile toggles just that glyph. Several can be on at
// once, across kinds — the set lives on the page (see lib/library/selection.ts),
// not here, so this file only draws the on/some/off state and reports toggles
// up. The bar downstream unions everything on into one Slice, so "mark as known"
// and "drill this" stay hierarchical without a hierarchy feature: the user's own
// "i know all hiragana, i know all hiragana vowels, i know all k-rows" is three
// depths of the same set.

import Link from "next/link";

import { KANJI, KANJI_SUBJECT } from "@/data/kanji";
import { KANA_SUBJECT, mnemonicFor, SETS } from "@/data/characters";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { GRAMMAR_SUBJECT, patternEntry } from "@/data/grammar";
import { RECIPES } from "@/data/grammar/recipes";
import { EntryRow, EntryTile } from "@/components/library/entry-tile";
import { Card, Hint, Lbl } from "@/components/ui";
import type { Claims } from "@/lib/claims";
import { entryForGlyph, libEntry, type Kind, type LibEntry } from "@/lib/library/entries";
import { sectionState, type Selection } from "@/lib/library/selection";
import { entryStanding } from "@/lib/library/standing";
import { factsOf } from "@/lib/facts";
import type { AccuracyMetric, EntryId, FactAggregate } from "@/types";

/** One cut of a shelf: a name and the entries under it. */
export interface ShelfSection {
  readonly id: string;
  readonly label: string;
  readonly entries: readonly LibEntry[];
}

/** How many word tiles the words shelf shows before it tells you to search.
 *
 * A display cap: the words shelf shows this many everyday-word tiles and points
 * the rest at search. The drill is now built from what you SELECT, so there is
 * no longer a hidden "all 8,045" the bar acts on behind a screenful of 120 —
 * what you can see and toggle is what you drill. */
const WORD_TILES = 120;

/** How many kanji tiles a grade section paints before it defers the rest to
 * search — the words shelf's honesty, applied per grade so the Kanji tab does
 * not render all ~2,136 at once. The SELECT toggle and the count stay over the
 * WHOLE grade, so "select all of grade 1" still means all of it; only the tiles
 * are capped. */
const KANJI_TILES = 60;

/** The sections of a shelf, cut the way the data is already cut. */
export function shelfSections(kind: Kind): ShelfSection[] {
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
      // 1–6 and 8. THERE IS NO GRADE 7 (see KanjiRow.grade) — this reads the
      // grades that are actually present rather than iterating a range, which
      // is how a screen invents one.
      const grades = [...new Set(KANJI.map((k) => k.grade))].sort((a, b) => a - b);
      return grades.map((g) => ({
        id: `grade-${g}`,
        label: `Jōyō grade ${g}`,
        entries: KANJI.filter((k) => k.grade === g).flatMap((k) =>
          resolve(entryForGlyph(KANJI_SUBJECT, k.c)),
        ),
      }));
    }
    case GRAMMAR_SUBJECT:
      // By JLPT level, the one cut the recipes already carry. It is opinion, not
      // fact (see recipes.ts) — good enough for a shelf, and it keeps the two
      // groups small enough to render whole.
      return (["N5", "N4"] as const).map((lv) => ({
        id: `level-${lv}`,
        label: `${lv} patterns`,
        entries: RECIPES.filter((r) => r.level === lv).flatMap((r) =>
          resolve(patternEntry(r.id)),
        ),
      }));
    case VOCAB_SUBJECT:
      return [];
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
  allEntries,
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
  /** Every entry on the shelf, for the words case where sections are empty. */
  allEntries: readonly LibEntry[];
  /** The global, cross-kind selection this shelf draws its on-state from. */
  selected: Selection;
  onToggleEntry(id: EntryId): void;
  onToggleSection(ids: readonly EntryId[]): void;
  facts: Record<EntryId | string, FactAggregate>;
  claims: Claims;
  metric: AccuracyMetric;
  now: number;
  voice: string;
}) {
  const tile = (entry: LibEntry) => (
    <EntryTile
      key={entry.id}
      entry={entry}
      voice={voice}
      mnemonic={mnemonicOf(kind, entry)}
      standing={entryStanding(factsOf(entry.id), facts, claims, metric, now)}
      selected={selected.has(entry.id)}
      onToggleSelect={() => onToggleEntry(entry.id)}
    />
  );

  // A grammar pattern is a phrase, not a glyph — 〜なければならない does not fit a
  // 100px tile — so the Grammar shelf lays its patterns out as ROWS (the same
  // shape search results use), which have room for the pattern and its gloss.
  const row = (entry: LibEntry) => (
    <EntryRow
      key={entry.id}
      entry={entry}
      voice={voice}
      note={entry.sub}
      standing={entryStanding(factsOf(entry.id), facts, claims, metric, now)}
      selected={selected.has(entry.id)}
      onToggleSelect={() => onToggleEntry(entry.id)}
    />
  );

  if (kind === VOCAB_SUBJECT) {
    return (
      <Card>
        <Lbl>Everyday words</Lbl>
        <p className="mb-3">
          <Hint>
            Common everyday words — the first {WORD_TILES} are here. Search to
            find any of the others.
          </Hint>
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
          {allEntries.slice(0, WORD_TILES).map(tile)}
        </div>
      </Card>
    );
  }

  const asRows = kind === GRAMMAR_SUBJECT;

  return (
    <>
      {kind === KANA_SUBJECT ? <TofuguCard /> : null}
      {kind === GRAMMAR_SUBJECT ? <GrammarClustersCard /> : null}
      {sections.map((section) => {
        const ids = section.entries.map((e) => e.id);
        const state = sectionState(selected, ids);
        const onCount = ids.filter((id) => selected.has(id)).length;
        // Display cap for the huge kanji grade sections. The toggle and count
        // above use the FULL `ids`; only what renders is sliced.
        const cap = kind === KANJI_SUBJECT ? KANJI_TILES : Infinity;
        const shown = section.entries.slice(0, cap);
        const hidden = section.entries.length - shown.length;
        return (
          <Card key={section.id}>
            <div className="mb-2 flex items-center gap-2">
              {/* Tri-state header, and each state NAMES ITS OWN text colour in
                  the same string as its border/fill — no shared `text-*` for a
                  branch's colour to lose to on stylesheet order (the cx hazard
                  ui.tsx documents). Not the Chip component: Chip's `part` prop
                  collides with the DOM `part` attribute and types as `undefined`,
                  so the partial state is built here instead. */}
              <button
                type="button"
                onClick={() => onToggleSection(ids)}
                aria-pressed={state === "all"}
                className={`cursor-pointer rounded-(--radius) border px-2 py-0.5 text-[13px] font-semibold uppercase tracking-[0.04em] ${
                  state === "all"
                    ? "border-accent bg-accent-bg text-accent"
                    : state === "some"
                      ? "border-warning bg-warning-bg text-warning"
                      : "border-transparent text-text-muted hover:border-border"
                }`}
              >
                {section.label}
              </button>
              <span className="text-xs text-text-muted">
                {section.entries.length}
              </span>
              {state !== "none" ? (
                <Hint>
                  — {onCount} selected{state === "all" ? " (all)" : ""}
                </Hint>
              ) : null}
            </div>
            {asRows ? (
              <div className="flex flex-col">{shown.map(row)}</div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                {shown.map(tile)}
              </div>
            )}
            {hidden > 0 ? (
              <p className="pt-2.5">
                <Hint>
                  ＋ {hidden} more in {section.label} — search to find any of them.
                </Hint>
              </p>
            ) : null}
          </Card>
        );
      })}
    </>
  );
}

/** The way into the cluster maps, now that Grammar is a Library shelf rather
 * than a tab. The maps are uniquely grammar — "the seven ways to say must", side
 * by side — and do not fit a tile grid, so they stay their own view and this is
 * the door to it. */
function GrammarClustersCard() {
  return (
    <Card>
      <Lbl>Patterns that mean the same thing</Lbl>
      <p className="text-[13px] text-text-muted">
        Some patterns come out as the same English — seven ways to say{" "}
        <b className="font-medium text-text">must</b>, four ways to say{" "}
        <b className="font-medium text-text">if</b>. Those are laid out side by
        side on their own.{" "}
        <Link href="/grammar" className="text-accent no-underline">
          Compare similar patterns →
        </Link>
      </p>
    </Card>
  );
}

/** The kana chart's outbound links, carried over from /chart when it became this
 * shelf. They are the one thing on that page that was not a tile, and they are
 * the reason a beginner opened it — the app teaches you to recognise kana and
 * Tofugu teaches you to learn them, which is a different job this app has never
 * claimed to do. */
function TofuguCard() {
  return (
    <Card>
      <p className="mb-1.5 text-[13px]">
        <span className="text-text-muted">Tofugu guides:</span>
        <TofuguLink href="https://www.tofugu.com/japanese/learn-hiragana/">
          Hiragana ↗
        </TofuguLink>{" "}
        ·
        <TofuguLink href="https://www.tofugu.com/japanese/learn-katakana/">
          Katakana ↗
        </TofuguLink>
      </p>
      <p className="text-[13px]">
        <span className="text-text-muted">Charts:</span>
        <TofuguLink href="https://files.tofugu.com/articles/japanese/2014-06-30-learn-hiragana/hiragana-chart-by-tofugu.jpg">
          Hiragana chart ↗
        </TofuguLink>{" "}
        ·
        <TofuguLink href="https://files.tofugu.com/articles/japanese/2016-03-07-hiragana-mnemonics-chart/hiragana-mnemonic-chart-by-tofugu.jpg">
          Hiragana mnemonics ↗
        </TofuguLink>{" "}
        ·
        <TofuguLink href="https://files.tofugu.com/articles/japanese/2014-09-03-learn-katakana/tofugu-katakana-chart.jpg">
          Katakana chart ↗
        </TofuguLink>{" "}
        ·
        <TofuguLink href="https://files.tofugu.com/articles/japanese/2014-09-03-learn-katakana/tofugu-katakana-mnemonic-chart.jpg">
          Katakana mnemonics ↗
        </TofuguLink>
      </p>
    </Card>
  );
}

function TofuguLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="ml-2.5 whitespace-nowrap text-xs text-accent no-underline"
    >
      {children}
    </a>
  );
}

/** char → its chart mnemonic, built once from the same walk that builds
 * CHAR_INDEX.
 *
 * `mnemonicFor` wants a KanaChar and its SECTION LABEL, neither of which
 * survives into a LibEntry — and reconstructing the label by splitting
 * `entry.sub` back apart would be a round trip through a display string, which
 * is precisely the kind of join that rots the first time someone rewords a
 * heading. Walking SETS here costs one pass over 214 characters at module load
 * and cannot be wrong. */
const KANA_MNEMONIC: ReadonlyMap<string, string> = new Map(
  SETS.flatMap((set) =>
    set.sections.flatMap((section) =>
      section.chars.map(
        (ch) => [ch.c, mnemonicFor(ch, section.label)] as const,
      ),
    ),
  ).filter(([, mn]) => !!mn),
);

function mnemonicOf(kind: Kind, entry: LibEntry): string | undefined {
  if (kind !== KANA_SUBJECT) return undefined;
  const mn = KANA_MNEMONIC.get(entry.glyph);
  return mn ? `${mn} · tap 🔊 to hear it` : undefined;
}
