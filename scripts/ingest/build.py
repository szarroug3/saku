# -*- coding: utf-8 -*-
"""
Ingest KANJIDIC2 + JMdict + KRADFILE into the app's entry/fact model.

    python3 scripts/ingest/build.py --src /path/to/dicts

Reads (from --src):
    kanjidic2.xml    KANJIDIC2, CC BY-SA 4.0 (EDRDG)
    JMdict_e         JMdict English, CC BY-SA 4.0 (EDRDG)
    kradfile.utf8    KRADFILE, CC BY-SA 4.0 (EDRDG) -- the UTF-8 conversion.
                     The distributed `kradfile` is EUC-JP; `kradfile2.gz` on
                     the mirror is a 404 HTML page, not data.

Writes src/data/generated/*.json, which IS COMMITTED. See src/data/kanji.ts for
why the generated JSON is the artifact and this script is not run at build time.

WHAT THIS DOES NOT DO
=====================
It never invents a fact. A word whose reading cannot be aligned to its kanji
(jukujikun: 大人/おとな, 為替/かわせ) yields word facts only and contributes no
kanji-reading evidence -- 2.7% of everyday words. A fact you cannot grade is
worse than a fact you do not have.
"""

import argparse, json, os, pickle, sys
import xml.etree.ElementTree as ET
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aligner import align, is_kanji  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "data", "generated")

# The six KRADFILE components that are not kanji and so have no KANJIDIC2
# stroke count. Hand-counted. Without these, `杰`-style primitives read as
# 1 stroke and the "novel strokes" number silently lies.
PRIM_STROKES = {"ノ": 1, "｜": 1, "ハ": 2, "マ": 2, "ユ": 2, "ヨ": 3}


# ---------------------------------------------------------------- load

def load_kanjidic(path):
    root = ET.parse(path).getroot()
    K = {}
    for ch in root.findall("character"):
        lit = ch.findtext("literal")
        m = ch.find("misc")
        g, s, f = m.findtext("grade"), m.findtext("stroke_count"), m.findtext("freq")
        K[lit] = dict(
            grade=int(g) if g else None,
            strokes=int(s) if s else None,
            freq=int(f) if f else None,
            meanings=[x.text for x in ch.iter("meaning") if x.get("m_lang") is None],
            on=[r.text for r in ch.iter("reading") if r.get("r_type") == "ja_on"],
            kun=[r.text for r in ch.iter("reading") if r.get("r_type") == "ja_kun"],
        )
    return K


def load_kradfile(path):
    KR = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("#") or ":" not in line:
                continue
            k, r = line.split(":", 1)
            KR[k.strip()] = r.split()
    return KR


def load_jmdict(path):
    W = []
    for _, el in ET.iterparse(path, events=("end",)):
        if el.tag != "entry":
            continue
        # Take the first k_ele that CARRIES a priority tag -- not simply the
        # first k_ele. An entry often leads with an unmarked surface form and
        # tags the common spelling second; taking [0] blindly drops the entry
        # and loses 7 everyday words, which is enough to re-break ties in the
        # ordering and walk the settled first 40.
        for ke in el.findall("k_ele"):
            pri = [x.text for x in ke.findall("ke_pri")]
            if not pri:
                continue
            nf = [int(p[2:]) for p in pri if p.startswith("nf")]
            senses = el.findall("sense")
            W.append(dict(
                keb=ke.findtext("keb"),
                pri=set(pri),
                nf=min(nf) if nf else None,
                reb=el.findtext("r_ele/reb"),
                glosses=[g.text for g in senses[0].iter("gloss")][:4] if senses else [],
                pos=sorted({p.text for s in senses for p in s.findall("pos")}),
            ))
            break
        el.clear()
    return W


# ---------------------------------------------------------------- ordering
# Reproduces the settled `ramp B` from the research scripts (ceiling2.py /
# final2.py). Verified to reproduce FINAL_ORDER.pkl byte-for-byte.

RAMP_B = lambda n: 6 if n < 30 else 8 if n < 80 else 10 if n < 150 else 12 if n < 300 else 99


