import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseStore } from "@/lib/store/mode";

// Runs on every matched request (see middleware.ts). Two jobs, and only in
// Supabase mode:
//   1. Refresh the auth session — the access token is short-lived, and calling
//      supabase.auth.getUser() here is what renews it and writes the rolled
//      cookies onto the response. Without this the session silently expires.
//   2. Gate the app — a signed-out visitor asking for a page is sent to /login.
//      API routes are NOT redirected (they answer 401 themselves, which the
//      client can act on), and neither is /login or the /auth callback.
//
// In file mode there is no auth and this is a pass-through, so local dev never
// sees a login wall.

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseStore()) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do NOT run code between createServerClient and getUser — a slow call here is
  // a chance for the session to be seen as expired. This refreshes it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPath =
    path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/api");
  if (!user && !isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
