// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/questions.test.ts
//
// The tests that matter here are the NEGATIVE ones. This module's job is to
// refuse — to not ship an item whose answer isn't uniquely determined — so
// most of what follows asserts that something does NOT get generated.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { BLANK, isValidDistractor, production, selection, selectableRecipes } from "./questions";
import { CORPUS, CORPUS_META, SCARCE, coverage, examplesFor, isReadable } from "../../data/grammar/corpus";
import { RECIPES, isVacuous, recipe } from "../../data/grammar/recipes";

describe("PRODUCTION — naming the target destroys the ambiguity", () => {
  test("one word, one pattern, exactly one answer", () => {
    const q = production("te-kara", "食べる", "v1");
    assert.ok(q);
    assert.equal(q.answer, "食べてから");
    assert.equal(q.pattern, "〜てから");
  });

  test("the 音便 comes free — this is why it beats a flashcard deck", () => {
    assert.equal(production("te-kara", "読む", "v5m")?.answer, "読んでから");
    assert.equal(production("te-kara", "行く", "v5k-s")?.answer, "行ってから");
  });

  test("VACUOUS recipes produce no question at all", () => {
    // "give me the は form of 私" is typing, not a question.
    assert.equal(production("wa-yori", "私", null as never), null);
    assert.equal(production("koto-ga-dekiru", "食べる", "v1"), null);
    assert.equal(production("mae-ni", "食べる", "v1"), null);
  });

  test("a recipe that can't apply produces no question", () => {
    assert.equal(production("te-kara", "高い", "adj-i"), null);
    assert.equal(production("potential", "ある", "v5r-i"), null); // defective
  });

  test("no production question ever echoes its own prompt", () => {
    for (const r of RECIPES) {
      const q = production(r.id, "食べる", "v1");
      if (q) assert.notEqual(q.answer, q.lemma, `${r.id} echoed the prompt`);
    }
  });
});

describe("SELECTION — the distractor rules are the safety argument", () => {
  test("same gloss is never a distractor, so a cluster can't fight itself", () => {
    // All seven obligation patterns gloss "must do X". This is the test that
    // makes the cluster design pay for itself.
    const a = recipe("nakereba-naranai")!;
    for (const id of ["nakya", "nakucha", "nakute-wa-ikenai", "nai-to-ikenai"]) {
      assert.equal(isValidDistractor(a, recipe(id)!), false, `${id} must not fight ${a.id}`);
    }
  });

  test("the PREFIX test kills the false competitors the gloss test misses", () => {
    // 馬が亡くなって鞍が淋しい is grammatical, so bare て is a RIGHT answer in a
    // てから frame despite the glosses differing. This is the bug that was
    // found by printing an item rather than trusting the count.
    assert.equal(isValidDistractor(recipe("te-kara")!, recipe("te-sequence")!), false);
    assert.equal(isValidDistractor(recipe("te-kara")!, recipe("te-cause")!), false);
    // Same shape: ても is a truncation of てもいい and てもらう.
    assert.equal(isValidDistractor(recipe("te-permission")!, recipe("te-mo")!), false);
    assert.equal(isValidDistractor(recipe("te-morau")!, recipe("te-mo")!), false);
  });

  test("a distractor that can't attach to the same host is rejected", () => {
    // 〜ながら takes a verb; だけ takes a noun. Offering だけ is a giveaway.
    assert.equal(isValidDistractor(recipe("nagara")!, recipe("dake")!), false);
  });

  test("a recipe is never its own distractor", () => {
    for (const r of RECIPES) assert.equal(isValidDistractor(r, r), false);
  });

  test("PARTICLES ship on an allowlist, in either role", () => {
    // kara-source is a particle NOT on the allowlist — neither side may use it.
    assert.equal(isValidDistractor(recipe("wo")!, recipe("kara-source")!), false);
    assert.equal(isValidDistractor(recipe("kara-source")!, recipe("wo")!), false);
    // shika-nai likewise.
    assert.equal(isValidDistractor(recipe("wo")!, recipe("shika-nai")!), false);
  });

  test("は and が cannot reach a selection item because they do not exist", () => {
    // The strongest form of the guarantee: not a filter, an absence. Nothing
    // downstream can generate what has no row.
    for (const r of RECIPES) {
      assert.ok(r.pattern !== "は" && r.pattern !== "が");
    }
    for (const q of CORPUS.slice(0, 2000).flatMap((ex) => ex.p.map((p) => selection(ex, p)))) {
      if (!q) continue;
      for (const c of q.choices) assert.ok(c.pattern !== "は" && c.pattern !== "が");
    }
  });
});

