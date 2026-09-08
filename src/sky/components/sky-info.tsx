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

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { aboveAnchor, belowAnchor, Floating, SkyCard, type Anchor } from "@/sky/components/sky-card";

interface SkyInfoProps {
  /** What the mark explains, for assistive tech: "About audio prompts". */
  label: string;
  /** Room for a table rather than a sentence (the standings' key). */
  wide?: boolean;
  className?: string;
  children: ReactNode;
}

export function SkyInfo({ label, wide = false, className = "", children }: SkyInfoProps) {
  const id = useId();
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
        className={`inline-flex size-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-sky-accent text-sky-accent hover:bg-sky-accent/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-accent ${at ? "bg-sky-accent/15" : ""}`}
      >
        {/* the i is drawn, not typed, so it sits dead centre in the ring
            whatever the font's side bearings do */}
        <svg viewBox="0 0 10 10" aria-hidden className="size-[7px] fill-current">
          <circle cx="5" cy="1.6" r="1.15" />
          <rect x="4.05" y="3.7" width="1.9" height="5.2" rx="0.7" />
        </svg>
      </button>
      {at && (
        <Floating id={id} at={at} gap={8} className={`w-max ${wide ? "max-w-[min(420px,calc(100vw-16px))]" : "max-w-[min(300px,calc(100vw-16px))]"}`}>
          <SkyCard className="px-3 py-2.5 leading-relaxed">{children}</SkyCard>
        </Floating>
      )}
    </span>
  );
}
