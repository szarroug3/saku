// Plain-language etymology stories for the number kanji 一…十.
//
// These were held out of every automated pass (isNumberKanji excluded them) while
// numbers were taught as pure memorised wholes with no Built-from. That is now
// relaxed: the section shows for numbers too. It is safe because the etymology
// layer only tiles GENUINE pieces — 三 = 一+一+一 and 二 = 一+一 (both drawn from
// stacked 一) — and leaves the rest story-only, so the old misleading shape pieces
// (六's 八, 四's 儿) never appear as "part of the number". Most numbers are ancient
// pictographs borrowed for their sound, which the story tells honestly.
export const NUMBERS: Readonly<Record<string, string>> = {
  一: "The original glyph was a single horizontal stroke, standing for one.",
  二: "Two strokes stacked, doubled 一 (one): two.",
  三: "Three strokes stacked, tripled 一 (one): three.",
  四: "The original glyph pictured a nose exhaling. It was later borrowed to write four, which had first been drawn as four strokes. In everyday counting, よん is usually preferred to し because し sounds exactly like 死 (death).",
  五: "The original glyph was an X between two lines. Its first meaning is unclear, and it came to stand for five.",
  六: "The original glyph may have pictured a shed. It was borrowed to write six because the words sounded alike.",
  七: "The original glyph was one stroke cut across another, the early form of 切 (to cut). It was borrowed to write seven. In everyday counting, なな is often preferred to しち because しち can be misheard as いち (one).",
  八: "The original glyph was two lines splitting apart, meaning to divide. It was borrowed to write eight because the words sounded alike.",
  九: "The original glyph pictured a bent arm and hand. It was borrowed to write nine. In everyday counting, きゅう is usually preferred to く because く sounds like 苦 (suffering).",
  十: "The original glyph was a single vertical stroke for ten, with a crossbar added later.",
};
