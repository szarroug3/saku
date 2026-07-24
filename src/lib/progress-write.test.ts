// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/progress-write.test.ts
//
// The one decision that silently dropped a real user's progress: what a 401 on a
// write MEANS. It is opposite for the two people who can see one —
//
//   signed OUT: no account exists, this browser is the store → save local,
//               report ok, let the outbox drop it.
//   signed IN:  an account exists and the token just lapsed → refresh + retry
//               once; NEVER save local, NEVER a false ok, and if the retry still
//               fails keep it queued (ok:false) so the banner shows.
//
// These pin exactly that fork, plus the safe default (unknown auth → treat as
// signed in, i.e. keep queued, because dropping is the only unrecoverable move).
// All IO is injected, so the real branching runs with no network or DOM.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveProgressWrite, type WriteResponse } from "./progress-write.ts";
import { isSignedIn, resetAuthMode, setAuthMode } from "./auth-mode.ts";

/** A scriptable `send`: hands back the queued responses in order (one per POST
 * attempt), and counts how many times it was called so a test can assert the
 * retry did or did not happen. A `null` entry throws, standing in for a network
 * failure. */
function scriptedSend(responses: (WriteResponse | null)[]) {
  const calls: number[] = [];
  let i = 0;
  const send = async (): Promise<WriteResponse> => {
    calls.push(++i);
    const r = responses[i - 1];
    if (r == null) throw new Error("network");
    return r;
  };
  return { send, get count() { return calls.length; } };
}

/** Records whether applyLocal / refreshSession fired, for the assertions that
 * matter most: a signed-in 401 must NEVER touch local. */
function spies() {
  const state = { local: 0, refresh: 0 };
  return {
    state,
    applyLocal: () => void state.local++,
    refreshSession: async () => void state.refresh++,
  };
}

const OK: WriteResponse = { ok: true, status: 200 };
const UNAUTH: WriteResponse = { ok: false, status: 401 };
const UNREADABLE: WriteResponse = { ok: false, status: 503 };

