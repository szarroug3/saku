// The account page. Route: /account. Who is signed in comes from
// the session's claims, read here; the client does the signing out and
// the wiping through the app's own calls.

import { currentUserId } from "@/lib/auth";
import { isSupabaseStore } from "@/lib/store/mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { AccountClient } from "../account-client";
import { SkyPage } from "../sky-page";

export const dynamic = "force-dynamic";

/** The signed-in learner's name and email, from the session's claims. */
async function whoIsSignedIn(): Promise<{ name?: string; email?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = (data?.claims ?? {}) as { email?: string; user_metadata?: { full_name?: string; name?: string } };
  return { name: claims.user_metadata?.full_name ?? claims.user_metadata?.name, email: claims.email };
}

export default async function SkyAccountPage() {
  const authEnabled = isSupabaseStore();
  const userId = authEnabled ? await currentUserId() : null;
  const who = userId ? await whoIsSignedIn() : {};
  return (
    <SkyPage note={userId ? "Your own account." : "Signed out."}>
      <AccountClient signedIn={!!userId} name={who.name} email={who.email} authEnabled={authEnabled} />
    </SkyPage>
  );
}
