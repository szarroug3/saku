import { type NextRequest } from "next/server";

import { formatPhases } from "@/lib/server-timing";
import { updateSession } from "@/lib/supabase/middleware";

// One job: keep the Supabase session fresh and gate the app behind sign-in (see
// updateSession). The matcher skips Next's internal assets and the static image
// folders, so those never pay the auth cost.
//
// This is Next's proxy convention (formerly "middleware", renamed in Next 16).
// It MUST live in src/ (not the repo root): the app is under src/app, and Next
// only picks up the proxy file next to that app directory. A root-level one is
// silently ignored, which stops the session ever refreshing — the access token
// then expires, the server reads no user, and the home page shows a signed-in
// learner the landing and its "Continue with Google" button.

export async function proxy(request: NextRequest) {
  // When the request reached the edge, for the page to measure how long the
  // function took to get to its render: on a cold process that is the whole
  // load of the route's modules, which nothing inside them can time (SAK-399).
  request.headers.set("x-edge-at", String(Date.now()));
  // Timed, and reported (SAK-382). `updateSession` calls
  // `supabase.auth.getUser()`, which is a network round trip to Supabase's
  // auth server on EVERY matched request. SAK-202 replaced that same call in
  // auth.ts with `getClaims()`, which verifies locally, and priced the network
  // one at about 1.2 s in that file's own comment; this one was left as it
  // was. Whether it is actually costing that here is the sort of thing that
  // has to be measured on the function rather than guessed at from a laptop,
  // so the answer rides back on the response.
  const started = performance.now();
  const response = await updateSession(request);
  const spent = performance.now() - started;
  // Where the request LANDED, which is not where the page is rendered: a proxy
  // runs at the edge, near whoever asked, and the serverless function runs
  // wherever vercel.json pins it. Reporting this one as "the region" was
  // wrong, and wrong in the direction that matters — it said iad1 while the
  // function had already moved to pdx1. The region that decides how far the
  // database is comes from the page itself, in its own timings.
  const edge = process.env.VERCEL_REGION ?? "local";
  response.headers.set(
    "Server-Timing",
    formatPhases([
      { name: "session", ms: spent, desc: "refreshing the auth session" },
      { name: "edge", ms: 0, desc: `this request landed in ${edge}` },
    ]),
  );
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|mnemonics/|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
