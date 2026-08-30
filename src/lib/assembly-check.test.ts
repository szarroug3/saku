import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assemblyMismatchMessage,
  chunkRoleLabels,
  findAssemblyMismatch,
  pieceGloss,
  pieceLabel,
} from "./assembly-check.ts";
import type { AssemblyItem } from "../data/assembly.ts";
import { vocabRow, vocabRowsBySpelling, wordMeaningFactId } from "../data/vocab.ts";
import type { HistoryFile } from "../types/index.ts";

const NOBODY: HistoryFile = { sessions: [], facts: {} };

/** A learner who has claimed 水's meaning, knows that one word, nothing else. */
const KNOWS_WATER: HistoryFile = {
  sessions: [],
  facts: {},
  claims: { [wordMeaningFactId("水")]: 1_700_000_000_000 },
};

/** A "simple" (topic → core → ending) item — the same shape id -1 has in the
 * curated corpus (src/data/assembly.ts). */
const SIMPLE_ITEM: AssemblyItem = {
  id: -1,
  en: "I say that.",
  jp: "私はそれを言う。",
  pieces: [
    { t: "私は", h: "私" },
    { t: "それを", h: "それ" },
    { t: "言う。", h: "言う" },
  ],
  v: ["私", "それ", "言う"],
  p: ["wo"],
};

/** A "request" (context → target → action → ending) item — id -203 in the
 * curated corpus, four pieces so a mid-sentence swap is distinguishable from
 * an edge swap. */
const REQUEST_ITEM: AssemblyItem = {
  id: -203,
  en: "Please write your name here.",
  jp: "ここに名前を書いてください。",
  pieces: [
    { t: "ここに", h: "ここ" },
    { t: "名前を", h: "名前" },
    { t: "書いて", h: "書く" },
    { t: "ください。", h: "くださる" },
  ],
  v: ["ここ", "名前", "書く", "くださる"],
  p: ["te-request"],
};

describe("chunkRoleLabels", () => {
  test("returns the tier's role labels in canonical order when piece counts match", () => {
    assert.deepEqual(chunkRoleLabels("simple", 3), [
      "Topic",
      "Object",
      "Action",
    ]);
  });

  test("returns null for an unknown tier", () => {
    assert.equal(chunkRoleLabels(null, 3), null);
  });

  test("returns null when the item's piece count doesn't match the tier's role count", () => {
    // "simple" has exactly 3 roles (topic, core, ending); a 4-piece item
    // can't be labeled positionally without guessing which role is missing.
    assert.equal(chunkRoleLabels("simple", 4), null);
  });

  // SAK-254: "sequential" is a plain topic-first frame (私は/それを/
  // 言ってしまった。), same shape as "simple" — it used to be declared
  // core-first (a stray copy of causal's subordinate-clause-first shape),
  // which named それを "Who" and 私は "Where or what" on a wrong check.
  test("sequential labels topic before core, matching its actual topic-first sentences", () => {
    assert.deepEqual(chunkRoleLabels("sequential", 3), [
      "Who",
      "Where or what",
      "Action + added meaning",
    ]);
  });

  // SAK-254: contrast genuinely puts its setup clause (のに/ないで) first —
  // unlike sequential, this one was already right; regression-guard it too.
  test("contrast labels core (the setup clause) before topic", () => {
    assert.deepEqual(chunkRoleLabels("contrast", 3), [
      "First situation",
      "Who the result is about",
      "What happened",
    ]);
  });
});

