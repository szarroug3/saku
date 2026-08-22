"use client";

// Keeps `--kq-dock-h` on <html> equal to the combined height of the two
// frozen docks above the scrolling frame (#kq-dock-banner, #kq-dock-top) —
// real chrome .kq-center-frame's own 120px constant (globals.css) never
// accounted for, and structurally can't: whether the signed-out banner or a
// page's own top dock has anything in it is dynamic, not a layout constant.
// Without this, a short quiz card's centering frame floors itself too tall
// on any page with a populated dock (chiefly: any signed-out learner, who
// sees the banner on nearly every page), leaving trailing empty space below
// the actual content — which ScrollCue then reads as "more below" when
// there is nothing to scroll to.

import { useEffect } from "react";

export function DockHeightVar() {
  useEffect(() => {
    const banner = document.getElementById("kq-dock-banner");
    const top = document.getElementById("kq-dock-top");
    const targets = [banner, top].filter(
      (el): el is HTMLElement => el !== null,
    );
    if (!targets.length) return;
    const update = () => {
      const total = targets.reduce((sum, el) => sum + el.offsetHeight, 0);
      document.documentElement.style.setProperty("--kq-dock-h", `${total}px`);
    };
    update();
    // Both observers, not just one. A dock's content arrives via
    // `createPortal` (see components/dock.tsx) a tick after this effect's own
    // first run — a mount that inserts a subtree doesn't reliably fire a
    // ResizeObserver callback in every environment, so a MutationObserver on
    // childList/subtree is what actually catches "the banner just appeared."
    // ResizeObserver stays too, for a height that changes without a DOM
    // mutation — a viewport resize that wraps the banner's text onto a
    // second line, say.
    const ro = new ResizeObserver(update);
    targets.forEach((el) => ro.observe(el));
    const mo = new MutationObserver(update);
    targets.forEach((el) =>
      mo.observe(el, { childList: true, subtree: true }),
    );
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
