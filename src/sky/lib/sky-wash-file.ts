// The sky wash as data: a sweep, then an ordered list of layers (glows, a
// Milky Way band, a bottom band), read from and written to src/app/sky-wash.css.
//
// The file stays the source of truth and stays hand-editable: every layer is
// a few named knobs, and the LAYERS block at the bottom is generated from them
// by `renderWashFile`. The wash editor (/wash) parses the file with
// `parseWashFile`, edits the model, previews it with `resolvedMesh`, and saves
// it back through the dev API, which renders the file again. No React, no app
// imports, so the test and the route can both use it.

// Relative, with the extension, so plain Node (the bake script) can load this file too.
import { DEFAULT_STARS, milkyStarfield, type StarSpec } from "./sky-stars.ts";

export type Rgb = [number, number, number];

export interface GlowLayer {
  kind: "glow";
  visible: boolean; // hidden layers keep their knobs but are left out of the mesh
  id: string; // the knob name part: --sky-glow-<id>-*
  label: string;
  colour: Rgb;
  strength: number; // 0 to 1
  at: [number, number]; // x%, y%, may pass 100 to hang off an edge
  size: [number, number]; // ellipse width%, height% of the page
  tail: [number, number, number, number]; // strength at 28%, 52%, 76%, 92% of the ellipse, as shares of full
}
export interface MilkyLayer {
  kind: "milky";
  visible: boolean;
  lilac: Rgb;
  pink: Rgb;
  strength: number;
  angle: number; // CSS degrees
  shift: number; // % along the gradient line; negative slides the band back
  softness: number; // 0 (a hard-edged stripe) to 1 (a wide, eased fade on both sides)
  stars: number; // its own star field's density share, 0 (none) to 1
  starSize: [number, number]; // radius range, CSS px
  starBright: [number, number]; // opacity range, 0 to 1
  starWidth: number; // spread across the band, share of the gradient line
  starX: number; // slides the star field left or right, % of the width (the band stays put)
}
export interface BandLayer { kind: "band"; visible: boolean; upper: Rgb; lower: Rgb; strength: number; from: number }
export type WashLayer = GlowLayer | MilkyLayer | BandLayer;

export interface WashModel {
  zenith: string; // hex
  ground: string;
  ground2: string;
  sweepMid: number; // % down the page where the ground colour sits
  stars: StarSpec; // the general stardust tile
  layers: WashLayer[]; // top first; all sit above the sweep
}

/** The softness that draws the band the way it was before the knob existed. */
export const DEFAULT_MILKY_SOFTNESS = 0.3;
export const DEFAULT_MILKY_STARS = { shift: 0, stars: 0, starSize: [0.4, 1.3] as [number, number], starBright: [0.3, 0.9] as [number, number], starWidth: 0.075, starX: 0 };

export const DEFAULT_TAIL: GlowLayer["tail"] = [0.74, 0.4, 0.14, 0.03];

const rgb = (s: string): Rgb => { const p = s.split(",").map((n) => Number(n.trim())); if (p.length !== 3 || p.some((n) => Number.isNaN(n))) throw new Error("not r, g, b: " + s); return [p[0], p[1], p[2]]; };
const pair = (s: string): [number, number] => { const p = s.trim().split(/\s+/).map((v) => Number(v.replace("%", ""))); if (p.length !== 2 || p.some(Number.isNaN)) throw new Error("not two percents: " + s); return [p[0], p[1]]; };
const num = (s: string) => { const n = Number(s.replace(/%|deg$/, "")); if (Number.isNaN(n)) throw new Error("not a number: " + s); return n; };
const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/** Every `--sky-*` declaration in a stylesheet, in file order, comments ignored. */
export function skyDeclarations(css: string): Array<[string, string]> {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Array<[string, string]> = [];
  for (const m of code.matchAll(/--sky-([a-z0-9-]+):\s*([\s\S]*?);[ \t]*(?=\r?\n|$)/g)) out.push([m[1], m[2].trim()]);
  return out;
}

