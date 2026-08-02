"use client";

// Patterns and Progress share one row shape, because they are the same fact
// read at different points in its life: a confusion, and what history makes of
// it. Patterns is what this run broke; Progress is what this run had a chance
// to break and didn't.
//
// THE UNIT IS THE RUN, SO THE WORDS ARE "THIS RUN"
// ================================================
// These rows used to say "today" — "Mixed up again today", "No mix-up
// today", "No mix-up today". Every one of them was false, and in both
// directions. The lifecycle in confusions.ts counts RUNS: cleanStreak,
// runsMixedUp and runsToLastMixUp are all tallies of sessions, and nothing
// anywhere reads a clock. So three sessions in one afternoon are three separate
// "today"s that each overwrite the last, and a run left open overnight reports
// yesterday's mix-up as today's. The word claimed a granularity the data does
// not have and never did.
//
// "This run" is what the sentence actually means, and it is the noun the rest
// of the row is already counting in — "3 of your last 6 runs", "2 clean runs, 1
// to clear it". Saying "run" in the headline too makes the second line the same
// unit as the first, which is what lets "Mixed up again this run · 3 of your
// last 6 runs" read as one thought rather than two scales stitched together.
// (Not "this session": the counters are named runs, `graduateRuns` is the
// promise being tracked, and the screen should use one word for one thing.)

import { Lbl } from "@/components/ui";
import { reading } from "@/components/results/summary";
import { factsOf, factInfo, glyphOf } from "@/lib/facts";
import {
  GETTING_THERE_PCT,
  SOLID_PCT,
  STANDING_LABEL,
} from "@/lib/library/standing";
import type { PairRow } from "@/lib/confusions";
import type { SessionStats } from "@/types";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function pctOf(runs: boolean[]): number {
  if (!runs.length) return 0;
  const hits = runs.filter(Boolean).length;
  return (100 * hits) / runs.length;
}

function runsToReach(runs: boolean[], targetPct: number): number {
  if (pctOf(runs) >= targetPct) return 0;
  let next = [...runs];
  for (let i = 1; i <= 50; i++) {
    next = [...next, true].slice(-10);
    if (pctOf(next) >= targetPct) return i;
  }
  return 50;
}

function s(n: number): string {
  return n === 1 ? "" : "s";
}

function kindLabel(entry: string): string {
  const first = factsOf(entry as never)[0];
  const subject = first ? factInfo(first)?.subject : null;
  if (subject === "kanji") return "kanji";
  if (subject === "word") return "word";
  if (subject === "radical") return "radical";
  if (subject === "kana") return "kana";
  if (subject === "grammar") return "grammar";
  if (subject === "transitivity") return "verb pair";
  if (subject === "keigo") return "keigo";
  return "entry";
}

/** "nearly always ツ read as "shi"" — or "mixed up both ways", or nothing when
 * there aren't enough mix-ups to claim a direction at all. */
function directionText(row: PairRow): string | null {
  const d = row.direction;
  if (d.kind === "unknown") return null;
  if (d.kind === "mixed") return "mixed up both ways";
  return `nearly always ${glyphOf(d.shown)} read as "${reading(d.readAs)}"`;
}

/** The row's second line. Sentence case, capitalized HERE rather than in each
 * fragment: which clause leads varies by branch and by how much evidence there
 * is — `directionText` drops out below DIRECTION_MIN, `wasWorst` only shows on
 * the heaviest row — so "first time in 2 runs" leads one row and trails the
 * next. Capitalizing the composed line is the only place that catches every
 * combination. Fragments that already lead with a kana or a digit are
 * unaffected. */
function join(parts: Array<string | null>): string {
  const line = parts.filter(Boolean).join(" · ");
  return line ? line[0].toUpperCase() + line.slice(1) : line;
}

