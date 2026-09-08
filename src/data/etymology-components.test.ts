// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test \
//        src/data/etymology-components.test.ts
//
// EVERY ORIGIN STORY NAMES ONLY PARTS THE GLYPH HAS (SAK-421)
// ===========================================================
// A kanji page shows two things side by side: the "Made of" tiles, which are the
// glyph's parts as the data records them, and the hand-written origin story,
// which walks the learner through those parts in prose. Nothing made the two
// agree. The content review (SAK-418, docs/content-review-2026-09.md) found 知
// telling the learner it is "an adult (大), a mouth (口), and a child (子)" while
// the tiles beside it read 矢 and 口, and guessed that class was the bulk of the
// origin-story doubts. It needs no reader: the prose names its pieces in a small
// number of fixed shapes, so the check is mechanical.
//
// WHAT IS CHECKED, EXACTLY
// -----------------------
// For each of the 2,136 stories: every glyph the story NAMES AS A PIECE is one
// of the glyph's own parts, or a part of one of those parts (depth two, since a
// story may name a part of a part: 岩's 石 sits inside nothing, but 崩's 山 and
// 月 do). Parts come from the taught decomposition — generated/kanji-components.json
// with kanji.ts's hand-written COMPS_OVERRIDE on top, which is what `KanjiRow.comps`
// and therefore the tiles hold. Both sides are collapsed through the variant map
// (亻 → 人, 氵 → 水, ⺼ → 肉; src/data/variant-forms.ts) so a story that writes the
// everyday character meets a tile that draws the radical form.
//
// WHAT IS OUT OF ITS REACH, AND SO NOT CHECKED
// -------------------------------------------
//   1. A story about the TRADITIONAL character ("This glyph is the simplified
//      form of 經 …") names that character's pieces, which the drawn glyph does
//      not have and should not be expected to. 199 stories.
//   2. A glyph the data records no decomposition for (皮, 生, 食) has no parts to
//      check a name against. 74 stories.
//   3. A sentence that says the shape CHANGED ("the sound of 囟, later corrupted
//      to look like 田") is not claiming the piece is there now, so its names are
//      not read as claims.
// Those three are counted here rather than asserted, so a change in their size
// is visible.
//
// A FAILURE IS A CONTENT BUG, NOT A TEST BUG. The story and the tiles are
// disagreeing in front of the learner. The fix is to the story, or to the
// decomposition, and never to this file except to move a glyph OFF the list
// below once its story is settled.

import assert from "node:assert/strict";
import test from "node:test";

import kanjiComponentsJson from "./generated/kanji-components.json" with { type: "json" };
import { KANJI, kanjiRow } from "./kanji.ts";
import { etymologyOf } from "./kanji-etymology.ts";
import { variantForm } from "./variant-forms.ts";

const COMPS: Readonly<Record<string, readonly string[]>> = (
  kanjiComponentsJson as { comps: Record<string, readonly string[]> }
).comps;

/**
 * Forms the two sides write with DIFFERENT codepoints for the same shape. The
 * variant map covers KanjiVG's own forms (亻, 氵, ⺨); this fills the gap on the
 * prose side, which follows the dictionaries into the CJK Radicals Supplement
 * (⺼, ⺡) and the orthodox characters (每, 曾). Every entry maps a form to the
 * SAME character the variant map (or plain identity) gives the everyday form, so
 * nothing new is claimed: it only lets a story's ⺼ reach the tile's 月.
 */
const EXTRA_FORMS: Readonly<Record<string, string>> = {
  "⺼": "肉",
  "⺡": "水",
  "⺾": "艸",
  "艹": "艸",
  "⺻": "聿",
  "⺗": "心",
  "辶": "辵",
  "⻌": "辵",
  "⻍": "辵",
  "𠆢": "人",
  "⺅": "人",
  "礻": "示",
  "衤": "衣",
  "钅": "金",
  "飠": "食",
  "⻞": "食",
  "纟": "糸",
  "每": "毎",
  "靑": "青",
  "彐": "彑",
  "⺕": "彑",
  "㐅": "乂",
  "曾": "曽",
  "卆": "卒",
  "犭": "犬",
  "黑": "黒",
  "黒": "黒",
  "齊": "斉",
  "斉": "斉",
};

