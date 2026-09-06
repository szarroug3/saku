"use client";

// The Sky pages inside the dev tree: the home and the Planetarium, on their
// real data, until cutover. The component galleries that used to live
// beside them are gone (Sam, 2026-09-04): pages are reviewed whole.
//
// Dev-only: the parent src/app/dev/layout.tsx 404s this whole subtree in a
// production build.

import { Karla, Shippori_Mincho } from "next/font/google";
import type { ReactNode } from "react";

// The Sky's two webfonts, loaded once here and exposed as CSS variables that
// the --sky-font-* tokens in globals.css read (with system fallbacks if these
// are absent). Loading them in the layout means every Sky route gets them
// without importing fonts itself. See SAK-291.
const shipporiMincho = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-shippori-mincho",
  display: "swap",
  preload: false,
});
const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-karla",
  display: "swap",
});

export default function SkyLayout({ children }: { children: ReactNode }) {
  return <main className={`${shipporiMincho.variable} ${karla.variable} mx-auto max-w-[1180px] px-6 py-8`}>{children}</main>;
}
