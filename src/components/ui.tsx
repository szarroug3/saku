"use client";

// Small hand-rolled UI kit matching the dota-data aesthetic and the legacy
// app's look: cards, uppercase section labels, chip toggles, settings rows.
// Every screen builds from these so the pages stay visually consistent.

import { type ComponentProps, type ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "kq-material mb-3.5 rounded-xl border border-border bg-card p-[18px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Uppercase section label ("QUIZ", "MISSED CHARACTERS", …). */
export function Lbl({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-text-muted">
      {children}
    </p>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <span className="text-xs text-text-muted">{children}</span>;
}

/** Background on a setting, behind a focusable (i).
 *
 * A real button, not a bare hover target: hover-only info is unreachable by
 * keyboard and on touch, and this is the only place some of it is written
 * down. Radix handles focus, Escape, and the aria wiring. */
export function Info({ children }: { children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label="More about this setting"
        className="kq-material ml-1 inline-flex size-3.5 cursor-help items-center justify-center rounded-full border border-border align-[1px] text-[9px] leading-none text-text-muted hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        i
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-[280px]">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

/** A settings row: label left, controls right, top border between rows.
 * `dim` grays it out (setting doesn't apply to the chosen mode).
 *
 * Two kinds of explanation, deliberately separated:
 *   `hint` — changes what you'd PICK, so it stays inline and always visible
 *   `info` — background or a why, so it hides behind an (i)
 * That line is what keeps the page from being a wall of grey text. */
export function Row({
  label,
  hint,
  info,
  dim,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  info?: ReactNode;
  dim?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center justify-between gap-2.5 py-2",
        "border-t border-border first:border-t-0",
        dim && "pointer-events-none opacity-45",
      )}
    >
      <span>
        {label} {hint ? <Hint>{hint}</Hint> : null}
        {info ? <Info>{info}</Info> : null}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">{children}</span>
    </div>
  );
}

// ComponentProps rather than ButtonHTMLAttributes so `ref` types through —
// React 19 passes ref to a function component as an ordinary prop, and these
// are the app's buttons, so something will eventually want to point at one.
type BtnProps = ComponentProps<"button"> & {
  sel?: boolean;
  /** Destructive tone: the action discards or deletes something. Lives here
   * rather than being passed in as a className because ui.tsx joins classes
   * with `cx` (no tailwind-merge), so `border-danger` arriving from outside
   * would not displace `border-border` — both would land, and which one won
   * would be decided by their order in the generated stylesheet rather than
   * by the caller. A branch cannot collide with itself. */
  danger?: boolean;
  /**
   * The button that does the thing: filled, inverted, one per screen.
   *
   * Here for the same reason `danger` is, and with a receipt. Callers were
   * writing this tone as a className —
   * `border-transparent bg-text font-medium text-bg hover:bg-text` — which is
   * precisely the collision the note below describes: `text-bg` lands next to
   * the unselected branch's `text-text`, `cx` is a plain join, and `text-text`
   * wins on stylesheet order. The result is --text on --bg-text. THE SAME
   * COLOUR, twice: a filled pill with invisible text.
   *
   * That is not a hypothetical. It is what `Start round 1` on the teach screen
   * has been rendering (measured: color rgb(238,241,251) on background
   * rgb(238,241,251)) — the only button on the screen, unreadable, and shipped,
   * because it is still shaped like a button and still in the place your eye
   * expects one.
   */
  go?: boolean;
};

/** Standard button; `sel` gives it the accent selected state.
 *
 * `kq-material` sits on the SHARED class string, not on the unselected branch,
 * and that is the point: the material is a property of the button, not of which
 * fill it happens to be wearing. The old radius+fill recipe reached this only
 * through `rounded-lg` + `bg-card`, so selecting a button — which swaps the fill
 * to `bg-accent-bg` — silently dropped it out of the theme's material. */
// THE TEXT COLOUR BELONGS TO THE BRANCH, not to the shared string.
//
// `text-text` used to live in the shared string alongside each branch's own
// `text-accent` / `text-danger`. `cx` is a plain join, not tailwind-merge, so
// both classes reached the element and the winner was decided by their order
// in the generated stylesheet rather than by this ternary — and `text-text`
// won. Every `sel` button in the app has been rendering --text instead of
// --accent (measured: Resume renders #eef1fb, not #67d4f5). It reads as
// selected anyway, via its accent border and fill, which is why this survived.
//
// I found it because `danger` lost the same fight. Naming the colour once per
// branch is the fix for both: nothing to override, nothing to order.
export function Btn({ sel, danger, go, className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cx(
        "kq-material cursor-pointer rounded-lg text-sm hover:bg-panel",
        sel
          ? "border-2 border-accent bg-accent-bg px-[13px] py-1.5 text-accent hover:bg-accent-bg"
          : danger
            ? "border border-danger bg-card px-3.5 py-[7px] text-danger hover:bg-danger-bg"
            : go
              ? "border border-transparent bg-text px-3.5 py-[7px] font-medium text-bg hover:bg-text"
              : "border border-border bg-card px-3.5 py-[7px] text-text",
        className,
      )}
    />
  );
}

/** Btn's smaller twin. Same branch-owns-its-colour rule — see Btn. */
export function SmallBtn({ sel, danger, className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cx(
        "kq-material cursor-pointer rounded-lg text-xs hover:bg-panel disabled:cursor-default disabled:opacity-45",
        sel
          ? "border-2 border-accent bg-accent-bg px-[9px] py-[3px] text-accent hover:bg-accent-bg"
          : danger
            ? "border border-danger bg-card px-2.5 py-1 text-danger hover:bg-danger-bg"
            : "border border-border bg-card px-2.5 py-1 text-text",
        className,
      )}
    />
  );
}

