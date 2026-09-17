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
  test("the three scripts first (SAK-436), then SRS, the claim buttons and progress words, per the owner's reviews", () => {
    const ids = HOW_IT_WORKS_SECTIONS.map((s) => s.id);
    assert.deepEqual(ids.slice(0, 4), ["scripts", "srs", "already-know", "progress-words"]);
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

  // SAK-456, Sam: "those rounds/breaks are intended to be a form of SRS. the
  // two are connected." Each section says so about the other.
  test("the SRS section talks about the rounds and breaks, and the rounds section names SRS", () => {
    const srs = HOW_IT_WORKS_SECTIONS.find((s) => s.id === "srs")!.paragraphs.join(" ");
    assert.match(srs, /three rounds/);
    assert.match(srs, /break/);
    assert.match(srs, /5 minutes and then 10/);
    const rounds = HOW_IT_WORKS_SECTIONS.find((s) => s.id === "rounds-breaks")!.paragraphs.join(" ");
    assert.match(rounds, /spaced repetition \(SRS\)/);
  });

  // SAK-442, Sam: "i do not want the lesson to reteach it. i want it to appear
  // in the practice as 'slipping' so people can practice it but not be forced
  // to relearn it." The page said the opposite, and the app never did it, so
  // the page is what changed. The rule itself is held by "a met item that has
  // slipped" in src/app/(sky)/observatory.test.ts.
  test("the slipping claim says what the app does: a standing, not a lesson over again", () => {
    const srs = HOW_IT_WORKS_SECTIONS.find((s) => s.id === "srs")!;
    const text = srs.paragraphs.join(" ");
    assert.match(text, /slipped/i);
    assert.match(text, /Slipping/);
    assert.match(text, /doesn't send you back through its lesson/i);
    for (const promise of [/re-?teach/i, /learn(ed)? again/i, /relearn/i]) {
      assert.ok(!promise.test(text), `the SRS section promises to teach a slipped thing again: ${promise}`);
    }
  });

  test("the Slipping standing says it is never put back on the list of things to learn", () => {
    const progress = HOW_IT_WORKS_SECTIONS.find((s) => s.id === "progress-words")!;
    const slipping = progress.bullets!.find((b) => b.label === "Slipping")!;
    assert.match(slipping.body, /never put back on the list of things to learn/i);
    assert.match(slipping.body, /Practice/);
  });

  test("the Untested bullet is factual, not framed as Saku trusting the learner", () => {
    const progress = HOW_IT_WORKS_SECTIONS.find((s) => s.id === "progress-words")!;
    const claimed = progress.bullets!.find((b) => b.label === "Untested")!;
    assert.ok(!/trust/i.test(claimed.body), "Untested bullet still frames this as trust");
    assert.ok(!/for now/i.test(claimed.body), "Untested bullet still carries the 'for now' framing");
    assert.match(claimed.body, /untested/i);
    // the rotation model (Sam, 2026-09-06): opened in a lesson is in rotation, untested
    assert.match(claimed.body, /opened it in a lesson/i);
  });

  test("solid requires real test results, never a claim alone", () => {
    const progress = HOW_IT_WORKS_SECTIONS.find((s) => s.id === "progress-words")!;
    const solid = progress.bullets!.find((b) => b.label === "Solid")!;
    assert.match(solid.body, /8 of your last 10/);
    assert.match(solid.body, /claim alone can never make something solid/i);
  });

  test("the break-time claim is present (confirmed true: the rest screen carries the stepper)", () => {
    const rounds = HOW_IT_WORKS_SECTIONS.find((s) => s.id === "rounds-breaks")!;
    const text = rounds.paragraphs.join(" ");
    assert.match(text, /5 minutes before round 2/);
    assert.match(text, /10 minutes before round 3/);
    assert.match(text, /adjustable on the break screen itself/);
  });

  test("leaving a quiz names the real button labels", () => {
    const pauseEnd = HOW_IT_WORKS_SECTIONS.find((s) => s.id === "pause-end")!;
    const labels = pauseEnd.bullets!.map((b) => b.label);
    assert.deepEqual(labels, ["End the quiz", "Back to the observatory"]);
  });
});
