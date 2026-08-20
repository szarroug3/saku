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

import { Card, Lbl } from "@/components/ui";
import type { Recipe } from "@/data/grammar/recipes";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { entryId } from "@/lib/fact-id";
import { hasKanji } from "@/lib/romaji";
import { resolveHrefs } from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";
import type { EntryId } from "@/types";

// SAK-104: patternEntry (library-index.ts) is a pure re-export of
// `entryId(GRAMMAR_SUBJECT, recipeId)` — no dictionary read at all, just
// bundled inside a guarded file. Rebuilt here off the same unguarded pieces
// (data/grammar/index.ts's own GRAMMAR_SUBJECT, fact-id.ts's entryId) so this
// table doesn't need a round trip just to mint the id; only entryHref's own
// source-data-backed slug lookup (below) needs one.
function patternEntry(recipeId: string): EntryId {
  return entryId(GRAMMAR_SUBJECT, recipeId);
}

/** One family member's built form plus its reading, when the build has one
 * (SAK-33) — see BuiltRow.builtReading in lib/grammar/build.ts. Exported so
 * grammar-entry-view.tsx's fetched/live payload types stay this component's
 * one definition rather than a second, independently-typed copy. */
export interface FamilyBuild {
  readonly built: string;
  readonly reading?: string;
}

/**
 * `built`'s reading (SAK-33) is one flat string for the whole form, not a
 * per-kanji breakdown — there is no per-character align data here, unlike
 * `VocabRow.align`/`kr`. The conjugated ending is already written in kana in
 * BOTH `built` and `reading` (apply()/applyWrap() spell it the same way
 * regardless of which script drove the build), so it is also their longest
 * common SUFFIX: trimming it off both strings leaves exactly the kanji-bearing
 * host on one side and its reading on the other, with no tokenizer needed.
 * 行かなければならない / いかなければならない -> head "行", reading "い", kana
 * "かなければならない". Returns null when nothing kanji-bearing is left after
 * the trim (nothing to put a ruby over) or the trim would leave the reading
 * side empty (an "on"-slot reading that doesn't actually align with `built`
 * shouldn't render at all — same "absent, not wrong" refusal `builtReading`
 * itself already makes at the source).
 */
function splitBuiltReading(
  built: string,
  reading: string,
): { readonly head: string; readonly kana: string; readonly headReading: string } | null {
  let i = built.length;
  let j = reading.length;
  while (i > 0 && j > 0 && built[i - 1] === reading[j - 1]) {
    i--;
    j--;
  }
  const head = built.slice(0, i);
  const headReading = reading.slice(0, j);
  if (!head || !headReading || !hasKanji(head)) return null;
  return { head, kana: built.slice(i), headReading };
}

/** The build cell's content: the built form with its reading as real ruby
 * furigana over just the kanji-bearing head, the same convention SAK-95
 * established for word-page example sentences — not the muted parenthetical
 * this table used before. Falls back to the bare built form when there's no
 * reading to show, or the split above finds nothing kanji-bearing to annotate. */
function renderBuild(build: FamilyBuild | undefined): React.ReactNode {
  if (!build?.built) return "";
  const split = build.reading ? splitBuiltReading(build.built, build.reading) : null;
  if (!split) return build.built;
  return (
    <>
      <ruby>
        {split.head}
        <rt className="text-[10px] text-text-muted">{split.headReading}</rt>
      </ruby>
      {split.kana}
    </>
  );
}

export function PatternFamily({
  members,
  current,
  feel,
  builtById,
}: {
  members: readonly Recipe[];
  /** The recipe whose page this is. Marked, not filtered out: a family with the
   * member you are reading about missing is not that family. */
  current: Recipe;
  /** The family's `feel` note — how the members differ, so the reader knows which
   * to reach for. Shown under the table. */
  feel?: string;
  /** Exact buildRow output, computed by the seed/live adapter. */
  builtById: Readonly<Record<string, FamilyBuild>>;
}) {
  const entryIds = members.map((r) => patternEntry(r.id));
  const hrefs = useServerLookup(resolveHrefs, [entryIds]) ?? {};
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
              <th className="py-1.5 font-medium">What it means</th>
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
              const here = r.id === current.id;
              const build = builtById[r.id];
              return (
                <tr key={r.id} className="border-b border-border last:border-b-0">
                  <td className="whitespace-nowrap py-2 pr-2 align-middle font-kana text-[15px]">
                    {here ? (
                      <span className="text-accent">{r.pattern}</span>
                    ) : (
                      <Link
                        href={hrefs[patternEntry(r.id) as unknown as string] ?? "#"}
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
                  <td className="whitespace-nowrap py-2 pr-2 align-middle font-kana text-text">
                    {renderBuild(build)}
                  </td>
                  {/* THE REPETITION IS THE CONTENT. Seven rows reading "must do
                      X" is not something to dedupe with a rowspan: English has
                      one word for seven Japanese patterns, and a reader who
                      gets to the bottom of this column and thinks "wait, these
                      are all the same?" has learned the thing the table is for. */}
                  <td className="py-2 align-middle">{r.gloss}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* How to choose. `feel` is authored per FAMILY — it describes how the
          members differ, so on a member's page it can lead with a sibling rather
          than the pattern you are reading about (on 〜かもしれない it opens on
          〜そう). Shown anyway, and framed as a family note ("Which one?"),
          because a reader who has just been handed a table of near-synonyms is
          exactly the one asking which to use — the same question the cluster
          page answers. Where the answer is really a matter of exposure, the
          authored `feel` says so; the component stays generic. */}
      {feel ? (
        <div className="mt-4">
          <Lbl>Which one?</Lbl>
          <p className="text-[13px] leading-relaxed text-text-muted">{feel}</p>
        </div>
      ) : null}
    </Card>
  );
}
