import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { endRun, exactMatch, giveUp, gradeWith, gradingPrompt, needsCloudCheck, nextItem, normalize, parseVerdict, recordGrade, startRun, unconfirmed, type AskGrader, type Graded, type WriteItem } from "./write-drill";

const item: WriteItem = { id: 1, en: "Let's try something.", jp: "何かしてみましょう。", pattern: "〜ましょう", gloss: "let's do X", words: [] };
const pool = [item, { ...item, id: 2 }];
const graded = (verdict: Graded["verdict"], source: Graded["source"] = "on_device"): Graded => ({ verdict, note: "", source });

describe("normalize", () => {
  it("takes out punctuation and spaces, half and full width", () => {
    assert.equal(normalize(" 何か してみましょう！ "), "何かしてみましょう");
    assert.equal(normalize("はい、そうです。"), "はいそうです");
  });
  it("keeps the long vowel mark, which is a letter", () => {
    assert.equal(normalize("コーヒー。"), "コーヒー");
  });
  it("keeps katakana apart from hiragana", () => {
    assert.notEqual(normalize("アイス"), normalize("あいす"));
  });
});

describe("exactMatch", () => {
  it("matches the stored answer give or take punctuation", () => {
    assert.ok(exactMatch(item, "何かしてみましょう"));
    assert.ok(exactMatch(item, "何か してみましょう!"));
  });
  it("does not match another answer, which the grader reads", () => {
    assert.ok(!exactMatch(item, "なにかしてみましょう"));
  });
  it("does not match an empty answer", () => {
    assert.ok(!exactMatch({ ...item, jp: "。" }, ""));
  });
});

describe("gradingPrompt", () => {
  const prompt = gradingPrompt(item, "  なにかしてみよう ");
  it("carries the English, the answer, the pattern and what was typed", () => {
    for (const piece of [item.en, item.jp, item.pattern, item.gloss, "なにかしてみよう"]) assert.ok(prompt.includes(piece), piece);
  });
  it("says another right answer is right", () => {
    assert.match(prompt, /Never call an answer wrong only because/);
  });
  it("says an optional particle added or left out is right", () => {
    assert.match(prompt, /Adding a particle the correct answer leaves out/);
  });
  it("asks for a gloss on any Japanese the note names", () => {
    assert.match(prompt, /gets its meaning in brackets right after it, each one/);
  });
  it("asks for the kana reading of a word with kanji", () => {
    assert.match(prompt, /put its reading in kana first/);
  });
});

describe("parseVerdict", () => {
  it("reads plain JSON", () => {
    assert.deepEqual(parseVerdict('{"verdict":"close","note":" Use を (marks the object). "}'), { verdict: "close", note: "Use を (marks the object)." });
  });
  it("reads JSON inside a code fence or after a line", () => {
    assert.equal(parseVerdict('Here:\n```json\n{"verdict":"right","note":"Yes."}\n```')?.verdict, "right");
  });
  it("turns down anything that is not a verdict", () => {
    assert.equal(parseVerdict("right"), null);
    assert.equal(parseVerdict('{"verdict":"maybe","note":""}'), null);
    assert.equal(parseVerdict("{not json}"), null);
  });
  it("takes a missing note as empty", () => {
    assert.deepEqual(parseVerdict('{"verdict":"wrong"}'), { verdict: "wrong", note: "" });
  });
});

describe("needsCloudCheck", () => {
  it("lets a device right stand", () => {
    assert.ok(!needsCloudCheck(graded("right")));
  });
  it("checks a device close or wrong in the cloud", () => {
    assert.ok(needsCloudCheck(graded("close")));
    assert.ok(needsCloudCheck(graded("wrong")));
  });
  it("never checks the cloud's own verdict or an exact match", () => {
    assert.ok(!needsCloudCheck(graded("wrong", "in_cloud")));
    assert.ok(!needsCloudCheck(graded("right", "exact")));
  });
});

