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

# The five JMdict register/formality <misc> tags this app annotates (SAK-32),
# most to least formal. Their JMdict text is confirmed against the raw XML;
# every other <misc> value (archaic, slang, abbreviation, ...) is out of scope
# and stays discarded, same as before this change.
REGISTER_TAGS = {
    "honorific or respectful (sonkeigo) language": "honorific",
    "humble (kenjougo) language": "humble",
    "polite (teineigo) language": "polite",
    "familiar language": "familiar",
    "colloquial": "colloquial",
}
REGISTER_ORDER = ["honorific", "humble", "polite", "familiar", "colloquial"]
SMALL_KANA = set("ゃゅょぁぃぅぇぉゎ")
VOWELS = {
    **{c: "a" for c in "あかがさざただなはばぱまゃらわ"},
    **{c: "i" for c in "いきぎしじちぢにひびぴみり"},
    **{c: "u" for c in "うくぐすずつづぬふぶぷむゅる"},
    **{c: "e" for c in "えけげせぜてでねへべぺめれ"},
    **{c: "o" for c in "おこごそぞとどのほぼぽもょろを"},
}


def hiragana(text):
    """Collapse kana spelling variants that do not change pronunciation."""
    text = unicodedata.normalize("NFKC", text)
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in text)


def pronunciation_key(reading):
    """Collapse spelling-only long-vowel variants such as さいこう/さいこー."""
    morae = []
    for char in reading:
        if char in SMALL_KANA and morae:
            morae[-1] += char
        else:
            morae.append(char)
    out = []
    previous_vowel = None
    for mora in morae:
        vowel = VOWELS.get(mora[-1])
        is_long = (
            mora == "ー"
            or mora == "う" and previous_vowel in {"o", "u"}
            or mora == "い" and previous_vowel == "e"
            or mora == "お" and previous_vowel == "o"
            or mora == "え" and previous_vowel == "e"
        )
        if is_long:
            out.append("ー")
        else:
            out.append(mora)
        if vowel:
            previous_vowel = vowel
        elif mora != "ー":
            previous_vowel = None
    return "".join(out)


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
                    misc = {m.text for m in sense.findall("misc")}
                    present = {key for text, key in REGISTER_TAGS.items() if text in misc}
                    register = [key for key in REGISTER_ORDER if key in present]
                    ordered_by_sound = {}
                    for reading in (r["reb"] for r in rels if r["reb"] in applicable):
                        key = pronunciation_key(reading)
                        existing = ordered_by_sound.get(key)
                        # Keep the frozen app spelling when available; otherwise
                        # preserve JMdict order. さいこう and さいこー are one
                        # pronunciation, not two rows competing for frequency.
                        if existing is None or (
                            reading in wanted[form] and existing not in wanted[form]
                        ):
                            ordered_by_sound[key] = reading
                    ordered = list(ordered_by_sound.values())
                    definition = {
                        "id": f"{seq}:{i}",
                        "glosses": glosses,
                        "pos": inherited_pos,
                        "readings": ordered,
                    }
                    if register:
                        definition["register"] = register
                    collected[form].append(definition)
            entry.clear()

    # Remove exact duplicate source rows. Keep the frozen app's established
    # MEANING first (person before suffix for 人); this ordering never ranks two
    # readings of the same sense. Neither JMdict XML order nor its priority tags
    # select a pronunciation: CEJC alone ranks readings within each definition.
    words = {}
    for keb, definitions in collected.items():
        unique, seen = [], set()
        for definition in definitions:
            key = (
                tuple(definition["glosses"]),
                tuple(definition["pos"]),
                tuple(definition["readings"]),
                tuple(definition.get("register", ())),
            )
            if key in seen:
                continue
            seen.add(key)
            unique.append(definition)
        first_known_sense = wanted[keb][0]
        unique.sort(key=lambda d: (first_known_sense not in d["readings"],))
        # A plain one-definition/one-reading word is already represented by its
        # vocab row. Ship the source sidecar only where it adds a definition, a
        # pronunciation, or a register tag; register (SAK-32) is not carried by
        # the vocab row at all, so a single-sense word must still ship here when
        # that one sense is tagged, or its annotation would be silently dropped.
        if (
            len(unique) > 1
            or any(len(d["readings"]) > 1 for d in unique)
            or any(d.get("register") for d in unique)
        ):
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
