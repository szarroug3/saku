"use client";

// Render children into one of the shell's frozen docks (see app/layout.tsx) —
// the strips ABOVE and BELOW the scrolling frame that stay put while the frame's
// content scrolls. A page uses this to lift a header or a footer bar out of the
// scroll and into its own box outside the main frame; in kiri that also keeps
// the bar off the frosted frame, so scrolling re-blends nothing under it.
//
// The portal can only attach after mount (there is no document on the server),
// but its content must not disappear until then. Render it in place for SSR and
// the hydration paint, then move that same content into the frozen shell slot.
// This is especially visible on the Library: its shelves are server-rendered,
// so returning null here made them flash before the title, search, and filters.

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

// A "mounted?" flag WITHOUT a setState-in-effect (which the lint rules ban, and
// which would cascade a render): the store never changes, so the subscribe is a
// no-op; getSnapshot returns true on the client and getServerSnapshot returns
// false, so this is false through SSR and the first paint and true once mounted.
const noop = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function Dock({
  slot,
  children,
}: {
  slot: "banner" | "top" | "bottom";
  children: ReactNode;
}) {
  const mounted = useSyncExternalStore(noop, onClient, onServer);
  if (!mounted) return children;
  const el = document.getElementById(`kq-dock-${slot}`);
  return el ? createPortal(children, el) : children;
}