/** Reads the model out of sky-wash.css. Layer order is the order the knobs appear in. */
export function parseWashFile(css: string): WashModel {
  const decls = skyDeclarations(css);
  const get = (name: string) => decls.find(([n]) => n === name)?.[1];
  const need = (name: string) => { const v = get(name); if (v === undefined) throw new Error(`--sky-${name} is missing`); return v; };
  const layers: WashLayer[] = [];
  const seen = new Set<string>();
  for (const [name] of decls) {
    const glow = /^glow-([a-z0-9-]+?)-at$/.exec(name);
    if (glow && !seen.has("glow-" + glow[1])) {
      const id = glow[1]; seen.add("glow-" + id);
      const tail = get(`glow-${id}-tail`);
      layers.push({
        kind: "glow", id, visible: get(`glow-${id}-visible`) !== "0",
        label: get(`glow-${id}-label`)?.replace(/^"|"$/g, "") ?? id,
        colour: rgb(need(`glow-${id}`)), strength: num(need(`glow-${id}-strength`)),
        at: pair(need(`glow-${id}-at`)), size: pair(need(`glow-${id}-size`)),
        tail: tail ? (tail.split(/\s+/).map(Number) as GlowLayer["tail"]) : [...DEFAULT_TAIL],
      });
    } else if (name === "milky-strength" && !seen.has("milky")) {
      seen.add("milky");
      layers.push({
        kind: "milky", visible: get("milky-visible") !== "0", lilac: rgb(need("milky-lilac")), pink: rgb(need("milky-pink")), strength: num(need("milky-strength")), angle: num(get("milky-angle") ?? "112"),
        shift: num(get("milky-shift") ?? "0"), softness: num(get("milky-softness") ?? String(DEFAULT_MILKY_SOFTNESS)), stars: num(get("milky-stars") ?? "0"),
        starSize: get("milky-stars-size") ? pair(get("milky-stars-size")!) : [...DEFAULT_MILKY_STARS.starSize], starBright: get("milky-stars-brightness") ? pair(get("milky-stars-brightness")!) : [...DEFAULT_MILKY_STARS.starBright],
        starWidth: num(get("milky-stars-width") ?? String(DEFAULT_MILKY_STARS.starWidth)), starX: num(get("milky-stars-x") ?? String(DEFAULT_MILKY_STARS.starX)),
      });
    } else if (name === "band-strength" && !seen.has("band")) {
      seen.add("band");
      layers.push({ kind: "band", visible: get("band-visible") !== "0", upper: rgb(need("band-upper")), lower: rgb(need("band-lower")), strength: num(need("band-strength")), from: num(need("band-from")) });
    }
  }
  const stars: StarSpec = {
    density: num(get("stars-density") ?? String(DEFAULT_STARS.density)),
    size: get("stars-size") ? pair(get("stars-size")!) : [...DEFAULT_STARS.size],
    brightness: get("stars-brightness") ? pair(get("stars-brightness")!) : [...DEFAULT_STARS.brightness],
    seed: num(get("stars-seed") ?? String(DEFAULT_STARS.seed)),
  };
  return { zenith: need("zenith"), ground: need("ground"), ground2: need("ground-2"), sweepMid: num(need("sweep-mid")), stars, layers };
}

/** The CSS for one layer. With `resolve`, colours and strengths are literal
 * (for a live preview); without, they reference the layer's knobs. */
