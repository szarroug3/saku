// The wash file round-trips: what the editor saves is what it reads back, and
// what it reads is what sky-wash.css actually says.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { layerCss, nextGlowId, parseWashFile, renderWashFile, resolvedMesh, skyDeclarations, trailingRules, validateModel } from "@/sky/lib/sky-wash-file";

const CSS = readFileSync(path.resolve(process.cwd(), "src/app/sky-wash.css"), "utf8");

describe("sky-wash.css as data", () => {
  it("parses the real file into a sweep and an ordered list of layers", () => {
    const m = parseWashFile(CSS);
    assert.match(m.zenith, /^#[0-9a-f]{6}$/);
    assert.ok(m.layers.length >= 1);
    assert.equal(validateModel(m), null);
  });

  it("renders and parses back to the same model", () => {
    const m = parseWashFile(CSS);
    const stardust = skyDeclarations(CSS).find(([n]) => n === "stardust")![1];
    const again = parseWashFile(renderWashFile(m, stardust, trailingRules(CSS)));
    assert.deepEqual(again, m);
  });

  it("keeps the rules after the :root block verbatim across a save", () => {
    const m = parseWashFile(CSS);
    const stardust = skyDeclarations(CSS).find(([n]) => n === "stardust")![1];
    const out = renderWashFile(m, stardust, trailingRules(CSS));
    assert.equal(trailingRules(out).trim(), trailingRules(CSS).trim());
    assert.ok(out.includes(".sky-wash {"), "the compositor-layer class survives");
  });

  it("every layer renders as one balanced gradient, resolved and unresolved", () => {
    for (const layer of parseWashFile(CSS).layers) {
      for (const resolve of [true, false]) {
        const css = layerCss(layer, resolve);
        assert.equal((css.match(/\(/g) ?? []).length, (css.match(/\)/g) ?? []).length, css.slice(0, 60));
        assert.match(css, /^(radial|linear)-gradient\(/);
        if (resolve) assert.ok(!/var\(|calc\(/.test(css), "a resolved layer has no var() or calc()");
      }
    }
  });

  it("the resolved mesh is stardust, the layers, then the sweep", () => {
    const m = parseWashFile(CSS);
    const mesh = resolvedMesh(m, "STARDUST");
    assert.ok(mesh.startsWith("STARDUST, "));
    assert.ok(mesh.endsWith("100%)"));
    assert.equal((mesh.match(/gradient\(/g) ?? []).length, m.layers.length + 1);
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
    const stops = (softness: number) => [...layerCss({ ...milky, shift: 0, softness }, true).matchAll(/([\d.]+)%/g)].map((x) => Number(x[1]));
    const hard = stops(0), soft = stops(1);
    assert.equal(hard.length, 6, "six stops: clear, eased, core, core, eased, clear");
    assert.ok(soft[0] < hard[0] && soft[5] > hard[5], "softer means the fade starts further out on both sides");
    assert.deepEqual([hard[2], hard[3]], [soft[2], soft[3]], "the core does not move");
    assert.ok(hard[5] - hard[0] < 20 && soft[5] - soft[0] > 80, "from a stripe to a wide wash");
    assert.match(layerCss({ ...milky, softness: 0.5 }, false), /calc\([\d.]+% \+ var\(--sky-milky-shift\)\)/, "unresolved stops still carry the shift");
  });

  it("a new glow gets an id that is not in use", () => {
    const m = parseWashFile(CSS);
    const id = nextGlowId(m);
    assert.ok(!m.layers.some((l) => l.kind === "glow" && l.id === id));
  });
});
