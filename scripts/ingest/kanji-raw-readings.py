# -*- coding: utf-8 -*-
"""SAK-265: back-fill RAW KANJIDIC2 on'yomi/kun'yomi onto kanji.json.

WHY THIS EXISTS
================
readings.json (and therefore src/data/kanji.ts's READINGS, and everything the
Library page's on'yomi/kun'yomi sections read) is not "every reading KANJIDIC2
lists" -- it is "every (kanji, reading) pair some TAUGHT everyday word's kana
actually aligns to" (see aligner.py / build.py's `pairs`). A kanji with no
everyday word that attests a reading -- or only words the aligner cannot
decompose (jukujikun) -- gets ZERO rows there, even when KANJIDIC2 documents
real readings for it. 114 of 2,136 jouyou kanji (壱, 藩, 栃, 陛, ...) are this
case, and their Library pages silently print no reading section at all.

This script does not touch readings.json or the aligned-reading pipeline. It
back-fills a SEPARATE, clearly-labelled pair of fields straight from KANJIDIC2
-- `on` and `kun`, the raw normalised reading list for every jouyou kanji --
onto kanji.json, exactly the way readingtype.py back-fills `type` onto
readings.json without a full re-cut. src/lib/library/entries.ts and
character-entry-content.ts read these as a FALLBACK ONLY, for the reading
groups the aligned data has nothing for -- never as a substitute for real
evidence where real evidence exists, and never wired into anything gradeable
(no anchor word, so no everyday word to ask "what does 壱 read in ___?" about).

NORMALISATION MATCHES THE ALIGNER, ON PURPOSE
==============================================
Reuses aligner.clean_kun / aligner.kata2hira -- the exact functions
readingtype.py's `kinds_of` already builds its {base: kind} map with -- so a
kanji's raw fallback base and its aligned base are the same string whenever
both exist, and the two data sources can never quietly disagree on spelling.

    python3 scripts/ingest/kanji-raw-readings.py --kanjidic /path/to/kanjidic2.xml
"""

import argparse
import json
import os
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aligner import clean_kun, kata2hira  # noqa: E402

OUT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "data", "generated"
)


def raw_readings_of(ch):
    """(on, kun): ordered, deduped, normalised reading lists for one KANJIDIC2
    <character> element, in the file's own order (primary reading first)."""
    on, kun, seen_on, seen_kun = [], [], set(), set()
    for r in ch.iter("reading"):
        t = r.get("r_type")
        if t == "ja_on":
            base = kata2hira(r.text or "").strip("-")
            if base and base not in seen_on:
                seen_on.add(base)
                on.append(base)
        elif t == "ja_kun":
            base = clean_kun(kata2hira(r.text or ""))
            if base and base not in seen_kun:
                seen_kun.add(base)
                kun.append(base)
    return on, kun


def load_raw_readings(path):
    """literal -> (on, kun) for every <character> KANJIDIC2 documents."""
    root = ET.parse(path).getroot()
    out = {}
    for ch in root.findall("character"):
        lit = ch.findtext("literal")
        out[lit] = raw_readings_of(ch)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kanjidic", required=True, help="path to kanjidic2.xml")
    args = ap.parse_args()

    raw = load_raw_readings(args.kanjidic)
    p = os.path.join(OUT, "kanji.json")
    rows = json.load(open(p, encoding="utf-8"))

    missing_from_kanjidic = []
    both_empty = 0
    for row in rows:
        pair = raw.get(row["c"])
        if pair is None:
            missing_from_kanjidic.append(row["c"])
            continue
        on, kun = pair
        row["on"] = on
        row["kun"] = kun
        if not on and not kun:
            both_empty += 1

    if missing_from_kanjidic:
        sys.exit(
            "kanjidic2.xml is missing "
            f"{len(missing_from_kanjidic)} jouyou kanji already in kanji.json: "
            f"{''.join(missing_from_kanjidic)} -- refusing to write a partial "
            "back-fill. Check the --kanjidic file is the real, complete dump."
        )

    with open(p, "w", encoding="utf-8") as fh:
        json.dump(rows, fh, ensure_ascii=False, separators=(",", ":"))
    print(
        f"kanji.json: back-filled on/kun for {len(rows)} kanji "
        f"({both_empty} with neither -- KANJIDIC2 itself documents no reading)"
    )


if __name__ == "__main__":
    main()
