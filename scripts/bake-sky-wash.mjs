// Bakes the sky wash's gradients (not the stars) into public/sky, after
// regenerating sky-wash.css from its knobs (the layer list, the stardust tile
// and the Milky Way field), the same as the editor's Save used to.
//
// Reads the knobs from src/app/sky-wash.css, renders the same layers the CSS
// would (ellipse radii, angled lines, premultiplied colour stops), dithers so
// an 8-bit PNG shows no banding, and writes a 1600x900 RGB image. The dev
// pages' wash switch shows it as "baked bitmap": the stardust tile drawn over
// this image with background-size: cover. Re-run after editing the knobs:
//
//   npm run bake:sky
//
// Why a bitmap: CSS gradients are re-rasterised on every resize; a bitmap is
// decoded once and scaled by the GPU. Gradients have no fine detail, so a
// 1600px image scaled to any viewport looks the same as the live CSS.
//
// SAK-383: the file is named for its own contents (wash-baked-<hash>.png) and
// the CSS is pointed at the new name here, which is what lets next.config.ts
// serve it `immutable`. Without the hash a re-bake would leave every returning
// visitor on a wash a year out of date; with it, a re-bake is a new URL.

import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { encodePngRgb, pngDataUrl } from "../src/sky/lib/png-encode.ts";
import { stardustPixels, TILE_PX } from "../src/sky/lib/sky-stars.ts";
import { parseWashFile, renderWashFile, trailingRules } from "../src/sky/lib/sky-wash-file.ts";

