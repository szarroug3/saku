import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SETS, isExtendedSection } from "@/data/characters";
import { COMBO_H, COMBO_K } from "@/data/phase-intros";
import { MARKS } from "@/data/marks";

// The app used to call yōon "combo", its own coinage. The owner ruled: use the
// real word, and TEACH it before leaning on it. These pin both halves.

const SECTION_LABELS = SETS.flatMap((s) => s.sections.map((sec) => sec.label));

function bodyText(intro: { title: string; body: readonly { text: string }[] }) {
  return [intro.title, ...intro.body.map((p) => p.text)].join(" ");
}

describe("yōon replaces combo on every user-facing surface", () => {
  test("no kana section label still says Combo", () => {
    for (const label of SECTION_LABELS) {
      assert.ok(!/combo/i.test(label), `label still says combo: ${label}`);
    }
  });

  test("the small-kana rows are labelled Yōon, and still count as extended", () => {
    const yoon = SECTION_LABELS.filter((l) => l.startsWith("Yōon "));
    assert.equal(yoon.length, 24, "expected 12 yōon rows per script");
    for (const label of yoon) {
      assert.ok(isExtendedSection(label), `${label} is not an extended section`);
    }
  });

  test("the lesson copy says yōon, never combo", () => {
    for (const intro of [COMBO_H, COMBO_K]) {
      assert.ok(!/combo/i.test(bodyText(intro)), `${intro.id} still says combo`);
    }
  });

  test("the word is introduced before it is leaned on", () => {
    // COMBO_H is the hiragana card, taught first (see INTRO_AFTER ordering). It
    // must DEFINE yōon, not just use it — the definition is the "fused onto the
    // kana in front of it" clause the owner named.
    const intro = COMBO_H.body.find((p) => /yōon/.test(p.text));
    assert.ok(intro, "COMBO_H never names yōon");
    assert.match(intro.text, /yōon/);
    assert.match(intro.text, /fused? onto/i);

    // COMBO_K, the katakana card, is taught after and may simply lean on it.
    assert.ok(/yōon/.test(bodyText(COMBO_K)), "COMBO_K does not use the word");
  });

  test("search still answers to the jargon", () => {
    const smallYa = MARKS.find((m) => m.id === "small-ya");
    assert.ok(smallYa);
    assert.ok(smallYa.searchAlso.includes("yoon"), "lost the yoon alias");
    assert.ok(smallYa.searchAlso.includes("yōon"), "no macron alias");
    assert.ok(!smallYa.searchAlso.includes("combos"), "combo alias not retired");
  });
});
