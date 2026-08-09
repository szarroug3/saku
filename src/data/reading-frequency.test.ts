import assert from "node:assert/strict";
import { describe, test } from "node:test";

import cejcReadingFrequencyJson from "./generated/cejc-reading-frequency.json" with { type: "json" };
import { readingDefinitions, teachingSenses, vocabRow } from "./vocab.ts";

const CEJC = cejcReadingFrequencyJson.words as Readonly<
  Record<string, Readonly<Record<string, number>>>
>;

describe("CEJC reading order stays inside a definition", () => {
  test("frequency uses observed pronunciation forms, not CEJC's lexical label", () => {
    assert.deepEqual(CEJC["日本"], { にっぽん: 18, にほん: 966 });
    assert.deepEqual(CEJC["寒い"], { さぶい: 5, さむい: 269 });
  });

  test("long-vowel spellings collapse to one pronunciation", () => {
    assert.deepEqual(readingDefinitions(vocabRow("最高")!).map((d) =>
      d.readings.map((reading) => reading.reb)), [["さいこう"], ["さいこう"]]);
    assert.deepEqual(CEJC["最高"], { さいこう: 80 });
  });

  test("4 and 7 lead with the substantially preferred everyday reading", () => {
    const four = readingDefinitions(vocabRow("四")!);
    assert.equal(four.length, 1);
    assert.deepEqual(four[0].readings.map((r) => r.reb), ["よん", "よ", "し"]);
    assert.deepEqual(four[0].referenceReadings, []);
    assert.equal(four[0].preferredReading, "よん");

    const seven = readingDefinitions(vocabRow("七")!);
    assert.equal(seven.length, 1);
    assert.deepEqual(seven[0].readings.map((r) => r.reb), ["なな", "しち"]);
    assert.deepEqual(seven[0].referenceReadings.map((r) => r.reb), ["なあ", "ひち", "な"]);
    assert.equal(seven[0].preferredReading, "なな");
  });

  test("9 is ordered by frequency but its lead is not substantial", () => {
    const nine = readingDefinitions(vocabRow("九")!);
    assert.equal(nine.length, 1);
    assert.deepEqual(nine[0].readings.map((r) => r.reb), ["く", "きゅう"]);
    assert.deepEqual(nine[0].referenceReadings.map((r) => r.reb), [
      "ここの",
      "この",
      "ここ",
    ]);
    assert.equal(nine[0].preferredReading, null);
  });

  test("a frequent later definition never crosses an earlier definition", () => {
    // CEJC has にん far above じん, but JMdict files them as different meanings:
    // the people-counter does not jump above the -ian suffix. Frequency only
    // orders interchangeable readings inside one definition group.
    const person = readingDefinitions(vocabRow("人")!);
    const readings = person.flatMap((definition) => definition.readings.map((r) => r.reb));
    assert.ok(readings.lastIndexOf("ひと") < readings.indexOf("じん"));
    assert.ok(readings.lastIndexOf("じん") < readings.indexOf("にん"));
    assert.ok(person.every((definition) => definition.preferredReading === null));
  });

  test("JMdict gloss synonyms stay one definition, not English-string groups", () => {
    const four = readingDefinitions(vocabRow("四")!)[0];
    assert.deepEqual(four.glosses, ["four", "4"]);
    assert.deepEqual(four.readings.map((r) => r.reb), ["よん", "よ", "し"]);
    assert.deepEqual(four.referenceReadings, []);
  });

  test("a real multi-definition word keeps every sense and prefers its observed reading", () => {
    const cold = vocabRow("寒い")!;
    const definitions = readingDefinitions(cold);
    assert.equal(definitions.length, 2);
    assert.deepEqual(definitions.map((d) => d.glosses[0]), [
      "cold (e.g. weather)",
      "uninteresting (esp. joke)",
    ]);
    for (const definition of definitions) {
      assert.deepEqual(definition.readings.map((r) => r.reb), ["さむい"]);
      assert.deepEqual(definition.referenceReadings.map((r) => r.reb), ["さぶい"]);
      assert.equal(definition.preferredReading, "さむい");
    }

    const withLegacyRareFact = {
      ...cold,
      senses: [...cold.senses, { ...cold.senses[0], reb: "さぶい" }],
    };
    assert.deepEqual(teachingSenses(withLegacyRareFact).map((sense) => sense.reb), ["さむい"]);
  });

  test("counts never demote readings whose JMdict sense coverage differs", () => {
    const firstDefinition = readingDefinitions(vocabRow("一人")!)[0];
    assert.deepEqual(firstDefinition.readings.map((r) => r.reb), ["ひとり", "いちにん"]);
    assert.deepEqual(firstDefinition.referenceReadings, []);
    assert.equal(firstDefinition.preferredReading, null);
  });
});
