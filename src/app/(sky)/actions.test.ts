// A forged action call, both ways (SAK-445).
//
// The page gate is not the whole of it: a server action is a POST anybody can
// write, so `{ sample: true }` can arrive at one whatever the page it claims
// to come from. With the dev surfaces off it must read as no claim at all, and
// the action must answer with what the real caller has, which for a visitor
// with no account and no browser copy is nothing.
//
// `loadSessions` is the read under test because the two answers cannot be
// confused: the pretend learner was built with recorded quizzes in it, and a
// visitor who has done nothing has none. The account read is mocked, since
// `currentUserId` wants a real Next request to read its cookie from.

import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import type { FactId } from "@/types/facts";

mock.module("@/lib/auth", {
  namedExports: { currentUserId: async () => null },
});

const { loadSessions } = await import("./actions.ts");

const env = process.env as Record<string, string | undefined>;
const SAVED_SWITCH = env.SAKU_DEV_SURFACES;
const SAVED_NODE_ENV = env.NODE_ENV;

beforeEach(() => {
  delete env.SAKU_DEV_SURFACES;
  env.NODE_ENV = "production";
});

afterEach(() => {
  if (SAVED_SWITCH === undefined) delete env.SAKU_DEV_SURFACES;
  else env.SAKU_DEV_SURFACES = SAVED_SWITCH;
  if (SAVED_NODE_ENV === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = SAVED_NODE_ENV;
});

test("on: an action asked for the pretend learner serves the pretend learner", async () => {
  env.SAKU_DEV_SURFACES = "1";
  const sessions = await loadSessions({ sample: true });
  assert.ok(sessions.length > 0, "the pretend learner has recorded quizzes");
});

test("off: a forged sample gets the visitor's empty data, not the pretend learner's", async () => {
  assert.deepEqual(await loadSessions({ sample: true }), []);
});

test("off: a forged sample gets the caller's own browser copy when they sent one", async () => {
  const { emptyHistory } = await import("@/lib/history-ops");
  const local = emptyHistory();
  const fact = "kana:あ/reading" as FactId;
  local.facts[fact] = { seen: 1, missed: 0, firstTry: 1, correct: 1, stability: 1, lastTested: Date.now(), recentRuns: [{ firstTry: true, eventually: true }] };
  local.sessions.push({ id: "mine", ts: Date.now(), mode: "drill", redrill: false, total: 1, forgivingPct: 100, strictPct: 100, facts: { [fact]: { seen: 1, missed: 0, firstTry: 1, correct: 1 } }, detail: {} });
  const sessions = await loadSessions({ sample: true, local });
  assert.deepEqual(sessions.map((s) => s.id), ["mine"], "the real caller's own session, and only that");
});
