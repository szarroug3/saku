// Every tile and shelf this build could show, served once and cached forever
// (SAK-381). The Atlas's half of what /api/sky-catalogue does for the home;
// see that file for why the version is a hash and why this is prerendered.

import { atlasCatalogue } from "@/app/(sky)/atlas-catalogue";

const FOREVER = "public, max-age=31536000, immutable";

export function generateStaticParams() {
  return [{ version: atlasCatalogue().version }];
}

export async function GET(_request: Request, { params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  const catalogue = atlasCatalogue();
  const stale = version !== catalogue.version;
  return new Response(JSON.stringify(catalogue), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": stale ? "no-store" : FOREVER,
    },
  });
}
