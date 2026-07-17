# -*- coding: utf-8 -*-
"""
Propose transitive/intransitive verb PAIRS from JMdict, for hand-curation.

    python3 scripts/ingest/transitivity.py --src /path/to/dicts

Writes a candidate list to stdout. It does NOT write src/data. The shipped
table (src/data/transitivity.ts) is hand-curated FROM this output, because the
thing being curated is not derivable -- see the header of that file.

WHY A SCRIPT AT ALL, IF THE OUTPUT IS HAND-CURATED
==================================================
To make the candidate set honest. Hand-typing pairs from memory produces the
pairs you remember, which is a biased sample of the pairs that exist. This
proposes every pair JMdict can support, so the curation step is CUTTING from a
complete list rather than recalling from an empty one. The heuristic's job is
recall; the human's job is precision.

WHAT JMDICT DOES NOT HAVE
=========================
A partner field. `vt`/`vi` say a verb IS transitive or intransitive; nothing in
the file says 開く pairs with 開ける. That is the whole reason this table exists
and the reason the pairing below is a GUESS (shared kanji stem) that must be
checked against glosses by a human.

Note on tags: JMdict ships pos as XML entities and ElementTree expands them, so
by the time we see a sense it reads "transitive verb", not `vt`. The DTD at the
top of the file is the inverse map, so we recover the codes rather than matching
prose. scripts/ingest/build.py does not do this and ships the prose.
"""

import argparse, os, re, sys
import xml.etree.ElementTree as ET
from collections import defaultdict

# The hand-curated commonness tags. Same union as the vocab ingest: `news1` is
# a newspaper survey and is deliberately not here.
CURATED = {"ichi1", "spec1", "spec2"}

# The modern conjugation classes, named as in src/lib/conjugate/types.ts. A
# candidate whose class is not one of these cannot be drilled, so it cannot be
# a pair member however good the gloss looks.
MODERN = {
    "v5u", "v5k", "v5g", "v5s", "v5t", "v5n", "v5b", "v5m", "v5r",
    "v5aru", "v5r-i", "v5k-s", "v5u-s", "v1", "v1-s", "vk",
}

KANJI = lambda c: "一" <= c <= "鿿"


def entity_map(path):
    """prose -> code, read from the DTD JMdict ships in its own header."""
    with open(path, encoding="utf-8") as fh:
        head = fh.read(200_000)
    return {v: k for k, v in re.findall(r'<!ENTITY\s+(\S+)\s+"([^"]*)">', head)}


def load(path):
    E2C = entity_map(path)
    code = lambda s: E2C.get(s, s)
    out = []
    for _, el in ET.iterparse(path, events=("end",)):
        if el.tag != "entry":
            continue
        pri = set()
        keb = None
        for ke in el.findall("k_ele"):
            p = {x.text for x in ke.findall("ke_pri")}
            if p and keb is None:
                keb, pri = ke.findtext("keb"), p
        for re_ in el.findall("r_ele"):
            pri |= {x.text for x in re_.findall("re_pri")}
        reb = el.findtext("r_ele/reb")
        senses = []
        for s in el.findall("sense"):
            senses.append(dict(
                pos={code(p.text) for p in s.findall("pos")},
                # Which SPELLINGS this sense applies to. Empty = all of them.
                stagk={x.text for x in s.findall("stagk")},
                glosses=[g.text for g in s.iter("gloss")],
            ))
        if keb and senses:
            out.append(dict(keb=keb, reb=reb, pri=pri, senses=senses))
        el.clear()
    return out


def senses_for(e):
    """The senses that belong to THIS SPELLING.

    A JMdict entry is keyed on a reading, not a word, so one entry can carry
    several verbs that merely sound alike. 開ける/空ける/明ける share あける and
    share an entry, and they are three different verbs: 開ける is "to open"
    (vt), 明ける is "to dawn" (vi). Union the senses and 開ける comes out
    vt+vi -- which reads as ambitransitivity and is nothing of the kind, it is
    two verbs in a trenchcoat.

    `stagk` is JMdict telling us which spelling a sense belongs to. When it says
    so for a spelling, believe it and use only those senses. It only bothers
    when the entry is a merge, so "said nothing" means "one verb, all senses".
    """
    restricted = [s for s in e["senses"] if e["keb"] in s["stagk"]]
    if restricted:
        return restricted
    return [s for s in e["senses"] if not s["stagk"]] or e["senses"]


