// The Session page is a Client Component, which cannot export `metadata`.
// This segment layout carries its title so the tab reads "Saku · Session"
// (composed through the root template in src/app/layout.tsx).
import type { ReactNode } from "react";

export const metadata = { title: "Session" };

export default function SessionLayout({ children }: { children: ReactNode }) {
  return children;
}
