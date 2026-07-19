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
//
// A SECOND COLUMN OF SCORES WAS DRAWN AND REJECTED for a sharper reason than
// the first: 5 of the 6 `seems` members are not producible, so 10 of that
// table's 13 rows would be blank. A column that is empty on three quarters of
// the page it was added for is not a column.
//
// GROUP HEADINGS, ONE PER HOST.
// ============================
// The rows are one per (recipe, host) and always were; what is new is that the
// table says so. See the header of lib/grammar/cluster-view.ts for why the
// grouping is the honest shape and why nine of the twelve clusters get exactly
// one heading.

import type { BuiltRow } from "@/lib/grammar/build";
import { hostGroups } from "@/lib/grammar/cluster-view";

export function ClusterTable({ rows }: { rows: readonly BuiltRow[] }) {
  const groups = hostGroups(rows);
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
        {/* ONE tbody PER GROUP, which is what a tbody is for — the heading is a
            real row inside the group it heads rather than a floating line
            between two tables, so the three columns stay aligned down the whole
            page and a screen reader walks the groups in order. */}
        {groups.map((g, i) => (
          <tbody key={g.host}>
            <tr>
              {/* The first heading sits right under the column names and needs
                  no gap; every later one is separating two groups and does. */}
              <th
                colSpan={3}
                className={`pb-1 text-left text-[11px] font-normal text-text-muted ${
                  i === 0 ? "pt-2" : "pt-5"
                }`}
              >
                {g.label} <span className="text-text">· {g.word}</span>
              </th>
            </tr>
            {/* Keyed on (recipe, host): a pattern that takes a verb AND an
                adjective now prints one row for each — 行きすぎる then 高すぎる —
                because a column that stopped at the verb was telling the reader
                〜すぎる is a verb pattern. The id alone stopped being unique with
                it. */}
            {g.rows.map(({ recipe, host, built, how }) => (
              <tr key={`${recipe.id}/${host}`} className="border-b border-border last:border-b-0">
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
        ))}
      </table>
    </div>
  );
}
