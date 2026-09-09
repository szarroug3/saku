// The Observatory's offerings: what a kana row builds on. Every plain row
// builds on its script's vowels, a marked row on its plain row, and the
// katakana vowels on all of hiragana (Sam's rule, 2026-09-05: you need all
// hiragana before any katakana).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyHistory } from "@/lib/history-ops";
import type { HistoryFile } from "@/types";
import { pickState } from "@/sky/lib/cart";
import { buildGraph } from "@/sky/lib/graph";

import { all, SHELVES } from "./atlas";
import { hasOffer, offerings, offerPicker } from "./observatory";
import { sampleHistory } from "./sample-learner";

const NOW = Date.UTC(2026, 8, 5);

describe("the kana rows on offer", () => {
  const o = offerings(emptyHistory(), NOW);
  const graph = buildGraph([...o.items.values()]);
  const rows = (prefix: string) => [...o.items.keys()].filter((id) => id.startsWith(`kana-row:${prefix}`));

  it("puts every hiragana row before the katakana vowels", () => {
    const hiragana = rows("h-");
    assert.ok(hiragana.length > 5);
    const builtOn = graph.prerequisitesOf("kana-row:k-vowels").filter((p) => p.startsWith("kana-row:"));
    assert.deepEqual(new Set(builtOn), new Set(hiragana));
  });

  it("opens only the hiragana vowels to a new learner", () => {
    const open = [...rows("h-"), ...rows("k-")].filter((id) => pickState(graph, id, o.learned, []).needs.length === 0);
    assert.deepEqual(open, ["kana-row:h-vowels"]);
  });

  it("opens the katakana vowels once all of hiragana is learned, and the rest of katakana on those", () => {
    const learned = new Set([...o.learned, ...rows("h-")]);
    assert.equal(pickState(graph, "kana-row:k-vowels", learned, []).needs.length, 0);
    assert.ok(pickState(graph, "kana-row:k-k", learned, []).needs.includes("kana-row:k-vowels"));
  });
});

describe("offerPicker", () => {
  it("offers every drawable entry exactly as the Observatory does, without building the Observatory", () => {
    const history = sampleHistory();
    const o = offerings(history, NOW);
    const pick = offerPicker(history, NOW).offerPick;
    let compared = 0;
    for (const shelf of SHELVES) {
      for (const kind of shelf.kinds) {
        for (const entry of all(kind)) {
          const offered = o.offerPick(entry.id);
          assert.deepEqual(pick(entry.id), offered, entry.id);
          assert.equal(hasOffer(entry), !!offered, `hasOffer ${entry.id}`);
          if (offered) assert.equal(offered.id, entry.id, `an offer keeps its entry's id: ${entry.id}`);
          compared++;
        }
      }
    }
    assert.ok(compared > 10000, `${compared} entries compared`);
  });

  it("answers the Observatory's own ids as the Observatory does, and an unknown id as nothing", () => {
    const history = sampleHistory();
    const o = offerings(history, NOW);
    const pick = offerPicker(history, NOW).offerPick;
    assert.deepEqual(pick("kana-row:h-vowels"), o.offerPick("kana-row:h-vowels"));
    assert.deepEqual(pick("counter-rule:tsu"), o.offerPick("counter-rule:tsu"));
    assert.equal(pick("word:nonsense-that-is-not-a-word"), undefined);
  });
});

// SAK-430. The "Sentence rules" section used to be the grammar track in its
// own order, which put the nine case particles in one row and never offered a
// sentence type at all. It is sentenceRuleOrder() now, cut at the next type,
// so a learner is offered what that type needs and then the type itself.
describe("the sentence rules on offer", () => {
  const section = (history: HistoryFile) => {
    const o = offerings(history, NOW);
    const s = o.sections.find((x) => x.id === "grammar")!;
    return { o, s, items: s.items.map((id) => o.items.get(id)!) };
  };

  it("offers what the next sentence type needs, then the type, and stops there", () => {
    const { s, items } = section(emptyHistory());
    assert.equal(items.at(-1)!.kind, "sentence", "the section ends on a sentence type");
    assert.deepEqual(
      items.filter((it) => it.kind === "sentence").map((it) => it.id),
      ["writing-rule:sentence-rule-simple"],
      "one type on offer, the next one",
    );
    // and it lays out whole, rather than cut at the usual nine
    assert.equal(s.show, s.items.length);
  });

  it("brings only the particles Simple's own sentences use", () => {
    const { items } = section(emptyHistory());
    const glyphs = items.map((it) => it.glyph);
    assert.deepEqual(glyphs, ["〜な", "〜は", "〜が", "〜を", "〜に", "〜で", "〜だけ", "Simple"]);
    // the three the old section offered in the same breath and Simple never uses
    for (const away of ["〜へ", "〜まで", "〜か"]) assert.ok(!glyphs.includes(away), `${away} is not offered yet`);
  });

  it("keeps a type it cannot start in its place, and says what opens it", () => {
    const { s, items } = section(emptyHistory());
    const type = items.at(-1)!;
    assert.deepEqual(s.gates?.[type.id], { requirement: "Opens once you know は or が" });
  });

  it("opens the type once one of its patterns is known", () => {
    // the sample learner has met te-iru, one of the sequential type's prereqs,
    // so that type is offered rather than shut
    const { s, items } = section(sampleHistory(NOW));
    const type = items.at(-1)!;
    assert.equal(type.id, "writing-rule:sentence-rule-sequential");
    assert.equal(s.gates?.[type.id], undefined);
  });

  it("drops what is already met, and every id it offers is an item", () => {
    const { o, s, items } = section(sampleHistory(NOW));
    assert.ok(s.started, "a learner part way through the track has started it");
    assert.ok(!items.some((it) => o.learned.has(it.id)), "nothing already learned is offered again");
    assert.ok(s.items.every((id) => !!o.items.get(id)), "every offered id was built");
  });
});
