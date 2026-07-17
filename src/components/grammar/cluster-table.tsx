// The map itself: members down, three columns across.
//
// THE THIRD COLUMN REPEATS AND THAT IS THE CONTENT.
// ================================================
// Seven rows reading "must do X". Not a bug, not a data-entry slip, and not
// something to dedupe with a rowspan or an "as above" — the repetition IS the
// finding. English has one word for seven Japanese patterns, and a user who
// reads that column down and thinks "wait, they're all the same?" has just
// learned the thing the page exists to teach. Collapse it and the page says
// nothing at all.
//
// THERE IS NO "HOW IT'S GOING" COLUMN.
// ===================================
// The plate draws one (solid / getting there / shaky / not seen). It is not
// here, on purpose. This page is a MAP: it reads recipes.ts and the conjugation
// engine and nothing else, so it has no idea what you have seen and cannot
// acquire one without reaching into the scheduler. That independence is the
// point — the map is the one screen that is true before you have ever answered
// a question, and it stays true if the scheduler is rewritten underneath it.

import type { BuiltRow } from "@/lib/grammar/build";

export function ClusterTable({ rows }: { rows: readonly BuiltRow[] }) {
  return (
    // Japanese does not wrap at convenient places and this table is the widest
    // thing on the page, so it scrolls inside its own box rather than pushing
    // the page body sideways.
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr>
            {["Form", "How it's built", "What it means"].map((h) => (
              <th
                key={h}
                className="border-b border-border pb-2 pr-2.5 text-[9.5px] font-medium uppercase tracking-[0.11em] text-text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ recipe, built, how }) => (
            <tr key={recipe.id} className="border-b border-border last:border-b-0">
              {/* Always the worked example, now that every row has one. This
                  cell used to fall back to the bare pattern for 〜は〜より,
                  because a one-suffix recipe could only reach 本は and printing
                  that beside a gloss reading "X is more … than Y" would teach
                  that 本は means that. The recipe model holds the whole wrap, so
                  the cell holds the whole example: 本は車より. */}
              <td className="whitespace-nowrap py-2 pr-2.5 text-[15px]">{built}</td>
              <td className="whitespace-nowrap py-2 pr-2.5 text-[12.5px] text-text-muted">
                {how}
              </td>
              <td className="py-2 pr-2.5">{recipe.gloss}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
