// Pure helper — no client-only dependencies (no hooks, no browser APIs), so
// it deliberately has no "use client" directive. It's called directly (not
// rendered as JSX) from both a Server Component (/how-it-works) and a Client
// Component (SrsIntro), which only works if this module crosses no RSC
// boundary itself.

import type { ReactNode } from "react";

/**
 * Wrap a fixed set of exact substrings of `text` in `text-accent` spans,
 * leaving everything else (and the wording itself) untouched. Presentation
 * only: it does not rewrite or reorder any copy, only marks a few terms as
 * the visual landmarks of a paragraph the owner asked for ("accent the
 * things that need to stand out" — SAK-27 review). Used by the SRS intro and
 * the How Saku works reference page so both apply the same convention.
 *
 * `terms` are matched literally (regex-escaped), first match only per term,
 * case-sensitive, so pick the exact casing as it appears in the source copy.
 */
export function accentTerms(text: string, terms: readonly string[]): ReactNode {
  if (terms.length === 0) return text;
  const escaped = [...terms]
    .sort((a, b) => b.length - a.length) // longest first, so a term that
    // contains a shorter one (e.g. "spaced repetition (SRS)" vs "SRS") wins.
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "g");
  const seen = new Set<string>();
  return text.split(pattern).map((chunk, i) => {
    if (terms.includes(chunk) && !seen.has(chunk)) {
      seen.add(chunk);
      return (
        <span key={i} className="text-accent">
          {chunk}
        </span>
      );
    }
    return chunk;
  });
}
