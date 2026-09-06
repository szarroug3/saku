// The stars of the wash, as data: the general stardust (a tiled field of tiny
// dots) and the Milky Way's own star field (dots clustered along the band).
//
// Both are seeded, so the same knobs always give the same sky, in the editor's
// preview, in the saved file and in the bake. No DOM, no Node: the editor turns
// the stardust pixels into a PNG with a canvas, the save route with zlib.

import { seeded } from "./random";

/** The general stardust: how many dots per 480px tile, their radius range in
 * CSS pixels, their opacity range, and the seed that places them. */
export interface StarSpec {
  density: number; // dots per tile (0 to 400)
  size: [number, number]; // min and max radius, CSS px
  brightness: [number, number]; // min and max opacity, 0 to 1
  seed: number;
}

/** The Milky Way's stars: a share (0 = none, 1 = the most), then the same
 * radius and opacity ranges. They follow the band's angle and shift. */
export interface MilkyStars {
  angle: number; // the band's angle, CSS degrees
  shift: number; // the band's shift along its gradient line, % (0 = as drawn)
  stars: number; // density share, 0 to 1
  starSize: [number, number];
  starBright: [number, number];
  starWidth: number; // spread across the band, as a share of the gradient line (0.02 tight to 0.4 loose)
  starX: number; // slides the whole star field left (negative) or right, as % of the frame's width; the band stays put
}

export const DEFAULT_STARS: StarSpec = { density: 72, size: [0.5, 1.4], brightness: [0.3, 1], seed: 7 };

/** The stardust tile is TILE CSS px, drawn at 2x so it stays crisp on retina. */
export const TILE = 480;
export const TILE_PX = TILE * 2;

/** The Milky Way field is drawn for a 16:9 box and shown with cover, like the
 * baked bitmap, so in the baked mode the stars and the band always agree. */
export const FIELD_W = 1600;
export const FIELD_H = 900;

/** Where the band's centre sits along the gradient line before any shift, as
 * a share of the line: between the lilac (45%) and pink (53%) stops. */
export const MILKY_CENTRE = 0.49;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface Dot { x: number; y: number; r: number; a: number }

/** The stardust's dots, in tile pixels (2x). Radii favour the small end, so
 * a field reads as a few bright stars among many faint ones. */
export function stardustDots(spec: StarSpec): Dot[] {
  const rnd = seeded(spec.seed);
  const dots: Dot[] = [];
  for (let i = 0; i < Math.round(spec.density); i++) {
    const x = rnd() * TILE_PX, y = rnd() * TILE_PX;
    const r = lerp(spec.size[0], spec.size[1], rnd() ** 2) * 2;
    const a = lerp(spec.brightness[0], spec.brightness[1], rnd());
    dots.push({ x, y, r, a });
  }
  return dots;
}

/** Draws white dots into a transparent RGBA buffer, anti-aliased by coverage. */
export function rasterise(dots: Dot[], w: number, h: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (const d of dots) {
    const x0 = Math.max(0, Math.floor(d.x - d.r - 1)), x1 = Math.min(w - 1, Math.ceil(d.x + d.r + 1));
    const y0 = Math.max(0, Math.floor(d.y - d.r - 1)), y1 = Math.min(h - 1, Math.ceil(d.y + d.r + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cover = Math.max(0, Math.min(1, d.r - Math.hypot(x + 0.5 - d.x, y + 0.5 - d.y) + 0.5));
        if (cover <= 0) continue;
        const o = (y * w + x) * 4;
        const src = cover * d.a, dst = px[o + 3] / 255;
        const out = src + dst * (1 - src);
        px[o] = 255; px[o + 1] = 255; px[o + 2] = 255; px[o + 3] = Math.round(out * 255);
      }
    }
  }
  return px;
}

/** The stardust tile as pixels: TILE_PX square, RGBA. */
export function stardustPixels(spec: StarSpec): Uint8ClampedArray {
  return rasterise(stardustDots(spec), TILE_PX, TILE_PX);
}

/** The direction a CSS linear-gradient angle runs, in screen coordinates. */
export function gradientDirection(angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [Math.sin(a), -Math.cos(a)];
}

/** The length of the gradient line for that angle over a w by h box. */
export function gradientLength(angleDeg: number, w: number, h: number): number {
  const a = (angleDeg * Math.PI) / 180;
  return Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
}

