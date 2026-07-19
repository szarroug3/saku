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

import { ClusterTable } from "@/components/grammar/cluster-table";
import { LinkSlot } from "@/components/grammar/link-slot";
import { Card, Lbl, PageTitle } from "@/components/ui";
import { CLUSTERS, cluster, membersOf } from "@/data/grammar/clusters";
import { buildRows, wordsUsed } from "@/lib/grammar/build";

export function generateStaticParams() {
  return CLUSTERS.map((c) => ({ cluster: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cluster: string }>;
}) {
  const c = cluster((await params).cluster);
  return { title: c ? `${c.title} · Kana quiz` : "Kana quiz" };
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

  const rows = buildRows(membersOf(c));
  const on = wordsUsed(rows);

  return (
    <>
      <p className="mb-3 text-[11.5px] text-text-muted">
        <Link href="/grammar" className="text-text-muted no-underline hover:text-text">
          Grammar
        </Link>{" "}
        › {c.title}
      </p>

      <PageTitle title={c.title} sub={c.gloss} />

      {rows.length > 0 ? (
        <Card>
          {/* "Forms", not a count. The label used to spell the number of
              PATTERNS ("The seven"), which read as a promise about the table
              underneath it and was not one: `seems` has six members and
              thirteen rows, so that page printed "The six" above thirteen
              lines. A fixed noun cannot be wrong. The "built on" half IS
              generated from the rows and stays. */}
          <Lbl>Forms · built on {on.join(" · ")}</Lbl>
          <ClusterTable rows={rows} />
        </Card>
      ) : null}

      {/* THE LABEL IS THE FEATURE. Not decoration, not hedging — the app's
          entire scope rests on the promise it makes, and a promise the user
          cannot see is not one. See clusters.ts. */}
      {c.feel ? (
        <Card>
          <Lbl>Feel · shown, never asked, never scored</Lbl>
          <p className="text-[13px] leading-relaxed text-text-muted">{c.feel}</p>
        </Card>
      ) : null}

      {/* NO LINK, NO CARD. This slot used to render even when empty, showing a
          "No link" chip and the cluster's `noLinkReason`. 7 of the 12 clusters
          have no link, so that message was on most of the shelf. It is gone
          from the screen; the reason strings stay in clusters.ts as data. See
          that file's header. */}
      {c.link ? (
        <Card>
          <Lbl>If you want the difference explained</Lbl>
          <LinkSlot link={c.link} />
        </Card>
      ) : null}
    </>
  );
}
