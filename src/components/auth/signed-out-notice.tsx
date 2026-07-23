"use client";

// The banner a signed-out visitor sees above app pages: a heads-up that their
// progress lives in this browser only, with a one-click way to sign in and keep
// it across devices. Hidden on the landing and the auth pages, which make the
// point themselves. `show` is the server's answer to "auth is on and there's no
// session".
//
// The old copy said progress "won't be saved". That stopped being true: a
// signed-out learner's work now persists in this browser's localStorage (see
// store/local-progress.ts) and merges into the account on sign-in. So the honest
// message is not "nothing is saved" but "this is saved here, sign in to carry it
// with you".

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SignedOutNotice({ show }: { show: boolean }) {
  const pathname = usePathname();
  if (!show) return null;
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth")
  ) {
    return null;
  }
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-accent/30 bg-accent-bg px-4 py-2.5 text-[13px]">
      <span className="text-text-muted">
        Your progress is saved in this browser only. Sign in to keep it across
        your devices.
      </span>
      <Link href="/login" className="flex-none font-medium text-accent hover:underline">
        Sign in to keep it →
      </Link>
    </div>
  );
}