def build_order(K, KR, JOYO, joyo_list, vc):
    """`ramp B`: everyday-word utility, parts-first over jouyou, ceiling on
    TOTAL strokes. Returns (order, why) where why[k] is 'lesson' (chosen on its
    own merit) or 'prereq_for:X' (dragged in by X's closure)."""
    comps = lambda k: [c for c in KR.get(k, []) if c != k]
    DEP = {k: [c for c in comps(k) if c in JOYO and c != k] for k in joyo_list}

    def closure(k, known):
        out, seen = [], set()
        def rec(x, st):
            if x in known or x in seen or x in st:
                return
            st.add(x)
            for c in DEP[x]:
                rec(c, st)
            st.discard(x)
            if x not in seen:
                seen.add(x); out.append(x)
        rec(k, set())
        return out

    known, out, why = set(), [], {}
    pend = sorted(joyo_list, key=lambda k: (-vc.get(k, 0), K[k]["strokes"]))
    while pend:
        cap = RAMP_B(len(out))
        chosen = None
        for k in pend:
            cl = closure(k, known)
            if all(K[x]["strokes"] <= cap for x in cl):
                chosen = (k, cl); break
        if chosen is None:
            k = min(pend, key=lambda k: max([K[x]["strokes"] for x in closure(k, known)] or [0]))
            chosen = (k, closure(k, known))
        k, cl = chosen
        for x in cl:
            if x not in known:
                known.add(x); out.append(x)
                why[x] = "lesson" if x == k else "prereq_for:" + k
        pend = [p for p in pend if p not in known]
    return out, why


