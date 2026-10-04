# -*- coding: utf-8 -*-
"""
Re-tag one pattern, rashii (〜らしい, "apparently X"), with grammar.py's
corrected signature, and merge the result into the committed grammar corpus
without re-cutting the sentences every other pattern ships (SAK-510).

    uv run --with fugashi --with unidic-lite scripts/ingest/grammar_retag_rashii.py
    uv run --with fugashi --with unidic-lite scripts/ingest/grammar_retag_rashii.py --accept-source

Reads the three Tatoeba exports grammar.py reads, pinned by hash in
src/data/generated/sources.json (SAK-434). Reads and rewrites:
    src/data/generated/grammar-corpus.json
    src/data/generated/grammar-corpus-meta.json

WHY NOT RE-RUN grammar.py
=========================
For the reason grammar_augment.py gives. The shipped corpus was cut from a
Tatoeba snapshot nobody can download again, and a full re-cut re-selects every
pattern from different sentences. The old rashii signature was wrong, and no
other pattern's was, so only rashii moves.

WHAT IT DOES
============
1. Leaves the old rashii tags alone. They are the suffix "like a real X",
   and their spans start with らし because the old signature had no host.
   scripts/audit-corpus.ts takes those off next, by the rashii rule in
   src/data/grammar/corpus-audit.ts, and records each one in
   grammar-corpus-dropped.json. A row left with no pattern stays in the file
   for word examples, the way the audit keeps any other.
2. Finds every sentence in the export that passes grammar.py's filters (14
   real tokens or fewer, a prolific named owner, kana and kanji only), is not
   vulgar or violent by word_example_candidates.py's list, and matches the new
   signature. Each is added as a new row tagged rashii, at most
   grammar.PER_PATTERN_CAP of them, shortest first, ties on id.
3. Skips a sentence the corpus already has, the way grammar_augment.py does.
   It keeps exactly the tags it shipped with, so no other pattern's rows move.

After this, run the audit and the derived files. The order is in the SAK-510
section at the end of src/sky/README.md.
"""

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import grammar as G  # noqa: E402  the tagger, its signatures, and its filters
import sources as S  # noqa: E402  the archive pins and the --accept-source flag
from word_example_candidates import unwanted, words_of  # noqa: E402  the word pool's content filter

GEN = os.path.join(HERE, "..", "..", "src", "data", "generated")

RID = "rashii"

# Sentences the signature matches that no beginner should be handed, by id,
# for a reason a person gave. Kept out of the corpus, so no page shows them.
SKIP = {
    # Sam's review of the word pool (SAK-461) banned it from 新人's page as a
    # man sizing up a colleague; see WRONG_SENSE_EXAMPLES in
    # src/lib/library/word-example.ts. It would be just as wrong here.
    772450: "おい、今度の新人かわいいらしいぜ。",
}


def main():
    ap = argparse.ArgumentParser()
    S.add_source_args(ap)
    args = ap.parse_args()

    for archive_id in G.TATOEBA_IDS:
        S.ensure_archive(archive_id)
        S.verify_source(archive_id, accept=args.accept_source)

    import fugashi

    tagger = fugashi.Tagger()
    G.check_rashii(tagger)
    sig = G.SIGNATURES[RID]

    corpus_path = os.path.join(GEN, "grammar-corpus.json")
    with open(corpus_path, encoding="utf-8") as fh:
        corpus = json.load(fh)
    before = sum(1 for row in corpus if RID in row["p"])
    shipped = {row["id"] for row in corpus}

    jpn, owners = G.load_sentences_detailed(S.open_archive_text("tatoeba-jpn-sentences"))
    eng = G.load_eng(S.open_archive_text("tatoeba-eng-sentences"))
    links = G.load_links(S.open_archive_text("tatoeba-jpn-eng-links"))

    raw = 0
    harsh = 0
    found = []
    for sid, (text, owner) in jpn.items():
        if "らし" not in text or int(sid) in SKIP:
            continue
        targets = [t for t in links.get(sid, []) if t in eng]
        if not targets:
            continue
        toks = [G.tok_fields(w) for w in tagger(text)]
        spans = G.match_all(toks, sig)
        if not spans:
            continue
        raw += 1
        real = [t for t in toks if t["pos1"] != "補助記号"]
        ok_len = len(real) <= G.MAX_TOKENS
        ok_owner = owner and owner != "\\N" and owners[owner] >= G.MIN_OWNER_SENTENCES
        ok_script = all(G.is_kana_or_kanji(c) or c in "、。！？「」・ー" for c in text)
        if not (ok_len and ok_owner and ok_script):
            continue
        # The same list the word pool uses, with no word's meaning to excuse a
        # hit: nothing on this page is about killing.
        if unwanted(text, words_of(eng[targets[0]]), set()):
            harsh += 1
            continue
        offs = [0]
        for t in toks:
            offs.append(offs[-1] + t["_len"])
        a, b = spans[0]
        found.append(
            {
                "id": int(sid),
                "jp": text,
                "en": eng[targets[0]],
                "n": len(real),
                "v": sorted(set(G.content_lemmas(toks))),
                "p": [RID],
                "sp": {RID: [offs[a], offs[b], toks[a]["orth"] or toks[a]["lemma"]]},
            }
        )

    frozen = [r["id"] for r in found if r["id"] in shipped]
    fresh = sorted((r for r in found if r["id"] not in shipped), key=lambda r: (r["n"], r["id"]))
    added = fresh[: G.PER_PATTERN_CAP]
    merged = corpus + added
    after = sum(1 for row in merged if RID in row["p"])

    print(f"rashii before {before}: every one the suffix sense, left for the audit")
    print(f"export matches {raw}, {len(found)} pass the filters ({harsh} vulgar or violent)")
    print(f"  {len(frozen)} already in the corpus, left as they are: {frozen}")
    print(f"  {len(added)} added as new rows (of {len(fresh)})")
    print(f"rashii after {after}, {len(added)} of them the new sense; corpus {len(corpus):,} -> {len(merged):,} sentences")

    with open(corpus_path, "w", encoding="utf-8") as fh:
        json.dump(merged, fh, ensure_ascii=False, separators=(",", ":"))

    meta_path = os.path.join(GEN, "grammar-corpus-meta.json")
    with open(meta_path, encoding="utf-8") as fh:
        meta = json.load(fh)
    meta["counts"]["kept"] = len(merged)
    meta["perPattern"][RID] = after
    meta["perPatternBeforeCap"][RID] = len(found)
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
    S.record_build(
        "scripts/ingest/grammar_retag_rashii.py",
        ["grammar-corpus.json", "grammar-corpus-meta.json"],
        list(G.TATOEBA_IDS),
    )
    print("wrote grammar-corpus.json, grammar-corpus-meta.json and the build record")


if __name__ == "__main__":
    main()
