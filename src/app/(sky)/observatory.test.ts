// The Observatory's offerings: what a kana row builds on. Every plain row
// builds on its script's vowels, a marked row on its plain row, and the
// katakana vowels on all of hiragana (Sam's rule, 2026-09-05: you need all
// hiragana before any katakana).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { patternEntry } from "@/data/grammar";
import { CURRICULUM_PATTERNS } from "@/lib/grammar-lesson";
import { emptyHistory } from "@/lib/history-ops";
import { knownFactsOf, libEntry, type LibEntry } from "@/lib/library/entries";
import type { FactAggregate, HistoryFile } from "@/types/store";
import { pickState } from "@/sky/lib/cart";
import { typeLabel } from "@/sky/lib/tokens";
import { buildGraph } from "@/sky/lib/graph";
import { EMPTY_RECIPE } from "@/sky/lib/practice";

import { all, SHELVES } from "./atlas";
import { standingFor } from "./learner";
import { hasOffer, offerings, offerPicker } from "./observatory";
import { practicePreview } from "./practice";
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

// SAK-430. The "Sentences" section used to be the grammar track in its
// own order, which put the nine case particles in one row and never offered a
// sentence type at all. It is sentenceRuleOrder() now, cut at the type after
// the next one, so a learner is offered one sentence type with everything
// that type needs around it (SAK-468).
describe("the sentence rules on offer", () => {
  const section = (history: HistoryFile) => {
    const o = offerings(history, NOW);
    const s = o.sections.find((x) => x.id === "sentences")!;
    return { o, s, items: s.items.map((id) => o.items.get(id)!) };
  };

  it("offers one sentence type with what it needs around it, and stops there", () => {
    const { s, items } = section(emptyHistory());
    assert.deepEqual(
      items.filter((it) => it.kind === "sentence").map((it) => it.id),
      ["writing-rule:sentence-rule-simple"],
      "one type on offer, the next one",
    );
    // and it lays out whole, rather than cut at the usual nine
    assert.equal(s.show, s.items.length);
  });

  // SAK-464. Sam, on the lesson page for 〜は: "if this is grammar, why is it
  // in the sentences area and then labeled as a particle? is it a particle or
  // grammar?" A particle says so; every other pattern is a grammar pattern,
  // which is what `typeLabel` falls back to from the kind.
  it("says which of its rows are particles", () => {
    const { items } = section(emptyHistory());
    const labels = Object.fromEntries(items.map((it) => [it.glyph, typeLabel(it)]));
    assert.deepEqual(labels, {
      "〜は": "particle",
      "〜が": "particle",
      "〜を": "particle",
      "〜に": "particle",
      "〜で": "particle",
      "〜だけ": "particle",
      Simple: "sentence type",
    });
  });

  // SAK-468. Sam: "why isn't simple sentences not after topic/subject? why
  // does it come after all these other particles". Simple needs は, が and を
  // (を joined them on 2026-09-26, SAK-487); に, で and だけ are what its
  // example sentences turn on, so they follow it.
  it("puts the type after what it requires and before what its sentences use", () => {
    const { items } = section(emptyHistory());
    const glyphs = items.map((it) => it.glyph);
    assert.deepEqual(glyphs, ["〜は", "〜が", "〜を", "Simple", "〜に", "〜で", "〜だけ"]);
    // the three the old section offered in the same breath and Simple never uses
    for (const away of ["〜へ", "〜まで", "〜か"]) assert.ok(!glyphs.includes(away), `${away} is not offered yet`);
  });

  // SAK-464. The type used to keep its place as a dim tile reading "Opens
  // once you know は or が". Sam, 2026-09-17: "just let it open when it
  // opens." It waits on its patterns, and a thing waiting on something is
  // not drawn, so the row holds no tile for it until they are learned or
  // picked tonight.
  describe("a type the learner cannot start yet", () => {
    const simple = "writing-rule:sentence-rule-simple";
    const NA = "grammar:prenominal-form";
    /** What the page does with the section: a thing is drawn when the cart
     * can take it and everything it waits on is learned or picked. */
    const open = (history: HistoryFile, picks: readonly string[]) => {
      const { o, s } = section(history);
      const graph = buildGraph([...o.items.values()]);
      const waits = s.needs?.[simple] ?? [];
      return waits.every((id) => o.learned.has(id) || picks.includes(id)) && pickState(graph, simple, o.learned, picks).available;
    };
    /** は met, which is how the learner's own sky says it: the same reading
     * the section uses to drop a pattern it no longer offers. */
    const knows = (id: string): HistoryFile => {
      const history = emptyHistory();
      const entry = libEntry(patternEntry(id));
      assert.ok(entry, `${id} is a pattern`);
      for (const f of knownFactsOf(entry)) history.claims = { ...history.claims, [f]: NOW };
      return history;
    };

    it("says what it waits on, and says nothing about it in words", () => {
      const { o, s, items } = section(emptyHistory());
      const type = items.find((it) => it.kind === "sentence")!;
      assert.equal(type.id, simple);
      // its own three, and the one the whole row waits on (SAK-468)
      assert.deepEqual(s.needs?.[simple], ["grammar:wa", "grammar:ga", "grammar:wo", "grammar:prenominal-form"]);
      // and what it waits on is on the page to be picked, here or in Grammar
      const offered = new Set(o.sections.flatMap((x) => x.items));
      for (const id of s.needs![simple]) assert.ok(offered.has(id), `${id} is not offered`);
      // the star itself is the same star for everybody: nothing about one
      // learner's place in the order is hung on it
      assert.equal(type.components, undefined);
      for (const text of [...(s.intro ? [s.intro] : []), ...(s.when ? [s.when] : [])]) {
        assert.ok(!/opens once/i.test(text), "no line saying what opens it");
      }
    });

    // SAK-487. Sam, 2026-09-26: "let's make wo required instead." Simple
    // waits on exactly は, が and を, and on nothing else of its own.
    it("waits on exactly は, が and を of its own", () => {
      const { s } = section(emptyHistory());
      const own = (s.needs?.[simple] ?? []).filter((id) => id !== NA);
      assert.deepEqual([...own].sort(), ["grammar:ga", "grammar:wa", "grammar:wo"]);
    });

    // 〜な is picked along with them here, since the whole row waits on it
    // too now (SAK-468); the row is what these picks are made in.
    it("is not offered to an empty sky, and is offered once は, が and を are picked", () => {
      assert.equal(open(emptyHistory(), []), false);
      assert.equal(open(emptyHistory(), [NA, "grammar:wa"]), false);
      assert.equal(open(emptyHistory(), [NA, "grammar:wa", "grammar:ga"]), false, "は and が are not enough now");
      assert.equal(open(emptyHistory(), [NA, "grammar:wa", "grammar:ga", "grammar:wo"]), true);
    });

    it("counts one learned and one picked the same way, and goes when the pick goes", () => {
      assert.equal(open(knows("wa"), [NA, "grammar:ga", "grammar:wo"]), true);
      assert.equal(open(emptyHistory(), [NA, "grammar:wa", "grammar:ga", "grammar:wo"]), true);
      assert.equal(open(emptyHistory(), [NA, "grammar:wa", "grammar:ga"]), false, "unpicking を takes it away again");
      assert.equal(open(emptyHistory(), [NA, "grammar:wa", "grammar:wo"]), false, "and so does unpicking が");
      assert.equal(open(emptyHistory(), ["grammar:wa", "grammar:ga", "grammar:wo"]), false, "and so does unpicking 〜な");
    });

    it("opens for good once the app's own rule opens it", () => {
      // the sample learner has met te-iru, one of the sequential type's
      // patterns, and the app's rule wants any one of them. They have met 〜な
      // too, so the row itself waits on nothing either.
      const { s, items } = section(sampleHistory(NOW));
      const type = items.find((it) => it.kind === "sentence")!;
      assert.equal(type.id, "writing-rule:sentence-rule-sequential");
      assert.deepEqual(s.needs, {}, "nothing left to wait on");
    });
  });

  it("drops what is already met, and every id it offers is an item", () => {
    const { o, s, items } = section(sampleHistory(NOW));
    assert.ok(s.started, "a learner part way through the track has started it");
    assert.ok(!items.some((it) => o.learned.has(it.id)), "nothing already learned is offered again");
    assert.ok(s.items.every((id) => !!o.items.get(id)), "every offered id was built");
  });
});

