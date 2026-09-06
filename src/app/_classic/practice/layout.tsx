// The Practice page is a Client Component, which cannot export `metadata`. This
// segment layout carries its title so the tab reads "Saku · Practice" (composed
// through the root template in src/app/layout.tsx).
import type { ReactNode } from "react";

export const metadata = { title: "Practice" };

export default function PracticeLayout({ children }: { children: ReactNode }) {
  return children;
}
