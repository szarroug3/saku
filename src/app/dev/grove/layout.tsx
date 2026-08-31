"use client";

// Shell for the Grove component gallery. One page per primitive, listed down the
// left, so each new component gets reviewed on its own rather than buried in a
// single long scroll the way /dev/views grew.
//
// Dev-only twice over: the parent src/app/dev/layout.tsx 404s this whole subtree
// in a production build, and the sidebar group is compiled out of the bundle.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Every Grove primitive with a gallery page. Add here when you add a component;
 * this is also what the main sidebar's Grove sub-group mirrors. */
export const GROVE_PAGES: Array<{ href: string; label: string; note: string }> = [
  { href: "/dev/grove", label: "Overview", note: "what this area is and the rules" },
  { href: "/dev/grove/item-card", label: "ItemCard", note: "ghost glyph + English" },
  { href: "/dev/grove/item-section", label: "ItemSection", note: "headers, counts, gates" },
];

export default function GroveGalleryLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="mx-auto max-w-[1180px] px-6 py-8">
      <header className="border-b border-border pb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          Grove
        </div>
        <h1 className="mt-1.5 text-xl font-semibold text-text">Redesign components</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-text-muted">
          The new Nursery / Garden / Quiz / Practice / Library work, built in
          isolation under <code className="text-text">src/grove/</code>. Nothing
          here imports from the current app, and nothing in the current app
          imports from here, so the old surfaces can be deleted wholesale at
          cutover.
        </p>
      </header>

      <div className="mt-6 flex gap-8">
        <nav className="w-[172px] shrink-0">
          <div className="flex flex-col gap-0.5">
            {GROVE_PAGES.map(({ href, label, note }) => {
              const sel = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    sel ? "bg-accent-bg text-accent" : "text-text-muted hover:bg-panel"
                  }`}
                >
                  <span className="block font-medium">{label}</span>
                  <span className="mt-0.5 block text-[11px] opacity-70">{note}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
