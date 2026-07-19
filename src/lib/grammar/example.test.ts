// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/grammar/example.test.ts
//
// WHAT THIS FILE IS GUARDING
// ==========================
// A production fact carries a BAKED ANSWER STRING, built once at module load on
// a fixed representative word. Everything downstream trusts it: the drill grades
// against it when no varied vehicle is available, the entry page prints it, the
// MC options are built beside it. So if the wrong word gets baked, the fact is
// quietly a different question from the one it names — and nothing throws.
//
// That is not hypothetical. 〜ので shipped for months as "行く · 〜ので form" →
// 行くので, i.e. type the word back with ので after it. `isVacuous` exists to
// stop exactly that item and it did its job: 〜ので is not vacuous, because its
// な-adjective half really does conjugate (静か → 静かな). The example builder
// then baked the VERB anyway, being first in the host order, and the one half
// that made the pattern askable was never the half that got asked.
//
// The tests below are that bug as a standing guard, plus the same question asked
// of every other recipe in the table.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { HOST_ORDER, buildExample, primaryHost } from "./example";
import { apply } from "./apply";
import {
  DRILLABLE,
  RECIPES,
  isProducible,
  isTrivialAttachment,
  recipe,
} from "../../data/grammar/recipes";
import { productionHosts } from "@/data/grammar";

const byId = (id: string) => recipe(id)!;

describe("the baked example is a QUESTION, not the word retyped", () => {
  test("no producible recipe bakes its example on a trivial attachment", () => {
    // THE BUG, AS A GUARD. A trivial attachment (bare word or dictionary form,
    // no trim) transforms nothing, so building it is typing. `isVacuous` refuses
    // a recipe where EVERY attachment is like that; this refuses a recipe that
    // has a real one and baked the other.
    for (const r of DRILLABLE) {
      for (const host of productionHosts(r)) {
        const at = r.attach.find((a) => a.host === host);
        assert.ok(at, `${r.id} has a production fact for ${host} and no attachment for it`);
        assert.ok(
          !isTrivialAttachment(at),
          `${r.id}/${host} bakes its production on an attachment that transforms nothing`,
        );
      }
    }
  });

  test("〜ので bakes 静かなので, not the 行くので it used to", () => {
    const ex = buildExample(byId("node"));
    assert.equal(ex?.lemma, "静か");
    assert.equal(ex?.form, "静かなので");
  });

  test("the verb still wins wherever the verb is a question", () => {
    // The fix is "first host that transforms", not "prefer adjectives". 〜ので is
    // the only row in the table where those differ, and every other multi-host
    // pattern must be untouched — including its baked answer, which is a live
    // history key's meaning.
    for (const r of DRILLABLE) {
      const primary = primaryHost(r);
      if (!r.attach.some((a) => a.host === "verb")) continue;
      const verbAt = r.attach.find((a) => a.host === "verb")!;
      if (isTrivialAttachment(verbAt)) continue;
      assert.equal(primary, "verb", `${r.id} moved off the verb host`);
    }
    assert.equal(buildExample(byId("te-kara"))?.form, "行ってから");
    assert.equal(buildExample(byId("sou-appearance"))?.form, "行きそう");
  });

  test("every producible recipe still bakes SOMETHING on its primary host", () => {
    // The old builder walked the host list and could fall through to a later
    // host; this one is told which host to use. A recipe whose primary host
    // refuses would silently lose its production fact — the drill would go
    // quiet on it rather than break, which is the failure that hides longest.
    for (const r of DRILLABLE) {
      assert.ok(buildExample(r), `${r.id} bakes no example at all`);
    }
  });

});

