# -*- coding: utf-8 -*-
"""Reduce CEJC's pronunciation-frequency workbook to Saku's vocabulary.

The raw CEJC archive is intentionally ignored by git. This script downloads a
pinned release when requested, streams the nested XLSX without third-party
packages, and commits only a compact aggregate keyed by JMdict written form and
normalized reading.

    python3 scripts/ingest/cejc_reading_frequency.py --download
    python3 scripts/ingest/cejc_reading_frequency.py --check

Source: Corpus of Everyday Japanese Conversation (CEJC), short-unit vocabulary
and word-count tables, version 2022.09, National Institute for Japanese Language
and Linguistics. Research/educational use is free; raw redistribution is not.
"""

import argparse
import hashlib
import io
import json
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict


HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
RAW_DIR = os.path.join(HERE, "raw", "cejc")
RAW_ZIP = os.path.join(RAW_DIR, "CEJC-reading-frequency-ver202209.zip")
VOCAB = os.path.join(ROOT, "src", "data", "generated", "vocab.json")
OUT = os.path.join(ROOT, "src", "data", "generated", "cejc-reading-frequency.json")

VERSION = "2022.09"
URL = (
    "https://www2.ninjal.ac.jp/conversation/cejc/data/"
    "CEJC%E7%9F%AD%E5%8D%98%E4%BD%8D%E8%AA%9E%E5%BD%99%E8%A1%A8_"
    "%E6%9B%B8%E5%AD%97%E5%BD%A2%E5%88%A5_%E7%99%BA%E9%9F%B3%E5%BD%A2%E5%88%A5_"
    "ver202209.zip"
)
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def download():
    os.makedirs(RAW_DIR, exist_ok=True)
    print(f"downloading CEJC {VERSION} -> {RAW_ZIP}")
    urllib.request.urlretrieve(URL, RAW_ZIP)


def hiragana(text):
    """Katakana dictionary reading -> the hiragana representation Saku uses."""
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in text)


def colnum(ref):
    letters = re.match(r"[A-Z]+", ref).group()
    n = 0
    for c in letters:
        n = n * 26 + ord(c) - 64
    return n - 1


def cells(row, shared):
    out = {}
    for cell in row.findall(NS + "c"):
        value = cell.find(NS + "v")
        if value is None:
            continue
        raw = value.text or ""
        out[colnum(cell.get("r"))] = shared[int(raw)] if cell.get("t") == "s" else raw
    return out


def nested_workbook(archive):
    with zipfile.ZipFile(archive) as outer:
        member = next(
            name for name in outer.namelist()
            if name.endswith("6_cejc_frequencylist_suw_hatuonkei.xlsx")
        )
        return io.BytesIO(outer.read(member))


def reduce(archive):
    vocab = {row["keb"] for row in json.load(open(VOCAB, encoding="utf-8"))}
    counts = defaultdict(lambda: defaultdict(int))

    with zipfile.ZipFile(nested_workbook(archive)) as book:
        shared = []
        with book.open("xl/sharedStrings.xml") as source:
            for _, el in ET.iterparse(source, events=("end",)):
                if el.tag == NS + "si":
                    shared.append("".join(t.text or "" for t in el.iter(NS + "t")))
                    el.clear()

        headers = None
        with book.open("xl/worksheets/sheet1.xml") as source:
            for _, row in ET.iterparse(source, events=("end",)):
                if row.tag != NS + "row":
                    continue
                values = cells(row, shared)
                if headers is None:
                    headers = {name: i for i, name in values.items()}
                    required = {"語彙素", "語彙素読み", "frequency"}
                    missing = required - headers.keys()
                    if missing:
                        raise RuntimeError(f"CEJC columns changed; missing {sorted(missing)}")
                    row.clear()
                    continue
                keb = values.get(headers["語彙素"])
                reb = values.get(headers["語彙素読み"])
                frequency = values.get(headers["frequency"])
                if keb in vocab and reb and frequency:
                    # Several observed phonetic forms (ヨン, ヨ, ヨッ) can share
                    # one lexical reading (ヨン). Sum those rows at the reading
                    # grain the dictionary and UI use.
                    counts[keb][hiragana(reb)] += int(float(frequency))
                row.clear()

    words = {
        keb: dict(sorted(readings.items(), key=lambda p: (-p[1], p[0])))
        for keb, readings in sorted(counts.items())
        if len(readings) > 1
    }
    digest = hashlib.sha256(open(archive, "rb").read()).hexdigest()
    return {
        "source": {
            "name": "Corpus of Everyday Japanese Conversation (CEJC)",
            "version": VERSION,
            "url": URL,
            "rawSha256": digest,
            "measure": "short-unit occurrences grouped by lexeme and lexical reading",
        },
        "words": words,
    }


def encoded(data):
    return (json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.download or not os.path.exists(RAW_ZIP):
        if not args.download:
            raise SystemExit(f"missing ignored CEJC archive: {RAW_ZIP}; rerun with --download")
        download()
    result = encoded(reduce(RAW_ZIP))
    if args.check:
        current = open(OUT, "rb").read() if os.path.exists(OUT) else b""
        if current != result:
            raise SystemExit(f"{OUT} is stale; regenerate without --check")
        print(f"CEJC reading lookup is current ({len(json.loads(result)['words'])} words)")
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as fh:
        fh.write(result)
    print(f"wrote {OUT} ({len(json.loads(result)['words'])} multi-reading words)")


if __name__ == "__main__":
    main()
