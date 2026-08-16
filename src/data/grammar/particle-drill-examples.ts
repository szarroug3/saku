// Real example-sentence data for the particle "tap the marked word" drill —
// see docs/particle-teaching-workplan.md "Package 3". This is a SEPARATE,
// larger dataset from authored.ts's 11 particle rows: those stay the small
// "one reference example per particle" set shown on the Library page.
// authored.ts is not touched or read by this file.
//
// SOURCING
// ========
// は/が/を/に/で rows are MINED from src/data/generated/assembly-corpus.json
// (see scripts/mine-particle-drill-examples.ts) — each comes from a corpus
// piece `{t, h}` where `t` is exactly `h` plus the bare particle (nothing
// else), and the target particle occurs exactly once in the whole sentence.
// That exact-remainder rule is what keeps out the いいのに false positive the
// workplan calls out: "いい" + "のに" has a remainder of "のに", not "に", so it
// never becomes a に candidate in the first place.
//
// へ/まで/だけ/しか rows are hand-authored — the corpus has almost no clean
// single-occurrence hits for these four, same reasoning as authored.ts's own
// hand-authored わけだ lane.

import { recipe } from "./recipes.ts";

export interface ParticleDrillExample {
  /** Negative, like authored.ts's convention — never a Tatoeba permalink. */
  readonly id: number;
  readonly recipe: string; // "wa" | "ga" | "wo" | "ni" | "de" | "e" | "made" | "dake" | "shika-nai"
  readonly jp: string;
  readonly en: string;
  /** The particle's own span — [start, end) into `jp`. */
  readonly particleSpan: readonly [number, number];
  /** The word/phrase span the particle marks — [start, end) into `jp`. This
   * is the thing the drill asks the learner to tap. */
  readonly markedWordSpan: readonly [number, number];
  /** Other tappable chunks in the sentence, for multiple-choice distractors —
   * e.g. the predicate, or another particle-marked phrase. At least one. */
  readonly distractorSpans: readonly (readonly [number, number])[];
}

/** A row before its spans are resolved. `markedWord` immediately followed by
 * `particleText` must appear exactly once in `jp` — that contiguous slice is
 * the whole reason a row is safe to mine or write by hand: no guessing at
 * word boundaries. Each `distractors` entry must also appear exactly once,
 * elsewhere in `jp`. */
interface RawRow {
  readonly id: number;
  readonly recipe: string;
  readonly jp: string;
  readonly en: string;
  readonly markedWord: string;
  readonly particleText: string;
  readonly distractors: readonly string[];
}

// --- は — mined from assembly-corpus.json (12 of 62 candidates) -----------
const WA: readonly RawRow[] = [
  { id: -1, recipe: "wa", jp: "私は寝なければなりません", en: "I have to go to bed.", markedWord: "私", particleText: "は", distractors: ["寝なければ", "なりません"] },
  { id: -2, recipe: "wa", jp: "彼は来ないと思います", en: "I think he won't come.", markedWord: "彼", particleText: "は", distractors: ["来ないと", "思います"] },
  { id: -3, recipe: "wa", jp: "僕は本当だと思う", en: "I think it's true.", markedWord: "僕", particleText: "は", distractors: ["本当だと", "思う"] },
  { id: -4, recipe: "wa", jp: "彼女は来ると思う", en: "I think that she will come.", markedWord: "彼女", particleText: "は", distractors: ["来ると", "思う"] },
  { id: -5, recipe: "wa", jp: "君は行かなければならない", en: "It's necessary for you to go.", markedWord: "君", particleText: "は", distractors: ["行かなければ", "ならない"] },
  { id: -6, recipe: "wa", jp: "規則は守らなければならない", en: "We must observe the rules.", markedWord: "規則", particleText: "は", distractors: ["守らなければ", "ならない"] },
  { id: -7, recipe: "wa", jp: "それなら話は別だよ", en: "In that case, I'll change my mind.", markedWord: "話", particleText: "は", distractors: ["それなら", "別だよ"] },
  { id: -8, recipe: "wa", jp: "窓は開けなきゃいけないの", en: "Do I have to open the window?", markedWord: "窓", particleText: "は", distractors: ["開けなきゃ", "いけないの"] },
  { id: -9, recipe: "wa", jp: "明日は天気だと思う", en: "Tomorrow I think it will be good weather.", markedWord: "明日", particleText: "は", distractors: ["天気だと", "思う"] },
  { id: -10, recipe: "wa", jp: "草は刈らないといけないよ", en: "The grass needs cutting.", markedWord: "草", particleText: "は", distractors: ["刈らないと", "いけないよ"] },
  { id: -11, recipe: "wa", jp: "勉強は帰ってからするよ", en: "I'll study after I come home.", markedWord: "勉強", particleText: "は", distractors: ["帰ってから", "するよ"] },
  { id: -12, recipe: "wa", jp: "今週はできると思うよ", en: "I think we can do that this week.", markedWord: "今週", particleText: "は", distractors: ["できると", "思うよ"] },
];