def classify(e):
    """(class, transitivity) for an entry, or (None, None)."""
    ss = senses_for(e)
    pos = set()
    for s in ss:
        pos |= s["pos"]
    cls = [p for p in pos if p in MODERN]
    if len(cls) != 1:
        return None, None
    vt, vi = "vt" in pos, "vi" in pos
    if vt and vi:
        # TWO different things wear this tag, and only one is ambitransitivity.
        #
        #  ambi   ONE sense is tagged vi AND vt: 開く(ひらく) s1 "to open" is
        #         both ドアが開く and ドアを開く. Genuinely both. Real.
        #  split  Some senses vt, others vi, none both. Usually a rare or
        #         figurative sense pulling the tag -- not a verb a learner will
        #         ever meet as ambitransitive.
        t = "ambi" if any({"vi", "vt"} <= s["pos"] for s in ss) else "split"
    elif vt:
        t = "vt"
    elif vi:
        t = "vi"
    else:
        return None, None
    return cls[0], t


def stem(keb):
    """The leading kanji run. 開ける -> 開, 話し合う -> None (not a simple pair)."""
    i = 0
    while i < len(keb) and KANJI(keb[i]):
        i += 1
    if i == 0 or i == len(keb):
        return None  # all-kana, or no okurigana to differ in
    if any(KANJI(c) for c in keb[i:]):
        return None  # kanji after the okurigana: compound, not a stem+ending pair
    return keb[:i]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    args = ap.parse_args()

    W = load(os.path.join(args.src, "JMdict_e"))
    print(f"jmdict entries with a kanji headword + sense: {len(W)}", file=sys.stderr)

    verbs = []
    for e in W:
        if not (e["pri"] & CURATED):
            continue
        cls, t = classify(e)
        if not cls:
            continue
        st = stem(e["keb"])
        if not st:
            continue
        verbs.append(dict(**e, cls=cls, t=t, stem=st))
    print(f"curated, single-class, stem-shaped verbs with a transitivity tag: {len(verbs)}",
          file=sys.stderr)

    by_stem = defaultdict(list)
    for v in verbs:
        by_stem[v["stem"]].append(v)

    # THE HEURISTIC: same kanji stem, one side intransitive, one side
    # transitive. An `ambi`/`split` verb may stand on EITHER side, and both
    # sides may be `ambi` at once -- 開く(あく)/開ける(あける) is exactly that,
    # so a rule that skips both-sides-ambi drops the pair the table is named
    # after.
    VI_SIDE = {"vi", "ambi", "split"}
    VT_SIDE = {"vt", "ambi", "split"}
    cands = []
    for st, vs in sorted(by_stem.items()):
        if len(vs) < 2:
            continue
        for i in range(len(vs)):
            for j in range(len(vs)):
                if i == j:
                    continue
                a, b = vs[i], vs[j]
                if (a["keb"], a["reb"]) == (b["keb"], b["reb"]):
                    continue
                if a["t"] in VI_SIDE and b["t"] in VT_SIDE:
                    cands.append((a, b))
    # De-dup on (written form, READING) on both sides, never on the written form
    # alone. 開く is TWO entries -- 開く(あく) and 開く(ひらく) -- and they have
    # different partners: あく/あける and ひらく/ひらける. Keying on the written
    # form collapses them to one row and silently drops あく/あける, which is the
    # single pair this table most exists for.
    seen, uniq = set(), []
    for a, b in cands:
        k = tuple(sorted([(a["keb"], a["reb"]), (b["keb"], b["reb"])]))
        if k in seen:
            continue
        seen.add(k)
        uniq.append((a, b))

    print(f"CANDIDATE PAIRS PROPOSED: {len(uniq)}", file=sys.stderr)

    # ---- DIAGNOSTIC (not a filter): do the two READINGS share a root?
    #
    # This was a filter until it ate 出る/出す. It is a good precision signal --
    # 下がる/下さる share the kanji 下 but are "to go down" and "to give", a
    # spelling collision, and the readings さがる/くださる catch that where the
    # kanji cannot. But gating on it cuts exactly the pairs worth having:
    # でる/だす share no prefix at all, and 出る/出す is suppletive precisely
    # BECAUSE the root shifts. The signal is real and it is anti-correlated with
    # the pairs a learner needs, so it ranks; it does not decide.
    def root_of(a, b):
        ra, rb = a["reb"] or "", b["reb"] or ""
        i = 0
        while i < min(len(ra), len(rb)) and ra[i] == rb[i]:
            i += 1
        return ra[:i], ra[i:], rb[i:]

    shares = 0
    for a, b in uniq:
        root, ea, eb = root_of(a, b)
        if root:
            shares += 1
        print(f"{a['stem']}\t{a['keb']}({a['reb']},{a['cls']},{a['t']})\t"
              f"{b['keb']}({b['reb']},{b['cls']},{b['t']})\t"
              f"{'root:' + root if root else 'NOROOT'}|-{ea}/-{eb}\t"
              f"vi:{'; '.join(a['senses'][0]['glosses'][:3])}\t"
              f"vt:{'; '.join(b['senses'][0]['glosses'][:3])}")
    print(f"  of which share a reading root: {shares} "
          f"({len(uniq) - shares} suppletive-root, incl. 出る/出す)", file=sys.stderr)


if __name__ == "__main__":
    main()
