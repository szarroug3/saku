// The page's own timings, in the head, in Server-Timing's format.
//
// Rendered LAST in a page, after everything it awaits, so the phases are all
// recorded by the time this runs. React hoists a <meta> into the head wherever
// it is rendered, so it goes out with the stream.
//
// Read it with:
//   document.querySelector('meta[name="server-timing"]').content

import { headers } from "next/headers";

import { edgeToPage, serverTimingValue } from "@/lib/server-timing";

export async function ServerTimingMeta() {
  // plus the edge-to-page gap, the cold start's own measure (SAK-399)
  const value = serverTimingValue(edgeToPage((await headers()).get("x-edge-at")));
  if (!value) return null;
  return <meta name="server-timing" content={value} />;
}
