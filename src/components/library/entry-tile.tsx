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
// BOTH SHAPES TAKE AN `EntryStanding`, NOT A `Standing`. A kanji has no adjective
// (see standing.ts — an entry's standing is a refusal, not an average), so these
// components say a COUNT: "4 of 9". Not a fallback for a missing chip — a better
// sentence, and the only one that is true.

import Link from "next/link";

import { HearButton } from "@/components/lesson/hear-button";
import { StandingChip } from "@/components/library/standing-chip";
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
import type { EntryStanding } from "@/lib/library/standing";
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

/** The border a tile wears when it is NOT selected, so a shelf reads at a glance
 * without every tile carrying a chip. Border only — a filled tile at this
 * density is a heat-map of your own memory, which the design keeps throwing out.
 *
 * A multi-fact entry gets the neutral border: there is no colour for "four of
 * nine", and inventing a fourth tone to mean "mixed" would be the average again
 * in a costume. */
function toneClass(s: EntryStanding): string {
  // Solid, no alpha: a half-transparent border over kiri's frosted frame is a
  // partial-alpha edge that re-blends every scroll frame (the exact cost the
  // frame design removes everywhere else). The hue still reads the standing; it
  // just no longer bleeds the frost through its own outline.
  switch (s.standing) {
    case "solid":
      return "border-success";
    case "getting-there":
    case "slipping":
      return "border-warning";
    case "shaky":
      return "border-danger";
    default:
      return "border-border";
  }
}

function neutralToneClass(): string {
  return "border-border";
}

/** The small ↗ target — opens the entry page. A `Link`, so it is a real
 * navigation (middle-click, cmd-click work); `stopPropagation` keeps the click
 * off SELECT. */
function ViewLink({ entry, className }: { entry: LibEntry; className?: string }) {
  return (
    <Link
      href={entryHref(entry.id)}
      onClick={(e) => e.stopPropagation()}
      // `entryName`, not the glyph: the long-vowel mark has no glyph, and this
      // read "Open " — a control a screen reader announces with no name.
      aria-label={`Open ${entryName(entry)}`}
      className={`inline-flex size-5 items-center justify-center cursor-pointer rounded-md border border-border bg-card p-0 text-[11px] leading-none text-text-muted no-underline hover:bg-panel hover:text-text ${className ?? ""}`}
    >
      ↗
    </Link>
  );
}

export function EntryTile({
  entry,
  standing,
  mnemonic,
  voice,
  selected,
  showStatus = true,
  onToggleSelect,
}: {
  entry: LibEntry;
  standing: EntryStanding;
  mnemonic?: string;
  voice: string;
  selected: boolean;
  showStatus?: boolean;
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
      // Selected owns BOTH border and fill so it beats the tone border and is
      // unmissable; unselected keeps the standing tone. `cursor-pointer` +
      // `select-none` because the whole body is the toggle.
      className={`relative cursor-pointer select-none rounded-[10px] border px-1.5 pb-2 pt-2.5 text-center [container-type:inline-size] ${
        selected
          ? "border-accent bg-accent-bg"
          : `bg-card ${showStatus ? toneClass(standing) : neutralToneClass()}`
      }`}
      title={mnemonic}
    >
      {/* The check corner — the second, redundant signal that this is on, for
          the density where a border alone is easy to miss. */}
      <span
        className={`absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none ${
          selected ? "bg-accent text-bg" : "border border-border text-transparent"
        }`}
        aria-hidden
      >
        ✓
      </span>
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
        className={`select-none whitespace-nowrap leading-[1.25] text-text ${japaneseFontClass(
          entry.glyph,
        )}`}
        style={{
          ["--chars" as string]: [...entry.glyph].length,
          fontSize: "clamp(12px, calc(90cqi / var(--chars)), 26px)",
        }}
      >
        {entry.glyph}
      </div>
      <div className="truncate text-xs text-text-muted">{subLabel(entry)}</div>
      <div className="mt-1.5 flex items-center justify-center gap-1.5">
        {speakable(entry) ? (
          <HearButton
            glyph={entry.glyph}
            voiceName={voice}
            stopPropagation
            label={`Hear ${entryName(entry)}`}
          />
        ) : null}
        <ViewLink entry={entry} />
      </div>
    </div>
  );
}

