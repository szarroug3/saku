import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// One job: keep the Supabase session fresh and gate the app behind sign-in (see
// updateSession). A pass-through in file mode. The matcher skips Next's internal
// assets and the static image folders, so those never pay the auth cost.

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|mnemonics/|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
