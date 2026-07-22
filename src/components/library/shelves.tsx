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
// THE KANJI SHELF IS THE EXCEPTION, AND IT IS CUT BY A SETTING. It used to be
// cut into jōyō grades, because that is what KANJIDIC2 records — and both
// halves of that were wrong for the reader. "Jōyō" is the 2,136-kanji list that
// is the entire contents of this app, so the word distinguishes nothing; and a
// grade is the school year a Japanese CHILD meets it, a curriculum for people
// who already speak the language. Worse, it was not the order she was studying
// in: kanji order is `cfg.newKanjiOrder`, it defaults to `everyday`, and under
// grade sections the kanji she will actually meet next were scattered across
// seven cards, one of which held 1,110 of the 2,136 and showed 60 of them.
//
// So `shelfSections` takes the order, and the kanji shelf is cut into
// consecutive hundreds OF THAT ORDER, labelled by range ("1–100", "101–200").
// Reading the shelf left to right, top to bottom, is reading the order you will
// meet them in. IT STOPS AFTER THREE OF THEM, because 2,136 kanji is 22 cards
// nobody scrolls and 300 is plenty to have on a page; a counted line says how
// many are left and sends you to search, which is what the words shelf has
// always done with its 12,553. `grade` mode still cuts by grade, because in THAT mode the
// grades are the study order — the boundary between grade 3 and grade 4 is a
// real event in the queue, and a range label would erase it. Its label just
// drops the jargon: "School grade 4", the wording the setting already uses.
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

import { KANJI_SUBJECT } from "@/data/kanji";
import { KANA_SUBJECT, SETS } from "@/data/characters";
import { getMnemonic } from "@/data/mnemonics";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { GRAMMAR_SUBJECT, patternEntry } from "@/data/grammar";
import { MARK_SUBJECT, MARKS, markEntry } from "@/data/marks";
import { TERM_SUBJECT, TERMS, termEntry } from "@/data/terms";
import { RADICAL_SUBJECT, RADICALS, radicalEntry } from "@/data/radicals";
import { VERB_PAIRS } from "@/data/transitivity";
import { TRANSITIVITY_SUBJECT, pairEntry, pairForEntry } from "@/data/transitivity-facts";
import { CLUSTERS } from "@/data/grammar/clusters";
import { RECIPES } from "@/data/grammar/recipes";
import {
  EntryRow,
  EntryTile,
  VerbPairHeader,
  VerbPairRow,
} from "@/components/library/entry-tile";
import { Card, Hint, Lbl } from "@/components/ui";
import type { Claims } from "@/lib/claims";
import {
  COUNTER_KIND,
  entryForGlyph,
  knownFactsOf,
  libEntry,
  type Kind,
  type LibEntry,
} from "@/lib/library/entries";
import { counterShelfSections } from "@/lib/library/counter-shelf";
import { kanjiCuts } from "@/lib/library/kanji-shelf";
import {
  filterSections,
  sectionCapFor,
  shownWordsOf,
  WORD_TILES,
  type ShelfSection,
} from "@/lib/library/shelf-view";
import { sectionState, type Selection } from "@/lib/library/selection";
import { entryStanding } from "@/lib/library/standing";
import type { KnowledgeFilter } from "@/lib/library/url-state";
import { factsOf } from "@/lib/facts";
import type { AccuracyMetric, EntryId, FactAggregate, NewKanjiOrder } from "@/types";

/** One cut of a shelf: a name and the entries under it. Its type and the view
 * math that reads it now live in @/lib/library/shelf-view (a .ts, so the filter
 * and cap logic can be unit-tested); this file only builds and renders them. */

/** How many kanji tiles a SCHOOL-GRADE section paints before it defers the rest
 * to search — the words shelf's honesty, applied per grade, because grade 8
 * alone holds 1,110 of the 2,136. The SELECT toggle and the count stay over the
 * WHOLE grade, so "select all of grade 1" still means all of it; only the tiles
 * are capped. The range sections do NOT use this: a range is 100 long, and
 * capping it at 60 would hide 40 of every 100 — a range section is shown WHOLE
 * or not at all, and the range modes stop after KANJI_SECTIONS_SHOWN of them
 * instead. */
