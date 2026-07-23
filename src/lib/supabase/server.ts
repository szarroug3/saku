import "server-only";

// The server-side Supabase client, bound to the request's cookies so it acts as
// the signed-in user — every query it runs is subject to Row-Level Security, so
// a user can only ever read or write their own `progress` row.
//
// Next 16 App Router: cookies() is async, and Server Components cannot set
// cookies (only Route Handlers and middleware can). The setAll try/catch below
// is the standard @supabase/ssr guard for that — when called from a Server
// Component the write is a no-op and the session refresh happens in middleware
// instead. See src/lib/supabase/middleware.ts.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — cookie writes are refused there.
            // Harmless: middleware refreshes the session on every request.
          }
        },
      },
    },
  );
}
