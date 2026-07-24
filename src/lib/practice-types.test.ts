// Run: node --test --experimental-strip-types \
//        --import ./src/lib/conjugate/test-hooks.mjs src/lib/practice-types.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// practice-types.ts adds the TYPE axis to the Practice page and joins it to the
// SCOPE axis. Three things here are decisions a type-check cannot see:
//
//   1. A TYPE is finer than a SUBJECT in exactly two places: `kana` splits by
//      script into hiragana/katakana, and `word` splits into words/counters
//      (the counters track carries subject "word"). factType() must make both
//      cuts and pass every other subject through unchanged.
//
//   2. SCOPE is read off — and written back to — the ordinary Selection fields,
//      so it reuses the app's one definition of "known" and "shaky" rather than
//      inventing a second. scopeOf ∘ withScope must round-trip, carrying types.
//
//   3. The drill is types ∩ scope. Resolved through the real resolve() against a
//      real knowledge base: "everything I know" + hiragana is every KNOWN
//      hiragana and nothing else; "shaky" + kanji is only the shaky kanji.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { KANA_FACTS } from "../data/characters.ts";
import { COUNTER_FACTS } from "../data/counters.ts";
import { GRAMMAR_FACTS } from "../data/grammar/index.ts";
import { KANJI_FACTS } from "../data/kanji.ts";
import { KEIGO_FACTS } from "../data/keigo.ts";
import { RADICAL_FACTS } from "../data/radicals.ts";
import { TRANSITIVITY_FACTS } from "../data/transitivity-facts.ts";
import { VOCAB_FACTS } from "../data/vocab.ts";
import { entryOf } from "./facts.ts";
import { COUNTER_ENTRIES } from "../data/counters.ts";
import {
  availableTypes,
  effectiveScope,
  factType,
  matchesTypes,
  PRACTICE_TYPES,
  pruneEmptyTypes,
  scopeOf,
  toggleType,
  typeLabel,
  withScope,
  withTypes,
} from "./practice-types.ts";
import { emptySelection, resolve } from "./selection.ts";
import type { FactAggregate, FactId, HistoryFile } from "../types/index.ts";

// ---------- pick real representatives of each type ----------

const HIRAGANA = KANA_FACTS.filter((f) => factType(f.id) === "hiragana").map(
  (f) => f.id,
);
const KATAKANA = KANA_FACTS.filter((f) => factType(f.id) === "katakana").map(
  (f) => f.id,
);
const KANJI = KANJI_FACTS.map((f) => f.id);
const COUNTERS = COUNTER_FACTS.map((f) => f.id);
// A vocab fact that is NOT a counter — the "word" type proper.
const PLAIN_WORD = VOCAB_FACTS.find(
  (f) => !COUNTER_ENTRIES.has(entryOf(f.id)),
)!.id;

// ---------- factType: subject → type ----------

describe("factType splits the two subjects that bundle two types", () => {
  test("kana splits by script — every kana is hiragana or katakana", () => {
    assert.ok(HIRAGANA.length > 0 && KATAKANA.length > 0);
    for (const f of KANA_FACTS) {
      const t = factType(f.id);
      assert.ok(t === "hiragana" || t === "katakana", `${f.glyph} → ${t}`);
    }
  });

  test("あ is hiragana, ア is katakana", () => {
    const a = KANA_FACTS.find((f) => f.glyph === "あ")!;
    const ka = KANA_FACTS.find((f) => f.glyph === "ア")!;
    assert.equal(factType(a.id), "hiragana");
    assert.equal(factType(ka.id), "katakana");
  });

  test("a counter is type counter though its SUBJECT is word", () => {
    assert.ok(COUNTERS.length > 0);
    for (const id of COUNTERS) assert.equal(factType(id), "counter");
  });

  test("an ordinary vocab word is type word", () => {
    assert.equal(factType(PLAIN_WORD), "word");
  });
});

describe("factType passes every other subject through 1:1", () => {
  const cases: Array<[FactId, string]> = [
    [RADICAL_FACTS[0].id, "radical"],
    [KANJI_FACTS[0].id, "kanji"],
    [GRAMMAR_FACTS[0].id, "grammar"],
    [TRANSITIVITY_FACTS[0].id, "transitivity"],
    [KEIGO_FACTS[0].id, "keigo"],
  ];
  for (const [id, want] of cases) {
    test(`${want}`, () => assert.equal(factType(id), want));
  }

  test("an unknown id is null, not a guess", () => {
    assert.equal(factType("no:such:fact" as FactId), null);
  });
});

// ---------- the chooser is data ----------

