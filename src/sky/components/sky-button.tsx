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

type SkyButtonVariant = "solid" | "outline" | "quiet" | "coral";

const BASE = "inline-flex items-center justify-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold leading-5 transition-colors";
const VARIANT: Record<SkyButtonVariant, string> = {
  solid: "bg-sky-accent text-sky-accent-ink disabled:bg-sky-card-strong disabled:text-sky-faint",
  outline: "border border-sky-accent bg-transparent text-sky-accent hover:bg-sky-accent/10 disabled:border-sky-line disabled:text-sky-faint disabled:hover:bg-transparent",
  quiet: "border border-sky-line text-sky-ink hover:border-sky-muted disabled:border-transparent disabled:text-sky-faint",
  coral: "bg-sky-coral text-sky-gold-ink",
};

interface SkyButtonProps {
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

interface SkyTextButtonProps {
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

interface RoundButtonProps {
  /** What it does, for the title and for assistive tech: "Close". */
  label: string;
  onClick: () => void;
  pressed?: boolean;
  expanded?: boolean;
  /** The id of what this opens, for `aria-expanded` to point at. */
  controls?: string;
  className?: string;
  /** The glyph: ×, ‹, ›, ⌃. */
  children: ReactNode;
}

/**
 * The chevron, and the only one there is.
 *
 * A fold used to draw ⌄ when it was shut and ⌃ when it was open, and the two
 * are not one shape turned over: in the UI font ⌄ is a narrow, tall, pointed v
 * and ⌃ is a wide, flat arrowhead, so shutting a fold changed the glyph rather
 * than the direction it pointed, and Sam read the shut one as a letter
 * (SAK-414). So there is one glyph now and a shut fold rotates it.
 */
const CHEVRON = "⌃";

/** Where each glyph's ink has to move to land on the circle's centre.
 *
 * Centring the BOX does not centre the INK, and it never did (SAK-413): Sam saw
 * the ⌃ riding high in its ring. Two things push it. The text baseline sits
 * `(ascent − descent) / 2` below the middle of any line box, which for the UI
 * font at 13px is 4.5px down; and then each glyph draws its ink its own
 * distance above that baseline: 6.8px for ⌃, a 2.3px spread against ‹ inside a
 * 28px circle. `place-items-center` cannot see either.
 *
 * So the shift is measured, not guessed: `measureText(glyph)` in the rendered
 * font gives `actualBoundingBoxAscent/Descent`, the ink's own middle is half
 * their difference, and the shift is that middle minus the baseline's 4.5px.
 * Rounded to the half pixel a 2x screen can actually draw. Re-measure these if
 * the UI font or the button's font-size changes; nothing else affects them. */
const INK_SHIFT: Record<string, string> = {
  "⌃": "translate-y-[2.5px]",
  "‹": "translate-y-[-1px]",
  "›": "translate-y-[-1px]",
  "×": "translate-y-[-1px]",
};

/** The chevron turned over, for a fold that is shut.
 *
 * NOT A SECOND MEASUREMENT. The rotation is about the span's own middle, and
 * the CSS individual transform properties rotate the ink before they translate
 * it, so the same ink that sat 2.5px above the middle now sits 2.5px below it.
 * The shift is therefore exactly the negative of the upright one, and it stays
 * that way for whatever `⌃` re-measures to. */
const FLIPPED_CHEVRON = "rotate-180 translate-y-[-2.5px]";

/** The ring itself: the hairline circle and the glyph inside it, with the
 * ink where SAK-413 measured it. Written once because it is drawn two ways.
 * When the ring IS the control it is a `<button>` (`RoundButton`); when the
 * control is a whole title row it is a `<span>` inside that row's button
 * (`FoldRow`), since one button cannot hold another. */
const RING = "grid h-7 w-7 shrink-0 place-items-center rounded-full border border-sky-line text-[13px] leading-none text-sky-muted";

/** Where the glyph's ink has to go, given which glyph it is and whether the
 * fold it belongs to is shut. */
function inkShift(glyph: ReactNode, expanded?: boolean): string {
  if (typeof glyph !== "string") return "";
  return glyph === CHEVRON && expanded === false ? FLIPPED_CHEVRON : INK_SHIFT[glyph] ?? "";
}

/** A small round control: a glyph in a hairline ring that takes the accent on
 * hover. Every fold in the Sky opens with one of these (SAK-412): ‹ › for a
 * panel that slides aside, and ⌃ for content that folds down, upright while it
 * is open and turned over while it is shut. A caller passes the chevron and
 * says whether the fold is open; which way it points is this file's business.
 * ‹ and › are already each other turned over, so they are left alone. */
export function RoundButton({ label, onClick, pressed, expanded, controls, className = "", children }: RoundButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      className={`${RING} hover:border-sky-accent hover:text-sky-ink ${className}`}
    >
      <span aria-hidden className={`block leading-none ${inkShift(children, expanded)}`}>{children}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

interface FoldRowProps {
  /** What it does, for the title and for assistive tech: "Show the details".
   * It is the row's whole accessible name, so it has to carry the words the
   * row shows: "Open Readings", not "Open". */
  label: string;
  /** Whether the fold is open, for `aria-expanded` and for the chevron. */
  open: boolean;
  /** The id of what it opens, for `aria-controls`. */
  controls: string;
  onClick: () => void;
  /** What sits at the right end, beside the chevron: the home bar's count. */
  tail?: ReactNode;
  /** A row that sits inside a line of prose rather than owning its own line:
   * the "Why?" caption. It takes `inline-flex` so the sentence closes around
   * it, and the two display classes are decided here rather than left to
   * whichever of them Tailwind's sheet happens to write last. */
  inline?: boolean;
  className?: string;
  /** The row's words: the section's name. */
  children: ReactNode;
}

/**
 * A fold's title row, as one button (SAK-432).
 *
 * SAK-412 made the round chevron the Sky's one expander and left the words
 * beside it outside the click target, so the home's Details bar was a bar with
 * a 28px target at one end of it. Sam: "i prefer that the full bar be clickable
 * to expand/collapse." So wherever a fold has a title row, the ROW is the
 * button and the ring is drawn inside it as a glyph.
 *
 * The ring keeps its hover: `group-hover` on it, `group` on the row, so
 * pointing anywhere along the row lights the chevron and says what the row
 * will do. `aria-label` rather than an `sr-only` word, because the row already
 * reads its own words aloud and a name appended to them would say the section
 * twice. Every label names the section, so the visible words are inside the
 * name (WCAG 2.5.3).
 */
export function FoldRow({ label, open, controls, onClick, tail, inline = false, className = "", children }: FoldRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-expanded={open}
      aria-controls={controls}
      className={`group ${inline ? "inline-flex" : "flex"} items-center text-left ${className}`}
    >
      {children}
      <span className="flex items-center gap-3">
        {tail}
        <span aria-hidden className={`${RING} group-hover:border-sky-accent group-hover:text-sky-ink`}>
          <span className={`block leading-none ${inkShift(CHEVRON, open)}`}>{CHEVRON}</span>
        </span>
      </span>
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

interface SkyChipProps {
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
