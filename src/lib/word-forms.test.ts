// The bridge's tests, and one of them is a tripwire rather than a check.
//
// `wordClassOf` fails SILENTLY when a pos string is missing from the map: an
// unmapped verb resolves to null, which is indistinguishable from a noun, and
// the page simply omits its Forms section. Nothing throws and nothing logs. That
// exact gap shipped twice before — 行く, tagged "Godan verb - Iku/Yuku special
// class", classified as non-conjugating both times. So the coverage test below
// asserts reachability from the REAL vocab file rather than from a fixture: a
// re-ingest that renames a tag has to fail here, because it will not fail
// anywhere else.

import assert from "node:assert/strict";
import { test } from "node:test";

import { VOCAB, vocabRow } from "@/data/vocab";
import { SUPPORTED_CLASSES } from "@/lib/conjugate";
import {
  POS_TO_CLASS,
  formsOfWord,
  groupsFor,
  hasForms,
  isIntransitive,
  wordClassOf,
} from "@/lib/word-forms";
import { formsFor } from "@/lib/conjugate";

test("every supported class is reachable from a real pos string in vocab.json", () => {
  // The tripwire. Not "every key in the map is valid" — that direction catches
  // nothing, because a map with nine entries is internally consistent. This is
  // the other direction: for each class the ENGINE can drive, some word in the
  // shipped vocabulary must actually reach it.
  const reached = new Map<string, string>();
  for (const w of VOCAB) {
    const cls = wordClassOf(w);
    if (cls && !reached.has(cls)) reached.set(cls, w.keb);
  }
  const missing = SUPPORTED_CLASSES.filter((c) => !reached.has(c));
  assert.deepEqual(
    missing,
    [],
    `Classes the engine supports that no word in vocab.json reaches: ${missing.join(", ")}. ` +
      `Either a pos string is missing from POS_TO_CLASS, or JMdict renamed a tag.`,
  );
});

test("the special godan classes are mapped — the gap that shipped twice", () => {
  // Named individually, because "all 22 are reachable" above would still pass if
  // some other word happened to carry the tag. These are the specific verbs that
  // were misclassified, asserted by name.
  const cases: Array<[string, string]> = [
    ["行く", "v5k-s"], // the one that was wrong twice
    ["問う", "v5u-s"],
    ["来る", "vk"],
    ["する", "vs-i"],
    ["くださる", "v5aru"],
    ["ある", "v5r-i"],
    ["くれる", "v1-s"],
    ["いい", "adj-ix"],
  ];
  for (const [word, expected] of cases) {
    const row = vocabRow(word);
    assert.ok(row, `${word} is not in vocab.json — the fixture, not the map, is stale`);
    assert.equal(wordClassOf(row), expected, `${word} should classify as ${expected}`);
  }
});

test("行く conjugates with its irregular 音便 — the silent failure, made visible", () => {
  // The payoff of the case above. A v5k misclassification produces 行いて, which
  // is not a word; the special class produces 行って. Only this assertion tells
  // the two apart, because both "conjugate".
  const row = vocabRow("行く");
  assert.ok(row);
  const groups = formsOfWord(row);
  assert.ok(groups, "行く must produce forms");
  const te = groups.flatMap((g) => g.rows).find((r) => r.form === "te");
  assert.equal(te?.value, "行って");
});

test("a noun has no forms, and that is most of the vocabulary", () => {
  const row = vocabRow("先生");
  assert.ok(row);
  assert.equal(wordClassOf(row), null);
  assert.equal(formsOfWord(row), null);
});

test("a する-noun is not conjugated directly", () => {
  // 勉強 is "noun or participle which takes the aux. verb suru" — deliberately
  // absent from the map. Pointing it at vs-i would emit 勉強られる.
  const row = vocabRow("勉強");
  assert.ok(row);
  assert.equal(wordClassOf(row), null);
});

test("な-adjectives are excluded from Forms, い-adjectives are not", () => {
  assert.equal(hasForms("adj-na"), false);
  assert.equal(hasForms("adj-i"), true);
  assert.equal(hasForms("adj-ix"), true);
});

test("every form the engine builds for a class appears in exactly one group", () => {
  // Guards the OTHER silent failure: a form added to the engine that no group
  // lists is generated, discarded, and never seen.
  for (const cls of SUPPORTED_CLASSES) {
    if (!hasForms(cls)) continue;
    const grouped = groupsFor(cls).flatMap((g) => g.rows.map((r) => r.form));
    assert.equal(
      new Set(grouped).size,
      grouped.length,
      `${cls}: a form is listed in two groups`,
    );
    for (const form of formsFor(cls)) {
      assert.ok(grouped.includes(form), `${cls}: form '${form}' is in no group`);
    }
  }
});

test("no verb exceeds 19 forms and no adjective exceeds 11 — so nothing is ever truncated", () => {
  // The measured claim the page relies on to print no count and offer no
  // "show more". If this ever fails, the page needs a cap and this comment is a lie.
  for (const cls of SUPPORTED_CLASSES) {
    if (!hasForms(cls)) continue;
    const n = formsFor(cls).length;
    const limit = cls.startsWith("adj-") ? 11 : 19;
    assert.ok(n <= limit, `${cls} has ${n} forms, over the ${limit} the page assumes`);
  }
});

test("a group with every form refused is dropped, not printed empty", () => {
  // ある has no potential, passive, causative or causative-passive (policy.ts),
  // which is the whole of "Who does it to whom".
  const row = vocabRow("ある");
  assert.ok(row);
  const groups = formsOfWord(row);
  assert.ok(groups);
  assert.ok(
    !groups.some((g) => g.title === "Who does it to whom"),
    "ある's agent group is empty and must not render",
  );
  assert.ok(groups.some((g) => g.title === "Plain and polite"));
});

test("intransitive is detected from the tag it is actually stored under", () => {
  const row = vocabRow("始まる");
  assert.ok(row);
  assert.equal(isIntransitive(row), true);
});

test("POS_TO_CLASS names only strings that occur in vocab.json", () => {
  // The reverse guard: a map entry for a tag that no longer exists is dead
  // weight that reads as coverage.
  const seen = new Set(VOCAB.flatMap((w) => w.pos));
  const dead = Object.keys(POS_TO_CLASS).filter((p) => !seen.has(p));
  assert.deepEqual(dead, [], `pos strings in the map that vocab.json never uses: ${dead.join(" · ")}`);
});
