// The pure decision SAK-242 fixes: what a claim/seen/mixup write does once its
// post resolves. Pulled out of history-writes.ts's `reconcile` so the decision
// itself — telling "the server refused" apart from "the request never
// completed", and retrying only the latter — is unit-testable with no window,
// no React, and no real network (see history-write-reconcile.test.ts), the
// same way progress-write.ts's resolveProgressWrite is pure and injected.
// history-writes.ts supplies the real IO: the fetch (via `send`), the
// optimistic-overlay hooks, and a `waitForOnline` built from
// `window.addEventListener("online", …, { once: true })`.
//
// THE BUG, IN ONE SENTENCE
// ========================
// resolveProgressWrite (progress-write.ts) never rejects — every thrown fetch,
// including a plain offline failure, comes back as a RESOLVED
// `{ ok: false, status: 0 }`, because the same function also has to fork on a
// real 401 and cannot do that from inside a rejection handler. The caller this
// replaces assumed the opposite (a thrown request would reject the promise it
// was handed), so an offline tap ran the *success* handler with `ok: false`:
// it dropped the optimistic change and refreshed from the server, which had
// never received the write. That is the silent revert SAK-242 reports.
//
// THE FIX
// =======
// `status === 0` is resolveProgressWrite's own signal for "never completed" —
// the one outcome that must NOT be read as a refusal. This loop treats it as
// "try again once we're back online" instead, and only calls `settle` (and, on
// an actual refusal, `refresh`) once the write has genuinely resolved one way
// or the other. `onWaiting`/`onSettled` bracket a wait so a caller can show
// something better than silence while one is in progress (see
// pending-history-writes.ts).

import type { ProgressResult } from "@/lib/progress-write";

export interface ReconcileDeps {
  /** Perform the write. Called again for every retry — must build a fresh
   * request each time, exactly like `WriteDeps.send` in progress-write.ts. */
  send: () => Promise<ProgressResult>;
  /** Drop this write from the optimistic overlay (history-provider.tsx's
   * `apply`). Called exactly once, when the write finally resolves — never
   * while it is merely waiting on connectivity, which is the whole point: the
   * overlay is what keeps the change on screen during the wait. */
  settle: () => void;
  /** Replace the screen with the server's truth. Called only after `settle`,
   * and only when the write was genuinely refused — not when it was merely
   * offline. */
  refresh: () => void;
  /** Resolves the next time connectivity is back. A real caller wraps
   * `window.addEventListener("online", …, { once: true })` in a promise; a
   * test resolves it on demand to drive the retry deterministically. */
  waitForOnline: () => Promise<void>;
  /** The write just started waiting on connectivity (this attempt, or a
   * retry, failed with "never completed"). Fired at most once per wait — a
   * second `send` that also fails with status 0 does not fire it again; see
   * `onSettled`. */
  onWaiting: () => void;
  /** The wait `onWaiting` announced is over — the write resolved, one way or
   * the other. Not called at all if `onWaiting` never fired. */
  onSettled: () => void;
}

/**
 * Run one write through to a genuine resolution — landed, or refused by the
 * server — retrying across any number of "never completed" outcomes in
 * between. Never rejects: every `send` this is handed is expected to resolve
 * (see resolveProgressWrite), but a `send` that throws anyway is treated the
 * same as `status: 0` rather than left to reject this promise and go unhandled.
 */
export async function runReconcile(deps: ReconcileDeps): Promise<void> {
  let waiting = false;
  for (;;) {
    let result: ProgressResult;
    try {
      result = await deps.send();
    } catch {
      result = { ok: false, status: 0 };
    }

    if (!result.ok && result.status === 0) {
      if (!waiting) {
        waiting = true;
        deps.onWaiting();
      }
      await deps.waitForOnline();
      continue;
    }

    if (waiting) deps.onSettled();
    deps.settle();
    if (!result.ok) deps.refresh();
    return;
  }
}
