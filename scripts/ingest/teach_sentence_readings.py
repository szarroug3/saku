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
have no Tatoeba id) and in the two override lists below.

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
}

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
}


def sentence_slots(jp, tagger, krd):
    """[kanji, surface-reading, base-reading] | None per kanji in `jp`, left
    to right: sentence_readings.analyze_sentence's `kr`, with the overrides."""
    slots = []
    seen = {}
    for w in tagger(jp):
        surf = w.surface
        kanji = [c for c in surf if is_kanji(c)]
        if not kanji:
            continue
        if surf in TOKEN_READING_OVERRIDES:
            triples = [list(t) for t in TOKEN_READING_OVERRIDES[surf]]
        else:
            kana = kata2hira(w.feature.kana or w.feature.pron or "")
            a = align(surf, kana, krd) if kana else None
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
        total += len(slots)
        ok += sum(1 for s in slots if s is not None)
        out[jp] = slots

    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    pct = 100 * ok / total if total else 0
    print(f"wrote {path}")
    print(f"kanji reading coverage: {ok}/{total} ({pct:.1f}%) across {len(out)} sentences")


if __name__ == "__main__":
    main()
