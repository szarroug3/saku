// Which of the JP fonts this machine actually has.
//
// `document.fonts.check()` cannot answer this — for locally-installed families
// it returns true for anything that merely parses, so it claims all eight are
// present on a machine that has three. (Verified: it says true for "Klee" on a
// machine where Klee renders as the fallback.)
//
// So measure instead: render a sample in the candidate family with a known
// fallback behind it, and compare the rendered metrics against a deliberately
// bogus family that MUST fall back. Identical metrics mean the browser fell
// back for the candidate too — the font isn't there.
//
// A pure-kana/kanji sample can't carry this alone. CJK "full-width" glyphs are
// defined to render at the SAME standardized advance width in essentially
// every CJK-capable typeface — that's what "full-width" means. So a Gothic
// face, a Mincho face, and whatever font the browser's Unicode-fallback
// machinery substitutes for the CJK portion of a `monospace` chain all measure
// the same WIDTH for a kana/kanji-only string. That's not a quirk of one
// font — it's why this used to report all eight fonts unavailable on a
// machine that genuinely had six of them: a width-only comparison had nothing
// left to discriminate on once the sample was pure CJK.
//
// Two things do vary per real face even so:
//  - Latin/ASCII glyphs are NOT full-width-standardized. A JP font's own
//    companion Latin design is proportional and has its own metrics, which
//    reliably differs in total advance width from the generic `monospace`
//    fallback used by the control (and by a candidate that truly isn't
//    installed, since it falls through to the same `monospace`).
//  - Vertical metrics (ascent/descent) aren't standardized the way full-width
//    advance is, and differ between real faces — a Gothic face's glyph box
//    isn't a Mincho face's, isn't a fallback font's.
// So the sample mixes kana/kanji with Latin + digits, and the comparison
// checks width AND bounding-box ascent/descent. If the browser silently
// substituted the same thing for the candidate as it did for the bogus
// control, every one of those ties; if a real, distinct face rendered it, at
// least one won't.

const CONTROL = '"__kq_no_such_font__"';
/** Kana + kanji (full-width, ties across faces by design) plus Latin + digits
 * (proportional — genuinely differs per face, and does the actual
 * discriminating; the CJK half just keeps the sample realistic). */
const SAMPLE = "あきがぎゃ日本語AaGg09";
/** Sub-pixel amounts differ by tiny amounts between real faces; anything
 * within this of the control is the control. Applied to width and to each
 * vertical metric. */
const EPSILON = 0.5;

interface Metrics {
  width: number;
  ascent: number;
  descent: number;
}

const cache = new Map<string, boolean>();
let ctx: CanvasRenderingContext2D | null | undefined;
let controlMetrics: Metrics | null = null;

function measure(family: string): Metrics | null {
  if (ctx === undefined) {
    ctx = document.createElement("canvas").getContext("2d");
  }
  if (!ctx) return null;
  // The fallback must be a family the browser definitely has, so a missing
  // candidate lands somewhere deterministic.
  ctx.font = `32px ${family}, monospace`;
  const m = ctx.measureText(SAMPLE);
  return {
    width: m.width,
    ascent: m.actualBoundingBoxAscent,
    descent: m.actualBoundingBoxDescent,
  };
}

/** True if `a` and `b` differ by more than measurement noise. */
function differs(a: number, b: number): boolean {
  return Math.abs(a - b) > EPSILON;
}

/** Is this font family actually installed? */
export function isFontAvailable(family: string): boolean {
  // SSR, or a browser without canvas: assume yes rather than hiding every
  // font. A wrong "yes" costs a fallback glyph; a wrong "no" empties the pool.
  if (typeof document === "undefined") return true;
  const hit = cache.get(family);
  if (hit !== undefined) return hit;

  if (controlMetrics === null) {
    const m = measure(CONTROL);
    if (m === null) return true;
    controlMetrics = m;
  }
  const m = measure(family);
  // Available if ANY metric diverges from the control — width from the Latin
  // half of the sample, or either vertical metric from the whole thing. A
  // font that's really just the fallback in disguise ties on all three.
  const available =
    m === null
      ? true
      : differs(m.width, controlMetrics.width) ||
        differs(m.ascent, controlMetrics.ascent) ||
        differs(m.descent, controlMetrics.descent);
  cache.set(family, available);
  return available;
}

/** The subset of `fonts` this machine can actually render. */
export function availableFonts(fonts: readonly string[]): string[] {
  return fonts.filter(isFontAvailable);
}
