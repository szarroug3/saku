// The wash file round-trips: what the editor saves is what it reads back, and
// what it reads is what sky-wash.css actually says.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { parseWashFile, renderWashFile, trailingRules, validateModel } from "@/sky/lib/sky-wash-file";

const CSS = readFileSync(path.resolve(process.cwd(), "src/app/sky-wash.css"), "utf8");

/** The model, named off the function that makes one: the interface itself is
 * private, and exporting it for a test is the thing this round is undoing. */
type WashModel = ReturnType<typeof parseWashFile>;

/** The value of one --sky-* knob in a stylesheet. The module reads its own
 * declarations privately; this is the one line of that a test needs. */
function knob(css: string, name: string): string {
  const m = new RegExp(`--sky-${name}:\\s*([\\s\\S]*?);`).exec(css.replace(/\/\*[\s\S]*?\*\//g, ""));
  assert.ok(m, `--sky-${name} is in the file`);
  return m[1].trim();
}

/** Each layer's generated gradient, read back out of a rendered file. The
 * --sky-mesh-layers block is the only place a layer's CSS is written, so this
 * is how the private `layerCss` is reached. */
function renderedLayers(model: WashModel): string[] {
  const block = knob(renderWashFile(model, knob(CSS, "stardust"), trailingRules(CSS)), "mesh-layers");
  return block.split(/,\s*\n/).map((s) => s.trim()).filter(Boolean);
}

describe("sky-wash.css as data", () => {
  it("parses the real file into a sweep and an ordered list of layers", () => {
    const m = parseWashFile(CSS);
    assert.match(m.zenith, /^#[0-9a-f]{6}$/);
    assert.ok(m.layers.length >= 1);
    assert.equal(validateModel(m), null);
  });

  it("renders and parses back to the same model", () => {
    const m = parseWashFile(CSS);
    const again = parseWashFile(renderWashFile(m, knob(CSS, "stardust"), trailingRules(CSS)));
    assert.deepEqual(again, m);
  });

  it("keeps the rules after the :root block verbatim across a save", () => {
    const m = parseWashFile(CSS);
    const out = renderWashFile(m, knob(CSS, "stardust"), trailingRules(CSS));
    assert.equal(trailingRules(out).trim(), trailingRules(CSS).trim());
    assert.ok(out.includes(".sky-wash {"), "the compositor-layer class survives");
  });

  it("every layer renders as one balanced gradient off its own knobs", () => {
    const m = parseWashFile(CSS);
    const layers = renderedLayers(m);
    // hidden layers keep their knobs but are left out of the block
    assert.equal(layers.length, m.layers.filter((l) => l.visible).length);
    for (const css of layers) {
      assert.equal((css.match(/\(/g) ?? []).length, (css.match(/\)/g) ?? []).length, css.slice(0, 60));
      assert.match(css, /^(radial|linear)-gradient\(/);
      assert.match(css, /var\(--sky-/, "a layer reads its knobs rather than baking their values in");
    }
  });

  it("a layer that is switched off leaves the block, and none leaves it empty", () => {
    const m = parseWashFile(CSS);
    const hidden = { ...m, layers: m.layers.map((l) => ({ ...l, visible: false })) };
    assert.deepEqual(renderedLayers(hidden), ["none"]);
    assert.equal(renderedLayers({ ...m, layers: [m.layers[0]] }).length, 1);
  });

  it("validation catches the things the editor could send", () => {
    const m = parseWashFile(CSS);
    assert.match(validateModel({ ...m, zenith: "blue" }) ?? "", /rrggbb/);
    const glow = m.layers.find((l) => l.kind === "glow");
    assert.ok(glow && glow.kind === "glow");
    assert.match(validateModel({ ...m, layers: [{ ...glow, strength: 2 }] }) ?? "", /out of range/);
    assert.match(validateModel({ ...m, layers: [glow, { ...glow }] }) ?? "", /repeated glow id/);
  });

  it("the Milky Way's softness widens and eases its edges", () => {
    const m = parseWashFile(CSS);
    const milky = m.layers.find((l) => l.kind === "milky");
    assert.ok(milky && milky.kind === "milky");
    const band = (softness: number) => renderedLayers({ ...m, layers: [{ ...milky, shift: 0, softness }] })[0];
    const stops = (softness: number) => [...band(softness).matchAll(/([\d.]+)%/g)].map((x) => Number(x[1]));
    const hard = stops(0), soft = stops(1);
    assert.equal(hard.length, 6, "six stops: clear, eased, core, core, eased, clear");
    assert.ok(soft[0] < hard[0] && soft[5] > hard[5], "softer means the fade starts further out on both sides");
    assert.deepEqual([hard[2], hard[3]], [soft[2], soft[3]], "the core does not move");
    assert.ok(hard[5] - hard[0] < 20 && soft[5] - soft[0] > 80, "from a stripe to a wide wash");
    assert.match(band(0.5), /calc\([\d.]+% \+ var\(--sky-milky-shift\)\)/, "every stop carries the shift");
  });
});
