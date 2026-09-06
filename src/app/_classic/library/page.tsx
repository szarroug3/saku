import { LibraryPageClient } from "@/components/library/library-page";
import { getLibraryShelves } from "@/lib/library/server-lookups";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Server wrapper: resolve the URL AND the shelves before rendering the
 * interactive Library so the title, controls, and shelves all ship in the
 * first response.
 *
 * SAK-121: `getLibraryShelves` used to be called from LibraryPageClient (a
 * "use client" component) via useServerLookup, which fires its Server Action
 * round trip on MOUNT — an irreducible client → server → client gap on every
 * hard navigation/new tab, no matter how warm the IndexedDB/module cache is
 * (SAK-110–120 made a SECOND visit instant; this makes the FIRST one instant
 * too). Calling it here instead, as a plain `await` in a Server Component, and
 * handing the resolved shelves down as a prop, ships the shelf HTML in this
 * page's own first response and makes the route eligible for Next's data
 * cache / static rendering — getLibraryShelves is already `unstable_cache`d
 * (chunked, SAK-110/111/119), so this await is a cache read, not a fresh
 * computation. */
export const metadata = { title: "Library" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["kind", "q", "state"] as const) {
    const value = first(raw[key]);
    if (value !== undefined) params.set(key, value);
  }

  const shelves = await getLibraryShelves();

  return (
    <LibraryPageClient initialSearch={params.toString()} initialShelves={shelves} />
  );
}
