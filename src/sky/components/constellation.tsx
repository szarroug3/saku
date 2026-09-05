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
//
// THE LOOK IS STILL MOSTLY A PLACEHOLDER. Sam's call (2026-09-04): get the
// model right first and decide the visuals later. So this draws the plainest
// thing that shows the shape and the state: a dot per star, a line per edge,
// paint from the tokens. Halos, glows, sizes and line weights are all open;
// the card for that is "Sky: star and line visuals" in Sky: Shared
// components. What IS decided (Sam, 2026-09-05) is the bodies: a grammar
// pattern or a sentence rule is a planet with a ring, a counter an asteroid,
// a verb pair a binary star; everything else a star. Every consumer reads
// positions from placeConstellation and looks from paintFor, so the drawing
// can change without touching them.

import type { ReactNode } from "react";

import { ASTEROID, asteroidShape, BINARY, placeConstellation, PLANET, STAR_RADIUS, type Body, type ConstellationLayout, type StarRole } from "@/sky/lib/constellation";
import type { Standing } from "@/sky/lib/standing";

/** What one star looks like. Standing first; the lesson's looks override it. */
export interface StarLook {
  role: StarRole;
  /** What it is drawn as: a star unless said otherwise (see bodyOf). */
  body?: Body;
  standing: Standing;
  /** Picked for tonight and not yet learned: faint and dashed. */
  tonight?: boolean;
  /** Opened during this lesson: bright, and it stays that way. */
  lit?: boolean;
  /** The star the panel is showing: the learner's accent. */
  emphasis?: boolean;
  /** Faded right back, while something else is singled out. */
  muted?: boolean;
  /** Not drawn at all, nor its lines: the legend is showing only others. */
  hidden?: boolean;
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
const EMPHASIS: Paint = { fill: "var(--sky-accent)", glow: 6, opacity: 0.9 };

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

/** One body at a point: a star's dot, a planet's disc and ring, an
 * asteroid's lump, a binary's two suns. The glow, when the paint has one,
 * sits under all of them. */
function BodyFigure({ id, x, y, body, role, paint, glowOpacity, u }: { id: string; x: number; y: number; body: Body; role: StarRole; paint: Paint; glowOpacity: number; u: number }) {
  const glow = (r: number) => paint.glow > 0 && <circle cx={x} cy={y} r={r + paint.glow} fill={paint.fill} opacity={glowOpacity} />;
  switch (body) {
    case "planet": {
      const r = PLANET.r * u, rx = PLANET.ring * u, ry = PLANET.ringDepth * u;
      // the ring's far half behind the disc, its near half in front
      return (
        <g transform={`rotate(${PLANET.tilt} ${x} ${y})`}>
          {glow(r)}
          <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="none" stroke={paint.fill} strokeWidth={0.9 * u} opacity={0.45} />
          <circle cx={x} cy={y} r={r} fill={paint.fill} />
          <path d={`M ${x - rx} ${y} A ${rx} ${ry} 0 0 0 ${x + rx} ${y}`} fill="none" stroke={paint.fill} strokeWidth={0.9 * u} opacity={0.95} />
        </g>
      );
    }
    case "asteroid": {
      const r = ASTEROID.r * u;
      const points = asteroidShape(id).map(([px, py]) => `${x + px * r},${y + py * r}`).join(" ");
      return (
        <>
          {glow(r)}
          <polygon points={points} fill={paint.fill} />
        </>
      );
    }
    case "binary": {
      const a = BINARY.a, b = BINARY.b;
      return (
        <>
          {glow(a.r * u + 1.5 * u)}
          <circle cx={x + a.x * u} cy={y + a.y * u} r={a.r * u} fill={paint.fill} />
          <circle cx={x + b.x * u} cy={y + b.y * u} r={b.r * u} fill={paint.fill} opacity={0.85} />
        </>
      );
    }
    default: {
      const r = STAR_RADIUS[role] * u;
      return (
        <>
          {glow(r)}
          <circle cx={x} cy={y} r={r} fill={paint.fill} />
        </>
      );
    }
  }
}

/** The lines and stars of one constellation. Put it inside an <svg>. */
export function ConstellationFigure({ layout, cx, cy, r, lookOf, unit = 1, dots = true, children }: ConstellationProps) {
  const u = Math.max(0.7, Math.min(1.8, unit));
  const stars = placeConstellation(layout, cx, cy, r);
  const looks = new Map(stars.map((s) => [s.id, lookOf(s.id)] as const));
  const hot = (id: string) => looks.get(id)?.emphasis === true;
  const dim = (id: string) => looks.get(id)?.muted === true;
  const gone = (id: string) => looks.get(id)?.hidden === true;
  const MUTED = 0.12;
  return (
    <g data-constellation={layout.root}>
      <g data-lines>
        {layout.lines.map(([i, j]) => {
          const a = stars[i], b = stars[j];
          if (gone(a.id) || gone(b.id)) return null;
          const paint = paintFor(looks.get(b.id)!);
          const emphasised = hot(a.id) || hot(b.id);
          return (
            <line
              key={`${a.id}>${b.id}`}
              x1={a.px} y1={a.py} x2={b.px} y2={b.py}
              stroke={emphasised ? "var(--sky-accent)" : "var(--sky-link)"}
              strokeWidth={emphasised ? 1.4 : 1}
              opacity={dim(a.id) || dim(b.id) ? MUTED : emphasised ? 0.9 : paint.opacity}
              strokeDasharray={!emphasised && paint.dash ? paint.dash : undefined}
            />
          );
        })}
      </g>
      {dots && (
        <g data-stars>
          {stars.map((s) => {
            const look = looks.get(s.id)!;
            if (look.hidden || s.group) return null;
            const paint = paintFor(look);
            return (
              <g key={s.id} data-star={s.id} data-body={look.body ?? "star"} opacity={look.muted ? MUTED : undefined}>
                <BodyFigure id={s.id} x={s.px} y={s.py} body={look.body ?? "star"} role={look.role} paint={paint} glowOpacity={look.emphasis ? 0.22 : 0.16} u={u} />
              </g>
            );
          })}
        </g>
      )}
      {children}
    </g>
  );
}