/** Collapse a glyph to the form both sides agree on, transitively. */
function canonical(glyph: string): string {
  let g = glyph;
  for (let i = 0; i < 4; i++) {
    const next = EXTRA_FORMS[g] ?? variantForm(g)?.original;
    if (next === undefined || next === g) break;
    g = next;
  }
  return g;
}

/** A glyph's taught parts: the override where there is one, else KanjiVG's. */
function partsOf(glyph: string): readonly string[] {
  return kanjiRow(glyph)?.comps ?? COMPS[glyph] ?? [];
}

/** The glyph, its parts, and its parts' parts, each in both written forms. */
function partSet(kanji: string): ReadonlySet<string> {
  const out = new Set<string>([kanji, canonical(kanji)]);
  for (const a of partsOf(kanji)) {
    out.add(a);
    out.add(canonical(a));
    for (const b of partsOf(a)) {
      out.add(b);
      out.add(canonical(b));
    }
  }
  return out;
}

const CJK_RUN =
  /(?:[㐀-䶿一-鿿豈-﫿⺀-⻿⼀-⿟㇀-㇯]|[\uD840-\uD87F][\uDC00-\uDFFF])+/gu;

/** The single glyphs in a fragment. A run of two or more is a WORD (明日, 字統),
 * never a component, so it is passed over. */
function singleGlyphs(fragment: string): string[] {
  const out: string[] = [];
  for (const run of fragment.match(CJK_RUN) ?? []) {
    const chars = [...run];
    if (chars.length === 1) out.push(chars[0]);
  }
  return out;
}

function isGlyph(fragment: string): boolean {
  const hit = CJK_RUN.test(fragment);
  CJK_RUN.lastIndex = 0;
  return hit;
}

/** A sentence saying the shape MOVED ON is not claiming the piece is there now. */
const SHAPE_CHANGED =
  /\boriginal|\bearly form|\bold glyph|\bold form|\bonce\b|\blater\b|\bnow\b|corrupt|simplified form|\bfirst meant|\bancestor|borrowed|\bformerly|\bused to\b/i;

/** A story about the traditional character names ITS pieces, so the drawn
 * glyph's parts cannot settle it either way. */
const TRADITIONAL = /simplified form|traditional form|old form of|a variant of/i;

/**
 * The glyphs a story names as pieces of its kanji. Two shapes carry that claim,
 * and the house style (kanji-etymology-prose.ts) keeps the prose to them:
 *
 *   1. a parenthesis opening with a glyph, hung off the English name of the
 *      piece: "a mouth (口)", "(貝, money and gain)", "(彐 and 寸)". A parenthesis
 *      opening with prose is a remark, not a piece: "(the opposite of 下)".
 *   2. the phono-semantic frame: "the definition of 心", "the sound of 及",
 *      "見 for its sense", "単 for its sound".
 */
function namedPieces(text: string): readonly string[] {
  const found: string[] = [];
  for (const sentence of text.split(/(?<=\.)\s+/)) {
    if (SHAPE_CHANGED.test(sentence)) continue;
    for (const m of sentence.matchAll(/\(([^)]*)\)/g)) {
      const inner = m[1];
      if (!isGlyph([...inner][0] ?? "")) continue;
      found.push(...singleGlyphs(inner));
    }
    for (const m of sentence.matchAll(
      /(?:definitions?|sounds?|senses?) of ([^ ,.]+)/g,
    )) {
      found.push(...singleGlyphs(m[1]));
    }
    for (const m of sentence.matchAll(/([^ ,.]+) for its (?:sense|sound)/g)) {
      found.push(...singleGlyphs(m[1]));
    }
  }
  return [...new Set(found)];
}

interface Story {
  readonly glyph: string;
  readonly text: string;
}

function stories(): readonly Story[] {
  const out: Story[] = [];
  for (const k of KANJI) {
    const text = etymologyOf(k.c)?.originText;
    if (text) out.push({ glyph: k.c, text });
  }
  return out;
}

/** Stories the check can speak to, with the pieces they name that the glyph
 * does not have. */
