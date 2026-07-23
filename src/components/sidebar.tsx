"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useHistory } from "@/lib/use-history";
import { useQuizSession } from "@/lib/quiz-session";

// ONE nav item for the reference, and it is not the first one. The user, on
// scope: "the reference should exist as an easy way to look things up, not as
// the product." Library REPLACES "Kana chart" rather than joining it — the chart
// is a shelf in there now (/chart redirects), and two entries pointing into the
// same tab is how a reference starts competing with the drill for the top of the
// page.
//
// GRAMMAR IS NO LONGER ITS OWN TAB. It folded INTO the Library: patterns are
// entries on a Grammar shelf, they surface in search, and the cluster maps (the
// "seven ways to say must" comparison) are reached FROM the Library — a link on
// the Grammar shelf and from each pattern's page. The routes still live at
// /grammar, but nothing in the nav points there any more, because a reference
// with two front doors starts competing with the drill for the top of the page,
// which is the same argument that keeps Library itself down here.
const NAV: Array<{ href: string; label: ReactNode }> = [
  { href: "/", label: "Home" },
  // Practice owns the open-ended drill builder that used to live on Home: pick a
  // pool and how to ask, then start. Home stays the curriculum feed; Practice is
  // where you drill what you choose. It sits right under Home because building a
  // drill is a top-level verb, not a corner of the reference.
  { href: "/practice", label: "Practice" },
  { href: "/library", label: "Library" },
  { href: "/lists", label: "Lists" },
  // "Recent sessions" is NOT in this static list. It rides directly under Home
  // (see the assembly in Sidebar), shown only when there is finished history to
  // open — a permanent nav slot pointing at "No sessions yet" is a door onto an
  // empty room.
  // "Progress", not "Statistics" — the page stopped being statistics. Nothing
  // on it is a rate, an average or a trend any more; it is three counts of
  // things you own. The route is still /stats and deliberately so: renaming it
  // would break every link anyone has, to buy a tidier URL nobody reads.
  { href: "/stats", label: "Progress" },
  { href: "/settings", label: "Settings" },
  // The credits/attributions page — where the data, the stroke-order glyphs,
  // and the guides the app learned from are named. A courtesy list, not a
  // licence obligation (that is "About the data" below, which the EDRDG licence
  // requires by name); this one exists so the sources have a home in the chrome.
  { href: "/resources", label: "Resources" },
  // A LICENCE OBLIGATION, not a courtesy link — see attribution-link.tsx.
  // facts.ts is imported by the quiz, session, results and stats screens, so
  // KANJIDIC2 readings, JMdict glosses and Tatoeba sentences render on all of
  // them. EDRDG requires the acknowledgement on each screen that shows the data
  // OR reachable from it, and names a menu item as its own example. The Library
  // pages carry an in-chrome link; every other screen was relying on nothing.
  // This entry is what makes them compliant, and it is the whole fix: it is a
  // menu item, NOT per-screen attribution.
  { href: "/about/data", label: "About the data" },
];

export function Sidebar() {
  const pathname = usePathname();
  // Finished quizzes, for the "Recent sessions" entry. It rides directly under
  // Home and appears ONLY when there is history to open — starts empty (matching
  // the server render), so it simply fades in once the history loads and there
  // is a session in it, with no hydration mismatch.
  //
  // "Current sessions" (runs IN PROGRESS) is a SEPARATE, conditional entry under
  // Practice — see below. It is the door to the page that lists every run you
  // have going so you can continue or discard any of them; it appears only while
  // at least one run is live, so it too never points at an empty room.
  const { history } = useHistory();
  const { runs } = useQuizSession();
  const hasRecent = history.sessions.length > 0;
  const runCount = runs.length;

  // The nav, assembled top-down: Home, then Recent sessions when there is any
  // history to open, then Practice, then Current sessions when at least one run
  // is in progress, then the rest of the static list.
  const items: Array<{ href: string; label: ReactNode }> = [
    NAV[0],
    ...(hasRecent ? [{ href: "/sessions", label: "Recent sessions" }] : []),
    NAV[1],
    ...(runCount > 0
      ? [
          {
            href: "/current",
            label: (
              <span className="flex w-full items-baseline justify-between gap-2">
                <span>Current sessions</span>
                <span className="tabular-nums text-xs text-text-muted">
                  {runCount}
                </span>
              </span>
            ),
          },
        ]
      : []),
    ...NAV.slice(2),
  ];

  // The auth pages (sign-in and the magic-link callback) are shown to a
  // signed-out visitor and carry their own centered layout with the logo — no
  // nav belongs there, and a second wordmark reads as a mistake. Render nothing.
  // Placed after the hooks above so their call order stays unconditional.
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) return null;

  return (
    <nav className="sticky top-6 flex w-[148px] flex-none flex-col gap-0.5 self-start">
      {/* The brand sits above the nav, linking home like a logo should. The
          wordmark is a transparent PNG, so it takes the sidebar's own width and
          the theme background shows through. */}
      <Link href="/" className="mb-2 block px-3 py-1">
        <img
          src="/brand/saku-wordmark.png"
          alt="Saku"
          width={96}
          height={96}
          className="h-auto w-24"
        />
      </Link>
      {items.map(({ href, label }) => {
        // An entry page is IN the Library, so /library/kanji%3A%E7%94%9F has to
        // light the Library item — an exact match would leave the whole nav
        // unlit on the one screen you reach by clicking a link on the previous
        // one. The prefix guard is `href + "/"` and not `startsWith(href)`,
        // which for "/" would match every page in the app.
        const sel = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            // flex + whitespace-nowrap on every item: the width is fixed at
            // w-[148px], the labels are short and already fit, and keeping one
            // layout rule for the whole nav is one fewer thing to rediscover
            // when the next item gets a badge or a count.
            className={`flex items-baseline whitespace-nowrap rounded-lg px-3 py-[9px] text-left text-sm ${
              sel ? "bg-accent-bg text-accent" : "text-text-muted hover:bg-panel"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
