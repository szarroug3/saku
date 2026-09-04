"use client";

// A Sky page inside the dev gallery: the wash fixed behind, the page
// scrolling over it. The wash is one fixed layer (the way the app will paint
// it under everything at cutover), clipped to the gallery's content column
// by starting at the column's left edge, which does not move as the page
// scrolls. Measured, not assumed, so a narrower shell still lines up.

import { useEffect, useRef, useState, type ReactNode } from "react";

export function SkyPage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setLeft(el.getBoundingClientRect().left);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return (
    <div ref={ref} className="relative isolate -mx-6 -my-8 min-h-[calc(100vh-4rem)] px-6 py-8">
      {left !== null && <div aria-hidden className="sky-wash fixed bottom-0 right-0 top-0 -z-10" style={{ left }} />}
      {children}
    </div>
  );
}
