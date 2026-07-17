# -*- coding: utf-8 -*-
"""
Compute `beginnerRank`: order the ~12,553 words most-useful-first for a beginner.

    python3 scripts/ingest/beginnerrank.py            # rewrite generated/vocab.json
    python3 scripts/ingest/beginnerrank.py --check    # print the money-shot, write nothing

WHY THIS EXISTS, AND WHY NOT `newspaperBand`
============================================
The only commonness signal already in the data is `newspaperBand` (JMdict's
newspaper frequency). Ordering by it puts 委員会 (committee) and 与党 (ruling
party) at the very front and buries 食べる (band 25) and 飲む (band 35). A quiz
seeded from newspaper frequency teaches you to read a paper you cannot order
lunch in. `beginnerRank` is the "order lunch" ordering.

THE BLEND
=========
No single free file is both conversational AND cleanly joinable, so this blends
three, using each only where it is strong:

  GATE  — which band a word sits in — is the CONSENSUS JLPT level of two
          independent, freely-licensed lists: tanos.co.uk (Jonathan Waller,
          CC BY) and open-anki-jlpt-decks (jamsinclair, MIT). They agree on
          ~89% of shared words; AVERAGING the two N-levels smooths the vendor
          spread. Beginner-scoped by construction, so the newspaper villains
          (委員会, 与党) never enter the front — they are not in N5/N4 at all.
          A word's level is the EASIEST (highest-N) entry that matches its
          reading: a beginner meets 何 at N5 even though one vendor also files
          it at N3, and frequency should be free to rank it accordingly.

  ORDER within a band — OpenSubtitles 2018 rank (hermitdave/FrequencyWords,
          CC BY-SA 4.0). Conversational register, the right signal. Its
          tokenizer splits dictionary forms (食べる -> 食べ, 行く -> 行), so a
          direct join lands only ~41%; a one-character kanji-stem fallback
          recovers the verbs/adjectives and lifts that to ~46%. Used for
          RANKING, never for membership.

  score = meanJlptLevel*K - log(subRank)

  A SOFT blend, not hard tiers. K is tuned (see K) so levels essentially do not
  interleave at the top — the first 50 come out as everyday N5 words ordered by
  frequency — while a very-high-frequency word one level down can still be
  pulled up toward the band boundary (the 何/言う case the coarse level misses).

DRAMA SKEW
==========
TV over-represents conflict: 死ぬ (to die) reaches subtitle rank ~20 and would
gate-crash the first 10. A short, hand-listed MORBID set is denied the frequency
boost (its subRank is floored to the tail), so those words fall to the END of
their JLPT band instead of the front. This is a light demotion, not a deletion —
死ぬ is still an N5 word, just not the seventh word a beginner sees.

THE TAIL
========
~50% of the vocabulary does not join either JLPT list. These are the advanced /
rare words that belong AFTER the beginner curriculum, so they are given a
defined tail rank (ordered by subtitle frequency, then newspaper band) rather
than left undefined. `beginnerRank` is therefore TOTAL: every word has a unique
integer 1..N, 1 = most useful to a beginner first.

REPRODUCIBILITY
===============
The three sources are committed under scripts/ingest/sources/ (see the README
there). build.py calls compute_beginner_ranks() when it emits vocab.json, so a
full re-cut regenerates the field; this script's __main__ applies the same
function to the already-emitted generated/vocab.json so the field can be
refreshed without a full dictionary re-cut. Neither hand-edits the JSON.
"""

import argparse, csv, glob, json, math, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCES = os.path.join(HERE, "sources")
VOCAB_JSON = os.path.join(HERE, "..", "..", "src", "data", "generated", "vocab.json")

# score = meanJlptLevel*K - log(subRank). K=10 ~= the maximum within-band log
# span, so a band's cheapest word and its dearest word cannot cross a full
# level, but the single most frequent word of a lower band can reach the
# boundary of the one above it. Tuned against the money-shot check in __main__:
# the first 50 must read as everyday Japanese, not newspaper Japanese.
K = 10.0

