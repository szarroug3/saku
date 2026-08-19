# -*- coding: utf-8 -*-
"""
Sentence-level furigana: per-kanji reading breakdown for word-examples.json's
example sentences (SAK-95).

Run, AFTER scripts/build-word-examples.ts has (re)generated word-examples.json:

    uv run --with fugashi --with unidic-lite scripts/ingest/sentence_readings.py

WHAT THIS ADDS
==============
Adds one field, `kr`, to every row of word-examples.json: an array with one
slot per KANJI CHARACTER in `jp`, left to right (kana characters contribute no
slot -- the renderer walks `jp` directly for those, the same way
src/lib/library/word-pieces.ts's `piecesOf()` walks a word's `keb`). Each slot
is either [kanji, surface-reading, base-reading] -- the exact triple shape
`VocabRow.align` already uses (src/data/vocab.ts) -- or null when this kanji's
reading in this sentence could not be safely determined.

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
   not committed to this repo, and scripts/ingest/build.py needs a `--src`
   pointing at a local copy to regenerate vocab.json itself, so it cannot be
   re-run here. Every reading in vocab.json's `align` field is nonetheless
   real KANJIDIC2 data -- it was produced by this SAME aligner.align() against
   the real dictionary when vocab.json was last built -- so reusing it as the
   candidate table is a legitimate (if smaller and un-refreshed-since) subset
   of the true reading set, not an invention.
4. A token that fails to align (a jukujikun like 明日/あす or 時計/とけい, or a
   reading vocab.json never happened to attest for that kanji, like 私's
   formal わたくし) contributes null for each of its kanji slots. NEVER a
   guess -- the same refusal VocabRow.align already makes for the word-level
   2.6% it cannot cleanly split.

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
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from aligner import align, is_kanji, kata2hira  # noqa: E402

GEN = os.path.join(HERE, "..", "..", "src", "data", "generated")

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


def sentence_kanji_readings(jp, tagger, krd):
    """[kanji, surface-reading, base-reading] | null per kanji CHARACTER in
    `jp`, left to right -- the same triple shape as VocabRow.align, so the
    rendering side can reuse piecesOf()'s convention unchanged instead of
    inventing a second one."""
    slots = []
    for w in tagger(jp):
        surf = w.surface
        if not any(is_kanji(c) for c in surf):
            # No kanji in this token: nothing to add, and nothing consumed --
            # the renderer walks `jp` directly for the kana in between slots.
            continue
        kana = kata2hira(w.feature.kana or w.feature.pron or "")
        a = align(surf, kana, krd) if kana else None
        n_kanji = sum(1 for c in surf if is_kanji(c))
        if a:
            slots.extend([list(t) for t in a])
        else:
            slots.extend([None] * n_kanji)
    return slots


def main():
    vocab = json.load(open(os.path.join(GEN, "vocab.json"), encoding="utf-8"))
    krd = build_krd(vocab)
    print(f"reading-candidate table: {len(krd)} kanji, derived from vocab.json's own align data")

    examples_path = os.path.join(GEN, "word-examples.json")
    examples = json.load(open(examples_path, encoding="utf-8"))
    tagger = fugashi.Tagger()

    n_kanji_tot = 0
    n_kanji_ok = 0
    out = {}
    for keb, row in examples.items():
        entry_id, jp, en = row[0], row[1], row[2]
        kr = sentence_kanji_readings(jp, tagger, krd)
        n_kanji_tot += len(kr)
        n_kanji_ok += sum(1 for s in kr if s is not None)
        out[keb] = [entry_id, jp, en, kr]

    with open(examples_path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")

    pct = 100 * n_kanji_ok / n_kanji_tot if n_kanji_tot else 0
    print(f"wrote {examples_path}")
    print(f"kanji reading coverage: {n_kanji_ok}/{n_kanji_tot} ({pct:.1f}%) across {len(out)} sentences")


if __name__ == "__main__":
    main()
