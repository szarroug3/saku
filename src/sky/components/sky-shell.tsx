// The app's shell under the sky (cutover, 2026-09-06): the wash painted
// full-bleed under everything, a thin bar along the top with the wordmark,
// the pages in one row of small caps and the account on the right, a slim
// notice under it for a visitor whose sky lives in this browser, and the
// page below taking every pixel left. Sam's call: a bar, not a rail; the
// pages are one screen each and want the width, and a sky has a horizon.
//
// Presentational: the route hands in the current path, the entries, the
// account control and the learner's look (accent, kana face) as a style.

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export interface ShellEntry {
  href: string;
  label: string;
}

export interface SkyShellProps {
  /** The current path, for the lit entry. */
  current: string;
  entries: readonly ShellEntry[];
  /** Sign in, or who is signed in and the way out. */
  account?: ReactNode;
  /** A visitor's line: their sky lives in this browser. */
  notice?: ReactNode;
  /** The learner's accent and kana face, as the tokens the Sky reads. */
  style?: CSSProperties;
  children: ReactNode;
}

const isCurrent = (current: string, href: string) => (href === "/" ? current === "/" : current === href || current.startsWith(`${href}/`));

export function SkyShell({ current, entries, account, notice, style, children }: SkyShellProps) {
  return (
    <div className="relative isolate flex h-dvh flex-col overflow-hidden font-sky-ui text-sky-ink" style={style}>
      <div aria-hidden className="sky-wash fixed inset-0 -z-10" />
      <header className="flex shrink-0 items-center gap-6 border-b border-sky-line/60 bg-sky-card px-5">
        {/* the Saku mark, the same one the app has always worn (Sam: keep the logo) */}
        <Link href="/" className="flex h-12 items-center" aria-label="Saku, home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/saku-wordmark.png" alt="" className="h-9 w-9 object-contain" />
        </Link>
        <nav aria-label="Pages" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {entries.map((e) => {
            const on = isCurrent(current, e.href);
            return (
              <Link key={e.href} href={e.href} aria-current={on ? "page" : undefined} className={`relative shrink-0 px-2.5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${on ? "text-sky-ink" : "text-sky-muted hover:text-sky-ink"}`}>
                {e.label}
                {on && <span aria-hidden className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-sky-accent" />}
              </Link>
            );
          })}
        </nav>
        {account && <div className="flex shrink-0 items-center gap-3 text-[12.5px]">{account}</div>}
      </header>
      {notice && <div className="shrink-0 border-b border-sky-line/60 bg-sky-card/60 px-5 py-1.5 text-[12px] text-sky-muted">{notice}</div>}
      <main className="flex min-h-0 flex-1 flex-col px-6 py-4">{children}</main>
    </div>
  );
}
