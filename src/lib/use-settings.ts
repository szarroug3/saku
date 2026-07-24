"use client";

// Read access to the server-synced settings context. The state itself lives in
// SettingsProvider, mounted once near the top of the root layout (above the theme
// and quiz-config providers, which consume it to reconcile their own state).
//
// Kept a thin hook, mirroring use-history.ts: the providers and the writers that
// call it never see how the context is built, only `{ serverSettings, save }`.

import { useContext } from "react";

import { SettingsContext, type SettingsContextValue } from "@/lib/settings-provider";

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  // Loud rather than a silent default: a settings consumer rendering outside the
  // provider would reconcile against nothing and quietly ignore the server copy,
  // which is exactly the drift this whole change removes.
  if (!ctx) {
    throw new Error("useSettings must be used inside <SettingsProvider> (see the root layout)");
  }
  return ctx;
}
