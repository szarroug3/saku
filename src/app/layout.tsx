import type { Metadata } from "next";

import { Sidebar } from "@/components/sidebar";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QuizConfigProvider } from "@/lib/quiz-config";
import { QuizSessionProvider } from "@/lib/quiz-session";
import { ThemeProvider } from "@/lib/theme";
import type * as Theme from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: "Kana quiz",
  description: "Hiragana and katakana drill, match, and grid quizzes",
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
      </head>
      <body>
        <ThemeProvider>
          <QuizConfigProvider>
            <QuizSessionProvider>
              <TooltipProvider delayDuration={200}>
                {/* Inside the quiz providers, because what it asks about
                    ("discard the quiz in progress?") is their state. */}
                <ConfirmProvider>
                  <div className="mx-auto flex max-w-[1080px] gap-3.5 px-3 pb-15 pt-6">
                    <Sidebar />
                    <main className="min-w-0 flex-1">{children}</main>
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
