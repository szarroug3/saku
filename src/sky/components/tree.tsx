// The Garden's tree render.
//
// SAK-329 proved the rendering approach: SVG, a fixed viewBox, theme-token
// strokes (var(--trunk) — see globals.css — following the precedent in
// src/components/lesson/stroke-order.tsx for hand-drawn SVG colour).
//
// SAK-330 replaced a fixed single branch with one branch per TOP-LEVEL entry
// in a real Branch[] (src/sky/lib/branch.ts).
//
// SAK-331: the tree recurses into each branch's own `branches`, at any
// depth, with no knowledge of what a depth "means" (word/kanji/radical) —
// it just walks the generic shape.
//
// SAK-332: the angle, length, and fork position of each sibling group come
// from layoutSiblings (src/sky/lib/layout.ts) — subtree-weighted,
// alternating left/right/centre, with a seeded random jitter — instead of
// plain even spacing. Crucially, layoutSiblings gives EACH sibling its own
// `forkT` (a distinct point along the PARENT's own length), not one shared
// origin for the whole group: a fork with several lateral branches all
// sprouting from a single spot reads as a claw, not a bough. Every branch
// also reserves the last stretch of its own length past the last child's
// forkT for its own flower (SAK-335) — forkT is bounded below 1 for exactly
// that reason.
//
// SAK-333: every branch (the trunk stays a straight line) is a CUBIC bezier,
// shaped like the top of a "C" (src/sky/lib/curve.ts): it leaves its
// origin heading mostly vertical, then opens outward to arrive at its tip
// heading in its own layout-computed angle. This component itself does no
// layout math any more — it renders src/sky/lib/tree-geometry.ts's
// computeTreeGeometry() output, the SAME function
// src/sky/lib/tree-geometry.test.ts uses to automatically check for
// branch curves crossing each other (src/sky/lib/intersect.ts), rather
// than that only ever being caught by eye at real size, which is how the
// last few rounds of curve bugs actually surfaced.
//
// Canopy rewrite: layout now decides where every TIP belongs on a dome
// first (src/sky/lib/layout.ts) and draws each branch to reach its tip,
// instead of growing outward by clamped angle increments — see that file's
// header for why. SAK-334's taper (stroke width by depth) lands here too.

import { branchEndpoint, curvedPathD } from "@/sky/lib/curve";
import { seededRandom } from "@/sky/lib/layout";
import {
  computeTreeGeometry,
  labelBranches,
  TRUNK_BASE,
  TRUNK_TOP,
} from "@/sky/lib/tree-geometry";
import type { Branch } from "@/sky/lib/branch";

// A branch's length is now DERIVED from what its own subtree needs
// (computeRequiredLength, in layout.ts) rather than shrinking with depth, so
// an outer branch carrying a deep or wide subtree can run considerably
// longer than a plain leaf. The viewBox carries margin on every side for
// exactly that — this is headroom, not a guarantee: an unusually large cart
// can still clip. Real containment is layout's job in a later pass, not
// framing's.
const VIEW_MARGIN = 80;
const VIEW_MIN_X = -VIEW_MARGIN;
const VIEW_MIN_Y = -VIEW_MARGIN;
const VIEW_WIDTH = 400 + VIEW_MARGIN * 2;
const VIEW_HEIGHT = 400 + VIEW_MARGIN * 2;

const TRUNK_WIDTH = 14;

/**
 * Stroke width by depth (index 0 = a top-level branch off the trunk): a
 * bough, a branch, a twig. Anything deeper than the table keeps the last
 * width. Taper is most of what separates "a tree" from "some lines" in the
 * reference silhouettes. SAK-334.
 */
const BRANCH_WIDTH_BY_DEPTH = [9, 6, 3.5];

function branchWidth(depth: number): number {
  return BRANCH_WIDTH_BY_DEPTH[Math.min(depth, BRANCH_WIDTH_BY_DEPTH.length) - 1];
}

/**
 * A stable, seeded-random colour per branch id — DEBUG ONLY (see
 * `debugColors` below). Not a themed design colour and deliberately not
 * one of the Sky README's CSS tokens: its whole purpose is to be
 * visually distinct from every OTHER branch, which a shared token
 * palette can't give it. Saturation/lightness are fixed (only hue
 * varies) so every branch stays readably branch-coloured against the
 * dark dev-page background regardless of which hue it lands on.
 */
function debugBranchColor(id: string): string {
  const hue = Math.floor(seededRandom(`${id}:debugColor`) * 360);
  return `hsl(${hue}, 65%, 60%)`;
}

export function Tree({
  branches,
  showLabels = false,
  debugColors = false,
}: {
  branches: Branch[];
  showLabels?: boolean;
  /** Dev-only: colours each branch by a seeded-random hue instead of the
   * shared --trunk token, so which segment belongs to which branch is
   * visually obvious. Never used outside dev/review pages — see
   * debugBranchColor. */
  debugColors?: boolean;
}) {
  const geometry = computeTreeGeometry(branches);
  // Position-based reference labels ("b2b3b1") for talking about a specific
  // branch in a screenshot — see labelBranches. Only computed when actually
  // shown; it's cheap, but there's no reason to do it on every render
  // otherwise.
  const labels = showLabels ? labelBranches(geometry) : null;

  return (
    <svg
      viewBox={`${VIEW_MIN_X} ${VIEW_MIN_Y} ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      className="h-full w-full"
      role="img"
      aria-label="Garden tree"
    >
      <g fill="none" stroke="var(--trunk)" strokeLinecap="round">
        {/* The trunk stays a straight line, unlike every branch — it's the
            one part of the tree that reads as structural rather than grown.
            Always --trunk, even in debugColors mode: there's only ever one
            of it, so there's nothing for a per-branch colour to distinguish. */}
        <path
          d={`M ${TRUNK_BASE.x} ${TRUNK_BASE.y} L ${TRUNK_TOP.x} ${TRUNK_TOP.y}`}
          strokeWidth={TRUNK_WIDTH}
        />
        {geometry.map(({ id, depth, origin, angle, length, startDirectionAngle }) => (
          <path
            key={id}
            d={curvedPathD(origin, length, angle, id, startDirectionAngle)}
            strokeWidth={branchWidth(depth)}
            stroke={debugColors ? debugBranchColor(id) : undefined}
          />
        ))}
      </g>
      {labels && (
        <g fontSize={9} fontFamily="monospace" textAnchor="middle">
          {geometry.map(({ id, origin, angle, length }) => {
            const tip = branchEndpoint(origin, angle, length);
            return (
              <g key={id}>
                <rect
                  x={tip.x - labels.get(id)!.length * 3 - 2}
                  y={tip.y - 11}
                  width={labels.get(id)!.length * 6 + 4}
                  height={12}
                  rx={2}
                  fill="var(--bg)"
                  stroke="var(--trunk)"
                  strokeWidth={0.5}
                />
                <text x={tip.x} y={tip.y - 2} fill="var(--text)" stroke="none">
                  {labels.get(id)}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
