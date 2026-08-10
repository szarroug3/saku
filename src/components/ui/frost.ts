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
