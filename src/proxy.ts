import { type NextRequest } from "next/server";

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
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|mnemonics/|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
