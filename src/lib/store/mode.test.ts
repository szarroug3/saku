// isSupabaseStore is the fork point that decides whether every page render
// treats a visitor as signed-out/local (localStorage progress) or
// signed-in/synced (Supabase-backed progress) — see mode.ts's own comment.
// Pin both branches directly: env configured -> true, env missing -> false,
// plus the SAK-* test-only auth switch that forces the signed-out branch
// even when Supabase env is otherwise present.

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { isSupabaseStore } from "./mode.ts";

const SAVED_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SAVED_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SAVED_DISABLE_AUTH = process.env.SAKU_DISABLE_AUTH;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SAKU_DISABLE_AUTH;
});

afterEach(() => {
  if (SAVED_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = SAVED_URL;

  if (SAVED_KEY === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = SAVED_KEY;

  if (SAVED_DISABLE_AUTH === undefined) delete process.env.SAKU_DISABLE_AUTH;
  else process.env.SAKU_DISABLE_AUTH = SAVED_DISABLE_AUTH;
});

test("synced mode: both Supabase env vars present -> true", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fake";
  assert.equal(isSupabaseStore(), true);
});

test("local-only mode: no Supabase env at all (bare checkout / CI) -> false", () => {
  assert.equal(isSupabaseStore(), false);
});

test("local-only mode: URL present but publishable key missing -> false", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
  assert.equal(isSupabaseStore(), false);
});

test("local-only mode: publishable key present but URL missing -> false", () => {
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fake";
  assert.equal(isSupabaseStore(), false);
});

test("local-only mode: SAKU_DISABLE_AUTH=1 forces signed-out even with full Supabase env present", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fake";
  process.env.SAKU_DISABLE_AUTH = "1";
  assert.equal(isSupabaseStore(), false);
});