describe("SELECTION — the item itself", () => {
  const item = examplesFor("te-kara")
    .map((ex) => selection(ex, "te-kara"))
    .find((q) => q !== null);

  test("the frame actually contains a blank", () => {
    assert.ok(item, "no te-kara item was generated at all");
    assert.ok(item.frame.includes(BLANK), `frame has no blank: ${item.frame}`);
  });

  test("the blank swallows the host verb, and the prompt gives it back", () => {
    // A blank starting after 亡くなっ has already revealed the て-form.
    assert.ok(item);
    assert.ok(item.host, "an item whose blank ate the verb must name it");
    assert.ok(!item.frame.includes(item.host), "the frame must not contain the answer's verb");
  });

  test("the answer is among the choices exactly once", () => {
    assert.ok(item);
    assert.equal(item.choices.filter((c) => c.id === item.answerId).length, 1);
  });

  test("no two choices share a gloss", () => {
    assert.ok(item);
    const glosses = item.choices.map((c) => c.gloss);
    assert.equal(new Set(glosses).size, glosses.length);
  });

  test("every generated item, across the whole corpus, is internally sound", () => {
    let n = 0;
    for (const ex of CORPUS) {
      for (const p of ex.p) {
        const q = selection(ex, p);
        if (!q) continue;
        n++;
        assert.ok(q.frame.includes(BLANK), `${q.sourceId}: no blank`);
        assert.ok(q.en.length > 0, `${q.sourceId}: no english`);
        const g = q.choices.map((c) => c.gloss);
        assert.equal(new Set(g).size, g.length, `${q.sourceId}: duplicate gloss`);
        assert.equal(new Set(q.choices.map((c) => c.id)).size, q.choices.length);
        assert.ok(q.choices.some((c) => c.id === q.answerId), `${q.sourceId}: answer not offered`);
      }
    }
    assert.ok(n > 1000, `only ${n} items — the generator has stopped working`);
  });

  test("a sentence matching several patterns is refused, not guessed at", () => {
    const multi = CORPUS.find((ex) => ex.p.length > 1);
    assert.ok(multi);
    for (const p of multi.p) assert.equal(selection(multi, p), null);
  });
});

describe("the corpus knows what it doesn't have", () => {
  test("scarcity was predicted and is confirmed by the data", () => {
    const byId = new Map(SCARCE.map((s) => [s.id, s.n]));
    // Predicted before the corpus existed: learners write 、where a textbook
    // writes で. 8 raw matches in 232,666 sentences; none survived the filters.
    assert.equal(byId.get("ta-ato-de"), 0);
    assert.ok(CORPUS_META.perPatternBeforeCap["ta-ato-de"] === 0);
  });

  test("tari-tari is thin for a structural reason, and needs two verbs", () => {
    // MIN_HITS in the ingest requires two たり; the token filter then bites.
    assert.ok(CORPUS_META.perPattern["tari-tari"] < 40);
  });

  test("every recipe without a signature says why", () => {
    for (const [id, reason] of Object.entries(CORPUS_META.noSignature)) {
      assert.ok(recipe(id), `noSignature names unknown recipe '${id}'`);
      // Two shapes are allowed, and nothing else:
      //   a real explanation, or
      //   a cross-reference to the row that carries it ("See `potential`.")
      // The cross-reference is not laziness — passive and potential share ONE
      // reason (the tagger cannot split them), and writing it twice is how the
      // two copies start disagreeing. But it must point somewhere real.
      const xref = /^See `([\w-]+)`\.$/.exec(reason);
      if (xref) {
        assert.ok(recipe(xref[1]), `${id}: cross-refs unknown recipe '${xref[1]}'`);
        assert.ok(
          CORPUS_META.noSignature[xref[1]],
          `${id}: cross-refs '${xref[1]}', which HAS a signature`,
        );
      } else {
        assert.ok(reason.length > 20, `${id}: a reason must be a reason`);
      }
    }
  });

  test("potential and passive are unmatched on purpose — the tagger can't split them", () => {
    assert.ok(CORPUS_META.noSignature["potential"]);
    assert.ok(CORPUS_META.noSignature["passive"]);
    assert.equal(examplesFor("potential").length, 0);
  });

  test("no corpus sentence exceeds the token filter", () => {
    for (const ex of CORPUS) assert.ok(ex.n <= CORPUS_META.maxTokens, `${ex.id}: ${ex.n} tokens`);
  });

  test("every corpus sentence has a span for each pattern it claims", () => {
    for (const ex of CORPUS) {
      for (const p of ex.p) {
        const sp = ex.sp[p];
        assert.ok(sp, `${ex.id} claims ${p} with no span`);
        const [s, e] = sp;
        assert.ok(s >= 0 && e > s && e <= ex.jp.length, `${ex.id}: bad span for ${p}`);
      }
    }
  });
});

describe("vocabulary coverage is a RUNTIME question", () => {
  test("coverage is computed against the caller's known set", () => {
    const ex = CORPUS.find((e) => e.v.length >= 2)!;
    assert.equal(coverage(ex, new Set()), 0);
    assert.equal(coverage(ex, new Set(ex.v)), 1);
    assert.ok(isReadable(ex, new Set(ex.v)));
    assert.ok(!isReadable(ex, new Set()));
  });

  test("a sentence with no content words is readable by definition", () => {
    assert.equal(coverage({ id: 0, jp: "", en: "", n: 0, v: [], p: [], sp: {} }, new Set()), 1);
  });
});

describe("the shipped numbers are computed, never quoted", () => {
  test("selectable recipes are measured from the data", () => {
    const sel = selectableRecipes();
    // The brief put this at ~46% AS A PATTERN PROPERTY. It is not one — it is
    // a property of (pattern x sentence x distractors), and we own two of the
    // three. Measured here, it is higher. Assert only that it is a real,
    // non-degenerate number, so this test doesn't rot on every data change.
    assert.ok(sel.length > 0.4 * RECIPES.length, `only ${sel.length} selectable`);
    assert.ok(sel.length <= RECIPES.length);
  });

  test("vacuity is a third of the table, and that is a finding not a bug", () => {
    const vac = RECIPES.filter(isVacuous).length;
    assert.ok(vac > 0);
    assert.ok(vac < RECIPES.length / 2);
  });
});
