// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/lib/library/marks.test.ts
//
// WHAT THESE TESTS ARE FOR
// ========================
// The MARKS shelf holds nine entries that break three assumptions the Library
// was built on, and every one of them fails QUIETLY — a wrong page renders, no
// error is thrown, and you only notice by opening it.
//
//   AN ENTRY IS A CHARACTER. "Long vowels" is not. Its glyph is the empty
//   string, which is search-inert (`"".includes(q)` is false for every real
//   query), so if it is ever findable only by its glyph it is findable by
//   nothing, and a shelf entry with no route to it from the search box may as
//   well not exist.
//
//   AN ENTRY IS DRILLABLE. A mark is not. "What is a dakuten" has no gradeable
//   answer, and the guarantee is structural — marks publish no FactInfo — so what
//   these tests pin is that the structure holds: no facts, therefore no Drill
//   button, therefore nothing swept into a deck. A future hand adding a
//   plausible-looking `markFact()` would break it without touching any of this.
//
//   AN EXPLANATION IS AUTHORED WHERE IT IS SHOWN. The Library's copy is the
//   LESSON's copy, by reference. That is the whole justification for the shelf,
//   and the way it rots is someone editing one and not the other — which is
//   impossible while there is one object, and undetectable the moment there are
//   two. The identity checks below are what make it detectable.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  COMBO_H,
  DAKUTEN_H,
  INTRO_AFTER,
  INTRO_BEFORE,
  ITERATION_MARK,
  LONG_H,
  LONG_K,
  PHASE_INTROS,
  PUNCTUATION,
  RENDAKU,
  SOKUON_H,
} from "@/data/phase-intros";
import { DAKUTEN_ROWS } from "@/data/dakuten-rows";
import { MARKS, MARK_SUBJECT, bodyFor, markEntry, markFor } from "@/data/marks";
import { factsOf } from "@/lib/facts";
import { KINDS, factRows, libEntry } from "@/lib/library/entries";
import { sliceIsDrillable } from "@/lib/library/slice";
import { search } from "@/lib/library/search";
import { kindFromParams } from "@/lib/library/url-state";

const entryOfMark = (id: string) => {
  const e = libEntry(markEntry(id));
  assert.ok(e, `no Library entry for mark ${id}`);
  return e;
};

/** The one section a query put an entry in, or null. Search's own answer to
 * "why is this row in front of you". */
function whyFound(query: string, id: string): string | null {
  const want = markEntry(id);
  for (const s of search(query, { perSection: 50 })) {
    if (s.hits.some((h) => h.entry.id === want)) return s.why;
  }
  return null;
}

describe("the shelf exists and is reachable", () => {
  test("writing-rule is a Kind, and ?kind=writing-rule selects it", () => {
    // The URL kind value is `writing-rule`: the shelf is "Writing rules" on
    // screen, and the query value is the subject id, like `?kind=word`.
    assert.ok(KINDS.includes(MARK_SUBJECT));
    assert.equal(
      kindFromParams(new URLSearchParams("?kind=writing-rule")),
      MARK_SUBJECT,
    );
    // The old value no longer selects it: the rename moved the query value, and
    // a stale `?kind=mark` link falls back to the default shelf.
    assert.notEqual(
      kindFromParams(new URLSearchParams("?kind=mark")),
      MARK_SUBJECT,
    );
  });

  test("all nine marks are entries, and every entry route resolves", () => {
    assert.equal(MARKS.length, 9);
    for (const m of MARKS) {
      const e = entryOfMark(m.id);
      assert.equal(e.kind, MARK_SUBJECT);
      // The round trip the entry page makes: id → entry → the mark it names.
      assert.equal(markFor(e.id)?.id, m.id);
    }
  });

  test("the three reading-rule marks resolve, round-trip and stay inert", () => {
    // 々, rendaku and punctuation break the same three assumptions the first
    // five do (a character, a drill, both scripts), so they are held to the same
    // structural guarantees: they resolve, they carry no readings and no facts,
    // and nothing about them is drillable.
    for (const id of ["iteration-mark", "rendaku", "punctuation"]) {
      const e = entryOfMark(id);
      assert.equal(e.kind, MARK_SUBJECT);
      assert.equal(markFor(e.id)?.id, id);
      assert.deepEqual(e.readings, [], `${id} grew a reading`);
      assert.deepEqual(factsOf(markEntry(id)), [], `${id} grew a fact`);
      assert.equal(
        sliceIsDrillable({ label: id, entries: [markEntry(id)] }),
        false,
        `${id} offered a Drill button`,
      );
    }
  });

  test("a mark's name is its heading and its rule is the line under it", () => {
    // The arrangement every existing renderer already knows how to print: the
    // row's main line and the page's PageTitle both take `meanings`; the note and
    // the sub-line both take `sub`.
    const dakuten = entryOfMark("dakuten");
    assert.deepEqual(dakuten.meanings, ["Dakuten"]);
    assert.match(dakuten.sub, /voice/i);
    // NO READINGS: ゛ is not pronounced, and a romaji-shaped string here would be
    // exact-matched by search and handed to a speech synthesiser.
    assert.deepEqual(dakuten.readings, []);
  });
});

