"use client";

// Every character you have ever practised, as a real table — and the one place
// they are never forgotten.
//
// Home's "Weakest 20" card and its Confusions card are SUGGESTIONS: they stop
// pointing at a confusion once it graduates, because their job is choosing what
// to drill next and a solved problem is the wrong answer to that question.
// Statistics has the opposite job. Everything you have ever practised stays
// listed here, graduated or not, because this is the record.
//
// This used to be a top-30 list of inline text. Two changes:
//
//   1. COLUMNS, not inline text. `ご go hiragana` and `ジョ jo katakana` set
//      their romaji at different x, because one kana glyph is not two. A fixed
//      Character column ends that: every romaji starts at the same place.
//   2. NO CAP. The truncation existed to express "weakest first". Sorting
//      expresses that better, as a DEFAULT VIEW rather than a hidden rule — and
//      once you can sort by "most seen", a table that silently drops everything
//      past row 30 is lying about what it shows. So: all of it, in a scroller.
//
// The default sort still reproduces the old list exactly — accuracy ascending,
// ties broken toward the character you have seen MORE, matching weakestChars()
// in src/lib/decks.ts. It ranks by ACCURACY under the chosen metric, not by raw
// misses: "missed 9 times" says nothing without knowing it was shown 200.
//
// AND SO THE SECTION IS CALLED "CHARACTERS", not "Weakest characters".
//
// The cap is what made the old name true; removing it made the name a claim the
// table no longer honours. Every row is here, and one click on "Seen" sorts the
// STRONGEST character you own to the top — a "Weakest characters" heading over
// が 100% · seen 214× is simply false. The rename is not a softening; it's the
// heading catching up with what the component already does.
//
// "Characters" was chosen over "All characters" because the script filter can
// narrow the table to one set, and "All characters" would then be its own small
// lie. "Characters" names what the rows ARE rather than making a claim about
// their order or their extent, so it survives every sort, every filter, and
// whatever column gets added next. Weakest-first is still what you see first —
// it just lives in the DEFAULT SORT (see COMPARE.acc) and is announced by the
// arrow in the Accuracy heading, which is where a claim about ordering can stay
// true without anyone having to write it down on the screen.

import { useMemo, useState } from "react";

import { Card, Chip, Hint, Lbl } from "@/components/ui";
import { CHAR_INDEX, SETS } from "@/data/characters";
import { accuracyOf, formatAccuracy } from "@/lib/accuracy";
import type { AccuracyMetric, HistoryFile } from "@/types";

/** char → position in SETS. あいうえお order — the order a learner thinks in,
 * which code-point order only approximates and localeCompare("ja") only
 * guesses at. The data already knows; ask it. */
const CHAR_ORDER: Record<string, number> = (() => {
  const order: Record<string, number> = {};
  let i = 0;
  for (const set of SETS) {
    for (const sec of set.sections) {
      for (const ch of sec.chars) order[ch.c] ??= i++;
    }
  }
  return order;
})();

/** set id → position in SETS, so "group by script" means hiragana then
 * katakana rather than whatever order the ids happen to sort in. */
const SET_ORDER: Record<string, number> = Object.fromEntries(
  SETS.map((s, i) => [s.id, i]),
);

type SortKey = "char" | "romaji" | "script" | "acc" | "seen";
type SortDir = "asc" | "desc";
type ScriptFilter = "all" | string;

interface Row {
  c: string;
  romaji: string;
  set: string;
  setLabel: string;
  seen: number;
  pct: number;
}

/** Ascending compare per column. Reversing a click negates the whole thing,
 * tie-break included — "click again" means the list turns around, not that it
 * re-sorts under a different rule. */
