// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/how-it-works.test.ts
//
// Pins the two things a reviewer actually checked in SAK-27: the section order
// (owner's explicit ask) and that the em-dash sweep actually happened. Also
// spot-checks a few facts that were fact-checked against code before shipping,
// so a later edit can't silently reintroduce the "trusts you" framing or drop
// the Settings claim without a test noticing.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { HOW_IT_WORKS_SECTIONS } from "./how-it-works";

function allText(): string[] {
  const out: string[] = [];
  for (const s of HOW_IT_WORKS_SECTIONS) {
    out.push(s.title, ...s.paragraphs);
    for (const b of s.bullets ?? []) out.push(b.label, b.body);
    out.push(...(s.afterBullets ?? []));
  }
  return out;
}

describe("how-it-works section order", () => {
  test("SRS, then the claim buttons, then progress words, per the owner's review", () => {
    const ids = HOW_IT_WORKS_SECTIONS.map((s) => s.id);
    assert.deepEqual(ids.slice(0, 3), ["srs", "already-know", "progress-words"]);
  });

  test("rounds/breaks and pause-vs-end come after the required three, and every id is unique", () => {
    const ids = HOW_IT_WORKS_SECTIONS.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.includes("rounds-breaks"));
    assert.ok(ids.includes("pause-end"));
    assert.ok(ids.indexOf("rounds-breaks") > ids.indexOf("progress-words"));
    assert.ok(ids.indexOf("pause-end") > ids.indexOf("progress-words"));
  });

  test("no section is empty of content", () => {
    for (const s of HOW_IT_WORKS_SECTIONS) {
      const hasContent = s.paragraphs.length > 0 || (s.bullets?.length ?? 0) > 0;
      assert.ok(hasContent, `section '${s.id}' has no paragraphs or bullets`);
    }
  });
});

describe("no em dashes anywhere in the copy", () => {
  test("the owner's explicit instruction: rewrite with commas, periods, colons instead", () => {
    for (const text of allText()) {
      assert.ok(!text.includes("—"), `em dash found in: "${text}"`);
    }
  });
});

describe("fact-checked claims stay in the copy", () => {
  test("the SRS section names spaced repetition explicitly", () => {
    const srs = HOW_IT_WORKS_SECTIONS.find((s) => s.id === "srs")!;
    const text = srs.paragraphs.join(" ");
    assert.match(text, /spaced repetition/i);
    assert.match(text, /SRS/);
  });

  test("the slipping claim survives (it is TRUE — standing.ts + budget.ts)", () => {
    const srs = HOW_IT_WORKS_SECTIONS.find((s) => s.id === "srs")!;
    const text = srs.paragraphs.join(" ");
    assert.match(text, /slipped/i);
    assert.match(text, /re-teaches/i);
  });

  test("the Claimed bullet is factual, not framed as Saku trusting the learner", () => {
    const progress = HOW_IT_WORKS_SECTIONS.find((s) => s.id === "progress-words")!;
    const claimed = progress.bullets!.find((b) => b.label === "Claimed")!;
    assert.ok(!/trust/i.test(claimed.body), "Claimed bullet still frames this as trust");
    assert.ok(!/for now/i.test(claimed.body), "Claimed bullet still carries the 'for now' framing");
    assert.match(claimed.body, /untested/i);
  });

  test("solid requires real test results, never a claim alone", () => {
    const progress = HOW_IT_WORKS_SECTIONS.find((s) => s.id === "progress-words")!;
    const solid = progress.bullets!.find((b) => b.label === "Solid")!;
    assert.match(solid.body, /8 of your last 10/);
    assert.match(solid.body, /claim alone can never make something solid/i);
  });

  test("the Settings break-time claim is present (confirmed true: settings-card.tsx renders it)", () => {
    const rounds = HOW_IT_WORKS_SECTIONS.find((s) => s.id === "rounds-breaks")!;
    const text = rounds.paragraphs.join(" ");
    assert.match(text, /5 minutes before round 2/);
    assert.match(text, /10 minutes before round 3/);
    assert.match(text, /adjustable in Settings/);
  });

  test("pause vs end session names the real button labels", () => {
    const pauseEnd = HOW_IT_WORKS_SECTIONS.find((s) => s.id === "pause-end")!;
    const labels = pauseEnd.bullets!.map((b) => b.label);
    assert.deepEqual(labels, ["Pause", "End session"]);
  });
});
