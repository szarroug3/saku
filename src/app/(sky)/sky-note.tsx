// The line over a Sky page: whose progress it shows, and the way to the
// sample learner. Under the shell's bar, above the page.

import type { ReactNode } from "react";

export function SkyNote({ children }: { children: ReactNode }) {
  return <p className="mb-3 shrink-0 font-sky-ui text-[12px] text-sky-muted">{children}</p>;
}
