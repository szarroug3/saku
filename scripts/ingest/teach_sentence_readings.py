# -*- coding: utf-8 -*-
"""
Per-kanji readings for the sentences a lesson's "In a sentence" block shows,
the furigana over their kanji.

Run AFTER scripts/build-sentence-readings.ts has (re)written the sentence list:

    uv run --with fugashi --with unidic-lite scripts/ingest/teach_sentence_readings.py

THE SAME READINGS THE WORD PAGES' SENTENCES GET
===============================================
Each sentence is read exactly the way sentence_readings.py reads a word's
example sentence (SAK-95): fugashi + unidic-lite tokenizes it, each kanji
token's surface reading is split per kanji by aligner.align() against the
readings vocab.json itself attests, and a token that does not split cleanly
leaves null in its kanji's slots. Null is printed as plain kanji, never a
guess. The slot shape is the same [kanji, surface-reading, base-reading]
triple, so src/data/sentence-readings.ts reads it the way word-examples.ts
documents it.

This file does not reimplement any of that: it imports build_krd, align,
is_kanji and kata2hira from the same modules. It only differs in what a row is
keyed by (the sentence text, because most of these sentences are authored and
have no Tatoeba id), in the two override lists below, and in one slot shape
the word pages do not have: a jukujikun (今日, 明日, 部屋) is one slot over the
whole word. teach.test.ts holds the committed file to no null slot at all, so
a kanji the pass cannot read is fixed here, not shipped bare.

SINCE SAK-484, MORE THAN THE "IN A SENTENCE" BLOCK
===================================================
The list also holds the Japanese inside grammar prose, a verb pair's example
sentences and every sentence a sentence-ordering quiz card can deal
(scripts/build-sentence-readings.ts says which). Those brought kanji
vocab.json never attests (嬉, 凄, 噂), which the aligner refuses though the
token splits cleanly, so a token with ONE kanji the aligner refuses is read
from the token's own reading with its kana taken off (single_kanji_reading).
Every reading that produced was checked by hand, and the three it got wrong
are overrides below.

OVERRIDES, FOR A READING THE TAGGER GETS WRONG RATHER THAN MISSES
=================================================================
The same failure mode sentence_readings.py's SENTENCE_READING_OVERRIDES
(SAK-261) is for: a real reading that is not the one this sentence says. Every
entry names the reading's source in the app's own data.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from aligner import align, is_kanji, kata2hira  # noqa: E402
from sentence_readings import build_krd, fugashi  # noqa: E402

GEN = os.path.join(HERE, "..", "..", "src", "data", "generated")

# A token read the same wrong way wherever it appears.
#
#   - 私: unidic-lite reads every 私 as the formal わたくし, which vocab.json never
#     attests, so the aligner refuses it and the sentence's first word goes
#     without furigana. わたし is vocab.json's own reading for 私 (its JMdict
#     primary), the one the particle pages already print over 私は学生です
#     (particle-notes.ts), and the one a learner says.
#   - 言う: unidic-lite gives the dictionary form the sound ゆう, which the
#     aligner cannot split, so 言 went bare in 私はそれを言う. vocab.json's 言う
#     is いう, split 言 い; every conjugated form (言わ, 言い, 言っ) already
#     aligns on its own.
#   - 日本: unidic-lite only has にっぽん. vocab.json's 日本 is にほん, the everyday
#     reading, and the one 日本語 is always read with.
TOKEN_READING_OVERRIDES = {
    "私": [["私", "わたし", "わたし"]],
    "言う": [["言", "い", "い"]],
    "日本": [["日", "に", "に"], ["本", "ほん", "ほん"]],
    # A jukujikun: the word has a reading and its kanji do not, so the aligner
    # refuses it. One slot spans the whole word, and the page prints one
    # reading over all of it rather than leaving it bare. 明日 is あした, the
    # everyday reading, where unidic-lite gives the formal あす.
    "今日": [["今日", "きょう", "きょう"]],
    "明日": [["明日", "あした", "あした"]],
    "部屋": [["部屋", "へや", "へや"]],
    # SAK-484, the quiz's ordering sentences. 昨日 and 日向 are jukujikun like
    # the three above; the rest split by kanji but hold a kanji vocab.json
    # never attests, so the aligner refused the whole word. Each is the word's
    # dictionary reading.
    "昨日": [["昨日", "きのう", "きのう"]],
    "日向": [["日向", "ひなた", "ひなた"]],
    "居心地": [["居", "い", "い"], ["心", "ごこ", "こころ"], ["地", "ち", "ち"]],
    "正夢": [["正", "まさ", "まさ"], ["夢", "ゆめ", "ゆめ"]],
    "物置": [["物", "もの", "もの"], ["置", "おき", "おき"]],
    "几帳面": [["几", "き", "き"], ["帳", "ちょう", "ちょう"], ["面", "めん", "めん"]],
    "胸毛": [["胸", "むな", "むね"], ["毛", "げ", "け"]],
    "蜘蛛": [["蜘", "く", "く"], ["蛛", "も", "も"]],
    "切符": [["切", "きっ", "きり"], ["符", "ぷ", "ふ"]],
    # unidic-lite takes these as one token each: 皿洗(い) and 日向ぼっこ.
    "皿洗": [["皿", "さら", "さら"], ["洗", "あら", "あら"]],
    "日向ぼっこ": [["日向", "ひなた", "ひなた"]],
    # 上手 is じょうず, a reading of the word and not of its kanji one by one;
    # unidic-lite reads the pair かみて, the stage-left noun.
    "上手": [["上手", "じょうず", "じょうず"]],
}

# 何 before か, が, を, も or し is なに (何か, 何が, 何を, 何も, 何してる), where
# unidic-lite reads every lone 何 as なん. Before と, て, だ or で it is なん
# (何と, 何て, 何だ), which is what the tagger already says. The seven
# sentence overrides below for 何 predate this rule and agree with it.
NANI_BEFORE = set("かがをもし")

# One kanji in one sentence, keyed by (sentence, kanji, 0-based occurrence of
# that kanji among the sentence's kanji slots).
#
#   - 七時に起きます。: unidic-lite reads 七 as なな, and 七時 is しちじ, the
#     reading vocab.json attests for 七 (七月 しちがつ) and the one a clock says.
#   - 何 before か, も or を: unidic-lite reads every 何 as なん, which is right
#     before です or と (これは何ですか, 何と言ったら) and wrong here. vocab.json
#     reads 何 and 何か as なに.
#   - 一晩 and 一個: unidic-lite splits each into 一 + a counter and reads 一
#     as いち. 一晩 is ひとばん, with the 一 ひと vocab.json attests in 一つ and
#     一人; 一個 is いっこ, いち with the same small-つ shift 学校 がっこう has
#     (the aligner's own sokuon rule).
SENTENCE_READING_OVERRIDES = {
    ("七時に起きます。", "七", 0): ["七", "しち", "しち"],
    ("何かしてみましょう。", "何", 0): ["何", "なに", "なに"],
    ("何か他の言い方はある？", "何", 0): ["何", "なに", "なに"],
    ("何も言わないで、私は出た。", "何", 0): ["何", "なに", "なに"],
    ("何をしてたと思う？", "何", 0): ["何", "なに", "なに"],
    ("私のパソコンは何かの役に立つはずだ。", "何", 0): ["何", "なに", "なに"],
    ("私は何を言う？", "何", 0): ["何", "なに", "なに"],
    ("一晩泊めてもらいたいんだけど。", "一", 0): ["一", "ひと", "ひと"],
    ("ケーキ一個で手を打ってあげるよ。", "一", 0): ["一", "いっ", "いち"],
    # 土曜日: unidic-lite splits it 土曜 + 日 and reads the lone 日 ひ, missing
    # the rendaku どようび has. The only split compound among these sentences
    # whose second half changes sound (図書+館, 建築+物, 効率+的 do not).
    ("土曜日までに本を返さなければなりません。", "日", 0): ["日", "び", "ひ"],
    # Kanji whose reading vocab.json never attests, so the aligner refused
    # them though they split cleanly: the kun reading of the word each is in.
    ("インコを飼うために必要なものを揃えましょう。", "揃", 0): ["揃", "そろ", "そろ"],
    ("言ってから、まゆちゃんは恥ずかしそうに俯いてしまう。", "俯", 0): ["俯", "うつむ", "うつむ"],
    ("馬が亡くなってから鞍が淋しい。", "鞍", 0): ["鞍", "くら", "くら"],
    ("馬が亡くなってから鞍が淋しい。", "淋", 0): ["淋", "さび", "さび"],
    ("面白半分なら来ないで欲しい。", "来", 0): ["来", "こ", "く"],
    ("路上の血痕は俺のものに違いない。", "血", 0): ["血", "けっ", "けつ"],
    ("路上の血痕は俺のものに違いない。", "痕", 0): ["痕", "こん", "こん"],
    # 亜美, a given name: 亜 あ and 美 み.
    ("さっき入れ違いで亜美さんが出て行ったところです。", "亜", 0): ["亜", "あ", "あ"],
    ("さっき入れ違いで亜美さんが出て行ったところです。", "美", 0): ["美", "み", "み"],
    # SAK-484: the sentences the Sky reads for the first time, a particle's
    # prose and the quiz's ordering cards.
    #
    # 開く said of a door, a window or a gate opening by itself is あく; unidic-
    # lite reads it ひらく. The particle page's point is exactly that 開く here
    # has no を ("the door opens by itself"), and vocab.json's 開く is あく.
    ("ドアが開きます", "開", 0): ["開", "あ", "あ"],
    ("押せばドアが開きます", "開", 0): ["開", "あ", "あ"],
    ("窓が開いたら閉めないといけません", "開", 0): ["開", "あ", "あ"],
    ("門ならもう開いてるよ", "開", 0): ["開", "あ", "あ"],
    # 酒臭い is さけくさい; unidic-lite reads the 酒 of the compound しゅ.
    ("トム酒臭いからあっちに行って", "酒", 0): ["酒", "さけ", "さけ"],
    # 宇宙人 is うちゅうじん, as 外国人 is がいこくじん; unidic-lite read 人 にん.
    ("宇宙人っていると思う", "人", 0): ["人", "じん", "じん"],
    # 富士山 is ふじさん; unidic-lite read 山 やま.
    ("富士山ならここから見えるよ", "山", 0): ["山", "さん", "さん"],
    # 大丈夫、君ならできる: 君 is the pronoun きみ, not the name suffix くん
    # unidic-lite took it for once the comma was gone.
    ("大丈夫君ならできる", "君", 0): ["君", "きみ", "きみ"],
    # 大金持ち is おおがねもち, with the voicing on 金.
    ("私が大金持ちだったらいいのに", "金", 0): ["金", "がね", "かね"],
    # 途中で止めたら後悔する: stopping partway, which is やめる. とめる is a
    # real reading of 止める but is stopping a thing, not quitting a task.
    ("途中で止めたら後悔するぜ", "止", 0): ["止", "や", "や"],
    # 描き方 is かきかた in everyday speech; えがく is the written, literary
    # reading unidic-lite gives.
    ("鳥の描き方がわからない", "描", 0): ["描", "か", "か"],
    # 洗濯物 is せんたくもの; unidic-lite splits 洗濯 + 物 and reads 物 ぶつ.
    ("洗濯物乾いたら取り込んで", "物", 0): ["物", "もの", "もの"],
    # 今日中 is きょうじゅう, "by the end of today"; unidic-lite reads 中 ちゅう.
    ("今日中には決めなければなりません", "中", 0): ["中", "じゅう", "ちゅう"],
    # The kanji below are read by single_kanji_reading, from the token's own
    # reading, and three of those came out wrong:
    #   - 塵も積もれば山となる is the proverb, read ちり; unidic-lite gives ごみ.
    #   - 箱なら物置にあるよ: 箱 on its own is はこ; unidic-lite gives the voiced
    #     ばこ it has inside compounds (本箱).
    #   - 辛いから気をつけて, said of food, is からい (spicy); unidic-lite gives
    #     つらい. The English on the card is the only other clue and a quiz card
    #     has none, so this is a judgment call, named in the card comment.
    ("塵も積もれば山となる", "塵", 0): ["塵", "ちり", "ちり"],
    ("箱なら物置にあるよ", "箱", 0): ["箱", "はこ", "はこ"],
    ("辛いから気をつけて", "辛", 0): ["辛", "から", "から"],
}


def single_kanji_reading(surf, kana):
    """A token with one kanji and kana around it (嬉しい, 来な, 床), read by
    taking the kana around the kanji off the token's own reading. For a kanji
    vocab.json never attests, which the aligner refuses though the token splits
    cleanly: every one of these is listed in the SAK-484 card comment and was
    checked by hand. None when the token has more than one kanji or its kana do
    not line up with the reading."""
    ks = [i for i, c in enumerate(surf) if is_kanji(c)]
    if len(ks) != 1:
        return None
    i = ks[0]
    before, after = kata2hira(surf[:i]), kata2hira(surf[i + 1:])
    if not kana.startswith(before) or not kana.endswith(after):
        return None
    mid = kana[len(before):len(kana) - len(after)]
    return [[surf[i], mid, mid]] if mid else None


def sentence_slots(jp, tagger, krd):
    """[kanji, surface-reading, base-reading] | None per kanji in `jp`, left
    to right: sentence_readings.analyze_sentence's `kr`, with the overrides.

    One exception to one-slot-per-kanji: a jukujikun override is ONE slot whose
    first element is the whole word (今日), standing for all of its kanji.
    src/data/sentence-readings.ts reads a slot's first element for how many
    kanji it covers."""
    slots = []
    seen = {}
    at = 0
    for w in tagger(jp):
        surf = w.surface
        start = jp.find(surf, at)
        at = start + len(surf) if start >= 0 else at
        kanji = [c for c in surf if is_kanji(c)]
        if not kanji:
            continue
        if surf in TOKEN_READING_OVERRIDES:
            triples = [list(t) for t in TOKEN_READING_OVERRIDES[surf]]
            if len(triples) < len(kanji):  # a word-wide reading
                slots.extend(triples)
                continue
        elif surf == "何" and at < len(jp) and jp[at] in NANI_BEFORE:
            triples = [["何", "なに", "なに"]]
        else:
            kana = kata2hira(w.feature.kana or w.feature.pron or "")
            a = align(surf, kana, krd) if kana else None
            if not a and kana:
                a = single_kanji_reading(surf, kana)
            triples = [list(t) for t in a] if a else [None] * len(kanji)
        for i, k in enumerate(kanji):
            occ = seen.get(k, 0)
            seen[k] = occ + 1
            override = SENTENCE_READING_OVERRIDES.get((jp, k, occ))
            if override:
                triples[i] = list(override)
        slots.extend(triples)
    return slots


def main():
    vocab = json.load(open(os.path.join(GEN, "vocab.json"), encoding="utf-8"))
    krd = build_krd(vocab)
    path = os.path.join(GEN, "sentence-readings.json")
    sentences = json.load(open(path, encoding="utf-8"))
    tagger = fugashi.Tagger()

    total = ok = 0
    out = {}
    for jp in sorted(sentences):
        slots = sentence_slots(jp, tagger, krd)
        total += sum(len(s[0]) if s else 1 for s in slots)
        ok += sum(len(s[0]) for s in slots if s is not None)
        out[jp] = slots

    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    pct = 100 * ok / total if total else 0
    print(f"wrote {path}")
    print(f"kanji reading coverage: {ok}/{total} ({pct:.1f}%) across {len(out)} sentences")


if __name__ == "__main__":
    main()
