// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/dakuten-rows.test.ts
//
// SAK-72 Part A reads this file's `dakutenRowFor` and `hookRuns` straight into
// the Library page for a derived (dakuten/handakuten) kana — the "Sound shift"
// block on が's own page (KanaEntryView, see its SoundShiftSection). This pins
// the two guarantees that block depends on:
//
//   - dakutenRowFor resolves the right row for a glyph in EVERY one of the
//     five conversions (g, z, d, b, p), in BOTH scripts, and the row's own
//     `pairs` names the correct base for that glyph — the block finds が's か
//     by scanning `pairs`, not by any separate base table that could drift;
//   - the four hookless rows really do carry non-empty aside/callout text (the
//     content the block falls back to when `hook` is ""), and hookRuns parses
//     the one authored hook (k→g) into the bracket/plain runs the block's own
//     accent styling depends on.
//
// getMnemonic/derivedKanaConfusables reuse is covered in mnemonics.test.ts and
// kana-family.test.ts respectively; this file owns only dakuten-rows.ts itself.

import assert from "node:assert/strict";
import test from "node:test";

import { DAKUTEN_ROWS, dakutenRowFor, hookRuns } from "./dakuten-rows.ts";

test("DAKUTEN_ROWS has exactly 5 conversions per script, 25 pairs each", () => {
  const hiragana = DAKUTEN_ROWS.filter((r) => r.setId === "hiragana");
  const katakana = DAKUTEN_ROWS.filter((r) => r.setId === "katakana");
  assert.equal(hiragana.length, 5);
  assert.equal(katakana.length, 5);
  assert.equal(
    hiragana.reduce((n, r) => n + r.pairs.length, 0),
    25,
  );
  assert.equal(
    katakana.reduce((n, r) => n + r.pairs.length, 0),
    25,
  );
});

// One converted glyph per row, per script — the exact set SoundShiftSection has
// to resolve a rule for. base is read straight off `pairs`, matching how
// KanaEntryView finds it (`row.pairs.find(([, converted]) => converted === glyph)`).
const SAMPLES: { glyph: string; base: string; from: string; to: string; mark: "dakuten" | "handakuten" }[] = [
  { glyph: "が", base: "か", from: "k", to: "g", mark: "dakuten" },
  { glyph: "ざ", base: "さ", from: "s", to: "z", mark: "dakuten" },
  { glyph: "だ", base: "た", from: "t", to: "d", mark: "dakuten" },
  { glyph: "ば", base: "は", from: "h", to: "b", mark: "dakuten" },
  { glyph: "ぱ", base: "は", from: "h", to: "p", mark: "handakuten" },
  { glyph: "ガ", base: "カ", from: "k", to: "g", mark: "dakuten" },
  { glyph: "ザ", base: "サ", from: "s", to: "z", mark: "dakuten" },
  { glyph: "ダ", base: "タ", from: "t", to: "d", mark: "dakuten" },
  { glyph: "バ", base: "ハ", from: "h", to: "b", mark: "dakuten" },
  { glyph: "パ", base: "ハ", from: "h", to: "p", mark: "handakuten" },
];

test("dakutenRowFor resolves the right rule and base for one glyph per row, both scripts", () => {
  for (const { glyph, base, from, to, mark } of SAMPLES) {
    const row = dakutenRowFor(glyph);
    assert.ok(row, `expected a row for ${glyph}`);
    assert.equal(row.from, from, `${glyph} should be ${from}→${to}`);
    assert.equal(row.to, to);
    assert.equal(row.markName, mark);
    const found = row.pairs.find(([, converted]) => converted === glyph)?.[0];
    assert.equal(found, base, `${glyph}'s base should be ${base}`);
  }
});

test("dakutenRowFor is null for a base kana and for a glyph the app doesn't teach", () => {
  assert.equal(dakutenRowFor("か"), null);
  assert.equal(dakutenRowFor("あ"), null);
  assert.equal(dakutenRowFor("ん"), null);
  assert.equal(dakutenRowFor("生"), null);
  assert.equal(dakutenRowFor(""), null);
});

test("only k→g has an authored hook; the other four rows carry an aside or callout instead", () => {
  const byConv = Object.fromEntries(
    DAKUTEN_ROWS.filter((r) => r.setId === "hiragana").map((r) => [r.conv, r]),
  );
  assert.ok(byConv.g.hook.length > 0, "k→g should have its authored hook");
  assert.equal(byConv.z.hook, "");
  assert.equal(byConv.d.hook, "");
  assert.equal(byConv.b.hook, "");
  assert.equal(byConv.p.hook, "");

  // The hookless rows' fallback content the SoundShiftSection block renders
  // when `hook` is empty — must be real, non-empty prose, not silently absent.
  assert.ok(byConv.z.callout && byConv.z.callout.length > 0, "s→z should carry its odd-one-out callout");
  assert.ok(byConv.d.callout && byConv.d.callout.length > 0, "t→d should carry its rare-characters callout");
  assert.ok(byConv.p.aside && byConv.p.aside.length > 0, "h→p should carry its two-dash/circle aside");
  // b→ carries neither — the block must render the rule alone for it, not a
  // placeholder; pinned so a future author adding one here is a deliberate
  // decision, not a silent SoundShiftSection regression.
  assert.equal(byConv.b.aside, undefined);
  assert.equal(byConv.b.callout, undefined);
});

test("hookRuns splits the k→g hook into bracket/plain runs, brackets never reaching the page", () => {
  const row = dakutenRowFor("が")!;
  const runs = hookRuns(row.hook);
  assert.ok(runs.length > 0);
  // No literal bracket character survives into any run's text.
  for (const r of runs) {
    assert.doesNotMatch(r.text, /[[\]]/, `run text should not carry brackets: ${r.text}`);
  }
  // At least one hit run for "k" and one for "g" — the two sounds the rule is
  // teaching — each isolated to its own run.
  assert.ok(runs.some((r) => r.hit && r.text === "k"), "expected an isolated [k] run");
  assert.ok(runs.some((r) => r.hit && r.text === "g"), "expected an isolated [g] run");
});

test("hookRuns on an empty hook (the four unauthored rows) yields no runs", () => {
  assert.deepEqual(hookRuns(""), []);
});

// Sam's correction on the k→g hook: only the FIRST k and g were bracketed
// (accented) originally — "The [k]arate kick smashes the [g]arden gate." She
// wants every k and every g accented, so both words each carry two bracket
// pairs now. Pins the corrected string itself, plus hookRuns parsing all four
// pairs into isolated hit runs rather than just the first of each letter.
test("HOOKS.g accents every k and every g, not just the first of each", () => {
  const row = dakutenRowFor("が")!;
  assert.equal(row.hook, "The [k]arate [k]ick smashes the [g]arden [g]ate.");

  const runs = hookRuns(row.hook);
  const kHits = runs.filter((r) => r.hit && r.text === "k");
  const gHits = runs.filter((r) => r.hit && r.text === "g");
  assert.equal(kHits.length, 2, "expected two isolated [k] runs");
  assert.equal(gHits.length, 2, "expected two isolated [g] runs");

  // No literal bracket survives, and the plain text reassembles the sentence.
  for (const r of runs) {
    assert.doesNotMatch(r.text, /[[\]]/, `run text should not carry brackets: ${r.text}`);
  }
  assert.equal(
    runs.map((r) => r.text).join(""),
    "The karate kick smashes the garden gate.",
  );
});