const KANJI_TILES = 60;

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
      // BUILD EVERY CUT — do not stop at KANJI_SECTIONS_SHOWN here. The shelf's
      // three-section cap belongs AFTER the knowledge filter (see shelf-view.ts:
      // sectionCapFor / shownSectionsOf), because a filter that empties the
      // leading sections must still reveal the surviving ones behind them. The
      // cut itself stays complete — its tests hold that the cuts tile all 2,136
      // — and both `grade`'s seven sections and every range section come back
      // whole; the render decides how many to paint.
      return cuts.map((cut) => ({
        id: cut.id,
        label: cut.label,
        entries: cut.glyphs.flatMap((c) => resolve(entryForGlyph(KANJI_SUBJECT, c))),
        // Only the grade sections need a tile cap; a range is already small
        // enough to render whole. This `cap` is also how the render tells grade
        // mode from a range mode (see sectionCapFor).
        cap: kanjiOrder === "grade" ? KANJI_TILES : undefined,
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
          entries: MARKS.flatMap((m) => resolve(markEntry(m.id))),
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
          entries: VERB_PAIRS.flatMap((p) => resolve(pairEntry(p))),
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
    case VOCAB_SUBJECT:
      return [];
    // Numbers and counters, cut into the groups the track teaches (see
    // counter-shelf.ts). Rendered as TILES like kana and kanji, not rows: a
    // counter is a glyph (一本, ひとつ) with a reading under it, which is what a
    // tile is for. The whole subject is 87 entries across seven small sections,
    // so every section shows whole — no cap, like radicals.
    case COUNTER_KIND:
      return counterShelfSections();
    // All 214, in canonical Kangxi order, cut by traditional stroke count — the
    // way every radical chart is printed, and a real cut the data carries (each
    // radical knows its strokes). Not one card of 214 (unbrowsable) and not a
    // search box (this IS the whole subject, and 214 is a curriculum, not a
    // dictionary). No cap: a stroke group is a dozen tiles, shown whole.
    case RADICAL_SUBJECT: {
      const byStroke = new Map<number, LibEntry[]>();
      for (const r of RADICALS) {
        const e = libEntry(radicalEntry(r.glyph));
        if (!e) continue;
        const group = byStroke.get(r.strokes) ?? [];
        group.push(e);
        byStroke.set(r.strokes, group);
      }
      return [...byStroke.entries()]
        .sort(([a], [b]) => a - b)
        .map(([strokes, entries]) => ({
          id: `strokes-${strokes}`,
          label: `${strokes} stroke${strokes === 1 ? "" : "s"}`,
          entries,
        }));
    }
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
  keep,
  filter = "all",
}: {
  kind: Kind;
  sections: readonly ShelfSection[];
  /** Every entry on the shelf, for the words case where sections are empty. */
  allEntries: readonly LibEntry[];
  /** The global, cross-kind selection this shelf draws its on-state from. */
  selected: Selection;
  onToggleEntry(id: EntryId, shiftKey: boolean): void;
  onToggleSection(ids: readonly EntryId[]): void;
  facts: Record<EntryId | string, FactAggregate>;
  claims: Claims;
  metric: AccuracyMetric;
  now: number;
  voice: string;
  /** The knowledge filter, as a predicate. Undefined is All — the shelf shows
   * every entry, which is what it did before this existed. Known / Not known
   * pass a test that runs over the SAME `entryStanding` the tiles already use. */
  keep?: (entry: LibEntry) => boolean;
  /** Which filter is active, for the empty-state copy. The predicate above does
   * the work; this only picks the words when it removes everything. */
  filter?: KnowledgeFilter;
}) {
  const tile = (entry: LibEntry) => (
    <EntryTile
      key={entry.id}
      entry={entry}
      voice={voice}
      mnemonic={mnemonicOf(kind, entry)}
      standing={entryStanding(factsOf(entry.id), facts, claims, metric, now)}
      selected={selected.has(entry.id)}
      onToggleSelect={(shift) => onToggleEntry(entry.id, shift)}
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
      onToggleSelect={(shift) => onToggleEntry(entry.id, shift)}
    />
  );

  // A verb pair is neither a glyph nor a phrase but a CONTRAST — two verbs and
  // one event — so it gets its own row, two cells wide, each verb with its own
  // reading, speaker and English cue. Standing runs over knownFactsOf, not every
  // fact: a pair mints a fact per side but only quizzes the askable ones, so the
  // count must ignore the distractor-only side or a fully-learned pair would read
  // "1 of 2" forever (see entries.ts).
  const pairRow = (entry: LibEntry) => {
    const pair = pairForEntry(entry.id);
    if (!pair) return null;
    return (
      <VerbPairRow
        key={entry.id}
        entry={entry}
        pair={pair}
        voice={voice}
        standing={entryStanding(knownFactsOf(entry), facts, claims, metric, now)}
        selected={selected.has(entry.id)}
        onToggleSelect={(shift) => onToggleEntry(entry.id, shift)}
      />
    );
  };

  if (kind === VOCAB_SUBJECT) {
    // `shownWordsOf`, not a local filter: it carries the shelf's teaching order
    // (`beginnerRank`, so "Common everyday words" is true of what you see) and
    // it is the SAME call `visibleShelfIds` makes, so the grid and the range a
    // Shift-click sweeps cannot disagree about which word is where.
    const words = shownWordsOf(allEntries, keep);
    return (
      <Card>
        <Lbl>Everyday words</Lbl>
        {words.length === 0 ? (
          <FilterEmpty filter={filter} />
        ) : (
          <>
            <p className="mb-3">
              <Hint>
                {keep
                  ? `The first ${WORD_TILES} that match. Search to find any of the others.`
                  : `Common everyday words. The first ${WORD_TILES} are here. Search to find any of the others.`}
              </Hint>
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
              {words.slice(0, WORD_TILES).map(tile)}
            </div>
          </>
        )}
      </Card>
    );
  }

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
    kind === TRANSITIVITY_SUBJECT ||
    kind === TERM_SUBJECT;

  // The knowledge filter applied to the cut, then the shelf's section cap. FILTER
  // FIRST, CAP SECOND: each section keeps only the entries that pass and an
  // emptied section drops out (a card headed "1–100" with nothing under it is a
  // worse answer than no card), and only THEN does the kanji shelf take its first
  // KANJI_SECTIONS_SHOWN. Capping before the filter was the bug — "Not known"
  // would run against just the first three sections and call the shelf empty
  // while thousands of unknown kanji waited in section four and on. `filtered`
  // is the whole matching population (for the off-shelf count); `shownSections`
  // is what actually paints. See shelf-view.ts for the shared math.
  const filtered = filterSections(sections, keep);
  const shownSections = filtered.slice(0, sectionCapFor(kind, sections));

  // What the kanji shelf is not showing you. COUNTED, never written down: the
  // matching population minus what the sections above actually hold, so it stays
  // right if KANJI_SECTIONS_SHOWN or KANJI_CHUNK ever moves. It now reflects the
  // FILTER too — under "Not known" it is the unknown kanji past the three shown
  // sections, not the raw shelf — because `filtered` already carries the filter.
  // In `grade` mode the sections cover everything and none is capped, so this is
  // 0 and the line does not appear; that mode says what it holds back per
  // section instead.
  const offShelf =
    kind === KANJI_SUBJECT
      ? filtered.reduce((n, s) => n + s.entries.length, 0) -
        shownSections.reduce((n, s) => n + s.entries.length, 0)
      : 0;

  // Everything on the shelf fell outside the filter. The clusters/Tofugu cards
  // still render above (they are references, not filtered content), but the
  // shelf itself needs to say why it is empty rather than show nothing.
  const shelfEmpty = shownSections.length === 0;

  return (
    <>
      {kind === KANA_SUBJECT ? <TofuguCard /> : null}
      {kind === GRAMMAR_SUBJECT ? <GrammarClustersCard /> : null}
      {shelfEmpty ? (
        <Card>
          <FilterEmpty filter={filter} />
        </Card>
      ) : null}
      {shownSections.map((section) => {
        const ids = section.entries.map((e) => e.id);
        const state = sectionState(selected, ids);
        const onCount = ids.filter((id) => selected.has(id)).length;
        // Display cap for the huge school-grade sections. The toggle and count
        // above use the FULL `ids`; only what renders is sliced.
        const shown = section.entries.slice(0, section.cap ?? Infinity);
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
                  · {onCount} selected{state === "all" ? " (all)" : ""}
                </Hint>
              ) : null}
            </div>
            {asRows ? (
              kind === TRANSITIVITY_SUBJECT ? (
                <div className="flex flex-col">
                  <VerbPairHeader />
                  {shown.map(pairRow)}
                </div>
              ) : (
                <div className="flex flex-col">{shown.map(row)}</div>
              )
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                {shown.map(tile)}
              </div>
            )}
            {hidden > 0 ? (
              <p className="pt-2.5">
                <Hint>
                  ＋ {hidden} more in {section.label}. Search to find any of
                  them.
                </Hint>
              </p>
            ) : null}
          </Card>
        );
      })}
      {offShelf > 0 ? (
        <p className="pt-0.5">
          <Hint>
            ＋ {offShelf.toLocaleString()} more kanji further along your order.
            Search to find any of them.
          </Hint>
        </p>
      ) : null}
    </>
  );
}

