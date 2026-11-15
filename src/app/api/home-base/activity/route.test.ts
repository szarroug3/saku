// The route's gates and its one read, with the secret-key client swapped for a
// fake so no test reaches a real database. The rows' shape is covered beside
// it in src/lib/home-base-activity.test.ts.

import assert from "node:assert/strict";
import { afterEach, before, beforeEach, mock, test } from "node:test";

import type { QuizSessionRecord } from "@/types/store";

interface Read {
  data: { history: unknown } | null;
  error: { message: string } | null;
}

let configured = true;
let read: Read = { data: null, error: null };
let askedFor: { table?: string; userId?: string } = {};

before(() => {
  mock.module("@/lib/supabase/admin", {
    namedExports: {
      createAdminClient: () =>
        configured
          ? {
              from: (table: string) => ({
                select: () => ({
                  eq: (_col: string, userId: string) => ({
                    maybeSingle: async () => {
                      askedFor = { table, userId };
                      return read;
                    },
                  }),
                }),
              }),
            }
          : null,
    },
  });
});

const ENV_KEYS = ["HOME_BASE_TOKEN", "HOME_BASE_USER_ID"] as const;
let saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.HOME_BASE_TOKEN = "test-token";
  process.env.HOME_BASE_USER_ID = "owner-id";
  configured = true;
  read = { data: null, error: null };
  askedFor = {};
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const call = async (auth: string | null, since: string | null = "2026-11-01T00:00:00Z") => {
  const { GET } = await import("./route.ts");
  const url = `https://saku.test/api/home-base/activity${since === null ? "" : `?since=${encodeURIComponent(since)}`}`;
  return GET(new Request(url, { headers: auth === null ? {} : { authorization: auth } }));
};

const session = (id: string, iso: string): QuizSessionRecord => ({
  id,
  ts: Date.parse(iso),
  mode: "drill",
  redrill: false,
  total: 10,
  forgivingPct: 90,
  strictPct: 80,
  facts: {},
});

test("401 without a token, with a wrong one, and when none is configured", async () => {
  assert.equal((await call(null)).status, 401);
  assert.equal((await call("Bearer nope")).status, 401);
  delete process.env.HOME_BASE_TOKEN;
  assert.equal((await call("Bearer test-token")).status, 401);
  assert.deepEqual(askedFor, {}, "nothing is read before the token passes");
});

test("400 when since is missing or not a time", async () => {
  assert.equal((await call("Bearer test-token", null)).status, 400);
  assert.equal((await call("Bearer test-token", "yesterday-ish")).status, 400);
});

test("503 when the owner or the database is not configured", async () => {
  delete process.env.HOME_BASE_USER_ID;
  assert.equal((await call("Bearer test-token")).status, 503);
  process.env.HOME_BASE_USER_ID = "owner-id";
  configured = false;
  assert.equal((await call("Bearer test-token")).status, 503);
});

test("502 when the read fails", async () => {
  read = { data: null, error: { message: "boom" } };
  assert.equal((await call("Bearer test-token")).status, 502);
});

test("the owner's records since `since`, newest first, linked to Sessions", async () => {
  read = {
    data: {
      history: {
        sessions: [
          session("old", "2026-10-20T09:00:00Z"),
          session("a", "2026-11-02T09:00:00Z"),
          session("b", "2026-11-05T09:00:00Z"),
        ],
      },
    },
    error: null,
  };
  const res = await call("Bearer test-token");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(askedFor, { table: "progress", userId: "owner-id" });
  const body = (await res.json()) as { activity: { id: string; url?: string; kind: string }[]; streak?: unknown };
  assert.deepEqual(body.activity.map((r) => r.id), ["b", "a"]);
  assert.equal(body.activity[0].kind, "quiz");
  assert.equal(body.activity[0].url, "https://saku.test/sessions");
  assert.ok(!("streak" in body), "Saku keeps no streak, so none is sent");
});

test("an owner with no progress row gets an empty list", async () => {
  const res = await call("Bearer test-token");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { activity: [] });
});