/** How an entry's standing reads when it has no adjective. */
export function StandingCell({ standing }: { standing: EntryStanding }) {
  // NOTHING TO KNOW, NOTHING TO SAY. Every branch below is a claim about your
  // memory, and with no facts they all reduce to the last one — which rendered
  // "all 0 solid" on all five marks: the app reporting a clean sweep of an entry
  // it has never asked you about and never will. An entry with no facts has no
  // standing, so this says nothing at all, matching the entry page's header and
  // the slice bar, which stays silent on an empty slice too.
  if (standing.total === 0) return null;
  if (standing.standing) return <StandingChip standing={standing.standing} />;
  const unseen = standing.total - standing.seen;
  const activeNeedWork = standing.needWork - unseen;
  if (activeNeedWork > 0 && unseen > 0) {
    return (
      <span className="whitespace-nowrap text-xs text-text-muted">
        <b className="font-medium text-warning">{activeNeedWork}</b> need work ·{" "}
        not seen
      </span>
    );
  }
  if (unseen > 0) {
    return <StandingChip standing="not-seen" />;
  }
  if (standing.needWork === 0) {
    return <span className="text-xs text-text-muted">all {standing.total} solid</span>;
  }
  return (
    <span className="whitespace-nowrap text-xs text-text-muted">
      <b className="font-medium text-warning">{standing.needWork}</b> of{" "}
      {standing.total} need work
    </span>
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
  standing,
  note,
  voice,
  selected,
  grid = false,
  showStatus = true,
  onToggleSelect,
}: {
  entry: LibEntry;
  standing: EntryStanding;
  /** Why this row is here, when the section header doesn't already say it. */
  note?: string;
  voice: string;
  selected: boolean;
  showStatus?: boolean;
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
      className={`cursor-pointer select-none items-center border-b border-border py-2 text-text last:border-b-0 ${
        // A subgrid band (grammar shelf) inherits the parent grid's shared tracks
        // and column gap; the default row is a self-contained flex line with its
        // own gap and edge padding.
        grid
          ? "col-span-full grid grid-cols-subgrid"
          : "flex gap-3 px-1"
      } ${selected ? "bg-accent-bg" : "hover:bg-panel"}`}
    >
      {/* The select box — leading, checkbox-shaped, so the row reads as a thing
          you tick. Filled accent when on. */}
      <span
        className={`flex h-4 w-4 flex-none items-center justify-center rounded text-[10px] leading-none ${
          selected ? "bg-accent text-bg" : "border border-border text-transparent"
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
      <ViewLink entry={entry} className="flex-none" />
      {showStatus ? (
        <span className="flex-none max-[600px]:hidden">
          <StandingCell standing={standing} />
        </span>
      ) : null}
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
        {meaning ? ` · ${meaning}` : ""}
      </span>
    </div>
  );
}

export function KeigoSetHeader() {
  return (
    <div className="grid grid-cols-[16px_minmax(0,1fr)_minmax(0,1fr)_28px_90px] items-center gap-3 border-b border-border px-1 pb-1.5 pt-1 max-[600px]:grid-cols-[16px_minmax(0,1fr)_minmax(0,1fr)_28px]">
      <span className="h-4 w-4 flex-none" aria-hidden />
      <span className="truncate text-[11px] uppercase tracking-wide text-text-muted">
        Honorific · for what they do
      </span>
      <span className="truncate text-[11px] uppercase tracking-wide text-text-muted">
        Humble · for what you do
      </span>
      <span aria-hidden />
      <span className="max-[600px]:hidden" aria-hidden />
    </div>
  );
}

export function KeigoSetRow({
  entry,
  set,
  standing,
  voice,
  selected,
  showStatus = true,
  onToggleSelect,
}: {
  entry: LibEntry;
  set: KeigoSet;
  standing: EntryStanding;
  voice: string;
  selected: boolean;
  showStatus?: boolean;
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
      className={`grid grid-cols-[16px_minmax(0,1fr)_minmax(0,1fr)_28px_90px] cursor-pointer select-none items-center gap-3 border-b border-border px-1 py-2 text-text last:border-b-0 max-[600px]:grid-cols-[16px_minmax(0,1fr)_minmax(0,1fr)_28px] ${
        selected ? "bg-accent-bg" : "hover:bg-panel"
      }`}
    >
      <span
        className={`flex h-4 w-4 flex-none items-center justify-center rounded text-[10px] leading-none ${
          selected ? "bg-accent text-bg" : "border border-border text-transparent"
        }`}
        aria-hidden
      >
        ✓
      </span>
      <KeigoCell words={honorific} meaning={set.meaning} voice={voice} />
      <KeigoCell words={humble} voice={voice} />
      <ViewLink entry={entry} className="flex-none" />
      {showStatus ? (
        <span className="flex-none max-[600px]:hidden">
          <StandingCell standing={standing} />
        </span>
      ) : null}
    </div>
  );
}
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
    <div className="grid grid-cols-[16px_minmax(0,1fr)_minmax(0,1fr)_28px_90px] items-center gap-3 border-b border-border px-1 pb-1.5 pt-1">
      <span className="h-4 w-4 flex-none" aria-hidden />
      <span className="truncate text-[11px] uppercase tracking-wide text-text-muted">
        It happens on its own
      </span>
      <span className="truncate text-[11px] uppercase tracking-wide text-text-muted">
        Someone does it
      </span>
      <span aria-hidden />
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
  standing,
  voice,
  selected,
  showStatus = true,
  onToggleSelect,
}: {
  entry: LibEntry;
  pair: VerbPair;
  standing: EntryStanding;
  voice: string;
  selected: boolean;
  showStatus?: boolean;
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
      className={`grid grid-cols-[16px_minmax(0,1fr)_minmax(0,1fr)_28px_90px] cursor-pointer select-none items-center gap-3 border-b border-border px-1 py-2 text-text last:border-b-0 max-[600px]:grid-cols-[16px_minmax(0,1fr)_minmax(0,1fr)_28px] ${
        selected ? "bg-accent-bg" : "hover:bg-panel"
      }`}
    >
      <span
        className={`flex h-4 w-4 flex-none items-center justify-center rounded text-[10px] leading-none ${
          selected ? "bg-accent text-bg" : "border border-border text-transparent"
        }`}
        aria-hidden
      >
        ✓
      </span>
      <PairCell side={pair.happens} voice={voice} />
      <PairCell side={pair.doIt} voice={voice} />
      <ViewLink entry={entry} className="flex-none" />
      {showStatus ? (
        <span className="flex-none max-[600px]:hidden">
          <StandingCell standing={standing} />
        </span>
      ) : null}
    </div>
  );
}