function disagreements(): readonly { glyph: string; missing: string[] }[] {
  const out: { glyph: string; missing: string[] }[] = [];
  for (const { glyph, text } of stories()) {
    if (TRADITIONAL.test(text)) continue;
    if (partsOf(glyph).length === 0) continue;
    const set = partSet(glyph);
    const missing = namedPieces(text).filter(
      (g) => !set.has(g) && !set.has(canonical(g)),
    );
    if (missing.length) out.push({ glyph, missing });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The list. Every glyph whose story names a piece the glyph does not have, as
// of SAK-421, awaiting Sam's research: docs/content-review-2026-09.md, section
// "Origin stories, the rest". These are NOT approved wordings. The list is
// pinned the way source-pins.test.ts pins a deliberate difference, for the same
// reason: so a new one fails here instead of shipping quietly. Shrinking it as
// stories are settled is the point; growing it needs a reason in the commit.
// ---------------------------------------------------------------------------
const SAK_421_LIST =
  "強彙形得微徳徹急恐惰愛慶憂憩懇成承拐拳捗携撤支改教敢散敬敵敷斑斥施旅旋族旗既旦旨早旬昔春暴更書替最服期棄業樹款正武死段殿毒汚法泰津淫滅滴漢灰炉炊炭為焦然熊爽狂獄珍班琴甚畏畝畿疫癒癖監直省真睦知砂硫祭稚稲突競第範籍系素細絶維緊練繭罰羨翌老耗聖肥肯肺腎膚膝臨臭興舞色茶荒菌蔑虐融血衡表衷装襲見親設診豊豪貌負責貴賊賢質赤赦軍軟辣農退送逸遂道達適選那配酎里重野開闘陛陰陶隆隊難雪雷電青韓類飲飾香騰骨鬱麻";

test("every origin story names only pieces the glyph has, or is on the SAK-421 list", () => {
  const failing = disagreements();
  const unlisted = failing
    .filter(({ glyph }) => !SAK_421_LIST.includes(glyph))
    .map(({ glyph, missing }) => `${glyph} names ${missing.join(" ")}, which it is not made of`);
  assert.deepEqual(
    unlisted,
    [],
    "A story names a piece the glyph does not have. Fix the story (or the decomposition); do not add it to the list without a card.",
  );
});

test("the SAK-421 list has no stale entries", () => {
  const failing = new Set(disagreements().map((d) => d.glyph));
  const settled = [...SAK_421_LIST].filter((g) => !failing.has(g));
  assert.deepEqual(
    settled,
    [],
    "These stories now agree with the glyph's parts. Take them off SAK_421_LIST.",
  );
});

test("the check's reach is what the review says it is", () => {
  const all = stories();
  assert.equal(all.length, 2136, "Origin stories shown to a learner.");
  assert.equal(
    all.filter(({ text }) => TRADITIONAL.test(text)).length,
    199,
    "Stories about the traditional character, which the drawn parts cannot settle.",
  );
  assert.equal(
    all.filter(({ glyph }) => partsOf(glyph).length === 0).length,
    74,
    "Stories for a glyph the data records no decomposition for.",
  );
  assert.equal(
    disagreements().length,
    197,
    "Stories naming a piece the glyph does not have (the SAK-421 list).",
  );
});

test("知 is the case the review found by hand", () => {
  const missing = disagreements().find((d) => d.glyph === "知")?.missing;
  assert.deepEqual(missing, ["大", "子"]);
  assert.deepEqual([...partsOf("知")], ["矢", "口"]);
});

test("a piece named in a variant form still counts as present", () => {
  // 河's story says 水; the tiles draw 氵. That is the same piece, not a finding.
  assert.ok(!disagreements().some((d) => d.glyph === "河"));
  assert.equal(canonical("氵"), "水");
  assert.equal(canonical("⺼"), "肉");
});

test("a remark in parentheses is not read as a piece", () => {
  // 上: "marking what is above (the opposite of 下)" names no piece.
  assert.deepEqual(namedPieces("A short stroke above a long line (the opposite of 下)."), []);
  assert.deepEqual(namedPieces("A rock (石) on a mountain (山): a boulder."), ["石", "山"]);
  assert.deepEqual(
    namedPieces("It uses the definition of 心 (heart) and the sound of 及 (きゅう)."),
    ["心", "及"],
  );
});
