import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  sentenceTierDone,
  sentenceTierMarkerFact,
} from "./sentence-ordering-progress.ts";
import type { FactId, HistoryFile, QuizSessionRecord } from "../types/index.ts";

const A = "grammar:te-request:meaning" as FactId;
const B = "grammar:mashou:meaning" as FactId;

const EMPTY: HistoryFile = { sessions: [], facts: {} };

describe("sentence tier completion", () => {
  test("ordinary grammar claims do not complete a sentence tier", () => {
    const history: HistoryFile = {
      ...EMPTY,
      claims: { [A]: 1, [B]: 1 },
    };
    assert.equal(sentenceTierDone("request", [A, B], history), false);
  });

  test("the tier's explicit I-know marker completes it", () => {
    const marker = sentenceTierMarkerFact("request");
    const history: HistoryFile = {
      ...EMPTY,
      claims: { [marker]: 1 },
    };
    assert.equal(sentenceTierDone("request", [A, B], history), true);
    assert.equal(sentenceTierDone("sequential", [A, B], history), false);
  });

  test("a completed assembly session advances without testing every tier fact", () => {
    const session = {
      ts: 1,
      mode: "assembly",
      redrill: false,
      total: 1,
      forgivingPct: 100,
      strictPct: 100,
      facts: {
        [A]: { seen: 1, missed: 0, firstTry: 1, correct: 1 },
      },
    } as QuizSessionRecord;
    assert.equal(
      sentenceTierDone("request", [A, B], {
        ...EMPTY,
        sessions: [session],
      }),
      true,
    );
  });

  test("non-assembly sessions do not complete the tier", () => {
    const session = {
      ts: 1,
      mode: "drill",
      redrill: false,
      total: 1,
      forgivingPct: 100,
      strictPct: 100,
      facts: {
        [A]: { seen: 1, missed: 0, firstTry: 1, correct: 1 },
      },
    } as QuizSessionRecord;
    assert.equal(
      sentenceTierDone("request", [A, B], {
        ...EMPTY,
        sessions: [session],
      }),
      false,
    );
  });
});
