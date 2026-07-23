// Grammar — the clusters index.
//
// A list of families, each of which collapses onto one English word. It is a
// contents page for a reference, which is the only reason it is allowed to
// exist: the rule is that a screen showing you answers does not get to ask the
// questions, and this one never asks. You come here on purpose, looking
// something up. Nothing routes you here mid-drill with the answer already on it.
//
// The rows carry NO preview of the members and no ordering by how you are
// doing. A cluster is a door, and what is behind it is the map.
//
// A Server Component: CLUSTERS is a constant and this screen has no state.

import Link from "next/link";

import { Card, Lbl, PageTitle } from "@/components/ui";
import { CLUSTERS, membersOf } from "@/data/grammar/clusters";

export const metadata = { title: "Grammar · Saku" };

export default function GrammarPage() {
  return (
    <>
      <PageTitle
        title="Grammar"
        sub="Families that come out as the same English. What each one is, how it's built, what it means."
      />

      <Card>
        <Lbl>Clusters</Lbl>
        {CLUSTERS.map((c) => {
          const n = membersOf(c).length;
          return (
            <Link
              key={c.id}
              href={`/grammar/${c.id}`}
              className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 border-t border-border py-3 no-underline first:border-t-0 first:pt-0"
            >
              <span className="text-[13px] font-semibold text-text">{c.title}</span>
              <span className="flex-1 text-[13px] text-text-muted">{c.gloss}</span>
              {/* The count is of MEMBERS, and the map-only clusters have none —
                  は/が is a pair of particles in a frame, not a pair of recipes.
                  A "0" on those rows would read as an empty page rather than as
                  a different kind of page, so the count simply isn't there. */}
              {n > 0 ? (
                <span className="flex-none text-[11px] tabular-nums text-text-muted">{n}</span>
              ) : null}
            </Link>
          );
        })}
      </Card>
    </>
  );
}
