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
from beginnerrank import SOURCES, compute_beginner_ranks, load_anki, load_tanos  # noqa: E402
from readingtype import clean_meanings, kinds_of, types_for  # noqa: E402

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
            # `clean_meanings` strips KANJIDIC2's radical-index entries -- 一's
            # "one radical (no.1)" is catalogue metadata, not a meaning, and it
            # was reaching the quiz as an accepted answer AND a distractor. It
            # spares 基's "radical (chem)"; see readingtype.RADICAL_INDEX.
            meanings=clean_meanings(
                [x.text for x in ch.iter("meaning") if x.get("m_lang") is None]),
            on=[r.text for r in ch.iter("reading") if r.get("r_type") == "ja_on"],
            kun=[r.text for r in ch.iter("reading") if r.get("r_type") == "ja_kun"],
            # on/kun per NORMALISED base, so a reading fact can say whether it
            # is a borrowed Chinese pronunciation or the native Japanese word.
            kinds=kinds_of(ch),
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


# The hand-curated commonness tags, and the only ones this ingest trusts to
# mean "everyday". See the `CURATED` note in main() for why `news1`/`nfXX` is
# not in here.
CURATED = {"ichi1", "spec1", "spec2"}

# JMdict ships its tags as XML entities and ET expands them, so `pos` and
# `misc` arrive as prose, not codes: `&uk;` reads as the string below and `&vs;`
# as "noun or participle which takes the aux. verb suru". Match on the prose;
# there is no code to match on by the time we see it.
UK = "word usually written using kana alone"


def load_jmdict(path):
    """Every entry, keyed on the form JMdict says the word is actually written in.

    A JMdict entry records commonness on the HEADWORD, and a word's headword is
    not always kanji. Two cases, and reading only `ke_pri` misses both:

     - No k_ele at all: もう, ある. The tag can only be on the r_ele.
     - `uk` -- "usually written using kana alone": これ carries eight kanji
       spellings (此れ, 是, 之 ...), not one of which is tagged, because the
       tag is on これ. Same for とても/迚も. These are not rare words; they are
       the first page of any textbook.

    So the priority tags are read from whichever element carries them, and the
    headword we keep is the kana one exactly when JMdict says the word is
    written in kana. That also settles the jouyou question for these words
    honestly: これ contains no kanji, so it makes no parts-first claim, rather
    than being judged on 此 -- a non-jouyou kanji nobody writes.
    """
    W = []
    for _, el in ET.iterparse(path, events=("end",)):
        if el.tag != "entry":
            continue
        kels = [(ke.findtext("keb"), {x.text for x in ke.findall("ke_pri")})
                for ke in el.findall("k_ele")]
        rels = [(re_.findtext("reb"), {x.text for x in re_.findall("re_pri")})
                for re_ in el.findall("r_ele")]
        senses = el.findall("sense")
        misc0 = {m.text for m in senses[0].findall("misc")} if senses else set()

        # `uk` is read off the FIRST sense only. A word whose primary meaning is
        # written in kanji and whose fourth, archaic sense is kana-only is a
        # kanji word.
        kana = (not kels) or (UK in misc0)
        if kana:
            pick = next(((r, p) for r, p in rels if p & CURATED), None) or \
                   (rels[0] if rels else None)
        else:
            # Prefer the k_ele that carries a CURATED tag over merely the first
            # k_ele carrying any tag: an entry often leads with an unmarked or
            # `iK` surface form and tags the common spelling second.
            pick = next(((k, p) for k, p in kels if p & CURATED), None) or \
                   next(((k, p) for k, p in kels if p), None)
        if pick is None or pick[0] is None:
            el.clear()
            continue
        form, pri = pick

        # The order input is FROZEN on the pre-fix view of this file -- the
        # first k_ele carrying any tag, kanji only. `order.json` is a shipped
        # artifact and does not get to drift because the ingest learned to read
        # `re_pri`. See the vc_order/vc note in main().
        legacy = next(((k, p) for k, p in kels if p), None)

        nf = [int(p[2:]) for p in pri if p.startswith("nf")]
        W.append(dict(
            keb=form,
            pri=pri,
            kana=kana,
            legacy_keb=legacy[0] if legacy else None,
            legacy_pri=legacy[1] if legacy else set(),
            nf=min(nf) if nf else None,
            # A kana word is its own reading. Taking r_ele[0] blindly would pair
            # とても with とても's first r_ele even when the tagged one is second.
            reb=form if kana else el.findtext("r_ele/reb"),
            glosses=[g.text for g in senses[0].iter("gloss")][:4] if senses else [],
            pos=sorted({p.text for s in senses for p in s.findall("pos")}),
        ))
        el.clear()
    return W


