import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Where the email magic-link (and any OAuth) lands. Supabase's PKCE flow sends
// the browser here with a one-time `code`; exchanging it sets the session
// cookies, and then we send the user on to where they were headed (`next`,
// default the home page). A missing or bad code falls back to /login.

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
