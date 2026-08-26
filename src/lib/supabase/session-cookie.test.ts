// SAK-202: hasSupabaseSessionCookie is pure (a cookie list in, a boolean
// out), which is exactly why it lives in its own module instead of inline in
// auth.ts — auth.ts's sessionUserId needs next/headers' cookies() for the
// real request, and importing auth.ts here would drag that in too. next's
// cookies() throws outside a real Next.js request (see
// node_modules/next/dist/server/request/cookies.js's
// throwForMissingRequestStore, reached whenever there is no work-unit
// -async-storage context, i.e. always in a bare `node --test` run), so this
// file tests the part that is actually testable: given a cookie jar, does
// this correctly decide whether there is a session to revalidate at all.
//
// "no cookie -> zero Supabase calls" is the specific behavior SAK-202 exists
// for. It is verified two ways here instead of one end-to-end test: the
// first case below (empty jar -> false), plus reading src/lib/auth.ts
// itself — sessionUserId returns right after a false from this function,
// before createSupabaseServerClient is ever referenced, let alone called.

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { hasSupabaseSessionCookie } from "./session-cookie.ts";

const SAVED_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

beforeEach(() => {
  // hasSupabaseSessionCookie derives the cookie key from the project ref in
  // this URL ("fake" here) the same way @supabase/supabase-js derives its own
  // default storageKey — see the comment on supabaseAuthCookieKey in
  // session-cookie.ts for exactly where that formula was confirmed. Set
  // explicitly rather than relying on .env.local so this is deterministic
  // regardless of what project a real local .env.local points at.
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
});

afterEach(() => {
  if (SAVED_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = SAVED_URL;
});

const SESSION_COOKIE = "sb-fake-auth-token";

test("hasSupabaseSessionCookie: no cookies at all -> false", () => {
  assert.equal(hasSupabaseSessionCookie([]), false);
});

test("hasSupabaseSessionCookie: unrelated cookies only -> false", () => {
  assert.equal(
    hasSupabaseSessionCookie([{ name: "theme" }, { name: "sb-fake-auth-token-code-verifier" }]),
    false,
    "a PKCE code-verifier cookie means a login flow started, not that a session exists",
  );
});

test("hasSupabaseSessionCookie: exact session cookie present -> true", () => {
  assert.equal(hasSupabaseSessionCookie([{ name: SESSION_COOKIE }]), true);
});

test("hasSupabaseSessionCookie: chunked session cookie (.0, .1, ...) -> true", () => {
  assert.equal(
    hasSupabaseSessionCookie([{ name: `${SESSION_COOKIE}.0` }, { name: `${SESSION_COOKIE}.1` }]),
    true,
    "large sessions are split across numbered chunk cookies by @supabase/ssr",
  );
});

test("hasSupabaseSessionCookie: a cookie merely prefixed the same way is not a chunk -> false", () => {
  // isChunkLike requires the exact key before the trailing ".N" — a
  // differently-named cookie that happens to share the prefix must not match.
  assert.equal(hasSupabaseSessionCookie([{ name: `${SESSION_COOKIE}-extra.0` }]), false);
});