describe("availableTypes offers only types with material, in order", () => {
  test("all nine types have material today", () => {
    assert.deepEqual(availableTypes(), [
      "hiragana",
      "katakana",
      "radical",
      "kanji",
      "word",
      "counter",
      "grammar",
      "transitivity",
      "keigo",
    ]);
  });

  test("every id has a label and a glyph", () => {
    for (const t of PRACTICE_TYPES) {
      assert.equal(typeLabel(t.id), t.label);
      assert.ok(t.glyph.length > 0);
    }
  });
});

// ---------- matchesTypes ----------

describe("matchesTypes: empty means all, else membership", () => {
  test("no types chosen matches everything", () => {
    assert.equal(matchesTypes(HIRAGANA[0], []), true);
    assert.equal(matchesTypes(KANJI[0], []), true);
  });

  test("a chosen set matches only its members", () => {
    assert.equal(matchesTypes(HIRAGANA[0], ["hiragana"]), true);
    assert.equal(matchesTypes(HIRAGANA[0], ["katakana"]), false);
    assert.equal(matchesTypes(KANJI[0], ["hiragana", "kanji"]), true);
  });
});

// ---------- scope round-trips ----------

describe("scope is read off, and written back to, a Selection", () => {
  test("withScope then scopeOf round-trips, carrying types", () => {
    // everything and shaky are self-describing; custom needs a manual pick to be
    // distinguishable from everything (a custom pool with no list/text/rerun IS
    // just everything you know), so it starts from a selection that has a list.
    const bases = {
      everything: withTypes(emptySelection(), ["kanji", "hiragana"]),
      shaky: withTypes(emptySelection(), ["kanji", "hiragana"]),
      custom: {
        ...emptySelection(),
        types: ["kanji", "hiragana"],
        list: "abc",
      },
    };
    for (const scope of ["everything", "shaky", "custom"] as const) {
      const moved = withScope(bases[scope], scope);
      assert.equal(scopeOf(moved), scope);
      assert.deepEqual(moved.types, ["kanji", "hiragana"]);
    }
  });

  test("a list makes the scope custom", () => {
    const sel = { ...emptySelection(), list: "abc" };
    assert.equal(scopeOf(sel), "custom");
  });

  test("toggleType flips one id without touching the rest", () => {
    let sel = withTypes(emptySelection(), ["kanji"]);
    sel = toggleType(sel, "hiragana");
    assert.deepEqual(sel.types.sort(), ["hiragana", "kanji"]);
    sel = toggleType(sel, "kanji");
    assert.deepEqual(sel.types, ["hiragana"]);
  });
});

// ---------- the payload: types ∩ scope, through resolve() ----------

const NOW = Date.UTC(2026, 0, 15);

function solid(): FactAggregate {
  return {
    seen: 4,
    missed: 0,
    slow: 0,
    firstTry: 4,
    correct: 4,
    stability: 10,
    lastTested: NOW,
  };
}

/** A fact you keep getting wrong — first-try accuracy 0%, which is `shaky`. */
function shaky(): FactAggregate {
  return {
    seen: 4,
    missed: 3,
    slow: 0,
    firstTry: 0,
    correct: 1,
    stability: 2,
    lastTested: NOW,
  };
}

function historyOf(
  facts: Record<string, FactAggregate>,
): HistoryFile {
  return { sessions: [], facts, claims: {} };
}

describe("the drill is exactly the chosen types WITHIN the chosen scope", () => {
  const hira = HIRAGANA.slice(0, 5);
  const kata = KATAKANA.slice(0, 5);
  const kanji = KANJI.slice(0, 5);

  test('scope "everything I know" + hiragana → only KNOWN hiragana', () => {
    // Known: 5 hiragana, 5 katakana, 5 kanji — all solid.
    const known: Record<string, FactAggregate> = {};
    for (const id of [...hira, ...kata, ...kanji]) known[id] = solid();
    const h = historyOf(known);

    const sel = withTypes(withScope(emptySelection(), "everything"), [
      "hiragana",
    ]);
    const out = new Set(resolve(sel, h));

    assert.equal(out.size, hira.length, "exactly the known hiragana");
    for (const id of hira) assert.ok(out.has(id), "every known hiragana");
    for (const id of [...kata, ...kanji])
      assert.ok(!out.has(id), "no other type leaks in");
  });

  test("hiragana + radical together is the UNION of those two types", () => {
    const radical = RADICAL_FACTS.slice(0, 4).map((f) => f.id);
    const known: Record<string, FactAggregate> = {};
    for (const id of [...hira, ...kata, ...radical]) known[id] = solid();
    const h = historyOf(known);

    const sel = withTypes(withScope(emptySelection(), "everything"), [
      "hiragana",
      "radical",
    ]);
    const out = new Set(resolve(sel, h));
    assert.equal(out.size, hira.length + radical.length);
    for (const id of [...hira, ...radical]) assert.ok(out.has(id));
    for (const id of kata) assert.ok(!out.has(id));
  });

  test('scope "just the shaky ones" + kanji → only SHAKY kanji', () => {
    const shakyKanji = kanji.slice(0, 3);
    const solidKanji = kanji.slice(3);
    const facts: Record<string, FactAggregate> = {};
    for (const id of shakyKanji) facts[id] = shaky();
    for (const id of solidKanji) facts[id] = solid();
    // A shaky hiragana too — it must be filtered out by the TYPE cut.
    for (const id of hira) facts[id] = shaky();
    const h = historyOf(facts);

    const sel = withTypes(withScope(emptySelection(), "shaky"), ["kanji"]);
    const out = new Set(resolve(sel, h));

    assert.equal(out.size, shakyKanji.length);
    for (const id of shakyKanji) assert.ok(out.has(id), "the shaky kanji");
    for (const id of solidKanji) assert.ok(!out.has(id), "not the solid kanji");
    for (const id of hira) assert.ok(!out.has(id), "not shaky hiragana");
  });

  test("no type chosen keeps the whole scope (all types)", () => {
    const known: Record<string, FactAggregate> = {};
    for (const id of [...hira, ...kata, ...kanji]) known[id] = solid();
    const h = historyOf(known);

    const sel = withScope(emptySelection(), "everything"); // types = []
    const out = resolve(sel, h);
    assert.equal(out.length, hira.length + kata.length + kanji.length);
  });
});