const COMPARE: Record<SortKey, (a: Row, b: Row) => number> = {
  // Ties never happen (one row per character) but keep the shape uniform.
  char: (a, b) => (CHAR_ORDER[a.c] ?? 0) - (CHAR_ORDER[b.c] ?? 0),
  romaji: (a, b) =>
    a.romaji.localeCompare(b.romaji, "en") ||
    (CHAR_ORDER[a.c] ?? 0) - (CHAR_ORDER[b.c] ?? 0),
  script: (a, b) =>
    (SET_ORDER[a.set] ?? 0) - (SET_ORDER[b.set] ?? 0) ||
    (CHAR_ORDER[a.c] ?? 0) - (CHAR_ORDER[b.c] ?? 0),
  // THE DEFAULT VIEW, and the table's one real opinion — so this is where the
  // reasoning lives now. It used to be printed under the table as a paragraph
  // explaining itself to the user; the user's answer was that the table already
  // shows its sort arrows and does not need a note about how headings work. The
  // argument is still worth keeping, it just belongs to whoever changes this
  // line, not to whoever reads the screen:
  //
  //   ACCURACY, NOT MISSES. "missed 9 times" says nothing without knowing it was
  //   shown 200; ranking by raw misses just sorts by how much you drill.
  //   THEN MORE SEEN FIRST. 0% from twenty showings is a better-evidenced
  //   weakness than 0% from one, so the tie breaks toward the character you have
  //   more evidence about rather than toward whichever one Object.entries
  //   happened to yield first.
  //
  // Same rule as weakestChars() in src/lib/decks.ts, deliberately — this table
  // and Home's "Weakest 20" must not disagree about which character is worst.
  acc: (a, b) => a.pct - b.pct || b.seen - a.seen,
  seen: (a, b) => a.seen - b.seen || a.pct - b.pct,
};

