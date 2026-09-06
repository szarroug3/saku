"use client";

// The account page: who is learning, and the two things an account is
// for, keeping progress across devices and wiping it. Tracked under Sky:
// Account. The sign-in control and the actions are the app's, handed in;
// this only lays them out and asks before the one that cannot be undone.

import { useState, type ReactNode } from "react";

import { SkyButton } from "@/sky/components/sky-button";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";

export interface SkyAccountProps {
  signedIn: boolean;
  name?: string;
  email?: string;
  /** The app's sign-in control, shown when signed out. */
  signIn?: ReactNode;
  onSignOut?: () => Promise<void>;
  /** Wipes every bit of progress. Asked twice for. */
  onWipe?: () => Promise<void>;
  height?: string;
}

export function SkyAccount({ signedIn, name, email, signIn, onSignOut, onWipe, height }: SkyAccountProps) {
  const [busy, setBusy] = useState<"out" | "wipe" | null>(null);
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
            <div className="mt-4">{signIn}</div>
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
