// Frost-lite card surface — the soft translucent panel the meaning-model views
// use instead of the wireframe (bordered) Card.
//
// The original frosty look used `backdrop-filter: blur()`, which is the part that
// cost performance (live GPU blur, worst across multiple displays). This drops
// the blur and keeps the FEEL: a translucent panel so the warm ground bleeds
// through. NO box-shadow either — a shadow with any blur radius (this one had
// 48px) re-rasterises the element on every scroll frame just like the live blur
// did, and /dev/scheduling renders many of these per page. Definition comes only
// from the border + translucency, the same flat-surface rule the shipped Learn
// card follows. Theme-aware via the --card token, so every palette and dark mode
// get their own ground.
// The surface WITHOUT padding, so a caller (a compact tile) can set its own.
//
// SAK-270: border-border/70 measured 2.02:1 against this card's own ground —
// under WCAG 1.4.11's 3:1 floor for a UI component boundary. --border is tuned
// as the app's quietest hairline (it's meant to lose to real content), so
// thinning it further with /70 alpha only pushed it further under the floor.
// Fixed the same way the accent/arc pairs in globals.css already solve this:
// derive from --text instead of --border. --text is the max-contrast ink in
// every theme and mode, so a fixed mix of it self-corrects per palette; 50%
// is the lowest round number that still clears 3:1 against every theme's own
// card ground (worst case: momentum/light at 3.21:1; kiri/dark — this card's
// actual reported case — clears with room at 4.88:1).
export const frostSurface =
  "rounded-2xl border border-[color-mix(in_srgb,var(--text)_50%,transparent)] " +
  "bg-[color-mix(in_srgb,var(--card)_72%,transparent)]";

export const frostCard = `${frostSurface} p-5`;

// The GLASS surface — the chosen entry-page look: a more transparent ground so
// the warm page shows through, a soft drop shadow for lift. NO border: the pane's
// edge is its shadow and its top sheen, not an outline, so an entry reads as part
// of the page rather than a boxed card (owner's note — dropped on both the Library
// entry pages and the lesson walk). Pair with a top-left sheen (a radial gradient,
// NOT a blur) and an inner top highlight, added as child elements by the caller.
// No padding, so a caller sets its own. See the Library entry views.
export const glassSurface =
  "relative overflow-hidden rounded-2xl " +
  "bg-[color-mix(in_srgb,var(--card)_42%,transparent)] " +
  "shadow-[0_22px_44px_-26px_rgba(0,0,0,0.72)]";

/** The top-left sheen + inner top highlight that make `glassSurface` read as
 * glass. Drop as the first children of a glassSurface element. */
export function GlassSheen() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(220px 150px at 18% 0%, rgba(255,255,255,0.06), transparent)" }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
    </>
  );
}
