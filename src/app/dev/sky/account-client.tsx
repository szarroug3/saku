"use client";

// The account page's client side: the app's Google sign-in handed in as
// a node, the app's sign-out and wipe as actions. A full navigation after
// each, so the server re-reads the session (the app's own rule for sign-out).

import { useRouter } from "next/navigation";

import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { postDelete } from "@/lib/progress-fetch";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SkyAccount } from "@/sky/components/sky-account";

export function AccountClient({ signedIn, name, email, authEnabled }: { signedIn: boolean; name?: string; email?: string; authEnabled: boolean }) {
  const router = useRouter();
  const signOut = async () => {
    await createSupabaseBrowserClient().auth.signOut();
    window.location.href = "/dev/sky/account";
  };
  const wipe = async () => {
    await postDelete({ reset: true });
    router.refresh();
  };
  return (
    <SkyAccount
      signedIn={signedIn}
      name={name}
      email={email}
      signIn={authEnabled ? <GoogleSignIn /> : <p className="text-[13px] text-sky-muted">Sign-in is not set up on this deployment.</p>}
      onSignOut={signOut}
      onWipe={wipe}
      height="100%"
    />
  );
}
