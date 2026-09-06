// The Results page is a Client Component, which cannot export `metadata`. This
// segment layout carries its title so the tab reads "Saku · Results" (composed
// through the root template in src/app/layout.tsx).
import type { ReactNode } from "react";

export const metadata = { title: "Results" };

export default function ResultsLayout({ children }: { children: ReactNode }) {
  return children;
}