export function layerCss(layer: WashLayer, resolve: boolean): string {
  const c = (knob: string, colour: Rgb, alphaKnob: string, alpha: number, share = 1) =>
    resolve ? `rgba(${colour.join(", ")}, ${fmt(alpha * share)})` : share === 1 ? `rgba(var(--sky-${knob}), var(--sky-${alphaKnob}))` : `rgba(var(--sky-${knob}), calc(var(--sky-${alphaKnob}) * ${share}))`;
  if (layer.kind === "glow") {
    const k = `glow-${layer.id}`;
    const size = resolve ? `${layer.size[0]}% ${layer.size[1]}%` : `var(--sky-${k}-size)`;
    const at = resolve ? `${layer.at[0]}% ${layer.at[1]}%` : `var(--sky-${k}-at)`;
    const [t28, t52, t76, t92] = layer.tail;
    return `radial-gradient(${size} at ${at}, ${c(k, layer.colour, `${k}-strength`, layer.strength)} 0%, ${c(k, layer.colour, `${k}-strength`, layer.strength, t28)} 28%, ${c(k, layer.colour, `${k}-strength`, layer.strength, t52)} 52%, ${c(k, layer.colour, `${k}-strength`, layer.strength, t76)} 76%, ${c(k, layer.colour, `${k}-strength`, layer.strength, t92)} 92%, transparent 100%)`;
  }
  if (layer.kind === "milky") {
    const angle = resolve ? `${layer.angle}deg` : `var(--sky-milky-angle)`;
    // The band: a core from the lilac stop to the pink stop around the centre
    // (49%), fading out over `fade` on each side with an eased midway stop.
    // Softness sets the fade's width. Every stop slides together by the shift.
    const core = 4, fade = 4 + layer.softness * 40, centre = 49;
    const at = (offset: number) => (resolve ? `${fmt(centre + offset + layer.shift)}%` : `calc(${fmt(centre + offset)}% + var(--sky-milky-shift))`);
    const lilac = (share = 1) => c("milky-lilac", layer.lilac, "milky-strength", layer.strength, share);
    const pink = (share = 1) => c("milky-pink", layer.pink, "milky-strength", layer.strength, 0.78 * share);
    return `linear-gradient(${angle}, transparent ${at(-core - fade)}, ${lilac(0.3)} ${at(-core - fade * 0.45)}, ${lilac()} ${at(-core)}, ${pink()} ${at(core)}, ${pink(0.3)} ${at(core + fade * 0.45)}, transparent ${at(core + fade)})`;
  }
  const from = resolve ? `${layer.from}%` : `var(--sky-band-from)`;
  return `linear-gradient(180deg, transparent ${from}, ${c("band-upper", layer.upper, "band-strength", layer.strength)} 70%, ${c("band-lower", layer.lower, "band-strength", layer.strength)} 100%)`;
}

/** The whole mesh, top layer first, with literal colours: what the editor
 * sets on the page for a live preview. `stardust` is the value of --sky-stardust. */
export function resolvedMesh(model: WashModel, stardust = "var(--sky-stardust)"): string {
  const sweep = `linear-gradient(180deg, ${model.zenith} 0%, ${model.ground} ${model.sweepMid}%, ${model.ground2} 100%)`;
  return [stardust, ...model.layers.filter((l) => l.visible).map((l) => layerCss(l, true)), sweep].join(", ");
}

/** The Milky Way's star field for a model: the visible band's, or "none". */
export function resolvedStarfield(model: WashModel): string {
  const m = model.layers.find((l): l is MilkyLayer => l.kind === "milky" && l.visible);
  return m ? milkyStarfield(m) : "none";
}

/** A fresh id for a new glow that does not collide with the existing ones. */
export function nextGlowId(model: WashModel): string {
  const used = new Set(model.layers.filter((l): l is GlowLayer => l.kind === "glow").map((l) => l.id));
  let n = 1; while (used.has(String(n))) n++;
  return String(n);
}

/** Renders the complete sky-wash.css: the header, the knobs for every layer
 * in order, then the generated LAYERS block, then the trailing rules (the
 * .sky-wash class and the switch overrides), which are passed through. */
