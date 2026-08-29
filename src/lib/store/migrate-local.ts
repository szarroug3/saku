"use client";

// Sign-in merge: replay this browser's signed-out progress UP into the account,
// once, then forget the local copy.
//
// THE HANDOFF
// ===========
// While signed out, progress is saved locally (see local-progress.ts). The
// moment a real account exists, that local copy has done its job and should
// become account data — otherwise a learner who studied signed out, then signed
// in, would see their account start empty and their work stranded in one
// browser. So on the first authed load with local progress present, this reads
// the local history and lists and POSTs them through the normal API routes, the
// same writes a signed-in session makes. The server is now the durable copy; the
// local keys are cleared.
//
// WHY REPLAY IS SAFE TO REPEAT
// ============================
// Every upload is idempotent, which is what lets this be best-effort and
// retryable rather than a transaction:
//   - sessions dedupe on `id` server-side (saveSession), so a record posted
//     twice counts once.
//   - claims and seen just SET a timestamp per fact, so re-posting overwrites
//     with the same intent.
//   - a list save replaces the list with the same id; add/remove are set ops.
// So the failure plan is simply: clear a local key ONLY after its uploads
// succeed, and if anything fails leave that key in place to be retried on the
// next load. Nothing is lost by running twice; something is lost by clearing
// before the upload lands, so we never do.
//
// AND "SUCCEEDED" IS NOT THE SAME AS "GOT A 2xx" FOR LISTS. Two devices signing
// into one account within the same second both replayed their own lists over the
// same stale row: the later write won, both requests answered 2xx, and both
// devices then cleared local — so the losing device's lists were gone from the
// server AND the browser. The server write is compare-and-set now (lists.ts /
// lists-mutate.ts), which is the actual fix; on top of it, the lists key is
// cleared only after the account can be READ BACK holding every replayed id.
// The irreversible step gets independent evidence, not our own status code.
//
// GUARDING
// ========
// `runningOrDone` makes this fire at most once per page life — React effects run
// twice in development, "back online" and a fresh mount can overlap, and two
// concurrent replays would race on the clear. It is deliberately NOT persisted:
// a partial failure clears the flag so the next load retries, and a full success
// has already cleared the local keys, so hasLocalProgress() is the real "is
// there anything left to do" gate. And it never runs while signed out — the
// caller passes the server's own signed-in answer, and we re-check the browser
// session is a real, non-anonymous user before touching anything.

import { refreshSupabaseSession } from "@/lib/progress-fetch";
import { resolveProgressWrite } from "@/lib/progress-write";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FactId, ListsFile } from "@/types";

import {
  clearLocalHistory,
  clearLocalLists,
  hasLocalProgress,
  loadLocalHistory,
  loadLocalLists,
} from "./local-progress";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** In-flight / done for THIS page life. See the guarding note — not persisted,
 * because idempotent uploads plus clear-on-success are the real dedupe. */
let runningOrDone = false;

/** POST helper that answers one question: did the server accept this write. A
 * network throw or any non-2xx is "no", which keeps the local copy for a retry
 * — the opposite of the signed-out fallback, because here an account DOES exist
 * and the local copy must not be dropped until it is safely in it.
 *
 * A 401 during replay is ALWAYS a transient token lapse, never "no account":
 * migrateLocalProgress only runs signed in and re-confirms a real user first. So
 * this reuses the same signed-in decision the live write path uses — refresh the
 * session and retry the POST once (see progress-write.ts) — which unsticks the
 * replay in-session instead of stalling until the next page load. That lapsed
 * token is the very reason a phone's replay stalled. `signedIn: true` is fixed
 * here, so applyLocal is never reached (a migration never writes to local, it is
 * draining local UP into the account) — hence the no-op. Every non-2xx and every
 * throw still returns false, and the caller leaves the local key in place. */
async function post(url: string, body: unknown): Promise<boolean> {
  const { ok } = await resolveProgressWrite({
    send: () =>
      fetch(url, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      }),
    applyLocal: () => {},
    signedIn: true,
    refreshSession: refreshSupabaseSession,
  });
  return ok;
}

/**
 * Replay local history to the account. Returns true only if EVERYTHING that
 * needed sending was accepted (or there was nothing to send), which is the
 * gate for clearing the local history key.
 *
 * Sessions go one at a time, IN ORDER, stopping at the first refusal: the fold
 * is order-dependent (see aggregate.ts), so a later session must not land before
 * an earlier one. Claims and seen are each a single batched POST — the endpoints
 * take a facts array and stamp their own timestamp, so per-fact ordering does
 * not matter.
 */