/** What the shelf says when the knowledge filter removed everything on it. Only
 * reached with a filter active — All never empties a shelf — so it always names
 * the filter and points at the way out. */
function FilterEmpty({ filter }: { filter: KnowledgeFilter }) {
  return (
    <p className="text-[13px] text-text-muted">
      {filter === "known"
        ? "Nothing on this shelf is marked known yet."
        : "Everything shown on this shelf is already known."}{" "}
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
function GrammarClustersCard() {
  return (
    <Card>
      <Lbl>Patterns that mean the same thing</Lbl>
      <p className="mb-2.5 text-[13px] text-text-muted">
        Some patterns come out as the same English: seven ways to say{" "}
        <b className="font-medium text-text">must</b>, four ways to say{" "}
        <b className="font-medium text-text">if</b>. Each family is laid out side
        by side on a map of its own.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {CLUSTERS.map((c) => (
          <Link
            key={c.id}
            href={`/grammar/${c.id}`}
            className="rounded-full border border-border px-2.5 py-0.5 text-[12.5px] text-text no-underline hover:border-accent hover:text-accent"
          >
            {c.title}
          </Link>
        ))}
      </div>
      <p className="pt-2.5">
        <Link href="/grammar" className="text-[13px] text-accent no-underline">
          All {CLUSTERS.length} side by side →
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
