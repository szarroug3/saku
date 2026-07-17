"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useQuizSession } from "@/lib/quiz-session";

// ONE nav item for the reference, and it is not the first one. The user, on
// scope: "the reference should exist as an easy way to look things up, not as
// the product." Library REPLACES "Kana chart" rather than joining it — the chart
// is a shelf in there now (/chart redirects), and two entries pointing into the
// same tab is how a reference starts competing with the drill for the top of the
// page.
const NAV: Array<{ href: string; label: string }> = [
  { href: "/", label: "Home" },
  { href: "/library", label: "Library" },
  { href: "/sessions", label: "Recent sessions" },
  // "Progress", not "Statistics" — the page stopped being statistics. Nothing
  // on it is a rate, an average or a trend any more; it is three counts of
  // things you own. The route is still /stats and deliberately so: renaming it
  // would break every link anyone has, to buy a tidier URL nobody reads.
  { href: "/stats", label: "Progress" },
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
          // ONE LINE, ALWAYS. This entry is the only nav item whose text grows
          // while you look at it — "0/214" is 31px and "214/214" is 44px — and
          // at 12px the count pushed the row to ~126px inside a 124px content
          // box, so the item silently became two lines tall somewhere around
          // the third digit and the sidebar twitched. The row is not allowed to
          // change height as a number ticks up.
          //
          // Three things hold it, and each covers a case the others don't:
          //
          //   whitespace-nowrap (on the Link) .. no wrapping, ever. The rest is
          //     about making "no wrapping" also mean "no overflow".
          //   text-[11px] on the count ......... buys the 4px that makes the
          //     worst REAL case ("214/214", every deck) fit with room to spare:
          //     76.5 + 6 + 40.4 = 123px. It is also the size every other count
          //     in this app is set at, so it costs nothing to read.
          //   min-w-0 truncate on the label .... the backstop. If a future deck
          //     ever pushes past four digits, "Current quiz" ellipses and the
          //     count — flex-none — stays whole. Degrading the label rather than
          //     the number is the right way round: the number is why you looked.
          label: (
            <>
              <span className="min-w-0 truncate">Current quiz</span>
              {progress ? (
                <span className="ml-1.5 flex-none text-[11px] tabular-nums opacity-70">
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
        // An entry page is IN the Library, so /library/kanji%3A%E7%94%9F has to
        // light the Library item — an exact match would leave the whole nav
        // unlit on the one screen you reach by clicking a link on the previous
        // one. The prefix guard is `href + "/"` and not `startsWith(href)`,
        // which for "/" would match every page in the app.
        const sel = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            // flex + whitespace-nowrap on every item, not just the quiz one:
            // the width is fixed at w-[148px] either way, so the four static
            // labels lay out identically (they are anonymous flex items, and
            // they already fit), and the one growing label gets a row it can
            // truncate inside. A rule that applies to the whole nav is also one
            // fewer thing to rediscover when the next item gets a badge.
            className={`flex items-baseline whitespace-nowrap rounded-lg px-3 py-[9px] text-left text-sm ${
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
