"use client";

// The tile and the row — the two shapes an entry takes in the Library.
//
// VIEW IS THE DEFAULT CLICK; SELECT IS AN OPT-IN. The homepage promises "look
// up any kana in the Library" — so the plain, unmodified click on a tile or row
// now opens that entry's page, the same destination `entryHref` has always
// pointed selection's ↗ escape hatch at. Building a drill (the multi-select
// that unions entries into one Slice — see lib/library/selection.ts) moved
// behind SELECT MODE, an explicit toggle the caller threads down as
// `selectMode` (see library-page.tsx's "Select multiple" chip): only while it
// is on does a plain click toggle the tile/row into the selection instead of
// navigating. Every entry still answers to the same three verbs —
//
//   VIEW   — open its page. THE DEFAULT, so it is the whole tile body.
//   SELECT — toggle it into the drill. Select-mode-only; same whole-body
//            target, just re-aimed at a different verb while the mode is on.
//   HEAR   — speak it. A small 🔊 corner target, in both modes.
//
// — just with VIEW and SELECT trading which one owns the body, rather than
// SELECT permanently owning it and VIEW being demoted to a small ↗ almost no
// one found (the bug this file used to ship). ViewLink survives as a
// select-mode-only "peek" — open an entry without losing your place mid-build —
// since the body itself already covers the common case once select mode is off.
//
// A REAL <Link>, NOT AN ONCLICK NAVIGATION, EVEN WHILE SELECTABLE. Middle-click
// and cmd-click still open a new tab on the default click, which means the
// click target can't simply BE the tile/row's outer element the way ViewLink
// was a lone `<a>`: the Hear button (and, in select mode, the peek arrow) are
// real interactive elements, and HTML forbids interactive content inside an
// `<a>`. So the outer element stays a plain `<div>` and the navigate case wires
// a STRETCHED LINK instead — an `absolute inset-0` sibling behind the content,
// with any genuinely interactive child lifted `relative z-10` so it still wins
// the click where the two overlap. See ShelfRow and EntryTile below.
//
// BOTH SHAPES TAKE THE SAME THREE. The row (search results) is wider, so it lays
// them out along its length instead of stacking them — but selecting a searched
// 生 feeds the SAME global selection a toggled hiragana row does. Searching and
// shelving are two ways into one drill, not two drills.
//
// NEITHER SHAPE PAINTS THE FULL STANDING MODEL. The shelf is de-boxed — glyphs
// on the mesh, no per-tile solid/shaky/slipping colour-coding or count, and (as
// of SAK-63's second round of feedback) no per-tile "known" mark either — because
// that heat-map-of-your-own-memory was exactly what the design kept throwing
// out. A `known` dot briefly lived here as a single-bit exception; the owner's
// call was "i don't like the dots, let's remove them", so there is no exception
// any more: the shelf stays fully de-boxed and full status lives only on the
// Practice page's filters. The Library knowledge FILTER still decides what
// "known" means (`entryIsKnown`/`standingOf`, via known-mark.ts's
// `isEntryKnownForDisplay`) — see library-page.tsx's `keep` — it just no longer
// also DRAWS it on every tile. The same argument for select mode is why it is a
// page-level toggle rather than an always-on per-tile checkbox (the Sessions
// list's pattern — see results/sessions-list.tsx): a checkbox on every one of a
// 2,136-tile kanji shelf or a 12,553-tile word shelf is exactly the per-tile
// furniture this file already refuses to paint, at a scale Sessions' handful of
// rows never reaches.

import Link from "next/link";

import { HearButton } from "@/components/ui/hear-button";
import { KANA_SUBJECT } from "@/data/characters";
import { KEIGO_SUBJECT } from "@/lib/keigo-ids";
import type { KeigoSet, KeigoWord } from "@/data/keigo";
import { MARK_SUBJECT } from "@/data/marks";
import { TERM_SUBJECT } from "@/data/terms";
import {
  GRAMMAR_CONCEPT_SUBJECT,
  GRAMMAR_SUBJECT,
  SENTENCE_RULE_KIND,
  entryName,
} from "@/lib/library/library-index";
import type { LibEntry } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";
// What goes under the glyph — a .ts module so the "no entry shows a dash while
// it has a reading" property is testable (the runner cannot load JSX).
import { japaneseFontClass } from "@/lib/japanese-text";
import { subLabel } from "@/lib/library/sub-label";
import type { VerbPair } from "@/data/transitivity";

