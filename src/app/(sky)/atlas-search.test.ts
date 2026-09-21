// A pattern that is on the Sentences shelf is found there (SAK-475).
//
// Sam searched を with Sentences open. The page said nothing in Sentences
// matched, and 〜を was a tile on that shelf. The search filed every pattern
// under Grammar, because that is its kind, and the Sentences shelf holds
// patterns too.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyHistory } from "@/lib/history-ops";

import { atlasFromHistory, atlasSearchFromHistory } from "./atlas";

describe("searching a particle finds it on the Sentences shelf", () => {
  const found = atlasSearchFromHistory(emptyHistory(), "を");
  const glyph = (id: string) => found.items.find((it) => it.id === id)?.glyph;

  it("〜を is a Sentences match and still a Grammar match", () => {
    for (const shelf of ["sentences", "grammar"]) {
      const section = found.sections.find((s) => s.id === shelf);
      assert.ok(section, `no ${shelf} section`);
      assert.ok(section.items.some((id) => glyph(id) === "〜を"), `〜を is not under ${shelf}`);
    }
  });

  it("every Sentences match is a tile the Sentences shelf draws", () => {
    const shelf = atlasFromHistory(emptyHistory()).shelves.find((s) => s.id === "sentences")!;
    const drawn = new Set(shelf.sections.flatMap((s) => s.items));
    for (const id of found.sections.find((s) => s.id === "sentences")!.items) assert.ok(drawn.has(id), `${id} is not on the shelf`);
  });

  it("a word that is on no such shelf adds no Sentences section", () => {
    assert.equal(atlasSearchFromHistory(emptyHistory(), "telephone").sections.some((s) => s.id === "sentences"), false);
  });
});
