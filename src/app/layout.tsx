import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { AuthModeInit } from "./(sky)/auth-mode-init";
import { LocalMigration } from "./(sky)/local-migration";
import { currentUserId } from "@/lib/auth";
import { headers } from "next/headers";

import { loadProgressSeeds } from "@/lib/history";
import { markEdgeToPage } from "@/lib/server-timing";
import { HistoryProvider } from "@/lib/history-provider";
import { QuizConfigProvider } from "@/lib/quiz-config";
import { SettingsProvider } from "@/lib/settings-provider";
import { isSupabaseStore } from "@/lib/store/mode";

import "./globals.css";

export const metadata: Metadata = {
  // One title shape for the whole app: "Saku · <page>". A route sets only its
  // own fragment (`title: "Learn"`) and Next composes it through this template;
  // a route that sets nothing falls back to the bare app name.
  title: {
    default: "Saku",
    template: "Saku · %s",
  },
  description:
    "Learn Japanese from the ground up: kana, kanji, vocabulary, grammar, and more.",
};

// The palette the app's own tokens resolve under. The Sky wears its own
// `--sky-*` tokens and the wash, but three files in the route layer still use
// the app's (stroke-order.tsx, why.tsx, pitch-mark.tsx) and globals.css only
// defines those inside a `[data-theme]` block. So the attributes stay, as
// literals; nothing reads or writes them after this (SAK-374).
const THEME = "kiri";
const APPEARANCE = "system";
const ACCENT = "magenta";

/** All four progress-row seeds in one DB round-trip. Each field falls back to
 * null on error so a partial Supabase failure cannot take down the whole shell. */
async function seedAll(userId: string) {
  try {
    return await loadProgressSeeds(userId);
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `authEnabled` (Supabase keys present, so an account is possible) is what
  // decides whether there is a session to sign out of at all; the Sky's shell
  // reads it through AuthModeInit below.
  // First thing, before anything is awaited: how long the request took to
  // get from the edge to here, which on a cold process is the load of the
  // route's modules, the cold start itself (SAK-399). Reported in the page's
  // server-timing meta as edge-to-page.
  markEdgeToPage((await headers()).get("x-edge-at"));
  const userId = await currentUserId();
  const [signedIn, authEnabled] = [userId !== null, isSupabaseStore()];
  // THE SETTINGS, IN THE FIRST RESPONSE, so the providers below reconcile
  // against the server's copy at first paint instead of waiting on a client
  // fetch. Signed out there is no account to read and the local browser cache
  // takes over.
  //
  // The settings are all that is seeded now (SAK-398). The history used to
  // ride here too, for providers the old app read on every screen; a signed-in
  // Sky page reads the learner's progress on the server and renders from it,
  // so the copy in the HTML was one nobody read, and it grew with the learner
  // (1.7 MB for a big one). The read itself is shared with the page's own (see
  // readProgress in the store), so nothing is queried twice; only what goes to
  // the browser changed.
  const seeds = userId === null ? null : await seedAll(userId);
  const initialSettings = seeds?.settings ?? null;
  return (
    <html lang="en" data-theme={THEME} data-appearance={APPEARANCE} data-accent={ACCENT}>
      <head>
        {/* Preload the wordmark so it is decoded before first paint. The
            Sky's shell draws it on every page (src/sky/components/
            sky-shell.tsx), so without this its <img> flashes blank until the
            PNG arrives. */}
        <link rel="preload" as="image" href="/brand/saku-wordmark.png" />
      </head>
      <body>
        {/* Server-synced settings, seeded above. Outermost of the client
            providers because the quiz-config provider below reconciles its
            state against it (server wins), and the plain settings writers push
            through it. */}
        <SettingsProvider userId={userId} initial={initialSettings}>
          {/* One history for the whole app, seeded above. Outside everything
              that reads it: the Sidebar, the sign-in merge, and every page. */}
          <HistoryProvider userId={userId} initial={null} pageOwned={userId !== null}>
            <QuizConfigProvider>
              {/* The shell is the Sky's own (src/app/(sky)/layout.tsx) since
                  cutover (2026-09-06). What is left here is every page's
                  invisible housekeeping. */}
              <AuthModeInit signedIn={authEnabled && signedIn} />
              <LocalMigration signedIn={authEnabled && signedIn} />
              {children}
            </QuizConfigProvider>
          </HistoryProvider>
        </SettingsProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
