import assert from "node:assert/strict";
import { test } from "node:test";

import { emptyHistory } from "@/lib/history-ops";
import type { FactId } from "@/types/facts";
import type { HistoryFile } from "@/types/store";

import { readFor } from "./reader";

const words = async (text: string, hist: HistoryFile = emptyHistory()) => (await readFor(hist, text)).paragraphs;

test("each word is matched by its dictionary form, with its reading", async () => {
  const [p] = await words("映画を見に行きました。");
  const 見 = p.find((w) => w.text === "見");
  assert.equal(見?.entry, "word:見る");
  assert.equal(見?.base, "見る");
  assert.equal(見?.reading, "み");
  assert.equal(p.find((w) => w.text === "映画")?.entry, "word:映画");
  assert.equal(p.find((w) => w.text === "映画")?.standing, "not-seen");
  assert.deepEqual(p.at(-1), { text: "。", mark: true });
});

test("a word the learner has said they know carries that standing", async () => {
  const [p] = await words("映画", { ...emptyHistory(), claims: { ["word:映画/meaning" as FactId]: Date.now(), ["word:映画/reading" as FactId]: Date.now() } });
  assert.equal(p[0].standing, "claimed");
});

test("kana has no reading of its own", async () => {
  const [p] = await words("とても");
  assert.equal(p[0].reading, undefined);
});

test("a paragraph per line, blank lines dropped", async () => {
  assert.equal((await words("私は\n\n学生です")).length, 2);
});

test("a long text is cut at a line, and says so", async () => {
  const line = "私は学生です。";
  const read = await readFor(emptyHistory(), Array(3000).fill(line).join("\n"));
  assert.equal(read.cut, true);
  assert.ok(read.paragraphs.length < 3000);
  assert.ok(read.paragraphs.every((p) => p.map((w) => w.text).join("") === line));
  assert.equal((await readFor(emptyHistory(), line)).cut, undefined);
});

test("a word Saku doesn't teach carries the kanji in it that Saku does", async () => {
  const [p] = await words("鬱蒼");
  const w = p[0];
  assert.equal(w.entry, undefined);
  assert.ok(w.kanji?.every((k) => k.id.startsWith("kanji:")));
});
