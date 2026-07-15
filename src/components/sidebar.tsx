"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
  const router = useRouter();
  const { active, abandonQuiz } = useQuizSession();

  return (
    <nav className="sticky top-6 flex w-[148px] flex-none flex-col gap-0.5 self-start">
      {NAV.map(({ href, label }) => {
        const sel = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={(e) => {
              // Leaving a live quiz discards it — confirm first (legacy parity).
              if (active) {
                e.preventDefault();
                if (
                  confirm("Leave the current quiz? It won't be scored or saved.")
                ) {
                  abandonQuiz();
                  router.push(href);
                }
              }
            }}
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
