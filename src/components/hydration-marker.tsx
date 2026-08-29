"use client";

// SAK-264: a direct, in-DOM signal for "React has hydrated and committed its
// first client render" — set once, synchronously, in this component's own
// mount effect.
//
// WHY THIS EXISTS: e2e/page-load-performance.spec.ts used to measure page-load
// time as navigation-start → Playwright's `waitForLoadState("networkidle")`.
// networkidle answers a different question than "is the page usable" — it
// fires (or doesn't) based on ALL network traffic in the tab, including
// analytics beacons, Vercel Speed Insights, and any background revalidation
// fetch, none of which block real interactivity. Whether those happen to be
// warm or cold in a given run is exactly the kind of incidental state a shared
// test browser accumulates page to page, which is why the same route measured
// 20x apart run to run with nothing else different — the test was measuring
// the tab's incidental network history, not the route's own hydration cost.
//
// This marker sidesteps that: it flips the instant React commits this
// component, which happens once per real navigation regardless of what else
// the tab has cached or fetched before. Mounted last among the shell's own
// client children (see app/layout.tsx) so effects for the providers and the
// routed page's own top-level client components — which React runs
// child-first, in tree order — have already committed by the time this one
// fires; it is a hydration-complete signal, not merely "React attached."
//
// Deliberately NOT gated behind an env flag: setting one boolean attribute
// once per page is free, and a stable, always-on "app is interactive" signal
// is a reasonable thing for real monitoring to hang off later too, not only
// this test suite.
import { useEffect } from "react";

export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.appHydrated = "true";
  }, []);
  return null;
}
