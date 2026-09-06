// Every star this build could draw, served once and cached forever (SAK-381).
//
// The home used to put its fifteen thousand stars in every response. They are
// the same stars for every learner, so they come from here instead, and what
// the home sends is the difference (see sky-payload.ts). The version in the
// path is a hash of the contents, so "forever" is safe: a build that changes
// a star changes the path, and nothing is ever served stale under an old one.
//
// Prerendered at build time by `generateStaticParams`, so in production this
// is a file on the CDN and no function runs for it at all.

import { skyCatalogue } from "@/app/(sky)/catalogue";

/** A year, which is as long as a cache is allowed to be told to hold
 * something. `immutable` is the part that matters: no revalidation request on
 * a repeat visit, not even a 304. */
const FOREVER = "public, max-age=31536000, immutable";

export function generateStaticParams() {
  return [{ version: skyCatalogue().version }];
}

export async function GET(_request: Request, { params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  const catalogue = skyCatalogue();
  // A request for a version this build does not have can only come from a
  // page rendered by an older one, in the seconds around a deploy. Answer with
  // what we do have, since the payload's standings are keyed by star id and
  // join perfectly well, but do not let anything cache it under that path.
  const stale = version !== catalogue.version;
  return new Response(JSON.stringify(catalogue), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": stale ? "no-store" : FOREVER,
    },
  });
}
