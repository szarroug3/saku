"use client";

// A jargon word, linked to its Library "Terms" definition page.
//
// The quiet way out of a word the app used before it defined it: "keigo",
// "okurigana", "pitch accent". It is the same internal-link idiom the rest of
// the Library uses — accent colour, no underline until hover — so it reads as a
// link without turning a learner-facing surface into a sea of blue. `children`
// is the visible word (usually the term-word itself, made the link), never a new
// sentence; the copy around it is left exactly as it was.
//
// SAK-104: termHref resolves through the server-only href.ts/library-index.ts,
// so this fetches the href instead of importing it. Renders no link (children
// as bare text) while loading — the term ids are fixed at call sites, so the
// fetch settles on first paint's next tick in practice.

import Link from "next/link";
import type { ReactNode } from "react";

import { getTermHref } from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";

export function TermLink({
  id,
  children,
  className,
}: {
  /** A Terms glossary id — "pitch-accent", "keigo", "counter", "okurigana". */
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const href = useServerLookup(getTermHref, [id]);
  if (!href) return <>{children}</>;
  return (
    <Link
      href={href}
      className={className ?? "text-accent no-underline hover:underline"}
    >
      {children}
    </Link>
  );
}
