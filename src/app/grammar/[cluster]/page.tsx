// One cluster, laid out side by side. A MAP, NOT A QUIZ.
//
// The seven ways to say "must", the four ways to say "if", all glossed
// identically because in English they ARE identical. The page shows what each
// one is, how it is built, and what it means — and then it stops, because the
// next thing it could say is which one to pick, and that is the judgement the
// app has agreed not to teach:
//
//   "i don't need the app to teach me judgement. i need it to give me the
//    skills to make judgement calls. the judgement part comes from experience."
//
// A Server Component, and it can be: CLUSTERS and RECIPES are constants, the
// conjugation engine is pure, and there is no state on this screen. Nothing
// here needs the client, so nothing here ships to it.
//
// IT WEARS THE LIBRARY'S CLOTHES
// ==============================
// A glyph slot, a title and a sub line in a header card; a wide card paired with
// a narrow Links card; the same 1.45fr/1fr row that collapses at 860px. This is
// a redesign into the Library's entry page and not a merge into it, because a
// cluster is not an entry: it has no facts, no standing and nothing to
// pronounce, and every one of those is a column the entry page is built around.
// What it borrows is the ARRANGEMENT, so a reader who has opened a kanji knows
// where to look. See cluster-header.tsx and cluster-links.tsx for the seams.
//
// THERE IS NO JLPT LEVEL HERE EITHER, and it is the same decision the entry page
// argues at length: the level orders the curriculum internally, a learner cannot
// act on "N4", and three vendors disagree about it by 3.4x. The sub line says
// what the family MEANS instead.
//
// WHY /grammar/obligation AND NOT /grammar/must
// =============================================
// The plate mocks the URL as /grammar/must — the cluster's TITLE. The title is
// display text: "は vs が" is a title, and it is not going in a path. The id is
// the stable handle (recipes.ts: "Stable id. Never parsed"), it is ASCII by
// construction, and so this route sidesteps the decoding bug that 404'd every
// library entry page — see the note in src/lib/library/href.ts. There is
// nothing to decode because there is nothing encoded.

import { notFound } from "next/navigation";
import Link from "next/link";

import { ClusterHeader } from "@/components/grammar/cluster-header";
import { ClusterLinks } from "@/components/grammar/cluster-links";
import { ClusterTable } from "@/components/grammar/cluster-table";
import { Lbl } from "@/components/ui";
import { CLUSTERS, cluster, membersOf } from "@/data/grammar/clusters";
import { buildRows } from "@/lib/grammar/build";
import { glyphLines } from "@/lib/grammar/cluster-view";

export function generateStaticParams() {
  return CLUSTERS.map((c) => ({ cluster: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cluster: string }>;
}) {
  const c = cluster((await params).cluster);
  return { title: c ? `${c.title} · Saku` : "Saku" };
}

export default async function ClusterPage({
  params,
}: {
  params: Promise<{ cluster: string }>;
}) {
  // A URL can say anything. `cluster()` is a Map lookup and answers undefined
  // for a stranger, so a typo is a 404 rather than an empty page.
  const c = cluster((await params).cluster);
  if (!c) notFound();

  const members = membersOf(c);
  const rows = buildRows(members);
  const lines = glyphLines(c, members);

  return (
    <>
      <p className="mb-3 text-[11.5px] text-text-muted">
        <Link
          href="/library?kind=grammar"
          className="text-text-muted no-underline hover:text-text"
        >
          Grammar
        </Link>{" "}
        › {c.title}
      </p>

      {/* De-boxed, like the Library entry pages: the header sits on the mesh over
          a hairline, then each part is a plain section — no Cards, single column.
          The glyph slot is EMPTY on the three biggest clusters, the honest answer
          rather than a gap (glyphLines in lib/grammar/cluster-view.ts). */}
      <ClusterHeader lines={lines} title={c.title} sub={c.gloss} />

      <div className="mt-5 border-t border-white/[0.08]" aria-hidden />

      {rows.length > 0 ? (
        <section className="mt-6">
          <Lbl>Forms grouped by what they attach to</Lbl>
          <ClusterTable rows={rows} />
        </section>
      ) : null}

      {/* The feel note — shown, never asked, never scored (clusters.ts keeps that
          fence). A plain paragraph now, not a boxed aside; on the map-only
          clusters (は/が, に/で, 開ける/開く) it is the whole content. */}
      {c.feel ? (
        <p className="mt-6 max-w-prose text-[13px] leading-relaxed text-text-muted">
          {c.feel}
        </p>
      ) : null}

      {c.link ? (
        <section className="mt-6">
          <ClusterLinks link={c.link} />
        </section>
      ) : null}
    </>
  );
}
