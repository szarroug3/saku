import { notFound } from "next/navigation";

// The /dev/* routes (the design gallery at /dev/views, the scheduler view, the
// number playground) are development-only reference surfaces: useful while
// building, not something to ship. This server layout gates the whole subtree:
// in a production build every /dev/* path 404s, while `next dev` (and any
// non-production build) renders them normally.
//
// NODE_ENV is inlined at build time, so the check costs nothing at runtime and
// the pages are simply unreachable in the shipped app. The old app's frame
// went with the archive (2026-09-06); the galleries sit on the page as is.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="min-h-dvh px-4 py-3">{children}</main>;
}
