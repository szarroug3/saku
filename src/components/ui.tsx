"use client";

// Small hand-rolled UI kit matching the dota-data aesthetic and the legacy
// app's look: cards, uppercase section labels, chip toggles, settings rows.
// Every screen builds from these so the pages stay visually consistent.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isNearPageBottom } from "@/lib/scroll-cue";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * FLAT SECTION SURFACES, scoped by a provider rather than threaded as a prop.
 *
 * The Library entry page wants every section surface FLAT — border and radius
 * kept, the translucent `.kq-material` fill dropped — but those sections are
 * built by a dozen-odd different components that each render a <Card> of their
 * own (KanjiReadings, EntryLinks, WordBuiltFrom, the readings table, …). Passing
 * a `flat` prop would mean threading it through every one of those pass-through
 * intermediaries. Instead the entry page wraps its content in
 * <FlatSurfaceProvider> and Card reads the flag from context, so a card
 * flattens by WHERE it is rendered, not by what each intermediary forwards.
 *
 * It is read ONLY by section containers — Card here, and the two hand-rolled
 * section boxes in the verb-pair / keigo views, and the "How you say it" panel.
 * Chips, pills, buttons and the sticky drill band wear their own raw classes
 * rather than <Card>, so they keep their material: the owner wants outlined
 * section blocks with their normal chips still inside, not a flattened page.
 */
// Two flat levels. "flat" keeps the border + radius and drops only the frosty
// fill — the shipped Library entry route's look. "borderless" drops the box
// entirely (no border, radius, or padding), for the REDESIGNED entry pages whose
// own sections are divider-separated and want no boxes-within-boxes. A plain
// FlatSurfaceProvider still means "flat"; EntrySurface opts into "borderless".
type FlatLevel = "flat" | "borderless";
const FlatSurfaceContext = createContext<FlatLevel | null>(null);

export function FlatSurfaceProvider({
  children,
  borderless = false,
}: {
  children: ReactNode;
  /** Drop the box border/radius/padding too, not just the fill. */
  borderless?: boolean;
}) {
  return (
    <FlatSurfaceContext.Provider value={borderless ? "borderless" : "flat"}>
      {children}
    </FlatSurfaceContext.Provider>
  );
}

/** True when the surrounding surface should render FLAT (transparent fill) — at
 * either level. False everywhere no provider sits above, so all other Cards keep
 * their frost untouched. */
export function useFlatSurface(): boolean {
  return useContext(FlatSurfaceContext) !== null;
}

/** True when the surface wants NO box at all (border + radius + padding dropped),
 * not just the fill — the redesigned entry pages under EntrySurface. */
export function useBorderlessSurface(): boolean {
  return useContext(FlatSurfaceContext) === "borderless";
}

export function Card({
  children,
  className,
  flat: flatProp,
}: {
  children: ReactNode;
  className?: string;
  /** Force the flat look on this one card. Usually granted instead by
   * FlatSurfaceProvider (the Library entry page), so most callers never pass it. */
  flat?: boolean;
}) {
  // Flat = the entry-page look: keep the border and radius, drop the frosty
  // `.kq-material` fill (and its `bg-card`) for a transparent ground. "No fill"
  // is `bg-transparent`, not a hardcoded colour, so the flat look holds in every
  // theme. The flag comes from an explicit prop OR the surrounding provider.
  const inheritedFlat = useFlatSurface();
  const borderless = useBorderlessSurface();
  const flat = flatProp || inheritedFlat;
  return (
    <div
      className={cx(
        borderless
          ? // No box at all — the redesigned entry pages separate sections with a
            // divider, so a reused component's Card should just be its content.
            "mb-3.5 bg-transparent"
          : flat
            ? "mb-3.5 rounded-xl border border-border bg-transparent p-[18px]"
            : "kq-material mb-3.5 rounded-xl border border-border bg-card p-[18px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Uppercase section label ("QUIZ", "MISSED CHARACTERS", …). */
export function Lbl({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  /** "muted" (default) is the quiet section eyebrow every screen uses; "accent"
   * lifts a top-level group header, as the Practice page does over its
   * sub-labelled sections. */
  tone?: "muted" | "accent";
  /** Extra classes merged onto the label, e.g. `w-full` to force it onto its
   * own line inside a `flex-wrap` row of chips (the Library's two filter
   * rows). Most callers never pass this. */
  className?: string;
}) {
  return (
    <p
      className={cx(
        "mb-2 text-[13px] font-semibold uppercase tracking-[0.04em]",
        tone === "accent" ? "text-accent" : "text-text-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Wrap a fixed set of exact substrings of `text` in `text-accent` spans,
 * leaving everything else (and the wording itself) untouched. Presentation
 * only: it does not rewrite or reorder any copy, only marks a few terms as
 * the visual landmarks of a paragraph the owner asked for ("accent the
 * things that need to stand out" — SAK-27 review). Used by the SRS intro and
 * the How Saku works reference page so both apply the same convention.
 *
 * `terms` are matched literally (regex-escaped), first match only per term,
 * case-sensitive, so pick the exact casing as it appears in the source copy.
 */
export function accentTerms(text: string, terms: readonly string[]): ReactNode {
  if (terms.length === 0) return text;
  const escaped = [...terms]
    .sort((a, b) => b.length - a.length) // longest first, so a term that
    // contains a shorter one (e.g. "spaced repetition (SRS)" vs "SRS") wins.
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "g");
  const seen = new Set<string>();
  return text.split(pattern).map((chunk, i) => {
    if (terms.includes(chunk) && !seen.has(chunk)) {
      seen.add(chunk);
      return (
        <span key={i} className="text-accent">
          {chunk}
        </span>
      );
    }
    return chunk;
  });
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
        // No divider line between rows any more — the ruled-list look was the
        // last of the boxed chrome, and it read as "unchanged" against the old
        // Card version. Rows separate by their own vertical space now; the
        // section heading + whitespace group them.
        "flex flex-wrap items-center justify-between gap-2.5 py-2.5",
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

/**
 * "There's more below" — a quiet, fixed hint at the bottom of the viewport,
 * shown only while the page has content past the fold. THE PAGE SCROLLS, NOT
 * AN INNER FRAME (see layout.tsx), so scrolling always works; this exists
 * for the learner who has never had to on a quiz card before and, on a short
 * viewport, may not realise a multiple-choice grid runs past what's visible.
 *
 * Self-hiding: it tracks scroll/resize (via isNearPageBottom, kept pure and
 * DOM-free for testing) and disappears the moment the page IS scrolled to
 * its end, so it never sits over content once there's nothing left to
 * scroll to. `pointer-events-none` — it is a hint, never a tap target, so it
 * can't shadow a genuine option button sitting near the bottom edge.
 */
export function ScrollCue() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => {
      const doc = document.documentElement;
      setVisible(
        !isNearPageBottom(window.scrollY, window.innerHeight, doc.scrollHeight),
      );
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    // The grid's own height can change after mount (fonts, images), so a
    // resize observer on the document catches that too, not just viewport
    // resizes.
    const ro = new ResizeObserver(check);
    ro.observe(document.documentElement);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      ro.disconnect();
    };
  }, []);

  if (!visible) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center pb-2"
    >
      <span className="kq-material flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] text-text-muted shadow-sm">
        more below <span aria-hidden="true">↓</span>
      </span>
    </div>
  );
}