/** Whether an entry has a pronunciation worth a 🔊.
 *
 * A grammar pattern does not — 〜てから is a shape, not a sound. Neither does a
 * MARK, and it is the clearer case of the two: ゛ has no pronunciation whatsoever
 * (it is a diacritic; the sound it makes is the sound of the kana under it), and
 * long vowels has no glyph for a synthesiser to be handed at all. Both omit the
 * speaker rather than render one that reads out a placeholder — or, for a mark,
 * one that reads out silence and looks broken.
 *
 * A TERM is the same case arriving from the other direction. "Kana", "Hiragana",
 * "Romaji" are the English names we use to talk ABOUT Japanese, so a term's glyph
 * is an English string. Handing that to a Japanese synthesiser produced a button
 * that visibly did nothing, which is worse than no button at all. A GRAMMAR
 * CONCEPT is the same: a reference page (what a form is, う-verbs vs る-verbs) with
 * an English title and no single sound to speak, so it gets no speaker either. */
function speakable(entry: LibEntry): boolean {
  return (
    entry.kind !== GRAMMAR_SUBJECT &&
    entry.kind !== GRAMMAR_CONCEPT_SUBJECT &&
    entry.kind !== MARK_SUBJECT &&
    entry.kind !== SENTENCE_RULE_KIND &&
    entry.kind !== TERM_SUBJECT &&
    entry.kind !== KEIGO_SUBJECT
  );
}

/** The small ↗ "peek" target — opens the entry page without leaving select
 * mode. Once select mode is off the tile/row body already does this (see the
 * file header), so this only ever renders while selecting: a way to check an
 * entry's page mid-build without losing the selection you're assembling. A
 * `Link`, so it is a real navigation (middle-click, cmd-click work);
 * `stopPropagation` keeps the click off SELECT. Borderless (no frame, no
 * `bg-card`) to match the de-boxed shelf: it sits on the mesh like the glyph
 * does, revealed on hover by its container. */
function ViewLink({ entry, className }: { entry: LibEntry; className?: string }) {
  return (
    <Link
      href={entryHref(entry.id)}
      onClick={(e) => e.stopPropagation()}
      // `entryName`, not the glyph: the long-vowel mark has no glyph, and this
      // read "Open " — a control a screen reader announces with no name.
      aria-label={`Open ${entryName(entry)}`}
      className={`inline-flex size-5 items-center justify-center cursor-pointer rounded-md p-0 text-[11px] leading-none text-text-muted no-underline hover:text-text ${className ?? ""}`}
    >
      ↗
    </Link>
  );
}

/** The trailing-↗ reveal, shared by every table shelf row. The ↗ opens the
 * entry; it appears on ROW hover or the arrow's OWN keyboard focus — NEVER on the
 * row's select-focus (clicking to select focuses the row, and `group-focus-within`
 * left the ↗ stuck on the last-selected row). Appended to `ViewLink`'s className. */
export const ROW_ARROW_REVEAL =
  "flex-none opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100";

/** THE one row shell every table shelf wears — grammar, marks, sentence rules,
 * terms, grammar concepts, search results, keigo and verb pairs. It carries the
 * shared behaviour and LOOK: NO visible checkbox, selection and hover both
 * painted as the accent wash (`bg-accent-bg`), a hairline between rows, and
 * `group` so the trailing ↗ can reveal on hover. Each shelf passes its own
 * column layout + horizontal padding via `className` and its own cells as
 * children, so one shell fits the simple lead+gloss rows AND the multi-column
 * keigo / verb-pair rows.
 *
 * THREE MODES, not two:
 *   - `onToggleSelect` + `selectMode` — the row IS the select target
 *     (role=button, Enter/Space, aria-pressed), same as before select mode
 *     existed.
 *   - `onToggleSelect` alone (select mode off) — the row still carries a
 *     select action for when the learner turns select mode back on, but a
 *     plain click OPENS `href` instead. See the file header for why this is a
 *     stretched Link rather than the row itself being the anchor.
 *   - neither `onToggleSelect` nor select mode ever applies — a plain link row
 *     (the map-only grammar clusters), same hover, no select, mode-independent.
 */
