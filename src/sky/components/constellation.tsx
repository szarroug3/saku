// One constellation, drawn. Tracked as SAK-296; the look is SAK-338.
//
// Renders the lines and stars of a placed layout into an SVG group. Every
// screen uses this: the home sky, the Planetarium's preview, the lesson sky,
// an Atlas tile, the Practice pool. It knows nothing about lessons, carts or
// SRS: the caller says what each star is (its role and standing) and which of
// the lesson's looks it wears (tonight, lit, emphasis), and whether to draw
// the dots at all. The lesson draws its own clickable stars on the positions
// `placeConstellation` returns and asks for the lines only.
//
// THE STARS CARRY THE STATE AND THE LINES CARRY THE SHAPE (SAK-338). Every
// line is one colour and one weight and is never dashed: it says two things
// are joined, and nothing more. A star says how it is going, by its glow and
// by the marks it wears. Which paint that is, is `paintFor` and
// `linePaintFor` in src/sky/lib/constellation.ts, tested there; this file
// only draws it. Colour is still by standing through the standing tokens, so
// a star is the same colour as its chip.
//
// What each thing IS was settled first (Sam, 2026-09-05): a grammar pattern
// or a sentence rule is a planet with a ring, a counter an asteroid, a verb
// pair a binary star; everything else a star. Every consumer reads positions
// from placeConstellation and paint from paintFor, so the drawing can change
// without touching them.

import type { ReactNode } from "react";

import { ASTEROID, asteroidShape, BINARY, bodyRadius, paintFor, placeConstellation, PLANET, STAR_RADIUS, TONIGHT_HALO, linePaintFor, type Body, type ConstellationLayout, type Paint, type StarLook, type StarRole } from "@/sky/lib/constellation";

export { paintFor };
export type { Paint, StarLook };

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
 * sits under all of them; so does the halo, when it wears one. The ring
 * goes over the top, because it is a mark and has to be seen. */
function BodyFigure({ id, x, y, body, role, paint, glowOpacity, u }: { id: string; x: number; y: number; body: Body; role: StarRole; paint: Paint; glowOpacity: number; u: number }) {
  const reach = bodyRadius(body, role) * u;
  const glow = (r: number) => paint.glow > 0 && <circle cx={x} cy={y} r={r + paint.glow * u} fill={paint.fill} opacity={glowOpacity} />;
  const figure = () => {
    switch (body) {
      case "planet": {
        const r = PLANET.r * u, rx = PLANET.ring * u, ry = PLANET.ringDepth * u, w = 2 * u;
        // the disc in its standing's colour with a shaded limb; the ring in
        // starlight so it reads against any disc, its far half behind the
        // disc and its near half in front. No glow: it would swallow the ring.
        return (
          <g transform={`rotate(${PLANET.tilt} ${x} ${y})`}>
            <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="none" stroke="var(--sky-star)" strokeWidth={w} opacity={0.35} />
            <circle cx={x} cy={y} r={r} fill={paint.fill} />
            <path d={`M ${x} ${y - r} A ${r} ${r} 0 0 1 ${x} ${y + r} Z`} fill="var(--sky-ground-0)" opacity={0.3} />
            <path d={`M ${x - rx} ${y} A ${rx} ${ry} 0 0 0 ${x + rx} ${y}`} fill="none" stroke="var(--sky-star)" strokeWidth={w} opacity={0.9} />
          </g>
        );
      }
      case "asteroid": {
        const r = ASTEROID.r * u;
        const points = asteroidShape(id).map(([px, py]) => `${x + px * r},${y + py * r}`).join(" ");
        // a lump with a crater on it, so it is a rock and not a fat star
        return (
          <>
            <polygon points={points} fill={paint.fill} />
            <circle cx={x + r * 0.3} cy={y - r * 0.15} r={r * 0.32} fill="var(--sky-ground-0)" opacity={0.45} />
            <circle cx={x - r * 0.35} cy={y + r * 0.3} r={r * 0.2} fill="var(--sky-ground-0)" opacity={0.35} />
          </>
        );
      }
      case "binary": {
        const a = BINARY.a, b = BINARY.b;
        // two suns, a shared glow between them
        return (
          <>
            {glow(a.r * u + 4 * u)}
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
  };
  return (
    <>
      {paint.halo && <circle cx={x} cy={y} r={reach + paint.halo.grow * u} fill={paint.halo.fill} opacity={paint.halo.opacity} />}
      <g opacity={paint.opacity === 1 ? undefined : paint.opacity}>{figure()}</g>
      {paint.ring && <circle cx={x} cy={y} r={reach + paint.ring.grow * u} fill="none" stroke={paint.ring.stroke} strokeWidth={paint.ring.width * u} opacity={paint.ring.opacity} />}
    </>
  );
}

/** The room a glyph needs round its centre: its body, plus the widest mark
 * any look can put on it, so every row of a key draws at one size and the
 * sizes are honest against each other. */
function glyphReach(look: StarLook, paint: Paint): number {
  const body = bodyRadius(look.body ?? "star", look.role);
  const mine = Math.max(paint.glow, paint.halo?.grow ?? 0, paint.ring?.grow ?? 0);
  return Math.max(body + mine, STAR_RADIUS.word + TONIGHT_HALO.grow) + 1;
}

/** One body on its own, in a box of its own: the legend's key, drawn by the
 * code the sky is drawn with, so the key IS the drawing (SAK-338). */
export function StarGlyph({ look, size = 22, className = "" }: { look: StarLook; size?: number; className?: string }) {
  const paint = paintFor(look);
  const reach = glyphReach(look, paint);
  return (
    <svg aria-hidden viewBox={`${-reach} ${-reach} ${reach * 2} ${reach * 2}`} width={size} height={size} className={`shrink-0 ${className}`}>
      <BodyFigure id={look.role} x={0} y={0} body={look.body ?? "star"} role={look.role} paint={paint} glowOpacity={0.16} u={1} />
    </svg>
  );
}

/** The lines and stars of one constellation. Put it inside an <svg>. */
export function ConstellationFigure({ layout, cx, cy, r, lookOf, unit = 1, dots = true, children }: ConstellationProps) {
  const u = Math.max(0.7, Math.min(1.8, unit));
  const stars = placeConstellation(layout, cx, cy, r);
  const looks = new Map(stars.map((s) => [s.id, lookOf(s.id)] as const));
  const gone = (id: string) => looks.get(id)?.hidden === true;
  const MUTED = 0.12;
  return (
    <g data-constellation={layout.root}>
      <g data-lines>
        {layout.lines.map(([i, j]) => {
          const a = stars[i], b = stars[j];
          if (gone(a.id) || gone(b.id)) return null;
          // the line reads the same either way round: it belongs to the pair,
          // not to the star it happens to point at (SAK-338)
          const line = linePaintFor(looks.get(a.id)!, looks.get(b.id)!);
          if (!line) return null;
          return (
            <line
              key={`${a.id}>${b.id}`}
              x1={a.px} y1={a.py} x2={b.px} y2={b.py}
              stroke={line.stroke}
              strokeWidth={line.width}
              opacity={line.opacity}
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
