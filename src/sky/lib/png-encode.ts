// A minimal PNG encoder for Node: RGBA pixels in, a PNG buffer out. Used by
// the save route and the bake to write the stardust tile the knobs describe.
// Node only (zlib); the editor makes its preview PNG with a canvas instead.

import { deflateSync } from "node:zlib";

const TABLE = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf: Uint8Array) => { let c = -1; for (const v of buf) c = TABLE[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

/** Encodes w by h RGBA pixels (4 bytes each, row-major) as an 8-bit RGBA PNG. */
export function encodePngRgba(pixels: Uint8ClampedArray, w: number, h: number): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    raw.set(pixels.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/** The same, as the `url("data:...")` value sky-wash.css stores. */
export function pngDataUrl(pixels: Uint8ClampedArray, w: number, h: number): string {
  return `url("data:image/png;base64,${encodePngRgba(pixels, w, h).toString("base64")}")`;
}
