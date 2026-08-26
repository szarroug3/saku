// SAK-202: auth.ts's sessionUserId replaces supabase.auth.getUser() (always a
// network round trip) with supabase.auth.getClaims() (local JWT verification
// when the signing key is asymmetric, which this project's is). This file
// cannot import auth.ts directly and drive sessionUserId end to end: it calls
// next/headers' cookies(), which throws outside a real Next.js request (see
// node_modules/next/dist/server/request/cookies.js's
// throwForMissingRequestStore — reached whenever there is no work-unit-async
// -storage context, i.e. always in a bare `node --test` run), and it is
// wrapped in React's cache(), which also expects a render/request context.
// Neither this file nor any other test in the repo works around that.
//
// What IS testable, and is exactly the part this ticket depends on being
// correct, is @supabase/auth-js's getClaims() itself — real SDK code, not
// reimplemented in auth.ts, exercised here for real (via a plain
// createClient(), not the cookie-backed SSR client) against JWTs this file
// signs itself:
//   - ES256 (asymmetric, matching this project's actual signing key per the
//     ticket): the matching public key is passed in via getClaims' own
//     `jwks` option, so verification happens locally through WebCrypto with
//     no network involved — this is the fast path SAK-202 relies on, and the
//     assertion is that it resolves the same `sub` getUser() would have
//     returned as `user.id`.
//   - HS256 (symmetric, the legacy/rotated-away-from case): getClaims() is
//     expected to fall back to a real getUser() network call by itself (that
//     fallback lives in @supabase/auth-js and is deliberately not duplicated
//     in auth.ts) — mocking global.fetch the same way
//     src/app/api/tts/route.test.ts does confirms it still resolves the
//     right id, and that the returned header.alg is exactly the condition
//     auth.ts's fallback-detection warning checks for.
//
// See src/lib/supabase/session-cookie.test.ts for the other half: whether a
// request even has a session cookie worth verifying at all.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { afterEach, mock, test } from "node:test";

import { createClient } from "@supabase/supabase-js";

afterEach(() => {
  mock.restoreAll();
});

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

const USER_ID = "11111111-1111-1111-1111-111111111111";

function claimsPayload() {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "https://fake.supabase.co/auth/v1",
    sub: USER_ID,
    aud: "authenticated",
    exp: now + 3600,
    iat: now,
    role: "authenticated",
    aal: "aal1",
    session_id: "22222222-2222-2222-2222-222222222222",
  };
}

test("getClaims(): a valid ES256 (asymmetric) JWT resolves the same id getUser() would, verified locally", async () => {
  // This is this project's actual signing key type (confirmed against the
  // Supabase dashboard per the ticket) — the fast path SAK-202 depends on.
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const header = { alg: "ES256", typ: "JWT", kid: "test-kid" };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claimsPayload()))}`;
  const signature = crypto.sign(null, Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  const jwt = `${signingInput}.${b64url(signature)}`;
  const jwk = {
    ...publicKey.export({ format: "jwk" }),
    kty: "EC" as const,
    kid: "test-kid",
    alg: "ES256",
    use: "sig",
    key_ops: ["verify"],
  };

  const calls: string[] = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    calls.push(String(input));
    throw new Error("must not be called: the matching JWK was supplied directly");
  });

  const supabase = createClient("https://fake.supabase.co", "fake-anon-key");
  // Passing the JWK via `jwks` is what makes verification local here (see
  // fetchJwk in @supabase/auth-js: it checks the supplied jwks before ever
  // touching the network or its own cache) — the real sessionUserId path in
  // auth.ts instead relies on the project's real (asymmetric) signing key
  // being fetched once and cached process-wide, per the ticket's diagnosis.
  const { data, error } = await supabase.auth.getClaims(jwt, { jwks: { keys: [jwk] } });

  assert.equal(error, null);
  assert.equal(
    data?.claims.sub,
    USER_ID,
    "getClaims' sub claim is the same id getUser() returns as user.id — this is the exact field auth.ts reads",
  );
  assert.equal(data?.header.alg, "ES256");
  assert.equal(calls.length, 0, "local ECDSA verification must not touch the network");
});

test("getClaims(): a legacy HS256 (symmetric) JWT falls back to a network getUser() call and still resolves", async () => {
  const header = { alg: "HS256", typ: "JWT" };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claimsPayload()))}`;
  const signature = crypto.createHmac("sha256", "test-secret").update(signingInput).digest();
  const jwt = `${signingInput}.${b64url(signature)}`;

  const calls: string[] = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ id: USER_ID, aud: "authenticated" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const supabase = createClient("https://fake.supabase.co", "fake-anon-key");
  const { data, error } = await supabase.auth.getClaims(jwt);

  assert.equal(error, null);
  assert.equal(data?.claims.sub, USER_ID);
  assert.ok(
    calls.some((u) => u.endsWith("/auth/v1/user")),
    "HS256 must fall back to GET .../user, same request getUser() makes",
  );
  assert.ok(
    data?.header.alg.startsWith("HS"),
    "this is exactly the condition auth.ts's fallback-detection warning checks for",
  );
});