export function ShelfRow({
  selected = false,
  onToggleSelect,
  selectMode = false,
  href,
  /** Accessible name for the whole-row Link used when the row opens the entry
   * (select mode off, or no `onToggleSelect` at all). Callers that know the
   * entry's name pass `Open ${entryName(entry)}`, matching what ViewLink used
   * to announce for the same destination. */
  openLabel,
  className = "",
  children,
}: {
  selected?: boolean;
  onToggleSelect?: (shiftKey: boolean) => void;
  /** Whether a plain click currently toggles selection (true) or opens the
   * entry (false, the default). Ignored without `onToggleSelect` — a link-only
   * row always opens, mode or not. */
  selectMode?: boolean;
  /** The entry's page — the navigate destination whenever the row isn't acting
   * as a select target (link-only mode, or `onToggleSelect` with select mode
   * off). */
  href?: string;
  openLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const shell = `group cursor-pointer select-none border-b border-white/[0.06] text-text transition-colors last:border-b-0 ${className}`;
  if (onToggleSelect && selectMode) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={(e) => onToggleSelect(e.shiftKey)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleSelect(e.shiftKey);
          }
        }}
        className={`${shell} ${selected ? "bg-accent-bg" : "hover:bg-accent-bg"}`}
      >
        {children}
      </div>
    );
  }
  if (onToggleSelect) {
    // SELECT MODE OFF: still selectable in principle (the learner can turn
    // select mode back on), but the default click OPENS the entry. The Link
    // is a STRETCHED LINK behind the row's own content rather than the row's
    // outer element — see the file header's note on why an `<a>` can't wrap
    // the row's real interactive children directly.
    return (
      <div
        className={`${shell} relative ${selected ? "bg-accent-bg" : "hover:bg-accent-bg"}`}
      >
        <Link href={href ?? "#"} aria-label={openLabel ?? "Open"} className="absolute inset-0" />
        {children}
      </div>
    );
  }
  return (
    <Link href={href ?? "#"} className={`${shell} no-underline hover:bg-accent-bg`}>
      {children}
    </Link>
  );
}

export function EntryTile({
  entry,
  voice,
  selected,
  selectMode,
  onToggleSelect,
}: {
  entry: LibEntry;
  voice: string;
  selected: boolean;
  /** Whether a plain click currently toggles selection (true) or opens the
   * entry page (false, the default — see the file header). */
  selectMode: boolean;
  onToggleSelect(shiftKey: boolean): void;
}) {
  // BORDERLESS — no outline, no `bg-card` fill: glyph + reading sit straight on
  // the mesh. The whole cell is the click target (SELECT while selecting, VIEW
  // otherwise), signalled by a FLAT hover tint (never a shadow — a shelf is
  // thousands of tiles and any blurred shadow on scrolling content reintroduces
  // jank) and an accent wash + accent glyph when selected. `cursor-pointer` +
  // `select-none` because the whole body is the target either way.
  const className = `group relative flex aspect-square flex-col justify-center rounded-[10px] px-1 text-center [container-type:inline-size] cursor-pointer select-none transition-colors ${
    selected ? "bg-accent-bg" : "hover:bg-white/[0.04]"
  }`;
  // Full label on hover for the meaning-bearing kinds (words, kanji…) whose
  // sub-line truncates; kana show only their romaji, which never truncates, so
  // they get no tooltip (that speaker-hint text was removed on purpose).
  const title = entry.kind === KANA_SUBJECT ? undefined : subLabel(entry);

  const body = (
    <>
      {/* Same rule as the entry page's headword slot: the theme's Japanese face
          when there is Japanese in the cell, the UI face for a Terms tile, whose
          "glyph" is an English name. */}
      {/* SHRINK-TO-FIT, like the Learn tiles. The tile is an inline-size
          container (see the wrapper), and the glyph is sized in cqi against it:
          90cqi split across the code-point count, floored at a readable 12px and
          capped at the 26px a short glyph (新聞, 南) wants. `nowrap` forbids the
          two-line spill a long word (アパート, おまわりさん) used to make — it
          shrinks to one line instead of wrapping past the border. */}
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
      {/* ONE bottom slot for BOTH the romaji and the hover actions, not two
          stacked rows. At rest it shows the reading; on hover/focus the reading
          fades out and the 🔊(/↗ while selecting) fade in over the same line.
          Sharing the slot keeps the tile compact — no empty reserved action row
          under every glyph — and, because the slot is a fixed height, hovering
          never reflows the grid. */}
      <div className="relative mt-1 flex h-[13px] items-center justify-center">
        <span className="min-w-0 max-w-full truncate text-xs text-text-muted transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0">
          {subLabel(entry)}
        </span>
        {/* Revealed on hover, or on the tile's OWN keyboard focus-visible — never
            on plain focus, which mouse-clicking to SELECT also leaves behind
            (see ROW_ARROW_REVEAL's note on the same bug for a shelf row).
            `relative z-10` lifts these above the stretched Link the non-select
            branch below wires behind the whole tile (see the file header) —
            harmless in select mode, where there is no such Link to out-stack. */}
        <span className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {speakable(entry) ? (
            <HearButton
              glyph={entry.glyph}
              voiceName={voice}
              stopPropagation
              label={`Hear ${entryName(entry)}`}
              className="relative z-10"
            />
          ) : null}
          {selectMode ? <ViewLink entry={entry} className="relative z-10" /> : null}
        </span>
      </div>
    </>
  );

  if (selectMode) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={(e) => onToggleSelect(e.shiftKey)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleSelect(e.shiftKey);
          }
        }}
        className={className}
        title={title}
      >
        {body}
      </div>
    );
  }

  // DEFAULT: the whole tile opens the entry — a real `Link` so middle-click and
  // cmd-click still open a new tab, wired as a STRETCHED LINK (`absolute
  // inset-0`) behind the tile's own content rather than as the tile's outer
  // element, because the Hear button inside is a real `<button>` and HTML
  // forbids interactive content inside an `<a>` (see the file header).
  return (
    <div className={className} title={title}>
      <Link
        href={entryHref(entry.id)}
        aria-label={`Open ${entryName(entry)}`}
        className="absolute inset-0 rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      {body}
    </div>
  );
}

