import { test, expect } from "../helpers/app";

/**
 * SAK-238: a basic smoke test for the Supabase auth wiring itself.
 *
 * Before this, 0 of the e2e suite's specs touched Supabase/auth/login/sync at
 * all — every other spec runs as the deterministic signed-out visitor
 * (SAKU_DISABLE_AUTH=1, see playwright.config.ts), which never constructs a
 * Supabase client. That left the actual client-construction code path
 * (src/lib/supabase/server.ts, exercised here through /auth/callback)
 * completely unexercised: SAKU_DISABLE_AUTH only short-circuits
 * isSupabaseStore()-gated callers (middleware, auth.ts), not the OAuth
 * callback route, which builds a Supabase server client unconditionally on
 * every hit. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * are still real, inlined at build time from .env.local regardless of
 * SAKU_DISABLE_AUTH, so this genuinely talks to the configured Supabase
 * project rather than mocking it.
 *
 * This does not (and cannot, without real Google credentials) drive a full
 * sign-in — it pins the two things that must never regress to an unhandled
 * crash: the sign-in page renders and offers a real control, and a bad/stale
 * magic-link hit is handled cleanly rather than 500ing.
 */

test("the sign-in page renders a working Google sign-in control", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle("Saku · Sign in");

  const signIn = page.getByRole("button", { name: /continue with google/i });
  await expect(signIn).toBeVisible();
  await expect(signIn).toBeEnabled();
});

test("a bad or expired magic link redirects to /login instead of crashing", async ({ page }) => {
  // No `code` and no `token_hash`/`type` — the route (src/app/auth/callback/route.ts)
  // still constructs the Supabase server client unconditionally before looking
  // at the params, then falls through to the /login?error=link redirect. This
  // pins that the real client construction (server.ts's
  // createSupabaseServerClient, guarded by requireSupabaseUrl /
  // requireSupabasePublishableKey — see src/lib/supabase/keys.ts) succeeds
  // against the configured project instead of 500ing.
  const response = await page.goto("/auth/callback");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login\?error=link/);
});

test("an invalid code exchange redirects to /login instead of crashing", async ({ page }) => {
  // A syntactically-present but bogus PKCE code takes the exchangeCodeForSession
  // branch and gets a real error back from Supabase, then falls through to the
  // same clean redirect — a live round trip through the guarded server client,
  // not just the "no params at all" shortcut above.
  const response = await page.goto("/auth/callback?code=not-a-real-code");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login\?error=link/);
});
