import type { Metadata } from "next";
import { cookies } from "next/headers";

import { LocalMigration } from "@/components/auth/local-migration";
import { SaveStatus } from "@/components/save-status";
import { Sidebar } from "@/components/sidebar";
// SignedOutNotice now lives in the Sidebar (a global concern, so it sits with the
// global nav's Sign in control) — see src/components/sidebar.tsx.
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isSignedIn } from "@/lib/auth";
import { QuizConfigProvider } from "@/lib/quiz-config";
import { QuizSessionProvider } from "@/lib/quiz-session";
import { isSupabaseStore } from "@/lib/store/mode";
import { ThemeProvider } from "@/lib/theme";
import type * as Theme from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: "Saku",
  description:
    "Learn Japanese from the ground up: kana, kanji, vocabulary, grammar, and more.",
};

/* These are re-declared instead of imported, and that is load-bearing.
 * layout.tsx is a Server Component; src/lib/theme.tsx is "use client". Every
 * VALUE exported from a client module reaches a Server Component as a
 * client-reference stub, not the value — importing THEME_KEY here compiles
 * and renders happily but emits `localStorage.getItem(undefined)`, silently
 * disabling the no-flash script.
 *
 * Types are erased at build time, so they DO cross the boundary: pinning each
 * const to `typeof Theme.X` turns any drift from theme.tsx — a renamed key, a
 * changed default, a fifth theme — into a type error rather than a silent
 * flash. (`import type * as` never emits a require.) */
const THEME_KEY: typeof Theme.THEME_KEY = "kanaquiz-theme";
const APPEARANCE_KEY: typeof Theme.APPEARANCE_KEY = "kanaquiz-appearance";
const ACCENTS_KEY: typeof Theme.ACCENTS_KEY = "kanaquiz-accents";
const DEFAULT_THEME: typeof Theme.DEFAULT_THEME = "kiri";
const DEFAULT_APPEARANCE: typeof Theme.DEFAULT_APPEARANCE = "system";
const DEFAULT_ACCENT: typeof Theme.DEFAULT_ACCENT = "default";
const THEMES: typeof Theme.THEMES = [
  "aizome",
  "graphite",
  "momentum",
  "kiri",
] as const;
const APPEARANCES: typeof Theme.APPEARANCES = ["system", "light", "dark"] as const;
const ACCENTS: typeof Theme.ACCENTS = [
  "default",
  "cyan",
  "azure",
  "violet",
  "orchid",
  "magenta",
  "pearl",
] as const;

