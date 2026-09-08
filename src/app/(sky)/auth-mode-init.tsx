"use client";

// The one bridge that carries the server's "is there an account" answer to the
// progress write path. layout.tsx is a Server Component and knows `signedIn`;
// progress-fetch.ts is a plain client module with no React context, so it reads
// the answer from auth-mode.ts — which this sets, once the shell is mounted.
//
// Renders nothing. Sibling to LocalMigration and mounted the same way (with the
// server's `authEnabled && signedIn`). Its effect runs BEFORE the outbox's own
// mount flush in QuizSessionProvider — child effects fire before ancestor
// effects — so the first retry after a reload already sees the right auth bit.
// And auth-mode defaults to signed-in-until-told, so even the gap before this
// runs errs toward keeping a record queued rather than dropping it.

import { useEffect } from "react";

import { setAuthMode } from "@/lib/auth-mode";

export function AuthModeInit({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    setAuthMode({ signedIn });
  }, [signedIn]);
  return null;
}
