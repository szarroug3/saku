// A minimal PNG encoder for Node: pixels in, a PNG buffer out. Used by the
// bake to write the stardust tile the knobs describe and the baked wash.
// Node only (zlib); nothing in the browser calls this.

import { deflateSync } from "node:zlib";

const TABLE = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf: Uint8Array) => { let c = -1; for (const v of buf) c = TABLE[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

/** One PNG row filter (None, Sub, Up, Average, Paeth) applied across a row.
 * `prev` is the row above, already unfiltered, or null on the first row. */
function filterRow(row: Uint8Array, prev: Uint8Array | null, type: number, bpp: number, out: Uint8Array): void {
  for (let i = 0; i < row.length; i++) {
    const a = i >= bpp ? row[i - bpp] : 0;
    const b = prev ? prev[i] : 0;
    const c = prev && i >= bpp ? prev[i - bpp] : 0;
    let v: number;
    if (type === 0) v = row[i];
    else if (type === 1) v = row[i] - a;
    else if (type === 2) v = row[i] - b;
    else if (type === 3) v = row[i] - ((a + b) >> 1);
    else {
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      v = row[i] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
    }
    out[i] = v & 0xff;
  }
}

/**
 * The smallest of the five filters, applied to every row.
 *
 * SAK-383: the wash was written with filter 0 (none) on all 900 of its rows,
 * so deflate never saw a delta and the file was 611 KB. Sub is 319 KB for the
 * same pixels. Choosing PER ROW, the way most encoders do, is WORSE here and
 * was measured twice: sum-of-absolute picks 436 KB and entropy picks 438,
 * because mixing filter types row to row costs deflate the matches it would
 * otherwise find between one row and the next. So the choice is made once for
 * the image, by compressing it five times and keeping the smallest, which is
 * cheap for a script that runs when Sam edits the knobs.
 */
function smallestIdat(pixels: Uint8Array, w: number, h: number, bpp: number): Buffer {
  const stride = w * bpp;
  const raw = Buffer.alloc((stride + 1) * h);
  let best: Buffer | null = null;
  for (const type of [0, 1, 2, 3, 4]) {
    for (let y = 0; y < h; y++) {
      raw[y * (stride + 1)] = type;
      filterRow(
        pixels.subarray(y * stride, (y + 1) * stride),
        y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null,
        type,
        bpp,
        raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)),
      );
    }
    const z = deflateSync(raw, { level: 9 });
    if (!best || z.length < best.length) best = z;
  }
  return best!;
}

function encode(pixels: Uint8Array, w: number, h: number, bpp: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = bpp === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", smallestIdat(pixels, w, h, bpp)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Encodes w by h RGBA pixels (4 bytes each, row-major) as an 8-bit RGBA PNG. */
export function encodePngRgba(pixels: Uint8ClampedArray | Uint8Array, w: number, h: number): Buffer {
  return encode(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength), w, h, 4);
}

/** Encodes w by h RGB pixels (3 bytes each, row-major) as an 8-bit RGB PNG. */
export function encodePngRgb(pixels: Uint8ClampedArray | Uint8Array, w: number, h: number): Buffer {
  return encode(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength), w, h, 3);
}

/** The RGBA encoder's output as the `url("data:...")` value sky-wash.css stores. */
export function pngDataUrl(pixels: Uint8ClampedArray, w: number, h: number): string {
  return `url("data:image/png;base64,${encodePngRgba(pixels, w, h).toString("base64")}")`;
}
