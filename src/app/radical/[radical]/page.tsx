"use client";

// One radical primitive, and an honest page about a shape we know almost
// nothing about.
//
// WHY THIS IS A ROUTE AND NOT A SIXTH `Kind`
// =========================================
// Every member of every existing Kind exists in order to be ASKED. A Kind buys
// its members a subject constant, arms in KINDS/KIND_LABEL, arms in libEntry /
// factsOf / factRows / factsTitle / entryStanding, a shelf section, a filter
// chip, a selection counter and a stats row — and all of that machinery is
// about facts, scoring and scheduling. A primitive has NO facts by construction:
// there is no meaning to ask for, no reading to ask for, and the app has already
// ruled that raw KRADFILE parts are unreliable for teaching, so it must never
// ask. A sixth Kind would have been ten null arms saying "not this one", which
// is a type declaring that its own members are not really members.
//
// So this is /radical/ノ, next door to /grammar/[cluster], which made the same
// call for the same reason ("a cluster is not an entry: it has no facts, no
// standing and nothing to pronounce"). It costs one route, one href helper and
// one lookup. It is reachable from the "Made of" row of every kanji that uses
// the shape, which is where a reader meets one.
//
// WHAT IS DELIBERATELY ABSENT
// ===========================
// No standing chip, no facts table, and NO SliceBar at the foot. The bar's whole
// purpose is to file a thing into a list and drill it; a shape that can never be
// asked must not carry a control implying otherwise, and there is no fact id to
// put in a list in the first place.
//
// THE 155 OTHER COMPONENTS DO NOT COME HERE. 木, 日 and 口 are components too,
// and they are also jōyō kanji with a full entry page. They get the same two
// sections ON that page (see library/[entry]/page.tsx) rather than a rival page
// here, because splitting one character across two URLs is worse than either.
// This route 404s for them on purpose.

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useState } from "react";

import { AttributionLink } from "@/components/library/attribution-link";
import { ComponentUses } from "@/components/library/component-uses";
import { EntryHeader } from "@/components/library/entry-header";
import { Card } from "@/components/ui";
import { isPrimitive, primitiveStrokes } from "@/data/components";
import { glyphFromParam } from "@/lib/library/href";
import { useHistory } from "@/lib/use-history";
import { useQuizConfig } from "@/lib/quiz-config";

export default function RadicalPage({
  params,
}: {
  params: Promise<{ radical: string }>;
}) {
  const { radical: param } = use(params);
  const glyph = glyphFromParam(param);
  // A URL can say anything. `isPrimitive` is a Map lookup over the 82, so a
  // typo, a stranger, or one of the 155 components that is really a kanji all
  // land on a 404 rather than on a page about nothing.
  if (!isPrimitive(glyph)) notFound();
  return <RadicalView glyph={glyph} />;
}

function RadicalView({ glyph }: { glyph: string }) {
  const { history } = useHistory();
  const { cfg } = useQuizConfig();
  const [now] = useState(() => Date.now());
  const strokes = primitiveStrokes(glyph);

  return (
    <>
      <p className="mb-3 text-[11.5px] text-text-muted">
        <Link href="/library" className="text-text-muted no-underline hover:text-text">
          Library
        </Link>
        {" › "}
        {glyph}
      </p>

      <Card>
        {/* The title slot cannot hold a meaning, so it holds what the thing IS.
            "Kanji part" and not "radical": several of the 82 are not radicals in
            any dictionary sense — ｜ is a vertical stroke, ノ a diagonal one —
            and calling them radicals on screen would be the page asserting the
            one thing this file exists to avoid. No chips and no sound: there is
            no score and nothing to pronounce. */}
        <EntryHeader
          glyph={glyph}
          title="Kanji part"
          sub={
            strokes === 1 ? "1 stroke" : `${strokes ?? "?"} strokes`
          }
        />
        {/* THE WHOLE POINT OF THE PAGE, in one line and in the reader's words.
            Not "no KANJIDIC2 row", not "our data has no gloss for this" — a
            beginner cannot act on either, and both are the app talking about
            itself. What she needs to know is that there is nothing here to
            learn and she has not missed it.

            IT CARRIED A THIRD SENTENCE for an hour — "worth knowing by sight,
            because it turns up inside a lot of kanji" — and 鬯 caught it on
            screen: that shape is inside exactly ONE of the 2,136, so the page
            was arguing for learning something its own next card refuted. The
            utility argument belongs to the count in "Used as a part in", which
            is measured per shape and is therefore right for all 82. */}
        <p className="m-0 mt-1 text-[13px] leading-relaxed text-text-muted">
          This is a shape, not a character. It has no meaning or sound of its
          own.
        </p>
      </Card>

      <ComponentUses
        component={glyph}
        history={history}
        claims={history.claims ?? {}}
        metric={cfg.accuracyMetric}
        now={now}
      />

      <AttributionLink />
    </>
  );
}
