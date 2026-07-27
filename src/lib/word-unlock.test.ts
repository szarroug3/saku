// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/word-unlock.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The unlock has one rule and one guarantee, and both are the fix for a shipped
// hole (see word-unlock.ts):
//
//   RULE     — a kanji reading fact is askable iff the user knows a TAUGHT word
//              that attests it. Not before (the reading was never taught) and
//              not on the strength of knowing the KANJI (the kanji track teaches
//              meaning, not reading).
//   GUARANTEE — the question is anchored on a word the user actually learned,
//              never on the ingest's evidence-richest word if that is unlearned.
//              This is the whole "don't ask 生 in 人生 when 人生 was never taught"
//              fix.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  READINGS,
  meaningFactId as kanjiMeaningFactId,
  readingFactId,
} from "../data/kanji.ts";
import { vocabRow, wordMeaningFactId } from "../data/vocab.ts";
import {
  anchorForFact,
  claimableFacts,
  quizzableFacts,
  readingAnchors,
  readingsProvedBy,
  unlockedReadingFacts,
} from "./word-unlock.ts";
import type { FactId, HistoryFile } from "../types/index.ts";

const AT = Date.UTC(2026, 0, 1);

function history(over: Partial<HistoryFile> = {}): HistoryFile {
  return { sessions: [], facts: {}, claims: {}, ...over };
}

function claiming(facts: readonly FactId[]): HistoryFile {
  const claims: Record<string, number> = {};
  for (const f of facts) claims[f] = AT;
  return history({ claims: claims as HistoryFile["claims"] });
}

// 生's せい reading is anchored by the ingest on 先生 (rank 74) — the earliest
// word a beginner meets that attests it (task-20 item 5: the anchor is the
// lowest-beginnerRank attesting word, not an obscure one like 人生 rank 1187).
// The unlock still frames the question on a word the user ACTUALLY learned; when
// the ingest anchor is not yet known, it falls back to the earliest word that is.
const SEI_FACT: FactId = readingFactId("生", "先生");
const SEN_FACT: FactId = readingFactId("先", "先生");

describe("a reading is askable iff a TAUGHT word attests it", () => {
  test("empty history unlocks nothing", () => {
    assert.equal(unlockedReadingFacts(history()).length, 0);
    assert.equal(anchorForFact(SEI_FACT, history()), undefined);
  });

  test("knowing the KANJI does not unlock its reading", () => {
    // The kanji track teaches meaning. Knowing 生's meaning must NOT make 生's
    // reading askable — a reading is proved by a word, never by the character.
    const h = claiming([kanjiMeaningFactId("生")]);
    assert.ok(!new Set(unlockedReadingFacts(h)).has(SEI_FACT));
  });

  test("learning 先生 unlocks 生's せい reading — the payoff", () => {
    const h = claiming([wordMeaningFactId("先生")]);
    const unlocked = new Set(unlockedReadingFacts(h));
    assert.ok(unlocked.has(SEI_FACT), "生/せい unlocked by 先生");
    assert.ok(unlocked.has(SEN_FACT), "先/せん unlocked by 先生");
  });
});

describe("the question anchors on a word the user actually learned", () => {
  test("the ingest anchor wins when it IS known", () => {
    // Learn 先生 — the ingest anchor and the earliest word — and the reading
    // frames on it, because there is no reason to move off it once it's fair.
    const h = claiming([wordMeaningFactId("先生")]);
    assert.equal(anchorForFact(SEI_FACT, h), "先生");
    assert.equal(readingAnchors(h).get(SEI_FACT), "先生");
  });

  test("ingest anchor not yet known → frames on a word that IS", () => {
    // 先生 (the ingest anchor) is not learned, but 学生 attests せい and is. The
    // question must frame on 学生 rather than an unmet word — the whole point of
    // the unlock is to ask in a word the user has actually met.
    const h = claiming([wordMeaningFactId("学生")]);
    assert.equal(anchorForFact(SEI_FACT, h), "学生");
  });

  test("among several known words, the earliest (lowest rank) is chosen", () => {
    // Ingest anchor 先生 is NOT known; among the known attesting words 学生
    // (rank 187) and 生活 (rank 653), the anchor is the more familiar 学生.
    const h = claiming([
      wordMeaningFactId("学生"),
      wordMeaningFactId("生活"),
    ]);
    assert.equal(anchorForFact(SEI_FACT, h), "学生");
  });

  test("a non-reading fact has no anchor", () => {
    const h = claiming([wordMeaningFactId("先生")]);
    assert.equal(anchorForFact(kanjiMeaningFactId("生"), h), undefined);
  });
});