describe("an entry is not always a character", () => {
  test("long vowels has no glyph, and nothing pretends otherwise", () => {
    const long = entryOfMark("long-vowel");
    assert.equal(long.glyph, "", "a placeholder glyph got stuffed in");
    // The name is what stands in wherever a glyph would have been rendered as a
    // label — the breadcrumb, an aria-label.
    assert.equal(long.name, "Long vowels");
  });

  test("the four that DO have a written token carry it", () => {
    assert.equal(entryOfMark("dakuten").glyph, "゛");
    assert.equal(entryOfMark("handakuten").glyph, "゜");
    assert.equal(entryOfMark("small-tsu").glyph, "っ");
    assert.equal(entryOfMark("small-ya").glyph, "ゃゅょ");
  });

  test("a glyphless entry is still findable — by name and by alias", () => {
    // The failure this guards is total: with an empty glyph, all three of
    // search's glyph tests are false, so if the alias path or the meaning path
    // breaks, "long vowels" becomes an entry on a shelf with no route from the
    // search box at all.
    // ONE WORD, and that is search's rule rather than this shelf's: English
    // matching is token-prefix (see `matchesMeaning`), so a multi-word query has
    // never matched anything and "long vowels" typed in full finds nothing here
    // either. Pinned as "long" so this test asserts what the app does.
    assert.ok(whyFound("long", "long-vowel"), "not found by its name");
    assert.ok(whyFound("vowel", "long-vowel"), "not found by 'vowel'");
    assert.equal(whyFound("ー", "long-vowel"), "exact", "not found by ー");
    assert.ok(whyFound("chouonpu", "long-vowel"), "not found by the jargon");
  });

  test("the jargon this app never prints is still typeable", () => {
    // sokuon / yōon are what every other resource calls these. The app's own
    // pages say "small っ", and search has to answer to both.
    assert.ok(whyFound("sokuon", "small-tsu"));
    assert.ok(whyFound("yoon", "small-ya"));
    assert.ok(whyFound("dakuten", "dakuten"));
    assert.ok(whyFound("handakuten", "handakuten"));
  });

  test("a mark's own glyph finds it", () => {
    assert.equal(whyFound("゛", "dakuten"), "exact");
    assert.equal(whyFound("゜", "handakuten"), "exact");
    assert.equal(whyFound("っ", "small-tsu"), "exact");
  });
});

