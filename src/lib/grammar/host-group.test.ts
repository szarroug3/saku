// Run:
//   node --experimental-strip-types --import ./src/lib/conjugate/test-hooks.mjs \
//        --test src/lib/grammar/host-group.test.ts
//
// SAK-192: a multi-host recipe — 〜てもいい (te-permission) attaches to a verb
// AND an い-adjective; 〜て (te-sequence) attaches to a verb AND BOTH
// adjective types — and each host mints its OWN, separately-scheduled
// production FactId (see productionHosts()/buildGrammarFacts() in
// data/grammar/index.ts). Nothing before this pointed the scheduler at that
// relationship, so a length-capped session could show you the verb form of a
// pattern and never the adjective form, even on a day both were due.
//
// This file is the grammar-specific half of the fix: it proves
// `grammarHostGroupOf` reads the right (recipe, host) off a REAL fact id, and
// that wiring it into the REAL scheduler (planSession, dueFacts) — not a
// stand-in — actually keeps a due pair together. budget.test.ts has the
// generic mechanism tests (pairsKept/groupedByPair on synthetic ids); this
// file is the one that runs it on te-permission and te-sequence themselves.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  classProductionFactId,
  patternProductionFactId,
  specialVerbProductionFactId,
} from "@/data/grammar";
import {
  grammarHostGroupOf,
  grammarVehicleBucketOf,
  grammarVehicleSlotOf,
} from "./host-group.ts";
import { planSession } from "@/lib/budget";
import { dueFacts } from "@/lib/selection";
import { rank } from "@/lib/scoring";
import type { FactAggregate, FactId, HistoryFile } from "@/types";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 0, 15);

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, claims: {}, ...over };
}

/**
 * A probe-eligible record at "index" `i` — the same shape budget.test.ts's
 * own "a user-built cap is random" describes as a DEFINITE, monotonic head:
 * i=0 ranks weakest (first), and every i in a small range here (well inside
 * the 0..39 that file already established stays clear of `quiet`/`teach`)
 * ranks in strict i order. Used so this file never has to assert a specific
 * weakness NUMBER — only that two facts placed at different `i` land at
 * different, empirically-checked rank positions.
 */
function state(i: number) {
  return { stability: 50, lastTested: NOW - (40 + i) * DAY };
}

function aggregate(i: number): FactAggregate {
  return { seen: 4, missed: 1, firstTry: 3, correct: 3, ...state(i) };
}

/** Tested moments ago — QUIET, not due. */
function fresh(): FactAggregate {
  return { seen: 4, missed: 0, firstTry: 4, correct: 4, stability: 50, lastTested: NOW };
}

describe("grammarHostGroupOf — the lookup, not a parse", () => {
  test("a verb-class production fact resolves to its recipe and the verb host", () => {
    const fact = classProductionFactId("te-permission", "v5u");
    assert.deepEqual(grammarHostGroupOf(fact), {
      recipeId: "te-permission",
      host: "verb",
    });
  });

  test("a non-verb host fact resolves to its own host, same recipe", () => {
    const fact = patternProductionFactId("te-permission", "adj-i");
    assert.deepEqual(grammarHostGroupOf(fact), {
      recipeId: "te-permission",
      host: "adj-i",
    });
  });

  test("a MEANING fact — not a production fact — is not a host group", () => {
    assert.equal(grammarHostGroupOf("grammar:te-permission/meaning" as FactId), null);
  });

  test("a fact from another subject entirely is not a host group", () => {
    assert.equal(grammarHostGroupOf("kana:あ/reading" as FactId), null);
  });
});