export function renderWashFile(model: WashModel, stardust: string, trailing: string): string {
  const knobs: string[] = [];
  knobs.push(`  /* The sweep, top to bottom. Zenith is the very top of the page, ground is
   * the page colour, ground-2 is where the sweep ends at the bottom. */
  --sky-zenith: ${model.zenith};
  --sky-ground: ${model.ground};
  --sky-ground-2: ${model.ground2};
  --sky-sweep-mid: ${fmt(model.sweepMid)}%;`);
  knobs.push(`  /* The stardust: dots per 480px tile, their radius range (px), their
   * opacity range, and the seed that scatters them. */
  --sky-stars-density: ${fmt(model.stars.density)};
  --sky-stars-size: ${fmt(model.stars.size[0])} ${fmt(model.stars.size[1])};
  --sky-stars-brightness: ${fmt(model.stars.brightness[0])} ${fmt(model.stars.brightness[1])};
  --sky-stars-seed: ${fmt(model.stars.seed)};`);
  for (const layer of model.layers) {
    if (layer.kind === "glow") {
      knobs.push(`  /* Glow: ${layer.label}. */
  --sky-glow-${layer.id}-label: "${layer.label.replace(/"/g, "'")}";
  --sky-glow-${layer.id}: ${layer.colour.join(", ")};
  --sky-glow-${layer.id}-strength: ${fmt(layer.strength)};
  --sky-glow-${layer.id}-at: ${fmt(layer.at[0])}% ${fmt(layer.at[1])}%;
  --sky-glow-${layer.id}-size: ${fmt(layer.size[0])}% ${fmt(layer.size[1])}%;
  --sky-glow-${layer.id}-tail: ${layer.tail.map(fmt).join(" ")};
  --sky-glow-${layer.id}-visible: ${layer.visible ? 1 : 0};`);
    } else if (layer.kind === "milky") {
      knobs.push(`  /* The faint band running diagonally, like a Milky Way. Shift slides it
   * along its own line; softness widens and eases its edges (0 is a hard
   * stripe); stars is its own star field's density (0 for none),
   * with a radius range (px) and an opacity range; width is their spread
   * across the band, x slides the whole field left or right. */
  --sky-milky-lilac: ${layer.lilac.join(", ")};
  --sky-milky-pink: ${layer.pink.join(", ")};
  --sky-milky-strength: ${fmt(layer.strength)};
  --sky-milky-angle: ${fmt(layer.angle)}deg;
  --sky-milky-shift: ${fmt(layer.shift)}%;
  --sky-milky-softness: ${fmt(layer.softness)};
  --sky-milky-stars: ${fmt(layer.stars)};
  --sky-milky-stars-size: ${fmt(layer.starSize[0])} ${fmt(layer.starSize[1])};
  --sky-milky-stars-brightness: ${fmt(layer.starBright[0])} ${fmt(layer.starBright[1])};
  --sky-milky-stars-width: ${fmt(layer.starWidth)};
  --sky-milky-stars-x: ${fmt(layer.starX)}%;
  --sky-milky-visible: ${layer.visible ? 1 : 0};`);
    } else {
      knobs.push(`  /* The band across the bottom, under the glows above it. */
  --sky-band-upper: ${layer.upper.join(", ")};
  --sky-band-lower: ${layer.lower.join(", ")};
  --sky-band-strength: ${fmt(layer.strength)};
  --sky-band-from: ${fmt(layer.from)}%;
  --sky-band-visible: ${layer.visible ? 1 : 0};`);
    }
  }
  const shown = model.layers.filter((l) => l.visible);
  const layerList = shown.length ? shown.map((l) => "    " + layerCss(l, false)).join(",\n") : "    none";
  return `/* ============================================================================
 * THE SKY WASH: the page background of the Sky redesign.
 *
 * THIS IS THE FILE TO EDIT when tuning the background, by hand or with the
 * editor at /wash (drag the glows, pick colours, add or remove layers,
 * then Save, which rewrites this file). Every value in the KNOBS block is one
 * thing to change. The LAYERS block is generated from the knobs by
 * src/sky/lib/sky-wash-file.ts; edit the knobs, not the layers.
 *
 * A layer is a glow (--sky-glow-<id>-*), the Milky Way band (--sky-milky-*)
 * or the bottom band (--sky-band-*). Layers paint in the order their knobs
 * appear here, top first, all above the sweep. To add a glow by hand, copy
 * one glow's six knobs under a new id and run the editor's Save, or
 * \`npm run bake:sky\`, to regenerate the layers.
 *
 * Colours are three channels ("240, 120, 205") so one colour can be used at
 * several strengths. Strength runs 0 (invisible) to 1 (solid). A position is
 * "x y" from the top left, and may pass 100% to hang a glow off the edge. A
 * size is an ellipse's width and height as a share of the page. A tail is the
 * glow's strength at 28%, 52%, 76% and 92% of its ellipse, as shares of full.
 * "visible: 0" keeps a layer's knobs but leaves it out of the mesh. The
 * --sky-stars-* knobs shape the stardust tile; the Milky Way's --sky-milky-
 * stars* knobs its own star field. Both images are generated on Save.
 *
 * When you are happy, run \`npm run bake:sky\`. That renders the layers to
 * public/sky/wash-baked.png, which is what the pages actually paint (the live
 * CSS gradients make resizing lag; a bitmap does not).
 * ========================================================================== */
:root {
  /* ---------------------------------------------------------------- KNOBS */

${knobs.join("\n\n")}

  /* ------------------------------------------------ LAYERS (generated) */

  /* A tiled field of tiny stars from the --sky-stars-* knobs, baked to a 960px
   * PNG (a 480px tile at 2x) and pasted as data. A bitmap, not an SVG, so the
   * browser caches it once instead of re-rasterising the dots on every scroll
   * and resize. Regenerated by the editor's Save and by \`npm run bake:sky\`. */
  --sky-stardust: ${stardust};

  /* The Milky Way's own stars, from the --sky-milky-stars* knobs: an inline
   * SVG drawn for a 16:9 box and shown with cover, like the baked bitmap, so
   * the two always agree. "none" when the band has no stars. */
  --sky-milky-starfield: ${resolvedStarfield(model)};

  /* Every visible layer above the sweep, top first, assembled from the knobs above. */
  --sky-mesh-layers:
${layerList};

  /* The sweep under everything: zenith at the top, the ground, then ground-2. */
  --sky-sweep: linear-gradient(180deg, var(--sky-zenith) 0%, var(--sky-ground) var(--sky-sweep-mid), var(--sky-ground-2) 100%);

  /* Everything, top layer first: stardust, the layers, the sweep. */
  --sky-mesh: var(--sky-stardust), var(--sky-mesh-layers), var(--sky-sweep);
}

${trailing.trim()}
`;
}

