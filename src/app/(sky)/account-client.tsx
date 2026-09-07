"use client";

// The account page's client side: the app's Google sign-in handed in as
// a node, the app's sign-out and wipe as actions. A full navigation after
// each, so the server re-reads the session (the app's own rule for sign-out).

import { useRouter } from "next/navigation";

import { postDelete } from "@/lib/progress-fetch";
import { PRACTICE_MISSES_KEY, PRACTICE_SAVED_KEY } from "@/lib/settings-keys";
import { pushSettings } from "@/lib/settings-sync";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SkyAccount } from "@/sky/components/sky-account";

import { writeStored } from "./stored";

export function AccountClient({ signedIn, name, email, authEnabled, emailSignIn }: { signedIn: boolean; name?: string; email?: string; authEnabled: boolean; emailSignIn: boolean }) {
  const router = useRouter();
  const signOut = async () => {
    await createSupabaseBrowserClient().auth.signOut();
    window.location.href = "/account";
  };
  // the app's reset wipes history; practice's keepsakes live in settings,
  // so the page says it wipes them and does
  // the app's Google flow: off to Google and back to /auth/callback, which
  // exchanges the code for a session
  const signIn = async () => {
    const { error } = await createSupabaseBrowserClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) throw new Error(error.message);
  };
  // a test account's way in (Sam, 2026-09-07): Supabase's email provider,
  // on the secret /signin/<key> page only, and only ever a sign-in
  const signInWithPassword = async (address: string, password: string) => {
    const { error } = await createSupabaseBrowserClient().auth.signInWithPassword({ email: address, password });
    if (error) throw new Error(error.message);
    window.location.href = "/";
  };
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
      onSignIn={authEnabled ? signIn : undefined}
      onSignInWithPassword={authEnabled && emailSignIn ? signInWithPassword : undefined}
      onSignOut={signOut}
      onWipe={wipe}
      height="100%"
    />
  );
}