const W = 1600, H = 900;
const cssPath = new URL("../src/app/sky-wash.css", import.meta.url);
{
  const before = readFileSync(cssPath, "utf8");
  const model = parseWashFile(before);
  const after = renderWashFile(model, pngDataUrl(stardustPixels(model.stars), TILE_PX, TILE_PX), trailingRules(before));
  if (after !== before) { writeFileSync(cssPath, after); console.log("regenerated src/app/sky-wash.css from its knobs"); }
}
const css = readFileSync(cssPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = new Map();
for (const m of css.matchAll(/--sky-([a-z0-9-]+):\s*([\s\S]*?);[ \t]*(?=\r?\n|$)/g)) tokens.set(m[1], m[2].trim());
const resolve = (v, d = 0) => {
  if (d > 8) throw new Error("var() too deep");
  const out = v
    .replace(/var\(--sky-([a-z0-9-]+)\)/g, (_, n) => { if (!tokens.has(n)) throw new Error("undefined --sky-" + n); return tokens.get(n); })
    .replace(/calc\(\s*(-?[\d.]+)(%?)\s*([-+*])\s*(-?[\d.]+)(%?)\s*\)/g, (_, a, ua, op, b, ub) => {
      const x = Number(a), y = Number(b);
      return String(op === "*" ? x * y : op === "+" ? x + y : x - y) + (ua || ub);
    });
  return /var\(--sky-/.test(out) ? resolve(out, d + 1) : out;
};
const splitTop = (s) => { const out = []; let depth = 0, cur = ""; for (const ch of s) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch; } out.push(cur.trim()); return out.filter(Boolean); };
const colour = (s) => {
  s = s.trim();
  if (s === "transparent") return [0, 0, 0, 0];
  let m = /^#([0-9a-f]{6})$/i.exec(s); if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
  m = /^rgba?\(([^)]+)\)$/.exec(s); if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  throw new Error("colour: " + s);
};
const parseStops = (parts) => parts.map((p) => { const m = /^(.+?)\s+([\d.]+)%$/.exec(p.trim()); if (!m) throw new Error("stop: " + p); return { c: colour(m[1]), t: Number(m[2]) / 100 }; });
const parseLayer = (layer) => {
  let m = /^radial-gradient\(\s*([\d.]+)%\s+([\d.]+)%\s+at\s+([\d.]+)%\s+([\d.]+)%\s*,([\s\S]*)\)$/.exec(layer);
  if (m) return { kind: "radial", rx: (Number(m[1]) / 100) * W, ry: (Number(m[2]) / 100) * H, cx: (Number(m[3]) / 100) * W, cy: (Number(m[4]) / 100) * H, stops: parseStops(splitTop(m[5])) };
  m = /^linear-gradient\(\s*([\d.]+)deg\s*,([\s\S]*)\)$/.exec(layer);
  if (m) { const a = (Number(m[1]) * Math.PI) / 180; const L = Math.abs(W * Math.sin(a)) + Math.abs(H * Math.cos(a)); return { kind: "linear", sin: Math.sin(a), cos: Math.cos(a), L, stops: parseStops(splitTop(m[2])) }; }
  throw new Error("layer: " + layer.slice(0, 60));
};
const layerList = resolve(tokens.get("mesh-layers"));
const layers = [...(layerList.trim() === "none" ? [] : splitTop(layerList)), resolve(tokens.get("sweep"))].map(parseLayer);
// colour at t along a stop list, interpolated premultiplied the way CSS does
const sample = (stops, t) => {
  if (t <= stops[0].t) return stops[0].c;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].t) {
      const a = stops[i - 1], b = stops[i], u = (t - a.t) / Math.max(1e-9, b.t - a.t);
      const pa = a.c.map((v, k) => (k < 3 ? v * a.c[3] : v)), pb = b.c.map((v, k) => (k < 3 ? v * b.c[3] : v));
      const p = pa.map((v, k) => v + (pb[k] - v) * u);
      return p[3] > 0 ? [p[0] / p[3], p[1] / p[3], p[2] / p[3], p[3]] : [0, 0, 0, 0];
    }
  }
  return stops[stops.length - 1].c;
};
const rgb = Buffer.alloc(W * 3 * H);
// A 4x4 ordered (Bayer) dither: breaks banding like noise does, but repeats,
// so the PNG stays a fraction of the size random noise would give.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dither = (x, y) => BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0; // composite bottom-up: start with the last layer (the sweep)
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      const t = L.kind === "radial" ? Math.hypot((x + 0.5 - L.cx) / L.rx, (y + 0.5 - L.cy) / L.ry) : ((x + 0.5 - W / 2) * L.sin - (y + 0.5 - H / 2) * L.cos) / L.L + 0.5;
      const [cr, cg, cb, ca] = sample(L.stops, t);
      r = cr * ca + r * (1 - ca); g = cg * ca + g * (1 - ca); b = cb * ca + b * (1 - ca);
    }
    const o = (y * W + x) * 3, d = dither(x, y); // one dither value per pixel keeps hue steady
    rgb[o] = Math.max(0, Math.min(255, Math.round(r + d))); rgb[o + 1] = Math.max(0, Math.min(255, Math.round(g + d))); rgb[o + 2] = Math.max(0, Math.min(255, Math.round(b + d)));
  }
}
const png = encodePngRgb(rgb, W, H);

// Name the file for its contents, drop whatever the last bake left, and point
// the CSS at the new name. Both .sky-wash and .sky-wash-clear name it, and
// both live in the trailing rules, which renderWashFile keeps verbatim, so
// rewriting the file here is the last word.
const dir = new URL("../public/sky/", import.meta.url);
const name = `wash-baked-${createHash("sha256").update(png).digest("hex").slice(0, 8)}.png`;
writeFileSync(new URL(name, dir), png);
for (const f of readdirSync(dir)) {
  if (f !== name && /^wash-baked(?:-[0-9a-f]+)?\.png$/.test(f)) { rmSync(new URL(f, dir)); console.log(`dropped public/sky/${f}`); }
}
const pointed = readFileSync(cssPath, "utf8");
const repointed = pointed.replace(/\/sky\/wash-baked(?:-[0-9a-f]+)?\.png/g, `/sky/${name}`);
if (repointed !== pointed) { writeFileSync(cssPath, repointed); console.log(`pointed src/app/sky-wash.css at /sky/${name}`); }
console.log(`baked ${layers.length} layers to public/sky/${name} (${W}x${H}, ${(png.length / 1024).toFixed(0)} KB)`);
