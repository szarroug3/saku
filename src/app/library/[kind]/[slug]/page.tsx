"use client";

import { notFound } from "next/navigation";
import { use } from "react";

import EntryPage from "@/app/library/[entry]/page";
import { entryFromSlug } from "@/lib/library/href";

export default function EntrySlugPage({
  params,
}: {
  params: Promise<{ kind: string; slug: string }>;
}) {
  const { kind, slug } = use(params);
  const id = entryFromSlug(kind, slug);
  if (!id) notFound();
  return <EntryPage params={Promise.resolve({ entry: id })} />;
}
