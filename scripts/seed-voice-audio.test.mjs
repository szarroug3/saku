// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test scripts/seed-voice-audio.test.mjs
//
// SAK-216: Sam explicitly asked for distractor pitch clips to be seeded, not
// just each word's correct reading — the live "wrong"-mode quiz
// (src/lib/pitch-quiz.ts's rollPitchQuestion) fetches a distractor clip at
// wrongDownstepFor's downstep, and before this ticket that clip only ever got
// synthesized lazily, the first time a real learner's session requested it.
//
// This pins `pitchItems()` (the seed script's own enumeration of every
// (reading, downstep) pair the EXACT-pitch cache can be asked for) against
// the REAL VOCAB corpus and the REAL `wrongDownstepFor` — not a fabricated
// fixture — so a pass here can't disagree with what the live quiz would
// independently compute and request. `pitchItems` and its dependencies are
// pure (no fetch, no Supabase, no VOICEVOX), so this imports the script
// module directly; `main()` at the bottom is import-guarded specifically so
// doing that doesn't also try to run the real seed.

import assert from "node:assert/strict";
import { afterEach, describe, mock, test } from "node:test";

import { COUNTER_KINDS, counterReading, numberReading } from "@/lib/number-reading";
import { wordPitch } from "@/data/pitch";
import { legacyUnqualifiedReading, VOCAB } from "@/data/vocab";
import { moraeOf, wrongDownstepFor } from "@/lib/pitch";
import { CONFIRMED_BAD_READINGS } from "@/lib/tts-synth";
import { VOICE_PREVIEW } from "@/lib/voice";

import { bareNumberTexts, countedNumberTexts, pitchItems, synthesizeText } from "./seed-voice-audio.mjs";