describe("findAssemblyMismatch", () => {
  test("returns null when the tray already matches the canonical order", () => {
    const tray = SIMPLE_ITEM.pieces.map((p) => p.t);
    assert.equal(findAssemblyMismatch(SIMPLE_ITEM, tray, "simple"), null);
  });

  test("identifies the first out-of-place chunk and names it with the tier's role label", () => {
    // Canonical: 私は(topic) それを(core) 言う。(ending)
    // Built:     それを(core) 私は(topic) 言う。(ending) — the first two are swapped.
    const tray = ["それを", "私は", "言う。"];
    const mismatch = findAssemblyMismatch(SIMPLE_ITEM, tray, "simple");
    assert.ok(mismatch);
    // それを belongs at canonical index 1 ("core" / "Object"), but the
    // learner placed it first (tray index 0).
    assert.equal(mismatch.canonIndex, 1);
    assert.equal(mismatch.trayIndex, 0);
    assert.equal(mismatch.surface, "それを");
    assert.equal(mismatch.label, "Object");
    assert.equal(assemblyMismatchMessage(mismatch), "Object is out of place.");
  });

  test("finds a mismatch buried in the middle of a longer sentence", () => {
    // Canonical: ここに(context) 名前を(target) 書いて(action) ください。(ending)
    // Built: swap target and action.
    const tray = ["ここに", "書いて", "名前を", "ください。"];
    const mismatch = findAssemblyMismatch(REQUEST_ITEM, tray, "request");
    assert.ok(mismatch);
    assert.equal(mismatch.trayIndex, 1);
    assert.equal(mismatch.surface, "書いて");
    assert.equal(mismatch.canonIndex, 2); // "action"
    assert.equal(mismatch.label, "Action");
  });

  test("falls back to a positional message when no tier/role data is available", () => {
    // A generated-corpus item has no known tier (sentenceOrderingTierForItem
    // returns null for compound/ambiguous items) — the message should still
    // name a specific chunk, just without the semantic label.
    const tray = ["それを", "私は", "言う。"];
    const mismatch = findAssemblyMismatch(SIMPLE_ITEM, tray, null);
    assert.ok(mismatch);
    assert.equal(mismatch.label, null);
    assert.equal(assemblyMismatchMessage(mismatch), "Chunk 2 is out of place.");
  });

  test("returns null when the tray length doesn't match the canonical length", () => {
    assert.equal(findAssemblyMismatch(SIMPLE_ITEM, ["私は", "それを"], "simple"), null);
  });

  test("a single misplaced piece near the end is still found", () => {
    // Canonical: 私は それを 言う。 — only the last two are swapped.
    const tray = ["私は", "言う。", "それを"];
    const mismatch = findAssemblyMismatch(SIMPLE_ITEM, tray, "simple");
    assert.ok(mismatch);
    assert.equal(mismatch.trayIndex, 1);
    assert.equal(mismatch.surface, "言う。");
    assert.equal(mismatch.canonIndex, 2);
    assert.equal(mismatch.label, "Action");
  });

  // SAK-254 repro: "私はそれを言ってしまった。" (sequential tier, id -11's shape
  // in src/data/assembly.ts) built with 私は and それを swapped. Before the
  // fix this named 私は "Where or what" and それを "Who" — backwards.
  test("SAK-254: sequential names a swapped topic/core pair correctly", () => {
    const SEQUENTIAL_ITEM: AssemblyItem = {
      id: -11,
      en: "I accidentally said that.",
      jp: "私はそれを言ってしまった。",
      pieces: [
        { t: "私は", h: "私" },
        { t: "それを", h: "それ" },
        { t: "言ってしまった。", h: "言う" },
      ],
      v: ["私", "それ", "言う"],
      p: ["te-shimau"],
    };
    const tray = ["それを", "私は", "言ってしまった。"];
    const mismatch = findAssemblyMismatch(SEQUENTIAL_ITEM, tray, "sequential");
    assert.ok(mismatch);
    // それを belongs at canonical index 1 ("core" / "Where or what"); 私は
    // (canonical index 0, "topic" / "Who") is what the learner misplaced it
    // ahead of.
    assert.equal(mismatch.canonIndex, 1);
    assert.equal(mismatch.surface, "それを");
    assert.equal(mismatch.label, "Where or what");
  });

  // SAK-254: contrast's setup-first frame (のに/ないで, then topic) applied
  // to the corpus's own -71 shape ("傘を持たないで、私は出た。") — a swap of
  // the setup clause and the topic should name the setup clause, not "Who".
  test("SAK-254: contrast names a swapped core/topic pair correctly", () => {
    const CONTRAST_ITEM: AssemblyItem = {
      id: -71,
      en: "I left without taking an umbrella.",
      jp: "傘を持たないで、私は出た。",
      pieces: [
        { t: "傘を持たないで、", h: "持つ" },
        { t: "私は", h: "私" },
        { t: "出た。", h: "出る" },
      ],
      v: ["私", "傘", "持つ", "出る"],
      p: ["nai-de"],
    };
    const tray = ["私は", "傘を持たないで、", "出た。"];
    const mismatch = findAssemblyMismatch(CONTRAST_ITEM, tray, "contrast");
    assert.ok(mismatch);
    // 私は belongs at canonical index 1 ("topic" / "Who the result is
    // about"); the learner placed it first, ahead of the setup clause.
    assert.equal(mismatch.canonIndex, 1);
    assert.equal(mismatch.surface, "私は");
    assert.equal(mismatch.label, "Who the result is about");
  });
});

describe("pieceLabel (SAK-50 changes-requested pass)", () => {
  test("strips a trailing 。 from the last piece", () => {
    assert.equal(pieceLabel("言う。"), "言う");
  });

  test("strips a trailing ？ or ！ the same way", () => {
    assert.equal(pieceLabel("食べる？"), "食べる");
    assert.equal(pieceLabel("走れ！"), "走れ");
  });

  test("a piece with no trailing punctuation is unchanged", () => {
    assert.equal(pieceLabel("それを"), "それを");
  });

  test("a piece that is punctuation only reduces to empty, not undefined", () => {
    assert.equal(pieceLabel("。"), "");
  });
});

describe("pieceGloss (SAK-87)", () => {
  test("null for a bare particle piece (h is null), even for a learner who knows nothing", () => {
    assert.equal(pieceGloss(null, NOBODY), null);
  });

  test("returns the word's glosses when the headword is not yet known", () => {
    const row = vocabRow("水");
    assert.ok(row, "fixture assumes 水 is in the vocabulary");
    assert.equal(pieceGloss("水", NOBODY), row.glosses.join(", "));
  });

  test("null once the headword IS known, nothing to add for met vocabulary", () => {
    assert.equal(pieceGloss("水", KNOWS_WATER), null);
  });

  test("a different unknown word is unaffected by KNOWS_WATER's claim", () => {
    const row = vocabRow("本");
    assert.ok(row, "fixture assumes 本 is in the vocabulary");
    assert.equal(pieceGloss("本", KNOWS_WATER), row.glosses.join(", "));
  });

  test("null for a lemma the vocabulary doesn't contain at all", () => {
    assert.equal(pieceGloss("асдф", NOBODY), null);
  });

  test("resolves a reb-only spelling the same dual-spelling way lemmaKnown does", () => {
    // Tatoeba's tokeniser emits みる, not 見る's keb: the exact case
    // src/lib/grammar/readable.ts documents as the reason lemmaKnown matches
    // on keb OR reb. pieceGloss must resolve through reb the same way, not
    // just by keb (vocabRow("みる") alone would find nothing).
    assert.equal(vocabRow("みる"), undefined);
    const candidates = vocabRowsBySpelling("みる");
    assert.ok(candidates.length > 0, "fixture assumes みる resolves by reb");
    assert.equal(pieceGloss("みる", NOBODY), candidates[0].glosses.join(", "));
  });
});
