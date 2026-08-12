// Frost-lite card surface — the soft translucent panel the meaning-model views
// use instead of the wireframe (bordered) Card.
//
// The original frosty look used `backdrop-filter: blur()`, which is the part that
// cost performance (live GPU blur, worst across multiple displays). This drops the
// blur and keeps the FEEL: a translucent panel so the warm ground bleeds through,
// plus a soft diffuse box-shadow for lift. Translucency and box-shadow are cheap;
// only the live blur was not. Theme-aware via the --card token, so every palette
// and dark mode get their own ground.
// The surface WITHOUT padding, so a caller (a compact tile) can set its own.
export const frostSurface =
  "rounded-2xl border border-border/70 " +
  "bg-[color-mix(in_srgb,var(--card)_72%,transparent)] " +
  "shadow-[0_1px_3px_rgba(0,0,0,0.05),0_22px_48px_-28px_rgba(0,0,0,0.40)]";

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
