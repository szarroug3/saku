// SAK-238: requireSupabaseUrl / requireSupabasePublishableKey are the guard
// that replaced a bare `!` at every Supabase client construction site
// (client.ts, server.ts, middleware.ts, session-cookie.ts,
// library/content-entries.ts). Before this, a missing/renamed env var meant
// `undefined` sailed past the `!` and crashed, unhandled, deep inside
// @supabase/ssr's client constructor. These tests are the one place that
// behavior is pinned: a missing var must throw a clear, actionable
// SupabaseConfigError naming the exact var, and a present var must pass
// through unchanged.

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  requireSupabasePublishableKey,
  requireSupabaseUrl,
  SupabaseConfigError,
} from "./keys.ts";

const SAVED_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SAVED_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
});

afterEach(() => {
  if (SAVED_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = SAVED_URL;

  if (SAVED_KEY === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = SAVED_KEY;
});

test("requireSupabaseUrl: present -> returns it", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
  assert.equal(requireSupabaseUrl(), "https://fake.supabase.co");
});

test("requireSupabaseUrl: missing -> throws a clear SupabaseConfigError naming the var", () => {
  assert.throws(
    () => requireSupabaseUrl(),
    (err: unknown) => {
      assert.ok(err instanceof SupabaseConfigError);
      assert.match((err as Error).message, /NEXT_PUBLIC_SUPABASE_URL/);
      assert.match((err as Error).message, /not configured/);
      return true;
    },
  );
});

test("requireSupabaseUrl: empty string (misconfigured, not merely absent) -> throws", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  assert.throws(() => requireSupabaseUrl(), SupabaseConfigError);
});

test("requireSupabasePublishableKey: present -> returns it", () => {
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fake";
  assert.equal(requireSupabasePublishableKey(), "sb_publishable_fake");
});

test("requireSupabasePublishableKey: missing -> throws a clear SupabaseConfigError naming the var", () => {
  assert.throws(
    () => requireSupabasePublishableKey(),
    (err: unknown) => {
      assert.ok(err instanceof SupabaseConfigError);
      assert.match((err as Error).message, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
      return true;
    },
  );
});
