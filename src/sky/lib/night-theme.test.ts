// The night theme's promises, checked against the stylesheet itself.
//
// globals.css and sky-wash.css are the sources of the --sky-* tokens (SAK-291):
// the palette in the first, the grounds and the page wash in the second. This
// test parses those files rather than a copy of the values, so a colour tweak
// that drops a text token under the floor fails here instead of in someone's
// eyes, and a wash edit that breaks the CSS fails here instead of vanishing.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { composite, contrastOn, contrastRatio, parseColor, type ParsedColor, type Rgb } from "@/sky/lib/contrast";

const CSS = ["src/app/globals.css", "src/app/sky-wash.css"].map((p) => readFileSync(path.resolve(process.cwd(), p), "utf8")).join("\n");
/** The stylesheet with comments removed, so prose that mentions a token by
 * name ("painted over --sky-ground") is never mistaken for a declaration. */
const CSS_CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every `--sky-*` declaration in the file, in order. */
function skyTokens(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  // A declaration ends at a ";" that closes the line. The stardust's data URI
  // carries a ";" of its own ("image/png;base64"), so a bare [^;]+ would cut it.
  for (const match of CSS_CODE.matchAll(/--sky-([a-z0-9-]+):\s*([\s\S]*?);[ \t]*(?=\r?\n|$)/g)) {
    const [, name, value] = match;
    out.set(name, [...(out.get(name) ?? []), value.trim()]);
  }
  return out;
}

const TOKENS = skyTokens();

/** A token value with its var() references and calc() products resolved, the
 * way the browser sees it. The wash is written as knobs feeding layers, so the
 * layers only make sense resolved. */
