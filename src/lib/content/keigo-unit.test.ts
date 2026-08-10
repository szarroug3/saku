// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/content/keigo-unit.test.ts

import assert from "node:assert/strict";
import test from "node:test";

import { keigoItems, keigoUnitsOf } from "./keigo-unit.ts";

test("keigoItems — a non-empty list of keigo items builds", () => {
  const items = keigoItems();
  assert.ok(items.length > 0, "enumerates keigo sets");
  assert.ok(
    items.every((i) => i.kind === "keigo"),
    "every item is a keigo item",
  );
});

test("keigoUnitsOf — the 'eat' set yields a populated honorific unit", () => {
  const eat = keigoItems().find((i) => String(i.entry) === "keigo:eat");
  assert.ok(eat, "the eat set is present");
  const [unit] = keigoUnitsOf(eat!);
  assert.equal(unit.kind, "keigo-form");
  assert.equal(unit.form, "召し上がる", "form is the set's primary polite word");
  assert.equal(unit.base, "食べる", "base is the plain verb the set replaces");
  assert.equal(unit.register, "honorific");
  assert.ok(unit.facts.length > 0, "carries the set's fact ids");
  assert.equal(unit.cost, 1);
});

test("keigoUnitsOf — a set with no plain verb defaults base to \"\"", () => {
  const welcome = keigoItems().find((i) => String(i.entry) === "keigo:welcome");
  assert.ok(welcome, "the formulaic welcome set is present");
  const [unit] = keigoUnitsOf(welcome!);
  assert.equal(unit.base, "", "no plain verb → empty base");
  assert.equal(unit.form, "いらっしゃいませ");
});
