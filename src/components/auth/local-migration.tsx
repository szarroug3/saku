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
import { useHistory } from "@/lib/use-history";

export function LocalMigration({ signedIn }: { signedIn: boolean }) {
  // The page was seeded with the account as it stood BEFORE the merge, and
  // nothing else refetches it. So a successful replay ends by re-reading it,
  // which is the moment the work done signed out appears in the account's
  // screens. A failed or empty run reports false and costs no request.
  const { refresh } = useHistory();
  useEffect(() => {
    // Fire-and-forget: the merge is best-effort and reports nothing to the UI —
    // the local copy is intact until an upload lands, so there is no failure the
    // learner needs to see here.
    void migrateLocalProgress(signedIn).then((merged) => {
      if (merged) void refresh();
    });
  }, [signedIn, refresh]);
  return null;
}