/** The search-result shape: glyph, what it is, how it's going — and the same
 * three actions the tile has, laid along the row instead of stacked.
 *
 * THE ROW OPENS BY DEFAULT, SELECTS IN SELECT MODE. Off select mode a plain
 * click opens the entry (ShelfRow wires it as a stretched Link behind the row's
 * content); while selecting, the whole row body is the select target and ↗
 * becomes a "peek" — see the file header. */
export function EntryRow({
  entry,
  note,
  voice,
  selected,
  selectMode,
  grid = false,
  onToggleSelect,
}: {
  entry: LibEntry;
  /** Why this row is here, when the section header doesn't already say it. */
  note?: string;
  voice: string;
  selected: boolean;
  /** Whether a plain click currently toggles selection (true) or opens the
   * entry (false, the default — see the file header). */
  selectMode: boolean;
  /** Lay the row out as a `grid-cols-subgrid` band of a shared parent grid,
   * instead of a self-contained flex row. The grammar shelf turns this on so
   * every pattern column sizes to the WIDEST pattern and the explanations align
   * across rows (see shelves.tsx). Off everywhere else — the flat search list and
   * the mark/term shelves keep the independent flex row. */
  grid?: boolean;
  onToggleSelect(shiftKey: boolean): void;
}) {
  const inlineMarkGlyph = entry.kind === MARK_SUBJECT ? entry.glyph : "";
  // A keigo set has no glyph, so leading with its meanings printed an
  // English-only row — and the single-word sets, which happen to carry one
  // reading, looked different again ("くださる · give…"). A keigo set IS its
  // Japanese words, so every keigo row leads with them — the forms joined
  // (召し上がる / いただく), the same shape the single-word ones show — with the
  // "Keigo · <meaning>" sub-line (passed as `note`) beneath. `entryName` is the
  // words for a keigo set (its glyph is empty), never the empty string.
  const leadName = entry.kind === KEIGO_SUBJECT ? entryName(entry) : "";
  const rowTitle =
    entry.meanings.slice(0, 3).join(", ") || entry.sub;
  const markTitle =
    inlineMarkGlyph === "っ"
      ? "Small tsu"
      : inlineMarkGlyph === "ゃゅょ"
        ? "Small ya / yu / yo"
        : inlineMarkGlyph
          ? [...inlineMarkGlyph]
              .reduce((title, glyph) => title.replaceAll(glyph, ""), rowTitle)
              .replace(/\s+/g, " ")
              .trim()
          : rowTitle;

  return (
    <ShelfRow
      selected={selected}
      onToggleSelect={onToggleSelect}
      selectMode={selectMode}
      href={entryHref(entry.id)}
      openLabel={`Open ${entryName(entry)}`}
      // A subgrid band (grammar shelf) inherits the parent grid's shared tracks
      // and column gap; the default row is a self-contained flex line with its
      // own gap and horizontal padding so its text and ↗ sit inset from the
      // accent wash's edges rather than flush against them.
      className={`items-center py-2 ${
        grid ? "col-span-full grid grid-cols-subgrid" : "flex gap-3 px-3"
      }`}
    >
      {/* NO visible checkbox — the whole row is the select target and its accent
          wash IS the selected state. */}
      {/* Reserve a glyph column only when there is a glyph to show. Sentence
          rules, keigo sets and terms are named concepts, so an empty 64px cell
          only pushes their useful text away from the row's leading edge. */}
      {entry.glyph && !inlineMarkGlyph ? (
        <span
          // A grammar pattern is a PHRASE, not a character — 〜てください,
          // 〜てはいけない, 〜なければならない — so a fixed 64px cell truncated
          // every one of them to "〜て…" and made "please do X", "must not do X"
          // and "after X" indistinguishable. On the grammar shelf the row is a
          // subgrid band and this cell lands on a shared `max-content` track, so
          // `whitespace-nowrap` (no width, no truncate) lets it take exactly the
          // width the WIDEST pattern needs and keeps every pattern on one line.
          // Off the grid (grammar in the flat search list) it falls back to a
          // fixed 150px. Every other kind sizes to its glyph up to a 120px cap
          // (`flex-none` with no set width, so the basis is the content): a
          // one/two-character kanji stays tidy, and a 3-4 kana word (しとしと, 使徒)
          // gets the room the old fixed 64px cell clipped to "しと…". The meaning
          // column keeps `min-w-0 flex-1`, so on a narrow row IT truncates and the
          // glyph wins the space; only a glyph past the 120px cap truncates.
          className={`${
            entry.kind === GRAMMAR_SUBJECT
              ? grid
                ? "min-w-0 truncate whitespace-nowrap pr-2"
                : "w-[150px] flex-none pr-2"
              : "max-w-[120px] flex-none truncate"
          } text-[19px] ${japaneseFontClass(entry.glyph)}`}
        >
          {entry.glyph}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">
          {/* A keigo set leads with its Japanese keigo word(s), not its English
              meanings — see leadName above. Its meaning rides the sub-line. */}
          {leadName ? (
            <span className={japaneseFontClass(leadName)}>{leadName}</span>
          ) : (
            <>
          {/* ONE reading, and only when there is only one. 先生 gets せんせい.
              生 gets its meaning, because "生 is read せい" is false — it has nine
              readings and this row would be picking one and presenting it as the
              answer, the "生: 61%" mistake in prose. */}
          {entry.readings.length === 1 ? (
            <span className="text-text-muted">{entry.readings[0]} · </span>
          ) : null}
          {markTitle}
          {inlineMarkGlyph ? (
            <>
              {" ("}
              <span className={japaneseFontClass(inlineMarkGlyph)}>
                {[...inlineMarkGlyph].join(" ")}
              </span>
              {")"}
            </>
          ) : null}
            </>
          )}
        </span>
        {note ? (
          <span className="block truncate text-xs text-text-muted">{note}</span>
        ) : null}
      </span>
      {speakable(entry) ? (
        <HearButton
          glyph={entry.glyph}
          voiceName={voice}
          stopPropagation
          label={`Hear ${entryName(entry)}`}
          className="relative z-10 flex-none"
        />
      ) : null}
      {selectMode ? (
        <ViewLink entry={entry} className={`relative z-10 ${ROW_ARROW_REVEAL}`} />
      ) : null}
    </ShelfRow>
  );
}

/** One register column in a keigo set row: all words in that register with a
 * speaker for the first, their readings, and the set meaning (honorific column). */
function KeigoCell({
  words,
  meaning,
  voice,
}: {
  words: readonly KeigoWord[];
  meaning?: string;
  voice: string;
}) {
  if (!words.length) return <div className="min-w-0" />;
  // Single-word cell: show word.use as contextual note (e.g. "more deferential", "for a fact").
  const note = words.length === 1 ? (words[0].use ?? meaning) : meaning;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="truncate font-kana text-[17px]">
          {words.map((w) => w.word).join(" / ")}
        </span>
        <HearButton
          glyph={words[0].word}
          voiceName={voice}
          stopPropagation
          className="relative z-10 flex-none"
        />
      </div>
      <span className="mt-0.5 block truncate text-xs text-text-muted">
        {words.map((w) => w.reading).join(" / ")}
        {note ? ` · ${note}` : ""}
      </span>
    </div>
  );
}

export function KeigoSetHeader() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_28px] items-center gap-3 border-b border-white/[0.06] px-3 pb-1.5 pt-1">
      <span className="truncate text-[11px] uppercase tracking-wide text-text-muted">
        Honorific · for what they do
      </span>
      <span className="truncate text-[11px] uppercase tracking-wide text-text-muted">
        Humble · for what you do
      </span>
      <span className="truncate text-[11px] uppercase tracking-wide text-text-muted">
        Humble · variant
      </span>
      <span aria-hidden />
    </div>
  );
}