def novel_strokes(k, KR, K, seen):
    """Strokes this item introduces, charging EVERY component -- jouyou or not.
    The old buildability number only charged components that were themselves
    jouyou kanji, so 無's 8-stroke non-jouyou primitive 杰 read as free."""
    tot = 0
    for c in KR.get(k, []):
        if c == k or c in seen:
            continue
        tot += K[c]["strokes"] if (c in K and K[c]["strokes"]) else PRIM_STROKES.get(c, 1)
    return tot


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="directory holding the raw dictionaries")
    ap.add_argument("--cache", default=None, help="optional pickle cache dir for reruns")
    args = ap.parse_args()

    cache = os.path.join(args.cache, "ingest_raw.pkl") if args.cache else None
    if cache and os.path.exists(cache):
        K, KR, W = pickle.load(open(cache, "rb"))
    else:
        K = load_kanjidic(os.path.join(args.src, "kanjidic2.xml"))
        KR = load_kradfile(os.path.join(args.src, "kradfile.utf8"))
        W = load_jmdict(os.path.join(args.src, "JMdict_e"))
        if cache:
            pickle.dump((K, KR, W), open(cache, "wb"))
    print(f"loaded  kanjidic={len(K)}  kradfile={len(KR)}  jmdict(kanji+pri)={len(W)}")

    # Grade 7 does not exist: jouyou is grades 1-6 + 8 = 2,136.
    JOYO = {k for k, v in K.items() if v["grade"] and v["grade"] <= 8}
    assert len(JOYO) == 2136, f"jouyou should be 2136, got {len(JOYO)}"
    joyo_list = sorted(JOYO)

    # Everyday vocabulary: ichi1 (the hand-curated ~10k list -- NOT `freq`,
    # which is a newspaper survey) restricted to words written in jouyou kanji,
    # so that parts-first can actually build every one of them.
    TGT = []
    for w in W:
        ks = [c for c in w["keb"] if c in K]
        if not ks or "ichi1" not in w["pri"]:
            continue
        if all(k in JOYO for k in ks):
            TGT.append(w)
    # Deduplicate on the written form; JMdict lists some words (生, 通す) under
    # several entries, one per sense group.
    seen_keb = set(); VOCAB = []
    for w in TGT:
        if w["keb"] in seen_keb:
            continue
        seen_keb.add(w["keb"]); VOCAB.append(w)
    print(f"everyday vocab (ichi1, all-jouyou): {len(VOCAB)} of {len(TGT)} pre-dedup")

    # TWO utility counts, deliberately. They differ by ~1% and are not
    # interchangeable:
    #
    #  vc_order  counts the PRE-dedup target set, because that is what the
    #            research scripts counted and it is the input that reproduces
    #            the settled `ramp B` order byte-for-byte. Deduping here
    #            re-breaks ties and walks the published order (口 and 手 swap
    #            at item 13). The order is a shipped artifact; it does not get
    #            to drift because the ingest tidied its input.
    #  vc        counts distinct written words, and is the only one a screen may
    #            show, because "appears in 31 everyday words" must not count 生
    #            twice for having two sense groups.
    vc_order = defaultdict(int)
    for w in TGT:
        for k in {c for c in w["keb"] if c in JOYO}:
            vc_order[k] += 1
    vc = defaultdict(int)
    for w in VOCAB:
        for k in {c for c in w["keb"] if c in JOYO}:
            vc[k] += 1

    # ---- align: the (kanji, reading) evidence carried by everyday words
    pairs = defaultdict(list)   # (kanji, base) -> [(keb, surface)]
    aligned = 0
    word_align = {}
    for w in VOCAB:
        if not w["reb"]:
            continue
        a = align(w["keb"], w["reb"], KRD_of(K))
        if not a:
            continue
        aligned += 1
        word_align[w["keb"]] = [[k, s, b] for k, s, b in a]
        for kanji, surface, base in a:
            if kanji in JOYO:
                pairs[(kanji, base)].append((w["keb"], surface))
    print(f"aligned {aligned}/{len(VOCAB)} = {100*aligned/len(VOCAB):.1f}%  "
          f"-> {len(pairs)} distinct (kanji, reading) facts")

    # ---- order
    order, why = build_order(K, KR, JOYO, joyo_list, vc_order)
    assert len(order) == 2136
    SETTLED_40 = "人大日一不乙乞気山出上生手口合中行刀分十干年入下立土地用弓引目見牛物子尚学白的王"
    assert "".join(order[:40]) == SETTLED_40, (
        "ramp B first 40 drifted from the settled order:\n"
        f"  got  {''.join(order[:40])}\n  want {SETTLED_40}")
    print(f"order: {len(order)} items, {sum(1 for k in order if why[k] != 'lesson')} pulled by closure")

    # ---- emit
    os.makedirs(OUT, exist_ok=True)

    kanji_rows = []
    for k in joyo_list:
        v = K[k]
        kanji_rows.append(dict(c=k, meanings=v["meanings"][:5], grade=v["grade"],
                               strokes=v["strokes"], newspaperFreq=v["freq"],
                               comps=[c for c in KR.get(k, []) if c != k]))
    dump("kanji.json", kanji_rows)

    vocab_rows = [dict(keb=w["keb"], reb=w["reb"], glosses=w["glosses"], pos=w["pos"],
                       newspaperBand=w["nf"], align=word_align.get(w["keb"]))
                  for w in VOCAB]
    dump("vocab.json", vocab_rows)

    # anchor pick: prefer a word where the reading is UNVOICED (surface==base),
    # then the shortest, then the alphabetically stable one -- so the fact reads
    # `kanji:生/reading@学生`, not `@小学生`.
    reading_rows = []
    for (kanji, base), ws in sorted(pairs.items()):
        best = sorted(ws, key=lambda kw: (kw[1] != base, len(kw[0]), kw[0]))[0]
        reading_rows.append(dict(k=kanji, base=base, anchor=best[0], surface=best[1],
                                 nWords=len(ws), words=[w for w, _ in ws]))
    dump("readings.json", reading_rows)

    seen = set(); order_rows = []
    for i, k in enumerate(order):
        nl = novel_strokes(k, KR, K, seen)
        for c in KR.get(k, []):
            seen.add(c)
        seen.add(k)
        w = why[k]
        order_rows.append(dict(
            c=k, i=i,
            enteredVia="merit" if w == "lesson" else "prereq",
            pulledFor=None if w == "lesson" else w.split(":")[1],
            everydayWords=vc.get(k, 0),
            novelStrokes=nl,
        ))
    dump("order.json", order_rows)

    # KRADFILE-derived confusables: identical component multiset AND identical
    # stroke count. High precision, low recall -- it does NOT catch 人/入 or
    # 土/士 (each is its own radical, so they share no components) and it
    # actively SEPARATES 未/末 (未 contains 二, 末 contains 一). Those live in
    # the hand-authored table in src/data/confusable.ts.
    groups = defaultdict(list)
    for k in joyo_list:
        if k not in KR:
            continue
        key = (tuple(sorted(c for c in KR[k] if c != k)), K[k]["strokes"])
        if key[0]:
            groups[key].append(k)
    derived = sorted([sorted(v) for v in groups.values() if len(v) > 1])
    dump("confusable-derived.json", derived)
    print(f"KRADFILE-derived confusable groups: {len(derived)}")

    prim = {c: (K[c]["strokes"] if c in K and K[c]["strokes"] else PRIM_STROKES.get(c, 1))
            for k in joyo_list for c in KR.get(k, []) if c != k and c not in JOYO}
    dump("components.json", dict(primitiveStrokes=prim))
    print(f"non-jouyou components: {len(prim)}")


def KRD_of(K):
    return {k: dict(on=v["on"], kun=v["kun"], nanori=[]) for k, v in K.items()}


def dump(name, obj):
    p = os.path.join(OUT, name)
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"  wrote {name:<26} {os.path.getsize(p)/1024:>8.0f} KB")


if __name__ == "__main__":
    main()
