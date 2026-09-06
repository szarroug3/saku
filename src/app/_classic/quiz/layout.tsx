// The Quiz page is a Client Component, which cannot export `metadata`. This
// segment layout carries its title so the tab reads "Saku · Quiz" (composed
// through the root template in src/app/layout.tsx).
import type { ReactNode } from "react";

export const metadata = { title: "Quiz" };

export default function QuizLayout({ children }: { children: ReactNode }) {
  return children;
}
