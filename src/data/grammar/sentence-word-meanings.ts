// What a pattern page's sentence's words mean, where the vocabulary cannot say
// (SAK-508).
//
// The "In a sentence" block on a pattern page has a words line under it: each
// content word of the sentence and what it means (SAK-506). The meaning comes
// from the vocabulary through `wordInSentence` in src/app/(sky)/word-meaning.ts.
// That leaves two kinds of word, and each is written here for the sentence it
// is in.
//
// - A word the vocabulary does not have: 鞍, 俯く, パリ. Some it has under
//   another spelling the lookup cannot reach (事 is filed as こと, 馬鹿 as
//   ばか), and some are pieces the tokenizer cut out of a longer word (代 in
//   代名詞).
// - A word whose sense the lookup gets wrong because the English does not
//   name the right one: ため in するためには is "in order to", where the
//   vocabulary's first sense is "good", and 日 in 日が沈む is the sun.
//   Where a rule in word-meaning.ts gets it right (休む is "to rest" in "I
//   want to rest"), the word has no row.
//
// Keyed by the corpus sentence's id, then by the lemma as the corpus lists it.
// An id below zero is one of the hand-written rows in authored.ts. A sentence
// shown for two patterns has one row, since its words are the same.
//
// THE RULES FOR A ROW
// ===================
// The meaning is what the word means in this sentence, a word or two, in plain
// American English, with no parentheses, semicolons or dashes. It says the
// word's own part: 気を付ける is 気 "attention" and 付ける "to pay". A name
// is the name.
//
// The reading is the word's reading in hiragana, given when the word has
// kanji, so the line can put furigana over it. A kana word has none.
//
// sentence-word-meanings.test.ts checks that every row is a sentence a page
// shows and every lemma is one of its words, so a re-ingest that shows a
// different sentence fails until the new one is read.

import type { SentenceWordMeaning } from "@/data/phase-intros";