/** The row's two lines: what happened, and how seriously to take it. */
function lines(
  row: PairRow,
  stats: SessionStats,
  graduateRuns: number,
  wasWorst: boolean,
): [string, string] {
  const dir = directionText(row);
  const { record } = row;
  switch (row.state) {
    case "weakness":
      return [
        `Mixed up again this run${row.run.total > 1 ? ` · ${row.run.total}×` : ""}`,
        join([
          dir,
          `${record.runsMixedUp} of your last ${row.runsToLastMixUp} runs`,
        ]),
      ];
    case "new":
      return [
        `Mixed up ${row.run.total > 1 ? `${row.run.total}×` : "once"}`,
        join([
          dir,
          row.cleanRunsBefore
            ? `first time in ${row.cleanRunsBefore} run${s(row.cleanRunsBefore)}, probably a slip`
            : "first time you've mixed these up, probably a slip",
        ]),
      ];
    case "improving": {
      const left = graduateRuns - record.cleanStreak;
      return [
        "No mix-up this run",
        join([
          wasWorst ? "was your worst pair" : null,
          `${record.cleanStreak} clean run${s(record.cleanStreak)}, ${left} to clear it`,
        ]),
      ];
    }
    case "cleared":
      return [
        "Fixed, and you won't see this again",
        join([
          `${graduateRuns} clean runs in a row`,
          `used to miss it ${record.runsMixedUp} time${s(record.runsMixedUp)} in ${row.runsToLastMixUp}`,
        ]),
      ];
    default:
      // "retired" never reaches a row — analyzeRun drops it.
      return ["", ""];
  }
}

const TONE: Record<string, string> = {
  weakness: "border-danger/40 bg-danger-bg",
  new: "border-border",
  improving: "border-success/35 bg-success-bg",
  cleared: "border-success/70 bg-success-bg",
};

function Tag({ state }: { state: PairRow["state"] }) {
  if (state === "improving") return null; // the dot counter is its readout
  const tone =
    state === "weakness"
      ? "bg-danger/15 text-danger"
      : state === "cleared"
        ? "bg-success/15 text-success"
        : "bg-panel text-text-muted";
  return (
    <span
      className={cx(
        "ml-auto flex-none rounded-full px-2 py-0.5",
        "text-[9px] uppercase tracking-[0.07em]",
        tone,
      )}
    >
      {state}
    </span>
  );
}

function runPips(runs: boolean[]) {
  const lastTen = runs.slice(-10);
  const padded: Array<boolean | null> = [
    ...Array.from({ length: Math.max(0, 10 - lastTen.length) }, () => null),
    ...lastTen,
  ];
  return padded.map((ok, i) => (
    <span
      key={i}
      style={{
        backgroundColor:
          ok === null
            ? "color-mix(in srgb, var(--text-muted) 24%, transparent)"
            : ok
              ? "var(--success)"
              : "var(--danger)",
      }}
      className={cx(
        "h-[5px] w-[5px] rounded-full",
      )}
    />
  ));
}

function progressText(runs: boolean[]): string {
  const toShaky = runsToReach(runs, GETTING_THERE_PCT);
  const toClear = runsToReach(runs, SOLID_PCT);
  if (toClear === 0) {
    return `Currently ${STANDING_LABEL.solid}`;
  }
  if (toShaky > 0) {
    return `Currently ${STANDING_LABEL.shaky}, ${toShaky} to getting there, ${toClear} to clear it`;
  }
  return `Currently ${STANDING_LABEL["getting-there"]}, ${toClear} to clear it`;
}

