import type { Metadata } from "next";

import { Sidebar } from "@/components/sidebar";
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
const DEFAULT_THEME: typeof Theme.DEFAULT_THEME = "kiri";
const DEFAULT_APPEARANCE: typeof Theme.DEFAULT_APPEARANCE = "system";
const THEMES: typeof Theme.THEMES = [
  "aizome",
  "graphite",
  "momentum",
  "kiri",
] as const;
const APPEARANCES: typeof Theme.APPEARANCES = ["system", "light", "dark"] as const;

// Runs in <head>, blocking, before the browser paints anything — otherwise
// every hard reload flashes the default theme before React hydrates. Kept
// dependency-free and IIFE-wrapped (no globals) because it runs ahead of all
// other code. It only ever writes a value it recognizes, so an unknown or
// corrupt entry just leaves the server-rendered defaults in place, same as
// no-JS or blocked storage.
const NO_FLASH = `(function(){try{var d=document.documentElement,t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)}),a=localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)});
if(${JSON.stringify(THEMES)}.indexOf(t)>=0)d.setAttribute("data-theme",t);
if(${JSON.stringify(APPEARANCES)}.indexOf(a)>=0)d.setAttribute("data-appearance",a);
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
                <div className="mx-auto flex max-w-[1080px] gap-3.5 px-3 pb-15 pt-6">
                  <Sidebar />
                  <main className="min-w-0 flex-1">{children}</main>
                </div>
              </TooltipProvider>
            </QuizSessionProvider>
          </QuizConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
