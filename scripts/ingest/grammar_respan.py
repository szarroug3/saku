# -*- coding: utf-8 -*-
"""
Re-cut every pattern span in the committed grammar corpus so it ends where its
last word does, without re-selecting a single sentence (SAK-507).

    uv run --with fugashi --with unidic-lite scripts/ingest/grammar_respan.py
    uv run --with fugashi --with unidic-lite scripts/ingest/grammar_respan.py --check

Reads and rewrites src/data/generated/grammar-corpus.json. With --check it
writes nothing and exits 1 when a span would move.

WHY
===
grammar.py used to end a span on the signature's last token, so
信用してはいけないよ was marked してはいけ with ない left plain. match_all now
runs the span on to the end of the word (see word_end in grammar.py). The
corpus was cut before that, and a full re-cut re-selects every pattern from
the export, for the reason grammar_augment.py gives. So this pass only moves
span ends.

WHAT IT DOES
============
Each sentence's own Japanese is tokenized again with the tagger grammar.py
uses. For every pattern the row carries, the signature is matched again, and
the match that starts where the stored span starts gives the new end. The
start, the host word, the sentence, its tags and every other field stay as
they are. It reads no export, so it needs no pinned archive.

A span whose start no longer matches its signature is left alone and listed,
so a tagger update that moves a token is seen rather than papered over.

After this, run `node scripts/audit-corpus.ts`: the audit reads spans, and its
counts must come out the same.
"""

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import grammar as G  # noqa: E402  the tagger, its signatures, and match_all

GEN = os.path.join(HERE, "..", "..", "src", "data", "generated")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="write nothing; exit 1 if a span would move")
    args = ap.parse_args()

    import fugashi

    tagger = fugashi.Tagger()
    G.check_word_end(tagger)

    corpus_path = os.path.join(GEN, "grammar-corpus.json")
    with open(corpus_path, encoding="utf-8") as fh:
        corpus = json.load(fh)

    moved = {}
    unmatched = []
    for row in corpus:
        toks = [G.tok_fields(w) for w in tagger(row["jp"])]
        offs = [0]
        for t in toks:
            offs.append(offs[-1] + t["_len"])
        for rid, (s, e, h) in row["sp"].items():
            ends = [offs[b] for a, b in G.match_all(toks, G.SIGNATURES[rid]) if offs[a] == s]
            if not ends:
                unmatched.append(f"{row['id']} {rid} {row['jp'][s:e]}")
                continue
            if ends[0] != e:
                row["sp"][rid] = [s, ends[0], h]
                moved[rid] = moved.get(rid, 0) + 1

    for rid in sorted(moved, key=lambda r: -moved[r]):
        print(f"{rid:<22} {moved[rid]:>6,} spans moved")
    print(f"{sum(moved.values()):,} spans moved across {len(moved)} patterns")
    if unmatched:
        print(f"\n{len(unmatched)} spans whose start no longer matches, left as they are:")
        for line in unmatched:
            print("  " + line)

    if args.check:
        sys.exit(1 if moved else 0)
    with open(corpus_path, "w", encoding="utf-8") as fh:
        json.dump(corpus, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"\nwrote {corpus_path}")


if __name__ == "__main__":
    main()
