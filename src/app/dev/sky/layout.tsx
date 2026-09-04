"use client";

// Shell for the Sky component gallery. One page per primitive, listed down the
// left, so each new component gets reviewed on its own rather than buried in a
// single long scroll the way /dev/views grew.
//
// Dev-only twice over: the parent src/app/dev/layout.tsx 404s this whole subtree
// in a production build, and the sidebar group is compiled out of the bundle.

import { Karla, Shippori_Mincho } from "next/font/google";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// The Sky's two webfonts, loaded once here and exposed as CSS variables that
// the --sky-font-* tokens in globals.css read (with system fallbacks if these
// are absent). Loading them in the layout means every gallery page, and later
// every Sky route, gets them without importing fonts itself. See SAK-291.
const shipporiMincho = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-shippori-mincho",
  display: "swap",
  preload: false,
});
const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-karla",
  display: "swap",
});

/** Every Sky primitive with a gallery page. Add here when you add a component;
 * this is also what the main sidebar's Sky sub-group mirrors. */
export const SKY_PAGES: Array<{ href: string; label: string; note: string }> = [
  { href: "/dev/sky", label: "Overview", note: "what this area is and the rules" },
  { href: "/dev/sky/tokens", label: "Night tokens", note: "the palette, with contrast" },
  { href: "/dev/sky/wash", label: "The wash", note: "the background, full screen, for tuning" },
  { href: "/dev/sky/standings", label: "Standings", note: "the six words, legend and chips" },
  { href: "/dev/sky/graph", label: "Graph", note: "what needs what, on real words" },
  { href: "/dev/sky/constellations", label: "Constellations", note: "one seeded shape, every screen" },
  { href: "/dev/sky/filters", label: "Filters + coverage", note: "chips with counts, the honest bar" },
  { href: "/dev/sky/item-card", label: "ItemCard", note: "ghost glyph + English" },
  { href: "/dev/sky/item-section", label: "ItemSection", note: "headers, counts, gates" },
];

export default function SkyGalleryLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <main className={`${shipporiMincho.variable} ${karla.variable} mx-auto max-w-[1180px] px-6 py-8`}>
      <header className="border-b border-border pb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          Sky
        </div>
        <h1 className="mt-1.5 text-xl font-semibold text-text">Redesign components</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-text-muted">
          The new Home / Planetarium / Lesson / Quiz / Practice / Atlas work, built in
          isolation under <code className="text-text">src/sky/</code>. Nothing
          here imports from the current app, and nothing in the current app
          imports from here, so the old surfaces can be deleted wholesale at
          cutover.
        </p>
      </header>

      <div className="mt-6 flex gap-8">
        <nav className="w-[172px] shrink-0">
          <div className="flex flex-col gap-0.5">
            {SKY_PAGES.map(({ href, label, note }) => {
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
