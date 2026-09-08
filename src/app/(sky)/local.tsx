"use client";

// The Sky for whoever is here (Sam, 2026-09-06: sign-in preferred, never
// required). A page's data comes from a server action that reads whose
// history the client names: the sample's, the account's, or, signed out,
// the browser's own copy handed up with the call. The browser's copy is
// the app's HistoryProvider, so a write the page makes shows up here and
// the page reloads its data.

import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";

import { useHistory } from "@/lib/use-history";

import { lean, type Who } from "./who";

/** Whose history this page reads, or null until the browser's copy has
 * been read. `full` keeps the sessions (the home's mix-ups, the sessions
 * page); everything else sends the lean copy. */
export function useWho(sample: boolean, signedIn: boolean, full = false): Who | null {
  const { history, loaded } = useHistory();
  return useMemo(() => {
    if (sample) return { sample: true };
    if (signedIn) return {};
    if (!loaded) return null;
    return { local: full ? history : lean(history) };
  }, [sample, signedIn, loaded, history, full]);
}

/** A page's data: the route's own when it had a history to read (sample or
 * signed in), else loaded through `load` once the browser's copy is here,
 * and again whenever that copy changes. */
export function useLoaded<T>(who: Who | null, load: (who: Who) => Promise<T>, initial: T | null): T | null {
  const [loaded, setLoaded] = useState<{ who: Who; data: T } | null>(null);
  useEffect(() => {
    if (initial !== null || !who) return;
    let live = true;
    load(who).then((data) => { if (live) setLoaded({ who, data }); });
    return () => { live = false; };
  }, [who, load, initial]);
  if (initial !== null) return initial;
  return loaded && loaded.who === who ? loaded.data : loaded?.data ?? null;
}

/** A page's whole client side: whose history it reads, its data, and what to
 * render until the data is here (SAK-368).
 *
 * Five clients wrote the same three lines. The caller decides when to give up
 * and show `loading`, because three of them wait on a cached catalogue as
 * well as their own data, and the Atlas needs `who` besides, to bind its
 * lookups to whose history they read. */
export function useSkyData<T>({ sample, signedIn, full, load, initial, eyebrow, title }: {
  sample: boolean;
  signedIn: boolean;
  /** Keep the whole browser copy, sessions included: the home, and Sessions. */
  full?: boolean;
  load: (who: Who) => Promise<T>;
  initial: T | null;
  eyebrow: string;
  title: string;
}): { who: Who | null; data: T | null; loading: ReactElement } {
  const who = useWho(sample, signedIn, full);
  const data = useLoaded(who, load, initial);
  return { who, data, loading: <SkyLoading eyebrow={eyebrow} title={title} /> };
}

/**
 * The page, with its body still coming (SAK-356).
 *
 * It used to be the line alone on an empty wash, so when the data landed the
 * eyebrow, the title and every panel appeared at once and the page visibly
 * jumped. The heading is the part that is known before anything is fetched,
 * so it is drawn first and only the body fills in.
 *
 * Each caller passes the same eyebrow and title its page uses when loaded, so
 * the two renders are the same page rather than two different ones.
 */
export function SkyLoading({ eyebrow, title, children = "Reading your sky…" }: { eyebrow?: string; title?: string; children?: ReactNode }) {
  const line = <p className="font-sky-ui text-[14px] text-sky-muted">{children}</p>;
  if (!title) return line;
  return <SkyPageShell eyebrow={eyebrow} title={title}>{line}</SkyPageShell>;
}
