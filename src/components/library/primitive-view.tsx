"use client";

// The interactive half of /library/primitive/[glyph] — split out of the route's
// page.tsx (SAK-104) so the glyph/strokes resolution (isPrimitive,
// primitiveStrokes, glyphFromParam) runs server-side and this component only
// ever receives the already-resolved, already-validated glyph + stroke count as
// props. useHistory is the one reason this stays a Client Component.

import Link from "next/link";

import { ComponentUses } from "@/components/library/component-uses";
import { EntryHeader } from "@/components/library/entry-header";
import { EntryLinks } from "@/components/library/entry-links";
import { Card } from "@/components/ui";
import { useHistory } from "@/lib/use-history";

export function PrimitiveView({
  glyph,
  strokes,
}: {
  glyph: string;
  strokes: number | undefined;
}) {
  const { history } = useHistory();

  return (
    <>
      <p className="mb-3 text-[11.5px] text-text-muted">
        <Link href="/library" className="text-text-muted no-underline hover:text-text">
          Library
        </Link>
        {" › Primitive › "}
        {glyph}
      </p>

      <Card>
        <EntryHeader
          glyph={glyph}
          title="Kanji part"
          sub={strokes === 1 ? "1 stroke" : `${strokes ?? "?"} strokes`}
        />
        <p className="m-0 mt-1 text-[13px] leading-relaxed text-text-muted">
          This is a kanji part, not a character. It has no meaning or sound of its
          own.
        </p>
      </Card>

      {/* ComponentUses can render nothing (a shape used in no kanji) and
          EntryLinks always renders — each gets its own divider prop rather
          than a divider wrapped around the call here, so a hairline never
          appears over an empty ComponentUses. */}
      <ComponentUses component={glyph} history={history} divider />

      <EntryLinks mixups={{ confused: [], lookalike: [] }} divider />
    </>
  );
}
