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

import { StandingChip } from "@/components/library/standing-chip";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import type { LibEntry } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";
import type { EntryStanding } from "@/lib/library/standing";
import { speak } from "@/lib/speech";

/** Whether an entry has a pronunciation worth a 🔊. A grammar pattern does not —
 * 〜てから is a shape, not a sound — so its tile/row omits the speaker rather
 * than render one that reads out a placeholder. */
function speakable(entry: LibEntry): boolean {
  return entry.kind !== GRAMMAR_SUBJECT;
}

/** The border a tile wears when it is NOT selected, so a shelf reads at a glance
 * without every tile carrying a chip. Border only — a filled tile at this
 * density is a heat-map of your own memory, which the design keeps throwing out.
 *
 * A multi-fact entry gets the neutral border: there is no colour for "four of
 * nine", and inventing a fourth tone to mean "mixed" would be the average again
 * in a costume. */
function toneClass(s: EntryStanding): string {
  switch (s.standing) {
    case "solid":
      return "border-success/50";
    case "getting-there":
    case "slipping":
      return "border-warning/50";
    case "shaky":
      return "border-danger/50";
    default:
      return "border-border";
  }
}

/** What a tile/row shows below the glyph: its one reading, or — for a kanji with
 * many — its meaning. "生 · せい" would be picking one of nine and calling it THE
 * reading; the entry page is where the nine live. */
function subLabel(entry: LibEntry): string {
  return entry.readings.length === 1
    ? entry.readings[0]
    : (entry.meanings[0] ?? "—");
}

/** The small 🔊 target. Its own component because the tile and the row want the
 * identical affordance, and because it must swallow the click so SELECT (the
 * body around it) does not also fire. */
function HearButton({
  entry,
  voice,
  className,
}: {
  entry: LibEntry;
  voice: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(entry.glyph, voice);
      }}
      aria-label={`Hear ${entry.glyph}`}
      className={`cursor-pointer rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] leading-none text-text-muted hover:bg-panel hover:text-text ${className ?? ""}`}
    >
      🔊
    </button>
  );
}

/** The small ↗ target — opens the entry page. A `Link`, so it is a real
 * navigation (middle-click, cmd-click work); `stopPropagation` keeps the click
 * off SELECT. */
function ViewLink({ entry, className }: { entry: LibEntry; className?: string }) {
  return (
    <Link
      href={entryHref(entry.id)}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Open ${entry.glyph}`}
      className={`cursor-pointer rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] leading-none text-text-muted no-underline hover:bg-panel hover:text-text ${className ?? ""}`}
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
  onToggleSelect,
}: {
  entry: LibEntry;
  standing: EntryStanding;
  mnemonic?: string;
  voice: string;
  selected: boolean;
  onToggleSelect(): void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onToggleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleSelect();
        }
      }}
      // Selected owns BOTH border and fill so it beats the tone border and is
      // unmissable; unselected keeps the standing tone. `cursor-pointer` +
      // `select-none` because the whole body is the toggle.
      className={`relative cursor-pointer select-none rounded-[10px] border px-1.5 pb-2 pt-2.5 text-center ${
        selected ? "border-accent bg-accent-bg" : `bg-card ${toneClass(standing)}`
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
      <div className="select-none text-[26px] leading-[1.25] text-text">
        {entry.glyph}
      </div>
      <div className="truncate text-xs text-text-muted">{subLabel(entry)}</div>
      <div className="mt-1.5 flex items-center justify-center gap-1.5">
        {speakable(entry) ? <HearButton entry={entry} voice={voice} /> : null}
        <ViewLink entry={entry} />
      </div>
    </div>
  );
}

/** How an entry's standing reads when it has no adjective. */
export function StandingCell({ standing }: { standing: EntryStanding }) {
  if (standing.standing) return <StandingChip standing={standing.standing} />;
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
  onToggleSelect,
}: {
  entry: LibEntry;
  standing: EntryStanding;
  /** Why this row is here, when the section header doesn't already say it. */
  note?: string;
  voice: string;
  selected: boolean;
  onToggleSelect(): void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onToggleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleSelect();
        }
      }}
      className={`flex cursor-pointer select-none items-center gap-3 border-b border-border px-1 py-2 text-text last:border-b-0 ${
        selected ? "bg-accent-bg" : "hover:bg-panel"
      }`}
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
      <span className="w-[64px] flex-none truncate text-[19px]">{entry.glyph}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">
          {/* ONE reading, and only when there is only one. 先生 gets せんせい.
              生 gets its meaning, because "生 is read せい" is false — it has nine
              readings and this row would be picking one and presenting it as the
              answer, the "生: 61%" mistake in prose. */}
          {entry.readings.length === 1 ? (
            <span className="text-text-muted">{entry.readings[0]} · </span>
          ) : null}
          {entry.meanings.slice(0, 3).join(", ") || entry.sub}
        </span>
        {note ? (
          <span className="block truncate text-xs text-text-muted">{note}</span>
        ) : null}
      </span>
      {speakable(entry) ? (
        <HearButton entry={entry} voice={voice} className="flex-none" />
      ) : null}
      <ViewLink entry={entry} className="flex-none" />
      <span className="flex-none">
        <StandingCell standing={standing} />
      </span>
    </div>
  );
}