// --- が — mined from assembly-corpus.json (12 of 86 candidates) -----------
const GA: readonly RawRow[] = [
  { id: -13, recipe: "ga", jp: "僕が正しいと思う", en: "I think I'm right.", markedWord: "僕", particleText: "が", distractors: ["正しいと", "思う"] },
  { id: -14, recipe: "ga", jp: "彼が怪しいと思う", en: "I am suspicious of him.", markedWord: "彼", particleText: "が", distractors: ["怪しいと", "思う"] },
  { id: -15, recipe: "ga", jp: "天気がよければ行きます", en: "I will go, provided the weather is clear.", markedWord: "天気", particleText: "が", distractors: ["よければ", "行きます"] },
  { id: -16, recipe: "ga", jp: "時間があったら寄ります", en: "If I have time, I'll drop in.", markedWord: "時間", particleText: "が", distractors: ["あったら", "寄ります"] },
  { id: -17, recipe: "ga", jp: "あなたが悪いと思います", en: "I think that you are to blame.", markedWord: "あなた", particleText: "が", distractors: ["悪いと", "思います"] },
  { id: -18, recipe: "ga", jp: "君が正しいと思うよ", en: "I guess you are right.", markedWord: "君", particleText: "が", distractors: ["正しいと", "思うよ"] },
  { id: -19, recipe: "ga", jp: "雨が降ったから行かなかった", en: "Since it rained, I did not go.", markedWord: "雨", particleText: "が", distractors: ["降ったから", "行かなかった"] },
  { id: -20, recipe: "ga", jp: "どっちが正しいと思う", en: "Which one do you think is correct?", markedWord: "どっち", particleText: "が", distractors: ["正しいと", "思う"] },
  { id: -21, recipe: "ga", jp: "何が欲しいと思う", en: "What do you think I want?", markedWord: "何", particleText: "が", distractors: ["欲しいと", "思う"] },
  { id: -22, recipe: "ga", jp: "誰が勝つと思う", en: "Who do you think will win?", markedWord: "誰", particleText: "が", distractors: ["勝つと", "思う"] },
  { id: -23, recipe: "ga", jp: "準備ができたら教えて", en: "Tell me when you're ready.", markedWord: "準備", particleText: "が", distractors: ["できたら", "教えて"] },
  { id: -24, recipe: "ga", jp: "雪が降ると思う", en: "Do you think it's going to snow?", markedWord: "雪", particleText: "が", distractors: ["降ると", "思う"] },
];

