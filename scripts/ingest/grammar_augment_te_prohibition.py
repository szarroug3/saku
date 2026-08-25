# -*- coding: utf-8 -*-
"""
Additively re-tag: give te-prohibition (〜てはいけない, "must not do X") real
Tatoeba example sentences and MERGE them into the committed grammar corpus,
WITHOUT re-cutting the sentences the corpus already ships.

    uv run --with fugashi --with unidic-lite \
        scripts/ingest/grammar_augment_te_prohibition.py --src /path/to/tatoeba

Reads (from --src, same three files grammar.py reads):
    jpn_sentences_detailed.tsv, eng_sentences.tsv, jpn-eng_links.tsv
Reads and REWRITES:
    src/data/generated/grammar-corpus.json       (existing rows kept byte-identical)
    src/data/generated/grammar-corpus-meta.json  (new perPattern key + counts)

WHY A SEPARATE SCRIPT, AND NOT A FULL RE-CUT
=============================================
Same reasoning as grammar_augment.py (which did this for the 12 N3 recognition
signatures): grammar.py rewrites the WHOLE corpus from the raw dump, and the
export has drifted since the shipped snapshot, so a full re-cut would re-select
every one of the 50+ existing patterns from different sentences, move their
pinned post-audit counts (see corpus-audit.test.ts's SURVIVED table), and
reopen the confound audit for all of them — churn unrelated to adding one
missing signature.

WHY NOT JUST ADD "te-prohibition" TO grammar_augment.py'S AUGMENT_IDS
=======================================================================
That script's own docstring and comments describe it as tagging the 12 N3
clause-level RECOGNITION recipes specifically ("Each MUST have a signature...
the twelfth shipped N3 recognition recipe, wake-da, is intentionally absent").
te-prohibition is an N5 て-form pattern, not one of those twelve; folding it in
would make that file's comments describe something it no longer does. This
script is that same additive mechanism, applied to one unrelated pattern, kept
separate so each file's docstring stays true.

After this, run, in order:
    node scripts/audit-corpus.ts
    node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-word-examples.ts
"""

import argparse
import json
import os
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import grammar as G  # noqa: E402  the tagger, its signatures, and its filters

GEN = os.path.join(HERE, "..", "..", "src", "data", "generated")

