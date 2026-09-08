import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { AuthModeInit } from "./(sky)/auth-mode-init";
import { LocalMigration } from "./(sky)/local-migration";
// SignedOutNotice now lives in the Sidebar (a global concern, so it sits with the
// global nav's Sign in control) — see src/components/sidebar.tsx.
import { currentUserId } from "@/lib/auth";
import { CURRICULUM_VERSION } from "@/lib/content/curriculum-meta";
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
  // The sidebar is the app's nav, so it only belongs to someone who's in the
  // app: hidden for a signed-out visitor (who sees the landing) and on the auth
  // pages. `authEnabled` (Supabase keys present, so an account is possible) is
  // what puts a Sign in/out in it — with no keys there is no session to end.
  // First thing, before anything is awaited: how long the request took to
  // get from the edge to here, which on a cold process is the load of the
  // route's modules, the cold start itself (SAK-399). Reported in the page's
  // server-timing meta as edge-to-page.
  markEdgeToPage((await headers()).get("x-edge-at"));
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
  // Only the settings are seeded now (SAK-398). The history used to be put
  // in the HTML here too, for providers the old app read on every screen;
  // a signed-in Sky page reads the learner's progress on the server and
  // renders from it, so the history in the HTML was a copy nobody read, and
  // it grew with the learner (1.7 MB for a big one). The read itself is
  // shared with the page's own (see readProgress in the store), so nothing
  // is queried twice; only what goes to the browser changed.
  const seeds = userId === null ? null : await seedAll(userId);
  const initialSettings = seeds?.settings ?? null;
  // Read the sidebar's collapsed state server-side so it renders at the right
  // width on the first paint instead of loading expanded and snapping closed.
  return (
    <html lang="en" data-theme={THEME} data-appearance={APPEARANCE} data-accent={ACCENT}>
      <head>
        {/* Preload the wordmark so it's decoded before first paint — the sidebar
            shows it on every page, so without this its <img> flashes blank until
            the PNG arrives. The mark is landing-only, so it's preloaded there
            (src/components/landing.tsx) instead of globally, where it would go
            unused on every other route. */}
        <link rel="preload" as="image" href="/brand/saku-wordmark.png" />
        {/* SAK-112: use-server-lookup.ts's IndexedDB persistence reads this to
            key/validate its cache, instead of importing @/lib/content/
            learn-index (and its multi-megabyte learn-index.json) into a
            "use client" module every page would then bundle. A plain server-
            rendered meta tag costs nothing beyond the string itself. */}
        <meta name="curriculum-version" content={CURRICULUM_VERSION} />
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
