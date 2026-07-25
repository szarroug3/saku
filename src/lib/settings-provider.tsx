"use client";

// The one copy of the learner's server-synced settings, held for the whole app.
//
// WHY A PROVIDER, AND WHERE IT SITS
// =================================
// Settings are the source of truth on the SERVER; localStorage holds a per-field
// cache only so the app (and the pre-hydration no-flash script) can paint before
// the server answers. This provider owns the server copy — seeded server-side in
// the root layout, exactly like HistoryProvider — and hands it to the theme and
// quiz-config providers (which reconcile their own state against it, server
// winning) and to the plain settings writers (via the settings-sync bridge).
//
// It sits ABOVE ThemeProvider and QuizConfigProvider in the layout so those can
// consume it. It does three things:
//
//   1. RECONCILE DOWN. On the first client render it writes the seeded server
//      settings into the individual localStorage keys (applyServerSettings), so
//      the readers that consult localStorage directly — the lesson sections, the
//      concept cards and the claim explainer — see the source
//      of truth. This is done synchronously in the render body (guarded to run
//      once) rather than in an effect, because those readers mount as descendants
//      and their mount effects run BEFORE a parent effect would; the cache has to
//      be correct before they read it.
//
//   2. WRITE UP. `save(patch)` merges the change into the held server copy and
//      POSTs it through the reliable write path (a signed-in 401 refreshes the
//      session and retries, so a lapsed token never drops a setting). Registered
//      as the settings-sync pusher so the plain writers reach it too.
//
//   3. MIGRATE ONCE. If there is a server to write to and its settings are empty
//      (a first-ever load after this feature shipped), the learner's existing
//      local settings are replayed up to the server a single time, then the
//      server is authoritative. Gated so it never clobbers a server that already
//      has settings (e.g. a value set on another device).

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { isSignedIn } from "@/lib/auth-mode";
import { refreshSupabaseSession } from "@/lib/progress-fetch";
import { resolveProgressWrite } from "@/lib/progress-write";
import { applyServerSettings, readLocalSettings } from "@/lib/settings-local";
import { isEmptySettings, mergeSettings } from "@/lib/settings-merge";
import {
  registerSettingsPusher,
  unregisterSettingsPusher,
} from "@/lib/settings-sync";
import type { SettingsFile } from "@/types";

const JSON_HEADERS = { "Content-Type": "application/json" };

export interface SettingsContextValue {
  /** The server's copy, or null when there is no server to speak for it (a
   * signed-out visitor in Supabase mode). Consumers reconcile against it, server
   * winning; null means "use the local cache", which is all a signed-out visitor
   * has. Seeded server-side, so it is correct on the first paint. */
  serverSettings: SettingsFile | null;
  /** Persist a partial settings change: merge it into the held server copy and
   * POST it. A no-op on the network when there is no server (the writer has
   * already updated the local cache). */
  save: (patch: SettingsFile) => void;
}

export const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

/** POST a patch through the reliable write path. `applyLocal` is a no-op: the
 * writer that called save() already updated the individual localStorage key, so
 * a signed-out 401 has nothing more to cache. Signed-in 401s refresh + retry. */
async function writeSettingsToServer(patch: SettingsFile): Promise<boolean> {
  const { ok } = await resolveProgressWrite({
    send: () =>
      fetch("/api/settings", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(patch),
      }),
    applyLocal: () => {},
    signedIn: isSignedIn(),
    refreshSession: refreshSupabaseSession,
  });
  return ok;
}

export function SettingsProvider({
  userId,
  initial,
  children,
}: {
  /** The signed-in account, or null for a signed-out Supabase visitor. In file
   * mode this is the implicit local user, so it is non-null and settings sync to
   * settings.json. Non-null means "there is a server to write to". */
  userId: string | null;
  /** The server's read of this account's settings, or null when there was none to
   * read (signed out) or it could not be read. */
  initial: SettingsFile | null;
  children: ReactNode;
}) {
  const [serverSettings, setServerSettings] = useState<SettingsFile | null>(initial);

  // RECONCILE DOWN, once, synchronously, before any descendant reads the cache.
  // Done in a useState initializer (which runs a single time, during the first
  // render, before children mount) rather than an effect — an effect would run
  // AFTER the child readers' own mount effects, too late for a flag reader that
  // consults localStorage on mount. Skipped on the server (no localStorage) and
  // when there is nothing seeded. The state itself is unused; the initializer is
  // just the one-time hook the reconcile hangs on.
  useState(() => {
    if (typeof window !== "undefined" && initial) {
      applyServerSettings(window.localStorage, initial);
    }
    return null;
  });

  const save = useCallback(
    (patch: SettingsFile) => {
      // Keep the held server copy current so a later reconcile/read reflects the
      // change this session. Merge, never replace — a single-field save must not
      // drop the rest of the copy.
      setServerSettings((prev) => mergeSettings(prev ?? {}, patch));
      // No server to write to (signed-out Supabase visitor): the writer already
      // cached the value locally, and the one-time migration will replay it up on
      // sign-in. Nothing to POST.
      if (userId === null) return;
      void writeSettingsToServer(patch);
    },
    [userId],
  );

  // Register save() as the bridge the plain writers (claim-hint, lesson-prefs,
  // intro-shown) push through.
  useEffect(() => {
    registerSettingsPusher(save);
    return () => unregisterSettingsPusher(save);
  }, [save]);

  // MIGRATE ONCE PER ACCOUNT. Replay this browser's existing local settings up to
  // the server the first time an account's server copy is seen EMPTY — the first
  // load after this feature shipped, or a signed-out visitor's first sign-in.
  //
  // The empty-server gate is the whole safety: the moment any device seeds the
  // server, every other device's seed for that account is non-empty and this
  // bails, so a second device can never replay its stale local values over a
  // choice already made elsewhere. `migratedFor` keys the attempt to the account
  // so a null→uuid sign-in (a prop change, not a remount) still triggers it.
  //
  // This is the settings counterpart of migrate-local.ts, kept here rather than
  // there because it must also run in FILE mode (where migrate-local does not) —
  // theme/config have always lived in localStorage, so settings.json needs the
  // same one-time seeding a hosted account does.
  const migratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (userId === null || initial === null) return;
    if (migratedFor.current === userId) return;
    migratedFor.current = userId;
    if (!isEmptySettings(initial)) return; // server already authoritative
    const local = readLocalSettings(window.localStorage);
    if (isEmptySettings(local)) return; // nothing local to seed the server with
    void (async () => {
      if (await writeSettingsToServer(local)) {
        setServerSettings((prev) => mergeSettings(prev ?? {}, local));
      }
      // On failure, leave migratedFor set for this session but the NEXT load still
      // sees an empty server and retries the (idempotent) replay.
    })();
  }, [userId, initial]);

  return (
    <SettingsContext.Provider value={{ serverSettings, save }}>
      {children}
    </SettingsContext.Provider>
  );
}
