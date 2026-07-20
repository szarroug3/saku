"use client";

// "Ways to say this" — the pattern's family, on the pattern's own page.
//
// THE HEADING IS NOT GENERATED, AND THAT IS A CORRECTNESS DECISION
// ===============================================================
// The obvious heading is "Seven ways to say must", built from the cluster's
// size and title the way the cluster page builds "The seven". It is not here,
// because it would be FALSE on two of the nine populated clusters. `seems`
// glosses its six members as "looks like it will X", "looks X", "I hear that X"
// and "seems that X" — four different English sentences, not one; `conditionals`
// runs "if X", "if/when X", "whenever X, Y". Seven of nine share a gloss and two
// do not, so a heading claiming a shared meaning would be a generated statement
// nobody had verified, on the two pages where it happens to be wrong.
//
// "Ways to say this" is true of all nine and says the same thing. The cluster
// page can afford the stronger phrasing because it is a page ABOUT one cluster
// and its title carries the claim; a component that runs on 29 pattern pages
// cannot. Compare `patternsShown` in lib/grammar/build.ts, which exists because
// the 'seems' cluster started announcing "THE 13" over seven patterns: a
// generated count of the wrong thing, on the page that promises it cannot be
// wrong. Same class of bug, caught before it shipped this time.
//
// A ONE-MEMBER FAMILY RENDERS NOTHING. The caller drops this component when the
// cluster has fewer than two members — a table with one row is not a comparison,
// it is the page repeating its own header under a heading that promises
// alternatives. No cluster is a singleton today (the smallest populated one has
// two members and three have none at all), so this is a guard against the data
// changing rather than a case anyone can currently reach; it lives in the caller
// because that is where the decision to render is made.
//
// THE CURRENT PATTERN IS MARKED BY ACCENT ON ITS OWN NAME. Not a filled row, not
// a left rule, not a badge. Every other table in the app marks nothing, so a new
// row treatment would be a new visual language invented for one table; the
// accent is already the app's "this one" colour, and the reader's eye finds it
// in a column of black without being told to.

import Link from "next/link";

import { StandingChip } from "@/components/library/standing-chip";
import { Card, Lbl } from "@/components/ui";
import { patternEntry, patternMeaningFactId } from "@/data/grammar";
import type { Recipe } from "@/data/grammar/recipes";
import { buildRow } from "@/lib/grammar/build";
import { primaryHost } from "@/lib/grammar/example";
import { entryHref } from "@/lib/library/href";
import { standingOf } from "@/lib/library/standing";
import type { Claims } from "@/lib/claims";
import type { AccuracyMetric, HistoryFile } from "@/types";

export function PatternFamily({
  members,
  current,
  facts,
  claims,
  metric,
  now,
}: {
  members: readonly Recipe[];
  /** The recipe whose page this is. Marked, not filtered out: a family with the
   * member you are reading about missing is not that family. */
  current: Recipe;
  facts: HistoryFile["facts"];
  claims: Claims;
  metric: AccuracyMetric;
  now: number;
}) {
  return (
    <Card>
      <Lbl>Ways to say this</Lbl>
      {/* Japanese does not wrap at convenient places and this is the widest
          thing on the page, so it scrolls inside its own box rather than
          pushing the page body sideways. Same treatment as the cluster page's
          table, for the same reason. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-xs font-medium text-text-muted">
              <th className="py-1.5 pr-2 font-medium">Pattern</th>
              <th className="py-1.5 pr-2 font-medium">How it&rsquo;s built</th>
              <th className="py-1.5 pr-2 font-medium">What it means</th>
              <th className="py-1.5 font-medium">How you&rsquo;re doing</th>
            </tr>
          </thead>
          <tbody>
            {members.map((r) => {
              // ONE ROW PER PATTERN, not per host — the cluster page splits
              // 〜すぎる into a verb line and an adjective line because its
              // subject is the BUILD, and this table's subject is the WAYS TO
              // SAY IT. Three rows of 〜すぎる under "ways to say this" would be
              // counting one way as three. The primary host is the one shown,
              // which is the first host that actually transforms its word — see
              // primaryHost, and the 〜ので item it was written for.
              const row = buildRow(r, primaryHost(r) ?? undefined);
              const fact = patternMeaningFactId(r.id);
              const s = standingOf(facts[fact], claims[fact], metric, now);
              const here = r.id === current.id;
              return (
                <tr key={r.id} className="border-b border-border last:border-b-0">
                  <td className="whitespace-nowrap py-2 pr-2 align-middle font-kana text-[15px]">
                    {here ? (
                      <span className="text-accent">{r.pattern}</span>
                    ) : (
                      <Link
                        href={entryHref(patternEntry(r.id))}
                        className="text-text no-underline"
                      >
                        {r.pattern}
                      </Link>
                    )}
                    {r.sense && (
                      <span className="ml-1 text-[12px] text-text-muted">
                        ({r.sense})
                      </span>
                    )}
                  </td>
                  {/* The engine's output, not a typed-out string. If a cell
                      here is wrong the engine is wrong and 20,408 entries are
                      wrong with it. A member that will not build (a refusal is
                      a normal value, not an error) prints nothing rather than a
                      guess. */}
                  <td className="whitespace-nowrap py-2 pr-2 align-middle font-kana text-text-muted">
                    {row ? row.built : ""}
                  </td>
                  {/* THE REPETITION IS THE CONTENT. Seven rows reading "must do
                      X" is not something to dedupe with a rowspan: English has
                      one word for seven Japanese patterns, and a reader who
                      gets to the bottom of this column and thinks "wait, these
                      are all the same?" has learned the thing the table is for. */}
                  <td className="py-2 pr-2 align-middle">{r.gloss}</td>
                  <td className="py-2 align-middle">
                    <StandingChip standing={s.standing} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* NO FEEL NOTE HERE. `feel` is authored per FAMILY, and this component
          renders on 29 individual pattern pages, so a family note on a member's
          page can spend all of itself on a different member: on 〜かもしれない
          it described 〜そう and never named 〜かもしれない at all. It lives on
          the cluster page, which is the page about the whole family. */}
    </Card>
  );
}