describe("readingsProvedBy — the write side of the unlock", () => {
  test("teaching 先生 names 生's せい and 先's せん reading facts", () => {
    const proved = new Set(readingsProvedBy(["先生"]));
    assert.ok(proved.has(SEI_FACT), "先生 proves 生/せい");
    assert.ok(proved.has(SEN_FACT), "先生 proves 先/せん");
  });

  test("teaching no words proves nothing", () => {
    assert.equal(readingsProvedBy([]).length, 0);
  });

  test("what a lesson proves is exactly what history then unlocks", () => {
    // The write side (from the taught words) and the read side (from the
    // resulting history) must agree, or a reading is written seen that history
    // would not call unlocked — or the reverse.
    const proved = new Set(readingsProvedBy(["先生"]));
    const unlocked = new Set(
      unlockedReadingFacts(claiming([wordMeaningFactId("先生")])),
    );
    assert.deepEqual([...proved].sort(), [...unlocked].sort());
  });
});

// A form JMdict files under several readings is taught as its primary, and the
// primary now comes from the sense merge (src/data/vocab.ts, `withSenses`): 人 is
// ひと, not the じん suffix the old dedup left in vocab.json. readings.json was cut
// before that, so it credited the word 人 with じん — and since the reading that
// UNLOCKS is the one the word attests, learning 人 opened the wrong reading and
// left the one it was actually taught shut. src/data/kanji.ts (`reattest`)
// re-derives the evidence from the joined row's `align`; this pins the outcome
// for two of the 117 forms whose primary moved.
//
// By base rather than by anchor word, because the anchor is a re-pick over the
// attesting words and moves when the evidence does. What must hold is about the
// SOUND: 人 in a word reads ひと or じん, and which word proved it is the point.
function readingFactByBase(kanji: string, base: string): FactId {
  const row = READINGS.find((r) => r.k === kanji && r.base === base);
  assert.ok(row, `${kanji} has a ${base} reading`);
  return readingFactId(row.k, row.anchor);
}

// TASK #22: a kanji's reading is ONLY ever ASKED inside a MULTI-PART word the
// learner knows. The single-kanji word 人 IS its own reading card (「人」→ ひと,
// the word's reading), so knowing it must never open a second "how is 人 read on
// its own" card. The reading becomes askable through a MULTI-PART word that
// carries it — 恋人 for ひと, 外国人 for じん — framed on that word, never on the
// bare glyph. The guarantee lives on the READ side (preferredAnchor →
// anchorForFact / readingAnchors / quizzableFacts), so these test it there.
describe("a kanji reading is asked only inside a multi-part word", () => {
  test("knowing only the single-kanji word 人 makes none of 人's readings askable", () => {
    assert.equal(vocabRow("人")?.reb, "ひと", "人 is taught as ひと");
    const h = claiming([wordMeaningFactId("人")]);
    const anchors = readingAnchors(h);
    // Nothing multi-part to frame them in, so none unlock — not even ひと, the
    // reading the word 人 itself carries. That reading is the word's own card.
    assert.equal(anchorForFact(readingFactByBase("人", "ひと"), h), undefined);
    assert.ok(!anchors.has(readingFactByBase("人", "ひと")), "人 alone: ひと not askable");
    assert.ok(!anchors.has(readingFactByBase("人", "じん")), "人 alone: じん not askable");
  });

  test("learning a multi-part word makes its kanji's reading askable, framed on it", () => {
    // 恋人 carries 人 as ひと and 外国人 carries it as じん; each is more than just
    // the kanji, so each is a fair place to ask "how is 人 read HERE".
    assert.equal(
      anchorForFact(readingFactByBase("人", "ひと"), claiming([wordMeaningFactId("恋人")])),
      "恋人",
      "恋人 opens 人/ひと, framed on 恋人",
    );
    assert.equal(
      anchorForFact(readingFactByBase("人", "じん"), claiming([wordMeaningFactId("外国人")])),
      "外国人",
      "外国人 opens 人/じん, framed on 外国人",
    );
  });
});

