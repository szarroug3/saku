"use client";

// SAK-204: keeps `--kq-scroll-h` on <html> equal to `.kq-scroll`'s own
// clientHeight — the ONE scrolling row of the app shell's 3-row frame
// (app/layout.tsx). `.kq-center-frame` (globals.css) uses it to floor a
// short screen's content at the actual available height instead of a
// fixed `100dvh` guess: since the header/banner/footer docks are now
// separate flex ROWS outside kq-scroll entirely (not siblings inside the
// same column any more), `100dvh` was never kq-scroll's real height to
// begin with — it's whatever's left after the header/footer rows take
// theirs, which only the browser's own flex layout actually knows.
//
// Without this, a short quiz/lesson screen's centering frame floors itself
// to the WRONG height on any page with a populated header dock (chiefly:
// any signed-out learner, who sees the banner on nearly every page),
// leaving either dead space below the content or a forced scrollbar with
// nothing real to scroll to — which ScrollCue then misreads as "more
// below."

import { useEffect } from "react";

export function DockHeightVar() {
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".kq-scroll");
    if (!scroller) return;
    const update = () => {
      document.documentElement.style.setProperty(
        "--kq-scroll-h",
        `${scroller.clientHeight}px`,
      );
    };
    update();
    // Both observers, not just one. A dock's content arrives via
    // `createPortal` (see components/dock.tsx) a tick after this effect's own
    // first run — a mount that inserts a subtree doesn't reliably fire a
    // ResizeObserver callback in every environment (a populated header/footer
    // dock changes kq-scroll's OWN height, since it's a flex sibling of
    // both), so a MutationObserver on the docks' childList/subtree is what
    // actually catches "the banner just appeared." ResizeObserver stays too,
    // for a height that changes without a DOM mutation — a viewport resize
    // that wraps the banner's text onto a second line, say.
    const ro = new ResizeObserver(update);
    ro.observe(scroller);
    const mo = new MutationObserver(update);
    for (const id of ["kq-dock-banner", "kq-dock-top", "kq-dock-bottom"]) {
      const el = document.getElementById(id);
      if (el) mo.observe(el, { childList: true, subtree: true });
    }
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
