# -*- coding: utf-8 -*-
"""Reduce CEJC's lexical/pronunciation workbook to Saku's vocabulary.

The raw CEJC archive is intentionally ignored by git. This script downloads a
pinned release when requested, streams the nested XLSX without third-party
packages, and commits only compact pronunciation counts plus lexical/POS
teaching metadata. CEJC classifies core vocabulary, general conversational
interjections, grammar and fillers. Core and essential queues are frequency-
ordered, then scheduled with the approved five-response bootstrap and 30:4
cadence. Every matched word is retained, including words for which CEJC observed
only one reading.

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
from collections import Counter, defaultdict


HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
RAW_DIR = os.path.join(HERE, "raw", "cejc")
RAW_ZIP = os.path.join(RAW_DIR, "CEJC-reading-frequency-ver202209.zip")
VOCAB = os.path.join(ROOT, "src", "data", "generated", "vocab.json")
SENSES = os.path.join(ROOT, "src", "data", "generated", "word-senses.json")
DEFINITIONS = os.path.join(ROOT, "src", "data", "generated", "word-definitions.json")
ALTERNATES = os.path.join(ROOT, "src", "data", "number-word-alternates.json")
OUT = os.path.join(ROOT, "src", "data", "generated", "cejc-reading-frequency.json")

BOOTSTRAP_ESSENTIALS = ("はい", "うん", "いいえ", "いや", "えっ")
CORE_GAP = 30
ESSENTIAL_BATCH_SIZE = 4
CURATED_CANDIDATES = {"えっ": {"えっ"}}

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


def edit_distance(a, b):
    """Small-string Levenshtein distance for observed -> dictionary readings."""
    row = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        next_row = [i]
        for j, cb in enumerate(b, 1):
            next_row.append(min(
                next_row[-1] + 1,
                row[j] + 1,
                row[j - 1] + (ca != cb),
            ))
        row = next_row
    return row[-1]


def dictionary_reading(observed, lexical, candidates):
    """Map an observed surface pronunciation to a JMdict dictionary reading."""
    if observed in candidates:
        return observed
    distances = {reading: edit_distance(observed, reading) for reading in candidates}
    if not distances:
        return None
    nearest = min(distances.values())
    best = [reading for reading, distance in distances.items() if distance == nearest]
    # CEJC's lexical analysis resolves tied contractions such as ヨッ between
    # よ and よん, while a uniquely closer alternate captures サビー -> さぶい.
    if lexical in best:
        return lexical
    if len(best) == 1:
        return best[0]
    return lexical if lexical in candidates else None


def teaching_category(pos):
    """Classify a CEJC lexical/POS row for Saku's word curriculum.

    CEJC, not JMdict, decides whether the observed item is vocabulary, a
    conversational response, or grammar. Classification is deliberately on the
    lexical row rather than the spelling: そう/副詞 is core vocabulary while
    そう/助動詞語幹 is grammar, and あの/連体詞 is vocabulary while
    あの/感動詞-フィラー is excluded speech planning.
    """
    if not pos:
        return "excluded"
    if pos.startswith("感動詞-一般"):
        return "conversation-essential"
    if "フィラー" in pos or "言いよどみ" in pos:
        return "excluded"
    if (
        pos.startswith(("助詞", "助動詞", "接頭辞", "接尾辞", "接続詞"))
        or "非自立可能" in pos
        or "助動詞語幹" in pos
    ):
        return "grammar"
    if pos.startswith((
        "名詞", "代名詞", "動詞-一般", "形容詞", "形状詞",
        "副詞", "連体詞",
    )):
        return "core"
    return "excluded"


def cejc_pos_family(pos):
    if not pos:
        return None
    for prefix, family in (
        ("感動詞", "interjection"), ("助詞", "particle"),
        ("助動詞", "auxiliary"), ("接続詞", "conjunction"),
        ("副詞", "adverb"), ("連体詞", "adnominal"),
        ("代名詞", "pronoun"), ("動詞", "verb"),
        ("形容詞", "adjective"), ("形状詞", "adjective"),
        ("名詞", "noun"), ("接頭辞", "prefix"), ("接尾辞", "suffix"),
    ):
        if pos.startswith(prefix):
            return family
    return None


def jmdict_pos_families(tags):
    families = set()
    for tag in tags:
        lower = tag.lower()
        if "interjection" in lower:
            families.add("interjection")
        if "particle" in lower:
            families.add("particle")
        if "auxiliary" in lower or "copula" in lower:
            families.add("auxiliary")
        if "conjunction" in lower:
            families.add("conjunction")
        if "adverb" in lower:
            families.add("adverb")
        if "pre-noun adjectival" in lower:
            families.add("adnominal")
        if "pronoun" in lower:
            families.add("pronoun")
        if "verb" in lower:
            families.add("verb")
        if "adjective" in lower or "adjectival" in lower:
            families.add("adjective")
        if "noun" in lower and "adjectival" not in lower:
            families.add("noun")
        if "prefix" in lower:
            families.add("prefix")
        if "suffix" in lower:
            families.add("suffix")
    return families


def scheduled_teaching_rows(category_counts, family_counts, candidates):
    """Build the approved deterministic core/essential word sequence."""
    rows = {}
    for keb in candidates:
        counts = category_counts.get(keb, {})
        core = counts.get("core", 0)
        essential = counts.get("conversation-essential", 0)
        grammar = counts.get("grammar", 0)
        excluded = counts.get("excluded", 0)
        if keb in BOOTSTRAP_ESSENTIALS:
            category = "conversation-essential"
            count = essential
        elif core > 0 or essential > 0:
            category = "conversation-essential" if essential > core else "core"
            count = max(core, essential)
        elif grammar > 0:
            category = "grammar"
            count = grammar
        elif excluded > 0:
            category = "excluded"
            count = excluded
        else:
            category = "unobserved"
            count = 0
        rows[keb] = {
            "category": category,
            "cejcCount": count,
            "categoryCounts": {
                key: value for key, value in sorted(counts.items()) if value
            },
            "dominantPosFamily": (
                max(
                    (
                        (value, family)
                        for family, value in family_counts.get(keb, {}).get(category, {}).items()
                    ),
                    default=(0, None),
                )[1]
            ),
            "teachingRank": None,
            "placementRule": {
                "core": "cejc-core-frequency",
                "conversation-essential": "cejc-essential-frequency",
                "grammar": "grammar-track",
                "excluded": "not-teachable",
                "unobserved": "secondary-source-fallback",
            }[category],
        }

    bootstrap = [keb for keb in BOOTSTRAP_ESSENTIALS if keb in rows]
    for keb in bootstrap:
        rows[keb]["placementRule"] = "curated-essential-bootstrap"
    core = sorted(
        (keb for keb, row in rows.items() if row["category"] == "core"),
        key=lambda keb: (-rows[keb]["cejcCount"], keb),
    )
    essentials = sorted(
        (
            keb for keb, row in rows.items()
            if row["category"] == "conversation-essential" and keb not in bootstrap
        ),
        key=lambda keb: (-rows[keb]["cejcCount"], keb),
    )

    order = list(bootstrap)
    while core or essentials:
        order.extend(core[:CORE_GAP])
        del core[:CORE_GAP]
        batch = essentials[:ESSENTIAL_BATCH_SIZE]
        order.extend(batch)
        del essentials[:ESSENTIAL_BATCH_SIZE]
        for keb in batch:
            rows[keb]["placementRule"] = "essential-batch-after-30-core-items"
    for rank, keb in enumerate(order, 1):
        rows[keb]["teachingRank"] = rank
    return rows


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
    vocab_rows = json.load(open(VOCAB, encoding="utf-8"))
    senses = json.load(open(SENSES, encoding="utf-8"))
    definitions = json.load(open(DEFINITIONS, encoding="utf-8"))["words"]
    alternates = json.load(open(ALTERNATES, encoding="utf-8"))
    candidates = {}
    kana_candidates = {}
    candidate_families = {}
    for row in vocab_rows:
        keb = row["keb"]
        readings = [row["reb"]]
        readings.extend(sense["reb"] for sense in senses.get(keb, []))
        readings.extend(alternates.get(keb, []))
        readings.extend(
            reb
            for definition in definitions.get(keb, [])
            for reb in definition["readings"]
        )
        candidates[keb] = set(readings)
        tags = list(row["pos"])
        tags.extend(
            pos
            for definition in definitions.get(keb, [])
            for pos in definition["pos"]
        )
        candidate_families[keb] = jmdict_pos_families(tags)
        if keb == hiragana(row["reb"]):
            kana_candidates.setdefault(keb, keb)
    for keb, readings in CURATED_CANDIDATES.items():
        candidates[keb] = readings
        kana_candidates[keb] = keb
        candidate_families[keb] = {"interjection"}
    counts = defaultdict(lambda: defaultdict(int))
    category_counts = defaultdict(Counter)
    family_counts = defaultdict(lambda: defaultdict(Counter))

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
                    required = {"語彙素", "語彙素読み", "品詞", "発音形出現形", "frequency"}
                    missing = required - headers.keys()
                    if missing:
                        raise RuntimeError(f"CEJC columns changed; missing {sorted(missing)}")
                    row.clear()
                    continue
                source_keb = values.get(headers["語彙素"])
                lexical = values.get(headers["語彙素読み"])
                observed = values.get(headers["発音形出現形"])
                pos = values.get(headers["品詞"])
                frequency = values.get(headers["frequency"])
                if lexical:
                    lexical = hiragana(lexical)
                keb = source_keb if source_keb in candidates else kana_candidates.get(lexical)
                if (
                    keb is not None
                    and source_keb != keb
                    and cejc_pos_family(pos) not in candidate_families.get(keb, set())
                ):
                    keb = None
                if keb in candidates and lexical and observed and frequency:
                    observed = hiragana(observed)
                    occurrence_count = int(float(frequency))
                    category = teaching_category(pos)
                    category_counts[keb][category] += occurrence_count
                    family = cejc_pos_family(pos)
                    if family:
                        family_counts[keb][category][family] += occurrence_count
                    # Prefer the actual pronunciation when it is itself a JMdict
                    # reading: 日本/ニッポン has an observed ニホン row, and 寒い/
                    # サムイ has observed サブイ rows. Otherwise CEJC's lexical
                    # reading folds inflected or contracted forms (サムカッ,
                    # キュッ) back to the dictionary form they realize.
                    reb = dictionary_reading(observed, lexical, candidates[keb])
                    if reb:
                        counts[keb][reb] += occurrence_count
                row.clear()

    words = {
        keb: dict(sorted(readings.items(), key=lambda p: (-p[1], p[0])))
        for keb, readings in sorted(counts.items())
    }
    digest = hashlib.sha256(open(archive, "rb").read()).hexdigest()
    teaching = scheduled_teaching_rows(category_counts, family_counts, candidates)
    return {
        "source": {
            "name": "Corpus of Everyday Japanese Conversation (CEJC)",
            "version": VERSION,
            "url": URL,
            "rawSha256": digest,
            "measure": "short-unit occurrences mapped from observed pronunciation forms to JMdict readings",
        },
        "teachingPolicy": {
            "bootstrapEssentials": list(BOOTSTRAP_ESSENTIALS),
            "coreGap": CORE_GAP,
            "essentialBatchSize": ESSENTIAL_BATCH_SIZE,
            "classificationSource": "CEJC lexical lemma and part of speech",
        },
        "teaching": teaching,
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
    print(f"wrote {OUT} ({len(json.loads(result)['words'])} covered words)")


if __name__ == "__main__":
    main()