// TASK #22: the isolated "on its own" card — a reading whose ONLY attesting word
// IS the single kanji (kanji:X/reading@X) — is removed from quizzing entirely.
// 病's やまい reading is attested by the word 病 alone (病/reading@病), so no
// multi-part word can ever frame it: it is never asked, however it was "met".
describe("the on-its-own reading (kanji:X/reading@X) is never quizzed", () => {
  const YAMAI: FactId = readingFactByBase("病", "やまい");

  test("its fact IS the self-anchored kind", () => {
    const row = READINGS.find((r) => r.k === "病" && r.base === "やまい");
    assert.ok(row && row.anchor === "病", "病/やまい is anchored on the glyph itself");
  });

  test("it is not quizzable even when met by a stray claim on the fact", () => {
    // The reading is "met" — claimed on the fact itself and its word learned —
    // and still must not be asked: no multi-part word attests やまい, so there is
    // nowhere fair to ask it.
    const h = claiming([YAMAI, wordMeaningFactId("病")]);
    assert.ok(!quizzableFacts([YAMAI], h).includes(YAMAI));
    assert.equal(anchorForFact(YAMAI, h), undefined);
  });

  // THE LEAK, and where it is closed. Teaching the single-kanji word 病 SEEDS
  // its self-anchored reading (readingsProvedBy is deliberately broad — the
  // reading enters the pool so a later multi-part word can open it). The lesson
  // used to drill that seed DIRECTLY, so the self-anchored card reached the
  // board — the owner hit exactly this on 一. The fix routes the drill deck
  // through the same `quizzableFacts` gate `resolve` already uses, so the seed
  // stays broad while the ASK drops the self-anchored reading. This pins the two
  // halves: seeded YES, drilled NO.
  test("a single-kanji word seeds its self-anchored reading but never drills it", () => {
    assert.ok(
      readingsProvedBy(["病"]).includes(YAMAI),
      "learning 病 seeds 病/やまい into the pool",
    );
    // The gate the drill deck applies (DrillScreen onMount → quizzableFacts),
    // against the history the lesson leaves — 病's meaning known.
    const h = claiming([wordMeaningFactId("病")]);
    assert.deepEqual(
      quizzableFacts(readingsProvedBy(["病"]), h),
      [],
      "the ask-gate drops the self-anchored reading from what gets drilled",
    );
  });
});

// The bug the owner hit: she marked a few kanji "I already know this" in the
// Library, ran Quiz me, and was asked "山 read as ざん in 登山" for a word (登山)
// she never learned. 山's さん reading is anchored by the ingest on 登山, so its
// fact is kanji:山/reading@登山. Two guards close it: the claim drops the reading
// (SOURCE), and the quiz drops any reading in an unlearned word (GUARD).
const ZAN_FACT: FactId = readingFactId("山", "登山");
const YAMA_MEANING: FactId = kanjiMeaningFactId("山");

describe("claimableFacts: a kanji claim takes the meaning, not the readings", () => {
  test("claiming 山 keeps its meaning and drops its word-anchored reading", () => {
    assert.deepEqual(claimableFacts([YAMA_MEANING, ZAN_FACT]), [YAMA_MEANING]);
  });

  test("a kana's one fact and a word's facts survive a claim untouched", () => {
    // Neither is a kanji reading fact, so the filter passes them straight
    // through: "I know this kana" and "I know this word" still claim everything.
    const kanaFact = "kana:か/reading" as FactId;
    const wordFact = wordMeaningFactId("先生");
    assert.deepEqual(claimableFacts([kanaFact, wordFact]), [kanaFact, wordFact]);
  });
});

describe("quizzableFacts: a reading is never asked in an unlearned word", () => {
  test("山/ざん is dropped from the quiz while 登山 is unlearned, even when met", () => {
    // The reading is "met" by a stray claim on the fact itself, exactly the
    // regression: it must still not be asked, because 登山 was never learned.
    const h = claiming([ZAN_FACT]);
    assert.ok(!quizzableFacts([ZAN_FACT], h).includes(ZAN_FACT));
  });

  test("learning 登山 makes 山/ざん quizzable", () => {
    const h = claiming([wordMeaningFactId("登山")]);
    assert.ok(quizzableFacts([ZAN_FACT], h).includes(ZAN_FACT));
  });

  test("kana, words and meanings always pass the quiz guard", () => {
    const h = history();
    const nonReadings: FactId[] = [
      "kana:か/reading" as FactId,
      wordMeaningFactId("先生"),
      YAMA_MEANING,
    ];
    assert.deepEqual(quizzableFacts(nonReadings, h), nonReadings);
  });
});
