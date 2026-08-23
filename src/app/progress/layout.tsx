// The Progress page (/progress) is a Client Component, which cannot export
// `metadata`. This segment layout carries its title so the tab reads
// "Saku · Progress" (composed through the root template in src/app/layout.tsx).
import type { ReactNode } from "react";

export const metadata = { title: "Progress" };

export default function ProgressLayout({ children }: { children: ReactNode }) {
  return children;
}
