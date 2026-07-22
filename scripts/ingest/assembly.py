# -*- coding: utf-8 -*-
"""
Emit the ASSEMBLY corpus — sentences broken into ordered drag pieces — from the
committed grammar corpus.

    ~/.pyenv/versions/3.12.4/bin/python3 scripts/ingest/assembly.py
    (any python3 with `pip install fugashi unidic-lite`)

Reads   src/data/generated/grammar-corpus.json   (already committed)
Writes  src/data/generated/assembly-corpus.json  (COMMITTED, like its input)
        src/data/generated/assembly-corpus-meta.json

WHY A SEPARATE SCRIPT, NOT grammar.py
=====================================
grammar.py needs the raw Tatoeba TSV dump to run. That dump is not in the repo;
the *artifact* it produced (grammar-corpus.json) is. Assembly needs only word
segmentation of sentences we already shipped, and segmentation is a pure
function of the sentence text under the SAME tokenizer (fugashi + unidic-lite).
So this reads the committed corpus and re-tokenizes `jp`. Same tagger, same
lemmas, no second data source to keep in sync.

THE FEASIBILITY GATE — "NEVER MARK CORRECT JAPANESE WRONG"
==========================================================
Assembly grades on ONE canonical order. Two ways that can lie, and both are
refused here rather than graded:

1. SEGMENTATION. The corpus stores no word boundaries. fugashi is a real
   morphological tokenizer, so the boundaries are its, not a hand-rolled
   guess. Particles/auxiliaries ride with their preceding content word, exactly
   as the approved mockup draws it (ごはん+を = one piece "ごはんを"). So the
   test is WORD ORDER, never particle choice. If fugashi will not import this
   script exits — a wrong boundary would mint a wrong "canonical order".

2. MULTIPLE VALID ORDERS. Japanese scrambles: two case-marked arguments under
   one predicate (私は本を読む / 本を私は読む) are BOTH correct, so a card whose
   pieces admit more than one order cannot be graded honestly. Such sentences
   are DROPPED, not graded. The surviving set is intentionally small; a small
   honest set beats a large lying one. See `single_order` for the exact rule
   and every reason a sentence is dropped (recorded in the meta file).
"""

import argparse
import json
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "src", "data", "generated")

try:
    import fugashi  # noqa: F401
    import unidic_lite  # noqa: F401
except ImportError:
    sys.exit(
        "FATAL: fugashi + unidic-lite are required and there is no fallback.\n"
        "Assembly grades on one canonical word order; a hand-rolled segmenter\n"
        "would put a boundary in the wrong place and mark a correct answer\n"
        "wrong. Install them (pip install fugashi unidic-lite) or ship no\n"
        "assembly corpus at all.\n"
    )

# POS that BEGIN a new drag piece (an independent word).
HEAD_POS = {
    "名詞", "代名詞", "固有名詞", "動詞", "形容詞", "形状詞",
    "副詞", "連体詞", "接続詞", "感動詞",
}
# POS that ATTACH to the piece on their left (particles, auxiliaries, suffixes).
TAIL_POS = {"助詞", "助動詞", "接尾辞"}
# Predicate heads — a piece headed by one of these CLOSES a clause.
PRED_POS = {"動詞", "形容詞", "形状詞"}
# Content POS, for the known-words gate (mirrors grammar.py's CONTENT_POS).
CONTENT_POS = ("名詞", "動詞", "形容詞", "形状詞", "副詞", "代名詞")

# Auxiliary verbs that follow て and belong to the predicate they attach to
# (ている, てしまう, …). By lemma, so a 非自立 verb after て does not wrongly
# start its own piece and split one predicate into two.
TE_AUX_LEMMA = {
    "居る", "有る", "仕舞う", "見る", "置く", "上げる", "呉れる",
    "貰う", "行く", "来る", "下さる", "始める", "続ける", "過ぎる",
}

PUNCT = "、。！？「」『』・…‥（）()〜～"


def tok(w):
    f = w.feature
    return {
        "surface": w.surface,
        "pos1": getattr(f, "pos1", None) or "",
        "pos2": getattr(f, "pos2", None) or "",
        "cForm": getattr(f, "cForm", None) or "",
        "lemma": getattr(f, "lemma", None) or "",
        "orth": getattr(f, "orthBase", None) or "",
    }


