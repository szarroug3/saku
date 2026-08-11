"use client";

// A "Related" list of links at the foot of a Library entry page — the genuine
// neighbours of the thing you are looking at (the pieces a kanji is built from,
// the other half of a pair). It is a shared block so every page type can grow one
// off its own data; right now the term pages feed it (see Term.related). Each
// link points at another entry's Library page via the shared entryHref.

import Link from "next/link";

import { Section } from "@/components/library/entry-section";

export interface RelatedLink {
  label: string;
  href: string;
}

export function RelatedSection({ links }: { links: readonly RelatedLink[] }) {
  if (links.length === 0) return null;
  return (
    <Section title="Related">
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full border border-border/60 px-3 py-1 text-[13px] text-text-muted transition-colors hover:border-accent/60 hover:text-text"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </Section>
  );
}
