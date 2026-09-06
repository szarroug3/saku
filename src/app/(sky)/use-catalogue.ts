"use client";

// Fetching a catalogue, once per browser tab (SAK-381).
//
// The home and the Atlas each send a learner their difference from a
// catalogue of things that are the same for everybody. The catalogue itself
// comes from its own route under a version that is a hash of its contents, so
// it is cached `immutable` and a second visit makes no request at all.
//
// The hold below is the tab's own copy, kept outside React so a second visit
// to the same page in one session does not go back even as far as the browser
// cache, and so two mounts in the same tick share one request rather than
// firing two.

import { useEffect, useState } from "react";

const held = new Map<string, Promise<unknown>>();

function fetchOnce<T>(url: string): Promise<T> {
  const have = held.get(url) as Promise<T> | undefined;
  if (have) return have;
  const wanted = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`${url} answered ${r.status}`);
      return r.json() as Promise<T>;
    })
    .catch((err: unknown) => {
      // a failed fetch must not be remembered as the answer
      held.delete(url);
      throw err;
    });
  held.set(url, wanted);
  return wanted;
}

/** The catalogue at `route` for `version`, once it is here. Null until then,
 * and null while there is no version to ask for. */
export function useCatalogue<T>(route: string, version: string | undefined): T | null {
  const [got, setGot] = useState<T | null>(null);
  useEffect(() => {
    if (!version) return;
    let live = true;
    fetchOnce<T>(`${route}/${encodeURIComponent(version)}`).then((c) => { if (live) setGot(c); });
    return () => { live = false; };
  }, [route, version]);
  return got;
}
