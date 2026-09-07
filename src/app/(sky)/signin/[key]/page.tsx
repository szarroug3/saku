// A test account's way in. Route: /signin/<key>, where the key is the
// EMAIL_SIGNIN_KEY environment variable; any other key, or no key set, is a
// 404, so the page does not exist unless you know the address (Sam,
// 2026-09-07). It is the account page with an email form under the Google
// button. The form only ever SIGNS IN: nothing here can create an account,
// and the app's learners still come in through Google.

import { notFound } from "next/navigation";

import { currentUserId } from "@/lib/auth";
import { isSupabaseStore } from "@/lib/store/mode";

import { AccountClient } from "../../account-client";

export const metadata = { title: "Sign in" };

export const dynamic = "force-dynamic";

export default async function SkySecretSignInPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const expected = process.env.EMAIL_SIGNIN_KEY;
  if (!expected || key !== expected) notFound();
  const authEnabled = isSupabaseStore();
  const userId = authEnabled ? await currentUserId() : null;
  return (
    <>
      <AccountClient signedIn={!!userId} authEnabled={authEnabled} emailSignIn />
    </>
  );
}
