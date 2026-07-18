# -*- coding: utf-8 -*-
"""Which KIND of reading a (kanji, base) fact is: on'yomi, kun'yomi, or both.

WHY THIS IS A SEPARATE MODULE
=============================
KANJIDIC2 tags every reading `r_type="ja_on"` or `ja_kun`, and that tag is the
only thing in the data that can explain why 一 is read いち in 一年 and ひと in
一つ — one is a borrowed Chinese pronunciation, the other is the native
Japanese word. `readings.json` was cut before this field existed, so the field
has to be back-fillable onto the shipped file WITHOUT a full re-cut: a re-cut
against a newer JMdict would re-key the reading facts, and a reading fact's id
is what the user's study history is stored under. So:

    python3 scripts/ingest/readingtype.py --kanjidic /path/to/kanjidic2.xml

rewrites only the `type` field of src/data/generated/readings.json and touches
nothing else. build.py imports `types_for` and emits the same field on a full
re-cut, so the two paths cannot disagree.

NORMALISATION MUST MATCH THE ALIGNER
====================================
`base` in readings.json is the aligner's normalised form — katakana folded to
hiragana, okurigana after the `.` dropped, leading/trailing `-` stripped. This
module reuses aligner.clean_kun/kata2hira rather than reimplementing them, or
イチ would never match いち and every on-reading would come back untyped.

BOTH IS A REAL ANSWER, NOT A TIE TO BREAK
=========================================
The normalisation collapses distinct KANJIDIC2 entries: 生 lists せい as ja_on
and (via い.きる etc.) a family of ja_kun, and 日 has readings that land on the
same hiragana core from both lists. Picking one silently would state a fact the
dictionary does not state. `both` is emitted instead and the UI says so.
"""

import argparse
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aligner import clean_kun, kata2hira  # noqa: E402

OUT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "data", "generated"
)

# KANJIDIC2 files 22 of the 2,136 jouyou kanji's RADICAL INDEX as if it were an
# English meaning: 一 -> "one radical (no.1)", 二 -> "two radical (no. 7)". It is
# catalogue metadata, it is not what the character means, and it leaks into the
# quiz as both an accepted answer and a distractor.
#
# THE PATTERN IS THE NUMBER, NOT THE WORD "RADICAL". 基 genuinely means
# "radical (chem)" -- a chemical radical -- and 偏 genuinely means "left-side
# radical". Filtering on the word would delete correct meanings; only the
# numbered index form `radical (no. N)` is metadata.
RADICAL_INDEX = re.compile(r"\bradical\s*\(no\.\s*\d+\s*\)", re.IGNORECASE)


def clean_meanings(meanings):
    """Drop KANJIDIC2 radical-index entries, keep every real meaning."""
    return [m for m in meanings if m and not RADICAL_INDEX.search(m)]


def kinds_of(ch):
    """{base: 'on' | 'kun' | 'both'} for one KANJIDIC2 <character> element."""
    kinds = {}
    for r in ch.iter("reading"):
        t = r.get("r_type")
        if t == "ja_on":
            base, kind = kata2hira(r.text or "").strip("-"), "on"
        elif t == "ja_kun":
            base, kind = clean_kun(kata2hira(r.text or "")), "kun"
        else:
            continue
        if not base:
            continue
        prev = kinds.get(base)
        kinds[base] = kind if prev in (None, kind) else "both"
    return kinds


def load_reading_types(path):
    """kanji -> {base: 'on' | 'kun' | 'both'} straight off KANJIDIC2."""
    root = ET.parse(path).getroot()
    return {ch.findtext("literal"): kinds_of(ch) for ch in root.findall("character")}


def types_for(kinds, base):
    """The type of one (kanji, base) fact, or None when KANJIDIC2 has no such
    reading for that kanji. None is not a failure to be papered over: the
    aligner accepts voiced/geminated surface forms, and a base it derived is
    occasionally not one KANJIDIC2 lists verbatim."""
    return kinds.get(base)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kanjidic", required=True, help="path to kanjidic2.xml")
    args = ap.parse_args()

    types = load_reading_types(args.kanjidic)
    p = os.path.join(OUT, "readings.json")
    rows = json.load(open(p, encoding="utf-8"))

    tally = {"on": 0, "kun": 0, "both": 0, None: 0}
    for r in rows:
        t = types_for(types.get(r["k"], {}), r["base"])
        tally[t] += 1
        if t:
            r["type"] = t
        else:
            r.pop("type", None)

    with open(p, "w", encoding="utf-8") as fh:
        json.dump(rows, fh, ensure_ascii=False, separators=(",", ":"))
    print(
        f"readings.json: {len(rows)} rows -> on={tally['on']} kun={tally['kun']} "
        f"both={tally['both']} untyped={tally[None]}"
    )


if __name__ == "__main__":
    main()
