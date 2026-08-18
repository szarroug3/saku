// A numeric transform (uniform scale + translate) over an SVG path `d` string,
// and the bounding box of one — the two primitives SAK-72 Part B's composed
// yōon stroke diagram is built from (see composeGlyphStrokes in strokes.ts,
// its one caller).
//
// WHY THIS EXISTS
// ================
// きゃ has no precomposed KanjiVG entry: KanjiVG only digitized き (the base)
// and ゃ (the small kana), each drawn to fill its OWN 109×109 grid the same
// way every character is. Composing them into one diagram means shrinking and
// repositioning the small glyph's real strokes into a corner of the base's —
// which means editing the actual coordinates inside its path `d` strings, not
// just wrapping them in an SVG `<g transform>`. A `<g transform>` would have
// worked too, but `StrokeOrder` draws every stroke as a flat `path` with a
// `pathLength={1}`-normalised dash animation (see stroke-order.tsx) — the
// animation timing is per-PATH, not per-group, so a transformed group would
// still need its own child paths, and baking the transform into the `d`
// strings once at data-composition time is simpler than threading a second
// transform prop through the renderer for a shape it otherwise never needs.
//
// ONLY M AND c ARE EXERCISED TODAY
// =================================
// Grepping every currently-ingested kana stroke (base + Part A's
// dakuten/handakuten glyphs, hiragana and katakana) turns up exactly two
// command letters: one absolute `M` (the pen's start point) followed by a
// chain of relative `c`'s (cubic Bézier deltas), each restated in full — no
// implicit repeated segments. That is KanjiVG's own SVG style, not something
// this app chose, and the small kana this ingest adds (ゃゅょ/ャュョ) come from
// the same source in the same style. `transformPathD` below is written to the
// general SVG path grammar anyway (the other common commands, both absolute
// and relative) rather than hardcoded to M/c alone, so a future glyph that
// happens to use L or a shorthand curve does not silently mis-transform.
//
// ABSOLUTE VS RELATIVE, AND WHY THEY TRANSFORM DIFFERENTLY
// ==========================================================
// An absolute coordinate is a POINT: newX = x*scale + tx, newY = y*scale + ty.
// A relative coordinate is a DELTA — how far the pen moves from wherever it
// already is — and a delta only cares about scale; translating the whole path
// does not change the distance between two points on it, so a delta transforms
// as newDx = dx*scale, newDy = dy*scale, with no translate term. Getting this
// backwards (translating deltas too) would slide every stroke after the first
// off the glyph, compounding with each command.

/** A pure scale-then-translate transform: newX = x*scale + tx (and the same
 * for y). Uniform (one `scale` for both axes) because every use here is
 * "shrink this glyph into a corner", which must not distort its shape. */
export interface Affine {
  readonly scale: number;
  readonly tx: number;
  readonly ty: number;
}

/** Absolute commands (operate on POINTS) vs relative (operate on DELTAS),
 * keyed by their uppercase letter. `z`/`Z` carries no coordinates either way. */
const ABS = new Set(["M", "L", "C", "S", "Q", "T"]);
const REL = new Set(["m", "l", "c", "s", "q", "t"]);

/** How many (x, y) coordinate PAIRS each command's parameter list holds.
 * H/V/Z are handled separately below (H/V take one axis, not a pair; Z takes
 * none). */
function pairsPerSegment(letter: string): number {
  switch (letter.toUpperCase()) {
    case "M":
    case "L":
    case "T":
      return 1;
    case "S":
    case "Q":
      return 2;
    case "C":
      return 3;
    default:
      return 0;
  }
}

/** Split a path `d` string into `{command, numbers}` segments — one entry per
 * command LETTER as it appears in the source. KanjiVG never uses SVG's
 * implicit-repeat shorthand (a bare number list continuing the previous
 * command with no new letter) — confirmed by grep, see the file header — so
 * this does not attempt to expand it; a `d` that did use it would simply lose
 * the implicit segment's transform, which is why the ingest test
 * (strokes.test.ts) pins that the source stays letter-per-segment. */