AUGMENT_IDS = ["te-prohibition"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    args = ap.parse_args()

    import fugashi

    tagger = fugashi.Tagger()

    missing = [rid for rid in AUGMENT_IDS if rid not in G.SIGNATURES]
    if missing:
        sys.exit(f"FATAL: no signature in grammar.py for: {missing}")
    sigs = {rid: G.SIGNATURES[rid] for rid in AUGMENT_IDS}

    corpus_path = os.path.join(GEN, "grammar-corpus.json")
    with open(corpus_path, encoding="utf-8") as fh:
        corpus = json.load(fh)
    existing_ids = {row["id"] for row in corpus}

    jpn, owners = G.load_sentences_detailed(
        os.path.join(args.src, "jpn_sentences_detailed.tsv")
    )
    eng = G.load_eng(os.path.join(args.src, "eng_sentences.tsv"))
    links = G.load_links(os.path.join(args.src, "jpn-eng_links.tsv"))

    linked = []
    for sid, (text, owner) in jpn.items():
        targets = [t for t in links.get(sid, []) if t in eng]
        if not targets:
            continue
        linked.append((sid, text, owner, eng[targets[0]]))

    per_raw = Counter()
    per_kept = Counter()
    new_rows = []
    for sid, text, owner, en in linked:
        # Freeze the committed corpus: a sentence already shipped keeps exactly
        # the tags it shipped with, so no existing pattern's count can move.
        if int(sid) in existing_ids:
            continue
        toks = [G.tok_fields(w) for w in tagger(text)]
        real = [t for t in toks if t["pos1"] != "補助記号"]

        offs = []
        acc = 0
        for t in toks:
            offs.append(acc)
            acc += t["_len"]
        offs.append(acc)

        matched = {}
        for rid, sig in sigs.items():
            spans = G.match_all(toks, sig)
            if len(spans) >= G.MIN_HITS.get(rid, 1):
                a, b = spans[0]
                matched[rid] = {
                    "s": offs[a],
                    "e": offs[b],
                    "h": toks[a]["orth"] or toks[a]["lemma"] if sig.get("host") else None,
                }
                per_raw[rid] += 1
        if not matched:
            continue

        ok_len = len(real) <= G.MAX_TOKENS
        ok_owner = owner and owner != "\\N" and owners[owner] >= G.MIN_OWNER_SENTENCES
        ok_script = all(G.is_kana_or_kanji(c) or c in "、。！？「」・ー" for c in text)
        if not (ok_len and ok_owner and ok_script):
            continue

        for rid in matched:
            per_kept[rid] += 1
        new_rows.append(
            {
                "id": int(sid),
                "jp": text,
                "en": en,
                "n": len(real),
                "v": sorted(set(G.content_lemmas(toks))),
                "p": sorted(matched),
                "sp": {k: [v["s"], v["e"], v["h"]] for k, v in sorted(matched.items())},
            }
        )

    # Per-pattern cap, shortest first, ties on id — grammar.py's exact rule. A
    # row survives if ANY of its patterns still wants it.
    by_pattern = defaultdict(list)
    for row in new_rows:
        for rid in row["p"]:
            by_pattern[rid].append(row)
    wanted = set()
    for rid, rows in by_pattern.items():
        rows.sort(key=lambda r: (r["n"], r["id"]))
        for r in rows[: G.PER_PATTERN_CAP]:
            wanted.add(r["id"])
    new_rows = [r for r in new_rows if r["id"] in wanted]

    merged = corpus + new_rows

    # True post-merge count per new pattern, from the merged content.
    shipped = Counter()
    for row in new_rows:
        for rid in row["p"]:
            shipped[rid] += 1

    print(f"{'pattern':<22} {'raw':>6} {'filtered':>9} {'shipped':>8}")
    print("-" * 48)
    for rid in AUGMENT_IDS:
        flag = "  <- SCARCE" if shipped[rid] < 20 else ""
        print(f"{rid:<22} {per_raw[rid]:>6} {per_kept[rid]:>9} {shipped[rid]:>8}{flag}")
    print(f"\nexisting {len(corpus):,} + new {len(new_rows):,} = {len(merged):,} sentences")

    # Write the merged corpus, minified exactly as grammar.py / audit-corpus.ts do.
    with open(corpus_path, "w", encoding="utf-8") as fh:
        json.dump(merged, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {corpus_path}")

    # Meta: keep every existing field, add the new pattern key, update kept.
    # audit-corpus.ts recomputes perPattern from content next, so this is a
    # seed; only add a key for a pattern that actually shipped >=1, because a 0
    # here would make the "empty === ['ta-ato-de']" invariant list it.
    meta_path = os.path.join(GEN, "grammar-corpus-meta.json")
    with open(meta_path, encoding="utf-8") as fh:
        meta = json.load(fh)
    meta["counts"]["kept"] = len(merged)
    for rid in AUGMENT_IDS:
        if shipped[rid] > 0:
            meta["perPattern"][rid] = shipped[rid]
        meta["perPatternBeforeCap"][rid] = per_kept[rid]
    meta["perPattern"] = dict(sorted(meta["perPattern"].items()))
    meta["perPatternBeforeCap"] = dict(sorted(meta["perPatternBeforeCap"].items()))
    # te-prohibition now has a real signature, so it drops out of noSignature —
    # it was never in there to begin with (that was the bug), but keep this in
    # sync with G.NO_SIGNATURE regardless, the same way grammar_augment.py does.
    meta["noSignature"] = dict(
        {k: v for k, v in meta["noSignature"].items() if k not in G.SIGNATURES},
        **G.NO_SIGNATURE,
    )
    meta["noSignature"] = dict(sorted(meta["noSignature"].items()))
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
    print(f"wrote {meta_path}")

    print(
        "\nNOT DONE. Now, in order:\n"
        "  node scripts/audit-corpus.ts\n"
        "  node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-word-examples.ts"
    )


if __name__ == "__main__":
    main()
