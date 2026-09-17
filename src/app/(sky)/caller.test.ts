// The two gates the dev surfaces open through (SAK-445): what a page reads
// off its URL, and what an action believes about the `Who` it was handed.
//
// The second is the one that matters for a deployed server. A page's query is
// visible; a server action's argument is a POST body, and a forged one asking
// to be the pretend learner must come back as the real caller, with whatever
// the real caller sent still intact.

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { emptyHistory } from "@/lib/history-ops";

import { devFlag, trustedWho } from "./caller.ts";

const env = process.env as Record<string, string | undefined>;
const SAVED_SWITCH = env.SAKU_DEV_SURFACES;
const SAVED_NODE_ENV = env.NODE_ENV;

/** A deployed production server: no variable, a production build. */
const off = () => { delete env.SAKU_DEV_SURFACES; env.NODE_ENV = "production"; };
/** The e2e suite and local development. */
const on = () => { env.SAKU_DEV_SURFACES = "1"; env.NODE_ENV = "production"; };

beforeEach(off);

afterEach(() => {
  if (SAVED_SWITCH === undefined) delete env.SAKU_DEV_SURFACES;
  else env.SAKU_DEV_SURFACES = SAVED_SWITCH;
  if (SAVED_NODE_ENV === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = SAVED_NODE_ENV;
});

test("on: the pretend learner is who they say they are", () => {
  on();
  assert.deepEqual(trustedWho({ sample: true }), { sample: true });
});

test("off: a forged sample is dropped, and the caller is a visitor with nothing", () => {
  assert.deepEqual(trustedWho({ sample: true }), { local: undefined });
});

test("off: a forged sample does not cost the caller their own history", () => {
  // the shape a signed-out visitor's browser really sends: their own copy,
  // beside a flag they never asked for
  const local = { ...emptyHistory(), claims: { "kana:あ/reading": 1 } };
  const trusted = trustedWho({ sample: true, local });
  assert.equal(trusted.sample, undefined);
  assert.equal(trusted.local, local);
});

test("off: a caller who claimed nothing is handed through untouched", () => {
  const signedIn = {};
  assert.equal(trustedWho(signedIn), signedIn);
  const local = { local: emptyHistory() };
  assert.equal(trustedWho(local), local);
});

test("off: a sample that is already false is not a claim, so nothing is rebuilt", () => {
  const who = { sample: false, local: emptyHistory() };
  assert.equal(trustedWho(who), who);
});

test("a dev-only query key is present only when the surfaces are on", () => {
  // `?sample` and `?showcase` arrive as the empty string, not as a value
  assert.equal(devFlag({ sample: "" }, "sample"), false);
  assert.equal(devFlag({ showcase: "" }, "showcase"), false);
  on();
  assert.equal(devFlag({ sample: "" }, "sample"), true);
  assert.equal(devFlag({ showcase: "" }, "showcase"), true);
});

test("a key that was never typed is absent either way", () => {
  assert.equal(devFlag({ picks: "kana-row:h-vowels" }, "sample"), false);
  on();
  assert.equal(devFlag({ picks: "kana-row:h-vowels" }, "sample"), false);
});
