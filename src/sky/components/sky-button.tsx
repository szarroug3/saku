// The Sky's buttons, in one place. Every action on every page is one of
// these: solid in the learner's accent for the main thing to do (Start
// Lesson, Next, Explore, Add to tonight's picks), outlined in the accent
// for the quieter choice beside it (I know this, Quiz me), quiet for a
// step back (Back), coral for a warning (a lesson past its comfortable
// size), and the small round one for a control (close, widen, fold). A
// button with an `href` is a link that looks the same. The underlined word
// in a line of text is one of these too, and a pill's colors are here rather
// than in each of the three things that draw a pill (SAK-369).

import Link from "next/link";
import type { ReactNode } from "react";

export type SkyButtonVariant = "solid" | "outline" | "quiet" | "coral";

const BASE = "inline-flex items-center justify-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold leading-5 transition-colors";
const VARIANT: Record<SkyButtonVariant, string> = {
  solid: "bg-sky-accent text-sky-accent-ink disabled:bg-sky-card-strong disabled:text-sky-faint",
  outline: "border border-sky-accent bg-transparent text-sky-accent hover:bg-sky-accent/10 disabled:border-sky-line disabled:text-sky-faint disabled:hover:bg-transparent",
  quiet: "border border-sky-line text-sky-ink hover:border-sky-muted disabled:border-transparent disabled:text-sky-faint",
  coral: "bg-sky-coral text-sky-gold-ink",
};

export interface SkyButtonProps {
  variant?: SkyButtonVariant;
  /** A link, styled as the button. */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Full width, for a button that closes a panel. */
  block?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}

/** A path inside the app, as opposed to a hash, a mailto, or somewhere else
 * entirely. Only these can be walked to without leaving the page. */
function isInternal(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

export function SkyButton({ variant = "solid", href, onClick, disabled = false, block = false, title, className = "", children }: SkyButtonProps) {
  const cls = `${BASE} ${VARIANT[variant]} ${block ? "w-full" : ""} ${className}`;
  // A plain anchor threw the whole page away and fetched it again: every
  // "Start lesson", "Quiz me" and "Back to the observatory" was a full reload,
  // losing the loaded app and starting over (SAK-362). Somewhere outside the
  // app still gets a plain anchor, because there is nothing to keep.
  //
  // And no prefetch, for the reason in sky-shell.tsx: every route is dynamic,
  // so a prefetch is a function call that carries nothing, and a click after
  // it fetches the page again anyway (SAK-382).
  if (href && !disabled) {
    return isInternal(href)
      ? <Link href={href} prefetch={false} title={title} className={cls}>{children}</Link>
      : <a href={href} title={title} className={cls}>{children}</a>;
  }
  if (href) return <span aria-disabled title={title} className={cls}>{children}</span>;
  return <button type="button" onClick={onClick} disabled={disabled} title={title} className={cls}>{children}</button>;
}

export interface SkyTextButtonProps {
  onClick: () => void;
  /** Coral for the one that takes something away: Delete. */
  tone?: "ink" | "coral";
  className?: string;
  children: ReactNode;
}

/** An underlined word inside a line of text: Clear, Undo, Rename, Delete.
 * Not a button in a row of buttons, which is `SkyButton`. */
export function SkyTextButton({ onClick, tone = "ink", className = "", children }: SkyTextButtonProps) {
  const cls = tone === "coral" ? "underline hover:text-sky-coral" : "underline hover:text-sky-ink";
  return <button type="button" onClick={onClick} className={`${cls}${className ? ` ${className}` : ""}`}>{children}</button>;
}

export interface RoundButtonProps {
  /** What it does, for the title and for assistive tech: "Close". */
  label: string;
  onClick: () => void;
  pressed?: boolean;
  expanded?: boolean;
  /** The id of what this opens, for `aria-expanded` to point at. */
  controls?: string;
  className?: string;
  /** The glyph: ×, ‹, ›, ⌄, ⌃. */
  children: ReactNode;
}

/** A small round control: a glyph in a hairline ring that takes the accent on
 * hover. Every fold in the Sky opens with one of these (SAK-412): ‹ › for a
 * panel that slides aside, ⌄ closed and ⌃ open for content that folds down. */
export function RoundButton({ label, onClick, pressed, expanded, controls, className = "", children }: RoundButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-line text-[13px] leading-none text-sky-muted hover:border-sky-accent hover:text-sky-ink ${className}`}
    >
      <span aria-hidden>{children}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

/** A pill's colors, lit, unlit and greyed. Written here, once: `SkyChip`,
 * the menu chip and Settings' font chips all wear them. */
export const CHIP_TONE = {
  on: "border-sky-accent bg-sky-accent text-sky-accent-ink",
  off: "border-sky-line text-sky-muted hover:border-sky-accent hover:text-sky-ink",
  disabled: "cursor-not-allowed border-transparent text-sky-faint line-through",
} as const;

export interface SkyChipProps {
  /** Lit in the accent: the current page, the picked one. */
  on?: boolean;
  onClick?: () => void;
  title?: string;
  current?: "page" | "step" | "true";
  /** Greyed, with the reason in its title. */
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/** A small pill that is on or off: a pager's pages, the Atlas's "also
 * found" counts. One look for every pill (audit, 2026-09-05). */
export function SkyChip({ on = false, onClick, title, current, disabled = false, className = "", children }: SkyChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={current ? undefined : on}
      aria-current={on && current ? current : undefined}
      data-sky-chip=""
      className={`inline-flex h-[26px] items-center justify-center rounded-full border px-2.5 text-[12px] font-semibold leading-none ${disabled ? CHIP_TONE.disabled : on ? CHIP_TONE.on : CHIP_TONE.off} ${className}`}
    >
      {children}
    </button>
  );
}
