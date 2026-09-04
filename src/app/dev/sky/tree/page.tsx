"use client";

// Gallery for the abandoned branch tree, kept for reference. Route: /dev/sky/tree
//
// Tracks the Dynamic Tree project's current state, updated in place as each
// card lands (SAK-308, SAK-329..SAK-336), so review stays visual instead of
// reading code. The "current card" note below is the thing to update on every
// pass through this page.

import { useEffect, useRef, useState } from "react";

import { buildBranches } from "@/sky/lib/branch";
import { Tree } from "@/sky/components/tree";
import type { SkyItem } from "@/sky/lib/types";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;
const ZOOM_STEP = 1.25;

/**
 * A small sample cart: two words, each built from kanji, each of those built
 * from radicals — real glyphs, so later cards (recursion, layout, flowers)
 * have real depth to render without this data needing to change.
 *
 * Only the top-level entries (the two words) render as of this card: nothing
 * walks into `components` yet.
 */
const CART: SkyItem[] = [
  { id: "r-sui", kind: "radical", glyph: "氵", english: "water", standing: "not-seen" },
  { id: "r-hi", kind: "radical", glyph: "日", english: "sun", standing: "not-seen" },
  { id: "r-tori", kind: "radical", glyph: "隹", english: "bird", standing: "not-seen" },
  { id: "k-sui", kind: "kanji", glyph: "水", english: "water", standing: "not-seen", components: ["r-sui"] },
  {
    id: "k-you",
    kind: "kanji",
    glyph: "曜",
    english: "day of the week",
    standing: "not-seen",
    components: ["r-hi", "r-tori"],
  },
  { id: "k-hi", kind: "kanji", glyph: "日", english: "day", standing: "not-seen" },
  {
    id: "w-suiyoubi",
    kind: "word",
    glyph: "水曜日",
    english: "Wednesday",
    standing: "not-seen",
    components: ["k-sui", "k-you", "k-hi"],
  },
  { id: "r-ki", kind: "radical", glyph: "木", english: "tree", standing: "not-seen" },
  { id: "k-mori", kind: "kanji", glyph: "森", english: "forest", standing: "not-seen", components: ["r-ki"] },
  { id: "w-mori", kind: "word", glyph: "森", english: "forest", standing: "not-seen", components: ["k-mori"] },
];

export default function GardenGalleryPage() {
  const branches = buildBranches(CART);
  // Defaults to open: a small preview hid real-size overlap bugs (curves
  // that only crossed once actually rendered at size) through several
  // rounds of SAK-333 review, so the full-page view is now the default
  // rather than something to click into.
  const [fullSize, setFullSize] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [debugColors, setDebugColors] = useState(false);

  // Zoom/pan for the full-size view — a small preview or a fixed 1:1 render
  // hides exactly the overlap and angle detail this page exists to review,
  // so being able to zoom in on one cluster of branches (rather than
  // squinting at the whole tree at once) matters here more than in a
  // typical UI.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const zoomBy = (factor: number) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
  };

  useEffect(() => {
    if (!fullSize) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullSize(false);
      else if (e.key === "+" || e.key === "=") zoomBy(ZOOM_STEP);
      else if (e.key === "-" || e.key === "_") zoomBy(1 / ZOOM_STEP);
      else if (e.key === "0") resetView();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullSize]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    setIsDragging(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const { startX, startY, panX, panY } = dragRef.current;
    setPan({ x: panX + (e.clientX - startX), y: panY + (e.clientY - startY) });
  };

  const stopDragging = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const labelToggle = (
    <label className="flex items-center gap-1.5 text-[13px] text-text-muted">
      <input
        type="checkbox"
        checked={showLabels}
        onChange={(e) => setShowLabels(e.target.checked)}
      />
      Show branch labels (b1, b1b2, ...)
    </label>
  );

  const debugColorsToggle = (
    <label className="flex items-center gap-1.5 text-[13px] text-text-muted">
      <input
        type="checkbox"
        checked={debugColors}
        onChange={(e) => setDebugColors(e.target.checked)}
      />
      Random branch colors
    </label>
  );

  const zoomControls = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => zoomBy(1 / ZOOM_STEP)}
        disabled={zoom <= MIN_ZOOM}
        aria-label="Zoom out"
        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] text-text-muted hover:bg-panel disabled:opacity-40"
      >
        −
      </button>
      <button
        type="button"
        onClick={resetView}
        title="Reset view (0)"
        className="min-w-[52px] rounded-lg border border-border bg-card px-2 py-1.5 text-center text-[13px] text-text-muted hover:bg-panel"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        onClick={() => zoomBy(ZOOM_STEP)}
        disabled={zoom >= MAX_ZOOM}
        aria-label="Zoom in"
        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] text-text-muted hover:bg-panel disabled:opacity-40"
      >
        +
      </button>
    </div>
  );

  if (fullSize) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-bg">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-[13px] text-text-muted">Garden — full size</span>
          <div className="flex items-center gap-4">
            {labelToggle}
            {debugColorsToggle}
            {zoomControls}
            <button
              type="button"
              onClick={() => setFullSize(false)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] text-text-muted hover:bg-panel"
            >
              Small preview (Esc)
            </button>
          </div>
        </div>
        <div
          className="min-h-0 flex-1 overflow-hidden p-4"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={stopDragging}
          onMouseLeave={stopDragging}
          style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
        >
          <div
            className="h-full w-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 80ms ease-out",
            }}
          >
            <Tree branches={branches} showLabels={showLabels} debugColors={debugColors} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Intro />
      <div className="mt-4 flex justify-center rounded-xl border border-border bg-card p-8">
        <div className="h-[400px] w-[400px]">
          <Tree branches={branches} showLabels={showLabels} debugColors={debugColors} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setFullSize(true)}
          className="rounded-lg border border-border px-3 py-1.5 text-[13px] text-text-muted hover:bg-panel"
        >
          View full size
        </button>
        {labelToggle}
        {debugColorsToggle}
      </div>
    </div>
  );
}

