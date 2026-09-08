// The PNG encoder: what it writes decodes back to the pixels it was given,
// and it picks a filter rather than leaving every row unfiltered (SAK-383,
// which is what made the baked wash 611 KB). Plus the one thing a hashed
// filename can get wrong: the CSS naming a file that is not there any more.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { deflateSync, inflateSync } from "node:zlib";

import { encodePngRgb, encodePngRgba } from "@/sky/lib/png-encode";

/** Reads back an 8-bit RGB or RGBA PNG written by this module. */
function decode(png: Buffer): { w: number; h: number; channels: number; filters: number[]; pixels: Buffer } {
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let off = 8;
  const idats: Buffer[] = [];
  let ihdr: Buffer | null = null;
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString("ascii", off + 4, off + 8);
    if (type === "IHDR") ihdr = png.subarray(off + 8, off + 8 + len);
    if (type === "IDAT") idats.push(png.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const w = ihdr!.readUInt32BE(0), h = ihdr!.readUInt32BE(4);
  assert.equal(ihdr![8], 8, "bit depth");
  const channels = ihdr![9] === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idats));
  const stride = w * channels;
  assert.equal(raw.length, (stride + 1) * h);
  const pixels = Buffer.alloc(stride * h);
  const filters: number[] = [];
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    filters.push(ft);
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[i - channels] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= channels ? prev[i - channels] : 0;
      let v = row[i];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[i] = v & 0xff;
    }
  }
  return { w, h, channels, filters, pixels };
}

/** A smooth horizontal ramp with the bake's own 4x4 dither on it: the shape
 * the wash is, so what the encoder does to it is what it does to the wash. */
function ramp(w: number, h: number): Uint8Array {
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const px = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5;
      const v = Math.round((x / w) * 60 + 8 + d);
      const o = (y * w + x) * 3;
      px[o] = v; px[o + 1] = v + 3; px[o + 2] = v + 9;
    }
  }
  return px;
}

describe("the PNG encoder", () => {
  it("writes RGB pixels that decode back unchanged", () => {
    const px = ramp(64, 40);
    const back = decode(encodePngRgb(px, 64, 40));
    assert.equal(back.w, 64);
    assert.equal(back.h, 40);
    assert.equal(back.channels, 3);
    assert.deepEqual([...back.pixels], [...px]);
  });

  it("writes RGBA pixels that decode back unchanged, alpha included", () => {
    const w = 24, h = 16;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      px[i * 4] = i % 256; px[i * 4 + 1] = (i * 7) % 256; px[i * 4 + 2] = 0; px[i * 4 + 3] = i % 3 === 0 ? 0 : 255;
    }
    const back = decode(encodePngRgba(px, w, h));
    assert.equal(back.channels, 4);
    assert.deepEqual([...back.pixels], [...px]);
  });

  it("filters a gradient rather than leaving every row raw", () => {
    // SAK-383: the wash shipped with filter 0 on all 900 rows and was 611 KB;
    // the same pixels filtered are 319. A gradient must not come out unfiltered.
    const encoded = encodePngRgb(ramp(320, 200), 320, 200);
    const { filters } = decode(encoded);
    assert.ok(filters.some((f) => f !== 0), "a dithered gradient should not encode with filter 0");
    assert.equal(new Set(filters).size, 1, "the filter is chosen once for the image, not per row");
  });

  it("never comes out larger than the unfiltered encoding it replaced", () => {
    // The old encoder wrote filter 0 on every row. Whatever the new one picks,
    // it is picked by compressing and comparing, so it can only tie or win.
    // The whole file is the IDAT plus a fixed 57 bytes: the signature, IHDR,
    // IEND and the two chunk wrappers.
    const asFile = (px: Uint8Array, w: number, h: number) => {
      const raw = Buffer.alloc((w * 3 + 1) * h);
      for (let y = 0; y < h; y++) raw.set(px.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
      return deflateSync(raw, { level: 9 }).length + 57;
    };
    const gradient = ramp(320, 200);
    assert.ok(encodePngRgb(gradient, 320, 200).length < asFile(gradient, 320, 200), "a gradient should get smaller");

    // A picture with nothing to predict: no filter helps, and none may hurt.
    const w = 64, h = 64;
    const noise = new Uint8Array(w * h * 3);
    let seed = 1;
    for (let i = 0; i < noise.length; i++) { seed = (seed * 1103515245 + 12345) >>> 0; noise[i] = (seed >>> 16) & 0xff; }
    assert.ok(encodePngRgb(noise, w, h).length <= asFile(noise, w, h), "noise should not get worse");
  });
});

describe("the baked wash on disk", () => {
  const css = readFileSync(path.resolve(process.cwd(), "src/app/sky-wash.css"), "utf8");

  it("is named for its own contents, so it can be served immutable", () => {
    // next.config.ts serves /sky/wash-baked-<hash>.png with `immutable`, which
    // is only honest while the hash is the file's own bytes. A hand-edited url
    // or a knob change without `npm run bake:sky` fails here.
    const named = [...css.matchAll(/url\("\/sky\/(wash-baked-[0-9a-f]+\.png)"\)/g)].map((m) => m[1]);
    assert.ok(named.length >= 1, "sky-wash.css should name the baked wash");
    assert.equal(new Set(named).size, 1, "both wash rules should name the same file");
    const file = path.resolve(process.cwd(), "public/sky", named[0]);
    assert.ok(existsSync(file), `${named[0]} is named by the CSS but not in public/sky`);
    const bytes = readFileSync(file);
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
    assert.equal(named[0], `wash-baked-${hash}.png`, "re-run `npm run bake:sky`");
  });

  it("is filtered, and a fraction of what it was unfiltered", () => {
    const named = css.match(/url\("\/sky\/(wash-baked-[0-9a-f]+\.png)"\)/)![1];
    const bytes = readFileSync(path.resolve(process.cwd(), "public/sky", named));
    const { filters } = decode(bytes);
    assert.ok(filters.some((f) => f !== 0), "the wash should not be unfiltered");
    assert.ok(bytes.length < 400_000, `the wash is ${(bytes.length / 1024).toFixed(0)} KB; it was 611 unfiltered and 319 filtered`);
  });
});
