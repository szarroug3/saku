// The entry page is a Client Component, which cannot export `generateMetadata`.
// This segment layout resolves the entry the same way the page does and names
// the tab after it, so it reads "Saku · 生" (composed through the root template
// in src/app/layout.tsx). A URL that resolves to nothing sets no fragment and
// falls back to the bare app name — the page itself 404s.
import type { ReactNode } from "react";
import type { Metadata } from "next";

import { libEntry } from "@/lib/library/library-index";
import { entryFromParam, entryFromSlug } from "@/lib/library/href";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ entry: string[] }>;
}): Promise<Metadata> {
  const { entry: path } = await params;
  const id =
    path.length === 2 ? entryFromSlug(path[0], path[1]) : entryFromParam(path[0] ?? "");
  const entry = id ? libEntry(id) : undefined;
  const label = entry?.name || entry?.glyph;
  return label ? { title: label } : {};
}

export default function EntryLayout({ children }: { children: ReactNode }) {
  return children;
}
