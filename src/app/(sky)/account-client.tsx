"use client";

// The account page's client side: the app's Google sign-in handed in as
// a node, the app's sign-out and wipe as actions. A full navigation after
// each, so the server re-reads the session (the app's own rule for sign-out).

import { useRouter } from "next/navigation";

import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { postDelete } from "@/lib/progress-fetch";
import { PRACTICE_MISSES_KEY, PRACTICE_SAVED_KEY } from "@/lib/settings-keys";
import { pushSettings } from "@/lib/settings-sync";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SkyAccount } from "@/sky/components/sky-account";

import { writeStored } from "./stored";

export function AccountClient({ signedIn, name, email, authEnabled }: { signedIn: boolean; name?: string; email?: string; authEnabled: boolean }) {
  const router = useRouter();
  const signOut = async () => {
    await createSupabaseBrowserClient().auth.signOut();
    window.location.href = "/account";
  };
  // the app's reset wipes history; practice's keepsakes live in settings,
  // so the page says it wipes them and does
  const wipe = async () => {
    await postDelete({ reset: true });
    writeStored(PRACTICE_SAVED_KEY, []);
    writeStored(PRACTICE_MISSES_KEY, {});
    pushSettings({ practice: { saved: [], misses: {} } });
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
