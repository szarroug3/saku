"use client";

// The search band — lifted from src/app/chart/page.tsx, whose comments are the
// history of this component and are kept in full below. It was already the right
// answer to "a field that drives a long page must not scroll away"; it just
// happened to live on the only long page there was.
//
// It is a component now because the Library has the same problem at 9,761
// entries instead of 214, and copying the field would have copied a fix that
// took four passes to get right — the `kq-surface` note below is the record of
// three of them.

import { useEffect, useRef, useState } from "react";

/** True once the field has pinned itself to the top of the viewport.
 *
 * An IntersectionObserver on a zero-height sentinel sitting immediately above
 * the field: while the sentinel is on screen the field is in the flow, and the
 * frame it leaves through the top is the frame the field pins. That is the
 * boring route, and it is the one that works — the elegant route is
 * `container-type: scroll-state` + `@container scroll-state(stuck: top)`, which
 * is Chrome 133+ and, on anything older, silently resolves to "never stuck". A
 * stuck-detection that fails closed doesn't degrade the fix, it deletes it, and
 * leaves nothing on screen to say so. IntersectionObserver is everywhere this
 * app already runs. */
function useStuck(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: [0] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return [sentinel, stuck];
}

export function StickySearch({
  value,
  onChange,
  placeholder,
  children,
  bare = false,
}: {
  value: string;
  onChange(v: string): void;
  placeholder: string;
  /** The filter chips, which pin with the field — the field and the chips are
   * one control, and pinning half of it means scrolling back up to find out
   * which shelf you were on. */
  children?: React.ReactNode;
  /** Drop the occluding surface and the sticky mechanism: the field is in a
   * FROZEN DOCK now (see components/dock.tsx), not the scroll flow, so nothing
   * slides under it and the kq-surface panel was just a second box behind the
   * field. Bare renders the field and chips alone; the dock's own box is the
   * only surface. */
  bare?: boolean;
}) {
  const [sentinel, stuck] = useStuck();
  if (bare) {
    return (
      <div className="w-full">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-(--radius) border border-border bg-transparent px-2.5 py-2 text-[15px] text-text"
        />
        {children ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-2.5">
            {children}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <>
      {/* Zero-height, and it must stay directly above the field: it is what
          `useStuck` watches. */}
      <div ref={sentinel} aria-hidden="true" />
      {/* THE FIELD IS A FIELD UNSTUCK AND A BAND STUCK, and the wrapper is what
          lets it be both.

          `kq-surface` instead of `bg-card`, and that swap is the whole fix.
          What has to happen here is OCCLUSION — the entries must vanish under
          this field, not show through it — and the obvious tool is a no-op:

            a backdrop-filter inside an element that already has one does
            nothing in Chromium (the outer one becomes a backdrop root).

          In kiri, `rounded-lg` + `bg-card` IS the input recipe that hands a
          field `backdrop-filter: blur(18px)` (see globals.css), so any blur we
          added here would be inside our own backdrop root and silently do
          nothing — leaving kiri's --card (5.5% white) to hold back the page on
          its own, which it cannot. That is the bug that has been "fixed" three
          times: sticky quiz header, trend tooltip, grid scrim. The trap in
          reaching for an opaque fill instead is that a colour that merely
          approximates the field reads as a grey slab sitting on the page.

          kq-surface is the existing answer to exactly this: --bg, then the mesh
          at `background-attachment: fixed` (the same anchoring body::before
          uses, so the gradients land on identical pixels), then --card over
          both, saturated to match a real card. Not a colour LIKE the field's —
          the field's own recipe, rebuilt opaque.

          The surface has to live on the WRAPPER, not the input: it needs a
          pseudo-element to carry the saturate, and an <input> is replaced
          content that renders no ::before at all.

          THE SHAPING. Rounded is right for a field sitting in a layout and
          wrong for a lid over scrolling content: pinned, content slides up
          through the quarter-circle gaps at the bar's shoulders. So stuck
          squares the top corners and drops the shelf shadow. The bottom corners
          stay rounded: nothing scrolls UP from below, so there is no gap to
          close there, and keeping them is what stops the band from reading as a
          different component than the field it just was. */}
      <div
        className={`kq-surface sticky top-0 z-20 mb-3 w-full ${
          stuck ? "rounded-b-(--radius)" : "rounded-(--radius) shadow-btn"
        }`}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full border border-border bg-transparent px-2.5 py-2 text-[15px] text-text ${
            stuck ? "rounded-b-(--radius) rounded-t-none" : "rounded-(--radius)"
          }`}
        />
        {children ? (
          <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-2 pt-2">
            {children}
          </div>
        ) : null}
      </div>
    </>
  );
}
