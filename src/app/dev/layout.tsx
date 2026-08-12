import { notFound } from "next/navigation";

// The /dev/* routes (the design gallery at /dev/views, the scheduler view, the
// number playground) are development-only reference surfaces — genuinely useful
// while building, but not something to ship. This server layout gates the whole
// subtree: in a production build every /dev/* path 404s, while `next dev` (and
// any non-production build) renders them normally.
//
// NODE_ENV is inlined at build time, so the check costs nothing at runtime and
// the pages are simply unreachable in the shipped app.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
