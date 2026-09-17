"use client";

// The one info mark in the Sky: a drawn "i" in a ring of the accent, and
// the note it opens above itself. Hover it, focus it or click it; Escape,
// a click elsewhere, or anything scrolling closes it. Tracked as SAK-366.
//
// There used to be two of these. This one, drawn for the standing legend,
// and the app's Radix tooltip restyled to match and handed to Practice,
// Settings and the results as a `tip` prop, because nothing in src/sky may
// import the app. They were made to look alike by hand and still behaved
// differently: two hover rules, two placements, two ways of closing. This
// is the one, it needs no prop, and it belongs to the Sky.
//
// It warns as well as it informs (SAK-439). A standing line of advice was a
// sentence sitting on the page in a quiet amber, which is a lot of room for
// something you read once; behind a mark it is there when it is wanted and
// gone otherwise. `tone` is the whole of the difference: the glyph and the
// color. Placement, Escape, focus, the aria wiring and the card are the same
// code, because a second copy of the tooltip is how the two marks drifted
// apart the first time.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { aboveAnchor, belowAnchor, Floating, SkyCard, type Anchor } from "@/sky/components/sky-card";

/** How each tone paints: the glyph, the ink, and the wash it takes while the
 * note is open. The accent belongs to the things you press (a hear button, a
 * "Why?"), so a warning keeps the shaky amber it has always warned in. */
const TONE = {
  info: { ink: "text-sky-accent", ring: "rounded-full border border-sky-accent", wash: "bg-sky-accent/15", hover: "hover:bg-sky-accent/15", outline: "focus-visible:outline-sky-accent" },
  warning: { ink: "text-sky-shaky", ring: "rounded-[4px]", wash: "bg-sky-shaky/15", hover: "hover:bg-sky-shaky/15", outline: "focus-visible:outline-sky-shaky" },
} as const;

/** The "i", drawn rather than typed so it sits dead center in the ring
 * whatever the font's side bearings do. */
function InfoGlyph() {
  return (
    <svg viewBox="0 0 10 10" aria-hidden className="size-[7px] fill-current">
      <circle cx="5" cy="1.6" r="1.15" />
      <rect x="4.05" y="3.7" width="1.9" height="5.2" rx="0.7" />
    </svg>
  );
}

/** The warning triangle, drawn for the same reason, and its own outline: it
 * needs no ring around it the way the "i" does. */
function WarnGlyph() {
  return (
    <svg viewBox="0 0 14 13" aria-hidden className="size-3.5">
      <path d="M7 1.2 13 12H1Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <rect x="6.35" y="5" width="1.3" height="3.7" rx="0.65" fill="currentColor" />
      <circle cx="7" cy="10.2" r="0.78" fill="currentColor" />
    </svg>
  );
}

interface SkyInfoProps {
  /** What the mark explains, for assistive tech: "About audio prompts". */
  label: string;
  /** What kind of mark it is: an "i" in the accent, or the warning triangle
   * in the shaky amber. Everything else about the two is the same. */
  tone?: keyof typeof TONE;
  /** Room for a table rather than a sentence (the standings' key). */
  wide?: boolean;
  className?: string;
  children: ReactNode;
}

export function SkyInfo({ label, tone = "info", wide = false, className = "", children }: SkyInfoProps) {
  const id = useId();
  const paint = TONE[tone];
  const mark = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<Anchor | null>(null);
  // Above it, because a mark usually sits at the foot of something with
  // nothing below to spill into. Near the top of the window there is
  // nothing above either, so it opens downward instead of off the screen.
  const open = () => {
    const r = mark.current?.getBoundingClientRect();
    if (r) setAt(r.top < window.innerHeight * 0.35 ? belowAnchor(r) : aboveAnchor(r));
  };
  const close = () => setAt(null);

  useEffect(() => {
    if (!at) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setAt(null); };
    const gone = () => setAt(null);
    document.addEventListener("keydown", key);
    document.addEventListener("scroll", gone, true);
    window.addEventListener("resize", gone);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("scroll", gone, true); window.removeEventListener("resize", gone); };
  }, [at]);

  return (
    <span className={`inline-flex items-center ${className}`} onPointerEnter={open} onPointerLeave={close}>
      <button
        ref={mark}
        type="button"
        aria-expanded={at !== null}
        aria-controls={id}
        aria-label={label}
        onFocus={open}
        onBlur={close}
        onClick={() => (at ? close() : open())}
        className={`inline-flex size-3.5 shrink-0 cursor-help items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 ${paint.ring} ${paint.ink} ${paint.hover} ${paint.outline} ${at ? paint.wash : ""}`}
      >
        {tone === "warning" ? <WarnGlyph /> : <InfoGlyph />}
      </button>
      {at && (
        <Floating id={id} at={at} gap={8} className={`w-max ${wide ? "max-w-[min(420px,calc(100vw-16px))]" : "max-w-[min(300px,calc(100vw-16px))]"}`}>
          <SkyCard className="px-3 py-2.5 leading-relaxed">{children}</SkyCard>
        </Floating>
      )}
    </span>
  );
}
