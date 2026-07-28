import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";

import { AuthModeInit } from "@/components/auth/auth-mode-init";
import { LocalMigration } from "@/components/auth/local-migration";
import { SaveStatus } from "@/components/save-status";
import { Sidebar } from "@/components/sidebar";
// SignedOutNotice now lives in the Sidebar (a global concern, so it sits with the
// global nav's Sign in control) — see src/components/sidebar.tsx.
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { currentUserId } from "@/lib/auth";
import { loadProgressSeeds } from "@/lib/history";
import { HistoryProvider } from "@/lib/history-provider";
import { QuizConfigProvider } from "@/lib/quiz-config";
import { SettingsProvider } from "@/lib/settings-provider";
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
const THEME_KEY: typeof Theme.THEME_KEY = "saku-theme";
const APPEARANCE_KEY: typeof Theme.APPEARANCE_KEY = "saku-appearance";
const ACCENTS_KEY: typeof Theme.ACCENTS_KEY = "saku-accents";
// The legacy names, pinned the same way, so the no-flash script can fall back to
// a returning user's un-migrated value and not flash the default at them.
const OLD_THEME_KEY: typeof Theme.OLD_THEME_KEY = "kanaquiz-theme";
const OLD_APPEARANCE_KEY: typeof Theme.OLD_APPEARANCE_KEY = "kanaquiz-appearance";
const OLD_ACCENTS_KEY: typeof Theme.OLD_ACCENTS_KEY = "kanaquiz-accents";
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
// `g(newKey, oldKey)` reads the renamed `saku-*` key, falling back to the legacy
// `kanaquiz-*` value so a returning user whose data has not been migrated yet
// still paints their real theme instead of flashing the default. Read-only on
// purpose: the copy-forward write is left to the providers on mount (see
// migratedGet / theme.tsx), keeping this script minimal and paint-blocking.
const NO_FLASH = `(function(){try{var d=document.documentElement,g=function(k,o){var v=localStorage.getItem(k);return v!==null?v:localStorage.getItem(o);},t=g(${JSON.stringify(
  THEME_KEY,
)},${JSON.stringify(OLD_THEME_KEY)}),a=g(${JSON.stringify(APPEARANCE_KEY)},${JSON.stringify(
  OLD_APPEARANCE_KEY,
)});
if(${JSON.stringify(THEMES)}.indexOf(t)>=0)d.setAttribute("data-theme",t);else t=${JSON.stringify(
  DEFAULT_THEME,
)};
if(${JSON.stringify(APPEARANCES)}.indexOf(a)>=0)d.setAttribute("data-appearance",a);
var m=JSON.parse(g(${JSON.stringify(ACCENTS_KEY)},${JSON.stringify(
  OLD_ACCENTS_KEY,
)})||"{}"),c=m&&m[t];
if(c!==${JSON.stringify(DEFAULT_ACCENT)}&&${JSON.stringify(
  ACCENTS,
)}.indexOf(c)>=0)d.setAttribute("data-accent",c);
}catch(e){}})()`;

/** The seed, or null if it could not be read.
 *
 * A history that exists and cannot be parsed is a 503 from /api/history, and it
 * must stay one: the layout is the app shell, and failing it would take down
 * every page including the ones that do not touch history at all. Null hands the
 * question back to the client, which asks the API and gets the real error with
 * the wording it already has for it. */
async function seedHistory(userId: string) {
  try {
    return (await loadProgressSeeds(userId)).history;
  } catch {
    return null;
  }
}

/** The settings seed, or null if it could not be read — the same contract as
 * seedHistory. A null hands the question to the client cache (the individual
 * localStorage keys) rather than failing the whole shell. */
async function seedSettings(userId: string) {
  try {
    return (await loadProgressSeeds(userId)).settings;
  } catch {
    return null;
  }
}

/** The in-progress session seed, or null if it could not be read — same contract
 * as seedHistory / seedSettings. A null hands the question to this device's own
 * localStorage snapshot (which is all a run needs to continue locally) rather
 * than failing the whole shell. */