async function replayHistory(): Promise<boolean> {
  const hist = loadLocalHistory();
  let allOk = true;

  for (const session of hist.sessions) {
    if (!(await post("/api/session", session))) return false; // keep the rest queued, in order
  }

  const claimed = Object.keys(hist.claims ?? {}) as FactId[];
  if (claimed.length && !(await post("/api/claim", { facts: claimed, known: true }))) {
    allOk = false;
  }

  const seen = Object.keys(hist.seen ?? {}) as FactId[];
  if (seen.length && !(await post("/api/seen", { facts: seen }))) {
    allOk = false;
  }

  for (const [key, ts] of Object.entries(hist.clearedMixups ?? {})) {
    if (!(await post("/api/mixup", { key, ts }))) allOk = false;
  }

  return allOk;
}

/**
 * Read the account's lists back and answer whether EVERY id in `ids` is present.
 *
 * The clear gate, not a nicety. Two devices signing in at the same second used
 * to each replay their own lists over a stale read; both got a 2xx and both
 * cleared their local copy, so the losing device's lists were gone from the
 * server AND the browser. The server side of that is fixed (lists writes are
 * compare-and-set now — see lists-mutate.ts), which makes a 2xx mean "landed on
 * top of whatever else arrived". This confirms it independently, so the
 * irreversible step — dropping the only other copy — rests on the account
 * actually HOLDING the lists rather than on our own request's status code.
 *
 * Anything that is not a clean, complete answer reads as "not yet": a non-2xx, a
 * network throw, unparseable JSON, a missing id. The cost of a false negative is
 * one harmless idempotent re-replay next load; the cost of a false positive is
 * the learner's lists.
 */
async function listsLanded(ids: readonly string[]): Promise<boolean> {
  try {
    const res = await fetch("/api/lists", { cache: "no-store" });
    if (!res.ok) return false;
    const file = (await res.json()) as Partial<ListsFile> | null;
    const have = new Set((file?.lists ?? []).map((l) => l.id));
    return ids.every((id) => have.has(id));
  } catch {
    return false;
  }
}

/**
 * Replay local lists to the account. Each list is saved whole under its own id
 * (idempotent replace), so a re-run overwrites rather than duplicates. Returns
 * true only if every list was accepted AND is then readable back from the
 * account — the gate for clearing the local lists key.
 */
async function replayLists(): Promise<boolean> {
  const lists = loadLocalLists();
  if (!lists.length) return true; // nothing to send, nothing to verify
  let allOk = true;
  for (const list of lists) {
    if (!(await post("/api/lists", list))) allOk = false;
  }
  // A refusal already means "keep the local copy"; don't spend a read to confirm
  // what we know. Only a clean sweep is worth verifying.
  if (!allOk) return false;
  return listsLanded(lists.map((l) => l.id));
}

/**
 * Merge signed-out local progress into the freshly signed-in account, once.
 *
 * `signedIn` is the server's answer (from the layout), passed so this never runs
 * for a signed-out visitor. We still confirm the browser holds a real,
 * non-anonymous session before writing — a stale prop or an anonymous user must
 * not trigger a replay against the wrong (or no) account.
 *
 * Best-effort and self-healing: each local key is cleared only after its uploads
 * succeed, and any failure leaves that key for the next load. Safe to call on
 * every authed mount — with nothing local, it returns immediately.
 *
 * Returns whether anything was actually replayed, which is the caller's cue to
 * re-read the history: the account it seeded the page with was read BEFORE these
 * uploads landed, so without a re-read the learner watches their merged work
 * arrive one navigation late.
 */
export async function migrateLocalProgress(signedIn: boolean): Promise<boolean> {
  if (!signedIn || runningOrDone) return false;
  if (typeof window === "undefined") return false;
  if (!hasLocalProgress()) return false;
  runningOrDone = true;
  try {
    // Confirm a real account is actually present in this browser. The app never
    // creates anonymous users, but a missing session or an anonymous one means
    // there is nowhere legitimate to replay to — leave the local copy untouched.
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) {
      runningOrDone = false; // not actually signed in — let a later load retry
      return false;
    }

    // Two independent keys, two independent clears: history succeeding must not
    // wait on lists, and neither is cleared until its own uploads land.
    const historyMerged = await replayHistory();
    if (historyMerged) clearLocalHistory();
    const listsMerged = await replayLists();
    if (listsMerged) clearLocalLists();

    // If anything failed, leave the flag DOWN so the next load retries the
    // leftovers (the succeeded keys are already gone, so the retry is small).
    if (hasLocalProgress()) runningOrDone = false;
    return historyMerged;
  } catch {
    // Unexpected failure — surface nothing to the learner (their local copy is
    // intact and the account still works), and allow a retry next load.
    runningOrDone = false;
    return false;
  }
}