describe("planSession keeps a 2-host recipe's due pair together (te-permission: verb + adj-i)", () => {
  const verbFact = classProductionFactId("te-permission", "v5u");
  const adjFact = patternProductionFactId("te-permission", "adj-i");

  test("both due, a tight length cap: the fix pulls the sibling in", () => {
    const solo: FactId[] = Array.from({ length: 8 }, (_, i) => `solo:${i}` as FactId);
    const ids = [...solo, verbFact, adjFact]; // i = 0..9, in this order
    const facts: Record<string, FactAggregate> = {};
    ids.forEach((id, i) => {
      facts[id] = aggregate(i);
    });
    const h = history({ facts: facts as HistoryFile["facts"] });

    // Ground truth: where do the two hosts actually fall in the unpaired
    // weakness order? Computed, not assumed — see `state`'s doc comment.
    const naturalOrder = rank(
      { facts: ids.map((id, i) => ({ id, state: state(i) })) },
      NOW,
    );
    const ia = naturalOrder.indexOf(verbFact);
    const ib = naturalOrder.indexOf(adjFact);
    assert.notEqual(ia, -1);
    assert.notEqual(ib, -1);
    assert.notEqual(ia, ib, "test setup: the pair must not tie in rank");
    const length = Math.min(ia, ib) + 1;
    assert.ok(
      Math.max(ia, ib) >= length,
      "test setup: this length must actually split the pair",
    );

    const unpaired = planSession({ candidates: ids, history: h, length, now: NOW });
    // The premise this test exists to demonstrate a fix for: unpatched, the
    // cap really does separate the pair.
    assert.notDeepEqual(
      new Set([verbFact, adjFact].filter((f) => unpaired.probe.includes(f))),
      new Set([verbFact, adjFact]),
      "test setup: baseline must actually split the pair",
    );

    const paired = planSession({
      candidates: ids,
      history: h,
      length,
      now: NOW,
      hostGroupOf: grammarHostGroupOf,
    });
    assert.ok(paired.probe.includes(verbFact), "the verb host should still be in");
    assert.ok(paired.probe.includes(adjFact), "the adjective host should ride along");
    assert.equal(paired.probe.length, length, "still honours the requested length");
  });

  test("only one host due: the fix does not force the other one in", () => {
    // The resolved policy question: the verb is genuinely due, the adjective
    // was tested moments ago (QUIET). Pairing never reaches past what the SRS
    // itself already called due — see budget.ts's `pairsKept` doc comment.
    const facts: Record<string, FactAggregate> = {
      [verbFact]: aggregate(0),
      [adjFact]: fresh(),
    };
    const h = history({ facts: facts as HistoryFile["facts"] });
    const plan = planSession({
      candidates: [verbFact, adjFact],
      history: h,
      length: 10,
      now: NOW,
      hostGroupOf: grammarHostGroupOf,
    });
    assert.deepEqual(plan.probe, [verbFact]);
    assert.ok(!plan.teach.includes(adjFact), "not-due is not re-routed into teach either");
    assert.equal(plan.probe.length + plan.teach.length, 1, "nothing was injected");
  });

  test("dueFacts (the uncapped one-click pool) already has both, sitting together", () => {
    const h = history({
      facts: {
        [verbFact]: aggregate(0),
        [adjFact]: aggregate(3),
      } as HistoryFile["facts"],
    });
    const due = dueFacts(h, [], NOW);
    assert.ok(due.includes(verbFact));
    assert.ok(due.includes(adjFact));
    const ia = due.indexOf(verbFact);
    const ib = due.indexOf(adjFact);
    assert.equal(Math.abs(ia - ib), 1, "siblings should sit next to each other");
  });
});

describe("planSession generalises past two hosts (te-sequence: verb + adj-i + adj-na)", () => {
  const verbFact = classProductionFactId("te-sequence", "v5u");
  const adjIFact = patternProductionFactId("te-sequence", "adj-i");
  const adjNaFact = patternProductionFactId("te-sequence", "adj-na");

  test("all three hosts land in a length-capped session when all three are due", () => {
    const solo: FactId[] = Array.from({ length: 6 }, (_, i) => `solo3:${i}` as FactId);
    // Spread across the range, not clustered — verbFact at i=0 (best),
    // adjIFact in the middle, adjNaFact at the tail end of a 9-item pool, so
    // a length-3 cut cannot accidentally reach all three without the fix.
    const ordered = [verbFact, ...solo.slice(0, 4), adjIFact, ...solo.slice(4), adjNaFact];
    const facts: Record<string, FactAggregate> = {};
    ordered.forEach((id, i) => {
      facts[id] = aggregate(i);
    });
    const h = history({ facts: facts as HistoryFile["facts"] });

    const length = 3;
    const unpaired = planSession({ candidates: ordered, history: h, length, now: NOW });
    const unpairedHosts = [verbFact, adjIFact, adjNaFact].filter((f) =>
      unpaired.probe.includes(f),
    );
    assert.ok(
      unpairedHosts.length < 3,
      "test setup: a length-3 cut must not naturally carry every host",
    );

    const paired = planSession({
      candidates: ordered,
      history: h,
      length,
      now: NOW,
      hostGroupOf: grammarHostGroupOf,
    });
    assert.ok(paired.probe.includes(verbFact));
    assert.ok(paired.probe.includes(adjIFact));
    assert.ok(paired.probe.includes(adjNaFact));
    assert.equal(paired.probe.length, length);
  });
});

