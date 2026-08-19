"use client";

// One kanji primitive — a shape with no meaning, reading, or facts of its own.
// These are the components KanjiVG records that are neither jōyō kanji nor
// Kangxi radicals: bound forms (亻, 氵, 艹) whose original IS a kanji or
// radical are already resolved to that entry; what remains here (𠂊, ⺕, 彑)
// are shapes that exist only as parts, with nothing the app can say about them
// except what they appear in.
//
// WHY THIS IS /library/primitive AND NOT A SIXTH LibEntry Kind
// ============================================================
// A Kind buys its members facts, scoring, scheduling, shelf filters and a stats
// row — all machinery for things that can be ASKED. A primitive has no facts by
// construction, so the library machinery would be twelve null arms saying "not
// this one". The route is a simple page that says what the shape is worth and
// nothing more, exactly like /grammar/[cluster] for grammar concepts.

import Link from "next/link";
import { notFound } from "next/navigation";
import { use } from "react";

import { ComponentUses } from "@/components/library/component-uses";
import { EntryHeader } from "@/components/library/entry-header";
import { EntryLinks } from "@/components/library/entry-links";
import { Card } from "@/components/ui";
import { isPrimitive, primitiveStrokes } from "@/data/components";
import { glyphFromParam } from "@/lib/library/href";
import { useHistory } from "@/lib/use-history";

export default function PrimitivePage({
  params,
}: {
  params: Promise<{ glyph: string }>;
}) {
  const { glyph: param } = use(params);
  const glyph = glyphFromParam(param);
  if (!isPrimitive(glyph) || glyph.startsWith("CDP-")) notFound();
  return <PrimitiveView glyph={glyph} />;
}

function PrimitiveView({ glyph }: { glyph: string }) {
  const { history } = useHistory();
  const strokes = primitiveStrokes(glyph);

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
