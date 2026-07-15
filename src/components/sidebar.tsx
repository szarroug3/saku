"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useQuizSession } from "@/lib/quiz-session";

const NAV: Array<{ href: string; label: string }> = [
  { href: "/", label: "Home" },
  { href: "/sessions", label: "Recent sessions" },
  { href: "/stats", label: "Statistics" },
  { href: "/chart", label: "Kana chart" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { active, progress } = useQuizSession();

  // Tab-switching never discards a running quiz; while one is active a
  // "Current quiz" entry (with live progress) sits right under Home.
  const items = active
    ? [
        NAV[0],
        {
          href: "/quiz",
          label: (
            <>
              Current quiz
              {progress ? (
                <span className="ml-1.5 text-xs opacity-70">
                  {progress.done}
                  {progress.total !== null ? `/${progress.total}` : ""}
                </span>
              ) : null}
            </>
          ),
        },
        ...NAV.slice(1),
      ]
    : NAV;

  return (
    <nav className="sticky top-6 flex w-[148px] flex-none flex-col gap-0.5 self-start">
      {items.map(({ href, label }) => {
        const sel = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-[9px] text-left text-sm ${
              sel ? "bg-accent-bg text-accent" : "text-text-muted hover:bg-panel"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