// --- を — mined from assembly-corpus.json (12 of 58 candidates) -----------
const WO: readonly RawRow[] = [
  { id: -25, recipe: "wo", jp: "何をしてたと思う", en: "What do you think I've been doing?", markedWord: "何", particleText: "を", distractors: ["してたと", "思う"] },
  { id: -26, recipe: "wo", jp: "薬を飲まなければなりません", en: "I have to take medicine.", markedWord: "薬", particleText: "を", distractors: ["飲まなければ", "なりません"] },
  { id: -27, recipe: "wo", jp: "宿題を終えたら出かけます", en: "I will go out after I finish my homework.", markedWord: "宿題", particleText: "を", distractors: ["終えたら", "出かけます"] },
  { id: -28, recipe: "wo", jp: "手術をしなければなりません", en: "You have to have an operation.", markedWord: "手術", particleText: "を", distractors: ["しなければ", "なりません"] },
  { id: -29, recipe: "wo", jp: "計画をやめなければならなかった", en: "I had to give up my plan.", markedWord: "計画", particleText: "を", distractors: ["やめなければ", "ならなかった"] },
  { id: -30, recipe: "wo", jp: "靴を脱いでから家には入ってください", en: "Please remove your shoes before entering the house.", markedWord: "靴", particleText: "を", distractors: ["脱いでから", "家には", "入ってください"] },
  { id: -31, recipe: "wo", jp: "体を洗わなければいけない", en: "You must wash your body.", markedWord: "体", particleText: "を", distractors: ["洗わなければ", "いけない"] },
  { id: -32, recipe: "wo", jp: "車を借りないといけないな", en: "I need to rent a car.", markedWord: "車", particleText: "を", distractors: ["借りないと", "いけないな"] },
  { id: -33, recipe: "wo", jp: "家を売らなきゃいけないんだ", en: "We need to sell our house.", markedWord: "家", particleText: "を", distractors: ["売らなきゃ", "いけないんだ"] },
  { id: -34, recipe: "wo", jp: "手を洗わなきゃいけないでしょ", en: "Your hands need to be washed.", markedWord: "手", particleText: "を", distractors: ["洗わなきゃ", "いけないでしょ"] },
  { id: -35, recipe: "wo", jp: "歯を治さないといけないんだ", en: "I have to get my teeth fixed.", markedWord: "歯", particleText: "を", distractors: ["治さないと", "いけないんだ"] },
  { id: -36, recipe: "wo", jp: "全力を尽くしますからご安心下さい", en: "Rest assured that I will do my best.", markedWord: "全力", particleText: "を", distractors: ["尽くしますから", "ご安心", "下さい"] },
];

// --- に — mined from assembly-corpus.json (12 of 77 candidates) -----------
const NI: readonly RawRow[] = [
  { id: -37, recipe: "ni", jp: "買い物に行かなければならない", en: "I have to go shopping.", markedWord: "買い物", particleText: "に", distractors: ["行かなければ", "ならない"] },
  { id: -38, recipe: "ni", jp: "銀行に行かなければいけないんです", en: "I have to go to the bank.", markedWord: "銀行", particleText: "に", distractors: ["行かなければ", "いけないんです"] },
  { id: -39, recipe: "ni", jp: "警察に行かなければなりません", en: "I have to go to the police station.", markedWord: "警察", particleText: "に", distractors: ["行かなければ", "なりません"] },
  { id: -40, recipe: "ni", jp: "外国に行こうと思っている", en: "I'm thinking of going abroad.", markedWord: "外国", particleText: "に", distractors: ["行こうと", "思っている"] },
  { id: -41, recipe: "ni", jp: "映画に行ったらどうですか", en: "Why not go to the movies?", markedWord: "映画", particleText: "に", distractors: ["行ったら", "どうですか"] },
  { id: -42, recipe: "ni", jp: "医者に診てもらったらどうですか", en: "What do you say to seeing a doctor?", markedWord: "医者", particleText: "に", distractors: ["診てもらったら", "どうですか"] },
  { id: -43, recipe: "ni", jp: "家に帰らなければいけない", en: "I have to get home.", markedWord: "家", particleText: "に", distractors: ["帰らなければ", "いけない"] },
  { id: -44, recipe: "ni", jp: "アンに謝らないといけない", en: "I must apologize to Ann.", markedWord: "アン", particleText: "に", distractors: ["謝らないと", "いけない"] },
  { id: -45, recipe: "ni", jp: "学校に行かなければならない", en: "You must go to school.", markedWord: "学校", particleText: "に", distractors: ["行かなければ", "ならない"] },
  { id: -46, recipe: "ni", jp: "病院に行かないといけないの", en: "I need to go to the hospital.", markedWord: "病院", particleText: "に", distractors: ["行かないと", "いけないの"] },
  { id: -47, recipe: "ni", jp: "役に立つと思うよ", en: "I think that would help.", markedWord: "役", particleText: "に", distractors: ["立つと", "思うよ"] },
  { id: -48, recipe: "ni", jp: "駅に着いてから電話するね", en: "I'll ring you after I've arrived at the station.", markedWord: "駅", particleText: "に", distractors: ["着いてから", "電話", "するね"] },
];

