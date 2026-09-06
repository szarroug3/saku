// The Sky's buttons, in one place. Every action on every page is one of
// these: solid in the learner's accent for the main thing to do (Start
// Lesson, Next, Explore, Add to tonight's picks), outlined in the accent
// for the quieter choice beside it (I know this, Quiz me), quiet for a
// step back (Back), coral for a warning (a lesson past its comfortable
// size), and the small round one for a control (close, widen, fold). A
// button with an `href` is a link that looks the same.

import type { ReactNode } from "react";

export type SkyButtonVariant = "solid" | "outline" | "quiet" | "coral";

const BASE = "inline-flex items-center justify-center rounded-[10px] px-3.5 py-2 text-[13px] font-semibold leading-5 transition-colors";
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

export function SkyButton({ variant = "solid", href, onClick, disabled = false, block = false, title, className = "", children }: SkyButtonProps) {
  const cls = `${BASE} ${VARIANT[variant]} ${block ? "w-full" : ""} ${className}`;
  if (href && !disabled) return <a href={href} title={title} className={cls}>{children}</a>;
  if (href) return <span aria-disabled title={title} className={cls}>{children}</span>;
  return <button type="button" onClick={onClick} disabled={disabled} title={title} className={cls}>{children}</button>;
}

export interface RoundButtonProps {
  /** What it does, for the title and for assistive tech: "Close". */
  label: string;
  onClick: () => void;
  pressed?: boolean;
  expanded?: boolean;
  className?: string;
  /** The glyph: ×, ‹, ›. */
  children: ReactNode;
}

/** A small round control: a glyph in a hairline ring that takes the accent on hover. */
export function RoundButton({ label, onClick, pressed, expanded, className = "", children }: RoundButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-line text-[13px] leading-none text-sky-muted hover:border-sky-accent hover:text-sky-ink ${className}`}
    >
      <span aria-hidden>{children}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

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
      className={`inline-flex h-[26px] items-center rounded-full border px-2.5 text-[12px] font-semibold leading-none ${disabled ? "cursor-not-allowed border-transparent text-sky-faint line-through" : on ? "border-sky-accent bg-sky-accent text-sky-accent-ink" : "border-sky-line text-sky-muted hover:border-sky-accent hover:text-sky-ink"} ${className}`}
    >
      {children}
    </button>
  );
}
