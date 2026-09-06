"use client";

// Whether this is the browser yet.
//
// For anything whose right answer depends on WHERE it is being read: a time in
// the reader's own timezone, a width, a locale. Rendered on the server those
// come out as the server's answer, which is then either kept or swapped under
// the reader — a hydration mismatch, and on a deployed server the wrong
// wall-clock time (SAK-355).
//
// `useSyncExternalStore` is the honest way to say it: the server snapshot is
// false and the client's is true, so React knows the two renders differ on
// purpose and neither warns nor keeps the wrong one. The store never changes,
// so nothing ever re-subscribes.

import { useSyncExternalStore } from "react";

const never = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function useMounted(): boolean {
  return useSyncExternalStore(never, onClient, onServer);
}
