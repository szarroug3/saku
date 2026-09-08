// WCAG contrast arithmetic for the night theme. No React, no app imports.
//
// Used two ways: by src/sky/lib/night-theme.test.ts, which parses globals.css
// and enforces the floors the tokens promise (4.5:1 for text, 3:1 for lines),
// and by the /tokens gallery, which shows the same ratios live off the
// computed styles so a tweak can be judged before the test runs.

export type Rgb = readonly [number, number, number];

export interface ParsedColor {
  rgb: Rgb;
  /** 0 to 1. Anything under 1 has to be composited over a ground before it
   * can be measured. */
  alpha: number;
}

/**
 * Parses the colour syntaxes globals.css actually uses: 3, 4, 6 and 8 digit
 * hex, and rgb()/rgba() in either the comma or the space form. Anything else
 * (named colours, hsl, var()) returns null rather than guessing.
 */
export function parseColor(value: string): ParsedColor | null {
  const v = value.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3,8})$/.exec(v);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      digits = digits
        .split("")
        .map((d) => d + d)
        .join("");
    }
    if (digits.length !== 6 && digits.length !== 8) return null;
    const channel = (i: number) => parseInt(digits.slice(i, i + 2), 16);
    const alpha = digits.length === 8 ? channel(6) / 255 : 1;
    return { rgb: [channel(0), channel(2), channel(4)], alpha };
  }

  const fn = /^rgba?\((.+)\)$/.exec(v);
  if (fn) {
    const parts = fn[1]
      .replace("/", " ")
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [r, g, b] = parts;
    const alpha = parts.length >= 4 ? parts[3] : 1;
    return { rgb: [r, g, b], alpha };
  }

  return null;
}

/** The colour you actually see when `fg` at `alpha` sits on an opaque `bg`. */
export function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  const mix = (i: number) => Math.round(fg[i] * alpha + bg[i] * (1 - alpha));
  return [mix(0), mix(1), mix(2)];
}

/** Relative luminance per WCAG 2.x. */
function luminance([r, g, b]: Rgb): number {
  const linear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio between two opaque colours, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Contrast of a possibly translucent foreground against an opaque ground,
 * compositing first. Convenience for the common case in the gallery and test.
 */
export function contrastOn(fg: ParsedColor, ground: Rgb): number {
  const shown = fg.alpha < 1 ? composite(fg.rgb, fg.alpha, ground) : fg.rgb;
  return contrastRatio(shown, ground);
}
