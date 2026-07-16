"use client";

// Patterns and Progress share one row shape, because they are the same fact
// read at different points in its life: a confusion, and what history makes of
// it. Patterns is what this run broke; Progress is what this run had a chance
// to break and didn't.
//
// THE UNIT IS THE RUN, SO THE WORDS ARE "THIS RUN"
// ================================================
// These rows used to say "today" — "Mixed up again today", "Right first try
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
import type { PairRow } from "@/lib/confusions";
import type { SessionStats } from "@/types";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function s(n: number): string {
  return n === 1 ? "" : "s";
}

/** "nearly always ツ read as "shi"" — or "mixed up both ways", or nothing when
 * there aren't enough mix-ups to claim a direction at all. */
function directionText(row: PairRow): string | null {
  const d = row.direction;
  if (d.kind === "unknown") return null;
  if (d.kind === "mixed") return "mixed up both ways";
  return `nearly always ${d.shown} read as "${reading(d.readAs)}"`;
}

function join(parts: Array<string | null>): string {
  return parts.filter(Boolean).join(" · ");
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
            ? `first time in ${row.cleanRunsBefore} run${s(row.cleanRunsBefore)} — probably a slip`
            : "first time you've mixed these up — probably a slip",
        ]),
      ];
    case "improving": {
      // "Right first try this run" is only sayable when it's true of both
      // halves; the pair not being confused doesn't mean the characters were
      // easy.
      const clean = [row.a, row.b].every(
        (c) => !(c in stats) || stats[c].firstTryCorrect === true,
      );
      const left = graduateRuns - record.cleanStreak;
      return [
        clean ? "Right first try this run" : "No mix-up this run",
        join([
          wasWorst ? "was your worst pair" : null,
          `${record.cleanStreak} clean run${s(record.cleanStreak)}, ${left} to clear it`,
        ]),
      ];
    }
    case "cleared":
      return [
        "Fixed — you won't see this again",
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

/** Runs to graduation, as dots. The counter IS the promise: this many more and
 * the pair stops being brought up. */
function Dots({ done, total }: { done: number; total: number }) {
  return (
    <span
      className="ml-auto flex flex-none gap-[3px]"
      aria-label={`${done} of ${total} clean runs`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cx(
            "h-[5px] w-[5px] rounded-full",
            i < done ? "bg-success" : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

export function PatternRow({
  row,
  stats,
  graduateRuns,
  wasWorst,
}: {
  row: PairRow;
  stats: SessionStats;
  graduateRuns: number;
  /** The heaviest record on the screen — lets an improving row say what it was
   * before it started getting better. */
  wasWorst?: boolean;
}) {
  const [first, second] = lines(row, stats, graduateRuns, !!wasWorst);
  return (
    <div
      className={cx(
        "flex items-center gap-2.5 rounded-[10px] border px-2.5 py-2",
        TONE[row.state],
      )}
    >
      <span className="min-w-[58px] flex-none font-kana text-[17px] font-extralight tracking-[0.04em]">
        {row.a} ↔ {row.b}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] leading-snug">{first}</span>
        {second ? (
          <span className="text-[11px] leading-snug text-text-muted">
            {second}
          </span>
        ) : null}
      </span>
      {row.state === "improving" ? (
        <Dots done={row.record.cleanStreak} total={graduateRuns} />
      ) : (
        <Tag state={row.state} />
      )}
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
}: {
  label: string;
  rows: PairRow[];
  stats: SessionStats;
  graduateRuns: number;
  worstKey?: string;
}) {
  if (!rows.length) return null;
  return (
    <>
      <Lbl>{label}</Lbl>
      <div className="mb-3.5 flex flex-col gap-1.5">
        {rows.map((row) => (
          <PatternRow
            key={row.key}
            row={row}
            stats={stats}
            graduateRuns={graduateRuns}
            wasWorst={row.key === worstKey}
          />
        ))}
      </div>
    </>
  );
}
