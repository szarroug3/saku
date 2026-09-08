// A constellation is seeded, so a word is the same shape everywhere; it has
// prerequisites + 1 stars and no more; and a shared piece is one star.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { asteroidShape, bodyOf, hashUnit, isUndiscovered, layoutConstellation, linePaintFor, paintFor, placeConstellation, roleOf, sizeFor, TONIGHT_HALO, type StarLook } from "@/sky/lib/constellation";
import { buildGraph } from "@/sky/lib/graph";
import type { Standing } from "@/sky/lib/standing";
import type { SkyItem } from "@/sky/lib/types";

const item = (id: string, kind: SkyItem["kind"], components?: string[]): SkyItem => ({ id, kind, glyph: id, english: id, standing: "not-seen", components });
const g = buildGraph([
  item("wordA", "word", ["kanjiA", "kanjiB"]),
  item("kanjiA", "kanji", ["radA", "radB"]),
  item("kanjiB", "kanji", ["radA", "radC"]),
  item("radA", "radical"), item("radB", "radical"), item("radC", "radical"),
  item("wordB", "word", ["kanjiA", "kanjiC"]),
  item("kanjiC", "kanji", ["radC"]),
  // a deeper one, like the real data: 時 is 日 and 寺, 寺 is 土 and 寸
  item("時間", "word", ["時", "間"]), item("時", "kanji", ["日", "寺"]), item("寺", "kanji", ["土", "寸"]), item("間", "kanji", ["門", "日"]),
  item("日", "kanji"), item("土", "kanji"), item("寸", "kanji"), item("門", "kanji"),
  item("あ", "kana"),
]);

