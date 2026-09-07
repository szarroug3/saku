import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseStore } from "@/lib/store/mode";
import { requireSupabasePublishableKey, requireSupabaseUrl } from "@/lib/supabase/keys";

// Runs on every matched request (see middleware.ts). Its ONE job, and only in
// Supabase mode: refresh the auth session. The access token is short-lived, and
// calling supabase.auth.getClaims() here is what renews it when it has expired
// and writes the rolled cookies onto the response. Without this the session
// silently expires.
//
// It does NOT gate the app. Saku is browsable signed out — the Library and every
// reference page work without an account, and the data hooks treat a 401 as
// "save to this browser's localStorage" rather than an error. Login is only
// needed to sync to an account, and that is enforced where the saving happens
// (the write API routes answer 401) and shown where it helps (the home page is a
// landing when signed out; the sidebar offers Sign in). When Supabase is not
// configured (no keys) there is no auth and this is a pass-through.

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseStore()) return response;

  const supabase = createServerClient(
    requireSupabaseUrl(),
    requireSupabasePublishableKey(),
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

  // Refreshes the session if it needs it (rolling the cookies via setAll
  // above), and otherwise costs nothing: getClaims verifies the access token
  // locally with the project's signing key and only goes to the auth server
  // when the token cannot be verified or has expired (SAK-382). getUser went
  // to the auth server on EVERY request, 80 to 100 ms of every page on the
  // function, to learn what the token already said. auth.ts made the same
  // move for reading the user (SAK-202); this is the proxy catching up. Do
  // not run code between createServerClient and this call.
  await supabase.auth.getClaims();

  return response;
}
