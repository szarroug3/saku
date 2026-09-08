"use client";

// The one copy of the learner's server-synced settings, held for the whole app.
//
// WHY A PROVIDER, AND WHERE IT SITS
// =================================
// Settings are the source of truth on the SERVER; localStorage holds a per-field
// cache only so the app can paint before the server answers. This provider owns
// the server copy, seeded server-side in the root layout exactly like
// HistoryProvider, and hands it to the quiz-config provider (which reconciles
// its own state against it, server winning) and to the plain settings writers
// (via the settings-sync bridge).
//
// It sits ABOVE QuizConfigProvider in the layout so that can consume it. It does
// three things:
//
//   1. RECONCILE DOWN. On the first client render it writes the seeded server
//      settings into the individual localStorage keys (applyServerSettings), so
//      the readers that consult localStorage directly (Practice, whose saved
//      recipes and misses live there and nowhere else) see the source of truth.
//      This is done synchronously in the render body (guarded to run once)
//      rather than in an effect, because those readers mount as descendants and
//      their mount effects run BEFORE a parent effect would; the cache has to be
//      correct before they read it.
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
//
// SAK-258: A FAILED WRITE USED TO BE INVISIBLE
// =============================================
// `save()` used to fire the POST and never look at the result — `void
// writeSettingsToServer(patch)` — so a save that genuinely failed (offline, a
// dead session, the server refusing it) left the learner believing their
// change stuck when the row never moved. There was also nothing coalescing a
// SECOND change that came in before the first one's response landed, so a
// failed first patch's field could be dropped for good the moment a later,
// unrelated patch succeeded.
//
// `queueWrite`/`flush` below fix both: every patch is folded into `unsavedRef`
// (mergeSettings, same field-level replace `save` already used) before it is
// sent, so a write in flight when a new one arrives grows to cover both rather
// than racing it, and `unsavedRef` is only cleared when the copy actually SENT
// is confirmed landed — never when something newer has since queued behind it.
// A failure sets `saveError`, which the app's one save-status banner shows (see
// save-status.tsx and pending-history-writes.ts's SAK-242 precedent for a
// second source feeding that same banner); `retrySave` is its button, and the
// same flush also fires automatically once the browser reports it is back
// online — the same "try again when connectivity returns" every other
// background write in this app already does.

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

/** The save-status banner's copy for a settings write that has not landed —
 * kept as one constant so the message shown and the message tested agree. */
const SETTINGS_SAVE_ERROR =
  "A setting change hasn't saved yet. It's kept on this device and will keep retrying.";

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
  /** Set when a settings write hasn't landed on the server yet — the save-status
   * banner's copy (see save-status.tsx). Null when nothing is outstanding. */
  saveError: string | null;
  /** The banner's button: retry sending whatever hasn't been confirmed saved
   * yet. Safe to call when nothing is pending (a no-op). */
  retrySave: () => void;
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

  const [saveError, setSaveError] = useState<string | null>(null);

  // The patch not yet confirmed saved, and whether a send is currently in
  // flight for it. A ref, not state — queueWrite/flush run from event handlers
  // and an effect, and need the CURRENT value synchronously (state set in the
  // same tick is not readable until the next render).
  const unsavedRef = useRef<SettingsFile | null>(null);
  const flightRef = useRef(false);

  /**
   * Send whatever is queued in `unsavedRef`, looping (not recursing — a
   * self-referencing useCallback can't see its own later reassignment) for as
   * long as something newer keeps arriving while a send is in flight.
   * Idempotent to call with nothing queued or a send already running (the
   * retry button and the "online" listener below both call it
   * unconditionally).
   *
   * `sending` is captured before the await each iteration so the completion
   * check can tell "this exact copy landed" from "something newer queued
   * behind it while we were waiting" — `unsavedRef.current` may have grown
   * (via queueWrite) by the time the POST resolves, and clearing it in that
   * case would drop the newer field(s) on the floor with nothing left to
   * retry them.
   */
  const flush = useCallback(() => {
    if (flightRef.current) return;
    flightRef.current = true;
    void (async () => {
      while (unsavedRef.current) {
        const sending = unsavedRef.current;
        const ok = await writeSettingsToServer(sending);
        if (!ok) {
          setSaveError(SETTINGS_SAVE_ERROR);
          break;
        }
        if (unsavedRef.current === sending) {
          unsavedRef.current = null;
          setSaveError(null);
        }
        // else: loop again — something newer queued while `sending` was in
        // flight, so it still needs to go out.
      }
      flightRef.current = false;
    })();
  }, []);

  /** Merge a patch into the held server copy (so a later reconcile/read
   * reflects the change this session) and fold it into the outstanding
   * write. Two patches that arrive before either lands are merged
   * (mergeSettings — field-level replace) rather than racing, so a write that
   * failed is not silently replaced by a later, unrelated one that happens to
   * succeed first. Shared by `save` and the one-time migration effect below —
   * one write path, one place that queues and retries it. */
  const queueWrite = useCallback(
    (patch: SettingsFile) => {
      setServerSettings((prev) => mergeSettings(prev ?? {}, patch));
      unsavedRef.current = unsavedRef.current
        ? mergeSettings(unsavedRef.current, patch)
        : patch;
      flush();
    },
    [flush],
  );

  const retrySave = useCallback(() => flush(), [flush]);

  // Retry whenever the browser reports connectivity is back — the same
  // "try again once online" every other background write in this app already
  // does (history-writes.ts, use-finished-round-outbox.ts). A no-op when
  // nothing is queued or a send is already running.
  useEffect(() => {
    const onOnline = () => flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  const save = useCallback(
    (patch: SettingsFile) => {
      // No server to write to (signed-out Supabase visitor): the writer already
      // cached the value locally, and the one-time migration will replay it up on
      // sign-in. Still reflect it in the held copy (merge, never replace — a
      // single-field save must not drop the rest), just nothing to POST.
      if (userId === null) {
        setServerSettings((prev) => mergeSettings(prev ?? {}, patch));
        return;
      }
      queueWrite(patch);
    },
    [userId, queueWrite],
  );

  // Register save() as the bridge the plain writers (Practice's recipes and
  // misses) push through.
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
  // the config has always lived in localStorage, so settings.json needs the
  // same one-time seeding a hosted account does.
  const migratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (userId === null || initial === null) return;
    if (migratedFor.current === userId) return;
    migratedFor.current = userId;
    if (!isEmptySettings(initial)) return; // server already authoritative
    const local = readLocalSettings(window.localStorage);
    if (isEmptySettings(local)) return; // nothing local to seed the server with
    // Same path as any other change (queueWrite reflects it in the held copy
    // AND queues the write): queueWrite/flush's own retry-on-failure (SAK-258)
    // now covers a POST that doesn't land, rather than the migration silently
    // doing nothing until a full page reload sees the server still empty and
    // retries. Deferred a microtask (rather than calling queueWrite directly
    // in the effect body) so the state update it makes is not synchronous
    // within the effect itself — react-hooks/set-state-in-effect.
    void Promise.resolve().then(() => queueWrite(local));
  }, [userId, initial, queueWrite]);

  return (
    <SettingsContext.Provider value={{ serverSettings, save, saveError, retrySave }}>
      {children}
    </SettingsContext.Provider>
  );
}
