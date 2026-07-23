"use client";

// The "Continue with Google" button, shared by the login page and the landing.
// signInWithOAuth redirects to Google and back to /auth/callback, which
// exchanges the returned code for a session. No email, so no rate limits or
// SMTP — free and instant for anyone with a Google account.

import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function GoogleSignIn({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser is already navigating to Google — nothing to set.
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3 text-[15px] font-medium text-text hover:border-accent disabled:opacity-50"
      >
        <GoogleG />
        {busy ? "Redirecting…" : "Continue with Google"}
      </button>
      {error ? <p className="mt-3 text-center text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}

/** The Google "G", in its brand colors — drawn inline so it needs no asset. */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