// SAK-468. 〜な led the Sentences row, and it is grammar rather than a
// sentence rule. Sam, 2026-09-17: "if that's grammar but is required, it's the
// first thing taught in grammar iirc. you can lock the sentence track behind
// learning it in the grammar track."
describe("the Grammar row, and the Sentences row behind it", () => {
  const rows = (history: HistoryFile) => {
    const o = offerings(history, NOW);
    return {
      o,
      grammar: o.sections.find((x) => x.id === "grammar")!,
      sentences: o.sections.find((x) => x.id === "sentences")!,
    };
  };
  /** 〜な claimed, the way a learner's own sky says it. */
  const claimed = (id: string): HistoryFile => {
    const history = emptyHistory();
    const entry = libEntry(patternEntry(id));
    assert.ok(entry, `${id} is a pattern`);
    for (const f of knownFactsOf(entry)) history.claims = { ...history.claims, [f]: NOW };
    return history;
  };

  it("offers 〜な first in Grammar, which is where the track teaches it first", () => {
    const { o, grammar } = rows(emptyHistory());
    assert.equal(grammar.title, "Grammar");
    assert.equal(o.items.get(grammar.items[0])!.glyph, "〜な");
    assert.equal(CURRICULUM_PATTERNS[0].id, "prenominal-form", "the grammar track's own first lesson");
  });

  it("makes the whole Sentences row wait on it, under the row's own id", () => {
    const { sentences } = rows(emptyHistory());
    assert.deepEqual(sentences.needs?.[sentences.id], ["grammar:prenominal-form"]);
    assert.ok(!sentences.items.includes("grammar:prenominal-form"), "and the row no longer holds it");
  });

  it("stops waiting once 〜な is claimed, and the row is offered as it was", () => {
    const { grammar, sentences } = rows(claimed("prenominal-form"));
    assert.equal(sentences.needs?.[sentences.id], undefined);
    assert.ok(!grammar.items.includes("grammar:prenominal-form"), "what is met is not offered again");
    assert.ok(grammar.started, "and the Grammar row is under way");
  });

  it("offers every pattern in one row or the other, and never in both", () => {
    const { o } = rows(emptyHistory());
    const both = o.sections.find((x) => x.id === "grammar")!.items
      .filter((id) => o.sections.find((x) => x.id === "sentences")!.items.includes(id));
    assert.deepEqual(both, [], "no pattern is on both rows");
  });
});

