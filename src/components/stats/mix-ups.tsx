"use client";

// The confusion engine's home.
//
// It has been reporting into the corner of the results screen — one run at a
// time, gone the moment you navigate away. A mix-up is the one thing this app
// records that is genuinely about YOU rather than about a schedule: nothing in
// the ranking model can predict that you read ツ as シ, and nothing in an
// accuracy figure can say it either, because both answers are just "wrong".
// It only exists because you demonstrated it. So it lives on the page about
// where you are.
//
// THREE WORDS, AND THEY ARE THE ONLY THING A ROW SAYS
// ==================================================
// confusions.ts already tracks a five-state lifecycle, and its names are
// internal — `weakness`, `new`, `improving`, `cleared`, `retired`. They are the
// engine's, and four of the five would be a riddle on screen ("new" mix-up? new
// since when?). A row here wears one of three plain words instead:
//
//   still mixing    an open record, and you mixed them up in the last run that
//                   could have shown them.
//   getting better  an open record, and you haven't since.
//   sorted          graduated. Dim, and last — it is here because you beat it,
//                   which is the only reason to keep looking at it.
//
// `retired` and `cleared` collapse into "sorted" because the difference between
// them is which run the streak landed on, and that is a fact about the engine's
// bookkeeping, not about you.
//
// WHAT THE HINT IS ALLOWED TO SAY
// ===============================
// The direction, and only when directionOf() will commit to one. Under
// DIRECTION_MIN mix-ups it returns `unknown` and the cell is EMPTY — "goes one
// way" off a single miss is a lie dressed as a finding, and confusions.ts
// already refuses to compute it. A blank cell is the honest render of a refusal.
//
// The direction is also the one thing here you can act on: "goes one way" means
// there is a shape you don't recognise and a shape you fall back on, so there is
// something to drill. "goes both ways" means neither is anchored. A recency
// hint — "4 days ago" — was the alternative and it says nothing you would do
// anything about.

import { useMemo } from "react";

import { Card, Lbl } from "@/components/ui";
import { directionOf, pairRecords, type PairRecord } from "@/lib/confusions";
import { entryOf, glyphOf } from "@/lib/facts";
import type { HistoryFile } from "@/types";

type Stage = "mixing" | "better" | "sorted";

const STAGE_LABEL: Record<Stage, string> = {
  mixing: "still mixing",
  better: "getting better",
  sorted: "sorted",
};

const STAGE_CLASS: Record<Stage, string> = {
  mixing: "border-danger text-danger",
  better: "border-warning text-warning",
  sorted: "border-success text-success",
};

interface Row {
  key: string;
  glyphs: string;
  stage: Stage;
  hint: string;
  total: number;
}

/** Where a pair stands, with no run in hand.
 *
 * confusions.ts's `analyzeRun` answers a different question — "what did THIS run
 * do" — and needs a run to answer it. This page has no run; it has a record. So
 * it reads the record's own two flags, which is what they are for: `tracked` is
 * "there is an open weakness", `cleanStreak` is how long since it last happened.
 */
function stageOf(rec: PairRecord): Stage {
  if (!rec.tracked) return "sorted";
  return rec.cleanStreak === 0 ? "mixing" : "better";
}

function hintOf(rec: PairRecord, stage: Stage): string {
  // A graduated record still HAS a direction — confusions.ts keeps the counts so
  // the clearing row can report what it beat. Printing it here would describe a
  // spent record in the present tense.
  if (stage === "sorted") return "";
  const d = directionOf(rec);
  if (d.kind === "one-way") return "goes one way";
  if (d.kind === "mixed") return "goes both ways";
  return "";
}

export function MixUps({
  history,
  graduateRuns,
}: {
  history: HistoryFile;
  graduateRuns: number;
}) {
  const rows = useMemo<Row[]>(() => {
    const recs = [...pairRecords(history, graduateRuns, { entryOf }).values()];
    return recs
      .filter((r) => r.everMixedUp)
      .map((r) => {
        const stage = stageOf(r);
        return {
          key: r.key,
          glyphs: `${glyphOf(r.a)} / ${glyphOf(r.b)}`,
          stage,
          hint: hintOf(r, stage),
          total: r.total,
        };
      })
      .sort(
        (p, q) =>
          // Open records first, beaten ones last — the board's job is what is
          // still costing you, and "sorted" is the reward for reading down.
          ORDER[p.stage] - ORDER[q.stage] ||
          q.total - p.total ||
          p.key.localeCompare(q.key),
      );
  }, [history, graduateRuns]);

  return (
    <Card>
      <Lbl>Things you mix up{rows.length ? ` · ${rows.length}` : ""}</Lbl>

      {rows.length === 0 ? (
        <p className="py-2 text-[13px] text-text-muted">
          Nothing yet. Two things have to get tangled before they can show up
          here.
        </p>
      ) : (
        // No cap and no sticky header. A pair is earned one miss at a time, so
        // this table cannot run away with the page the way a table over every
        // character could — and a scroller with no header in it never meets the
        // nested-backdrop-filter problem that the sticky header needed
        // .kq-table-head to solve.
        <div className="kq-scroll max-h-[280px] overflow-y-auto pr-1">
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  className={`border-b border-border last:border-b-0 ${
                    r.stage === "sorted" ? "opacity-45" : ""
                  }`}
                >
                  <td className="py-2 pr-2 font-kana text-base">{r.glyphs}</td>
                  <td className="w-[116px] py-2">
                    {/* `rounded-full` + `border` IS the Chip recipe in
                     * globals.css — the one accidental pair the kit means on
                     * purpose. This is a chip, so it opts in, exactly as
                     * StandingChip does. */}
                    <span
                      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${
                        STAGE_CLASS[r.stage]
                      }`}
                    >
                      {STAGE_LABEL[r.stage]}
                    </span>
                  </td>
                  <td className="w-[104px] py-2 text-right text-xs text-text-muted">
                    {r.hint}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const ORDER: Record<Stage, number> = { mixing: 0, better: 1, sorted: 2 };