function Intro() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm leading-relaxed text-text-muted">
        <strong className="text-text">Current card: SAK-333/334, canopy layout and taper.</strong>{" "}
        Layout decides where every branch TIP belongs first: the canopy is
        a dome above the trunk, split into disjoint wedges — a word gets a
        wedge sized by how many radicals it holds, its kanji get
        sub-wedges, and its radicals get slots on the rim (where their
        flowers will go, SAK-335). Each branch is then drawn from its fork
        point on its parent to its own tip, so angles are a consequence of
        where tips are rather than clamped increments that compound down a
        chain. Siblings can&apos;t cross because their wedges are disjoint.
        Every fork point sits exactly on the rendered curve, and stroke
        width tapers by depth. The dome grows with the cart&apos;s leaf
        count, so the tree visibly grows as words are added.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        Tunable knobs worth trying by hand, all grouped under the imports in{" "}
        <code className="rounded bg-panel px-1 py-0.5 text-[12.5px] text-text">
          src/sky/lib/tree-geometry.ts
        </code>{" "}
        (and{" "}
        <code className="rounded bg-panel px-1 py-0.5 text-[12.5px] text-text">
          src/sky/lib/layout.ts
        </code>
        ):
      </p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-text-muted">
        <li>
          <code className="rounded bg-panel px-1 py-0.5 text-[12.5px] text-text">
            CANOPY_HALF_SPREAD_DEGREES
          </code>{" "}
          — how wide the dome fans, each side of vertical. Near 90 means
          the outermost boughs run nearly horizontal, like the reference.
        </li>
        <li>
          <code className="rounded bg-panel px-1 py-0.5 text-[12.5px] text-text">
            TIP_INSET_PER_LEVEL
          </code>{" "}
          — how far inside the rim a branch&apos;s own tip sits for every
          generation still below it (bough, branch, twig).
        </li>
        <li>
          <code className="rounded bg-panel px-1 py-0.5 text-[12.5px] text-text">
            STUB_LEAF_WEIGHT
          </code>{" "}
          — how much of its parent&apos;s wedge a branch&apos;s own tip
          stub claims (it holds the branch&apos;s own flower). Bigger
          pushes children further off their parent&apos;s heading.
        </li>
        <li>
          <code className="rounded bg-panel px-1 py-0.5 text-[12.5px] text-text">
            FORK_T_MIN/MAX
          </code>{" "}
          /{" "}
          <code className="rounded bg-panel px-1 py-0.5 text-[12.5px] text-text">
            TRUNK_FORK_T_MIN/MAX
          </code>{" "}
          — where along a parent (0 origin, 1 tip) its children fork.
        </li>
        <li>
          <code className="rounded bg-panel px-1 py-0.5 text-[12.5px] text-text">
            CANOPY_RADIUS_BASE/PER_LEAF/MAX
          </code>{" "}
          (tree-geometry.ts) — the dome&apos;s size and how fast it grows
          with the cart.
        </li>
        <li>
          <code className="rounded bg-panel px-1 py-0.5 text-[12.5px] text-text">
            CURVE_END_ANGLE_BLEND
          </code>{" "}
          (curve.ts) — how much each branch curls upward as it arrives at
          its tip.
        </li>
      </ul>
    </div>
  );
}