/** Corpus sentence id to its words' meanings, by lemma. */
export const SENTENCE_WORD_MEANINGS: Readonly<Record<string, Readonly<Record<string, SentenceWordMeaning>>>> = {
  // 〜てはいけない: フォント・ビジネスでは決して誰も信用してはいけないよ。
  // 決して is "(not) ever" in the vocabulary; with the negative it is "never".
  "75373": {
    フォント: { meaning: "font" },
    決して: { reading: "けっして", meaning: "never" },
  },
  // 〜てから: 馬が亡くなってから鞍が淋しい。
  "5098": {
    鞍: { reading: "くら", meaning: "saddle" },
    淋しい: { reading: "さびしい", meaning: "lonely" },
  },
  // に: 七時に起きます。
  "-9": {
    七時: { reading: "しちじ", meaning: "seven o'clock" },
  },
  // 〜てしまう: 言ってから、まゆちゃんは恥ずかしそうに俯いてしまう。
  "75411": {
    まゆ: { meaning: "Mayu" },
    俯く: { reading: "うつむく", meaning: "to hang one's head" },
  },
  // 〜なければいけない: 礼儀作法に気を付けなければいけない。
  // 気を付ける is "to pay attention"; the vocabulary's 気 is "spirit".
  "77626": {
    作法: { reading: "さほう", meaning: "etiquette" },
    気: { reading: "き", meaning: "attention" },
    付ける: { reading: "つける", meaning: "to pay" },
  },
  // 〜なきゃ: 英語話者に通じなきゃ意味ないぞ。
  "75289": {
    話者: { reading: "わしゃ", meaning: "speaker" },
    通ずる: { reading: "つうずる", meaning: "to get across" },
  },
  // 〜ないといけない: 列車の遅れを見込んでおかないといけない。
  "77536": {
    見込む: { reading: "みこむ", meaning: "to allow for" },
    おく: { meaning: "to do ahead" },
  },
  // 〜たことがある: 彼女はパリに行ったことがある。
  "91720": {
    パリ: { meaning: "Paris" },
  },
  // 〜たところ: さっき入れ違いで亜美さんが出て行ったところです。
  "76696": {
    入れ違い: { reading: "いれちがい", meaning: "just missing" },
    亜美: { reading: "あみ", meaning: "Ami" },
  },
  // 〜たり〜たり: 夜通し雨が降ったり止んだりしていた。
  "79672": {
    夜通し: { reading: "よどおし", meaning: "all night" },
  },
  // 〜ながら: そのことを後悔しながら余生を送りたくない。
  "5004": {
    余生: { reading: "よせい", meaning: "rest of one's life" },
  },
  // 〜すぎる: やらなければならない事がありすぎる！
  "5077": {
    事: { reading: "こと", meaning: "thing" },
  },
  // 〜にくい: 横向きに寝ると「いびき」をかきにくい？
  // いびきをかく is "to snore"; the vocabulary's かく is "to scratch".
  "74574": {
    横向き: { reading: "よこむき", meaning: "on one's side" },
    かく: { meaning: "to snore" },
  },
  // 〜づらい: 指示代名詞が多すぎて、正直、わかりづらいことこの上ない。
  // 代 is a piece of 代名詞, "pronoun"; すぎる is the 〜すぎる of 多すぎて.
  "76097": {
    代: { reading: "だい", meaning: "in place of" },
    すぎる: { meaning: "too much" },
  },
  // 〜ます: 毎日、日本語を勉強します。
  "-27": {
    勉強する: { reading: "べんきょうする", meaning: "to study" },
  },
  // 〜ましょう: 何かしてみましょう。
  "4702": {
    みる: { meaning: "to try" },
  },
  // 〜ば: 親切にしてやればつけあがる。
  "5187": {
    つけあがる: { meaning: "to take advantage" },
  },
  // と: 私と彼はクラスメートだ。
  // The vocabulary spells it クラスメイト (SAK-515).
  "-24": {
    クラスメート: { meaning: "classmate" },
  },
  // 〜そうだ (hearsay): かなりあくどい事をしてきたそうだな。
  // くる is the てくる of してきた, something done up to now.
  "76794": {
    あくどい: { meaning: "shady" },
    事: { reading: "こと", meaning: "thing" },
    くる: { meaning: "up to now" },
  },
  // 〜ようだ: 明日雨のようだががんばろう。
  "74772": {
    がんばる: { meaning: "to do one's best" },
  },
  // 〜かもしれない: 末弟は悪くないかもしれない、けれど私も悪くない。
  "74941": {
    末弟: { reading: "まってい", meaning: "youngest brother" },
  },
  // 〜に違いない: 路上の血痕は俺のものに違いない。
  "77398": {
    血痕: { reading: "けっこん", meaning: "bloodstain" },
  },
  // 〜ために: インコを飼うために必要なものを揃えましょう。
  "74283": {
    インコ: { meaning: "parakeet" },
    揃える: { reading: "そろえる", meaning: "to get ready" },
  },
  // 〜おかげで: コンピューターのおかげで人間は馬鹿になる。
  // コンピューター is filed as コンピュータ, and 馬鹿 as ばか. The
  // vocabulary's kana なる is "to bear fruit" first.
  "5138": {
    コンピューター: { meaning: "computer" },
    馬鹿: { reading: "ばか", meaning: "stupid" },
    なる: { meaning: "to become" },
  },
  // 〜について: 泳者の呼吸機能の特性について。
  "74576": {
    泳者: { reading: "えいしゃ", meaning: "swimmer" },
    特性: { reading: "とくせい", meaning: "trait" },
  },
  // 〜べきだ: 私の言う事を聞くべきだったのに。
  "5128": {
    事: { reading: "こと", meaning: "thing" },
  },
  // だけ: 完璧であるには、欠点だけが欠けていた。
  // The vocabulary's 欠ける is "to chip" first.
  "5041": {
    欠ける: { reading: "かける", meaning: "to lack" },
  },
  // 〜なければならない: それをするためには危険を冒さなければならない。
  // The vocabulary's ため is "good" first.
  "4787": {
    ため: { meaning: "in order to" },
  },
  // 〜ことができる: 窓から日が沈むのを見ることができるだろう。
  "5262": {
    日: { reading: "ひ", meaning: "sun" },
  },
  // 〜はずがない: 彼女が約束を破ったはずがない。
  "95184": {
    破る: { reading: "やぶる", meaning: "to break" },
  },
  // 〜として: 副作用としては、視力障害があります。
  "74097": {
    障害: { reading: "しょうがい", meaning: "impairment" },
  },
  // 〜つもり: 自分勝手にするつもりはない。
  // 自分勝手 is "selfish"; the vocabulary's 勝手 is "one's own convenience".
  "4775": {
    勝手: { reading: "かって", meaning: "selfish" },
  },
};
