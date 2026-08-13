// The Progress page (/stats) is a Client Component, which cannot export
// `metadata`. This segment layout carries its title so the tab reads
// "Saku · Progress" (composed through the root template in src/app/layout.tsx).
// "Progress" matches the sidebar label, not the route path.
import type { ReactNode } from "react";

export const metadata = { title: "Progress" };

export default function StatsLayout({ children }: { children: ReactNode }) {
  return children;
}
