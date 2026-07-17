"use client";

// The tile and the row — the two shapes an entry takes in the Library.
//
// The tile is the kana chart's, kept: a glyph, its reading, and a click that
// speaks it. What is added is that it is now a LINK (every entry in the app has
// a page) and that it wears its standing. The 100px minmax grid and the hover
// wash are unchanged, because they were right.
//
// BOTH SHAPES TAKE AN `EntryStanding`, NOT A `Standing`, and that is the point
// of friction worth keeping. A kanji has no adjective (see standing.ts — an
// entry's standing is a refusal, not an average), so these two components are
// where the app decides what to say instead, and they say a COUNT: "4 of 9".
// That is not a fallback for a missing chip. It is a better sentence, and it is
// the only one that is true.

import Link from "next/link";

import { StandingChip } from "@/components/library/standing-chip";
import type { LibEntry } from "@/lib/library/entries";
import { entryHref } from "@/lib/library/href";
import type { EntryStanding } from "@/lib/library/standing";
import { speak } from "@/lib/speech";

/** The border a tile wears, so a shelf reads at a glance without every tile
 * carrying a chip. Border only — a filled tile at this density is a heat-map of
 * your own memory, which is the thing the design keeps throwing out.
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

export function EntryTile({
  entry,
  standing,
  mnemonic,
  voice,
}: {
  entry: LibEntry;
  standing: EntryStanding;
  mnemonic?: string;
  voice: string;
}) {
  return (
    <div
      className={`rounded-[10px] border px-1.5 pb-2 pt-2.5 text-center ${toneClass(
        standing,
      )}`}
      title={mnemonic}
    >
      <Link
        href={entryHref(entry.id)}
        className="block select-none text-[26px] leading-[1.25] text-text no-underline"
      >
        {entry.glyph}
      </Link>
      <button
        type="button"
        // The glyph goes to the page and the reading speaks it. Two targets in
        // one tile, which the chart did not need because it had nowhere to go:
        // making the whole tile a link would have deleted the speaker, and
        // making the whole tile speak would have made 9,761 pages unreachable.
        onClick={() => speak(entry.glyph, voice)}
        className="block w-full cursor-pointer truncate border-none bg-transparent text-xs text-text-muted hover:text-text"
        aria-label={`Hear ${entry.glyph}`}
      >
        {/* Same rule as EntryRow: a reading, only when there is one of them. A
            kanji tile shows its meaning instead — "生 · せい" would be picking
            one of nine and calling it the reading. The speaker still works
            either way; what it says is the glyph, which has no such problem. */}
        {entry.readings.length === 1
          ? entry.readings[0]
          : (entry.meanings[0] ?? "—")}{" "}
        🔊
      </button>
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

/** The search-result shape: glyph, what it is, how it's going. Wider than a
 * tile because a search result has to justify itself — "電話 · telephone" is the
 * answer, and a grid of 電話 with no gloss is a puzzle. */
export function EntryRow({
  entry,
  standing,
  note,
}: {
  entry: LibEntry;
  standing: EntryStanding;
  /** Why this row is here, when the section header doesn't already say it. */
  note?: string;
}) {
  return (
    <Link
      href={entryHref(entry.id)}
      className="flex items-center gap-3 border-b border-border px-1 py-2 text-text no-underline last:border-b-0 hover:bg-panel"
    >
      <span className="w-[64px] flex-none truncate text-[19px]">{entry.glyph}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">
          {/* ONE reading, and only when there is only one. 先生 gets せんせい,
              because that is how 先生 is read. 生 gets nothing, because "生 is
              read せい" is false — it has nine readings and this row would be
              picking one and presenting it as the answer, which is precisely
              the "生: 61%" mistake the entry/fact split exists to prevent, in
              prose instead of arithmetic. What identifies a kanji in a list is
              its meaning; what identifies its readings is opening it. */}
          {entry.readings.length === 1 ? (
            <span className="text-text-muted">{entry.readings[0]} · </span>
          ) : null}
          {entry.meanings.slice(0, 3).join(", ") || entry.sub}
        </span>
        {note ? (
          <span className="block truncate text-xs text-text-muted">{note}</span>
        ) : null}
      </span>
      <span className="flex-none">
        <StandingCell standing={standing} />
      </span>
    </Link>
  );
}