function segments(d: string): { command: string; numbers: number[] }[] {
  const out: { command: string; numbers: number[] }[] = [];
  const re = /([MmLlCcSsQqTtHhVvZz])([^MmLlCcSsQqTtHhVvZz]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const command = m[1];
    const numbers = (m[2].match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
    out.push({ command, numbers });
  }
  return out;
}

/** Apply `affine` to every coordinate in a path `d` string, formatting numbers
 * the same way KanjiVG's own source does (plain decimal, no trailing zeros
 * beyond what `toString` produces) so a transformed path is not visibly
 * distinguishable in style from an authored one. */
export function transformPathD(d: string, affine: Affine): string {
  const { scale, tx, ty } = affine;
  const round = (n: number) => Math.round(n * 1000) / 1000;

  return segments(d)
    .map(({ command, numbers }) => {
      const letter = command.toUpperCase();
      if (letter === "Z") return command;

      if (letter === "H" || letter === "V") {
        // One axis only. H's numbers are x-values, V's are y-values; the
        // relevant half of the affine applies (H uses scale+tx, V scale+ty),
        // and relative h/v drop the translate term like every other delta.
        const isAbs = command === command.toUpperCase();
        const off = letter === "H" ? tx : ty;
        const vals = numbers.map((n) => round(isAbs ? n * scale + off : n * scale));
        return command + vals.join(",");
      }

      const pairs = pairsPerSegment(letter);
      if (pairs === 0) return command + numbers.join(",");

      const isAbs = ABS.has(command);
      const isRel = REL.has(command);
      const vals = numbers.map((n, i) => {
        // Even index within the pair = x, odd = y — true for every pair-based
        // command here (M/L/T = 1 pair, S/Q = 2, C = 3), since each pair is
        // (x, y) with nothing interleaved.
        const isX = i % 2 === 0;
        if (isAbs) return round(n * scale + (isX ? tx : ty));
        if (isRel) return round(n * scale);
        return n;
      });
      return command + vals.join(",");
    })
    .join("");
}

/** The absolute bounding box a path's ANCHOR/CONTROL points span. Walks the
 * path resolving relative commands against a running current point, same as
 * a real renderer would, so `m`/`c`/`l` deltas land in the right place. Good
 * enough for corner-placement math (composeGlyphStrokes's only use): it is a
 * control-point bound, which for a cubic Bézier is a slightly looser box than
 * the true rendered curve, but strokes never bow far outside their control
 * hull and this is a layout heuristic, not a rendering guarantee. */
export function pathBBox(d: string): { xmin: number; xmax: number; ymin: number; ymax: number } {
  let cx = 0;
  let cy = 0;
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  const visit = (x: number, y: number) => {
    xmin = Math.min(xmin, x);
    xmax = Math.max(xmax, x);
    ymin = Math.min(ymin, y);
    ymax = Math.max(ymax, y);
  };

  for (const { command, numbers } of segments(d)) {
    const letter = command.toUpperCase();
    const isAbs = command === letter;
    if (letter === "Z") continue;
    if (letter === "H") {
      cx = isAbs ? numbers[0] : cx + numbers[0];
      visit(cx, cy);
      continue;
    }
    if (letter === "V") {
      cy = isAbs ? numbers[0] : cy + numbers[0];
      visit(cx, cy);
      continue;
    }
    // Every pair in a multi-pair command (c's two control points + endpoint,
    // s/q's control point + endpoint) is relative to the SAME starting point —
    // the current point when this command began — not chained relative to the
    // pair before it. (S)VG's own grammar: "c dx1 dy1 dx2 dy2 dx dy" places all
    // three offsets from one origin. Only the LAST pair (the curve's actual
    // endpoint) becomes the new current point for whatever comes next.
    const startX = cx;
    const startY = cy;
    const pairs = pairsPerSegment(letter);
    for (let p = 0; p < pairs; p++) {
      const x = numbers[p * 2];
      const y = numbers[p * 2 + 1];
      if (x === undefined || y === undefined) continue;
      const px = isAbs ? x : startX + x;
      const py = isAbs ? y : startY + y;
      visit(px, py);
      if (p === pairs - 1) {
        cx = px;
        cy = py;
      }
    }
  }
  return { xmin, xmax, ymin, ymax };
}
