"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { SignOut } from "@/components/auth/sign-out";
import { SignedOutNotice } from "@/components/auth/signed-out-notice";
import { Dock } from "@/components/dock";


// Persisted as a COOKIE, not localStorage, so the SERVER can read it (see
// layout.tsx) and render the bar at the right width on the very first paint.
// localStorage is client-only, so it would render expanded and then visibly snap
// closed after hydration. This is a per-device preference and deliberately stays
// local — it is NOT part of the server-synced settings blob (see settings.ts).
const COLLAPSE_KEY = "saku-sidebar-collapsed";

// Below this width the full-width bar squeezes <main> down to ~170px — the
// intro banner alone wraps to two or three words a line. The cookie above is
// a DESKTOP preference (collapsed-or-not at a wide viewport); it says nothing
// about viewport width, so on its own a wide-viewport "expanded" preference
// rendered exactly as-is at 375px. Below the breakpoint the bar collapses
// unconditionally, regardless of that stored preference — see the effect
// below, which is the thing that actually enforces it. 768 matches Tailwind's
// default `md`, the usual phone/small-tablet cutoff.
const MOBILE_BREAKPOINT = 768;

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
  // The Sky's pages, since cutover (2026-09-06). Home is the Planetarium, the
  // learner's own sky; the Observatory is where the next lesson is picked.
  { href: "/", label: "Home" },
  { href: "/observatory", label: "Observatory" },
  { href: "/practice", label: "Practice" },
  { href: "/atlas", label: "Atlas" },
  { href: "/sessions", label: "Sessions" },
  { href: "/settings", label: "Settings" },
  { href: "/account", label: "Account" },
  { href: "/how-it-works", label: "How Saku works" },
  // A LICENCE OBLIGATION, not a courtesy link: EDRDG requires the
  // acknowledgement to be reachable from every screen that shows the data,
  // and names a menu item as its own example. This entry is that.
  { href: "/about", label: "About" },
];

// The development-only reference surfaces (the design gallery, the scheduler view,
// the number playground). Shown in the nav ONLY in a non-production build — the
// same gate the /dev/* route layout enforces (src/app/dev/layout.tsx). NODE_ENV is
// inlined at build time, so the whole section is dead-code-eliminated from the
// shipped bundle.
// `children` makes an entry a sub-folder rather than a link — the Sky redesign
// redesign gets one, so its component galleries group together instead of
// scattering through this flat list as it grows.
const DEV_PAGES: Array<{
  href: string;
  label: string;
  children?: Array<{ href: string; label: string }>;
}> = [
  { href: "/dev/views", label: "Views" },
  { href: "/dev/learn", label: "Learn" },
  { href: "/dev/library", label: "Library" },
  { href: "/dev/scheduling", label: "Scheduling" },
  { href: "/dev/numbers", label: "Numbers" },
  { href: "/dev/swatches", label: "Swatches" },
  { href: "/dev/quiz-gallery", label: "Quiz gallery" },
  { href: "/dev/pitch-accent", label: "Pitch accent" },
];