describe("a mark is not drillable, and not by omission", () => {
  test("no mark has a single fact", () => {
    for (const m of MARKS) {
      assert.deepEqual(
        factsOf(markEntry(m.id)),
        [],
        `${m.id} grew a fact — the drill can now ask "what is a ${m.name}"`,
      );
    }
  });

  test("no mark page offers a Drill button", () => {
    // The bar's own rule, asked the way the bar asks it.
    for (const m of MARKS) {
      assert.equal(
        sliceIsDrillable({ label: m.name, entries: [markEntry(m.id)] }),
        false,
      );
    }
  });

  test("selecting every mark at once still drills nothing", () => {
    // The multi-select path: every mark toggled on and unioned into one slice is
    // still zero questions, so nothing is swept into a deck by selecting a shelf.
    const all = {
      label: `${MARKS.length} selected`,
      entries: MARKS.map((m) => markEntry(m.id)),
    };
    assert.deepEqual(sliceIsDrillable(all), false);
  });

  test("a mark has no facts table — not an empty one", () => {
    // The precedent the 114 reading-less kanji set: no rows means the page
    // renders no section, rather than a headed box with a header row in it.
    for (const m of MARKS) {
      assert.deepEqual(factRows(entryOfMark(m.id)), []);
    }
  });
});

describe("the Library shows the LESSON's explanation, not a copy of it", () => {
  test("each mark points at the phase intros, by reference", () => {
    // Identity, not deep-equality: the point is that there is ONE object. A copy
    // that happened to be equal today is the drift this whole shelf exists to
    // prevent, and it would pass a deepEqual.
    const marks = new Map(MARKS.map((m) => [m.id, m]));
    assert.equal(marks.get("dakuten")?.intros[0], DAKUTEN_H);
    assert.equal(marks.get("small-ya")?.intros[0], COMBO_H);
    assert.equal(marks.get("small-tsu")?.intros[0], SOKUON_H);
    assert.equal(marks.get("long-vowel")?.intros[0], LONG_H);
    // The three reading-rule marks carry ONE intro each, by reference too.
    assert.equal(marks.get("iteration-mark")?.intros[0], ITERATION_MARK);
    assert.equal(marks.get("rendaku")?.intros[0], RENDAKU);
    assert.equal(marks.get("punctuation")?.intros[0], PUNCTUATION);
  });

  test("both scripts are carried, because they are not always the same rule", () => {
    // The five kana-era marks are taught once per script and carry both.
    const kanaEra = ["dakuten", "handakuten", "small-tsu", "small-ya", "long-vowel"];
    const byId = new Map(MARKS.map((m) => [m.id, m]));
    for (const id of kanaEra) {
      assert.deepEqual(
        byId.get(id)!.intros.map((i) => i.setId),
        ["hiragana", "katakana"],
        `${id} does not carry both scripts`,
      );
    }
    // Long vowels is the case that forces it: hiragana doubles a vowel kana,
    // katakana uses one ー, and a page showing only the first teaches half a rule.
    assert.notEqual(LONG_H.title, LONG_K.title);
  });

  test("the three reading-rule marks carry a single script-neutral intro", () => {
    // 々, rendaku and punctuation are the same rule whichever script spells the
    // words around them, so a second per-script copy would be the same card
    // twice. Their one intro is script-neutral: setId "" (NO_SCRIPT), which the
    // Library's script label prints nothing for. See marks.ts.
    for (const id of ["iteration-mark", "rendaku", "punctuation"]) {
      const byId = new Map(MARKS.map((m) => [m.id, m]));
      assert.deepEqual(
        byId.get(id)!.intros.map((i) => i.setId),
        [""],
        `${id} does not carry exactly one script-neutral intro`,
      );
    }
  });

  test("the conversions come from dakuten-rows, split by their own mark", () => {
    const marks = new Map(MARKS.map((m) => [m.id, m]));
    const dak = marks.get("dakuten")?.rows ?? [];
    const han = marks.get("handakuten")?.rows ?? [];
    // Four conversions × two scripts for ゛ (k→g, s→z, t→d, h→b); one × two for ゜.
    assert.equal(dak.length, 8);
    assert.equal(han.length, 2);
    assert.equal(dak.length + han.length, DAKUTEN_ROWS.length);
    assert.ok(dak.every((r) => r.mark === "゛"));
    assert.ok(han.every((r) => r.mark === "゜"));
    // By reference again — these are the rows the lesson's ConversionCard gets.
    assert.ok(dak.every((r) => DAKUTEN_ROWS.includes(r)));
  });

  test("the two marks sharing one lesson card each get their own half", () => {
    // DAKUTEN_H teaches ゛ and ゜ on one card, which is right in a lesson and
    // wrong on two pages. The split is by the copy's own `mark` tag.
    const dak = bodyFor(DAKUTEN_H, "゛");
    const han = bodyFor(DAKUTEN_H, "゜");
    assert.ok(dak.some((p) => p.mark === "゛"));
    assert.ok(!dak.some((p) => p.mark === "゜"), "the ゜ paragraph leaked onto ゛");
    assert.ok(han.some((p) => p.mark === "゜"));
    assert.ok(!han.some((p) => p.mark === "゛"), "the ゛ paragraph leaked onto ゜");
    // The untagged closing paragraph is about neither mark specifically and is
    // true of both, so it goes to both.
    const shared = DAKUTEN_H.body.filter((p) => p.mark === undefined);
    assert.equal(shared.length, 1);
    assert.ok(dak.includes(shared[0]!) && han.includes(shared[0]!));
  });

  test("a mark whose copy has no tagged paragraphs keeps all of it", () => {
    // bodyFor is the identity for four of the five marks. If it ever silently
    // dropped a paragraph, those pages would lose teaching with nothing to show
    // for it.
    assert.deepEqual(bodyFor(LONG_H, ""), LONG_H.body);
    assert.deepEqual(bodyFor(COMBO_H, "ゃゅょ"), COMBO_H.body);
  });
});