describe("resolveProgressWrite", () => {
  test("2xx passes through: no local, no refresh", async () => {
    const send = scriptedSend([OK]);
    const s = spies();
    const res = await resolveProgressWrite({
      send: send.send,
      applyLocal: s.applyLocal,
      signedIn: true,
      refreshSession: s.refreshSession,
    });
    assert.deepEqual(res, { ok: true, status: 200 });
    assert.equal(send.count, 1);
    assert.equal(s.state.local, 0);
    assert.equal(s.state.refresh, 0);
  });

  test("503 keeps it queued (ok:false), nothing local, whether signed in or out", async () => {
    for (const signedIn of [true, false]) {
      const send = scriptedSend([UNREADABLE]);
      const s = spies();
      const res = await resolveProgressWrite({
        send: send.send,
        applyLocal: s.applyLocal,
        signedIn,
        refreshSession: s.refreshSession,
      });
      assert.deepEqual(res, { ok: false, status: 503 });
      assert.equal(s.state.local, 0);
      assert.equal(s.state.refresh, 0);
    }
  });

  test("network throw → ok:false status:0, nothing local", async () => {
    const send = scriptedSend([null]);
    const s = spies();
    const res = await resolveProgressWrite({
      send: send.send,
      applyLocal: s.applyLocal,
      signedIn: true,
      refreshSession: s.refreshSession,
    });
    assert.deepEqual(res, { ok: false, status: 0 });
    assert.equal(s.state.local, 0);
    assert.equal(s.state.refresh, 0);
  });

  // ---- THE FORK: 401 ----

  test("signed OUT 401 → applyLocal and report ok:true (no regression)", async () => {
    const send = scriptedSend([UNAUTH]);
    const s = spies();
    const res = await resolveProgressWrite({
      send: send.send,
      applyLocal: s.applyLocal,
      signedIn: false,
      refreshSession: s.refreshSession,
    });
    assert.deepEqual(res, { ok: true, status: 401 });
    assert.equal(s.state.local, 1, "signed-out 401 writes local");
    assert.equal(s.state.refresh, 0, "signed-out never refreshes");
    assert.equal(send.count, 1, "signed-out never retries");
  });

  test("signed IN 401 then refresh+retry SUCCEEDS → ok:true, and NEVER local", async () => {
    const send = scriptedSend([UNAUTH, OK]);
    const s = spies();
    const res = await resolveProgressWrite({
      send: send.send,
      applyLocal: s.applyLocal,
      signedIn: true,
      refreshSession: s.refreshSession,
    });
    assert.deepEqual(res, { ok: true, status: 200 }, "the retry landed");
    assert.equal(s.state.local, 0, "a signed-in write must never go local");
    assert.equal(s.state.refresh, 1, "it refreshed before retrying");
    assert.equal(send.count, 2, "it retried exactly once");
  });

  test("signed IN 401 then retry STILL 401 → ok:false (stays queued), NEVER local", async () => {
    const send = scriptedSend([UNAUTH, UNAUTH]);
    const s = spies();
    const res = await resolveProgressWrite({
      send: send.send,
      applyLocal: s.applyLocal,
      signedIn: true,
      refreshSession: s.refreshSession,
    });
    assert.deepEqual(res, { ok: false, status: 401 }, "kept queued, banner shows");
    assert.equal(s.state.local, 0, "the record must NOT be stranded on this device");
    assert.equal(s.state.refresh, 1);
    assert.equal(send.count, 2);
  });

  test("signed IN 401 then retry throws (offline mid-refresh) → ok:false, no local", async () => {
    const send = scriptedSend([UNAUTH, null]);
    const s = spies();
    const res = await resolveProgressWrite({
      send: send.send,
      applyLocal: s.applyLocal,
      signedIn: true,
      refreshSession: s.refreshSession,
    });
    assert.deepEqual(res, { ok: false, status: 0 });
    assert.equal(s.state.local, 0);
  });

  test("retry does NOT loop: a signed-in write refreshes and retries at most once", async () => {
    // Three 401s available, but only two sends may happen (original + one retry).
    const send = scriptedSend([UNAUTH, UNAUTH, UNAUTH]);
    const s = spies();
    await resolveProgressWrite({
      send: send.send,
      applyLocal: s.applyLocal,
      signedIn: true,
      refreshSession: s.refreshSession,
    });
    assert.equal(send.count, 2, "original + exactly one retry, never more");
    assert.equal(s.state.refresh, 1);
  });
});

describe("auth-mode signal wiring", () => {
  test("unknown auth defaults to signed-in (keep-queued), so a 401 is NOT dropped", async () => {
    resetAuthMode();
    assert.equal(isSignedIn(), true, "unknown must read as signed-in");

    // Drive the real decision using the uninitialised signal: a 401 with a dead
    // retry must come back ok:false and never write local — the safe default.
    const send = scriptedSend([UNAUTH, UNAUTH]);
    const s = spies();
    const res = await resolveProgressWrite({
      send: send.send,
      applyLocal: s.applyLocal,
      signedIn: isSignedIn(),
      refreshSession: s.refreshSession,
    });
    assert.deepEqual(res, { ok: false, status: 401 });
    assert.equal(s.state.local, 0, "unknown auth must not drop to local");
  });

  test("setAuthMode(false) flips to the signed-out local fallback", async () => {
    resetAuthMode();
    setAuthMode({ signedIn: false });
    assert.equal(isSignedIn(), false);

    const send = scriptedSend([UNAUTH]);
    const s = spies();
    const res = await resolveProgressWrite({
      send: send.send,
      applyLocal: s.applyLocal,
      signedIn: isSignedIn(),
      refreshSession: s.refreshSession,
    });
    assert.deepEqual(res, { ok: true, status: 401 });
    assert.equal(s.state.local, 1);
    resetAuthMode();
  });

  test("setAuthMode(true) selects the refresh+retry path", async () => {
    resetAuthMode();
    setAuthMode({ signedIn: true });
    assert.equal(isSignedIn(), true);
    resetAuthMode();
  });
});
