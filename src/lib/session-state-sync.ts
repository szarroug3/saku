"use client";

// The client half of in-progress session sync — the network push, the local
// sync-metadata, and the "what is the current run's envelope" derivation. Kept
// out of quiz-session.tsx so the provider only has to CALL these, and so the
// derivation (which is pure) can be unit-tested without mounting the provider.
//
// See src/lib/session-state.ts for the envelope + last-writer-wins model, and
// the provider for WHERE these run (the reconcile on load, the debounced push on
// every save, the immediate push on a clear).

import { refreshSupabaseSession } from "@/lib/progress-fetch";
import { resolveProgressWrite } from "@/lib/progress-write";
import { isSignedIn } from "@/lib/auth-mode";
import {
  makeEnvelope,
  type SessionPayload,
  type SessionStateEnvelope,
} from "@/lib/session-state";
import { SESSION_SYNC_KEY } from "@/lib/settings-keys";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** This device's own view of the synced run — its stable id and the ms timestamp
 * of this device's last in-progress write. Persisted under SESSION_SYNC_KEY so a
 * reload keeps the run's identity (and its "how fresh am I" clock) rather than
 * minting a new id for a run that is still going. */
export interface SessionSyncMeta {
  sessionId: string | null;
  updatedAt: number;
}

const EMPTY_META: SessionSyncMeta = { sessionId: null, updatedAt: 0 };

/** Read the sync metadata this device last wrote. A missing/corrupt value reads
 * as EMPTY_META (updatedAt 0), so the server always wins on a fresh device — the
 * teleport case. */
export function readSyncMeta(store: Storage): SessionSyncMeta {
  try {
    const raw = store.getItem(SESSION_SYNC_KEY);
    if (!raw) return EMPTY_META;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY_META;
    const m = parsed as Partial<SessionSyncMeta>;
    return {
      sessionId: typeof m.sessionId === "string" ? m.sessionId : null,
      updatedAt:
        typeof m.updatedAt === "number" && Number.isFinite(m.updatedAt)
          ? m.updatedAt
          : 0,
    };
  } catch {
    return EMPTY_META;
  }
}

/** Persist this device's sync metadata. Best-effort — a full/unavailable store
 * degrades to "the server wins next load", which is safe. */
export function writeSyncMeta(store: Storage, meta: SessionSyncMeta): void {
  try {
    store.setItem(SESSION_SYNC_KEY, JSON.stringify(meta));
  } catch {
    // storage unavailable — sync degrades to server-wins, not a crash
  }
}

/**
 * The comparable BODY of an envelope — its identity and payload, WITHOUT the
 * timestamp. Two pushes that carry the same run at the same position differ only
 * in `updatedAt`, and re-posting that is pure churn (and, worse, would advance
 * the server's LWW clock for no change). The provider skips a push whose body
 * matches the last one it sent. `owner`-style volatility does not apply here —
 * the payload is already the storm-guarded canonical body from the provider.
 */
export function envelopeBody(env: SessionStateEnvelope): string {
  return JSON.stringify({ sessionId: env.sessionId, state: env.state });
}

/** Build the envelope to publish for the run currently on this device.
 * `payload` null (no active/session/parked run) is a CLEAR. `now` stamps the LWW
 * clock. */
export function currentEnvelope(
  payload: SessionPayload | null,
  sessionId: string | null,
  now: number,
): SessionStateEnvelope {
  return makeEnvelope(payload, sessionId, now);
}

/**
 * POST an envelope through the reliable write path (a signed-in 401 refreshes the
 * session and retries, so a lapsed token never drops the run's latest position).
 * `applyLocal` is a no-op: this device already holds the run in its own
 * localStorage snapshot, so a signed-out 401 has nothing more to cache — the
 * server copy is purely the cross-device mirror. Resolves true when the server
 * (or the signed-out local fallback) accepted it.
 */
export async function pushSessionState(
  env: SessionStateEnvelope,
): Promise<boolean> {
  const { ok } = await resolveProgressWrite({
    send: () =>
      fetch("/api/session-state", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(env),
      }),
    applyLocal: () => {},
    signedIn: isSignedIn(),
    refreshSession: refreshSupabaseSession,
  });
  return ok;
}
