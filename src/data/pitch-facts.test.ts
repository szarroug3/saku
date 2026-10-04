// Pitch as a fact (SAK-344): registered, askable, and never on its entry.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { wordPitch } from "./pitch";
import { isPitchFact, PITCH_FACTS, PITCH_SUBJECT, pitchFactId } from "./pitch-facts";
import { ALL_FACTS, factInfo, factsOf } from "@/lib/facts";
import { knownFactsOf, libEntry } from "@/lib/library/entries";
import { rollPitchQuestion } from "@/lib/pitch-quiz";
import { wordEntry } from "./vocab";

describe("pitch facts", () => {
  it("exist for every word that carries a verified pitch and can be asked about it", () => {
    assert.ok(PITCH_FACTS.length > 5000, `${PITCH_FACTS.length} pitch facts`);
    for (const f of PITCH_FACTS.slice(0, 200)) {
      assert.notEqual(wordPitch(f.glyph), null, f.glyph);
      assert.ok(rollPitchQuestion(f.glyph, () => 0), `${f.glyph} can be asked`);
      assert.equal(f.subject, PITCH_SUBJECT);
      assert.equal(f.id, pitchFactId(f.glyph));
      assert.ok(isPitchFact(f.id));
    }
  });

  it("are in the registry, unique, and resolve to their word", () => {
    const ids = new Set(PITCH_FACTS.map((f) => f.id));
    assert.equal(ids.size, PITCH_FACTS.length);
    assert.equal(new Set(ALL_FACTS).size, ALL_FACTS.length, "no duplicate ids in the registry");
    const one = PITCH_FACTS[0];
    assert.equal(factInfo(one.id)?.entry, wordEntry(one.glyph));
  });

  it("cover kana-only words, which Kanjium lists with an empty reading (SAK-503)", () => {
    assert.equal(wordPitch("はい"), 1);
    assert.equal(wordPitch("うん"), 1);
    assert.equal(wordPitch("うっかり"), 3);
    assert.equal(wordPitch("ええ"), null, "Kanjium gives ええ three accents, so it stays without one");
    const ids = new Set(PITCH_FACTS.map((f) => f.id));
    assert.ok(ids.has(pitchFactId("はい")));
    assert.ok(ids.has(pitchFactId("うん")));
  });

  it("are never among an entry's own facts, known or listed", () => {
    for (const f of PITCH_FACTS.slice(0, 200)) {
      assert.ok(!factsOf(f.entry).includes(f.id), `${f.id} listed on its entry`);
      const e = libEntry(f.entry);
      if (e) assert.ok(!knownFactsOf(e).includes(f.id), `${f.id} counted as known`);
    }
  });
});
