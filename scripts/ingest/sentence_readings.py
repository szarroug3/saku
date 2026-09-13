# -*- coding: utf-8 -*-
"""
Sentence-level furigana AND highlight span for word-examples.json's example
sentences (SAK-95, SAK-97).

Run, AFTER scripts/build-word-examples.ts has (re)generated word-examples.json:

    uv run --with fugashi --with unidic-lite scripts/ingest/sentence_readings.py

WHAT THIS ADDS
==============
Two fields, filled from ONE fugashi tokenization pass per sentence:

`kr`: an array with one slot per KANJI CHARACTER in `jp`, left to right (kana
characters contribute no slot -- the renderer walks `jp` directly for those,
the same way src/lib/library/word-pieces.ts's `piecesOf()` walks a word's
`keb`). Each slot is either [kanji, surface-reading, base-reading] -- the
exact triple shape `VocabRow.align` already uses (src/data/vocab.ts) -- or
null when this kanji's reading in this sentence could not be safely
determined.

`start`/`end` (SAK-97): the `[start, end)` character span within `jp` where
the word's CONJUGATED surface form appears, for the word-page highlight
(SAK-94). build-word-examples.ts always emits these null; this script is the
single source of truth for the span, using the SAME lemma resolution
scripts/ingest/assembly.py's `content_lemmas()` already uses to match a
conjugated form back to its dictionary entry: tokenize with fugashi, and for
each CONTENT-POS token take `orthBase`, falling back to `lemma` when
`orthBase` is empty. The first content token whose resolved lemma equals the
word's `keb` gives the span, at its real position in `jp` -- so 思う shown as
だと思った highlights 思った, not nothing. No match (the tokenizer's lemma
resolution disagrees with `keb`, or the word genuinely never occurs) leaves
start/end null -- "absent, not wrong", the same refusal used for `kr`. Never a
substring guess. How far past the matched token the span runs depends on
whether the word has forms at all: a verb or adjective keeps its whole
conjugated surface, a word with no conjugation class stops at the word, so
仕事です underlines 仕事 (SAK-422). See analyze_sentence and conjugating_kebs.

WHY A SEPARATE PASS, NOT PART OF build-word-examples.ts
=========================================================
build-word-examples.ts is a Node/TypeScript script; word CHOICE is pure JS and
tested in word-example.test.ts. Reading extraction needs a real Japanese
morphological tokenizer (fugashi + unidic-lite -- the same tokenizer
scripts/ingest/assembly.py already trusts for word-boundary splitting), which
is a Python-only dependency in this repo. So this runs as a SECOND pass, after
the TS script, re-reading and rewriting the JSON it produced -- the same
two-step shape assembly.py already uses to re-tokenize grammar-corpus.json.

HOW A READING IS RESOLVED
==========================
1. Tokenize `jp` with fugashi (same tagger + dictionary as assembly.py).
2. For each token containing a kanji, take its SURFACE reading from unidic's
   `kana` feature -- the pronunciation of the surface form AS WRITTEN, already
   respecting conjugation. 食べた tokenizes as 食べ + た, with `kana` タベ on the
   食べ token; aligning against that surface (not the dictionary lemma 食べる)
   handles conjugation for free, because okurigana is matched as literal kana
   by aligner.align() regardless of which inflected form it belongs to.
3. Feed (surface, surface-reading) into aligner.align() -- THE SAME per-kanji
   segmentation `VocabRow.align` already uses -- against a reading-candidate
   table built from vocab.json's OWN attested (kanji -> base reading) pairs
   (see build_krd). This is not raw KANJIDIC2 on/kun/nanori data: that XML is
   not committed to this repo, and scripts/ingest/build.py downloads it to the
   ignored scripts/ingest/raw directory and checks it against the hash in
   src/data/generated/sources.json before it will regenerate vocab.json, so it
   cannot be re-run here. Every reading in vocab.json's `align` field is nonetheless
   real KANJIDIC2 data -- it was produced by this SAME aligner.align() against
   the real dictionary when vocab.json was last built -- so reusing it as the
   candidate table is a legitimate (if smaller and un-refreshed-since) subset
   of the true reading set, not an invention.
4. A token that fails to align (a jukujikun like 明日/あす or 時計/とけい, or a
   reading vocab.json never happened to attest for that kanji, like 私's
   formal わたくし) contributes null for each of its kanji slots. NEVER a
   guess -- the same refusal VocabRow.align already makes for the word-level
   2.6% it cannot cleanly split.
5. SENTENCE_READING_OVERRIDES (SAK-261) wins over all of the above, for the
   rarer failure mode step 4 does NOT cover: the tagger returning a real,
   dictionary-attested reading that is simply wrong for this sentence (仏
   read as the France-abbreviation フツ instead of the deity ホトケ), rather
   than refusing to resolve. A short, hand-curated, named exception list --
   see the constant's own comment.

MEASURED ACCURACY (full write-up in the SAK-95 Linear comment)
================================================================
95.0% of kanji-bearing tokens aligned across a random 40-sentence sample of
word-examples.json (101 tokens, 96 aligned; seed 42). Every failure returns
null, never a wrong reading. Hand-spot-checked against a conjugated verb
(着替える -> 着 き / 替 が, base か -- the correct sound shift), a compound
(血液検査 -> all four kanji correctly split with on-reading compounds), and a
sound-shifted reading (学校 -> 学 がっ, base がく, the sokuon shift). One
documented caveat: 日本 aligns to にっぽん specifically because that is the only
reading unidic-lite's dictionary emits for that lemma AND it happens to
survive aligner's sokuon/handaku variant rules, while the more colloquial
にほん does not (に alone is not a listed on-reading candidate for 日, only にち
is, and にち -> に is not a covered variant). にっぽん is genuinely correct
Japanese, not a fabricated reading, so this does not violate "absent, not
wrong" -- it is documented here as a known reading-choice quirk, not a bug.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from aligner import align, is_kanji, kata2hira  # noqa: E402

GEN = os.path.join(HERE, "..", "..", "src", "data", "generated")
WORD_FORMS_TS = os.path.join(HERE, "..", "..", "src", "lib", "word-forms.ts")

try:
    import fugashi
    import unidic_lite  # noqa: F401
except ImportError:
    sys.exit(
        "FATAL: fugashi + unidic-lite are required and there is no fallback.\n"
        "Sentence-level furigana needs a real morphological tokenizer, the\n"
        "same standard scripts/ingest/assembly.py already holds word-boundary\n"
        "splitting to. Install them (uv run --with fugashi --with unidic-lite\n"
        "scripts/ingest/sentence_readings.py) or ship no sentence readings.\n"
    )


def build_krd(vocab):
    """A per-kanji reading-candidate table, shaped the way aligner.candidates()
    expects (on/kun/nanori buckets), built from vocab.json's OWN align data --
    see the module docstring for why this stands in for raw KANJIDIC2. Every
    base reading any vocabulary word has ever attested for a kanji becomes a
    'kun'-bucket candidate; on vs kun only matters to aligner as a cost
    tie-break, and there is no such distinction left to make from this source,
    so everything goes in one bucket at the same cost."""
    krd = {}
    for w in vocab:
        a = w.get("align")
        if not a:
            continue
        for kanji, _surface, base in a:
            d = krd.setdefault(kanji, {"on": [], "kun": [], "nanori": []})
            if base not in d["kun"]:
                d["kun"].append(base)
    return krd


# Content POS, for the highlight-span match (SAK-97). Mirrors
# scripts/ingest/assembly.py's CONTENT_POS exactly -- content_lemmas() there
# is the resolver this reuses, so the gate that decides which tokens are
# eligible to BE a lemma has to match too, or a particle or auxiliary could
# spuriously resolve to a content word's keb.
CONTENT_POS = ("名詞", "動詞", "形容詞", "形状詞", "副詞", "代名詞")

# The two 接続助詞 lemmas that belong to the word rather than to the sentence
# (SAK-422). See analyze_sentence's docstring for why this is a lemma list and
# not the 接続助詞 tag: て covers て / で / ちゃ / じゃ, ば covers the
# conditional, and every other 接続助詞 (から, けど, ながら, ので, のに) joins
# clauses and must stay outside the underline.
INFLECTING_PARTICLE_LEMMAS = ("て", "ば")

def conjugating_kebs():
    """Every `keb` the app gives a conjugation class, which is the one fact the
    span rule needs and the tokenizer cannot supply (SAK-422).

    THE RULE THE SET IS FOR. The copula is not part of the noun. 仕事です is a
    noun and a copula, not an inflected 仕事, so the underline stops at 仕事; a
    verb or adjective keeps its whole conjugated form, and that includes a
    na-adjective, whose です, な and に ARE its own forms (危険です, 大好きな).
    UniDic cannot draw that line, because it files 危険, 便利 and 冷静 as 名詞
    right beside 仕事 and 写真. JMdict can, through the same POS_TO_CLASS the
    word page's Forms section is built from, so the split is read off the app's
    own class rather than guessed from a tag.

    READ, NOT MIRRORED. The class names come out of src/lib/word-forms.ts's
    POS_TO_CLASS at run time, and the rows out of vocab-runtime.json, the file
    `VOCAB` itself is loaded from. Retyping the pos strings here is precisely
    the mistake word-forms.ts's own header records twice: both earlier copies
    covered the nine regular godan strings and silently dropped 行く, ある and
    every other special class, and a verb with no class is indistinguishable
    from a noun. A copy would have gone wrong the same way, one underline at a
    time, so there is no copy: a map that moves fails loudly below instead.

    Membership, not the code, is all this needs, so it takes the union of the
    row's own pos and its senses' -- the same fall-through `wordClassOf` makes
    for a spelling whose leading sense does not conjugate (ある, "a certain" /
    "to exist") -- rather than reimplementing which of several codes wins.
    """
    src = open(WORD_FORMS_TS, encoding="utf-8").read()
    head = src.find("export const POS_TO_CLASS")
    tail = src.find("\n};", head)
    body = src[head:tail] if head >= 0 and tail > head else ""
    pos_names = {name for name, _cls in re.findall(r'"([^"]+)":\s*"([a-z0-9-]+)"', body)}
    if len(pos_names) < 20:
        sys.exit(
            f"FATAL: read {len(pos_names)} pos strings out of POS_TO_CLASS in\n"
            f"{WORD_FORMS_TS}; the map holds 22. It has moved, been renamed or\n"
            "changed shape. Fix this reader rather than typing the strings in\n"
            "here: a short list is how the class of 行く got lost twice before.\n"
        )

    rows = json.load(open(os.path.join(GEN, "vocab-runtime.json"), encoding="utf-8"))["rows"]
    out = set()
    for row in rows:
        pos = list(row.get("pos") or [])
        for sense in row.get("senses") or []:
            pos.extend(sense.get("pos") or [])
        if any(p in pos_names for p in pos):
            out.add(row["keb"])
    return out


# Hand-corrected sentence readings (SAK-261): the rare case where
# unidic-lite's tagger resolves a token to a real, dictionary-attested
# reading that is simply the wrong ONE for this particular sentence, rather
# than failing to resolve at all -- so "absent, not wrong" doesn't catch it,
# because the tagger isn't refusing, it's confidently wrong.
#
#   - id 10565801, 仏の顔も三度まで。 ("even a Buddha's face [gets angry] after
#     three strikes"): unidic-lite tags 仏 here as フツ, the on'yomi
#     abbreviation for "France" used in compounds like 仏語 (French, the
#     language) -- a real reading of 仏, just not this one. The proverb's 仏
#     is unambiguously the deity, kun'yomi ホトケ.
#
#   - id 138214, 太鼓判を押してくれた。 ("[they] gave it their seal of
#     approval"): 太鼓判 is たいこばん, one word with rendaku on 判. Whether the
#     tagger sees it that way depends on which unidic build is installed: one
#     splits 太鼓判 into 太鼓 + 判 and reads the second half ハン, the plain
#     on'yomi, which is a real reading of 判 and the wrong one here. Pinning it
#     makes the committed file the same on either dictionary, which is what a
#     regeneration has to be able to promise.
#
# Keyed by (Tatoeba sentence id, kanji character, 0-based occurrence of that
# character among the sentence's kanji slots), so a second occurrence of the
# same character elsewhere in the same sentence is untouched. A short, named
# list, same philosophy as word-example.ts's WRONG_SENSE_EXAMPLES: this is a
# human judgment call about sense, not something a rule can catch.
SENTENCE_READING_OVERRIDES = {
    (10565801, "仏", 0): ("ほとけ", "ほとけ"),
    (138214, "判", 0): ("ばん", "はん"),
}


def analyze_sentence(jp, tagger, krd, keb, entry_id, conjugates):
    """One fugashi tokenization of `jp` produces both outputs this script
    fills in:

    - `kr`: [kanji, surface-reading, base-reading] | null per kanji CHARACTER
      in `jp`, left to right -- the same triple shape as VocabRow.align, so
      the rendering side can reuse piecesOf()'s convention unchanged instead
      of inventing a second one.
    - `(start, end)`: the highlight span (SAK-97) for the first CONTENT-POS
      token whose orthBase (falling back to lemma) equals `keb` -- the same
      resolution assembly.py's content_lemmas() uses to match a conjugated
      surface form back to its dictionary entry. (None, None) when no token
      resolves to `keb`: absent, not a guess.

    `entry_id` (the Tatoeba sentence id) is only used to look up
    SENTENCE_READING_OVERRIDES -- a hand-corrected reading, when the tagger
    resolved a REAL reading that is simply wrong for this sentence, wins over
    whatever the tokenizer/aligner produced for that kanji slot.

    UniDic splits a conjugated predicate into the content-verb morph plus a
    CHAIN of trailing 助動詞 (auxiliary-verb) tokens -- 思った is 思っ (動詞,
    orthBase 思う) + た (助動詞); 食べさせられた is 食べ + させ + られ + た, all
    four chained. Taking only the matched content token's surface would
    highlight 思っ and leave った bare, so once the content token is found,
    `end` extends through each immediately-following, contiguous 助動詞
    token -- the whole conjugated surface, not just its first morph.

    TWO PARTICLES ARE PART OF THE FORM, NOT THE CLAUSE (SAK-422). The chain
    above is not enough on its own, because UniDic tags the て of a て-form and
    the ば of a conditional as 助詞/接続助詞, not 助動詞: 包んで is 包ん (動詞)
    + で (接続助詞, lemma て), and the 助動詞-only chain stopped at 包ん, so the
    page underlined 包ん and left で bare -- the same half-a-word the chain was
    added to prevent. So the chain also absorbs a following 接続助詞 whose
    LEMMA is て or ば. Lemma, not surface: it is what makes で (包んで),
    ちゃ (眠らなくちゃ) and じゃ one entry -- they all lemmatise to て -- while
    leaving every other 接続助詞 out. That exclusion is the point of matching
    on those two lemmas rather than on the 接続助詞 tag: から (読んだから),
    けど (急いでいるけど) and ながら (食べながら) are the same part of speech
    and they join CLAUSES, so swallowing them would underline a sentence where
    a word belongs.

    AND THE CHAIN IS ONLY FOR WORDS THAT HAVE FORMS (SAK-422). `conjugates` is
    whether the app gives this word a conjugation class (see
    `conjugating_kebs`). When it does not, the span is the matched token and
    nothing after it: 仕事です is 仕事 plus a copula, not an inflected 仕事, so
    the underline stops at the noun. The chain above runs unchanged for a verb
    or an adjective, na-adjectives included, where です, な and に are the
    word's own forms and the Forms section shows them.
    """
    toks = list(tagger(jp))
    offsets = []
    cursor = 0
    for w in toks:
        offsets.append(cursor)
        cursor += len(w.surface)

    slots = []
    kanji_occurrence = {}
    for w in toks:
        surf = w.surface
        if not any(is_kanji(c) for c in surf):
            # No kanji in this token: nothing to add, and nothing consumed --
            # the renderer walks `jp` directly for the kana in between slots.
            continue
        kana = kata2hira(w.feature.kana or w.feature.pron or "")
        a = align(surf, kana, krd) if kana else None
        kanji_chars = [c for c in surf if is_kanji(c)]
        if a:
            triples = [list(t) for t in a]
        else:
            triples = [None] * len(kanji_chars)
        for i, kc in enumerate(kanji_chars):
            occ = kanji_occurrence.get(kc, 0)
            kanji_occurrence[kc] = occ + 1
            override = SENTENCE_READING_OVERRIDES.get((entry_id, kc, occ))
            if override:
                triples[i] = [kc, override[0], override[1]]
        slots.extend(triples)

    start = end = None
    for i, w in enumerate(toks):
        pos1 = getattr(w.feature, "pos1", None) or ""
        if pos1 not in CONTENT_POS:
            continue
        orth = getattr(w.feature, "orthBase", None) or ""
        lemma = getattr(w.feature, "lemma", None) or ""
        if (orth or lemma) != keb:
            continue
        start = offsets[i]
        end = offsets[i] + len(w.surface)
        if not conjugates:
            break  # a noun's underline stops at the noun; the copula is not it
        j = i + 1
        while j < len(toks):
            nf = toks[j].feature
            npos1 = getattr(nf, "pos1", None) or ""
            npos2 = getattr(nf, "pos2", None) or ""
            nlemma = getattr(nf, "lemma", None) or ""
            inflecting = npos1 == "助動詞" or (npos1 == "助詞" and npos2 == "接続助詞" and nlemma in INFLECTING_PARTICLE_LEMMAS)
            if not inflecting:
                break
            end = offsets[j] + len(toks[j].surface)
            j += 1
        break  # first match wins, consistent with chooseExample's ordering
    return slots, start, end


def main():
    vocab = json.load(open(os.path.join(GEN, "vocab.json"), encoding="utf-8"))
    krd = build_krd(vocab)
    print(f"reading-candidate table: {len(krd)} kanji, derived from vocab.json's own align data")

    conjugating = conjugating_kebs()
    print(f"words with a conjugation class: {len(conjugating)}, read from word-forms.ts's POS_TO_CLASS")

    examples_path = os.path.join(GEN, "word-examples.json")
    examples = json.load(open(examples_path, encoding="utf-8"))
    tagger = fugashi.Tagger()

    n_kanji_tot = 0
    n_kanji_ok = 0
    n_spanned = 0
    out = {}
    for keb, row in examples.items():
        entry_id, jp, en = row[0], row[1], row[2]
        # start/end from row[3]/row[4] are ignored -- build-word-examples.ts
        # always emits them null (SAK-97); this pass is the single source of
        # truth for the span, computed below in the same tokenization as kr.
        kr, start, end = analyze_sentence(jp, tagger, krd, keb, entry_id, keb in conjugating)
        n_kanji_tot += len(kr)
        n_kanji_ok += sum(1 for s in kr if s is not None)
        if start is not None:
            n_spanned += 1
        out[keb] = [entry_id, jp, en, start, end, kr]

    with open(examples_path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")

    pct = 100 * n_kanji_ok / n_kanji_tot if n_kanji_tot else 0
    span_pct = 100 * n_spanned / len(out) if out else 0
    print(f"wrote {examples_path}")
    print(f"kanji reading coverage: {n_kanji_ok}/{n_kanji_tot} ({pct:.1f}%) across {len(out)} sentences")
    print(f"highlight span coverage: {n_spanned}/{len(out)} ({span_pct:.1f}%)")


if __name__ == "__main__":
    main()