// ---------- bug 1: a scope switch prunes types that go empty ----------

describe("pruneEmptyTypes drops a chosen type absent from the new scope", () => {
  test("a type not in `present` is unselected; the present ones stay", () => {
    const sel = withTypes(emptySelection(), ["hiragana", "radical"]);
    const pruned = pruneEmptyTypes(sel, new Set(["hiragana"]));
    assert.deepEqual(pruned.types, ["hiragana"]);
  });

  test("all present → the very same object, no churn", () => {
    const sel = withTypes(emptySelection(), ["hiragana", "radical"]);
    assert.equal(
      pruneEmptyTypes(sel, new Set(["hiragana", "radical", "kanji"])),
      sel,
    );
  });

  test("only `types` changes — the scope fields are untouched", () => {
    const sel = { ...withScope(emptySelection(), "shaky"), types: ["hiragana", "radical"] };
    const pruned = pruneEmptyTypes(sel, new Set(["hiragana"]));
    assert.deepEqual(pruned.states, sel.states);
    assert.equal(pruned.list, sel.list);
    assert.deepEqual(pruned.types, ["hiragana"]);
  });

  test("the repro: everything→shaky with 0 shaky radicals prunes radical (bug 1)", () => {
    const hira = HIRAGANA.slice(0, 3);
    const radical = RADICAL_FACTS.slice(0, 3).map((f) => f.id);
    const facts: Record<string, FactAggregate> = {};
    for (const id of hira) facts[id] = shaky(); // shaky hiragana remain
    for (const id of radical) facts[id] = solid(); // solid radicals → 0 shaky
    const h = historyOf(facts);

    // Learner picked hiragana + radical under "everything I know".
    const picked = withTypes(withScope(emptySelection(), "everything"), [
      "hiragana",
      "radical",
    ]);
    // Switch to "just the shaky ones".
    const moved = withScope(picked, "shaky");
    const present = new Set(
      availableTypes().filter(
        (id) => resolve(withTypes(moved, [id]), h).length > 0,
      ),
    );
    assert.ok(present.has("hiragana"), "hiragana are shaky → present");
    assert.ok(!present.has("radical"), "no shaky radicals → absent");

    const pruned = pruneEmptyTypes(moved, present);
    assert.deepEqual(pruned.types, ["hiragana"], "radical dropped from the drill");
  });
});

// ---------- bug 2: "pick what I want" can actually be picked ----------

describe("effectiveScope lets 'pick what I want' open with an empty pool (bug 2)", () => {
  test("a bare custom selection is field-identical to everything — the ambiguity", () => {
    const bare = withScope(emptySelection(), "custom");
    assert.equal(scopeOf(bare), "everything");
  });

  test("custom intent wins over that ambiguity so the panel opens", () => {
    const bare = withScope(emptySelection(), "custom");
    assert.equal(effectiveScope(bare, "custom"), "custom");
  });

  test("a self-describing selection ignores a stale intent", () => {
    const listed = { ...emptySelection(), list: "abc" };
    assert.equal(effectiveScope(listed, "everything"), "custom");
    const shakyPool = withScope(emptySelection(), "shaky");
    assert.equal(effectiveScope(shakyPool, "custom"), "shaky");
  });

  test("no intent falls back to the derived scope", () => {
    assert.equal(effectiveScope(emptySelection(), null), "everything");
    assert.equal(effectiveScope({ ...emptySelection(), list: "x" }, null), "custom");
  });
});
