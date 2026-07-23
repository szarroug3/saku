// The front door — the landing, an introduction to Saku with a way in, rather
// than a bare login form. It's the "Home" in the nav. The curriculum lives on its
// own screen now (/learn), reachable by anyone, so this stays purely the intro.
// A signed-in learner has no use for the marketing page, so they're sent straight
// to their lessons. This is a PUBLIC route (see middleware): the landing has to be
// reachable without a session.

import { redirect } from "next/navigation";

import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { Landing } from "@/components/landing";
import { isSignedIn } from "@/lib/auth";

// Per-request, never prerendered: whether this redirects or renders the landing
// depends on the session, so a cached copy would send the wrong person to the
// wrong place. (It reads cookies via isSignedIn, which already forces this, but
// stated so it can't regress into a static landing served to a signed-in learner.)
export const dynamic = "force-dynamic";

export default async function Page() {
  if (await isSignedIn()) redirect("/learn");
  return <Landing signIn={<GoogleSignIn className="mx-auto max-w-xs" />} />;
}
