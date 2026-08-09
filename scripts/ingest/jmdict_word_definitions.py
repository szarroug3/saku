# -*- coding: utf-8 -*-
"""Preserve JMdict's real sense -> reading relationships for shipped words.

The main vocabulary artifact predates this relationship and flattens one row per
reading. This sidecar restores source sense identity without re-cutting word
ranks. Multiple English gloss nodes inside one JMdict <sense> stay together;
separate senses never merge because their English happens to look similar.

    python3 scripts/ingest/jmdict_word_definitions.py --download
    python3 scripts/ingest/jmdict_word_definitions.py --check
"""

import argparse
import gzip
import hashlib
import json
import os
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET


HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
RAW_DIR = os.path.join(HERE, "raw", "jmdict")
RAW_GZ = os.path.join(RAW_DIR, "JMdict_e.gz")
VOCAB = os.path.join(ROOT, "src", "data", "generated", "vocab.json")
SENSES = os.path.join(ROOT, "src", "data", "generated", "word-senses.json")
ALTERNATES = os.path.join(ROOT, "src", "data", "number-word-alternates.json")
OUT = os.path.join(ROOT, "src", "data", "generated", "word-definitions.json")
URL = "https://www.edrdg.org/pub/Nihongo/JMdict_e.gz"
UK = "word usually written using kana alone"
CURATED = {"ichi1", "spec1", "spec2"}


def hiragana(text):
    """Collapse kana spelling variants that do not change pronunciation."""
    text = unicodedata.normalize("NFKC", text)
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in text)


def download():
    os.makedirs(RAW_DIR, exist_ok=True)
    print(f"downloading JMdict -> {RAW_GZ}")
    urllib.request.urlretrieve(URL, RAW_GZ)


def targets():
    vocab = json.load(open(VOCAB, encoding="utf-8"))
    senses = json.load(open(SENSES, encoding="utf-8"))
    alternates = json.load(open(ALTERNATES, encoding="utf-8"))
    readings = {}
    for row in vocab:
        # Start from the app's established readings so a current JMdict entry can
        # be matched back to a frozen vocabulary row without re-cutting ranks.
        # The source pass below then restores every sense and every compatible
        # reading from that entry, including r_ele alternates the legacy build
        # discarded by taking only the first reading and first sense.
        rs = [sense["reb"] for sense in senses.get(row["keb"], [])] or [row["reb"]]
        rs.extend(alternates.get(row["keb"], []))
        readings[row["keb"]] = list(dict.fromkeys(rs))
    return readings


def reduce(path):
    wanted = targets()
    collected = {keb: [] for keb in wanted}
    with gzip.open(path, "rb") as source:
        for _, entry in ET.iterparse(source, events=("end",)):
            if entry.tag != "entry":
                continue
            seq = entry.findtext("ent_seq")
            kels = [
                {
                    "keb": ke.findtext("keb"),
                    "pri": {x.text for x in ke.findall("ke_pri")},
                }
                for ke in entry.findall("k_ele")
            ]
            rels = [
                {
                    "reb": hiragana(re.findtext("reb")),
                    "pri": {x.text for x in re.findall("re_pri")},
                    "restr": {x.text for x in re.findall("re_restr")},
                }
                for re in entry.findall("r_ele")
            ]
            senses = entry.findall("sense")
            misc0 = {m.text for m in senses[0].findall("misc")} if senses else set()
            kana_headword = not kels or UK in misc0
            # Stay inside the same common-entry cut that produced vocab.json.
            # Matching an established app reading also keeps frozen rows whose
            # priority tags drifted since that snapshot. This excludes unrelated
            # rare homographs such as 四/スー while retaining 四/し・よん・よ.
            forms = [
                ke["keb"] for ke in kels
                if ke["keb"] in wanted
                and (ke["pri"] & CURATED or any(r["reb"] in wanted[ke["keb"]] for r in rels))
            ]
            if kana_headword:
                forms.extend(r["reb"] for r in rels if r["reb"] in wanted)

            for form in dict.fromkeys(forms):
                compatible = {
                    r["reb"] for r in rels
                    if (kana_headword and r["reb"] == form or not kana_headword
                        and (not r["restr"] or form in r["restr"]))
                }
                inherited_pos = []
                for i, sense in enumerate(senses):
                    explicit_pos = [p.text for p in sense.findall("pos") if p.text]
                    if explicit_pos:
                        inherited_pos = explicit_pos
                    stagk = {x.text for x in sense.findall("stagk")}
                    if stagk and form not in stagk:
                        continue
                    stagr = {hiragana(x.text) for x in sense.findall("stagr")}
                    applicable = compatible & stagr if stagr else compatible
                    if not applicable:
                        continue
                    glosses = [g.text for g in sense.findall("gloss") if g.text]
                    if not glosses:
                        continue
                    ordered = list(dict.fromkeys(
                        r["reb"] for r in rels if r["reb"] in applicable
                    ))
                    collected[form].append({
                        "id": f"{seq}:{i}",
                        "glosses": glosses,
                        "pos": inherited_pos,
                        "readings": ordered,
                    })
            entry.clear()

    # Remove exact duplicate source rows, then lead with definitions containing
    # the app's established primary reading so adding source detail does not
    # reorder definitions across meanings.
    words = {}
    for keb, definitions in collected.items():
        unique, seen = [], set()
        for definition in definitions:
            key = (
                tuple(definition["glosses"]),
                tuple(definition["pos"]),
                tuple(definition["readings"]),
            )
            if key in seen:
                continue
            seen.add(key)
            unique.append(definition)
        primary = wanted[keb][0]
        unique.sort(key=lambda d: (primary not in d["readings"],))
        # A plain one-definition/one-reading word is already represented by its
        # vocab row. Ship the source sidecar only where it adds a definition or
        # a pronunciation; this keeps the processed artifact compact without
        # throwing away either relationship again.
        if len(unique) > 1 or any(len(d["readings"]) > 1 for d in unique):
            words[keb] = unique

    digest = hashlib.sha256(open(path, "rb").read()).hexdigest()
    return {
        "source": {"name": "JMdict", "url": URL, "rawSha256": digest},
        "words": dict(sorted(words.items())),
    }


def encoded(data):
    return (json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.download or not os.path.exists(RAW_GZ):
        if not args.download:
            raise SystemExit(f"missing ignored JMdict archive: {RAW_GZ}; rerun with --download")
        download()
    result = encoded(reduce(RAW_GZ))
    if args.check:
        current = open(OUT, "rb").read() if os.path.exists(OUT) else b""
        if current != result:
            raise SystemExit(f"{OUT} is stale; regenerate without --check")
        print(f"JMdict definition lookup is current ({len(json.loads(result)['words'])} words)")
        return
    with open(OUT, "wb") as fh:
        fh.write(result)
    print(f"wrote {OUT} ({len(json.loads(result)['words'])} words)")


if __name__ == "__main__":
    main()
