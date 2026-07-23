"use client";

// The banner a signed-out visitor sees above app pages: a heads-up that nothing
// they do here is being saved to an account, with a one-click way in. Hidden on
// the landing and the auth pages, which make the point themselves. `show` is the
// server's answer to "auth is on and there's no session".

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
        You&rsquo;re not signed in, so your progress here won&rsquo;t be saved.
      </span>
      <Link href="/login" className="flex-none font-medium text-accent hover:underline">
        Sign in to keep it →
      </Link>
    </div>
  );
}
