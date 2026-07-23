import type { Metadata } from "next";

import { SignedOutNotice } from "@/components/auth/signed-out-notice";
import { SaveStatus } from "@/components/save-status";
import { Sidebar } from "@/components/sidebar";
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
        {/* Preload the brand art so it's decoded before first paint — otherwise
            the <img> alt ("Saku") flashes as text on the landing and in the
            sidebar until the PNG arrives. */}
        <link rel="preload" as="image" href="/brand/saku-mark.png" />
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
                  <div className="mx-auto flex max-w-[1080px] gap-3.5 px-3 pb-15 pt-6">
                    <Sidebar signedIn={signedIn} authEnabled={authEnabled} />
                    <main className="min-w-0 flex-1">
                      {/* Above the page, on every page: the screens that
                          would otherwise show a learner's work as missing
                          are exactly the ones this has to appear on. Renders
                          nothing when there is nothing unsaved. */}
                      <SaveStatus />
                      <SignedOutNotice show={authEnabled && !signedIn} />
                      {children}
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
