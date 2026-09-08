// The Sky's standings are the app's: the same six words, and a decision table
// that agrees with src/lib/library/standing.ts on every scenario.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isInSky, isKnown, needsWork, STANDING, STANDING_ORDER, standingOf, standingWord, type Standing, type StandingEvidence } from "@/sky/lib/standing";

// The ONE place Sky code reaches into the app, and it is a test: the point of
// the Sky's copy of the decision table is that it says what the app says, and
// only the original can prove that. Nothing at runtime follows this import;
// it goes when the original does, at cutover.
/* eslint-disable no-restricted-imports */
import { effectiveState } from "@/lib/claims";
import { recentRunAccuracy, standingOf as appStandingOf } from "@/lib/library/standing";
import { status } from "@/lib/scoring";
import type { FactAggregate } from "@/types";
/* eslint-enable no-restricted-imports */

const NOW = Date.UTC(2026, 8, 4);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const ev = (partial: Partial<StandingEvidence>): StandingEvidence => ({ seen: 0, recall: "teach", recentAccuracy: null, ...partial });

describe("standingOf, the Sky's copy of the app's decision", () => {
  it("never asked is not seen; a fresh claim is claimed; a decayed claim is not seen again", () => {
    assert.equal(standingOf(ev({})), "not-seen");
    assert.equal(standingOf(ev({ recall: "quiet", claimedAt: NOW - DAY })), "claimed");
    assert.equal(standingOf(ev({ recall: "teach", claimedAt: NOW - 400 * DAY })), "not-seen");
  });

  it("solid needs the verdict and the record; the record alone picks the lesser words", () => {
    assert.equal(standingOf(ev({ seen: 10, recall: "quiet", recentAccuracy: 90, lastTested: NOW - HOUR })), "solid");
    assert.equal(standingOf(ev({ seen: 10, recall: "quiet", recentAccuracy: 80, lastTested: NOW - HOUR })), "solid", "80 is the floor");
    assert.equal(standingOf(ev({ seen: 10, recall: "quiet", recentAccuracy: 79, lastTested: NOW - HOUR })), "getting-there");
    assert.equal(standingOf(ev({ seen: 10, recall: "quiet", recentAccuracy: 60, lastTested: NOW - HOUR })), "getting-there", "60 is the floor");
    assert.equal(standingOf(ev({ seen: 10, recall: "quiet", recentAccuracy: 59, lastTested: NOW - HOUR })), "shaky");
    assert.equal(standingOf(ev({ seen: 10, recall: "probe", recentAccuracy: 100, lastTested: NOW - 10 * DAY })), "solid", "probe still counts the record");
  });

  it("seen and lost is slipping; a newer claim over tested material is solid", () => {
    assert.equal(standingOf(ev({ seen: 10, recall: "teach", recentAccuracy: 100, lastTested: NOW - 90 * DAY })), "slipping");
    assert.equal(standingOf(ev({ seen: 5, recall: "quiet", recentAccuracy: 20, lastTested: NOW - DAY, claimedAt: NOW - HOUR })), "solid");
    assert.equal(standingOf(ev({ seen: 5, recall: "quiet", recentAccuracy: 20, lastTested: NOW - HOUR, claimedAt: NOW - DAY })), "shaky", "an older claim does not outrank a newer test");
  });

  it("the helpers read the words the way the app does", () => {
    assert.deepEqual(STANDING_ORDER.filter(isKnown), ["solid", "claimed"]);
    assert.deepEqual(STANDING_ORDER.filter((s) => !isInSky(s)), ["not-seen"]);
    assert.deepEqual(STANDING_ORDER.filter(needsWork), ["shaky", "slipping"]);
  });

  it("a standing shown on its own gets its first letter only, never every word", () => {
    // SAK-363: CSS `capitalize` was writing "Getting There" in the legend, the
    // Atlas rail and the practice chips while the rest of the app said
    // "Getting there".
    assert.equal(standingWord("getting-there"), "Getting there");
    assert.equal(standingWord("not-seen"), "Undiscovered");
    for (const s of STANDING_ORDER) assert.equal(standingWord(s).slice(1), STANDING[s].label.slice(1));
  });

  it("every standing paints through its own alias token, and only not seen borrows muted for text", () => {
    for (const s of STANDING_ORDER) {
      assert.equal(STANDING[s].dot, `bg-sky-${s}`);
      assert.equal(STANDING[s].text, s === "not-seen" ? "text-sky-muted" : `text-sky-${s}`);
      assert.ok(STANDING[s].label.length > 0 && STANDING[s].meaning.length > 0);
    }
  });
});

describe("parity with the app's standing.ts", () => {
  it("agrees with the original on a grid of records, claims and ages", () => {
    const words = new Set<Standing>();
    let checked = 0;
    for (const seen of [0, 3, 10]) {
      for (const hits of seen ? [0, 5, 6, 8, 10] : [0]) {
        for (const stability of [5, 30, 400]) {
          for (const lastTested of [NOW - HOUR, NOW - 60 * DAY]) {
            const agg: FactAggregate | undefined = seen
              ? { seen, missed: 10 - hits, firstTry: hits, correct: hits, stability, lastTested, recentRuns: Array.from({ length: 10 }, (_, i) => ({ firstTry: i < hits, eventually: i < hits })) }
              : undefined;
            for (const claimedAt of [undefined, NOW - 1000, NOW - 90 * DAY, lastTested + 60_000]) {
              const theirs = appStandingOf(agg, claimedAt, NOW).standing;
              const ours = standingOf({
                seen,
                recall: status(effectiveState(agg, claimedAt), NOW),
                recentAccuracy: recentRunAccuracy(agg),
                claimedAt,
                lastTested: agg?.lastTested,
              });
              assert.equal(ours, theirs, `seen ${seen}, hits ${hits}, stability ${stability}, tested ${lastTested === NOW - HOUR ? "an hour ago" : "60 days ago"}, claimed ${String(claimedAt)}`);
              words.add(ours);
              checked++;
            }
          }
        }
      }
    }
    assert.ok(checked > 200, `checked ${checked} scenarios`);
    assert.equal(words.size, 6, `the grid reaches every word, got ${[...words].join(", ")}`);
  });
});
