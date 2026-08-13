"use client";

// The tile and the row — the two shapes an entry takes in the Library.
//
// THREE ACTIONS, ONE TILE. The Library stopped being a place you only look
// things up: you BUILD a drill here by toggling entries on. So every entry now
// answers to three verbs that must not step on each other:
//
//   SELECT — toggle it into the drill. THE PRIMARY ACTION, so it is the whole
//            tile body (glyph + reading): the big, obvious target.
//   VIEW  — open its page. A small ↗ corner target.
//   HEAR  — speak it. A small 🔊 corner target.
//
// The two small targets `stopPropagation`, so hitting one never also toggles
// select. This is the successor to the old split the header here used to defend
// ("making the whole tile a link would have deleted the speaker"): the reason
// two targets could not collapse into one is exactly why there are now three
// distinct ones and not a tile that does two things on one click.
//
// BOTH SHAPES TAKE THE SAME THREE. The row (search results) is wider, so it lays
// them out along its length instead of stacking them — but selecting a searched
// 生 feeds the SAME global selection a toggled hiragana row does. Searching and
// shelving are two ways into one drill, not two drills.
//
// NEITHER SHAPE PAINTS STANDING. The shelf is de-boxed — glyphs on the mesh, no
// per-tile status colour or count — because standing on thousands of scrolling
// tiles was a heat-map of your own memory the design keeps throwing out. Status
// now lives only on the Practice page's filters; the Library knowledge FILTER
// still selects by standing under the hood, it just no longer shows on the tile.

import Link from "next/link";

import { HearButton } from "@/components/lesson/hear-button";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { GRAMMAR_CONCEPT_SUBJECT } from "@/data/grammar-concepts";
import { KEIGO_SUBJECT, type KeigoSet, type KeigoWord } from "@/data/keigo";
import { MARK_SUBJECT } from "@/data/marks";
import { TERM_SUBJECT } from "@/data/terms";
import {
  SENTENCE_RULE_KIND,
  entryName,
  type LibEntry,
} from "@/lib/library/entries";
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

/** The small ↗ target — opens the entry page. A `Link`, so it is a real
 * navigation (middle-click, cmd-click work); `stopPropagation` keeps the click
 * off SELECT. Borderless (no frame, no `bg-card`) to match the de-boxed shelf:
 * it sits on the mesh like the glyph does, revealed on hover by its container. */
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

export function EntryTile({
  entry,
  mnemonic,
  voice,
  selected,
  onToggleSelect,
}: {
  entry: LibEntry;
  mnemonic?: string;
  voice: string;
  selected: boolean;
  onToggleSelect(shiftKey: boolean): void;
}) {
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
      // BORDERLESS — no outline, no `bg-card` fill: glyph + reading sit straight
      // on the mesh. The whole cell is the SELECT target, signalled by a FLAT
      // hover tint (never a shadow — a shelf is thousands of tiles and any
      // blurred shadow on scrolling content reintroduces jank) and an accent
      // wash + accent glyph when on. `cursor-pointer` + `select-none` because the
      // whole body is the toggle.
      className={`group relative cursor-pointer select-none rounded-[10px] px-1.5 pb-1 pt-1.5 text-center [container-type:inline-size] transition-colors ${
        selected ? "bg-accent-bg" : "hover:bg-white/[0.04]"
      }`}
      title={mnemonic}
    >
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
          fades out and the 🔊/↗ fade in over the same line. Sharing the slot keeps
          the tile compact — no empty reserved action row under every glyph — and,
          because the slot is a fixed height, hovering never reflows the grid. */}
      <div className="relative mt-0.5 flex h-[18px] items-center justify-center">
        <span className="truncate text-xs text-text-muted transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
          {subLabel(entry)}
        </span>
        <span className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {speakable(entry) ? (
            <HearButton
              glyph={entry.glyph}
              voiceName={voice}
              stopPropagation
              label={`Hear ${entryName(entry)}`}
            />
          ) : null}
          <ViewLink entry={entry} />
        </span>
      </div>
    </div>
  );
}

/** The search-result shape: glyph, what it is, how it's going — and the same
 * three actions the tile has, laid along the row instead of stacked.
 *
 * THE ROW IS NO LONGER A LINK. It used to be one big `<Link>`, but SELECT is now
 * the primary verb and it wants the row body; VIEW moved to its own ↗ target at
 * the end. That is the honest layout call for a dense row — one whole-row click
 * cannot mean both "select" and "open", so the frequent action (select, which
 * you do to many results) gets the body and the occasional one (open one to
 * study it) gets an explicit target. */
