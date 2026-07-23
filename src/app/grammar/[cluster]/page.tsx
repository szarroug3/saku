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
import { Card, Lbl } from "@/components/ui";
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

  // The paired row, spelled once. The Forms table takes the wider half exactly
  // where a kanji puts its strokes and a pattern its recipe; Links takes the
  // narrow one. Below 860px the grid is one column, so each item is its own row
  // and stretching means nothing — heights go back to content. The Card's own
  // `mb-3.5` is zeroed inside the grid, or a stretched item would end short of
  // its neighbour.
  const PAIR =
    "mb-3.5 grid grid-cols-[1.45fr_1fr] gap-3.5 max-[860px]:grid-cols-1 [&>*]:mb-0 [&>*]:h-full";

  // "Forms grouped by what they attach to" — a DESCRIPTION of the table, which
  // is the one thing a label over it can be without risking being wrong. It used
  // to spell a count ("The seven") and then the words the rows were built on,
  // and both were claims: `seems` has six members and thirteen rows, so that
  // page announced "The six" over thirteen lines, and the "built on 行く · 高い ·
  // 静か · 本" half was a list the table now says properly, once per group, in
  // the row that is actually about that word.
  const forms = (
    <Card>
      <Lbl>Forms grouped by what they attach to</Lbl>
      <ClusterTable rows={rows} />
    </Card>
  );

  // THE FEEL NOTE HAS NO LABEL ANY MORE. It used to carry "Feel · shown, never
  // asked, never scored", which was the app explaining its own scoring model to
  // a reader who had not asked and could not act on it. The fence is real and it
  // is still enforced — nothing here reaches the scheduler, and clusters.ts says
  // so at length — it has simply stopped being announced on screen. A note reads
  // as a note.
  const feel = c.feel ? (
    <Card>
      <p className="text-[13px] leading-relaxed text-text-muted">{c.feel}</p>
    </Card>
  ) : null;

  return (
    <>
      <p className="mb-3 text-[11.5px] text-text-muted">
        <Link href="/grammar" className="text-text-muted no-underline hover:text-text">
          Grammar
        </Link>{" "}
        › {c.title}
      </p>

      <Card>
        {/* The glyph slot is filled from the members' own `pattern` strings and
            is EMPTY on the three biggest clusters, which is the honest answer
            rather than a gap. See glyphLines in lib/grammar/cluster-view.ts. */}
        <ClusterHeader lines={lines} title={c.title} sub={c.gloss} />
      </Card>

      {/* NO LINK, NO ROW AND NO CARD. The link slot used to render even when
          empty, showing a "No link" chip and the cluster's `noLinkReason`. 7 of
          the 12 clusters have no link, so that message was on most of the shelf,
          and a notice that appears almost everywhere is furniture rather than a
          finding. It is gone from the screen; the reason strings stay in
          clusters.ts as data. See that file's header.

          Which is why there are three arrangements and not one. With a table and
          a link, they pair. With a table and no link, the table is the page and
          takes the width — an empty right-hand column would be the absence drawn
          in negative space, which is the same message in a different font. */}
      {rows.length > 0 ? (
        c.link ? (
          <div className={PAIR}>
            {forms}
            <ClusterLinks link={c.link} />
          </div>
        ) : (
          forms
        )
      ) : null}

      {/* THE MAP-ONLY CLUSTERS — は/が, に/で, 開ける/開く — have no table, because
          they are not built from recipes at all: they are choices between two
          particles in a frame, which is exactly the thing this app has proven it
          must not quiz. On those three the feel note IS the content, so it pairs
          with the Links card in the same row the table would have had. A single
          paragraph alone on a page under a header reads as a page that failed to
          load; beside the link it reads as what it is, which is a short honest
          answer and a pointer at someone who writes prose for a living. */}
      {rows.length === 0 && feel && c.link ? (
        <div className={PAIR}>
          {feel}
          <ClusterLinks link={c.link} />
        </div>
      ) : (
        <>
          {feel}
          {rows.length === 0 && c.link ? <ClusterLinks link={c.link} /> : null}
        </>
      )}
    </>
  );
}
