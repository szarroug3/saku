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
      <ul className="flex flex-col gap-1.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-[14px] text-accent underline decoration-transparent underline-offset-2 transition-colors hover:decoration-accent"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
