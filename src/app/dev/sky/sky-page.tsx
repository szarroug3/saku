"use client";

// A Sky page inside the dev gallery: the wash fixed behind, and the page
// sized to exactly the viewport below the gallery's chrome, so the document
// never scrolls and only the page's own regions do (Sam's rule: the heading
// and everything around the main area stay put). The wash is one fixed
// layer (the way the app will paint it under everything at cutover),
// clipped to the gallery's content column by starting at the column's left
// edge. Both are measured, not assumed, so a narrower shell still lines up.

import { useEffect, useRef, useState, type ReactNode } from "react";

export function SkyPage({ note, children }: { note?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; height: number } | null>(null);
  // How much the shell needs below this page (its own padding): learned once,
  // from the overflow the first full-height layout produces.
  const trailing = useRef<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      // the nearest thing that scrolls: the app shell's own container, or the window
      let sc: HTMLElement | null = el.parentElement;
      while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
      const bottom = sc ? sc.getBoundingClientRect().bottom : window.innerHeight;
      const overhang = sc ? sc.scrollHeight - sc.clientHeight : document.documentElement.scrollHeight - window.innerHeight;
      const available = bottom - r.top;
      if (trailing.current === null) {
        // first pass: take everything to the bottom; second: what overflowed is the shell's
        if (Math.abs(r.height - available) > 1) { setBox({ left: r.left, height: available }); return; }
        trailing.current = Math.max(0, overhang);
      }
      setBox({ left: r.left, height: Math.max(320, available - trailing.current) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return (
    <div ref={ref} className="relative isolate -mx-6 -my-8 flex flex-col overflow-hidden px-6 py-6" style={box ? { height: box.height } : { minHeight: "calc(100vh - 4rem)" }}>
      {box && <div aria-hidden className="sky-wash fixed bottom-0 right-0 top-0 -z-10" style={{ left: box.left }} />}
      <div className="mx-auto flex min-h-0 w-full max-w-[1180px] flex-1 flex-col">
        {note && <p className="mb-3 shrink-0 font-sky-ui text-[12px] text-sky-muted">{note}</p>}
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
