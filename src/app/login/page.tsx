"use client";

// Sign-in. One method for now: an email magic-link — no passwords to store or
// forget. On submit we ask Supabase to mail a one-time link back to
// /auth/callback, which exchanges it for a session. Only reached in Supabase
// mode; in file mode there is no auth and the middleware never sends anyone here.

import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col items-center justify-center px-6">
      <img
        src="/brand/saku-wordmark.png"
        alt="Saku"
        width={160}
        height={160}
        className="mb-8 h-40 w-40 object-contain"
      />

      {sent ? (
        <div className="text-center">
          <h1 className="text-[20px] font-medium text-text">Check your email</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
            We sent a sign-in link to{" "}
            <span className="font-medium text-text">{email}</span>. Open it on this
            device to come back signed in.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-6 text-[14px] text-accent hover:underline"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="w-full">
          <h1 className="text-center text-[20px] font-medium text-text">
            Sign in to Saku
          </h1>
          <p className="mt-2 text-center text-[14px] leading-relaxed text-text-muted">
            Enter your email and we&rsquo;ll send you a sign-in link — no password
            needed.
          </p>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-6 w-full rounded-lg border border-border bg-card px-4 py-3 text-[15px] text-text outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="mt-3 w-full rounded-lg border border-accent/40 bg-accent-bg px-4 py-3 text-[15px] font-medium text-accent hover:border-accent disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send me a link"}
          </button>
          {error ? (
            <p className="mt-3 text-center text-[13px] text-danger">{error}</p>
          ) : null}
        </form>
      )}
    </main>
  );
}
