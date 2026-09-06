"use client";

// The shell's client side: the current path for the lit entry, the
// learner's look from Settings as the tokens the Sky reads, and the
// account control (sign in, or sign out through the app's own client).

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { availableFonts } from "@/lib/font-detect";
import { useQuizConfig } from "@/lib/quiz-config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SkyButton } from "@/sky/components/sky-button";
import { SkyShell, type ShellEntry } from "@/sky/components/sky-shell";
import { accentColor } from "@/sky/lib/settings";

const ENTRIES: readonly ShellEntry[] = [
  { href: "/", label: "Home" },
  { href: "/observatory", label: "Observatory" },
  { href: "/atlas", label: "Atlas" },
  { href: "/practice", label: "Practice" },
  { href: "/sessions", label: "Sessions" },
  { href: "/settings", label: "Settings" },
  { href: "/account", label: "Account" },
  { href: "/how-it-works", label: "How Saku works" },
  // a licence obligation, not a courtesy link: the acknowledgement must be
  // reachable from every screen, and a menu item is EDRDG's own example
  { href: "/about", label: "About" },
];

export function SkyShellClient({ signedIn, authEnabled, children }: { signedIn: boolean; authEnabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { cfg, ready } = useQuizConfig();
  // one roll per visit picks which of the chosen faces the sky wears
  const [roll] = useState(() => Math.random());
  const look = useMemo(() => {
    const vars: Record<string, string> = { "--sky-accent": accentColor(cfg.skyAccent) };
    if (ready) { const usable = availableFonts(cfg.fonts); if (usable.length) vars["--font-kana"] = `${usable[Math.floor(roll * usable.length)]}, sans-serif`; }
    return vars as React.CSSProperties;
  }, [cfg.skyAccent, cfg.fonts, ready, roll]);
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    await createSupabaseBrowserClient().auth.signOut();
    window.location.href = "/";
  };
  const account = !authEnabled ? undefined : signedIn
    ? <SkyButton variant="outline" onClick={signOut} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</SkyButton>
    : <SkyButton variant="outline" href="/login">Sign in</SkyButton>;
  // no notice band: the bar's Sign in is always there (Sam, 2026-09-06)
  return <SkyShell current={pathname} entries={ENTRIES} account={account} style={look}>{children}</SkyShell>;
}
