"use client";

// Sign out. Clears the Supabase session, then does a FULL navigation home rather
// than a client route change, so the server re-evaluates auth from scratch — the
// layout drops the sidebar's Sign out, and / falls back to the landing.

import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOut() {
  const [busy, setBusy] = useState(false);

  async function out() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <button
      type="button"
      onClick={out}
      disabled={busy}
      className="flex w-full items-center rounded-lg px-3 py-[9px] text-left text-sm text-text-muted hover:bg-panel disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