describe("the constellation layout", () => {
  it("is seeded: the same word is the same shape every time, and two words differ", () => {
    const a = layoutConstellation(g.constellationOf("wordA"));
    assert.deepEqual(a, layoutConstellation(g.constellationOf("wordA")));
    const b = layoutConstellation(g.constellationOf("wordB"));
    assert.notDeepEqual(a.stars.map((s) => [s.x, s.y]), b.stars.map((s) => [s.x, s.y]));
    assert.equal(hashUnit("wordA|base"), hashUnit("wordA|base"));
    assert.ok(hashUnit("x") >= 0 && hashUnit("x") < 1);
  });

  it("has prerequisites + 1 stars, the root at the centre, everything inside the unit box", () => {
    const l = layoutConstellation(g.constellationOf("wordA"));
    assert.equal(l.stars.length, 6);
    assert.deepEqual([l.stars[0].id, l.stars[0].x, l.stars[0].y], ["wordA", 0, 0]);
    assert.ok(l.stars.every((s) => Math.abs(s.x) <= 1 && Math.abs(s.y) <= 1));
    assert.ok(l.stars.some((s) => Math.abs(s.x) === 1 || Math.abs(s.y) === 1), "the farthest star touches the box");
    assert.equal(l.lines.length, 6);
    for (const [i, j] of l.lines) assert.ok(l.stars[j].depth > l.stars[i].depth, "a line runs from a parent to a part");
  });

  it("a shared piece is one star, between the two parents it belongs to, with a line from each", () => {
    const l = layoutConstellation(g.constellationOf("wordA"));
    const at = (id: string) => l.stars.find((s) => s.id === id)!;
    assert.equal(l.stars.filter((s) => s.id === "radA").length, 1);
    const shared = at("radA"), ka = at("kanjiA"), kb = at("kanjiB");
    const d = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
    assert.ok(d(shared, ka) < d(ka, kb) && d(shared, kb) < d(ka, kb), "closer to each parent than the parents are to each other");
    assert.equal(l.lines.filter(([, j]) => l.stars[j].id === "radA").length, 2);
    // the parts of one kanji sit on the far side of it, away from the word
    for (const piece of ["radB"]) assert.ok(d(at(piece), { x: 0, y: 0 }) > d(ka, { x: 0, y: 0 }), `${piece} lies beyond its kanji`);
  });

  it("goes as deep as the data does, each level a little closer", () => {
    const l = layoutConstellation(g.constellationOf("時間"));
    assert.equal(l.stars.length, 8);
    const at = (id: string) => l.stars.find((s) => s.id === id)!;
    assert.equal(at("土").depth, 3);
    const d = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
    assert.ok(d(at("土"), at("寺")) < d(at("寺"), at("時")) + 1e-9 || d(at("寺"), at("時")) < d(at("時"), at("時間")), "reach shrinks with depth");
  });

  it("a kanji-centred shape and a lone star for kana fall out of the same function", () => {
    const k = layoutConstellation(g.constellationOf("kanjiA"));
    assert.deepEqual(k.stars.map((s) => s.id).sort(), ["kanjiA", "radA", "radB"]);
    assert.deepEqual([k.stars[0].id, k.stars[0].x, k.stars[0].y], ["kanjiA", 0, 0]);
    const kana = layoutConstellation(g.constellationOf("あ"));
    assert.deepEqual(kana.stars, [{ id: "あ", depth: 0, x: 0, y: 0 }]);
    assert.deepEqual(kana.lines, []);
    assert.deepEqual(layoutConstellation({ root: "nothing", nodes: [], edges: [] }).stars, []);
  });

  it("placing is the only thing that changes between screens", () => {
    const l = layoutConstellation(g.constellationOf("wordA"));
    const small = placeConstellation(l, 50, 50, 20), big = placeConstellation(l, 500, 300, 200);
    // positions round to hundredths (so the server and the browser agree), hence the tolerance
    for (let i = 0; i < l.stars.length; i++) {
      assert.ok(Math.abs((small[i].px - 50) * 10 - (big[i].px - 500)) < 0.1);
      assert.ok(Math.abs((small[i].py - 50) * 10 - (big[i].py - 300)) < 0.1);
    }
    assert.deepEqual([small[0].px, small[0].py], [50, 50], "the root sits on the centre");
  });

  it("a group draws as its members alone, in a ring, with no star at the centre", () => {
    const row = buildGraph([...["か", "き", "く", "け", "こ"].map((k) => item(k, "kana")), { ...item("row:k", "kana", ["か", "き", "く", "け", "こ"]), group: true }]);
    const layout = layoutConstellation(row.constellationOf("row:k"));
    const root = layout.stars.find((s) => s.id === "row:k")!;
    assert.equal(root.group, true);
    assert.equal(layout.stars.filter((s) => !s.group).length, 5);
    const rootIndex = layout.stars.indexOf(root);
    assert.ok(layout.lines.every(([a, b]) => a !== rootIndex && b !== rootIndex), "nothing points at the centre");
    assert.equal(layout.lines.length, 5, "five members, five links round the ring");
  });

  it("the row a row builds on is a prerequisite, not part of its picture", () => {
    const kana = (s: string) => [...s].map((k) => item(k, "kana"));
    const rows = buildGraph([
      ...kana("はひふへほ"), ...kana("ばびぶべぼ"),
      { ...item("row:h", "kana", [..."はひふへほ"]), group: true },
      { ...item("row:b", "kana", [..."ばびぶべぼ", "row:h"]), group: true },
    ]);
    assert.ok(rows.prerequisitesOf("row:b").includes("row:h"), "still needed");
    const layout = layoutConstellation(rows.constellationOf("row:b"));
    assert.deepEqual(new Set(layout.stars.filter((s) => !s.group).map((s) => s.id)), new Set([..."ばびぶべぼ"]), "only its own sounds are drawn");
    assert.equal(layout.stars.filter((s) => s.group).length, 1);
    assert.equal(layout.lines.length, 5, "one ring of five");
  });

  it("role and size helpers", () => {
    assert.equal(roleOf("word"), "word");
    assert.equal(roleOf("verbPair"), "word");
    assert.equal(roleOf("kanji"), "kanji");
    assert.equal(roleOf("radical"), "piece");
  });

  it("draws each kind as its body", () => {
    assert.equal(bodyOf("word"), "star");
    assert.equal(bodyOf("kana"), "star");
    assert.equal(bodyOf("keigo"), "star");
    assert.equal(bodyOf("grammar"), "planet");
    assert.equal(bodyOf("sentence"), "planet");
    assert.equal(bodyOf("counter"), "asteroid");
    assert.equal(bodyOf("verbPair"), "binary");
  });

  it("gives an asteroid the same lump every time, about the unit circle", () => {
    const a = asteroidShape("counter:x"), b = asteroidShape("counter:x");
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, asteroidShape("counter:y"));
    for (const [x, y] of a) { const r = Math.hypot(x, y); assert.ok(r >= 0.72 && r <= 1.17, `${r}`); }
    assert.equal(sizeFor(6, 48), 48 + 45);
    assert.equal(sizeFor(1, 48), 48);
  });
});

