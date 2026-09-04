// One constellation, drawn. Tracked as SAK-296.
//
// Renders the lines and stars of a placed layout into an SVG group. Every
// screen uses this: the home sky, the Planetarium's preview, the lesson sky,
// an Atlas tile, the Practice pool. It knows nothing about lessons, carts or
// SRS: the caller says what each star is (its role and standing) and which of
// the lesson's looks it wears (tonight, lit, emphasis), and whether to draw
// the dots at all. The lesson draws its own clickable stars on the positions
// `placeConstellation` returns and asks for the lines only.
//
// Colour is by standing through the standing tokens, so a star is the same
// colour as its chip. Lines fade and dash to stars that are not lit or known.

import type { ReactNode } from "react";

import { placeConstellation, STAR_RADIUS, type ConstellationLayout, type StarRole } from "@/sky/lib/constellation";
import type { Standing } from "@/sky/lib/standing";

/** What one star looks like. Standing first; the lesson's looks override it. */
export interface StarLook {
  role: StarRole;
  standing: Standing;
  /** Picked for tonight and not yet learned: faint and dashed. */
  tonight?: boolean;
  /** Opened during this lesson: bright, and it stays that way. */
  lit?: boolean;
  /** The star the panel is showing, or every star of the word: gold. */
  emphasis?: boolean;
}

/** The paint for a look: fill token, glow radius, line opacity, line dash. */
interface Paint { fill: string; glow: number; opacity: number; dash?: string }

const BY_STANDING: Record<Standing, Paint> = {
  solid: { fill: "var(--sky-solid)", glow: 5, opacity: 0.85 },
  "getting-there": { fill: "var(--sky-getting-there)", glow: 3, opacity: 0.7 },
  shaky: { fill: "var(--sky-shaky)", glow: 3, opacity: 0.6 },
  slipping: { fill: "var(--sky-slipping)", glow: 3, opacity: 0.55, dash: "4 3" },
  claimed: { fill: "var(--sky-claimed)", glow: 0, opacity: 0.5 },
  "not-seen": { fill: "var(--sky-not-seen)", glow: 0, opacity: 0.22, dash: "2 4" },
};
const TONIGHT: Paint = { fill: "var(--sky-star-mid)", glow: 4, opacity: 0.5, dash: "3 3" };
const LIT: Paint = { fill: "var(--sky-star)", glow: 4, opacity: 0.75 };
const EMPHASIS: Paint = { fill: "var(--sky-gold)", glow: 6, opacity: 0.9 };

/** The paint a look resolves to. Exported so the lesson's own clickable
 * stars can wear the same colours. */
export function paintFor(look: StarLook): Paint {
  if (look.emphasis) return EMPHASIS;
  if (look.lit) return LIT;
  if (look.tonight) return TONIGHT;
  return BY_STANDING[look.standing];
}

export interface ConstellationProps {
  layout: ConstellationLayout;
  cx: number;
  cy: number;
  /** The reach: how far the farthest star sits from the centre. */
  r: number;
  /** What each star is and looks like. */
  lookOf: (id: string) => StarLook;
  /** Stroke and dot scale; 1 at a 70px constellation. Clamped to 0.7 to 1.8. */
  unit?: number;
  /** Lines only: the lesson draws its own stars on the returned positions. */
  dots?: boolean;
  /** Anything to draw on top, in the same coordinates: labels, hit areas. */
  children?: ReactNode;
}

/** The lines and stars of one constellation. Put it inside an <svg>. */
export function ConstellationFigure({ layout, cx, cy, r, lookOf, unit = 1, dots = true, children }: ConstellationProps) {
  const u = Math.max(0.7, Math.min(1.8, unit));
  const stars = placeConstellation(layout, cx, cy, r);
  const looks = new Map(stars.map((s) => [s.id, lookOf(s.id)] as const));
  const hot = (id: string) => looks.get(id)?.emphasis === true;
  return (
    <g data-constellation={layout.root}>
      <g data-lines>
        {layout.lines.map(([i, j]) => {
          const a = stars[i], b = stars[j];
          const paint = paintFor(looks.get(b.id)!);
          const emphasised = hot(a.id) || hot(b.id);
          return (
            <line
              key={`${a.id}>${b.id}`}
              x1={a.px} y1={a.py} x2={b.px} y2={b.py}
              stroke={emphasised ? "var(--sky-gold)" : "var(--sky-link)"}
              strokeWidth={emphasised ? 1.4 : 1}
              opacity={emphasised ? 0.9 : paint.opacity}
              strokeDasharray={!emphasised && paint.dash ? paint.dash : undefined}
            />
          );
        })}
      </g>
      {dots && (
        <g data-stars>
          {stars.map((s) => {
            const look = looks.get(s.id)!;
            const paint = paintFor(look);
            const rr = STAR_RADIUS[look.role] * u;
            return (
              <g key={s.id} data-star={s.id}>
                {paint.glow > 0 && <circle cx={s.px} cy={s.py} r={rr + paint.glow} fill={paint.fill} opacity={look.emphasis ? 0.22 : 0.16} />}
                <circle cx={s.px} cy={s.py} r={rr} fill={paint.fill} />
              </g>
            );
          })}
        </g>
      )}
      {children}
    </g>
  );
}