// --- で — mined from assembly-corpus.json (10 of 20 candidates) -----------
const DE: readonly RawRow[] = [
  { id: -49, recipe: "de", jp: "電話で済まそうと思いました", en: "I thought I could settle it by phone.", markedWord: "電話", particleText: "で", distractors: ["済まそうと", "思いました"] },
  { id: -50, recipe: "de", jp: "自分でやらなきゃ駄目だよ", en: "You must do it yourself.", markedWord: "自分", particleText: "で", distractors: ["やらなきゃ", "駄目だよ"] },
  { id: -51, recipe: "de", jp: "どこで待ってればいい", en: "Where should I wait for you?", markedWord: "どこ", particleText: "で", distractors: ["待ってれば", "いい"] },
  { id: -52, recipe: "de", jp: "今日は暑いから海で泳げるよ", en: "Today is hot enough for us to swim in the sea.", markedWord: "海", particleText: "で", distractors: ["今日は", "暑いから", "泳げるよ"] },
  { id: -53, recipe: "de", jp: "途中で止めたら後悔するぜ", en: "I'm sure you'll be sorry if you give it up halfway through.", markedWord: "途中", particleText: "で", distractors: ["止めたら", "後悔", "するぜ"] },
  { id: -54, recipe: "de", jp: "明日雨なら車で行こう", en: "If it's raining tomorrow, we'll go there by car.", markedWord: "車", particleText: "で", distractors: ["明日", "雨なら", "行こう"] },
  { id: -55, recipe: "de", jp: "いつならここで泳げますか", en: "When can I swim here?", markedWord: "ここ", particleText: "で", distractors: ["いつなら", "泳げますか"] },
  { id: -56, recipe: "de", jp: "パートで働かなきゃいけないかもね", en: "I may have to work part time.", markedWord: "パート", particleText: "で", distractors: ["働かなきゃ", "いけないかもね"] },
  { id: -57, recipe: "de", jp: "エレベーターが壊れたら階段で上がらないといけない", en: "When the elevator's broken, we have to go up the stairs.", markedWord: "階段", particleText: "で", distractors: ["エレベーターが", "壊れたら", "上がらないと", "いけない"] },
  { id: -58, recipe: "de", jp: "半袖で来ればよかった", en: "I should've worn a short-sleeved shirt.", markedWord: "半袖", particleText: "で", distractors: ["来れば", "よかった"] },
];

// --- へ — hand-authored (corpus had ~3 candidates, not enough to mine) ----
const HE: readonly RawRow[] = [
  { id: -59, recipe: "e", jp: "東京へ行きます。", en: "I'm going to Tokyo.", markedWord: "東京", particleText: "へ", distractors: ["行きます"] },
  { id: -60, recipe: "e", jp: "公園へ行きました。", en: "I went to the park.", markedWord: "公園", particleText: "へ", distractors: ["行きました"] },
  { id: -61, recipe: "e", jp: "駅へ向かいました。", en: "I headed to the station.", markedWord: "駅", particleText: "へ", distractors: ["向かいました"] },
  { id: -62, recipe: "e", jp: "病院へ行かなければなりません。", en: "I have to go to the hospital.", markedWord: "病院", particleText: "へ", distractors: ["行かなければ", "なりません"] },
  { id: -63, recipe: "e", jp: "海へ行きたいです。", en: "I want to go to the sea.", markedWord: "海", particleText: "へ", distractors: ["行きたいです"] },
  { id: -64, recipe: "e", jp: "どこへ行きますか。", en: "Where are you going?", markedWord: "どこ", particleText: "へ", distractors: ["行きますか"] },
  { id: -65, recipe: "e", jp: "台所へ行った。", en: "I went to the kitchen.", markedWord: "台所", particleText: "へ", distractors: ["行った"] },
  { id: -66, recipe: "e", jp: "会社へ戻ります。", en: "I'm going back to the office.", markedWord: "会社", particleText: "へ", distractors: ["戻ります"] },
  { id: -67, recipe: "e", jp: "山へ行きました。", en: "I went to the mountain.", markedWord: "山", particleText: "へ", distractors: ["行きました"] },
  { id: -68, recipe: "e", jp: "田舎へ帰ります。", en: "I'm going back to my hometown.", markedWord: "田舎", particleText: "へ", distractors: ["帰ります"] },
];

