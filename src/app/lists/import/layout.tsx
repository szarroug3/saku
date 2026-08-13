// The list-import page is a Client Component, which cannot export `metadata`.
// This segment layout carries its title so the tab reads "Saku · Import a list"
// (composed through the root template in src/app/layout.tsx).
import type { ReactNode } from "react";

export const metadata = { title: "Import a list" };

export default function ImportLayout({ children }: { children: ReactNode }) {
  return children;
}
