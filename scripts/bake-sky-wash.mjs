// Bakes the sky wash's gradients (not the stars) into public/sky/wash-baked.png,
// after regenerating sky-wash.css from its knobs (the layer list, the stardust
// tile and the Milky Way field), the same as the editor's Save does.
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

import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

import { pngDataUrl } from "../src/sky/lib/png-encode.ts";
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
const rgb = Buffer.alloc((W * 3 + 1) * H);
// A 4x4 ordered (Bayer) dither: breaks banding like noise does, but repeats,
// so the PNG stays a fraction of the size random noise would give.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dither = (x, y) => BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5;
for (let y = 0; y < H; y++) {
  rgb[y * (W * 3 + 1)] = 0;
  for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0; // composite bottom-up: start with the last layer (the sweep)
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      const t = L.kind === "radial" ? Math.hypot((x + 0.5 - L.cx) / L.rx, (y + 0.5 - L.cy) / L.ry) : ((x + 0.5 - W / 2) * L.sin - (y + 0.5 - H / 2) * L.cos) / L.L + 0.5;
      const [cr, cg, cb, ca] = sample(L.stops, t);
      r = cr * ca + r * (1 - ca); g = cg * ca + g * (1 - ca); b = cb * ca + b * (1 - ca);
    }
    const o = y * (W * 3 + 1) + 1 + x * 3, d = dither(x, y); // one dither value per pixel keeps hue steady
    rgb[o] = Math.max(0, Math.min(255, Math.round(r + d))); rgb[o + 1] = Math.max(0, Math.min(255, Math.round(g + d))); rgb[o + 2] = Math.max(0, Math.min(255, Math.round(b + d)));
  }
}
const table = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const v of buf) c = table[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rgb, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
const out = new URL("../public/sky/wash-baked.png", import.meta.url);
writeFileSync(out, png);
console.log(`baked ${layers.length} layers to public/sky/wash-baked.png (${W}x${H}, ${(png.length / 1024).toFixed(0)} KB)`);
