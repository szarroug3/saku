import { notFound } from "next/navigation";

// The /dev/* routes (the design gallery at /dev/views, the scheduler view, the
// number playground) are development-only reference surfaces — genuinely useful
// while building, but not something to ship. This server layout gates the whole
// subtree: in a production build every /dev/* path 404s, while `next dev` (and
// any non-production build) renders them normally.
//
// NODE_ENV is inlined at build time, so the check costs nothing at runtime and
// the pages are simply unreachable in the shipped app. The one exception is
// the end-to-end suite, which runs a production build and sets
// SAKU_DEV_PAGES=1 (playwright.config.ts) to reach the Sky's pages under
// /dev/sky (SAK-348); nothing deployed sets it.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.SAKU_DEV_PAGES !== "1") notFound();
  return <>{children}</>;
}