describe("gradeWith", () => {
  const answer = "なにかしてみよう";
  const says = (g: Graded | null): AskGrader => async () => g;
  const fails: AskGrader = async () => { throw new Error("down"); };
  const hangs: AskGrader = () => new Promise(() => {});
  const never: AskGrader = async () => { throw new Error("must not be asked"); };
  const quiet = () => {};
  const grade = (first: AskGrader, cloud: AskGrader, online = true) =>
    gradeWith(item, answer, { first, cloud, online: () => online, firstMs: 20, cloudMs: 20, warn: quiet });

  it("takes the stored answer as right without asking anyone", async () => {
    assert.deepEqual(await gradeWith(item, "何かしてみましょう！", { first: never, cloud: never, online: () => true, warn: quiet }), { verdict: "right", note: "", source: "exact" });
  });
  it("lets a device right stand", async () => {
    assert.deepEqual(await grade(says(graded("right")), never), graded("right"));
  });
  it("takes the first grader's cloud verdict as it is", async () => {
    assert.deepEqual(await grade(says(graded("wrong", "in_cloud")), never), graded("wrong", "in_cloud"));
  });
  it("has the cloud check a device close, and says it did", async () => {
    assert.deepEqual(await grade(says(graded("close")), says(graded("right", "in_cloud"))), { ...graded("right", "in_cloud"), checked: true });
  });
  it("asks the cloud when the device fails or runs out of time, without saying it checked", async () => {
    for (const first of [fails, hangs, says(null)]) {
      assert.deepEqual(await grade(first, says(graded("wrong", "in_cloud"))), { ...graded("wrong", "in_cloud"), checked: false });
    }
  });
  it("offline, shows a device close as unsure", async () => {
    const shown = await grade(says({ ...graded("close"), note: "Made up." }), never, false);
    assert.ok(shown.unsure);
    assert.equal(shown.note, "");
  });
  it("shows a device close as unsure when the cloud fails or hangs", async () => {
    for (const cloud of [fails, hangs]) assert.ok((await grade(says(graded("wrong")), cloud)).unsure);
  });
  it("throws when nothing answers", async () => {
    await assert.rejects(grade(fails, fails));
    await assert.rejects(grade(hangs, never, false));
  });
  it("reports a grader that failed", async () => {
    const seen: string[] = [];
    await gradeWith(item, answer, { first: fails, cloud: says(graded("right", "in_cloud")), online: () => true, warn: (m) => seen.push(m) });
    assert.deepEqual(seen, ["Writing drill: the first grader gave no verdict."]);
  });
});

describe("a run", () => {
  it("counts a first-try right", () => {
    const run = recordGrade(startRun(), graded("right"));
    assert.ok(run.done);
    assert.deepEqual(run.score, { answered: 1, firstTry: 1, right: 1 });
  });
  it("leaves a near miss open for another try", () => {
    const once = recordGrade(startRun(), graded("close"));
    assert.ok(!once.done);
    assert.equal(once.tries, 1);
    const twice = recordGrade(once, graded("right"));
    assert.deepEqual(twice.score, { answered: 1, firstTry: 0, right: 1 });
  });
  it("counts a wrong as answered, not right", () => {
    assert.deepEqual(recordGrade(startRun(), graded("wrong")).score, { answered: 1, firstTry: 0, right: 0 });
  });
  it("counts giving up as answered, once", () => {
    const run = giveUp(giveUp(startRun()));
    assert.ok(run.done);
    assert.equal(run.score.answered, 1);
  });
  it("closes an unchecked device verdict as answered, not right, with no note", () => {
    const shown = unconfirmed({ verdict: "close", note: "Made up.", source: "on_device" });
    assert.equal(shown.note, "");
    assert.ok(shown.unsure);
    const run = recordGrade(startRun(), shown);
    assert.ok(run.done);
    assert.deepEqual(run.score, { answered: 1, firstTry: 0, right: 0 });
  });
  it("ignores a grade after the sentence is closed", () => {
    const run = recordGrade(startRun(), graded("wrong"));
    assert.equal(recordGrade(run, graded("right")), run);
  });
  it("moves on, and ends when the pool runs out", () => {
    const second = nextItem(recordGrade(startRun(), graded("right")), pool);
    assert.equal(second.at, 1);
    assert.ok(!second.done);
    assert.equal(second.last, undefined);
    assert.ok(nextItem(second, pool).ended);
    assert.ok(endRun(startRun()).ended);
  });
});