export function CharactersTable({
  history,
  metric,
}: {
  history: HistoryFile;
  metric: AccuracyMetric;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("acc");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [script, setScript] = useState<ScriptFilter>("all");

  const all = useMemo<Row[]>(
    () =>
      Object.entries(history.chars).flatMap(([c, agg]) => {
        // Characters the data no longer has, and characters with no history:
        // accuracy is null for the unpractised and the app's rule is to hide
        // accuracy, never to zero it.
        const info = CHAR_INDEX[c];
        const pct = accuracyOf(agg, metric);
        if (!info || pct === null) return [];
        return [
          {
            c,
            romaji: info.r[0],
            set: info.set,
            setLabel: info.setLabel,
            seen: agg.seen,
            pct,
          },
        ];
      }),
    [history, metric],
  );

  const rows = useMemo(() => {
    const cmp = COMPARE[sortKey];
    const sign = sortDir === "asc" ? 1 : -1;
    return all
      .filter((r) => script === "all" || r.set === script)
      .sort((a, b) => sign * cmp(a, b));
  }, [all, script, sortKey, sortDir]);

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    // Land on the reading each column is usually asked for: worst accuracy
    // first, most-seen first, but a-to-z for the text columns.
    setSortDir(key === "acc" ? "asc" : key === "seen" ? "desc" : "asc");
  }

  const head = { sortKey, sortDir, sortBy };

  return (
    <Card>
      {/* No metric caption here any more: the page-level toggle beside the
       * title states it once for the trend, the tile, the rings and this
       * table, all of which now read the same metric. Reprinting "first try"
       * per card was the old way of admitting there was no control. */}
      <Lbl>Characters</Lbl>

      {all.length === 0 ? (
        <div className="flex min-h-[76px] items-center justify-center rounded-[10px] border border-dashed border-border">
          <p className="px-4 text-center text-xs text-text-muted">
            Nothing to rank yet. Characters appear here once you have drilled
            them.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <Chip on={script === "all"} onClick={() => setScript("all")}>
              All
            </Chip>
            {SETS.map((s) => (
              <Chip
                key={s.id}
                on={script === s.id}
                onClick={() => setScript(s.id)}
              >
                {s.label}
              </Chip>
            ))}
            <span className="ml-1 text-[11px] tabular-nums text-text-muted">
              {rows.length} of {all.length}
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="flex min-h-[76px] items-center justify-center rounded-[10px] border border-dashed border-border">
              <p className="px-4 text-center text-xs text-text-muted">
                No practised characters in that script yet.
              </p>
            </div>
          ) : (
            // Every character with history, however many that is — the filter
            // and the sort are the answer to "that's a lot of rows", not a
            // silent cut. Capped height so the page below stays reachable.
            //
            // kq-scroll themes this scroller's scrollbar from --border, the
            // same as the page's (globals.css).
            <div className="kq-scroll max-h-[60vh] overflow-y-auto pr-2">
              <table className="w-full border-collapse text-[13px]">
                {/* kq-table-head, NOT bg-card — though what it paints IS the
                 * card. --card is translucent in kiri, so a plain `bg-card`
                 * sticky header let rows scroll straight through the column
                 * titles; the fix after that went opaque and turned the header
                 * into a black bar bolted onto a pale card. The class does the
                 * thing neither did: it restacks the card's OWN layers at the
                 * header, per theme — its ground, its fill, and the saturation
                 * its frost applies to both — so the header reads as the table's
                 * surface and the rows still vanish under it. See the STICKY
                 * TABLE HEADER section in globals.css; the saturation is the
                 * part the pass before this one left out, and leaving it out is
                 * what the user was still seeing as a box. It also carries the
                 * header's bottom rule, which border-collapse would otherwise
                 * scroll away with the body — hence no border-b on the row
                 * below. */}
                <thead className="kq-table-head sticky top-0 z-10">
                  <tr>
                    <Th {...head} col="char" className="w-[88px]">
                      Character
                    </Th>
                    <Th {...head} col="romaji">
                      Romaji
                    </Th>
                    <Th {...head} col="script" className="w-[92px]">
                      Script
                    </Th>
                    <Th {...head} col="acc" right className="w-[96px]">
                      Accuracy
                    </Th>
                    <Th {...head} col="seen" right className="w-[64px]">
                      Seen
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.c} className="border-b border-border last:border-b-0">
                      {/* Fixed width, so the romaji beside ご and the romaji
                       * beside ジョ start at the same x. */}
                      <td className="py-2 font-kana text-[20px] leading-none">
                        {r.c}
                      </td>
                      <td className="py-2">{r.romaji}</td>
                      <td className="py-2">
                        <Hint>{r.setLabel.toLowerCase()}</Hint>
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        <span className="flex items-center justify-end gap-2">
                          {/* The same panel-track/accent-fill read as the deck
                           * rings and the volume bars — accuracy, drawn small. */}
                          <span
                            aria-hidden="true"
                            className="hidden h-[3px] w-10 flex-none overflow-hidden rounded-full bg-panel sm:block"
                          >
                            <span
                              className="block h-full rounded-full bg-accent opacity-80"
                              style={{ width: `${r.pct}%` }}
                            />
                          </span>
                          {formatAccuracy(r.pct)}
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums text-text-muted">
                        {r.seen}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* No explainer under the table. It described the default sort, the
           * tie-break and its justification, and then explained that headings
           * sort when clicked — four sentences to say what the arrow in the
           * Accuracy heading says by pointing. The sort rule and the reasoning
           * behind it now live in COMPARE.acc above, which is the only place
           * either can go stale. */}
        </>
      )}
    </Card>
  );
}

/** A sortable column heading. A real button, because a div that only responds
 * to a mouse is a column half the people here cannot sort. */
function Th({
  col,
  children,
  right,
  className,
  sortKey,
  sortDir,
  sortBy,
}: {
  col: SortKey;
  children: React.ReactNode;
  right?: boolean;
  className?: string;
  sortKey: SortKey;
  sortDir: SortDir;
  sortBy: (key: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <th
      scope="col"
      aria-sort={
        active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
      }
      className={[
        "pb-2 font-normal",
        right ? "text-right" : "text-left",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        onClick={() => sortBy(col)}
        className={[
          "group flex w-full cursor-pointer items-center gap-1",
          "text-[11px] font-semibold uppercase tracking-[0.04em]",
          right ? "justify-end" : "justify-start",
          active ? "text-accent" : "text-text-muted hover:text-text",
        ].join(" ")}
      >
        {children}
        <span
          aria-hidden="true"
          className={
            active
              ? "text-[8px] leading-none"
              : "text-[8px] leading-none opacity-0 group-hover:opacity-40"
          }
        >
          {active && sortDir === "desc" ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
}