async function seedSessionState(userId: string) {
  try {
    return (await loadProgressSeeds(userId)).session;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The sidebar is the app's nav, so it only belongs to someone who's in the
  // app: hidden for a signed-out visitor (who sees the landing) and on the auth
  // pages. `authEnabled` (Supabase keys present, so an account is possible) is
  // what puts a Sign in/out in it — with no keys there is no session to end.
  const userId = await currentUserId();
  const [signedIn, authEnabled] = [userId !== null, isSupabaseStore()];
  // THE HISTORY, IN THE FIRST RESPONSE. Every screen that shows progress reads
  // it through useHistory, which used to mean waiting for hydration and then a
  // GET /api/history before anything could render. Reading it here — the same
  // loadHistory the API route calls, not an HTTP request back into ourselves —
  // puts it in the HTML, so the first paint is the real screen.
  //
  // Only for a signed-in learner: a signed-out visitor has no account to read,
  // and the pages they see (the landing, the auth screens) are exactly the ones
  // that would have nothing to show for the query. Their progress lives in this
  // browser and the provider reads it there.
  // THE SETTINGS and IN-PROGRESS RUN, IN THE FIRST RESPONSE, for the same reason
  // as history: reconcile providers against the server copy on first paint,
  // instead of waiting on a client fetch. Signed-out visitors have no account to
  // read, so all three are null and local browser caches take over.
  const [initialHistory, initialSettings, initialSessionState] =
    userId === null
      ? [null, null, null]
      : await Promise.all([
          seedHistory(userId),
          seedSettings(userId),
          seedSessionState(userId),
        ]);
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
        {/* Server-synced settings, seeded above. Outermost of the client
            providers because the theme and quiz-config providers below reconcile
            their state against it (server wins), and the plain settings writers
            push through it. */}
        <SettingsProvider userId={userId} initial={initialSettings}>
        <ThemeProvider>
          {/* One history for the whole app, seeded above. Outside everything
              that reads it: the Sidebar, the sign-in merge, and every page. */}
          <HistoryProvider userId={userId} initial={initialHistory}>
            <QuizConfigProvider>
              <QuizSessionProvider
                userId={userId}
                initialSession={initialSessionState}
              >
                {/* No ListsProvider: lists live on the server now (lists.json,
                    beside history.json) and `useLists` fetches them the way
                    `useHistory` does. There is no app-wide list STATE left to
                    provide — which is what the localStorage version predicted
                    would happen to it. */}
                <TooltipProvider delayDuration={200}>
                  {/* Inside the quiz providers, because what it asks about
                      ("discard the quiz in progress?") is their state. */}
                  <ConfirmProvider>
                    {/* THE PAGE SCROLLS, NOT AN INNER FRAME. The shell is a plain
                        flex row with no height cap and no overflow of its own, so
                        <html> is the single scroll owner and the browser's own
                        scrollbar is the one that moves. globals.css reserves that
                        scrollbar's gutter (scrollbar-gutter: stable on html), so a
                        page toggling between "tall enough to scroll" and "not"
                        never re-centres the layout sideways — the whole-page shift
                        the Settings "Start over" used to cause.

                        The sidebar is flush LEFT (no mx-auto centring) and the main
                        column takes the freed width — the max-width lives on <main>
                        now, wider than the old shell-wide 1080 cap, so wide screens
                        are used rather than boxed. The docks below are `sticky`
                        rather than siblings of a fixed-height frame: that is what
                        now keeps them and the stage still while only the content in
                        front of them scrolls, the condition every fixed material in
                        kiri depends on. Each is display:none when empty, so an
                        unused dock adds no sticky element and no gap. */}
                    <div className="flex gap-3.5 px-3 py-6">
                      <Sidebar
                        signedIn={signedIn}
                        authEnabled={authEnabled}
                        initialCollapsed={sidebarCollapsed}
                      />
                      <main className="relative flex min-w-0 max-w-[1400px] flex-1 flex-col gap-3.5">
                        {/* GLOBAL BANNER DOCK, above the page's own top dock. The
                            signed-out notice is a page-agnostic message and must sit
                            at the very top — but a page (the Library) docks its OWN
                            header into kq-dock-top, and two children of one slot order
                            by mount, which put the banner UNDER the Library's search.
                            Its own slot above the page dock fixes the order for every
                            page at once. Empty (hidden) whenever nothing docks here. */}
                        <div id="kq-dock-banner" className="kq-dock sticky top-0 z-30 shrink-0 empty:hidden" />
                        {/* FROZEN TOP DOCK. A page lifts its header here — the
                            Library docks its search + filter chips — so it stays put
                            above the scrolling page instead of sliding over the
                            frost. `sticky top-0` is what freezes it now that the page
                            (not an inner frame) scrolls. Empty (and hidden) on pages
                            that dock nothing. */}
                        <div id="kq-dock-top" className="kq-dock sticky top-0 z-20 shrink-0 empty:hidden" />
                        {/* The stage + the content that scrolls within it. The
                            stage absolutely fills this region, so it does NOT
                            scroll with the content in front of it.

                            IT IS NOT FROSTED, and this used to say it was. A live
                            blur behind a scroll region re-blends every frame, which
                            was the whole of the kiri scroll lag, so .kq-stage is a
                            compositor layer and nothing more (globals.css). A
                            sticky bar that has to occlude therefore cannot lean on
                            the stage for it and must declare kq-band itself; see
                            SessionHud's `float`. */}
                        <div className="relative">
                          <div
                            className="kq-stage pointer-events-none absolute inset-0 rounded-2xl"
                            aria-hidden
                          />
                          <div className="kq-scroll relative rounded-2xl px-3 pb-15 pt-3">
                            {/* On every page: the screens that would otherwise show
                                a learner's work as missing are exactly the ones this
                                has to appear on. Renders nothing when nothing is
                                unsaved. */}
                            <SaveStatus />
                            {/* Tell the progress write path whether an account
                                exists, so a 401 on a write is read as "signed
                                out, save local" or "signed-in token lapsed,
                                refresh and retry" correctly. Renders nothing. */}
                            <AuthModeInit signedIn={authEnabled && signedIn} />
                            {/* When a signed-out learner signs in, their local
                                progress is replayed into the account and the local
                                copy cleared — once, best effort. Renders nothing. */}
                            <LocalMigration signedIn={authEnabled && signedIn} />
                            {children}
                          </div>
                        </div>
                        {/* FROZEN BOTTOM DOCK. The Library's slice bar docks here,
                            frozen at the bottom of the viewport while the page
                            scrolls. `sticky bottom-0` replaces the old fixed-frame
                            freeze — the slice bar is not itself sticky, so this dock
                            owns the freezing. Empty (hidden) elsewhere. */}
                        <div id="kq-dock-bottom" className="kq-dock sticky bottom-0 z-20 shrink-0 empty:hidden" />
                      </main>
                    </div>
                  </ConfirmProvider>
                </TooltipProvider>
              </QuizSessionProvider>
            </QuizConfigProvider>
          </HistoryProvider>
        </ThemeProvider>
        </SettingsProvider>
        <Analytics />
      </body>
    </html>
  );
}