// --- まで — hand-authored (corpus had ~3 candidates, not enough to mine) --
const MADE: readonly RawRow[] = [
  { id: -69, recipe: "made", jp: "駅まで走りました。", en: "I ran to the station.", markedWord: "駅", particleText: "まで", distractors: ["走りました"] },
  { id: -70, recipe: "made", jp: "五時まで働きます。", en: "I'll work until five o'clock.", markedWord: "五時", particleText: "まで", distractors: ["働きます"] },
  { id: -71, recipe: "made", jp: "東京まで行きます。", en: "I'll go as far as Tokyo.", markedWord: "東京", particleText: "まで", distractors: ["行きます"] },
  { id: -72, recipe: "made", jp: "来週まで待ってください。", en: "Please wait until next week.", markedWord: "来週", particleText: "まで", distractors: ["待ってください"] },
  { id: -73, recipe: "made", jp: "ここまで来てください。", en: "Please come this far.", markedWord: "ここ", particleText: "まで", distractors: ["来てください"] },
  { id: -74, recipe: "made", jp: "終わりまで読みました。", en: "I read to the end.", markedWord: "終わり", particleText: "まで", distractors: ["読みました"] },
  { id: -75, recipe: "made", jp: "夜遅くまで勉強しました。", en: "I studied until late at night.", markedWord: "夜遅く", particleText: "まで", distractors: ["勉強しました"] },
  { id: -76, recipe: "made", jp: "空港まで歩きました。", en: "I walked to the airport.", markedWord: "空港", particleText: "まで", distractors: ["歩きました"] },
  { id: -77, recipe: "made", jp: "卒業まで頑張ります。", en: "I'll do my best until graduation.", markedWord: "卒業", particleText: "まで", distractors: ["頑張ります"] },
  { id: -78, recipe: "made", jp: "明日まで待てません。", en: "I can't wait until tomorrow.", markedWord: "明日", particleText: "まで", distractors: ["待てません"] },
];

// --- だけ — hand-authored (corpus had zero candidates) --------------------
const DAKE: readonly RawRow[] = [
  { id: -79, recipe: "dake", jp: "一つだけ買いました。", en: "I bought just one.", markedWord: "一つ", particleText: "だけ", distractors: ["買いました"] },
  { id: -80, recipe: "dake", jp: "少しだけ食べました。", en: "I ate just a little.", markedWord: "少し", particleText: "だけ", distractors: ["食べました"] },
  { id: -81, recipe: "dake", jp: "今日だけ休みます。", en: "I'll take today off, just today.", markedWord: "今日", particleText: "だけ", distractors: ["休みます"] },
  { id: -82, recipe: "dake", jp: "彼だけ来ました。", en: "Only he came.", markedWord: "彼", particleText: "だけ", distractors: ["来ました"] },
  { id: -83, recipe: "dake", jp: "これだけあれば十分です。", en: "If we have just this, it's enough.", markedWord: "これ", particleText: "だけ", distractors: ["あれば", "十分です"] },
  { id: -84, recipe: "dake", jp: "水だけ飲みました。", en: "I drank only water.", markedWord: "水", particleText: "だけ", distractors: ["飲みました"] },
  { id: -85, recipe: "dake", jp: "五分だけ待ってください。", en: "Please wait just five minutes.", markedWord: "五分", particleText: "だけ", distractors: ["待ってください"] },
  { id: -86, recipe: "dake", jp: "あなただけ知っています。", en: "Only you know.", markedWord: "あなた", particleText: "だけ", distractors: ["知っています"] },
  { id: -87, recipe: "dake", jp: "一回だけ会いました。", en: "I met them just once.", markedWord: "一回", particleText: "だけ", distractors: ["会いました"] },
  { id: -88, recipe: "dake", jp: "名前だけ聞きました。", en: "I only heard the name.", markedWord: "名前", particleText: "だけ", distractors: ["聞きました"] },
];

