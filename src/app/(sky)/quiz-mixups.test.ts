import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { pairKey } from "@/lib/confusions";
import { entryOf, factInfo } from "@/lib/facts";
import type { QuizAnswer } from "@/sky/lib/quiz";
import type { FactId } from "@/types/facts";

import { mixedWith } from "./quiz-mixups";

mock.module("@/lib/auth", { namedExports: { currentUserId: async () => null } });
const { quizRecords } = await import("./actions.ts");

const SHI = "kana:シ/reading" as FactId;
const TSU = "kana:ツ/reading" as FactId;
const SO = "kana:ソ/reading" as FactId;
const deck = [SHI, TSU, SO];
const answer = (a: Partial<QuizAnswer>): QuizAnswer => ({ cardId: SHI, grade: "missed", tries: 3, narrowed: false, hinted: false, ...a });

test("the facts under test exist", () => {
  for (const f of deck) assert.ok(factInfo(f), f);
  assert.ok(factInfo(TSU)?.answers.includes("tsu"));
});

test("a wrong pick names the entry it answers", () => {
  assert.deepEqual(mixedWith(answer({ picked: [TSU] }), SHI, deck), [entryOf(TSU)]);
});

test("each entry counts once per card, and the card's own never does", () => {
  assert.deepEqual(mixedWith(answer({ picked: [TSU, TSU, SHI] }), SHI, deck), [entryOf(TSU)]);
});

test("a choice that is not a fact names nothing", () => {
  assert.deepEqual(mixedWith(answer({ picked: ["pitch:other"] }), SHI, deck), []);
});

test("a wrong typed answer names the one deck entry it answers", () => {
  assert.deepEqual(mixedWith(answer({ said: ["tsu", "so"] }), SHI, deck), [entryOf(TSU), entryOf(SO)]);
});

test("a typed answer no deck entry has is a plain miss", () => {
  assert.deepEqual(mixedWith(answer({ said: ["xyz"] }), SHI, deck), []);
});

test("the right answer at the end of a card answered right names nothing", () => {
  assert.deepEqual(mixedWith(answer({ grade: "help", tries: 2, said: ["tsu", "shi"] }), SHI, deck), [entryOf(TSU)]);
});

test("a typed answer is matched only against cards of the same subject", () => {
  // the reviewer's case: 〜たい's vehicle typed plain matched 食べる's reading card
  const tai = "grammar:tai/production@v5u" as FactId;
  const taberu = "word:食べる/reading" as FactId;
  assert.ok(factInfo(tai) && factInfo(taberu));
  assert.deepEqual(mixedWith(answer({ cardId: tai, said: ["たべる"] }), tai, [tai, taberu]), []);
});

test("a narrowed card's labels are not matched as typed answers", () => {
  assert.deepEqual(mixedWith(answer({ narrowed: true, said: ["tsu"] }), SHI, deck), []);
});

test("a quiz's records carry the mix-up, and it reads back as a pair", async () => {
  const [drill] = await quizRecords([answer({ picked: [TSU] }), { cardId: TSU, grade: "clean", tries: 1, narrowed: false, hinted: false }]);
  assert.ok(drill);
  assert.deepEqual(drill.detail?.[SHI]?.confused, { [entryOf(TSU)]: 1 });
  assert.deepEqual(drill.detail?.[TSU]?.confused, {});
  const key = pairKey(entryOf(SHI), entryOf(TSU));
  assert.ok(key.includes("シ") && key.includes("ツ"));
});
