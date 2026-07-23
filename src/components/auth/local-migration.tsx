"use client";

// The one mount point for the sign-in merge. layout.tsx is a Server Component
// and knows `signedIn`; the merge is a client step (it reads localStorage and
// talks to the API). This tiny bridge carries the server's answer across that
// boundary and runs the merge once the app shell is mounted.
//
// Renders nothing. It exists only so migrateLocalProgress has a useEffect to run
// in — the function itself owns the "at most once, never signed out, best
// effort" guarding (see migrate-local.ts), so this stays a one-line effect that
// cannot accumulate logic of its own.

import { useEffect } from "react";

import { migrateLocalProgress } from "@/lib/store/migrate-local";

export function LocalMigration({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    // Fire-and-forget: the merge is best-effort and reports nothing to the UI —
    // the local copy is intact until an upload lands, so there is no failure the
    // learner needs to see here.
    void migrateLocalProgress(signedIn);
  }, [signedIn]);
  return null;
}
