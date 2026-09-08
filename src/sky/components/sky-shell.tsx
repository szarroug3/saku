// The app's shell under the sky (cutover, 2026-09-06): the wash painted
// full-bleed under everything, a thin bar along the top with the wordmark,
// the pages in one row of small caps and the account on the right, and the
// page below taking every pixel left. Sam's call: a bar, not a rail; the
// pages are one screen each and want the width, and a sky has a horizon.
//
// Presentational: the route hands in the current path, the entries, the
// account control and the learner's look (accent, kana face) as a style.

"use client";

import Link from "next/link";

// Nothing here prefetches, on purpose (SAK-382). Every Sky route is dynamic,
// so a prefetch cannot carry the page: measured on the deployed app, one
// load of the home fired twenty of them, one per bar link twice over, 23
// seconds of server time between them, waking every cold function in the
// app — and a click afterwards fetched the page again exactly as if none of
// it had happened. A link that cannot be prefetched usefully should not be
// prefetched at all; it costs a function, a session refresh and a database
// read, and it competes with the request the learner actually made.
import { useState, type CSSProperties, ReactNode } from "react";

import { RoundButton } from "@/sky/components/sky-button";

export interface ShellEntry {
  href: string;
  label: string;
  /** A page to read rather than a page to use: How Saku works, About. It
   * sits at the far end of the row behind a hairline, in the same small caps
   * but not bold, so it is reachable from every screen without reading as a
   * peer of the Observatory (SAK-358). */
  quiet?: boolean;
}

interface SkyShellProps {
  /** The current path, for the lit entry. */
  current: string;
  entries: readonly ShellEntry[];
  /** Sign in, or who is signed in and the way out. */
  account?: ReactNode;
  /** A visitor's line: their sky lives in this browser. */
  /** The learner's accent and kana face, as the tokens the Sky reads. */
  style?: CSSProperties;
  children: ReactNode;
}

const isCurrent = (current: string, href: string) => (href === "/" ? current === "/" : current === href || current.startsWith(`${href}/`));

export function SkyShell({ current, entries, account, style, children }: SkyShellProps) {
  // on a narrow screen the pages fold behind a Menu button
  const [open, setOpen] = useState(false);
  return (
    <div className="relative isolate flex h-dvh flex-col overflow-hidden font-sky-ui text-sky-ink" style={style}>
      <div aria-hidden className="sky-wash fixed inset-0 -z-10" />
      <header className="flex shrink-0 items-center gap-3 border-b border-sky-line/60 bg-sky-card px-4 md:gap-6 md:px-5">
        {/* the Saku mark, the same one the app has always worn (Sam: keep the logo) */}
        <Link prefetch={false} href="/" className="flex h-12 items-center" aria-label="Saku, home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/saku-wordmark.png" alt="" className="h-9 w-9 object-contain" />
        </Link>
        {/* the Sky's one expander (SAK-412); the word stays because nothing
            else in this row says what the fold holds */}
        <span className="flex items-center gap-2 px-2 py-2 md:hidden">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-muted">Menu</span>
          <RoundButton label={open ? "Hide the pages" : "Show the pages"} expanded={open} controls="sky-menu" onClick={() => setOpen((o) => !o)}>⌃</RoundButton>
        </span>
        <nav aria-label="Pages" className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex">
          {entries.map((e, i) => {
            const on = isCurrent(current, e.href);
            // the first quiet entry takes the space left and brings the
            // hairline, so the reading pages end the row as their own group
            const starts = e.quiet && !entries[i - 1]?.quiet;
            return (
              <Link
                prefetch={false}
                key={e.href}
                href={e.href}
                aria-current={on ? "page" : undefined}
                className={`relative shrink-0 px-2.5 py-3.5 text-[11px] uppercase tracking-[0.14em] ${e.quiet ? "font-normal" : "font-semibold"} ${starts ? "ml-auto border-l border-sky-line/60 pl-4" : ""} ${on ? "text-sky-ink" : "text-sky-muted hover:text-sky-ink"}`}
              >
                {e.label}
                {on && <span aria-hidden className={`absolute bottom-0 h-0.5 rounded-full bg-sky-accent ${starts ? "left-4 right-2.5" : "inset-x-2.5"}`} />}
              </Link>
            );
          })}
        </nav>
        {account && <div className="ml-auto flex shrink-0 items-center gap-3 text-[12.5px] md:ml-0">{account}</div>}
      </header>
      {open && (
        <nav id="sky-menu" aria-label="Pages" className="flex shrink-0 flex-col border-b border-sky-line/60 bg-sky-card px-4 py-2 md:hidden">
          {entries.map((e, i) => {
            const on = isCurrent(current, e.href);
            // the same grouping the wide bar makes, as a rule across the fold
            const starts = e.quiet && !entries[i - 1]?.quiet;
            return <Link prefetch={false} key={e.href} href={e.href} aria-current={on ? "page" : undefined} onClick={() => setOpen(false)} className={`py-2 text-[11px] uppercase tracking-[0.14em] ${e.quiet ? "font-normal" : "font-semibold"} ${starts ? "mt-2 border-t border-sky-line/60 pt-3" : ""} ${on ? "text-sky-accent" : "text-sky-muted"}`}>{e.label}</Link>;
          })}
        </nav>
      )}
      <main className="flex min-h-0 flex-1 flex-col px-4 py-3 md:px-6 md:py-4">{children}</main>
    </div>
  );
}