describe("a production fact per HOST, where the hosts are different rules", () => {
  test("the five split patterns carry a fact for each of their hosts", () => {
    const expected: Record<string, string[]> = {
      "sou-appearance": ["verb", "adj-i", "adj-na"],
      sugiru: ["verb", "adj-i", "adj-na"],
      ba: ["verb", "adj-i"],
      tara: ["verb", "adj-i", "adj-na"],
      "te-cause": ["verb", "adj-i", "adj-na"],
    };
    for (const [id, hosts] of Object.entries(expected)) {
      assert.deepEqual(productionHosts(byId(id)), hosts, id);
    }
  });

  test("the two deferring patterns carry ONE, and say who covers the rest", () => {
    // Not an oversight, and the test says so as loudly as the data does: 高くても
    // is te-cause's い → くて plus も. Scoring that rule once per pattern would
    // be three numbers about one skill.
    for (const id of ["te-permission", "te-mo"]) {
      const r = byId(id);
      assert.deepEqual(productionHosts(r), ["verb"], id);
      assert.equal(r.sharedProductionWith, "te-cause");
    }
  });

  test("a deferral names a recipe that really does cover the host", () => {
    // The claim `sharedProductionWith` makes is not "no split here" but "that
    // rule is scored THERE" — so the named recipe has to exist, be producible,
    // and actually carry a fact for every host this row hands off.
    for (const r of RECIPES) {
      if (!r.sharedProductionWith) continue;
      const owner = recipe(r.sharedProductionWith);
      assert.ok(owner, `${r.id} defers to ${r.sharedProductionWith}, which does not exist`);
      assert.ok(isProducible(owner), `${r.id} defers to a recipe with no production facts`);
      const covered = new Set(productionHosts(owner));
      for (const a of r.attach) {
        if (isTrivialAttachment(a) || a.host === primaryHost(r)) continue;
        assert.ok(
          covered.has(a.host),
          `${r.id} hands off its ${a.host} rule to ${owner.id}, which has no ${a.host} fact`,
        );
      }
    }
  });

  test("each host's fact bakes that host's own answer", () => {
    assert.equal(buildExample(byId("sugiru"), "adj-i")?.form, "高すぎる");
    assert.equal(buildExample(byId("sugiru"), "verb")?.form, "行きすぎる");
    assert.equal(buildExample(byId("ba"), "adj-i")?.form, "高ければ");
    assert.equal(buildExample(byId("te-cause"), "adj-na")?.form, "静かで");
  });

  test("no two facts of one pattern bake the same string", () => {
    // Two facts with one answer is one fact scored twice — the thing the split
    // is meant to avoid, arriving from the other direction.
    for (const r of DRILLABLE) {
      const forms = productionHosts(r).map((h) => buildExample(r, h)?.form);
      assert.equal(new Set(forms).size, forms.length, `${r.id} bakes a duplicate answer`);
    }
  });
});

describe("the open case: a な-adjective stem IS its dictionary form", () => {
  test("only these two production answers are the vehicle plus a fixed string", () => {
    // NOT A PASSING GRADE — a standing note in test form, and the reason it is a
    // test is that it is the one thing here nobody can settle by reading code.
    //
    // 静か's `stem` is 静か. So 〜すぎる and 〜そう on a な-adjective build
    // 静かすぎる / 静かそう, which is the word retyped with a fixed string after
    // it — the shape `isVacuous` refuses. They are NOT caught by any gate,
    // because the gates ask about the ATTACHMENT (form: "stem" is not trivial)
    // and this is a property of the WORD.
    //
    // Whether that is still a fair question is a judgement call and not one this
    // file can make: a learner who over-applies な writes 静かなすぎる and is
    // wrong, so the item does discriminate — unlike 本 + だけ, where there is no
    // plausible other answer. It ships as a question on that argument.
    //
    // What this test does is refuse to let the list GROW without someone
    // deciding. A new recipe that lands here is either the same accepted case or
    // a real 〜ので, and the difference is not visible from the diff.
    const retyped: string[] = [];
    for (const r of DRILLABLE) {
      for (const host of productionHosts(r)) {
        const at = r.attach.find((a) => a.host === host)!;
        const ex = buildExample(r, host);
        if (ex && ex.form === ex.lemma + at.add) retyped.push(`${r.id}/${host}`);
      }
    }
    assert.deepEqual(retyped, ["sugiru/adj-na", "sou-appearance/adj-na"]);
  });
});

describe("host order", () => {
  test("HOST_ORDER covers every host any recipe attaches to", () => {
    // The builder and the vehicle pool both walk this list; a host missing from
    // it would be a host no example and no vehicle could ever be found for, and
    // the recipe would just go quiet.
    const used = new Set(RECIPES.flatMap((r) => r.attach.map((a) => a.host)));
    for (const h of used) assert.ok(HOST_ORDER.includes(h), `${h} is not in HOST_ORDER`);
  });

  test("a host a recipe does not take builds nothing", () => {
    assert.equal(buildExample(byId("te-kara"), "adj-i"), null);
    assert.equal(apply(byId("te-kara"), "高い", "adj-i").ok, false);
  });
});