# ---------------------------------------------------------------- senses

def sense_order(keb, cands, tanos, anki_pair):
    """The candidate entries for one written form, the beginner's reading first.

    WHICH READING IS PRIMARY is decided by the two JLPT lists beginnerrank.py
    already ships, read on the EXACT (form, reading) pair. They are keyed that
    way on purpose, so they answer this question directly: 人/ひと is N5 on both
    lists while 人/じん is N1 on one and absent from the other, and 前/まえ is N5
    while 前/ぜん appears on neither. A reading no list attests sorts after every
    reading one does, then the newspaper band and JMdict's own entry order settle
    what is left, so the pick is stable across re-cuts.

    The reading-blind fallbacks in beginnerrank (tanos_level dropping back to the
    whole headword, anki_level dropping back to `kb`) are deliberately NOT used
    here. They hand every reading of a form the same level, which is a tie where
    the whole question is which reading wins.
    """
    def key(i, c):
        e = tanos.get(keb) or []
        ls = [lv for r, lv in e if r == c["reb"]]
        levels = [x for x in (max(ls) if ls else None,
                              anki_pair.get((keb, c["reb"]))) if x is not None]
        # N5 is level 5 and is the FIRST band a beginner meets, so the mean is
        # negated to sort the easiest reading first.
        return (0 if levels else 1,
                -(sum(levels) / len(levels)) if levels else 0.0,
                c["nf"] if c["nf"] is not None else 99,
                i)
    return [c for _, c in sorted(((key(i, c), c) for i, c in enumerate(cands)),
                                 key=lambda p: p[0])]


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

    # Everyday vocabulary: the UNION of JMdict's hand-curated commonness tags,
    # restricted to words written in jouyou kanji so that parts-first can
    # actually build every one of them.
    #
    # WHY A UNION, AND WHY NOT `news1`
    # --------------------------------
    # These tags are not independent axes to intersect. `news1` means nf01-24
    # and `news2` means nf25-48 -- the same 12,000 words from the same
    # newspaper corpus, strictly nested (verified: 0 entries violate it).
    # Intersecting them narrows nothing. What IS independent is the SOURCE:
    #
    #   ichi1   9,552 entries, a hand-curated everyday list. 25.2% of it
    #           carries no nf band at all -- which is exactly the everyday
    #           vocabulary a newspaper corpus is worst at seeing.
    #   spec1/2 a separate editorial judgement: "common no matter what the
    #           corpus says". 日本 lives here and ONLY here -- it is spec1 +
    #           news2/nf25, so `ichi1` misses it and even a `news1` filter
    #           would miss it. It was JMdict's editors overriding the corpus.
    #
    # `news1`/`nfXX` is deliberately NOT in this union. It is a newspaper
    # survey, and "common in a newspaper" is not "common for a beginner": its
    # top band holds 安保, 委員会 and 欧州 while 食べる sits in band 25. Adding
    # news1 would admit ~6,200 more words and is a product decision about what
    # this quiz is for, not a bug fix -- it is left to a human. The limitation
    # is in the corpus and cannot be filtered away; this union just declines to
    # pretend otherwise.
    TGT = []
    for w in W:
        if not w["pri"] & CURATED:
            continue
        ks = [c for c in w["keb"] if c in K]
        if not ks:
            # No kanjidic character in the headword. For a kana word that is
            # the point (これ, もう) -- it makes no parts-first claim and is
            # kept. For 'Ｔシャツ' or '３０００' it is a non-word for this quiz.
            if w["kana"]:
                TGT.append(w)
            continue
        if all(k in JOYO for k in ks):
            TGT.append(w)
    # MERGE on the written form. JMdict files one written form under several
    # entries, one per reading and sense group: 人 is three (ひと a person, じん
    # the -ian suffix, にん the counter), 前 is two (まえ in front, ぜん previous).
    #
    # This used to keep the FIRST entry and drop the rest, which is how 人 came
    # to be taught as a suffix and 前 as "previous". 117 of the shipped forms had
    # a second entry, and 85 of those lost a whole reading with it. So every
    # candidate survives, ordered beginner-first by `sense_order`, and the word
    # is the group: entry[0] supplies what the quiz asks, and the whole list is
    # what the lesson shows.
    tanos = load_tanos(os.path.join(SOURCES, "jlpt-tanos.json"))
    anki_pair, _ = load_anki(os.path.join(SOURCES, "jlpt-anki-n*.csv"))
    groups = {}
    for w in TGT:
        groups.setdefault(w["keb"], []).append(w)
    VOCAB = []
    for keb, cands in groups.items():
        cands = sense_order(keb, cands, tanos, anki_pair)
        w = dict(cands[0])
        w["senses"] = cands
        VOCAB.append(w)
    merged_n = sum(1 for w in VOCAB if len(w["senses"]) > 1)
    kana_n = sum(1 for w in VOCAB if w["kana"])
    print(f"everyday vocab (ichi1|spec1|spec2, all-jouyou): {len(VOCAB)} "
          f"of {len(TGT)} candidates  ({kana_n} kana-form, "
          f"{merged_n} carrying more than one reading)")

    # TWO utility counts, deliberately. They are not interchangeable:
    #
    #  vc_order  counts the FROZEN pre-fix target set -- ichi1 only, keyed on
    #            the first k_ele carrying any tag, pre-dedup -- because that is
    #            what the research scripts counted and it is the input that
    #            reproduces the settled `ramp B` order byte-for-byte. Deduping
    #            here re-breaks ties and walks the published order (口 and 手
    #            swap at item 13), and so does widening the vocab set: adding
    #            spec1/spec2 changes 1,700+ of these counts. The order is a
    #            shipped artifact; it does not get to drift because the ingest
    #            learned to read `re_pri`. Hence TGT_ORDER is rebuilt from
    #            `legacy_keb`/`legacy_pri` rather than reusing TGT -- the two
    #            sets are no longer the same set, and the SETTLED_40 assertion
    #            below is what proves this seam stayed put.
    #  vc        counts distinct written words in the SHIPPED vocab, and is the
    #            only one a screen may show, because "appears in 31 everyday
    #            words" must not count 生 twice for having two sense groups.
    TGT_ORDER = []
    for w in W:
        lk = w["legacy_keb"]
        if not lk or "ichi1" not in w["legacy_pri"]:
            continue
        ks = [c for c in lk if c in K]
        if not ks:
            continue
        if all(k in JOYO for k in ks):
            TGT_ORDER.append(lk)
    vc_order = defaultdict(int)
    for lk in TGT_ORDER:
        for k in {c for c in lk if c in JOYO}:
            vc_order[k] += 1
    vc = defaultdict(int)
    for w in VOCAB:
        for k in {c for c in w["keb"] if c in JOYO}:
            vc[k] += 1

    # ---- align: the (kanji, reading) evidence carried by everyday words
    #
    # A kana word is not in the denominator. これ has no kanji, so "did it
    # align?" is not a question about it -- counting it as a failure would
    # report a 17% alignment hole that is really just the kana vocabulary
    # doing exactly what it should. Only kanji words can align or fail to.
    pairs = defaultdict(list)   # (kanji, base) -> [(keb, surface)]
    aligned = 0
    alignable = 0
    word_align = {}
    for w in VOCAB:
        if not w["reb"] or w["kana"]:
            continue
        alignable += 1
        a = align(w["keb"], w["reb"], KRD_of(K))
        if not a:
            continue
        aligned += 1
        word_align[w["keb"]] = [[k, s, b] for k, s, b in a]
        for kanji, surface, base in a:
            if kanji in JOYO:
                pairs[(kanji, base)].append((w["keb"], surface))
    print(f"aligned {aligned}/{alignable} kanji words = {100*aligned/alignable:.1f}%  "
          f"({len(VOCAB)-alignable} kana words carry no kanji evidence by design)  "
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

    # `comps` here is the KRADFILE flat decomposition. It is NO LONGER the
    # "Made of" row the learner sees — that was factually wrong (KRADFILE encodes
    # the person radical 亻 as 化, so 休 read 化+木, and it flattens 時 to 寸+土+日,
    # losing the phonetic 寺). The learner-facing decomposition is now KanjiVG's
    # depth-1 hierarchy, in kanji-components.json (scripts/ingest/kanjivg.mjs),
    # married in by src/data/kanji.ts. This KRADFILE list survives only as the
    # input to kanjiCost's draw-and-assembly HEURISTIC (src/lib/kanji-lesson.ts),
    # where it is exposed as KanjiRow.costParts and calibrated against the owner's
    # hand-worked numbers — a stroke-level cost estimate, not a fact shown as one.
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
    # `beginnerRank`: order the words most-useful-first for a beginner, from the
    # JLPT-consensus + OpenSubtitles blend in beginnerrank.py (sources committed
    # under scripts/ingest/sources/). Appended here so a full re-cut regenerates
    # the field rather than leaving it to a separate post-hoc pass.
    br = compute_beginner_ranks(vocab_rows)
    print(f"beginnerRank: gated(JLPT) {br['gated']}/{br['total']} "
          f"({100*br['gated']/br['total']:.1f}%), OpenSubtitles stem-join "
          f"{br['sub_stem']}/{br['total']} ({100*br['sub_stem']/br['total']:.1f}%)")
    dump("vocab.json", vocab_rows)

    # Every reading a written form has, and what each one means. Keyed on the
    # form, primary first, and emitted ONLY for the forms that have more than one
    # reading, because for the other 12,400 the vocab row already is the whole
    # story and a second copy of it would just be a second copy.
    #
    # A file of its own rather than a `senses` field on the vocab row: vocab.json
    # is joined by beginnerRank on the way into the curriculum, and the merge has
    # to be able to reach the app without that join being re-cut. src/data/vocab.ts
    # marries the two at load and takes the primary from HERE, so the reading the
    # quiz asks and the readings the lesson shows come from one list.
    krd = KRD_of(K)
    sense_rows = {}
    for w in VOCAB:
        if len(w["senses"]) < 2:
            continue
        out = []
        for c in w["senses"]:
            a = None if c["kana"] else align(c["keb"], c["reb"], krd)
            out.append(dict(reb=c["reb"], glosses=c["glosses"], pos=c["pos"],
                            align=[[k, s, b] for k, s, b in a] if a else None))
        sense_rows[w["keb"]] = out
    dump("word-senses.json", sense_rows, sort_keys=True)

    # anchor pick: prefer the everyday word that attests the reading with the
    # LOWEST beginnerRank -- the first one a learner will actually meet, so 出's
    # しゅつ anchors to 出発 (rank 696) and not 供出 (8388), and 名's みょう to 本名
    # over 功名. An obscure anchor makes a common reading feel rare. The old keys
    # -- UNVOICED reading (surface==base), then shortest, then alphabetically
    # stable -- break the (rare) rank tie. src/data/kanji.ts re-anchors at load
    # with the same key, so this and a full re-cut agree.
    rank_of = {w["keb"]: w["beginnerRank"] for w in vocab_rows}
    HUGE = 1 << 62
    reading_rows = []
    for (kanji, base), ws in sorted(pairs.items()):
        best = sorted(
            ws,
            key=lambda kw: (rank_of.get(kw[0], HUGE), kw[1] != base, len(kw[0]), kw[0]),
        )[0]
        row = dict(k=kanji, base=base, anchor=best[0], surface=best[1],
                   nWords=len(ws), words=[w for w, _ in ws])
        t = types_for(K[kanji]["kinds"], base)
        if t:
            row["type"] = t
        reading_rows.append(row)
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

    # The primitive stroke map is NO LONGER emitted here. It must cover exactly
    # the non-jōyō components the "Made of" decomposition uses, and that
    # decomposition is now KanjiVG's depth-1 hierarchy, not KRADFILE (see the
    # `comps` note below). scripts/ingest/kanjivg.mjs writes primitiveStrokes into
    # kanji-components.json from that same source, so the two cannot disagree; a
    # KRADFILE-derived map here would list primitives the index never shows and
    # miss ones it does. The PRIM_STROKES table above is still used by
    # novel_strokes(), which is KRADFILE-based on purpose (see order.json).


def KRD_of(K):
    return {k: dict(on=v["on"], kun=v["kun"], nanori=[]) for k, v in K.items()}


def dump(name, obj, sort_keys=False):
    p = os.path.join(OUT, name)
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"), sort_keys=sort_keys)
    print(f"  wrote {name:<26} {os.path.getsize(p)/1024:>8.0f} KB")


if __name__ == "__main__":
    main()