export function EntryRow({
  entry,
  note,
  voice,
  selected,
  grid = false,
  onToggleSelect,
}: {
  entry: LibEntry;
  /** Why this row is here, when the section header doesn't already say it. */
  note?: string;
  voice: string;
  selected: boolean;
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
      className={`group cursor-pointer select-none items-center border-b border-white/[0.06] py-2 text-text transition-colors last:border-b-0 ${
        // A subgrid band (grammar shelf) inherits the parent grid's shared tracks
        // and column gap; the default row is a self-contained flex line with its
        // own gap and edge padding.
        grid
          ? "col-span-full grid grid-cols-subgrid"
          : "flex gap-3 px-1"
      } ${selected ? "bg-accent-bg" : "hover:bg-white/[0.04]"}`}
    >
      {/* The select box — leading, checkbox-shaped, so the row reads as a thing
          you tick. Hover/selected reveal, so at rest the row is just its text;
          filled accent when on. */}
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
      {/* Reserve a glyph column only when there is a glyph to show. Sentence
          rules, keigo sets and terms are named concepts, so an empty 64px cell
          only pushes their useful text away from the checkbox. */}
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
          className="flex-none"
        />
      ) : null}
      <ViewLink
        entry={entry}
        className="flex-none opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      />
    </div>
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
          className="flex-none"
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
    <div className="grid grid-cols-[16px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_28px] items-center gap-3 border-b border-white/[0.06] px-1 pb-1.5 pt-1">
      <span className="h-4 w-4 flex-none" aria-hidden />
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
  onToggleSelect,
}: {
  entry: LibEntry;
  set: KeigoSet;
  voice: string;
  selected: boolean;
  onToggleSelect(shiftKey: boolean): void;
}) {
  const honorific = set.words.filter((w) => w.register === "honorific");
  const humble = set.words.filter((w) => w.register === "humble");
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
      className={`group grid grid-cols-[16px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_28px] cursor-pointer select-none items-center gap-3 border-b border-white/[0.06] px-1 py-2 text-text transition-colors last:border-b-0 ${
        selected ? "bg-accent-bg" : "hover:bg-white/[0.04]"
      }`}
    >
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
      <KeigoCell words={honorific} meaning={set.meaning} voice={voice} />
      <KeigoCell words={humble.slice(0, 1)} voice={voice} />
      <KeigoCell words={humble.slice(1, 2)} voice={voice} />
      <ViewLink entry={entry} className="flex-none" />
    </div>
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
          className="flex-none"
        />
      </div>
      <span className="mt-0.5 block truncate text-xs text-text-muted">{side.en}</span>
    </div>
  );
}

/** The column headings for the verb-pairs shelf, once above the rows so the two
 * cells of every row read as the two sides of one contrast instead of two
 * verbs in a list. The leading spacer matches the row's checkbox + gap so the
 * headings sit over the columns they name. */
export function VerbPairHeader() {
  return (
    <div className="grid grid-cols-[16px_minmax(0,1fr)_minmax(0,1fr)_28px] items-center gap-3 border-b border-white/[0.06] px-1 pb-1.5 pt-1">
      <span className="h-4 w-4 flex-none" aria-hidden />
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
 * away from any content and only one of its two verbs a speaker. SELECT is still
 * the row body; VIEW and the two HEAR targets swallow their own clicks. */
export function VerbPairRow({
  entry,
  pair,
  voice,
  selected,
  onToggleSelect,
}: {
  entry: LibEntry;
  pair: VerbPair;
  voice: string;
  selected: boolean;
  onToggleSelect(shiftKey: boolean): void;
}) {
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
      className={`group grid grid-cols-[16px_minmax(0,1fr)_minmax(0,1fr)_28px] cursor-pointer select-none items-center gap-3 border-b border-white/[0.06] px-1 py-2 text-text transition-colors last:border-b-0 ${
        selected ? "bg-accent-bg" : "hover:bg-white/[0.04]"
      }`}
    >
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
      <PairCell side={pair.happens} voice={voice} />
      <PairCell side={pair.doIt} voice={voice} />
      <ViewLink entry={entry} className="flex-none" />
    </div>
  );
}
