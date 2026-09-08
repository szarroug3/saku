// The scrolling body of a Sky page: the column under the shell that holds the
// panels and scrolls on its own, so the shell's bar stays put. Five screens
// had the same class string pasted in, two of them with the reading width
// (SAK-398's review); one place for it now, so a change to how a page
// scrolls is a change here.

import type { ReactNode } from "react";

export function SkyPageBody({ children, width = "full", className = "" }: {
  children: ReactNode;
  /** `reading`: the 720px column the quiz and its results read in. */
  width?: "full" | "reading";
  className?: string;
}) {
  const column = width === "reading" ? "mx-auto w-full max-w-[720px] " : "";
  return <div className={`${column}flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto font-sky-ui ${className}`.trim()}>{children}</div>;
}