export function PatternRow({
  row,
  stats,
  graduateRuns,
  wasWorst,
  onClear,
  selected,
  onToggle,
  runs,
}: {
  row: PairRow;
  stats: SessionStats;
  graduateRuns: number;
  /** The heaviest record on the screen — lets an improving row say what it was
   * before it started getting better. */
  wasWorst?: boolean;
  /** Offered only after this quiz supplied a clean run for the pair. */
  onClear?: () => void;
  selected?: boolean;
  onToggle?: () => void;
  runs?: boolean[];
}) {
  const [first, second] = lines(row, stats, graduateRuns, !!wasWorst);
  const glyphA = glyphOf(row.a);
  const glyphB = glyphOf(row.b);
  const clickable = !!onToggle;
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onToggle}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle?.();
              }
            }
          : undefined
      }
      aria-pressed={clickable ? selected : undefined}
      className={cx("w-full text-left", clickable && "cursor-pointer")}
    >
      <div
      className={cx(
        "relative flex items-center gap-2.5 rounded-[10px] border px-2.5 py-2",
        selected ? "border-accent bg-accent-bg" : TONE[row.state],
      )}
      >
      {selected ? (
        <span aria-hidden="true" className="absolute right-1 top-0.5 text-[9px] text-accent">
          ✓
        </span>
      ) : null}
      <span className="min-w-[112px] flex-none">
        <span className="flex items-center justify-center gap-2">
          <span className="flex min-w-[42px] flex-col items-center">
            <span className="text-[12px] font-medium leading-snug sm:text-[13px] break-words text-center">
              {glyphA}
            </span>
            <span className="mt-0.5 text-[10px] font-medium leading-none tracking-[0.03em] text-text-muted">
              {kindLabel(row.a)}
            </span>
          </span>
          <span aria-hidden="true" className="text-[17px] leading-none text-text">
            ↔
          </span>
          <span className="flex min-w-[42px] flex-col items-center">
            <span className="text-[12px] font-medium leading-snug sm:text-[13px] break-words text-center">
              {glyphB}
            </span>
            <span className="mt-0.5 text-[10px] font-medium leading-none tracking-[0.03em] text-text-muted">
              {kindLabel(row.b)}
            </span>
          </span>
        </span>
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] leading-snug">{first}</span>
        {row.state === "improving" ? (
          <span className="text-[11px] leading-snug text-text-muted">
            {progressText(runs ?? [])}
          </span>
        ) : second ? (
          <span className="text-[11px] leading-snug text-text-muted">
            {second}
          </span>
        ) : null}
      </span>
      {row.state === "improving" ? (
        <span className="ml-auto flex flex-none flex-col items-end gap-1">
          <span className="ml-auto flex flex-none gap-[3px]" aria-label="last ten runs">
            {runPips(runs ?? [])}
          </span>
          {onClear ? (
            <button
              type="button"
              className="text-[11px] font-medium text-accent hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            >
              Clear now
            </button>
          ) : null}
        </span>
      ) : (
        <Tag state={row.state} />
      )}
      </div>
    </div>
  );
}

/** A labelled stack of rows, or nothing at all when there's nothing to say. */
export function PatternSection({
  label,
  rows,
  stats,
  graduateRuns,
  worstKey,
  onClear,
  showLabel = true,
  showContainer = true,
  isSelected,
  onToggle,
  runsByKey,
}: {
  label: string;
  rows: PairRow[];
  stats: SessionStats;
  graduateRuns: number;
  worstKey?: string;
  onClear?: (key: string) => void;
  showLabel?: boolean;
  showContainer?: boolean;
  isSelected?: (key: string) => boolean;
  onToggle?: (key: string) => void;
  runsByKey?: Map<string, boolean[]>;
}) {
  if (!rows.length) return null;
  const items = rows.map((row) => (
    <PatternRow
      key={row.key}
      row={row}
      stats={stats}
      graduateRuns={graduateRuns}
      wasWorst={row.key === worstKey}
      selected={isSelected?.(row.key)}
      onToggle={onToggle ? () => onToggle(row.key) : undefined}
      runs={runsByKey?.get(row.key)}
      onClear={
        row.state === "improving" && onClear
          ? () => onClear(row.key)
          : undefined
      }
    />
  ));
  return (
    <>
      {showLabel ? <Lbl>{label}</Lbl> : null}
      {showContainer ? (
        <div className="mb-3.5 flex flex-col gap-1.5">{items}</div>
      ) : (
        items
      )}
    </>
  );
}