// The look, SAK-338: the stars carry the state, the lines carry the shape.
describe("the paint", () => {
  const star = (standing: Standing, more: Partial<StarLook> = {}): StarLook => ({ role: "word", standing, ...more });

  it("puts the standing in the glow, brightest for solid and none below shaky", () => {
    assert.equal(paintFor(star("solid")).glow, 4);
    assert.equal(paintFor(star("getting-there")).glow, 2.5);
    assert.equal(paintFor(star("shaky")).glow, 1);
    assert.equal(paintFor(star("slipping")).glow, 0);
    assert.equal(paintFor(star("claimed")).glow, 0);
    assert.equal(paintFor(star("not-seen")).glow, 0);
  });

  it("keeps each standing on its own token, and only slipping is dimmed", () => {
    assert.equal(paintFor(star("solid")).fill, "var(--sky-solid)");
    assert.equal(paintFor(star("slipping")).fill, "var(--sky-slipping)");
    assert.equal(paintFor(star("claimed")).fill, "var(--sky-claimed)");
    assert.equal(paintFor(star("not-seen")).fill, "var(--sky-not-seen)");
    for (const s of ["solid", "getting-there", "shaky", "claimed", "not-seen"] as const) {
      assert.equal(paintFor(star(s)).opacity, 1, s);
    }
    assert.equal(paintFor(star("slipping")).opacity, 0.7);
  });

  it("marks slipping by dimming alone: a star going out wears no ring and no dash", () => {
    const p = paintFor(star("slipping"));
    assert.equal(p.ring, undefined);
    assert.equal(p.halo, undefined);
    assert.equal(p.glow, 0);
    for (const s of ["solid", "getting-there", "shaky", "claimed", "not-seen"] as const) {
      assert.equal(paintFor(star(s)).ring, undefined, s);
    }
  });

  it("gives untested a faint halo and undiscovered a bare dot", () => {
    assert.deepEqual(paintFor(star("claimed")).halo, { fill: "var(--sky-star-mid)", grow: 2, opacity: 0.15 });
    const bare = paintFor(star("not-seen"));
    assert.equal(bare.halo, undefined);
    assert.equal(bare.ring, undefined);
    assert.equal(bare.glow, 0);
  });

  it("makes tonight a mark on the star's own paint, not a state of its own", () => {
    const picked = paintFor(star("not-seen", { tonight: true }));
    assert.equal(picked.fill, "var(--sky-not-seen)", "still undiscovered underneath");
    assert.deepEqual(picked.halo, TONIGHT_HALO);
    assert.equal(TONIGHT_HALO.grow, 3);
    // shaky picked for tonight is still shaky, halo and all
    const shaky = paintFor(star("shaky", { tonight: true }));
    assert.equal(shaky.fill, "var(--sky-shaky)");
    assert.equal(shaky.glow, 1);
    assert.deepEqual(shaky.halo, TONIGHT_HALO);
    // and it takes over the untested halo rather than doubling it
    assert.deepEqual(paintFor(star("claimed", { tonight: true })).halo, TONIGHT_HALO);
  });

  it("lets lit and emphasis take the star over", () => {
    assert.equal(paintFor(star("not-seen", { lit: true })).fill, "var(--sky-star)");
    assert.equal(paintFor(star("not-seen", { emphasis: true })).fill, "var(--sky-accent)");
    assert.equal(paintFor(star("solid", { lit: true, emphasis: true })).fill, "var(--sky-accent)");
    assert.equal(paintFor(star("solid", { lit: true, tonight: true })).fill, "var(--sky-star)");
  });

  it("draws every line the same, whichever way round it is read", () => {
    const a = star("solid"), b = star("shaky");
    assert.deepEqual(linePaintFor(a, b), linePaintFor(b, a));
    assert.deepEqual(linePaintFor(a, b), { stroke: "var(--sky-link)", width: 1.25, opacity: 0.8 });
    // a slipping star used to dash the line that pointed at it
    assert.deepEqual(linePaintFor(a, star("slipping")), { stroke: "var(--sky-link)", width: 1.25, opacity: 0.8 });
  });

  it("fades a line into undiscovered ground to fog, from either end", () => {
    const fog = { stroke: "var(--sky-link)", width: 1.25, opacity: 0.35 };
    assert.deepEqual(linePaintFor(star("solid"), star("not-seen")), fog);
    assert.deepEqual(linePaintFor(star("not-seen"), star("solid")), fog);
    assert.deepEqual(linePaintFor(star("not-seen"), star("not-seen")), fog);
    // a picked or opened star is not fog, whatever its standing says
    assert.equal(linePaintFor(star("solid"), star("not-seen", { tonight: true })).opacity, 0.8);
    assert.equal(linePaintFor(star("solid"), star("not-seen", { lit: true })).opacity, 0.8);
    assert.equal(isUndiscovered(star("not-seen")), true);
    assert.equal(isUndiscovered(star("not-seen", { emphasis: true })), false);
  });

  it("gives the accent to a line at the star being shown, and muting beats it", () => {
    assert.deepEqual(linePaintFor(star("solid"), star("shaky", { emphasis: true })), { stroke: "var(--sky-accent)", width: 1.4, opacity: 0.9 });
    assert.deepEqual(linePaintFor(star("solid", { muted: true }), star("shaky")), { stroke: "var(--sky-link)", width: 1.25, opacity: 0.12 });
    assert.equal(linePaintFor(star("solid", { muted: true }), star("shaky", { emphasis: true })).opacity, 0.12);
  });
});