def group_pieces(toks):
    """Group tokens into drag pieces.

    Returns a list of pieces; each piece is a list of token dicts. Punctuation
    tokens are dropped. Returns None if the sentence cannot be cleanly grouped
    (e.g. it opens on an attaching token).
    """
    pieces = []
    prev_tail_te = False  # did the previous token close on a て/で 接続助詞?
    pending_prefix = []   # 接頭辞 (お, ご, 御) ride onto the NEXT content word
    for t in toks:
        if t["pos1"] == "補助記号" or (t["surface"] and all(c in PUNCT for c in t["surface"])):
            prev_tail_te = False
            continue
        if t["pos1"] == "接頭辞":
            # A prefix belongs to the word that follows it (お + 願い = お願い).
            pending_prefix.append(t)
            prev_tail_te = False
            continue
        attach = False
        if t["pos1"] in TAIL_POS:
            attach = True
        elif t["pos1"] == "動詞" and prev_tail_te and t["lemma"] in TE_AUX_LEMMA:
            # ている / てしまう … — auxiliary verb, part of the same predicate.
            attach = True
        if attach:
            if not pieces:
                return None  # sentence opens on an attaching token: give up
            pieces[-1].extend(pending_prefix)  # a stray prefix, fold it in
            pending_prefix = []
            pieces[-1].append(t)
        else:
            pieces.append(pending_prefix + [t])
            pending_prefix = []
        prev_tail_te = (
            t["pos1"] == "助詞"
            and t["pos2"] == "接続助詞"
            and t["lemma"] in ("て",)
        )
    if pending_prefix:
        return None  # a prefix with nothing to attach to: give up
    return pieces


def piece_head(piece):
    """The first content-bearing token of a piece (its head)."""
    for t in piece:
        if t["pos1"] in HEAD_POS:
            return t
    return piece[0]


def has_copula(piece):
    return any(t["pos1"] == "助動詞" and t["lemma"] in ("だ", "です") for t in piece)


def is_predicate(piece):
    """A piece is a predicate when it heads a clause.

    A VERB or an i-ADJECTIVE head is always a predicate. A na-adjective (形状詞)
    or a NOUN is a predicate ONLY with a copula (きれいだ / 学生です) — bare
    きれいに is an ADVERBIAL modifier, not a clause, and counting it as a clause
    let two-modifier clauses slip the scramble filter.
    """
    head = piece_head(piece)
    if head["pos1"] in ("動詞", "形容詞"):
        return True
    if head["pos1"] in ("形状詞", "名詞", "代名詞", "副詞") and has_copula(piece):
        return True
    return False


# Subordinating connectives a NON-FINAL predicate may end on. These FIX the
# clause sequence (てから happens before the main clause, always). A bare て, a
# 連用形 continuative, たり and し are COORDINATING — "A and B" reorders to
# "B and A" with the same meaning, so a card built on them has two correct
# orders and is dropped.
SUBORDINATOR_LEMMA = {"から", "ば", "と", "けれど", "けど", "が", "ので", "のに", "し"}
# し listed only to be excluded explicitly below; it is coordinating.
COORDINATING_LEMMA = {"し"}


def subordinating_tail(piece):
    """Does a non-final predicate piece end on a fixed-order subordinator?"""
    last = piece[-1]
    # た/だ 仮定形 (たら / なら) and 仮定形 -ば all fix order.
    if last["cForm"].startswith("仮定形"):
        return True
    if last["pos1"] == "助詞" and last["lemma"] in SUBORDINATOR_LEMMA:
        return last["lemma"] not in COORDINATING_LEMMA
    return False


def single_order(pieces):
    """Is the piece order genuinely fixed? Returns (ok, reason).

    THE CONSERVATIVE RULE. A clause is a run of modifier pieces closed by a
    predicate piece. Within one clause, two or more modifiers can scramble
    (私は本を読む / 本を私は読む both grammatical), so any clause carrying >=2
    modifiers is ambiguous and the sentence is dropped. A clause with <=1
    modifier has nothing to reorder, and clauses are chained by connectives
    that fix their sequence, so the whole order is forced.

    This is deliberately strict. It drops far more than it must, but every
    sentence it KEEPS has exactly one natural order, which is the only thing
    that lets assembly grade without ever marking correct Japanese wrong.
    """
    if not pieces:
        return False, "empty"
    if not is_predicate(pieces[-1]):
        return False, "does-not-end-on-a-predicate"

    modifiers = 0
    n_clauses = 0
    n_pred = sum(1 for p in pieces if is_predicate(p))
    seen_pred = 0
    for p in pieces:
        if is_predicate(p):
            if modifiers >= 2:
                return False, "clause-with-scrambleable-modifiers"
            seen_pred += 1
            # Every predicate but the sentence-final one must close its clause
            # with a fixed-order subordinator, or the clauses coordinate and
            # reorder.
            if seen_pred < n_pred and not subordinating_tail(p):
                return False, "coordinate-or-continuative-join"
            n_clauses += 1
            modifiers = 0
        else:
            modifiers += 1
    # trailing modifiers with no closing predicate → not a clean order
    if modifiers != 0:
        return False, "trailing-modifiers"
    if n_clauses == 0:
        return False, "no-predicate"
    return True, ""