// Runs in <head>, blocking, before the browser paints anything — otherwise
// every hard reload flashes the default theme before React hydrates. Kept
// dependency-free and IIFE-wrapped (no globals) because it runs ahead of all
// other code. It only ever writes a value it recognizes, so an unknown or
// corrupt entry just leaves the server-rendered defaults in place, same as
// no-JS or blocked storage.
//
// The accent costs one more getItem and a JSON.parse, and it has to happen
// HERE for the same reason the other two do: it is a paint-blocking fact. It
// also has to happen AFTER the theme is resolved, because the accent is stored
// per theme — the map is keyed by theme id, so reading it means knowing which
// theme you are about to be in. Note `t` is reassigned to DEFAULT_THEME when
// storage holds junk: the provider will mount as DEFAULT_THEME, so the accent
// looked up here must be DEFAULT_THEME's too or the pre-paint stamp and the
// post-mount state disagree and you get the flash this script exists to stop.
//
// "default" is deliberately not stampable — it means "no data-accent", i.e.
// the theme's own — so the guard rejects it along with anything unknown.
const NO_FLASH = `(function(){try{var d=document.documentElement,t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)}),a=localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)});
if(${JSON.stringify(THEMES)}.indexOf(t)>=0)d.setAttribute("data-theme",t);else t=${JSON.stringify(
  DEFAULT_THEME,
)};
if(${JSON.stringify(APPEARANCES)}.indexOf(a)>=0)d.setAttribute("data-appearance",a);
var m=JSON.parse(localStorage.getItem(${JSON.stringify(
  ACCENTS_KEY,
)})||"{}"),c=m&&m[t];
if(c!==${JSON.stringify(DEFAULT_ACCENT)}&&${JSON.stringify(
  ACCENTS,
)}.indexOf(c)>=0)d.setAttribute("data-accent",c);
}catch(e){}})()`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The sidebar is the app's nav, so it only belongs to someone who's in the
  // app: hidden for a signed-out visitor (who sees the landing) and on the auth
  // pages. `authEnabled` (Supabase mode) is what puts a Sign out in it — in file
  // mode there is no session to end.
  const [signedIn, authEnabled] = [await isSignedIn(), isSupabaseStore()];
  // Read the sidebar's collapsed state server-side so it renders at the right
  // width on the first paint instead of loading expanded and snapping closed.
  const sidebarCollapsed =
    (await cookies()).get("saku-sidebar-collapsed")?.value === "1";
  return (
    // suppressHydrationWarning: the script below rewrites these two attributes
    // before React hydrates, so the client <html> legitimately differs from
    // the server markup.
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      data-appearance={DEFAULT_APPEARANCE}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
        {/* Preload the wordmark so it's decoded before first paint — the sidebar
            shows it on every page, so without this its <img> flashes blank until
            the PNG arrives. The mark is landing-only, so it's preloaded there
            (src/components/landing.tsx) instead of globally, where it would go
            unused on every other route. */}
        <link rel="preload" as="image" href="/brand/saku-wordmark.png" />
      </head>
      <body>
        <ThemeProvider>
          <QuizConfigProvider>
            <QuizSessionProvider>
              {/* No ListsProvider: lists live on the server now (lists.json,
                  beside history.json) and `useLists` fetches them the way
                  `useHistory` does. There is no app-wide list STATE left to
                  provide — which is what the localStorage version predicted
                  would happen to it. */}
              <TooltipProvider delayDuration={200}>
                {/* Inside the quiz providers, because what it asks about
                    ("discard the quiz in progress?") is their state. */}
                <ConfirmProvider>
                  {/* THE SHELL SCROLLS INSIDE, NOT THE PAGE. The row is exactly
                      the viewport tall and hides its own overflow, so the body
                      never scrolls; the content column below is the one scroll
                      container. This is what lets kiri's frosted frame (.kq-frame)
                      stay perfectly still while the content scrolls within it —
                      the frame's blur is computed once and never re-blends,
                      because only the content in front of it moves. */}
                  <div className="mx-auto flex h-dvh max-w-[1080px] gap-3.5 overflow-hidden px-3 py-6">
                    <Sidebar
                      signedIn={signedIn}
                      authEnabled={authEnabled}
                      initialCollapsed={sidebarCollapsed}
                    />
                    <main className="relative flex min-w-0 flex-1 flex-col gap-3.5">
                      {/* FROZEN TOP DOCK. A page lifts its header here — the
                          Library docks its search + filter chips — so it stays put
                          above the scrolling frame instead of sliding over the
                          frost. Empty (and hidden) on pages that dock nothing. */}
                      <div id="kq-dock-top" className="kq-dock shrink-0 empty:hidden" />
                      {/* The single frosted box + the content that scrolls within
                          it. The frame absolutely fills this region, so it does
                          NOT scroll with the content in front of it; kiri frosts
                          it, the opaque themes leave it a no-op. */}
                      <div className="relative min-h-0 flex-1">
                        <div
                          className="kq-stage pointer-events-none absolute inset-0 rounded-2xl"
                          aria-hidden
                        />
                        <div className="kq-scroll relative h-full overflow-y-auto overscroll-contain rounded-2xl px-3 pb-15 pt-3">
                          {/* On every page: the screens that would otherwise show
                              a learner's work as missing are exactly the ones this
                              has to appear on. Renders nothing when nothing is
                              unsaved. */}
                          <SaveStatus />
                          {/* When a signed-out learner signs in, their local
                              progress is replayed into the account and the local
                              copy cleared — once, best effort. Renders nothing. */}
                          <LocalMigration signedIn={authEnabled && signedIn} />
                          {children}
                        </div>
                      </div>
                      {/* FROZEN BOTTOM DOCK. The Library's slice bar docks here,
                          frozen below the frame. Empty (hidden) elsewhere. */}
                      <div id="kq-dock-bottom" className="kq-dock shrink-0 empty:hidden" />
                    </main>
                  </div>
                </ConfirmProvider>
              </TooltipProvider>
            </QuizSessionProvider>
          </QuizConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
