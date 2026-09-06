"use client";

// The account page: who is learning, and the two things an account is
// for, keeping progress across devices and wiping it. Tracked under Sky:
// Account. The sign-in control and the actions are the app's, handed in;
// this only lays them out and asks before the one that cannot be undone.

import { useState } from "react";

import { SkyButton } from "@/sky/components/sky-button";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";

export interface SkyAccountProps {
  signedIn: boolean;
  name?: string;
  email?: string;
  /** Starts the sign-in (the app's Google flow); absent when sign-in is not set up here. */
  onSignIn?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
  /** Wipes every bit of progress. Asked twice for. */
  onWipe?: () => Promise<void>;
  height?: string;
}

/** The Google G, in one color, drawn inline so it needs no asset. */
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden focusable="false" className="fill-current">
      <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export function SkyAccount({ signedIn, name, email, onSignIn, onSignOut, onWipe, height }: SkyAccountProps) {
  const [busy, setBusy] = useState<"out" | "wipe" | "in" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signIn = async () => {
    if (!onSignIn) return;
    setBusy("in"); setError(null);
    try { await onSignIn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(null); }
  };
  const [asking, setAsking] = useState(false);
  const [wiped, setWiped] = useState(false);
  const run = async (what: "out" | "wipe", action?: () => Promise<void>) => {
    if (!action) return;
    setBusy(what);
    try { await action(); if (what === "wipe") setWiped(true); } finally { setBusy(null); setAsking(false); }
  };
  return (
    <SkyPageShell eyebrow="Account" title={signedIn ? "Who is learning?" : "Want to keep your sky?"} height={height}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto font-sky-ui">
        {signedIn ? (
          <SkyPanel title="You">
            <p className="mt-2 text-[16px] font-semibold text-sky-ink">{name ?? email ?? "Signed in"}</p>
            {name && email && <p className="text-[13.5px] text-sky-muted">{email}</p>}
            <p className="mt-3 text-[13.5px] text-sky-ink/90">Your progress is kept with this account, so any device you sign in on shows the same sky.</p>
            <div className="mt-4">
              <SkyButton variant="outline" disabled={busy !== null} onClick={() => run("out", onSignOut)}>{busy === "out" ? "Signing out…" : "Sign out"}</SkyButton>
            </div>
          </SkyPanel>
        ) : (
          <SkyPanel title="Sign in">
            <p className="mt-2 text-[14px] leading-relaxed text-sky-ink/90">Until you sign in, your progress lives in this browser only. Signing in is only to remember it across devices. Saku never emails you anything.</p>
            <div className="mt-4">
              {onSignIn
                ? <SkyButton variant="outline" disabled={busy !== null} onClick={signIn}><GoogleMark />{busy === "in" ? "Redirecting…" : "Continue with Google"}</SkyButton>
                : <p className="text-[13px] text-sky-muted">Sign-in is not set up on this deployment.</p>}
              {error && <p className="mt-2 text-[13px] text-sky-slipping">{error}</p>}
            </div>
          </SkyPanel>
        )}
        <SkyPanel title="Your progress">
          {wiped ? (
            <p className="mt-2 text-[14px] text-sky-ink/90">Wiped. Your sky is empty again.</p>
          ) : asking ? (
            <>
              <p className="mt-2 text-[14px] leading-relaxed text-sky-ink/90">This wipes everything: every quiz, every claim, every lesson, every saved practice recipe. It cannot be undone.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <SkyButton variant="coral" disabled={busy !== null} onClick={() => run("wipe", onWipe)}>{busy === "wipe" ? "Wiping…" : "Delete everything"}</SkyButton>
                <SkyButton variant="outline" disabled={busy !== null} onClick={() => setAsking(false)}>Keep it</SkyButton>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-[14px] leading-relaxed text-sky-ink/90">Start over from an empty sky. Everything Saku knows about what you have learned goes with it.</p>
              <div className="mt-4">
                <SkyButton variant="outline" disabled={!onWipe} onClick={() => setAsking(true)}>Delete my progress</SkyButton>
              </div>
            </>
          )}
        </SkyPanel>
      </div>
    </SkyPageShell>
  );
}