export function KeigoSetRow({
  entry,
  set,
  voice,
  selected,
  selectMode,
  onToggleSelect,
}: {
  entry: LibEntry;
  set: KeigoSet;
  voice: string;
  selected: boolean;
  /** Whether a plain click currently toggles selection (true) or opens the
   * entry (false, the default — see the file header). */
  selectMode: boolean;
  onToggleSelect(shiftKey: boolean): void;
}) {
  const honorific = set.words.filter((w) => w.register === "honorific");
  const humble = set.words.filter((w) => w.register === "humble");
  return (
    <ShelfRow
      selected={selected}
      onToggleSelect={onToggleSelect}
      selectMode={selectMode}
      href={entryHref(entry.id)}
      openLabel={`Open ${entryName(entry)}`}
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_28px] items-center gap-3 px-3 py-2"
    >
      <KeigoCell words={honorific} meaning={set.meaning} voice={voice} />
      <KeigoCell words={humble.slice(0, 1)} voice={voice} />
      <KeigoCell words={humble.slice(1, 2)} voice={voice} />
      {selectMode ? (
        <ViewLink entry={entry} className={`relative z-10 ${ROW_ARROW_REVEAL}`} />
      ) : null}
    </ShelfRow>
  );
}

/** One verb of a pair, as a shelf cell: the word, its reading, its own speaker,
 * and the English cue that points to THIS verb rather than its partner — the one
 * thing that tells the two apart. */
