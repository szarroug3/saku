// A jargon word, linked to its Library "Terms" definition page.
//
// The quiet way out of a word the app used before it defined it: "keigo",
// "okurigana", "pitch accent". It is the same internal-link idiom the rest of
// the Library uses — accent colour, no underline until hover — so it reads as a
// link without turning a learner-facing surface into a sea of blue. `children`
// is the visible word (usually the term-word itself, made the link), never a new
// sentence; the copy around it is left exactly as it was.

import Link from "next/link";
import type { ReactNode } from "react";

import { termHref } from "@/lib/library/term-href";

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
  return (
    <Link
      href={termHref(id)}
      className={className ?? "text-accent no-underline hover:underline"}
    >
      {children}
    </Link>
  );
}
