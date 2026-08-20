"use client";

// SAK-104: entryHref(id) reads from the server-only href.ts (which reads the
// full library index), so this is the one place client code resolves an
// entry's URL — a tiny wrapper around a Server Action fetch instead of the
// import. Every call site that used to do `<Link href={entryHref(id)}>` now
// does `<EntryLink id={id}>` with the same children/className. Renders a plain
// (non-link) span with the same children while the href resolves — a one-tick
// gap on first paint, same as the rest of this app's fetch-by-id content.

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

import { getEntryHref } from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";
import type { EntryId } from "@/types";

export function EntryLink({
  id,
  className,
  onClick,
  ariaLabel,
  children,
}: {
  id: EntryId;
  className?: string;
  onClick?: (e: MouseEvent) => void;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const href = useServerLookup(getEntryHref, [id]);
  if (!href) return <span className={className}>{children}</span>;
  return (
    <Link href={href} className={className} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