/** Along the band runs perpendicular to the gradient, pointed so that
 * "further along" means down for a band that is mostly vertical and right
 * for one that is mostly horizontal: what a location slider should mean. */
export function bandDirection(angleDeg: number): [number, number] {
  const [dx, dy] = gradientDirection(angleDeg);
  let px = -dy, py = dx;
  if (Math.abs(py) >= Math.abs(px) ? py < 0 : px < 0) { px = -px; py = -py; }
  return [px, py];
}

/** The band's centre line through a w by h box: where its centre sits, and
 * how far along the band direction the line runs before it leaves the frame
 * (from `from`, where it enters, to `to`, where it leaves; both 0 if the band
 * misses the frame). Location and reach are measured on this run. */
export function bandSpan(m: { angle: number; shift: number }, w: number, h: number): { cx: number; cy: number; from: number; to: number } {
  const [dx, dy] = gradientDirection(m.angle);
  const [px, py] = bandDirection(m.angle);
  const v = (MILKY_CENTRE + m.shift / 100 - 0.5) * gradientLength(m.angle, w, h);
  const cx = w / 2 + v * dx, cy = h / 2 + v * dy;
  let from = -Infinity, to = Infinity;
  for (const [c, d, size] of [[cx, px, w], [cy, py, h]] as const) {
    if (Math.abs(d) < 1e-9) { if (c < 0 || c > size) return { cx, cy, from: 0, to: 0 }; continue; }
    const a = (0 - c) / d, b = (size - c) / d;
    from = Math.max(from, Math.min(a, b)); to = Math.min(to, Math.max(a, b));
  }
  return from < to ? { cx, cy, from, to } : { cx, cy, from: 0, to: 0 };
}

/** The Milky Way's dots for a w by h box. They run the band's whole visible
 * length and cluster across it by starWidth (most near the centre line, a
 * few drifting out); starX then slides the whole field left or right. */
export function milkyDots(m: MilkyStars, w = FIELD_W, h = FIELD_H, seed = 11): Dot[] {
  const count = Math.round(Math.max(0, Math.min(1, m.stars)) * 900);
  if (count === 0) return [];
  const rnd = seeded(seed);
  const gauss = () => { const u = Math.max(1e-9, rnd()), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const [dx, dy] = gradientDirection(m.angle);
  const [px, py] = bandDirection(m.angle);
  const L = gradientLength(m.angle, w, h);
  const span = bandSpan(m, w, h);
  const run = span.to - span.from;
  const slide = (m.starX / 100) * w;
  const dots: Dot[] = [];
  for (let i = 0; i < count; i++) {
    const s = span.from + rnd() * run;
    const v = gauss() * (rnd() < 0.65 ? 0.66 : 1.5) * m.starWidth * L;
    const x = span.cx + v * dx + s * px + slide, y = span.cy + v * dy + s * py;
    if (x < -4 || x > w + 4 || y < -4 || y > h + 4) continue;
    dots.push({ x, y, r: lerp(m.starSize[0], m.starSize[1], rnd() ** 2), a: lerp(m.starBright[0], m.starBright[1], rnd()) });
  }
  return dots;
}

/** The Milky Way field as a CSS image value: an inline SVG for a 16:9 box
 * that covers the page, or "none" when the band has no stars. Opacities are
 * bucketed into groups to keep the file small. */
export function milkyStarfield(m: MilkyStars): string {
  const dots = milkyDots(m);
  if (dots.length === 0) return "none";
  const buckets = new Map<string, string[]>();
  for (const d of dots) {
    const key = (Math.round(d.a * 10) / 10).toFixed(1);
    const list = buckets.get(key) ?? [];
    list.push(`<circle cx='${d.x.toFixed(1)}' cy='${d.y.toFixed(1)}' r='${d.r.toFixed(2)}'/>`);
    buckets.set(key, list);
  }
  const groups = [...buckets].map(([a, circles]) => `<g opacity='${a}'>${circles.join("")}</g>`).join("");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${FIELD_W} ${FIELD_H}' preserveAspectRatio='xMidYMid slice' fill='%23fff'>${groups}</svg>`;
  return `url("data:image/svg+xml,${svg.replace(/</g, "%3C").replace(/>/g, "%3E")}")`;
}