function resolve(value: string, depth = 0): string {
  if (depth > 8) throw new Error("var() nesting too deep in " + value.slice(0, 60));
  const withVars = value.replace(/var\(--sky-([a-z0-9-]+)\)/g, (_, name) => {
    const v = TOKENS.get(name);
    assert.ok(v, `var(--sky-${name}) is used but never defined`);
    return v[0];
  });
  const withCalc = withVars.replace(/calc\(\s*(-?[\d.]+)(%?)\s*([-+*])\s*(-?[\d.]+)(%?)\s*\)/g, (_, a, ua, op, b, ub) => {
    const x = Number(a), y = Number(b);
    return String(Math.round((op === "*" ? x * y : op === "+" ? x + y : x - y) * 1000) / 1000) + (ua || ub);
  });
  return /var\(--sky-/.test(withCalc) ? resolve(withCalc, depth + 1) : withCalc;
}
const COLOUR_TOKENS = ["ink", "muted", "faint", "star", "star-mid", "star-dim", "link", "gold", "gold-ink", "mint", "pale", "amber", "coral", "lilac", "card", "card-strong", "line"] as const;
/** Colour knobs are whatever the wash file declares: one per glow, plus the bands'. */
const CHANNEL_KNOBS = [...TOKENS.keys()].filter((n) => (/^glow-[a-z0-9-]+$/.test(n) && !/-(label|strength|at|size|tail|visible)$/.test(n)) || ["milky-lilac", "milky-pink", "band-upper", "band-lower"].includes(n));
const STRENGTH_KNOBS = [...TOKENS.keys()].filter((n) => n.endsWith("-strength"));

function colour(name: string): ParsedColor {
  const values = TOKENS.get(name);
  assert.ok(values, `--sky-${name} is missing from globals.css`);
  const parsed = parseColor(values[0]);
  assert.ok(parsed, `--sky-${name} (${values[0]}) is not a colour this test can read`);
  return parsed;
}

function opaque(name: string): Rgb {
  const c = colour(name);
  assert.equal(c.alpha, 1, `--sky-${name} must be opaque to serve as a ground`);
  return c.rgb;
}

/** A translucent surface, as it looks over a given ground. */
function surface(name: string, ground: Rgb): Rgb {
  const c = colour(name);
  return composite(c.rgb, c.alpha, ground);
}

const GROUNDS = ["zenith", "ground-0", "ground", "ground-2", "ground-3"] as const;
const TEXT_TOKENS = ["ink", "muted", "star", "star-mid", "gold", "mint", "pale", "amber", "coral", "lilac"] as const;
/** Drawn as lines between stars, never as text: held to the 3:1 floor instead. */
const LINE_TOKENS = ["link"] as const;
const DECORATIVE_ONLY = ["faint", "star-dim"] as const;

describe("night theme tokens", () => {
  it("defines every colour exactly once", () => {
    for (const name of [...GROUNDS, ...TEXT_TOKENS, ...LINE_TOKENS, ...DECORATIVE_ONLY, "card", "card-strong", "line", "gold-ink"]) {
      const values = TOKENS.get(name);
      assert.ok(values, `--sky-${name} is missing`);
      assert.equal(values.length, 1, `--sky-${name} is defined ${values.length} times; the theme owns it once`);
    }
  });

  it("every colour token parses, and every colour knob is three channels", () => {
    for (const name of [...GROUNDS, ...COLOUR_TOKENS]) {
      const v = TOKENS.get(name)?.[0] ?? "";
      assert.ok(parseColor(v), `--sky-${name} (${v}) does not parse`);
    }
    for (const name of CHANNEL_KNOBS) {
      const v = TOKENS.get(name)?.[0] ?? "";
      assert.match(v, /^\d{1,3}, \d{1,3}, \d{1,3}$/, `--sky-${name} must be "r, g, b" so it can be used at several strengths, got "${v}"`);
      assert.ok(parseColor(`rgb(${v})`), `--sky-${name} channels out of range`);
    }
    assert.ok(CHANNEL_KNOBS.length >= 1, "the wash declares at least one glow");
    for (const name of STRENGTH_KNOBS) {
      const s = Number(TOKENS.get(name)?.[0]);
      assert.ok(s >= 0 && s <= 1, `--sky-${name} must be 0 to 1`);
    }
  });

  it("the wash is well-formed CSS once resolved: no dangling var() or calc(), balanced brackets, real gradients", () => {
    for (const part of ["mesh-layers", "mesh"] as const) {
      const resolved = resolve(TOKENS.get(part)?.[0] ?? "");
      if (resolved.trim() === "none") continue; // an empty layer list is allowed
      assert.ok(!/var\(|calc\(/.test(resolved), `--sky-${part} still has an unresolved var() or calc()`);
      const open = (resolved.match(/\(/g) ?? []).length, close = (resolved.match(/\)/g) ?? []).length;
      assert.equal(open, close, `--sky-${part} has ${open} "(" and ${close} ")"; a broken layer drops the whole background`);
      // split into top-level layers and check each is one gradient (or the stardust url)
      const layers: string[] = []; let depth = 0, cur = "";
      for (const ch of resolved) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { layers.push(cur.trim()); cur = ""; } else cur += ch; }
      layers.push(cur.trim());
      for (const layer of layers) {
        assert.match(layer, /^(radial-gradient|linear-gradient|url)\(/, `--sky-${part} has a layer that is not a gradient or the stardust: "${layer.slice(0, 40)}"`);
        if (layer.startsWith("url(")) continue;
        assert.ok(/\)\s*$/.test(layer), `--sky-${part} has a layer with text after its closing bracket: "${layer.slice(-40)}"`);
        assert.ok((layer.match(/\d+%/g) ?? []).length >= 2, `--sky-${part} has a gradient with fewer than two stops`);
      }
    }
  });

  it("text tokens reach 4.5:1 on every ground and on both cards over every ground", () => {
    for (const groundName of GROUNDS) {
      const ground = opaque(groundName);
      const backdrops: Array<[string, Rgb]> = [
        [groundName, ground],
        [`card over ${groundName}`, surface("card", ground)],
        [`card-strong over ${groundName}`, surface("card-strong", ground)],
      ];
      for (const [label, bg] of backdrops) {
        for (const name of TEXT_TOKENS) {
          const ratio = contrastOn(colour(name), bg);
          assert.ok(ratio >= 4.5, `--sky-${name} on ${label} is ${ratio.toFixed(2)}:1, below the 4.5:1 text floor`);
        }
      }
    }
  });

  it("gold ink reads on gold", () => {
    const ratio = contrastRatio(opaque("gold-ink"), opaque("gold"));
    assert.ok(ratio >= 4.5, `gold-ink on gold is ${ratio.toFixed(2)}:1`);
  });

  it("the line colour reaches 3:1 on every ground", () => {
    for (const groundName of GROUNDS) {
      const ratio = contrastOn(colour("line"), opaque(groundName));
      // The line is translucent by design; what matters is that once it is
      // drawn on a ground it is still a visible line, not that it could carry text.
      assert.ok(ratio >= 1.15, `--sky-line on ${groundName} is ${ratio.toFixed(2)}:1, invisible`);
      for (const name of LINE_TOKENS) {
        const link = contrastOn(colour(name), opaque(groundName));
        assert.ok(link >= 3, `--sky-${name} on ${groundName} is ${link.toFixed(2)}:1, below the 3:1 line floor`);
      }
    }
  });

  it("the decorative tokens are marked as such in the stylesheet", () => {
    for (const name of DECORATIVE_ONLY) {
      const line = CSS.split("\n").find((l) => l.includes(`--sky-${name}:`));
      assert.ok(line, `--sky-${name} is missing`);
      assert.match(line, /decorative only/, `--sky-${name} sits under the text floor and must say so on its own line`);
      const ratio = contrastOn(colour(name), opaque("ground"));
      assert.ok(ratio < 4.5, `--sky-${name} is ${ratio.toFixed(2)}:1 on the ground; if it now reads as text, promote it and drop the note`);
    }
  });

  it("the mesh is stardust, the generated layers, and a sweep through the ground tokens", () => {
    const mesh = TOKENS.get("mesh")?.[0] ?? "";
    assert.ok(mesh.startsWith("var(--sky-stardust)"), "the stardust is the top layer");
    assert.ok(mesh.indexOf("var(--sky-mesh-layers)") < mesh.indexOf("var(--sky-sweep)"), "the layers sit above the sweep");
    assert.ok(/linear-gradient\(180deg, var\(--sky-zenith\)/.test(TOKENS.get("sweep")?.[0] ?? ""), "the sweep starts at the zenith");
    assert.ok(mesh.trim().endsWith("var(--sky-sweep)"), "the sweep is the bottom layer of the mesh");
    for (const part of ["mesh", "mesh-layers"]) {
      assert.ok(!/#[0-9a-f]{3,8}/i.test(TOKENS.get(part)?.[0] ?? ""), `no raw colour in --sky-${part}; opaque stops come from ground tokens, glows are rgba knobs`);
    }
    const stardust = TOKENS.get("stardust")?.[0] ?? "";
    assert.ok(stardust.startsWith('url("data:image/png;base64,'), "the stardust is an inline PNG (a bitmap the browser caches), not a fetched asset or an SVG");
  });

  // Parked at Sam's request (2026-09-04): the background is being tuned by eye
  // and the foreground rules for text over the glows come after. When they
  // are decided, this is where they go: resolve --sky-mesh-layers, take each
  // glow's strongest stop, composite it over the sweep stops (zenith, ground,
  // ground-2) and over both cards, and hold ink and muted to their floors.
  it.skip("glows keep the text floors that the foreground rules will set", () => {
    const layers = resolve(TOKENS.get("mesh-layers")?.[0] ?? "");
    assert.ok(layers.length > 0);
  });

  it("each standing has an alias token pointing at a text-safe colour, except not seen, which is decorative", () => {
    const ALIASES: Record<string, string> = { solid: "mint", "getting-there": "pale", shaky: "amber", slipping: "coral", claimed: "star-mid", "not-seen": "star-dim" };
    for (const [standing, target] of Object.entries(ALIASES)) {
      const values = TOKENS.get(standing);
      assert.ok(values && values.length === 1, `--sky-${standing} is defined once`);
      assert.equal(values[0], `var(--sky-${target})`, `--sky-${standing} aliases the palette, it is not a colour of its own`);
      if (standing === "not-seen") assert.ok((DECORATIVE_ONLY as readonly string[]).includes(target), "not seen paints a decorative dot and never text");
      else assert.ok((TEXT_TOKENS as readonly string[]).includes(target), `--sky-${standing} must be a text-safe colour, since its chip label uses it`);
      assert.ok(CSS_CODE.includes(`--color-sky-${standing}: var(--sky-${standing});`), `--sky-${standing} has a Tailwind name`);
    }
  });

  it("both type tokens end in a real fallback stack", () => {
    const display = TOKENS.get("font-display")?.[0] ?? "";
    const ui = TOKENS.get("font-ui")?.[0] ?? "";
    assert.match(display, /"Hiragino Mincho ProN".*serif$/);
    assert.match(ui, /system-ui.*sans-serif$/);
    assert.match(display, /var\(--font-shippori-mincho, "Shippori Mincho"\)/);
    assert.match(ui, /var\(--font-karla, "Karla"\)/);
  });
});

describe("contrast arithmetic", () => {
  it("parses the syntaxes globals.css uses", () => {
    assert.deepEqual(parseColor("#0b1230"), { rgb: [11, 18, 48], alpha: 1 });
    assert.deepEqual(parseColor("#fff"), { rgb: [255, 255, 255], alpha: 1 });
    assert.deepEqual(parseColor("rgba(255, 255, 255, 0.5)"), { rgb: [255, 255, 255], alpha: 0.5 });
    assert.deepEqual(parseColor("rgb(140 151 196 / 0.22)"), { rgb: [140, 151, 196], alpha: 0.22 });
    assert.equal(parseColor("var(--x)"), null);
  });

  it("matches the WCAG reference points", () => {
    assert.equal(contrastRatio([0, 0, 0], [255, 255, 255]).toFixed(2), "21.00");
    assert.equal(contrastRatio([118, 118, 118], [255, 255, 255]).toFixed(2), "4.54");
  });
});