# Denied the OpenSubtitles boost (subRank floored to the tail) so drama-frequent
# violence/death words sink to the end of their JLPT band rather than the front.
# Kept deliberately short and defensible; it is a demotion, not a blocklist.
MORBID = {
    "死ぬ", "死", "殺す", "殺", "殺人", "撃つ", "銃", "血",
    "戦争", "敵", "地獄", "悪魔", "泥棒", "犯人",
}

_HIRA = lambda c: "぀" <= c <= "ゟ"
_KANJI = lambda c: "一" <= c <= "鿿"


# ---------------------------------------------------------------- load sources

def load_subtitles(path):
    """token -> 1-based frequency rank (most frequent = 1)."""
    rank = {}
    with open(path, encoding="utf-8") as fh:
        for i, line in enumerate(fh, 1):
            p = line.split()
            if len(p) >= 2 and p[0] not in rank:
                rank[p[0]] = i
    return rank


def load_tanos(path):
    """keb -> [(reading, N-level)]. tanos `level` IS the N number (5 = N5)."""
    raw = json.load(open(path, encoding="utf-8"))
    return {k: [(e["reading"], e["level"]) for e in v] for k, v in raw.items()}


def load_anki(pattern):
    """(expression, reading) -> N-level and expression -> N-level.

    The deck FILE names the level (jlpt-anki-n5.csv -> N5). A word can appear in
    several decks; the easiest (highest N) wins, which is where a beginner first
    meets it."""
    pair, kb = {}, {}
    for fn in sorted(glob.glob(pattern)):
        lvl = int(re.search(r"anki-n(\d)\.csv$", fn).group(1))
        with open(fn, encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                e, rd = row["expression"].strip(), row["reading"].strip()
                pair[(e, rd)] = max(pair.get((e, rd), 0), lvl)
                kb[e] = max(kb.get(e, 0), lvl)
    return pair, kb


# ---------------------------------------------------------------- join helpers

def sub_rank(keb, reb, rank):
    """OpenSubtitles rank via the kanji-stem fallback.

    Candidates: the written form, the reading, and the written form with its
    single trailing hiragana removed (食べる -> 食べ, 行く -> 行, 話す -> 話) —
    exactly the surface token the subtitle tokenizer keeps. The BEST (lowest,
    most-frequent) matching rank is used, so 行く resolves to 行#7 rather than
    the rarer whole-form 行く#5017."""
    cands = [keb, reb]
    if keb and _HIRA(keb[-1]) and any(_KANJI(c) for c in keb):
        cands.append(keb[:-1])
    rs = [rank[c] for c in cands if c in rank]
    return min(rs) if rs else None


def tanos_level(keb, reb, tanos):
    e = tanos.get(keb)
    if not e:
        return None
    ls = [lv for r, lv in e if r == reb] or [lv for _, lv in e]
    return max(ls)  # easiest = highest N


def anki_level(keb, reb, pair, kb):
    if (keb, reb) in pair:
        return pair[(keb, reb)]
    return kb.get(keb)


def mean_jlpt(keb, reb, tanos, anki_pair, anki_kb):
    """The consensus (averaged) N-level, or None if neither list has the word."""
    vals = [x for x in (tanos_level(keb, reb, tanos),
                        anki_level(keb, reb, anki_pair, anki_kb)) if x is not None]
    return sum(vals) / len(vals) if vals else None


# ---------------------------------------------------------------- the rank

def compute_beginner_ranks(vocab_rows, sources_dir=SOURCES):
    """Assign `beginnerRank` (1 = most useful first) to every row in place.

    Returns a stats dict for the caller to print. `vocab_rows` are the emitted
    vocab dicts (each with `keb`, `reb`, `newspaperBand`); this is deliberately
    decoupled from the JMdict internals so build.py and the standalone path
    share one implementation."""
    rank = load_subtitles(os.path.join(sources_dir, "opensubtitles-ja-2018.txt"))
    tanos = load_tanos(os.path.join(sources_dir, "jlpt-tanos.json"))
    anki_pair, anki_kb = load_anki(os.path.join(sources_dir, "jlpt-anki-n*.csv"))
    worst = len(rank) + 1

    stats = dict(total=len(vocab_rows), tanos=0, anki=0, both=0, gated=0,
                 sub_direct=0, sub_stem=0)
    scored, tail = [], []
    for w in vocab_rows:
        keb, reb = w["keb"], w["reb"]
        t = tanos_level(keb, reb, tanos)
        a = anki_level(keb, reb, anki_pair, anki_kb)
        stats["tanos"] += t is not None
        stats["anki"] += a is not None
        stats["both"] += t is not None and a is not None
        sr = sub_rank(keb, reb, rank)
        stats["sub_direct"] += keb in rank or reb in rank
        stats["sub_stem"] += sr is not None

        vals = [x for x in (t, a) if x is not None]
        if vals:
            stats["gated"] += 1
            eff = worst if (keb in MORBID or sr is None) else sr
            level = sum(vals) / len(vals)
            score = level * K - math.log(eff)
            # sort: score desc; ties by frequency then written form (stable)
            scored.append((-score, eff, keb, w))
        else:
            # tail: keep the useful-but-advanced words ahead of the truly rare,
            # by subtitle frequency then newspaper band then written form.
            tail.append((sr if sr is not None else worst,
                         w["newspaperBand"] if w["newspaperBand"] is not None else 99,
                         keb, w))

    scored.sort()
    tail.sort()
    r = 1
    for _, _, _, w in scored:
        w["beginnerRank"] = r
        r += 1
    stats["gated_max_rank"] = r - 1
    for _, _, _, w in tail:
        w["beginnerRank"] = r
        r += 1
    return stats


# ---------------------------------------------------------------- standalone

def _emit(path, rows):
    # Byte-for-byte the format build.py's dump() uses.
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(rows, fh, ensure_ascii=False, separators=(",", ":"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="print the money-shot and stats, write nothing")
    ap.add_argument("--vocab", default=VOCAB_JSON)
    args = ap.parse_args()

    before = os.path.getsize(args.vocab)
    rows = json.load(open(args.vocab, encoding="utf-8"))
    stats = compute_beginner_ranks(rows)

    t = stats["total"]
    print(f"vocab {t} words")
    print(f"  JLPT: tanos {stats['tanos']}  anki {stats['anki']}  "
          f"both {stats['both']}  gated(union) {stats['gated']} "
          f"({100*stats['gated']/t:.1f}%)")
    print(f"  OpenSubtitles: direct {stats['sub_direct']} "
          f"({100*stats['sub_direct']/t:.1f}%)  with kanji-stem fallback "
          f"{stats['sub_stem']} ({100*stats['sub_stem']/t:.1f}%)")
    print(f"  gated occupy ranks 1..{stats['gated_max_rank']}, "
          f"tail {stats['gated_max_rank']+1}..{t}")
    print(f"  K = {K}")

    ordered = sorted(rows, key=lambda w: w["beginnerRank"])
    print("\nfirst 50 by beginnerRank (the money-shot check):")
    for w in ordered[:50]:
        print(f"  {w['beginnerRank']:>3}  {w['keb']:<6} {w['reb']:<8} "
              f"{(w['glosses'][0] if w['glosses'] else ''):<24}")

    if args.check:
        print("\n--check: nothing written.")
        return
    _emit(args.vocab, rows)
    after = os.path.getsize(args.vocab)
    print(f"\nwrote {args.vocab}  {before/1024:.0f} KB -> {after/1024:.0f} KB "
          f"(+{(after-before)/1024:.0f} KB)")


if __name__ == "__main__":
    main()
