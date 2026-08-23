// Run: node --test src/lib/library/character-entry-content.test.ts
//
// SAK-158: derivePosition() is the fallback that labels a radical variant's
// position (top/left/right/bottom/bottom-left) from its bushu kana name when
// the enrichment JSON carries no explicit `position` field. Bushu position
// names are standard Japanese terminology — へん (left), つくり (right),
// かんむり/がしら (top), あし/した (bottom), にょう (bottom-left) — so every
// one of the five must be detected, not just the two (した.../.../がしら,
// かんむり) the function originally checked. The real gap this file guards
// against: 旡 (bushu name むにょう) was falling into the "Alternate" bucket
// instead of being labeled "Bottom Left" because にょう was never checked.

import assert from "node:assert/strict";
import test from "node:test";

import { buildGlyphItem } from "@/lib/content/build-item.ts";
import { characterEntryPayload, derivePosition } from "./character-entry-content.ts";

test("にょう (bottom-left) suffix is detected — the confirmed SAK-158 gap", () => {
  // 旡, bushu name むにょう (radical 71) — the real instance the ticket found
  // mislabeled "Alternate" instead of "Bottom Left".
  assert.equal(derivePosition("むにょう").en, "Bottom Left");
  // 辶, bushu name しんにょう (radical 162) — carries an explicit `position`
  // in the enrichment JSON already, but the name-based fallback must agree.
  assert.equal(derivePosition("しんにょう").en, "Bottom Left");
});

test("へん (left) suffix is detected, including its rendaku (voiced) spelling べん", () => {
  // 扌, bushu name てへん (radical 64) — the unvoiced spelling.
  assert.equal(derivePosition("てへん").en, "Left");
  // 亻, bushu name にんべん (radical 9), and 忄, りっしんべん (radical 61) —
  // both voiced to べん by rendaku after ん, same as real Japanese speech
  // would voice them; the heuristic must catch this spelling too.
  assert.equal(derivePosition("にんべん").en, "Left");
  assert.equal(derivePosition("りっしんべん").en, "Left");
});

test("つくり (right) suffix is detected, including its rendaku (voiced) spelling づくり", () => {
  // 攵, bushu name ぼくづくり (radical 66) — the only real つくり-family
  // variant in the current data, and it's voiced by rendaku.
  assert.equal(derivePosition("ぼくづくり").en, "Right");
  // The unvoiced spelling has no real un-annotated example in the current
  // data (刂's りっとう is a historical exception name that carries no
  // positional suffix at all, so it relies on the enrichment JSON's explicit
  // `position` field rather than this heuristic) — exercised directly here.
  assert.equal(derivePosition("おのつくり").en, "Right");
});

test("かんむり/がしら (top) suffix is detected", () => {
  assert.equal(derivePosition("たけかんむり").en, "Top");
  assert.equal(derivePosition("けいがしら").en, "Top");
});

test("した prefix and あし suffix (bottom) are both detected", () => {
  // 氺, bushu name したみず (radical 85 variant).
  assert.equal(derivePosition("したみず").en, "Bottom");
  // 灬, bushu name れっか (radical 86) carries an explicit position of
  // "ashi" in the enrichment JSON; the suffix form is exercised directly
  // here since no un-annotated variant in the current data ends in あし.
  assert.equal(derivePosition("ひとあし").en, "Bottom");
});

test("a name with none of the five suffixes falls back to Alternate", () => {
  // 麦, bushu name むぎ (radical 199) — a legitimate alternate written form
  // of 麥, not a directional variant, so "Alternate" is the correct label.
  assert.equal(derivePosition("むぎ").en, "Alternate");
  // 刂, bushu name りっとう (radical 18) — a genuine positional variant
  // (right/tsukuri), but its name is a historical exception that carries no
  // positional suffix at all. The name-based fallback can't recover this
  // one; it's correctly labeled "Right" only because the enrichment JSON
  // gives it an explicit `position` field, which `derivePosition` is never
  // consulted for. Documented here so this known exception isn't mistaken
  // for a bug in the heuristic.
  assert.equal(derivePosition("りっとう").en, "Alternate");
});

test("suffix checks don't collide with each other", () => {
  // A name ending in にょう must not also be caught by the あし/した check,
  // and must win over any other suffix that happens to be a substring.
  assert.equal(derivePosition("むにょう").en, "Bottom Left");
  assert.notEqual(derivePosition("むにょう").en, "Bottom");
});

// ---- radicalTip: 勹's single-radical recognition tip (SAK-155) ----
//
// Not a lookalike pair (that's ConfusionSection's `tip`, tested separately in
// entries.test.ts/confusion-section) — this is the "As a radical" block's own
// paragraph, for a radical with a recognisable role but no specific partner to
// contrast against.

test("勹's payload carries its own hand-authored recognition tip", () => {
  const item = buildGlyphItem("勹");
  assert.ok(item, "勹 should build a ContentItem");
  const payload = characterEntryPayload(item!);
  assert.ok(payload.radicalTip, "勹 should have a radicalTip");
  assert.match(payload.radicalTip!, /wrapped around/);
  assert.match(payload.radicalTip!, /包/);
});

test("a radical with no authored tip (口) carries radicalTip: null", () => {
  const item = buildGlyphItem("口");
  assert.ok(item, "口 should build a ContentItem");
  const payload = characterEntryPayload(item!);
  assert.equal(payload.radicalTip, null);
});
