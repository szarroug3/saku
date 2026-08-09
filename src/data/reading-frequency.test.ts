import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { readingDefinitions, vocabRow } from "./vocab.ts";

describe("CEJC reading order stays inside a definition", () => {
  test("4 and 7 lead with the substantially preferred everyday reading", () => {
    const four = readingDefinitions(vocabRow("四")!);
    assert.equal(four.length, 1);
    assert.deepEqual(four[0].readings.map((r) => r.reb), ["よん", "し"]);
    assert.equal(four[0].preferredReading, "よん");

    const seven = readingDefinitions(vocabRow("七")!);
    assert.equal(seven.length, 1);
    assert.deepEqual(seven[0].readings.map((r) => r.reb), ["なな", "しち"]);
    assert.equal(seven[0].preferredReading, "なな");
  });

  test("9 is ordered by frequency but its lead is not substantial", () => {
    const nine = readingDefinitions(vocabRow("九")!);
    assert.equal(nine.length, 1);
    assert.deepEqual(nine[0].readings.map((r) => r.reb), ["く", "きゅう"]);
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
    assert.deepEqual(four.readings.map((r) => r.reb), ["よん", "し"]);
  });

  test("an unobserved valid alternate counts as zero once CEJC observed the word", () => {
    const teacher = vocabRow("先生")!;
    const definitionId = teacher.senses[0].definitionId;
    const withUnobservedAlternate = {
      ...teacher,
      senses: [
        teacher.senses[0],
        { ...teacher.senses[0], definitionId, reb: "せんしょう" },
      ],
    };
    const definitions = readingDefinitions(withUnobservedAlternate);
    assert.deepEqual(definitions[0].readings.map((r) => r.reb), ["せんせい", "せんしょう"]);
    assert.equal(definitions[0].preferredReading, "せんせい");
  });
});
