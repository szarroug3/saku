// Hand-authored tips for telling look-alike kana and kanji apart
// (#BuildHybridAI).
//
// LOOKALIKES (characters.ts) says which kana get mixed up; nothing in the app
// said how to tell them apart, and for シ/ツ and ソ/ン the whole difference is
// which way the strokes run. The mix-up coach (src/app/(sky)/mixup-facts.ts)
// hands the model the tip for a pair, and it may only describe a shape that a
// tip or a fact describes, so these sentences are what keep it from making
// strokes up.
//
// One tip per LOOKALIKES group, written to read from any member's side, and
// one for each kanji pair the sample learner mixes up (sample-learner.ts),
// since those have no parts to compare and the model invented a story for
// 人/入 without one. Same
// bar as radical-tips.ts: would a learner be helped by this sentence. Written
// 2026-11-14 for review; Sam has not checked them yet.

export const SHAPE_TIPS: readonly { readonly group: readonly string[]; readonly tip: string }[] = [
  { group: ["シ", "ツ"], tip: "シ's two short strokes sit on the left, one above the other, and its long stroke sweeps up from the bottom. ツ's two short strokes sit side by side along the top, and its long stroke falls down from the top right." },
  { group: ["ソ", "ン"], tip: "ソ's short stroke is at the top, and its long stroke falls from the top right down to the left. ン's short stroke is on the left, and its long stroke sweeps up from the bottom left to the right." },
  { group: ["ク", "ワ", "フ", "ウ"], tip: "フ is one stroke: a flat top that bends down to the left. ク adds a short stroke at the top left. ワ adds a short stroke straight down on the left, so it looks like a box with no bottom. ウ is ワ with a small tick on top." },
  { group: ["コ", "ユ"], tip: "コ is a box with its left side open. ユ has a long flat bottom line that runs out past its right side." },
  { group: ["ス", "ヌ"], tip: "Both start like フ. ス adds one stroke going down to the right. ヌ adds a short stroke that crosses the first one." },
  { group: ["チ", "テ"], tip: "チ has one flat line, with a stroke that runs down through it and curves to the left. テ has two flat lines, and its last stroke hangs from the lower one." },
  { group: ["ナ", "メ"], tip: "ナ is a flat line crossed by a stroke that curves down to the left. メ has no flat line: two slanted strokes cross like an X." },
  { group: ["ね", "れ", "わ"], tip: "All three start with the same tall stroke on the left. ね ends in a small loop at the bottom right, れ ends in a tail that kicks out to the right, and わ ends in a round curve with no loop and no tail." },
  { group: ["ぬ", "め"], tip: "ぬ ends in a small loop at the bottom right. め has no loop." },
  { group: ["る", "ろ"], tip: "る ends in a small loop at the bottom. ろ ends open, with no loop." },
  { group: ["は", "ほ"], tip: "ほ has an extra flat line across the top of its right side. は does not." },
  { group: ["き", "さ"], tip: "き has two flat lines across the top. さ has one." },
  { group: ["た", "な"], tip: "た ends with two short flat strokes on the right. な ends with a loop at the bottom right." },
  { group: ["あ", "お"], tip: "お has a separate dot at the top right. あ has no dot, and its line crosses through the loop." },
  { group: ["日", "目"], tip: "日 has one line across the middle, making two boxes. 目 is taller and has two lines inside, making three." },
  { group: ["人", "入"], tip: "In 人 the left stroke is the long one and the right stroke leans against it. In 入 it's the other way round: the right stroke is the long one, and a short stroke leans into it from the top left." },
  { group: ["大", "犬"], tip: "犬 is 大 with a dot at the top right." },
  { group: ["木", "本"], tip: "本 is 木 with a short flat line across the bottom of its trunk." },
  { group: ["土", "士"], tip: "In 土 the bottom line is the longer one. In 士 the top line is the longer one." },
];

/** The shape tip for two look-alikes, when Saku has one. */
export function shapeTip(x: string, y: string): string | undefined {
  return SHAPE_TIPS.find(({ group }) => group.includes(x) && group.includes(y))?.tip;
}