export function Sidebar({
  signedIn,
  authEnabled,
  initialCollapsed,
  // the layout still counts runs for the old nav; the Sky's has no entry for them
  initialRunCount: _initialRunCount,
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
  /** Server-readable hint for the conditional Current sessions link. The
   * provider's restored run list replaces it immediately after hydration. */
  initialRunCount: number;
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

  // Collapsed shrinks the bar to a thin rail so the page gets the width back.
  // Seeded from the server's cookie read, so the first paint is already correct
  // for a desktop viewport (the server can't see the client's width at all).
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // Whether we're currently below MOBILE_BREAKPOINT. Starts false to match the
  // server's render (SSR has no viewport to check), then the effect below
  // corrects it — and forces `collapsed` on — the instant it can read
  // matchMedia, same tradeoff the dark-mode `prefers-color-scheme` read in
  // theme.tsx makes.
  const [isMobile, setIsMobile] = useState(false);
  // The user's actual desktop preference (what the cookie says), independent
  // of whatever the mobile auto-collapse is currently forcing `collapsed` to.
  // Widening back past the breakpoint restores THIS, not just whatever
  // `collapsed` happened to be — otherwise a mobile session would leak a
  // forced collapse into the next desktop render, and a manual expand/collapse
  // made while narrow would incorrectly overwrite the desktop cookie.
  const desktopPreference = useRef(initialCollapsed);
  // The dev section starts open when you're already on a /dev page, so a hard
  // reload there doesn't hide the page you're looking at behind a closed group.
  const [devOpen, setDevOpen] = useState(pathname.startsWith("/dev"));

  // Auto-collapse below the mobile breakpoint, independent of the desktop
  // preference cookie, and restore that preference when the viewport widens
  // back out. matchMedia is browser-only, so this can only run post-mount.
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    function sync(mobile: boolean) {
      setIsMobile(mobile);
      setCollapsed(mobile ? true : desktopPreference.current);
    }
    sync(mq.matches);
    const onChange = (e: MediaQueryListEvent) => sync(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      // Only persist as the desktop preference (cookie + the ref the
      // breakpoint effect restores on resize) when actually at a desktop
      // width. A collapse/expand made while under the breakpoint is a
      // transient override of the auto-collapse, not a change to what a
      // wide-viewport session should see — the cookie is one year, lax,
      // path=/ so it covers every route, and it should keep meaning "the
      // desktop preference," not "whatever was last tapped on a phone."
      if (!isMobile) {
        document.cookie = `${COLLAPSE_KEY}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
        desktopPreference.current = next;
      }
      return next;
    });
  }

  // The nav, assembled top-down: Home, Learn, Practice, then Current sessions
  // when a run is in progress, then Recent sessions (when there is history) sat
  // directly ABOVE Progress since the two are the "look back at what I did" pair,
  // then the rest of the static list.
  // The nav is the Sky's, top to bottom, for everyone: Home is the
  // learner's own sky, signed in or not (cutover, 2026-09-06).
  const items: Array<{ href: string; label: ReactNode; ariaLabel?: string }> = [...NAV];

  // Only the OAuth callback (/auth) hides the nav — it's a redirect route with no
  // real UI. Everywhere else the nav shows, including the landing and the sign-in
  // page: the app is browsable signed out, so a visitor reading the Library, or
  // sitting on the login screen, still needs to get around. Placed after the
  // hooks above so their call order stays unconditional.
  if (pathname.startsWith("/auth")) return null;

  // The signed-out heads-up shows only when auth is on (Supabase mode) and there
  // is no session, and never on the landing or the login screen where the point
  // is already made. Same gate the expanded sidebar's paragraph uses below.
  const showSignedOutNotice =
    authEnabled &&
    !signedIn &&
    !(pathname === "/" || pathname.startsWith("/login"));

  // Collapsed: a thin rail that is nothing but the way back out. Main content
  // (flex-1 in the layout) takes the freed width automatically. The rail has no
  // room for the signed-out notice, so when it applies we lift it — the same
  // notice, plus its own Sign in control — into the shell's frozen top dock via
  // the Dock portal. This lives in the sidebar (not the layout) so it tracks the
  // reactive `collapsed` state: it appears and disappears the instant the user
  // toggles the rail, not only on reload.
  if (collapsed) {
    return (
      <>
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
        {showSignedOutNotice ? (
          <Dock slot="banner">
            <SignedOutNotice variant="banner" />
          </Dock>
        ) : null}
      </>
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
        <Link href="/" aria-label="Saku (home)" className="block px-3 py-1">
          <Image
            src="/brand/saku-wordmark.png"
            alt=""
            width={96}
            height={96}
            className="h-auto w-20"
            priority
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
      {items.map(({ href, label, ariaLabel }) => {
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
            aria-label={ariaLabel}
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
      {/* DEV ONLY — the /dev/* reference pages, as an expandable group. Compiled
          out of production entirely (NODE_ENV inlined at build). */}
      {process.env.NODE_ENV !== "production" ? (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setDevOpen((o) => !o)}
            aria-expanded={devOpen}
            className="flex w-full items-center justify-between whitespace-nowrap rounded-lg px-3 py-[9px] text-left text-sm text-text-muted hover:bg-panel"
          >
            <span>Dev</span>
            <span className={`transition-transform ${devOpen ? "rotate-90" : ""}`}>
              <Chevron dir="right" />
            </span>
          </button>
          {devOpen ? (
            <div className="flex flex-col gap-0.5">
              {DEV_PAGES.map(({ href, label, children }) => {
                const within = pathname === href || pathname.startsWith(`${href}/`);
                // A sub-folder: its own header, then its pages indented under it.
                // Only expanded while you are inside it, so the flat list stays
                // readable when you are working elsewhere.
                if (children) {
                  return (
                    <div key={href}>
                      <Link
                        href={href}
                        className={`flex items-baseline whitespace-nowrap rounded-lg py-[7px] pl-7 pr-3 text-left text-sm ${
                          within ? "text-accent" : "text-text-muted hover:bg-panel"
                        }`}
                      >
                        {label}
                      </Link>
                      {within ? (
                        <div className="flex flex-col gap-0.5">
                          {children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={`flex items-baseline whitespace-nowrap rounded-lg py-[6px] pl-11 pr-3 text-left text-[13px] ${
                                pathname === child.href.split("?")[0]
                                  ? "bg-accent-bg text-accent"
                                  : "text-text-muted hover:bg-panel"
                              }`}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                }
                const sel = within;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-baseline whitespace-nowrap rounded-lg py-[7px] pl-7 pr-3 text-left text-sm ${
                      sel ? "bg-accent-bg text-accent" : "text-text-muted hover:bg-panel"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
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
                  the point is already made — the landing and the login page.
                  When the bar is collapsed this same notice moves to the frozen
                  top dock (see the collapsed branch above) — same copy, one
                  home in <SignedOutNotice>. */}
              {showSignedOutNotice ? (
                <SignedOutNotice variant="sidebar" />
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </nav>
  );
}