describe("the small-tsu copy, which is the one thing authored for this shelf", () => {
  test("it is in PHASE_INTROS and anchored to close the hiragana run", () => {
    // This test used to pin the OPPOSITE state — authored here, rendered by the
    // Library, deliberately anchored nowhere, because the kana curriculum had no
    // small-つ section to hang it on. That was never meant to be permanent; it
    // was meant to make wiring it in a deliberate act rather than a drift. It has
    // now been wired in deliberately, and this pins WHERE, for the same reason:
    // so that moving it is also a deliberate act.
    assert.ok(PHASE_INTROS.includes(SOKUON_H));
    const after = INTRO_AFTER["h-pya"] ?? [];
    assert.ok(
      after.includes(SOKUON_H),
      "the sokuon card lost its anchor on the last combo group",
    );
    // LAST, not merely present: small っ closes the script, after long vowels.
    // Both cards share this anchor, so "is it there" would pass with the order
    // reversed and the placement is the thing being asserted.
    assert.equal(after[after.length - 1], SOKUON_H);
    // And every other card is still anchored exactly once, so this cannot pass
    // by the anchor tables having grown duplicates or emptied out. PUNCTUATION
    // now rides the front of the hiragana after-run, so the count is nine (eight
    // kana anchors plus it); 々 and rendaku are word-gated, not anchored, so they
    // are deliberately absent here.
    const anchored = [
      ...Object.values(INTRO_BEFORE),
      ...Object.values(INTRO_AFTER).flat(),
    ];
    assert.equal(anchored.length, 9);
    assert.equal(new Set(anchored).size, 9);
  });
});

describe("ぁぃぅぇぉ — the sixth candidate, and where it went", () => {
  test("it is a line on the small-kana page, not an entry of its own", () => {
    const marks = new Map(MARKS.map((m) => [m.id, m]));
    assert.ok(!marks.has("small-vowel"));
    const note = marks.get("small-ya")?.note ?? "";
    assert.match(note, /ぁぃぅぇぉ/);
    // The reason it is one line: same mechanism as ゃゅょ, and the app teaches
    // none of the sounds it writes.
    assert.match(note, /ファ/);
    // Nothing else carries a note, so the call-out is not quietly becoming the
    // place marks put their overflow.
    assert.deepEqual(
      MARKS.filter((m) => m.note).map((m) => m.id),
      ["small-ya"],
    );
  });
});