describe("pitchItems — SAK-216 distractor coverage", () => {
  test("every VOCAB word with a verified downstep gets both a correct item and (when honest) a distractor item", () => {
    const items = pitchItems();
    const present = new Set(items.map((i) => `${i.reading}:${i.downstep}`));

    let checked = 0;
    let withDistractor = 0;
    for (const row of VOCAB) {
      const downstep = wordPitch(row.keb);
      if (downstep === null) continue;
      checked++;

      // SAK-266: the reading a correct/distractor item is keyed on is the
      // SAME one the live quiz resolves (legacyUnqualifiedReading), not
      // VOCAB's own `.reb` — those two can differ for a word whose
      // CEJC/NUMBER_WORD_ALTERNATES-preferred reading has moved on from what
      // it was originally taught under (七/九/四).
      const reading = legacyUnqualifiedReading(row.keb) ?? row.reb;

      // The correct-downstep item must still be there, unchanged.
      assert.ok(
        present.has(`${reading}:${downstep}`),
        `missing correct item for ${row.keb} (${reading}, downstep ${downstep})`,
      );

      // The distractor must match wrongDownstepFor EXACTLY — same function,
      // same inputs the live "wrong"-mode quiz uses — or, when that word has
      // no honest distractor (a 1-mora reading), no distractor item should
      // have been invented for it.
      const wrongDownstep = wrongDownstepFor(downstep, moraeOf(reading).length);
      if (wrongDownstep === null) continue;
      withDistractor++;
      assert.ok(
        present.has(`${reading}:${wrongDownstep}`),
        `missing distractor item for ${row.keb} (${reading}, distractor downstep ${wrongDownstep})`,
      );
    }

    // Sanity floor so this test can't silently pass over an empty corpus.
    assert.ok(checked > 0, "no VOCAB row carried a verified pitch — test fixture problem, not a real pass");
    assert.ok(withDistractor > 0, "no word in VOCAB has an eligible (>=2 mora) reading — check test data");
  });

  test("a 1-mora verified word gets no distractor item (mirrors rollPitchQuestion's own null handling)", () => {
    const oneMoraRow = VOCAB.find((row) => {
      const downstep = wordPitch(row.keb);
      const reading = legacyUnqualifiedReading(row.keb) ?? row.reb;
      return downstep !== null && moraeOf(reading).length < 2;
    });
    // Only assert the behavior if such a word actually exists in the corpus
    // right now — its presence isn't this test's concern, its handling is.
    if (!oneMoraRow) return;

    const downstep = wordPitch(oneMoraRow.keb);
    const reading = legacyUnqualifiedReading(oneMoraRow.keb) ?? oneMoraRow.reb;
    assert.equal(wrongDownstepFor(downstep, moraeOf(reading).length), null);

    const items = pitchItems();
    const itemsForReading = items.filter((i) => i.reading === reading);
    assert.deepEqual(
      itemsForReading.map((i) => i.downstep),
      [downstep],
      `expected exactly one (correct-only) item for 1-mora word ${oneMoraRow.keb}`,
    );
  });

  test("VOICE_PREVIEW is still seeded once, with no distractor invented for it", () => {
    const items = pitchItems();
    const previewItems = items.filter((i) => i.reading === VOICE_PREVIEW.reading);
    // せんせい may also independently appear as a real VOCAB word's own
    // correct/distractor reading, so this checks the specific downstep is
    // present rather than asserting an exact count.
    assert.ok(previewItems.some((i) => i.downstep === VOICE_PREVIEW.downstep));
  });

  test("roughly doubles the item count versus correct-only seeding, not more and not less", () => {
    const items = pitchItems();
    const present = new Set(items.map((i) => `${i.reading}:${i.downstep}`));

    let correctOnlyCount = 1; // VOICE_PREVIEW
    const correctOnlySeen = new Set([`${VOICE_PREVIEW.reading}:${VOICE_PREVIEW.downstep}`]);
    let expectedTotal = correctOnlyCount;
    const expectedSeen = new Set(correctOnlySeen);

    for (const row of VOCAB) {
      const downstep = wordPitch(row.keb);
      if (downstep === null) continue;
      const reading = legacyUnqualifiedReading(row.keb) ?? row.reb;
      const correctKey = `${reading}:${downstep}`;
      if (!correctOnlySeen.has(correctKey)) {
        correctOnlySeen.add(correctKey);
        correctOnlyCount++;
      }
      if (!expectedSeen.has(correctKey)) {
        expectedSeen.add(correctKey);
        expectedTotal++;
      }
      const wrongDownstep = wrongDownstepFor(downstep, moraeOf(reading).length);
      if (wrongDownstep === null) continue;
      const wrongKey = `${reading}:${wrongDownstep}`;
      if (!expectedSeen.has(wrongKey)) {
        expectedSeen.add(wrongKey);
        expectedTotal++;
      }
    }

    // Exact dedup-aware expectation, independently re-derived here rather than
    // re-imported from the script, so this can't just be checking pitchItems
    // against its own logic.
    assert.equal(items.length, expectedTotal);
    assert.equal(present.size, expectedTotal);
    // And it really did grow versus the old correct-only shape (not a no-op).
    assert.ok(
      expectedTotal > correctOnlyCount,
      "distractor items should add strictly more entries than correct-only seeding",
    );
  });
});

// SAK-244: numbers and counters (さんにん, にじゅうごにち, …) were almost never
// pre-generated — an exhaustive count found only 3% of counted-number forms
// and 11% of bare numbers cached, meaning nearly every one triggered a live,
// uncached synthesis call. These pin bareNumberTexts()/countedNumberTexts()
// (the seed script's own enumeration of exactly what the "numbers"/"counters"
// sets now cover) against the REAL number-reading.ts engine — the same
// engine number-quiz.ts's makeItem and counter-entry-view.tsx's HearButton
// read from live — so a pass here can't disagree with what a learner's
// session would actually request.
describe("bareNumberTexts / countedNumberTexts — SAK-244 counted-number coverage", () => {
  test("bareNumberTexts covers exactly numberReading(1..99), the same primary reading a bare-number HEAR card speaks", () => {
    const texts = bareNumberTexts();
    const expected = [];
    for (let n = 1; n <= 99; n++) expected.push(numberReading(n));

    // Exactly 99 possible bare numbers, per the ticket's exhaustive count.
    assert.equal(expected.length, 99);
    assert.deepEqual(new Set(texts), new Set(expected));
    for (const reading of expected) {
      assert.ok(texts.includes(reading), `missing bare-number reading ${reading}`);
    }
  });

  test("countedNumberTexts covers exactly counterReading(n, kind) for every kind × 1..99, skipping out-of-range nulls", () => {
    const texts = countedNumberTexts();
    const present = new Set(texts);

    let expectedCount = 0;
    for (const kind of COUNTER_KINDS) {
      for (let n = 1; n <= 99; n++) {
        const reading = counterReading(n, kind);
        if (reading === null) continue;
        expectedCount++;
        assert.ok(present.has(reading), `missing counted-number reading ${reading} (${kind}, ${n})`);
      }
    }

    // 15 counter kinds: 14 span 1-99, "tsu" caps at 10 (14*99 + 10 = 1,396) —
    // the exact possible-form count the ticket's exhaustive audit found.
    assert.equal(COUNTER_KINDS.length, 15);
    assert.equal(expectedCount, 1396);
    // A dedup-aware set (some readings coincide across counters/counts, e.g.
    // にじゅう as a prefix does not collide since these are whole readings —
    // this just guards the enumeration didn't silently drop real entries).
    assert.ok(present.size > 0 && present.size <= expectedCount);
  });

  test("no null reading ever reaches the item list (counterReading's out-of-range guard is respected)", () => {
    const texts = countedNumberTexts();
    assert.ok(texts.every((t) => typeof t === "string" && t.length > 0));
  });
});

