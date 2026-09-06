import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { DockHeightVar } from "@/components/dock-height-var";
import { Sidebar } from "@/components/sidebar";
import { currentUserId } from "@/lib/auth";
import { isSupabaseStore } from "@/lib/store/mode";

// The /dev/* routes (the design gallery at /dev/views, the scheduler view, the
// number playground) are development-only reference surfaces — genuinely useful
// while building, but not something to ship. This server layout gates the whole
// subtree: in a production build every /dev/* path 404s, while `next dev` (and
// any non-production build) renders them normally.
//
// NODE_ENV is inlined at build time, so the check costs nothing at runtime and
// the pages are simply unreachable in the shipped app.
export default async function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  // The old app's frame (sidebar, dock slots, the one scrolling row), kept
  // for the galleries since cutover (2026-09-06): the Sky's pages have
  // their own shell in src/app/(sky)/layout.tsx.
  const authEnabled = isSupabaseStore();
  const signedIn = authEnabled && (await currentUserId()) !== null;
  const cookieStore = await cookies();
  const collapsed = cookieStore.get("saku-sidebar-collapsed")?.value === "1";
  return (
    <div className="flex gap-3.5 px-3">
      <Sidebar signedIn={signedIn} authEnabled={authEnabled} initialCollapsed={collapsed} initialRunCount={0} />
      <main className="relative flex h-dvh min-w-0 flex-1 flex-col">
        <div className="shrink-0">
          <div id="kq-dock-banner" className="kq-dock kq-content empty:hidden" />
          <div id="kq-dock-top" className="kq-dock kq-content empty:hidden" />
        </div>
        <DockHeightVar />
        <div className="relative min-h-0 flex-1">
          <div className="kq-stage pointer-events-none absolute inset-0" aria-hidden />
          <div className="kq-scroll relative h-full overflow-x-clip overflow-y-auto">
            <div className="kq-content px-2 pt-3 pb-3">{children}</div>
          </div>
        </div>
        <div id="kq-dock-bottom" className="kq-dock kq-content shrink-0 empty:hidden" />
      </main>
    </div>
  );
}
