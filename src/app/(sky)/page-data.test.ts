// `whoFor` with the dev surfaces on and off (SAK-445). Every Sky page reads
// `?sample` through this one function, so what it answers is what the whole
// page half of the gate does.
//
// The account read is mocked because `currentUserId` wants a real Next request
// to read a cookie from. Which is also the point of one assertion below: with
// the surfaces off, `?sample` must stop skipping that read, because skipping
// it is how a typed word became "this page is for somebody else".

import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

let userId: string | null = null;
let asked = 0;

mock.module("@/lib/auth", {
  namedExports: {
    currentUserId: async () => { asked++; return userId; },
  },
});

// after the mock, so page-data.ts's own import resolves to it
const { whoFor } = await import("./page-data.ts");

const env = process.env as Record<string, string | undefined>;
const SAVED_SWITCH = env.SAKU_DEV_SURFACES;
const SAVED_NODE_ENV = env.NODE_ENV;

const on = () => { env.SAKU_DEV_SURFACES = "1"; };

beforeEach(() => {
  delete env.SAKU_DEV_SURFACES;
  env.NODE_ENV = "production";
  userId = null;
  asked = 0;
});

afterEach(() => {
  if (SAVED_SWITCH === undefined) delete env.SAKU_DEV_SURFACES;
  else env.SAKU_DEV_SURFACES = SAVED_SWITCH;
  if (SAVED_NODE_ENV === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = SAVED_NODE_ENV;
});

test("on: ?sample is the pretend learner and asks nobody's account", async () => {
  on();
  assert.deepEqual(await whoFor({ sample: "" }), { sample: true, signedIn: false, who: { sample: true } });
  assert.equal(asked, 0);
});

test("off: ?sample on a signed-out visitor is a plain visitor page", async () => {
  // no data from the server, the client loads the browser's own copy
  assert.deepEqual(await whoFor({ sample: "" }), { sample: false, signedIn: false, who: null });
  assert.equal(asked, 1, "the real caller's identity is read, not skipped");
});

test("off: ?sample on a signed-in learner is that learner's own page", async () => {
  userId = "a-real-account";
  assert.deepEqual(await whoFor({ sample: "" }), { sample: false, signedIn: true, who: {} });
});

test("off: a page with no flag on it is what it always was", async () => {
  assert.deepEqual(await whoFor({}), { sample: false, signedIn: false, who: null });
  userId = "a-real-account";
  assert.deepEqual(await whoFor({}), { sample: false, signedIn: true, who: {} });
});

test("a pretend page reads nobody's account either", async () => {
  // the lesson's showcase, which decides on `devFlag` before it gets here
  assert.deepEqual(await whoFor({}, true), { sample: false, signedIn: true, who: null });
  assert.equal(asked, 0);
});
