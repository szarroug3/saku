// Which of the JP fonts this machine actually has.
//
// `document.fonts.check()` cannot answer this — for locally-installed families
// it returns true for anything that merely parses, so it claims all eight are
// present on a Mac that has three. (Verified: it says true for "Klee" on a
// machine where Klee renders as the fallback.)
//
// So measure instead. Render a kana sample in the candidate family with a known
// fallback behind it, and compare against the width of a deliberately bogus
// family. Identical to the pixel means the browser fell back — the font isn't
// there. It's the standard trick, and unlike a hardcoded list it stays correct
// on a machine that HAS Klee installed.

const CONTROL = '"__kq_no_such_font__"';
/** Kana + kanji: enough glyphs that two real faces won't coincidentally tie. */
const SAMPLE = "あきがぎゃ日本語";
/** Sub-pixel widths differ by tiny amounts between real faces; anything within
 * this of the control is the control. */
const EPSILON = 0.5;

const cache = new Map<string, boolean>();
let ctx: CanvasRenderingContext2D | null | undefined;
let controlWidth: number | null = null;

function measure(family: string): number | null {
  if (ctx === undefined) {
    ctx = document.createElement("canvas").getContext("2d");
  }
  if (!ctx) return null;
  // The fallback must be a family the browser definitely has, so a missing
  // candidate lands somewhere deterministic.
  ctx.font = `32px ${family}, monospace`;
  return ctx.measureText(SAMPLE).width;
}

/** Is this font family actually installed? */
export function isFontAvailable(family: string): boolean {
  // SSR, or a browser without canvas: assume yes rather than hiding every
  // font. A wrong "yes" costs a fallback glyph; a wrong "no" empties the pool.
  if (typeof document === "undefined") return true;
  const hit = cache.get(family);
  if (hit !== undefined) return hit;

  if (controlWidth === null) {
    const w = measure(CONTROL);
    if (w === null) return true;
    controlWidth = w;
  }
  const w = measure(family);
  const available = w === null ? true : Math.abs(w - controlWidth) > EPSILON;
  cache.set(family, available);
  return available;
}

/** The subset of `fonts` this machine can actually render. */
export function availableFonts(fonts: readonly string[]): string[] {
  return fonts.filter(isFontAvailable);
}