/** The part of sky-wash.css after the :root block: the .sky-wash class and
 * the switch overrides. Kept verbatim across saves. */
export function trailingRules(css: string): string {
  const i = css.indexOf("\n}\n", css.indexOf(":root {"));
  return i < 0 ? "" : css.slice(i + 3);
}

/** Validation the dev API applies before writing anything. */
export function validateModel(m: WashModel): string | null {
  const hex = /^#[0-9a-f]{6}$/i;
  if (![m.zenith, m.ground, m.ground2].every((h) => hex.test(h))) return "sweep colours must be #rrggbb";
  if (!(m.sweepMid >= 0 && m.sweepMid <= 100)) return "sweep-mid must be 0 to 100";
  const okRgb = (c: Rgb) => c.length === 3 && c.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
  const ok01 = (n: number) => n >= 0 && n <= 1;
  const okRange = (r: [number, number], lo: number, hi: number) => r.length === 2 && r[0] >= lo && r[1] <= hi && r[0] <= r[1];
  if (!(m.stars.density >= 0 && m.stars.density <= 400) || !okRange(m.stars.size, 0.1, 4) || !okRange(m.stars.brightness, 0, 1) || !Number.isInteger(m.stars.seed)) return "stars out of range";
  const ids = new Set<string>();
  for (const l of m.layers) {
    if (l.kind === "glow") {
      if (!/^[a-z0-9-]+$/.test(l.id) || ids.has(l.id)) return `bad or repeated glow id "${l.id}"`;
      ids.add(l.id);
      if (!okRgb(l.colour) || !ok01(l.strength)) return `glow ${l.id}: colour or strength out of range`;
      if (!l.at.every((n) => n >= -50 && n <= 150) || !l.size.every((n) => n > 0 && n <= 200)) return `glow ${l.id}: position or size out of range`;
      if (l.tail.length !== 4 || !l.tail.every(ok01)) return `glow ${l.id}: tail must be four shares 0 to 1`;
    } else if (l.kind === "milky") {
      if (!okRgb(l.lilac) || !okRgb(l.pink) || !ok01(l.strength) || !(l.angle >= 0 && l.angle <= 360)) return "milky band out of range";
      if (!(l.shift >= -60 && l.shift <= 60) || !ok01(l.softness) || !ok01(l.stars) || !okRange(l.starSize, 0.1, 4) || !okRange(l.starBright, 0, 1)) return "milky stars out of range";
      if (!(l.starWidth >= 0.01 && l.starWidth <= 0.5) || !(l.starX >= -100 && l.starX <= 100)) return "milky stars width or slide out of range";
    } else if (l.kind === "band") {
      if (!okRgb(l.upper) || !okRgb(l.lower) || !ok01(l.strength) || !(l.from >= 0 && l.from <= 100)) return "bottom band out of range";
    } else return "unknown layer kind";
  }
  return null;
}
