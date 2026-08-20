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

import { notFound } from "next/navigation";

import { isPrimitive, primitiveStrokes } from "@/data/components";
import { glyphFromParam } from "@/lib/library/href";
import { PrimitiveView } from "@/components/library/primitive-view";

export default async function PrimitivePage({
  params,
}: {
  params: Promise<{ glyph: string }>;
}) {
  const { glyph: param } = await params;
  const glyph = glyphFromParam(param);
  if (!isPrimitive(glyph) || glyph.startsWith("CDP-")) notFound();
  const strokes = primitiveStrokes(glyph);
  return <PrimitiveView glyph={glyph} strokes={strokes} />;
}
