"use client";

// One bit the progress write path (progress-fetch.ts) cannot read for itself:
// does a real server account exist for this visitor. It matters because a 401 on
// a write means two opposite things — "signed out, save locally and drop it" vs
// "signed-in token lapsed, refresh and retry, never drop" — and only the app
// shell knows which (the layout computes it from the session). See the long note
// in progress-write.ts.
//
// progress-fetch.ts is a plain module with no React context, so the shell hands
// the answer across via this tiny module-level signal, set once from
// AuthModeInit (mounted in the layout beside LocalMigration).

/** null until the shell tells us. See isSignedIn for why the default is safe. */
let signedInSignal: boolean | null = null;

/** Record whether there is a server account. Idempotent; called from the layout
 * initializer whenever the server's answer is (re)computed. */
export function setAuthMode(mode: { signedIn: boolean }): void {
  signedInSignal = mode.signedIn;
}

/**
 * Is there a server account this write belongs to?
 *
 * Unknown (before the initializer runs) returns TRUE on purpose. The signed-in
 * path keeps a 401'd record queued and never writes it to local-only storage, so
 * defaulting to signed-in cannot silently drop data — the failure mode of the
 * signed-OUT default (report ok, drop from the outbox) is the exact data loss
 * this whole change exists to stop. Safe-by-default means "keep it queued".
 */
export function isSignedIn(): boolean {
  return signedInSignal !== false;
}

/** Test seam: forget what the shell told us, so a test starts from "unknown". */
export function resetAuthMode(): void {
  signedInSignal = null;
}
