"use client";

// A write, then the route read again. The pages render the learner's
// progress on the server (SAK-398), so a claim, a forget or a cleared mix-up
// made from a page is followed by re-rendering that page with it. Every
// client that writes used to spell the pair out for itself; this is the pair,
// once.

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/** The write, with the route read again once it lands. */
export function useRefreshed<A extends unknown[]>(write: (...args: A) => Promise<unknown>): (...args: A) => Promise<void> {
  const router = useRouter();
  return useCallback(async (...args: A) => { await write(...args); router.refresh(); }, [router, write]);
}
