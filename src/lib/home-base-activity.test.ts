import assert from "node:assert/strict";
import { test } from "node:test";

import { activitySince, activityTitle, bearerMatches, toActivity } from "./home-base-activity.ts";
import type { QuizSessionRecord } from "@/types/store";

const record = (over: Partial<QuizSessionRecord> = {}): QuizSessionRecord => ({
  id: "r1",
  ts: Date.parse("2026-11-10T12:00:00Z"),
  mode: "drill",
  redrill: false,
  total: 20,
  forgivingPct: 85,
  strictPct: 70,
  facts: {},
  ...over,
});

test("bearerMatches takes only the exact token", () => {
  assert.equal(bearerMatches("Bearer s3cret", "s3cret"), true);
  assert.equal(bearerMatches("bearer s3cret", "s3cret"), true);
  assert.equal(bearerMatches("Bearer s3cre", "s3cret"), false);
  assert.equal(bearerMatches("Bearer s3cret-and-more", "s3cret"), false);
  assert.equal(bearerMatches("s3cret", "s3cret"), false);
  assert.equal(bearerMatches(null, "s3cret"), false);
});

test("bearerMatches refuses everything when no token is configured", () => {
  assert.equal(bearerMatches("Bearer ", undefined), false);
  assert.equal(bearerMatches("Bearer anything", undefined), false);
  assert.equal(bearerMatches("Bearer anything", ""), false);
});

test("a drill is a Quiz, a practice run says so with its deck's name", () => {
  assert.equal(activityTitle(record()), "Quiz");
  assert.equal(activityTitle(record({ mode: "assembly" })), "Sentence ordering");
  assert.equal(activityTitle(record({ practice: {} })), "Practice");
  assert.equal(activityTitle(record({ practice: { name: "Evening drill" } })), "Practice: Evening drill");
});

test("a row carries the learner's score, its count and when it happened", () => {
  const row = toActivity(record(), "https://saku.test/sessions");
  assert.deepEqual(row, {
    id: "r1",
    at: "2026-11-10T12:00:00.000Z",
    kind: "quiz",
    title: "Quiz",
    total: 20,
    correct: 17,
    accuracy: 85,
    url: "https://saku.test/sessions",
  });
});

test("the note says redrill and how many rounds, and is absent otherwise", () => {
  assert.equal(toActivity(record({ redrill: true, rounds: 3 })).note, "Redrill · 3 rounds");
  assert.equal(toActivity(record({ rounds: 1 })).note, undefined);
  assert.ok(!("note" in toActivity(record())));
});

test("an old record without an id gets the same id on every read", () => {
  const old = record({ id: undefined, mode: "pairs" });
  assert.equal(toActivity(old).id, `${old.ts}-pairs`);
  assert.equal(toActivity(old).id, toActivity({ ...old }).id);
});

test("activitySince keeps records at or after since, newest first", () => {
  const since = Date.parse("2026-11-10T00:00:00Z");
  const rows = activitySince(
    [
      record({ id: "before", ts: since - 1 }),
      record({ id: "at", ts: since }),
      record({ id: "later", ts: since + 60_000 }),
    ],
    since,
  );
  assert.deepEqual(rows.map((r) => r.id), ["later", "at"]);
});
