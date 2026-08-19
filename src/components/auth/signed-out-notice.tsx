import Link from "next/link";

// The heads-up a signed-out learner sees: their work lives in this browser
// until they sign in. It has ONE home in two places — inline under the sidebar's
// Sign in control when the bar is expanded, and lifted to the frozen top dock
// when the bar is collapsed to a rail (where there is no room for it). The copy
// lives here ONCE so the two placements can never drift apart.
const MESSAGE =
  "Your progress is saved in this browser only. Sign in to keep it across your devices.";

/**
 * The signed-out notice, in one of two layouts:
 *
 * - "sidebar": the bare paragraph as it sits beneath the sidebar's Sign in nav
 *   link (which stays a separate item in the nav). Unchanged from before.
 * - "banner": a self-contained bar — the same message plus its own Sign in
 *   control — for the frozen top dock, used when the sidebar is collapsed so the
 *   notice (and the way to act on it) survive the rail having no room for either.
 */
export function SignedOutNotice({ variant }: { variant: "sidebar" | "banner" }) {
  if (variant === "banner") {
    return (
      // px-3 matches the scroller's inset (and the Library's docked header) so
      // the bar lines up with the page content below it. The accent-bordered
      // card and the "Sign in to keep it →" affordance are this file's own prior
      // design for exactly this role — a page-top banner — reused as-is now that
      // the notice needs that home again when the sidebar is collapsed.
      //
      // This card lives inside #kq-dock-banner (app/layout.tsx), which is
      // `sticky top-0` over THE PAGE'S OWN SCROLL — the whole app scrolls
      // <html>, not an inner frame, so a sticky band here is a page header, not
      // a boxed panel: content scrolls UNDER it exactly the way rows scroll
      // under any sticky header, and a translucent fill (bg-accent-bg is
      // `color-mix(accent 12%, transparent)`) lets that content show straight
      // through — the card text UNDER it visually colliding with this text.
      // `kq-band` is this app's fix for exactly that shape of bug (globals.css,
      // CARD MATERIAL — "a sticky surface must occlude"), already worn by every
      // other sticky band in the app (SessionHud's floated lesson bar, the quiz
      // HUDs, the Library's docked header): an opaque fill per theme (kiri
      // still frosts instead of flattening), so nothing can ever render behind
      // this banner while it sticks. Replaces bg-accent-bg rather than joining
      // it — two rules setting background-color is a fight over source order
      // (globals.css's .kq-surface note walks through the same trap), and
      // kq-band is the rule built to win that fight on purpose.
      <div className="px-3">
        <div className="kq-band flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-accent/30 px-4 py-2.5 text-[13px]">
          <span className="text-text-muted">{MESSAGE}</span>
          <Link
            href="/login"
            className="flex-none font-medium text-accent hover:underline"
          >
            Sign in to keep it →
          </Link>
        </div>
      </div>
    );
  }
  return (
    <p className="px-3 pt-1 text-[11px] leading-snug text-text-muted">{MESSAGE}</p>
  );
}