// --- しか — hand-authored (corpus had zero candidates). Only the OPENING
// half is spanned (しか, not しか〜ない) — the same convention authored.ts
// uses for id -16, since the closing ない is a separate word elsewhere in
// the sentence, not part of the marked particle span.
const SHIKA: readonly RawRow[] = [
  { id: -89, recipe: "shika-nai", jp: "彼は肉しか食べない。", en: "He only eats meat.", markedWord: "肉", particleText: "しか", distractors: ["彼は", "食べない"] },
  { id: -90, recipe: "shika-nai", jp: "千円しかない。", en: "I only have a thousand yen.", markedWord: "千円", particleText: "しか", distractors: ["ない"] },
  { id: -91, recipe: "shika-nai", jp: "二人しか来なかった。", en: "Only two people came.", markedWord: "二人", particleText: "しか", distractors: ["来なかった"] },
  { id: -92, recipe: "shika-nai", jp: "日本語しか話せない。", en: "I can only speak Japanese.", markedWord: "日本語", particleText: "しか", distractors: ["話せない"] },
  { id: -93, recipe: "shika-nai", jp: "これしか持っていない。", en: "This is all I have.", markedWord: "これ", particleText: "しか", distractors: ["持っていない"] },
  { id: -94, recipe: "shika-nai", jp: "少ししか分からない。", en: "I only understand a little.", markedWord: "少し", particleText: "しか", distractors: ["分からない"] },
  { id: -95, recipe: "shika-nai", jp: "三十分しかない。", en: "There's only thirty minutes.", markedWord: "三十分", particleText: "しか", distractors: ["ない"] },
  { id: -96, recipe: "shika-nai", jp: "猫しか飼っていない。", en: "I only keep cats.", markedWord: "猫", particleText: "しか", distractors: ["飼っていない"] },
  { id: -97, recipe: "shika-nai", jp: "漢字しか読めない。", en: "I can only read kanji.", markedWord: "漢字", particleText: "しか", distractors: ["読めない"] },
  { id: -98, recipe: "shika-nai", jp: "あなたしか頼れない。", en: "You're the only one I can rely on.", markedWord: "あなた", particleText: "しか", distractors: ["頼れない"] },
];

const ROWS: readonly RawRow[] = [...WA, ...GA, ...WO, ...NI, ...DE, ...HE, ...MADE, ...DAKE, ...SHIKA];

function findOnce(jp: string, needle: string, label: string): number {
  const start = jp.indexOf(needle);
  if (start < 0) {
    throw new Error(`particle-drill-examples: "${needle}" (${label}) not found in "${jp}"`);
  }
  if (jp.indexOf(needle, start + 1) !== -1) {
    throw new Error(`particle-drill-examples: "${needle}" (${label}) is not unique in "${jp}"`);
  }
  return start;
}

/** Resolves a raw row's text anchors into the numeric spans the interface
 * needs. Throws at module load if an anchor is missing, ambiguous, or a
 * distractor overlaps the marked word/particle — a typo cannot ship. */
export const PARTICLE_DRILL_EXAMPLES: readonly ParticleDrillExample[] = ROWS.map((r) => {
  const anchor = r.markedWord + r.particleText;
  const anchorStart = findOnce(r.jp, anchor, `row ${r.id} anchor`);
  const particleStart = anchorStart + r.markedWord.length;
  const particleSpan = [particleStart, particleStart + r.particleText.length] as const;
  const markedWordSpan = [anchorStart, particleStart] as const;

  const distractorSpans = r.distractors.map((d) => {
    const start = findOnce(r.jp, d, `row ${r.id} distractor "${d}"`);
    const end = start + d.length;
    const overlapsMarked = start < markedWordSpan[1] && end > markedWordSpan[0];
    const overlapsParticle = start < particleSpan[1] && end > particleSpan[0];
    if (overlapsMarked || overlapsParticle) {
      throw new Error(`particle-drill-examples: row ${r.id} distractor "${d}" overlaps the marked span`);
    }
    return [start, end] as const;
  });

  return {
    id: r.id,
    recipe: r.recipe,
    jp: r.jp,
    en: r.en,
    particleSpan,
    markedWordSpan,
    distractorSpans,
  };
});

// Fails fast at import time if a recipe id above is a typo.
for (const ex of PARTICLE_DRILL_EXAMPLES) {
  if (!recipe(ex.recipe)) {
    throw new Error(`particle-drill-examples: row ${ex.id} references unknown recipe "${ex.recipe}"`);
  }
}
