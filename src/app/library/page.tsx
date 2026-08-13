import { LibraryPageClient } from "@/components/library/library-page";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Server wrapper: resolve the URL before rendering the interactive Library so
 * the title, controls, and shelves all ship in the first response. */
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

  return <LibraryPageClient initialSearch={params.toString()} />;
}