function PairCell({
  side,
  voice,
  tail,
}: {
  side: VerbPair["happens"];
  voice: string;
  tail?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="truncate font-kana text-[17px]">{side.word}</span>
        <span className="truncate text-xs text-text-muted">{side.reading}</span>
        {tail ? <span className="truncate text-xs text-text-muted">· {tail}</span> : null}
        <HearButton
          glyph={side.word}
          voiceName={voice}
          stopPropagation
          className="relative z-10 flex-none"
        />
      </div>
      <span className="mt-0.5 block truncate text-xs text-text-muted">{side.en}</span>
    </div>
  );
}

/** The column headings for the verb-pairs shelf, once above the rows so the two
 * cells of every row read as the two sides of one contrast instead of two
 * verbs in a list. Same column tracks and horizontal padding as the row (see
 * VerbPairRow's ShelfRow) so the headings sit over the columns they name. */
export function VerbPairHeader() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px] items-center gap-3 border-b border-white/[0.06] px-3 pb-1.5 pt-1">
      <span className="truncate text-[11px] uppercase tracking-wide text-text-muted">
        It happens on its own
      </span>
      <span className="truncate text-[11px] uppercase tracking-wide text-text-muted">
        Someone does it
      </span>
      <span aria-hidden />
    </div>
  );
}

/** A verb pair on a shelf: the two verbs side by side, each with its own reading,
 * speaker and English cue, so the row shows the whole contrast a pair IS. Not
 * EntryRow: that row is built around a single glyph in a fixed cell, and a pair
 * has no glyph and two things to say, which left its checkbox stranded a cell
 * away from any content and only one of its two verbs a speaker. The row body
 * is VIEW by default and SELECT in select mode (see ShelfRow); the two HEAR
 * targets swallow their own clicks either way. */
export function VerbPairRow({
  entry,
  pair,
  voice,
  selected,
  selectMode,
  onToggleSelect,
}: {
  entry: LibEntry;
  pair: VerbPair;
  voice: string;
  selected: boolean;
  /** Whether a plain click currently toggles selection (true) or opens the
   * entry (false, the default — see the file header). */
  selectMode: boolean;
  onToggleSelect(shiftKey: boolean): void;
}) {
  return (
    <ShelfRow
      selected={selected}
      onToggleSelect={onToggleSelect}
      selectMode={selectMode}
      href={entryHref(entry.id)}
      openLabel={`Open ${entryName(entry)}`}
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px] items-center gap-3 px-3 py-2"
    >
      <PairCell side={pair.happens} voice={voice} />
      <PairCell side={pair.doIt} voice={voice} />
      {selectMode ? (
        <ViewLink entry={entry} className={`relative z-10 ${ROW_ARROW_REVEAL}`} />
      ) : null}
    </ShelfRow>
  );
}