// SAK-442. A thing the learner has met stays met. Missing it over and over,
// and letting it go cold, makes it slipping, and slipping is a standing:
// something to practice when the learner chooses, never something the
// Observatory puts back on the list of things to learn. Sam has asked for
// this several times, so it is held here rather than only described.
describe("a met item that has slipped", () => {
  const DAY = 24 * 60 * 60 * 1000;

  /** The first word a new learner is offered: a real pick, at the front of
   * the words section, so its absence later means something. */
  const firstOffered = (): string => offerings(emptyHistory(), NOW).sections.find((s) => s.id === "words")!.items[0];

  const entryOfId = (id: string): LibEntry => {
    const entry = libEntry(id as Parameters<typeof libEntry>[0]);
    assert.ok(entry, `${id} is a library entry`);
    return entry;
  };

  /** Every fact of an entry: answered a dozen times, missed every one of
   * them, and last asked two months ago. Met by the counts, gone by the
   * model, which is the case Sam keeps describing. */
  const missedAndCold = (id: string): HistoryFile => {
    const history = emptyHistory();
    const agg: FactAggregate = {
      seen: 12, missed: 12, firstTry: 0, correct: 0,
      stability: 1, lastTested: NOW - 60 * DAY,
      recentRuns: Array.from({ length: 10 }, () => ({ firstTry: false, eventually: false })),
    };
    for (const f of knownFactsOf(entryOfId(id))) history.facts[f] = { ...agg };
    return history;
  };

  it("stays met, and its standing is slipping", () => {
    const id = firstOffered();
    const state = standingFor(entryOfId(id), missedAndCold(id), NOW);
    assert.equal(state.met, true, "answering it, even badly, is meeting it");
    assert.equal(state.standing, "slipping");
  });

  it("is never offered to be learned again, by any section", () => {
    const id = firstOffered();
    const o = offerings(missedAndCold(id), NOW);
    for (const section of o.sections) assert.ok(!section.items.includes(id), `${section.id} offers it again`);
    assert.ok(o.learned.has(id), "it counts as learned, so nothing downstream asks for it either");
  });

  it("is drilled in Practice, cut to slipping", () => {
    const id = firstOffered();
    const recipe = { ...EMPTY_RECIPE, collections: ["words"], statuses: ["slipping" as const], size: "all" as const };
    const preview = practicePreview(missedAndCold(id), recipe, NOW);
    assert.ok(preview.items.some((p) => p.item.id === id), "the slipping word is in the pool");
  });
});