// SAK-203: grammarHostGroupOf (above) stopped being fine-grained enough the
// day production split per conjugation class — see host-group.ts's own
// "SAK-203: vehicle coverage" section for the full "why". These tests prove
// the two new lookups read the right thing off REAL fact ids; the buildDeck
// integration tests (engine/build-deck-grammar.test.ts) prove wiring them
// into pairsKept/spreadGrammarVehicles actually fixes the reported bug.

describe("grammarVehicleBucketOf — the cross-recipe vehicle identity", () => {
  test("the same conjugation CLASS, on different recipes, is the same bucket", () => {
    const teKaraV5u = classProductionFactId("te-kara", "v5u");
    const teRequestV5u = classProductionFactId("te-request", "v5u");
    const a = grammarVehicleBucketOf(teKaraV5u);
    const b = grammarVehicleBucketOf(teRequestV5u);
    assert.ok(a !== null);
    assert.equal(a, b, "one conjugation class draws the same word regardless of recipe");
  });

  test("the same irregular WORD, on different recipes, is the same bucket — SAK-203 example 1", () => {
    // te-kara ("after 行く"), te-request ("please 行く"), te-prohibition
    // ("must not 行く") — Sam's own reported three-in-a-row.
    const iku1 = specialVerbProductionFactId("te-kara", "iku");
    const iku2 = specialVerbProductionFactId("te-request", "iku");
    const iku3 = specialVerbProductionFactId("te-prohibition", "iku");
    const keys = [iku1, iku2, iku3].map(grammarVehicleBucketOf);
    assert.ok(keys.every((k) => k !== null));
    assert.equal(new Set(keys).size, 1, "all three recipes' @iku fact share one bucket");
  });

  test("different classes of the SAME recipe are different buckets", () => {
    const v5u = grammarVehicleBucketOf(classProductionFactId("te-kara", "v5u"));
    const v5m = grammarVehicleBucketOf(classProductionFactId("te-kara", "v5m"));
    assert.ok(v5u !== null && v5m !== null);
    assert.notEqual(v5u, v5m);
  });

  test("a class bucket and an irregular-word bucket never collide, even by string accident", () => {
    // v5k's class key is "verb:v5k"; there is no irregular word literally
    // named "v5k", so this is really asserting the "kind" tag is load-bearing
    // rather than incidental — a future irregular surface could not
    // coincide with a class name and silently merge two unrelated slots.
    const v5k = grammarVehicleBucketOf(classProductionFactId("te-kara", "v5k"));
    const iku = grammarVehicleBucketOf(specialVerbProductionFactId("te-kara", "iku"));
    assert.notEqual(v5k, iku);
  });

  test("a MEANING fact is not a vehicle bucket", () => {
    assert.equal(grammarVehicleBucketOf("grammar:te-kara/meaning" as FactId), null);
  });

  test("a fact from another subject entirely is not a vehicle bucket", () => {
    assert.equal(grammarVehicleBucketOf("kana:あ/reading" as FactId), null);
  });
});

describe("grammarVehicleSlotOf — pairsKept's finer-grained coverage key", () => {
  test("two classes of ONE recipe are two different slots — both worth keeping", () => {
    const v5u = grammarVehicleSlotOf(classProductionFactId("te-kara", "v5u"));
    const v5m = grammarVehicleSlotOf(classProductionFactId("te-kara", "v5m"));
    assert.ok(v5u && v5m);
    assert.notDeepEqual(v5u, v5m);
    assert.equal(v5u.recipeId, "te-kara");
    assert.equal(v5m.recipeId, "te-kara");
  });

  test("the same class on two different recipes is still two different slots — coverage is per recipe", () => {
    const teKara = grammarVehicleSlotOf(classProductionFactId("te-kara", "v5u"));
    const teRequest = grammarVehicleSlotOf(classProductionFactId("te-request", "v5u"));
    assert.ok(teKara && teRequest);
    assert.notDeepEqual(teKara, teRequest);
    assert.notEqual(teKara.recipeId, teRequest.recipeId);
  });

  test("a non-production fact is not a slot", () => {
    assert.equal(grammarVehicleSlotOf("grammar:te-kara/meaning" as FactId), null);
  });
});