export function GhostBtn({ className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cx(
        "cursor-pointer rounded-lg border-none bg-transparent text-sm text-text-muted hover:bg-panel",
        className,
      )}
    />
  );
}

export function PrimaryBtn({ className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cx(
        "w-full cursor-pointer rounded-lg bg-text p-3 text-base text-bg",
        "disabled:cursor-default disabled:opacity-40",
        className,
      )}
    />
  );
}

/** Pill chip toggle; `partial` is the dashed/amber partial state. */
export function Chip({
  on,
  partial,
  className,
  ...props
}: BtnProps & { on?: boolean; partial?: boolean }) {
  return (
    <button
      {...props}
      className={cx(
        "kq-material cursor-pointer select-none rounded-full border px-3 py-1 text-[13px]",
        on
          ? "border-accent bg-accent-bg text-accent"
          : partial
            ? "border-warning bg-warning-bg text-warning"
            : "border-border bg-card text-text-muted",
        className,
      )}
    />
  );
}

/** A standalone stat tile: Sessions / Characters practised / Overall accuracy.
 *
 * `bg-card` + border + shadow-card, i.e. the Card's own material — not the
 * `bg-panel` it used to be. --panel is the RECESSED tone: a progress track, a
 * hover wash, a bar behind a bar. It is what a card contains, not what sits on
 * the page beside one. These three tiles stand on the page ground as peers of
 * the trend Card above them and the deck cards below, and both of those are
 * bg-card — so the tile wearing a recess tone read, correctly, as the wrong
 * material. In kiri that is loudest, because there --card is frosted glass and
 * --panel is a bare 7% wash with no blur at all: 4.6 dE, and the "boxes look
 * off" in the report.
 *
 * rounded-[10px] rather than the kit's rounded-xl for the reason deck-card
 * documents: rounded-xl is the hook aizome uses to dissolve a card into
 * hairline rules, which suits a full-width Card and not a 3-up tile grid.
 *
 * Opting out of that radius no longer costs anything, and `kq-material` is why.
 * The material used to be granted by radius+fill class pairs, so a tile that
 * chose its own geometry silently chose its own SUBSTANCE too — and the fix was
 * to keep adding radii to a list in globals.css, i.e. to fix the casualties you
 * had found. This tile now asks for the theme's card material by name, and its
 * radius is nobody's business but its own. */
export function Metric({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="kq-material rounded-[10px] border border-border bg-card px-3.5 py-3 shadow-card">
      <p className="mb-0.5 text-xs text-text-muted">{k}</p>
      <p className="text-2xl font-semibold">{v}</p>
    </div>
  );
}

export function MetricsGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3.5 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
      {children}
    </div>
  );
}

/** Thin progress bar; pct=null renders full (endless mode). */
export function ProgressBar({ pct }: { pct: number | null }) {
  return (
    <div className="mb-[18px] h-(--bar-h) rounded-full bg-panel">
      <div
        className="h-(--bar-h) rounded-full bg-accent transition-[width] duration-200"
        style={{ width: `${pct === null ? 100 : Math.min(100, pct)}%` }}
      />
    </div>
  );
}

/** The "hear the sound" speaker, as crisp inline SVG rather than the 🔊 emoji.
 *
 * `currentColor` so it takes the text colour of whatever it sits in, and a
 * `className` so each call site sizes it. Default ~1.05em reads a touch larger
 * and clearer than the old glyph, especially small. `aria-hidden` because every
 * call site already carries its own accessible label or "Hear it" text — the
 * icon is decoration on top of that, never the only cue. The cone is filled for
 * weight at ~15px; the two arcs are the sound waves. */
export function SoundIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cx("inline-block size-[1.05em] shrink-0", className)}
    >
      <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 5a9 9 0 0 1 0 14" />
    </svg>
  );
}

export function PageTitle({
  title,
  sub,
}: {
  title: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <>
      <h1 className="mb-0.5 text-[22px] font-semibold">{title}</h1>
      {sub ? <p className="mb-[18px] text-[13px] text-text-muted">{sub}</p> : null}
    </>
  );
}