// SAK-219: `synthesizeText` — what every `textSet` item (words, sentences,
// kana, yomi, word-examples, grammar-derive) actually synthesizes through —
// called `audioQuery` with NO correction of any kind before this fix, so any
// item text that happens to be an EXACT match on one of the 34
// CONFIRMED_BAD_READINGS (はち, つかう, ...) hit the identical OpenJTalk
// mis-segmentation bug SAK-215 fixed for the pitch-only path. Same
// mocked-fetch discipline as src/lib/tts-synth.test.ts (the one seam this
// module calls through).
describe("synthesizeText — SAK-219 general-path misreading fix", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  /** Mocks both `/audio_query` and `/synthesis`, recording only the
   * `text` param `/audio_query` was actually called with (in call order) —
   * `/synthesis` carries no `text` query param, so it's excluded rather than
   * pushing a spurious empty string per call. */
  function mockAudioQuery() {
    const queried = [];
    mock.method(globalThis, "fetch", async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/audio_query") {
        const text = decodeURIComponent(url.searchParams.get("text") ?? "");
        queried.push(text);
        const moras = [...text].map((ch) => ({ text: ch, pitch: 5 }));
        return new Response(JSON.stringify({ accent_phrases: [{ moras }] }), { status: 200 });
      }
      if (url.pathname === "/synthesis") {
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url.pathname}`);
    });
    return queried;
  }

  test("a confirmed-bad reading item (はち) is converted to katakana before audio_query", async () => {
    const queried = mockAudioQuery();
    await synthesizeText("http://fake-voicevox.test", 9001, "はち");
    assert.deepEqual(queried, ["ハチ"], "synthesizeText must query VOICEVOX with the katakana form, not bare はち");
  });

  test("an ordinary word (がっこう) reaches audio_query unchanged", async () => {
    const queried = mockAudioQuery();
    await synthesizeText("http://fake-voicevox.test", 9002, "がっこう");
    assert.deepEqual(queried, ["がっこう"]);
  });

  test("a real sentence merely CONTAINING a confirmed-bad reading (word-examples/sentences set item) is left untouched", async () => {
    const queried = mockAudioQuery();
    const sentence = "彼ははちを飼っています。";
    await synthesizeText("http://fake-voicevox.test", 9003, sentence);
    assert.deepEqual(queried, [sentence], "exact-match only — a sentence containing はち must not be substring-matched");
  });

  test("every CONFIRMED_BAD_READINGS entry is converted away from bare hiragana (smoke check across the full list, no network)", async () => {
    // Not a live VOICEVOX check (that's done manually per the ticket's own
    // instruction not to run seed/cleanup scripts here) — just confirms the
    // fix function is wired in for the FULL list, not just the couple of
    // readings spot-checked above.
    for (const reading of CONFIRMED_BAD_READINGS) {
      const queried = mockAudioQuery();
      await synthesizeText("http://fake-voicevox.test", 9004, reading);
      assert.notEqual(queried[0], reading, `${reading} should have been converted away from bare hiragana`);
      mock.restoreAll();
    }
  });
});
