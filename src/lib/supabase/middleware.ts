import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseStore } from "@/lib/store/mode";

// Runs on every matched request (see middleware.ts). Its ONE job, and only in
// Supabase mode: refresh the auth session. The access token is short-lived, and
// calling supabase.auth.getUser() here is what renews it and writes the rolled
// cookies onto the response. Without this the session silently expires.
//
// It does NOT gate the app. Saku is browsable signed out — the Library and every
// reference page work without an account, and the data hooks treat a 401 as an
// empty history rather than an error. Login is only needed to SAVE, and that is
// enforced where the saving happens (the write API routes answer 401) and shown
// where it helps (the home page is a landing when signed out; the sidebar offers
// Sign in). In file mode there is no auth and this is a pass-through.

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

  // Refreshes the session (and rolls the cookies via setAll above). Do not run
  // code between createServerClient and getUser.
  await supabase.auth.getUser();

  return response;
}
