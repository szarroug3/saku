// The primitive page is a Client Component, which cannot export
// `generateMetadata`. This segment layout resolves the glyph the same way the
// page does and names the tab after it, so it reads "Saku · 氵" (composed
// through the root template in src/app/layout.tsx). A URL that is not a real
// primitive sets no fragment and falls back to the bare app name — the page 404s.
import type { ReactNode } from "react";
import type { Metadata } from "next";

import { isPrimitive } from "@/data/components";
import { glyphFromParam } from "@/lib/library/href";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ glyph: string }>;
}): Promise<Metadata> {
  const { glyph: param } = await params;
  const glyph = glyphFromParam(param);
  return isPrimitive(glyph) && !glyph.startsWith("CDP-") ? { title: glyph } : {};
}

export default function PrimitiveLayout({ children }: { children: ReactNode }) {
  return children;
}