def piece_surface(piece):
    return "".join(t["surface"] for t in piece)


def content_lemmas(toks):
    return sorted({t["orth"] or t["lemma"] for t in toks if t["pos1"] in CONTENT_POS})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-pieces", type=int, default=3)
    ap.add_argument("--max-pieces", type=int, default=7)
    ap.add_argument("--stats-only", action="store_true")
    args = ap.parse_args()

    corpus = json.load(open(os.path.join(OUT, "grammar-corpus.json"), encoding="utf-8"))
    tagger = fugashi.Tagger()

    kept = []
    drop = Counter()
    seen_pieces = set()  # dedupe identical piece multisets across sentences

    for row in corpus:
        toks = [tok(w) for w in tagger(row["jp"])]
        pieces = group_pieces(toks)
        if pieces is None:
            drop["ungroupable"] += 1
            continue
        n = len(pieces)
        if n < args.min_pieces:
            drop["too-few-pieces"] += 1
            continue
        if n > args.max_pieces:
            drop["too-many-pieces"] += 1
            continue
        ok, reason = single_order(pieces)
        if not ok:
            drop[reason] += 1
            continue

        surfaces = [piece_surface(p) for p in pieces]
        # A piece must never repeat within one item, or "the" canonical order is
        # not unique — two identical chips could swap and both be right.
        if len(set(surfaces)) != len(surfaces):
            drop["repeated-piece"] += 1
            continue
        # Rebuilt sentence must equal the original (minus punctuation): proves
        # the segmentation lost nothing.
        if "".join(surfaces) not in row["jp"].replace("。", "").replace("、", ""):
            drop["reassembly-mismatch"] += 1
            continue

        # Per-piece head lemma for the UI to resolve a gloss from vocab, and a
        # flag for whether the piece head is a content word at all.
        out_pieces = []
        for p in pieces:
            head = piece_head(p)
            out_pieces.append({
                "t": piece_surface(p),
                "h": (head["orth"] or head["lemma"]) if head["pos1"] in CONTENT_POS else None,
            })

        key = tuple(sorted(surfaces))
        if key in seen_pieces:
            drop["duplicate-piece-set"] += 1
            continue
        seen_pieces.add(key)

        kept.append({
            "id": row["id"],
            "en": row["en"],
            "jp": "".join(surfaces),
            "pieces": out_pieces,
            "v": content_lemmas(toks),
            # The grammar patterns this sentence matched. Assembling the sentence
            # correctly places these patterns in a real frame — the same standing
            # a selection cloze has — so the screen scores against their MEANING
            # facts rather than inventing a fact for word order.
            "p": row["p"],
        })

    kept.sort(key=lambda r: (len(r["pieces"]), r["id"]))

    print(f"grammar corpus sentences   {len(corpus):>7,}")
    print(f"assembly items kept        {len(kept):>7,}")
    print()
    for reason, c in drop.most_common():
        print(f"  dropped {reason:<34} {c:>7,}")

    if args.stats_only:
        return

    os.makedirs(OUT, exist_ok=True)
    outp = os.path.join(OUT, "assembly-corpus.json")
    json.dump(kept, open(outp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"\nwrote {outp} ({len(kept):,} items)")

    meta = {
        "generated": "scripts/ingest/assembly.py",
        "source": "src/data/generated/grammar-corpus.json (re-tokenized with fugashi + unidic-lite)",
        "minPieces": args.min_pieces,
        "maxPieces": args.max_pieces,
        "counts": {"input": len(corpus), "kept": len(kept)},
        "dropped": dict(drop.most_common()),
    }
    metap = os.path.join(OUT, "assembly-corpus-meta.json")
    json.dump(meta, open(metap, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"wrote {metap}")


if __name__ == "__main__":
    main()
