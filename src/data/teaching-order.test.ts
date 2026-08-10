import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  VOCAB,
  isWordTrackCategory,
  vocabRow,
  wordTeachingMetadata,
} from "./vocab.ts";
import { CURRICULUM_WORDS } from "../lib/word-lesson.ts";

describe("CEJC owns word-track priority", () => {
  test("the approved five responses bootstrap the track", () => {
    assert.deepEqual(
      CURRICULUM_WORDS.slice(0, 6).map((word) => word.keb),
      ["はい", "うん", "いいえ", "いや", "えっ", "そう"],
    );
    for (const keb of ["はい", "うん", "いいえ", "いや", "えっ"]) {
      const metadata = wordTeachingMetadata(keb);
      assert.equal(metadata.category, "conversation-essential");
      assert.equal(metadata.placementRule, "curated-essential-bootstrap");
    }
  });

  test("30 CEJC-ranked core entries are followed by four essentials", () => {
    const byTeachingRank = [...VOCAB]
      .filter((word) => wordTeachingMetadata(word.keb).teachingRank !== null)
      .sort(
        (a, b) =>
          wordTeachingMetadata(a.keb).teachingRank! -
          wordTeachingMetadata(b.keb).teachingRank!,
      );
    assert.ok(
      byTeachingRank.slice(5, 35).every(
        (word) => wordTeachingMetadata(word.keb).category === "core",
      ),
    );
    assert.deepEqual(
      byTeachingRank.slice(35, 39).map((word) => word.keb),
      ["ああ", "あっ", "ええ", "ふん"],
    );
    assert.ok(
      byTeachingRank.slice(35, 39).every(
        (word) =>
          wordTeachingMetadata(word.keb).placementRule ===
          "essential-batch-after-30-core-items",
      ),
    );
  });

  test("CEJC POS keeps grammar and fillers out of the word track", () => {
    assert.equal(wordTeachingMetadata("で").category, "grammar");
    assert.ok(!CURRICULUM_WORDS.some((word) => word.keb === "で"));
    for (const word of CURRICULUM_WORDS) {
      assert.ok(isWordTrackCategory(wordTeachingMetadata(word.keb).category));
    }
  });

  test("CEJC dictionary lemmas normalize to everyday kana without homophone leakage", () => {
    assert.equal(wordTeachingMetadata("それ").cejcCount, 14_879);
    assert.equal(wordTeachingMetadata("これ").cejcCount, 12_030);
    assert.equal(wordTeachingMetadata("ちょっと").cejcCount, 8_549);
    assert.equal(wordTeachingMetadata("そう").cejcCount, 50_673);
  });

  test("runtime beginnerRank is the dense app-wide order headed by CEJC", () => {
    const ranks = VOCAB.map((word) => word.beginnerRank);
    assert.equal(new Set(ranks).size, VOCAB.length);
    assert.equal(Math.min(...ranks), 1);
    assert.equal(Math.max(...ranks), VOCAB.length);
    assert.equal(vocabRow("はい")?.beginnerRank, 1);
    assert.ok(vocabRow("食べる")!.beginnerRank < vocabRow("委員会")!.beginnerRank);
  });
});
