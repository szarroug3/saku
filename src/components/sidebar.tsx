"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

import { SignOut } from "@/components/auth/sign-out";

import { useHistory } from "@/lib/use-history";
import { useQuizSession } from "@/lib/quiz-session";

// Persisted as a COOKIE, not localStorage, so the SERVER can read it (see
// layout.tsx) and render the bar at the right width on the very first paint.
// localStorage is client-only, so it would render expanded and then visibly snap
// closed after hydration. New keys use the `saku-` prefix (the older `kanaquiz-`
// keys are a separate rename still pending).
const COLLAPSE_KEY = "saku-sidebar-collapsed";

/** A bare chevron for the collapse/expand toggle — inline so the nav pulls in no
 * icon dependency for its one glyph. */
function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points={dir === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  );
}

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
  // Home is the landing — the intro at /. Learn is the curriculum feed (/learn),
  // its own screen so a signed-out visitor can work through it too (nothing they
  // do there is saved, which the banner says). Signed in, / redirects to /learn.
  { href: "/", label: "Home" },
  { href: "/learn", label: "Learn" },
  // Practice owns the open-ended drill builder that used to live on Home: pick a
  // pool and how to ask, then start. Learn is the curriculum feed; Practice is
  // where you drill what you choose. It sits up top because building a drill is a
  // top-level verb, not a corner of the reference.
  { href: "/practice", label: "Practice" },
  // "Progress", not "Statistics" — the page stopped being statistics. Nothing
  // on it is a rate, an average or a trend any more; it is three counts of
  // things you own. The route is still /stats and deliberately so: renaming it
  // would break every link anyone has, to buy a tidier URL nobody reads.
  { href: "/stats", label: "Progress" },
  { href: "/library", label: "Library" },
  { href: "/lists", label: "Lists" },
  // "Recent sessions" is NOT in this static list. It rides directly under Learn
  // (see the assembly in Sidebar), shown only when there is finished history to
  // open — a permanent nav slot pointing at "No sessions yet" is a door onto an
  // empty room.
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

export function Sidebar({
  signedIn,
  authEnabled,
  initialCollapsed,
}: {
  /** Whether there is a session (always true in file mode). Decides Sign in vs
   * Sign out, and hides the nav on the signed-out landing at /. */
  signedIn: boolean;
  /** Whether auth is on at all (Supabase mode). In file mode there's no session
   * to end, so no auth control shows. */
  authEnabled: boolean;
  /** The collapsed state the server read from the cookie, so the first render is
   * already the right width — no expanded-then-snap-closed flash. */
  initialCollapsed: boolean;
}) {
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

  // Collapsed shrinks the bar to a thin rail so the page gets the width back.
  // Seeded from the server's cookie read, so the first paint is already correct.
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      // Write the cookie the server reads next load. One year, lax; path=/ so it
      // covers every route.
      document.cookie = `${COLLAPSE_KEY}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }

  // The nav, assembled top-down: Home, Learn, then Recent sessions when there is
  // any history to open, then Practice, then Current sessions when at least one
  // run is in progress, then the rest of the static list.
  const items: Array<{ href: string; label: ReactNode }> = [
    NAV[0],
    NAV[1],
    ...(hasRecent ? [{ href: "/sessions", label: "Recent sessions" }] : []),
    NAV[2],
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
    ...NAV.slice(3),
  ];

  // Only the OAuth callback (/auth) hides the nav — it's a redirect route with no
  // real UI. Everywhere else the nav shows, including the landing and the sign-in
  // page: the app is browsable signed out, so a visitor reading the Library, or
  // sitting on the login screen, still needs to get around. Placed after the
  // hooks above so their call order stays unconditional.
  if (pathname.startsWith("/auth")) return null;

  // Collapsed: a thin rail that is nothing but the way back out. Main content
  // (flex-1 in the layout) takes the freed width automatically.
  if (collapsed) {
    return (
      <nav className="sticky top-6 flex w-7 flex-none flex-col items-center self-start">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="Expand sidebar"
          aria-expanded={false}
          title="Expand"
          className="rounded-lg p-1.5 text-text-muted hover:bg-panel hover:text-text"
        >
          <Chevron dir="right" />
        </button>
      </nav>
    );
  }

  return (
    <nav className="sticky top-6 flex w-[148px] flex-none flex-col gap-0.5 self-start">
      {/* The brand sits above the nav, linking home like a logo should, with the
          collapse toggle beside it. The wordmark is a transparent PNG, so it
          takes the sidebar's own width and the theme background shows through. */}
      {/* alt="" is deliberate: an <img> paints its alt TEXT while the PNG is
          still decoding, so a non-empty alt flashes the word "Saku" on every hard
          reload before the wordmark arrives. The link carries the accessible name
          instead, and the image is decorative. */}
      <div className="mb-2 flex items-center justify-between pr-1">
        <Link href="/" aria-label="Saku — home" className="block px-3 py-1">
          <img
            src="/brand/saku-wordmark.png"
            alt=""
            width={96}
            height={96}
            className="h-auto w-20"
          />
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="Collapse sidebar"
          aria-expanded={true}
          title="Collapse"
          className="flex-none rounded-lg p-1.5 text-text-muted hover:bg-panel hover:text-text"
        >
          <Chevron dir="left" />
        </button>
      </div>
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
      {/* Sign in / out, only when auth is on (Supabase mode). Below the nav, off
          a divider — it belongs to the account, not the curriculum. */}
      {authEnabled ? (
        <div className="mt-2 border-t border-border pt-2">
          {signedIn ? (
            <SignOut />
          ) : (
            <>
              <Link
                href="/login"
                className="flex items-baseline whitespace-nowrap rounded-lg px-3 py-[9px] text-left text-sm text-text-muted hover:bg-panel"
              >
                Sign in
              </Link>
              {/* The heads-up that used to be a page-wide banner over every
                  screen: your work lives in this browser until you sign in. It
                  is a global fact about the account, so it belongs with the
                  global Sign in, not stamped on top of each page. Hidden where
                  the point is already made — the landing and the login page. */}
              {pathname === "/" || pathname.startsWith("/login") ? null : (
                <p className="px-3 pt-1 text-[11px] leading-snug text-text-muted">
                  Your progress is saved in this browser only. Sign in to keep it
                  across your devices.
                </p>
              )}
            </>
          )}
        </div>
      ) : null}
    </nav>
  );
}
