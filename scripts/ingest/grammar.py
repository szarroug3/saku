# -*- coding: utf-8 -*-
"""
Ingest the Tatoeba jpn-eng corpus into example sentences for grammar patterns.

    python3 scripts/ingest/grammar.py --src /path/to/tatoeba

Reads (from --src):
    jpn_sentences_detailed.tsv   id, lang, text, owner, added, modified
    eng_sentences.tsv            id, lang, text
    jpn-eng_links.tsv            jpn_id, eng_id

Writes src/data/generated/grammar-corpus.json, which IS COMMITTED, for the
same reason build.py's output is: the artifact is the data, not the pipeline.

MATCHING IS MORPHOLOGICAL. THIS IS NOT NEGOTIABLE.
==================================================
A regex is not an approximation of this — it is a different, wrong answer that
looks right. Measured on this corpus: a regex for 〜ようです scores 5,290 hits
against a morphological truth of 728. An 86% false-positive rate, SILENTLY,
because に carries the lemma だ in UniDic, so every 〜ように matched 〜ようだ.
Nothing downstream can detect that; the sentences look Japanese and the
pattern label is simply a lie.

So: fugashi + unidic-lite, and if they will not import, this script EXITS
rather than falling back. A missing corpus is a gap. A regex corpus is a
corpus of wrong claims, and grammar is the only subject standing on it.

WHAT UNIDIC GIVES US FOR FREE
=============================
Two splits this project had already decided on turn out to be splits UniDic
made first, which is a strong independent signal they are real:

  そう   lemma "そう-様態" vs "そう-伝聞". 降りそう / 降るそうだ. UniDic
         distinguishes them in the dictionary itself.
  から   NOT split by lemma, but fully determined by what precedes: 東京から
         (名詞) is a source; 高いから (終止形) is a reason.

And one split it CANNOT make, confirming the recipe note rather than
contradicting it:

  られる 彼に食べられた (passive) and 彼は食べられる (potential) tokenise
         IDENTICALLY. The ambiguity is in Japanese, not in the tagger and not
         in our list. No filter can fix it, so no SELECTION item may ask it.

WHAT THIS FILTER DOES NOT REMOVE
================================
Read this before trusting a number out of it. Tatoeba is the weakest source in
this design:

  - It is community-authored and NOT level-vetted. There is no N5 flag, and
    nothing here invents one. "N5 example" below means "matched an N5 pattern
    and passed the filters", never "is an N5 sentence".
  - It contains outright ungrammatical sentences. 彼女は余暇を人形を作って過
    ごす。 has a double を and is in the corpus today. The token filter does
    not catch it; nothing here does.
  - Register skews literary and proverbial, not conversational. The filters
    below reduce this (length, common vocabulary) but do not fix it.
  - `trusted` is OUR PROXY, not Tatoeba's trust signal — see TRUSTED below.

The honest summary: these filters raise the floor. They do not certify a
sentence. Anything shipped from here is "a real sentence a human wrote and
another human translated", which is a much weaker claim than "a good example",
and the app should not imply otherwise.
"""

import argparse
import json
import os
import sys
from collections import Counter, defaultdict

OUT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "data", "generated"
)

# ---------------------------------------------------------------------------
# The tagger. Hard dependency, by design — see the module docstring.
# ---------------------------------------------------------------------------

try:
    import fugashi  # noqa: F401
    import unidic_lite  # noqa: F401
except ImportError:
    sys.exit(
        "FATAL: fugashi + unidic-lite are required and there is no fallback.\n"
        "A regex implementation of this script scores 5,290 hits on 〜ようです\n"
        "where the truth is 728 — an 86% false-positive rate, silently. Install\n"
        "them (pip install fugashi unidic-lite) or ship no corpus at all.\n"
    )


# ---------------------------------------------------------------------------
# The predicate language.
#
# A signature is a contiguous run of token predicates, optionally anchored on
# what precedes it (the HOST — the verb or adjective the pattern attaches to).
# Every field is matched against UniDic features, never against surface text.
# ---------------------------------------------------------------------------


def tok_fields(w):
    """The features we match on, normalised to plain strings."""
    f = w.feature
    return {
        "surface": w.surface,
        "_len": len(w.surface),
        "lemma": getattr(f, "lemma", None) or "",
        "pos1": getattr(f, "pos1", None) or "",
        "pos2": getattr(f, "pos2", None) or "",
        "cForm": getattr(f, "cForm", None) or "",
        "orth": getattr(f, "orthBase", None) or "",
    }


def pred(t, p):
    """Does token dict `t` satisfy predicate `p`?

    Key suffixes compose the test; the plain key is exact equality.
      lemma="て"                 exact
      pos1_in=("名詞","代名詞")   membership
      cForm_prefix="連用形"       startswith — UniDic cForms are "連用形-一般",
                                 "連用形-撥音便", ...; the branch after the dash
                                 is 音便 detail we never want to match on.
      cForm_not_prefix="連用形"   the negation, and the one that defuses ようだ.

    Order matters: _not_prefix must be tested before _prefix and _not, or it
    parses as the wrong operator against a base named "cForm_not".
    """
    for key, want in p.items():
        if key.endswith("_not_prefix"):
            if t.get(key[: -len("_not_prefix")], "").startswith(want):
                return False
        elif key.endswith("_prefix"):
            if not t.get(key[: -len("_prefix")], "").startswith(want):
                return False
        elif key.endswith("_in"):
            if t.get(key[: -len("_in")], "") not in want:
                return False
        elif key.endswith("_not"):
            if t.get(key[: -len("_not")], "") == want:
                return False
        else:
            if t.get(key, "") != want:
                return False
    return True


# Reusable host predicates.
VERB_RENYOU = {"pos1": "動詞", "cForm_prefix": "連用形"}  # 食べ, 読み, 話し
VERB_MIZEN = {"pos1": "動詞", "cForm_prefix": "未然形"}  # 食べ(ない), 行か(ない)
VERB_SHUUSHI = {"pos1": "動詞", "cForm_prefix": "終止形"}  # 食べる, 読む
VERB_RENTAI = {"pos1": "動詞", "cForm_prefix": "連体形"}  # 食べる(こと)
NOUNISH = {"pos1_in": ("名詞", "代名詞", "固有名詞")}

# ---------------------------------------------------------------------------
# SIGNATURES — one per recipe id in src/data/grammar/recipes.ts.
#
# Keyed by recipe id, and a test asserts the two id sets agree, so a recipe
# added without a signature is a visible gap rather than a silent zero.
#
# NOT every recipe gets one:
#   - potential / passive are morphologically identical (see docstring).
#   - the bare-て recipes (te-sequence, te-cause) are the same token run and
#     differ only by meaning; matching them would label sentences at random.
# Those are listed in NO_SIGNATURE with a reason, which is a claim we make
# once here rather than a zero someone has to explain later.
# ---------------------------------------------------------------------------

SIGNATURES = {
    # --- て-form -----------------------------------------------------------
    "te-kara": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "て", "pos1": "助詞"}, {"lemma": "から", "pos1": "助詞"}],
    },
    "te-request": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "て", "pos1": "助詞"}, {"lemma": "下さる"}],
    },
    "te-permission": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "て", "pos1": "助詞"}, {"lemma": "も"}, {"lemma_in": ("良い", "好い")}],
    },
    "te-iru": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "て", "pos1": "助詞"}, {"lemma": "居る"}],
    },
    "te-shimau": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "て", "pos1": "助詞"}, {"lemma": "仕舞う"}],
    },
    "te-miru": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "て", "pos1": "助詞"}, {"lemma": "見る"}],
    },
    "te-oku": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "て", "pos1": "助詞"}, {"lemma": "置く"}],
    },
    "te-ageru": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "て", "pos1": "助詞"}, {"lemma": "上げる"}],
    },
    "te-kureru": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "て", "pos1": "助詞"}, {"lemma": "呉れる"}],
    },
    "te-morau": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "て", "pos1": "助詞"}, {"lemma": "貰う"}],
    },
    # --- ない-form ---------------------------------------------------------
    "nai-request": {
        "host": VERB_MIZEN,
        "seq": [{"lemma": "ない"}, {"lemma": "て", "pos1": "助詞"}, {"lemma": "下さる"}],
    },
    "nakereba-naranai": {
        "host": VERB_MIZEN,
        "seq": [
            {"lemma": "ない", "cForm_prefix": "仮定形"},
            {"lemma": "ば"},
            {"lemma": "成る"},
        ],
    },
    "nakereba-ikenai": {
        "host": VERB_MIZEN,
        "seq": [
            {"lemma": "ない", "cForm_prefix": "仮定形"},
            {"lemma": "ば"},
            {"lemma": "行く"},
        ],
    },
    "nakute-wa-naranai": {
        "host": VERB_MIZEN,
        "seq": [
            {"lemma": "ない", "cForm_prefix": "連用形"},
            {"lemma": "て", "pos1": "助詞"},
            {"lemma": "は"},
            {"lemma": "成る"},
        ],
    },
    "nakute-wa-ikenai": {
        "host": VERB_MIZEN,
        "seq": [
            {"lemma": "ない", "cForm_prefix": "連用形"},
            {"lemma": "て", "pos1": "助詞"},
            {"lemma": "は"},
            {"lemma": "行く"},
        ],
    },
    "nai-to-ikenai": {
        "host": VERB_MIZEN,
        "seq": [{"lemma": "ない"}, {"lemma": "と"}, {"lemma": "行く"}],
    },
    "nakucha": {
        # なく + ちゃ. ちゃ carries lemma て — the contraction is of なくては.
        "host": VERB_MIZEN,
        "seq": [
            {"lemma": "ない", "cForm_prefix": "連用形"},
            {"lemma": "て", "pos1": "助詞", "surface": "ちゃ"},
        ],
    },
    # なきゃ is ONE token: ない in cForm 仮定形-融合. UniDic marks the
    # contraction as FUSED rather than splitting it, which is more information
    # than we asked for — it means なきゃ and なければ are distinguishable
    # without a surface test.
    "nakya": {
        "host": VERB_MIZEN,
        "seq": [{"lemma": "ない", "cForm": "仮定形-融合"}],
    },
    "nakute-mo-ii": {
        "host": VERB_MIZEN,
        "seq": [
            {"lemma": "ない", "cForm_prefix": "連用形"},
            {"lemma": "て", "pos1": "助詞"},
            {"lemma": "も"},
            {"lemma_in": ("良い", "好い")},
        ],
    },
    "nai-de": {
        "host": VERB_MIZEN,
        "seq": [{"lemma": "ない"}, {"lemma": "て", "pos1": "助詞", "surface": "で"}],
    },
    # --- た-form -----------------------------------------------------------
    "ta-koto-ga-aru": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "た"}, {"lemma": "事"}, {"lemma": "が"}, {"lemma": "有る"}],
    },
    "ta-ato-de": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "た"}, {"lemma": "後"}, {"lemma": "だ", "cForm_prefix": "連用形"}],
    },
    "ta-bakari": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "た"}, {"lemma": "ばかり"}],
    },
    "ta-tokoro": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "た"}, {"lemma": "所"}],
    },
    "ta-hou-ga-ii": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "た"}, {"lemma": "方"}, {"lemma": "が"}, {"lemma_in": ("良い", "好い")}],
    },
    "tari-tari": {
        # ONE たり is not the pattern; the pattern is two. Enforced in
        # match_all via MIN_HITS, not here — a signature can't span a gap.
        "host": VERB_RENYOU,
        "seq": [{"lemma": "たり"}],
    },
    # --- stem --------------------------------------------------------------
    "nagara": {"host": VERB_RENYOU, "seq": [{"lemma": "ながら", "pos1": "助詞"}]},
    "sugiru": {"host": VERB_RENYOU, "seq": [{"lemma": "過ぎる"}]},
    "yasui": {"host": VERB_RENYOU, "seq": [{"lemma": "易い", "pos1": "接尾辞"}]},
    "nikui": {"host": VERB_RENYOU, "seq": [{"lemma": "難い", "pos1": "接尾辞"}]},
    "zurai": {"host": VERB_RENYOU, "seq": [{"lemma": "辛い", "pos1": "接尾辞"}]},
    "kata": {"host": VERB_RENYOU, "seq": [{"lemma": "方", "pos1": "接尾辞"}]},
    "tai": {"host": VERB_RENYOU, "seq": [{"lemma": "たい"}]},
    # そう-様態. UniDic splits this from 伝聞 by LEMMA — see the docstring.
    "sou-appearance": {"host": None, "seq": [{"lemma": "そう-様態"}]},
    "sou-hearsay": {"host": None, "seq": [{"lemma": "そう-伝聞"}]},
    # --- ます --------------------------------------------------------------
    "mashou": {
        "host": VERB_RENYOU,
        "seq": [{"lemma": "ます", "cForm_prefix": "意志推量形"}],
    },
    # --- dictionary form ---------------------------------------------------
    "koto-ga-dekiru": {
        "host": VERB_RENTAI,
        "seq": [{"lemma": "事"}, {"lemma": "が"}, {"lemma": "出来る"}],
    },
    "mae-ni": {
        "host": VERB_RENTAI,
        "seq": [{"lemma": "前"}, {"lemma": "に"}],
    },
    "tsumori": {"host": VERB_RENTAI, "seq": [{"lemma": "積り"}]},  # NOT 積もり
    "hazu": {"host": VERB_RENTAI, "seq": [{"lemma": "筈"}]},
    "to-omou": {
        "host": None,
        "seq": [{"lemma": "と", "pos1": "助詞"}, {"lemma": "思う"}],
    },
    # --- conditionals ------------------------------------------------------
    "ba": {"host": {"cForm_prefix": "仮定形"}, "seq": [{"lemma": "ば", "pos1": "助詞"}]},
    # たら is ONE token in UniDic (助動詞 た, 仮定形), not た + ら. Splitting it
    # scored zero across 232,666 sentences — a signature that matches nothing
    # is the loud failure mode, and the reason the per-pattern table is printed.
    "tara": {"host": None, "seq": [{"lemma": "た", "cForm_prefix": "仮定形"}]},
    # なら is the 仮定形 of the copula だ, not a word of its own.
    "nara": {"host": None, "seq": [{"lemma": "だ", "cForm_prefix": "仮定形"}]},
    # --- reason ------------------------------------------------------------
    # から's two jobs, separated by what PRECEDES. UniDic gives both the same
    # lemma; the host is what tells them apart, and it does so cleanly.
    "kara-reason": {
        "host": {"cForm_prefix": "終止形"},
        "seq": [{"lemma": "から", "pos1": "助詞"}],
    },
    "kara-source": {"host": NOUNISH, "seq": [{"lemma": "から", "pos1": "助詞"}]},
    "node": {
        "host": None,
        "seq": [{"lemma": "の", "pos1": "助詞"}, {"lemma": "だ", "cForm_prefix": "連用形"}],
    },
    "noni": {
        "host": None,
        "seq": [{"lemma": "の", "pos1": "助詞"}, {"lemma": "に", "pos1": "助詞"}],
    },
    # --- evidentials -------------------------------------------------------
    # THE ようだ TRAP, measured on this corpus rather than assumed.
    #
    # It is NOT a "regex vs morphology" problem, and calling it one teaches the
    # wrong lesson. A literal surface regex for ようです scores 145 against a
    # morphological 145 — it is exactly right. The trap is matching the LEMMA
    # だ without testing its cForm, which is a *morphological* implementation
    # and looks more authoritative than a regex while being far more wrong:
    #
    #   よう(様) + lemma だ/です, no cForm guard   5,379
    #   ... in predicate position only               728
    #   false positives                            4,651  (86%)
    #
    # And what the unguarded matcher actually swallows, by the surface of the
    # だ token — every one of these is a real pattern, just not this one:
    #
    #   に  (連用形-ニ)      3,398   ように — "in the manner of". THE big one.
    #   な  (連体形-一般)    1,202   ような — "like/such as", prenominal.
    #   で  (連用形-一般)       37   ようで
    #   なら(仮定形-一般)       10   ようなら
    #
    # ような is deliberately NOT counted here even though it is the same
    # auxiliary inflected: 彼のような人 is "a person LIKE him", not "he SEEMS".
    # It is a different sense, so by this project's own thesis it is a
    # different fact and would need its own recipe. Left out rather than
    # silently folded in; that is the 1,202.
    "you-da": {
        "host": None,
        "seq": [
            {"lemma": "様", "pos1": "形状詞"},
            # PREDICATE POSITION ONLY. 終止形 is ようだ/ようです; 連用形-促音便
            # is ようだった. Everything else that よう + lemma だ can be is a
            # different pattern wearing the same lemma — see the block comment
            # above SIGNATURES for the full breakdown and the numbers.
            {"lemma_in": ("だ", "です"), "cForm_in": ("終止形-一般", "連用形-促音便")},
        ],
    },
    "rashii": {"host": None, "seq": [{"lemma": "らしい", "pos1": "接尾辞"}]},
    # か and も are two separate 助詞; there is no かも token.
    "kamoshirenai": {
        "host": None,
        "seq": [
            {"lemma": "か", "pos1": "助詞"},
            {"lemma": "も", "pos1": "助詞"},
            {"lemma": "知れる"},
            {"lemma": "ない"},
        ],
    },
    "deshou": {
        "host": None,
        "seq": [{"lemma": "です", "cForm_prefix": "意志推量形"}],
    },
    # --- particles (the SELECTION allowlist) -------------------------------
    "wo": {"host": NOUNISH, "seq": [{"lemma": "を", "pos1": "助詞"}]},
    "e": {"host": NOUNISH, "seq": [{"lemma": "へ", "pos1": "助詞"}]},
    "made": {"host": NOUNISH, "seq": [{"lemma": "まで", "pos1": "助詞"}]},
    "made-ni": {
        "host": NOUNISH,
        "seq": [{"lemma": "まで", "pos1": "助詞"}, {"lemma": "に", "pos1": "助詞"}],
    },
    "dake": {"host": NOUNISH, "seq": [{"lemma": "だけ", "pos1": "助詞"}]},
}

# Recipes that deliberately get NO signature, and why. Stated once, here,
# rather than left as an unexplained zero in the output.
NO_SIGNATURE = {
    "potential": "Morphologically identical to `passive` — 彼は食べられる and 彼に食べられた "
    "tokenise the same. Cannot be labelled from the sentence.",
    "passive": "See `potential`.",
    "causative": "させる is distinguishable, but the corpus items would need a role filter "
    "to be usable; out of scope for this pass.",
    "causative-passive": "See `causative`.",
    "te-sequence": "Bare て. Same token run as te-cause; they differ only by meaning, "
    "so labelling either would be labelling at random.",
    "te-cause": "See `te-sequence`.",
    "te-aru": "てある vs ている overlap in the tagger's 有る/居る split more than is safe.",
    "te-iku": "ていく's 行く collides with the ikenai signatures; needs disambiguation.",
    "te-kuru": "See `te-iku`.",
    "te-mo": "ても is a substring of てもいい and てもらう; needs negative lookahead.",
    "to-conditional": "Bare と. Collides with the quotative と and the listing と; "
    "the host test alone does not separate them.",
    "shi": "Bare し. Collides with the 連用形 of する.",
    "you-to-omou": "Volitional + と思う; folded into to-omou for this pass.",
    "masen-ka": "Negative-question ませんか needs a sentence-final test not yet written.",
    "mashou-ka": "See `masen-ka`.",
    "ni-iku": "に行く collides with the source/direction に; needs a motion-verb list.",
    "nai-hou-ga-ii": "ないほうがいい: the ない host test collides with ta-hou-ga-ii.",
    "koto-ni-suru": "ことにする / ことになる differ by one verb lemma but overlap with "
    "the plain こと + に; out of scope for this pass.",
    "koto-ni-naru": "See `koto-ni-suru`.",
    "tokoro": "Bare ところ (about to X) collides with ta-tokoro and the noun 所.",
    "shika-nai": "しか〜ない spans arbitrary distance; not a contiguous signature.",
    "hou-ga-yori": "Comparison frames span the clause; not a contiguous signature.",
    "wa-yori": "See `hou-ga-yori`. And は is never quizzed regardless.",
}

# Patterns needing two hits in one sentence to count.
MIN_HITS = {"tari-tari": 2}


def match_all(toks, sig):
    """Every match of `sig` in `toks`, as (start, end) token indices.

    The span INCLUDES the host token when there is one, because the host is
    conjugated BY the pattern — 亡くなってから is 亡くなっ + て + から, and a
    blank that starts after 亡くなっ has already given away that the answer
    takes the て-form. The verb's dictionary form is carried separately as the
    prompt, so the question is "which pattern", not "which suffix".
    """
    seq = sig["seq"]
    host = sig.get("host")
    n = len(seq)
    out = []
    for i in range(len(toks) - n + 1):
        start = i
        if host is not None:
            if i == 0:
                continue
            if not pred(toks[i - 1], host):
                continue
            start = i - 1
        if all(pred(toks[i + j], seq[j]) for j in range(n)):
            out.append((start, i + n))
    return out


# ---------------------------------------------------------------------------
# The filters.
# ---------------------------------------------------------------------------

MAX_TOKENS = 14

# Per-pattern cap on the shipped corpus.
#
# Not a quality filter — a SIZE one, and it is the difference between a 9MB
# artifact and a 1.5MB one. Uncapped, を alone contributes 26,482 sentences,
# 42% of the whole file, and nobody needs 26,482 examples of を: a drill that
# showed you a fresh one every session would take 72 years to repeat.
#
# Selection is SHORTEST FIRST, which for this user is not a compromise but the
# preference — the register problem in the docstring is worst in the long
# sentences, and a beginner reads a 6-token sentence and learns from it. Ties
# break on sentence id, so the artifact is deterministic across runs.
PER_PATTERN_CAP = 200

# TRUSTED CONTRIBUTOR — OUR PROXY, AND NOT TATOEBA'S SIGNAL.
#
# Be clear about what this is. Tatoeba does have trust data (per-sentence
# ratings, "advanced contributor" status); it is NOT in the per-language
# exports this script reads, and we do not have it. So `trusted` here means:
#
#   the sentence has a named owner (not \N — orphaned sentences have nobody
#   accountable for them), AND that owner has contributed at least
#   MIN_OWNER_SENTENCES Japanese sentences.
#
# The reasoning is that a prolific owner is an established contributor whose
# work has survived years of community correction. That is a REAL signal and
# it is NOT the same as "verified native speaker", which we cannot compute.
# A prolific contributor can still write an odd sentence, and does.
MIN_OWNER_SENTENCES = 50


def is_kana_or_kanji(ch):
    o = ord(ch)
    return (
        0x3040 <= o <= 0x309F  # hiragana
        or 0x30A0 <= o <= 0x30FF  # katakana
        or 0x4E00 <= o <= 0x9FFF  # CJK
        or ch in "々〆ヶー"
    )


CONTENT_POS = ("名詞", "動詞", "形容詞", "形状詞", "副詞", "代名詞")


def content_lemmas(toks):
    """The lemmas a vocabulary-coverage test should look at.

    Particles and auxiliaries are excluded: a beginner who has met any verb at
    all has met は and を, so counting them inflates coverage toward 100% and
    the filter stops filtering.
    """
    return [t["orth"] or t["lemma"] for t in toks if t["pos1"] in CONTENT_POS]


# ---------------------------------------------------------------------------
# Load / join / match.
# ---------------------------------------------------------------------------


def load_sentences_detailed(path):
    rows = {}
    owners = Counter()
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 4:
                continue
            sid, _lang, text, owner = parts[0], parts[1], parts[2], parts[3]
            rows[sid] = (text, owner)
            if owner and owner != "\\N":
                owners[owner] += 1
    return rows, owners


def load_eng(path):
    rows = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 3:
                continue
            rows[parts[0]] = parts[2]
    return rows


def load_links(path):
    links = defaultdict(list)
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 2:
                continue
            links[parts[0]].append(parts[1])
    return links


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--limit", type=int, default=0, help="debug: stop after N sentences")
    ap.add_argument("--stats-only", action="store_true")
    args = ap.parse_args()

    import fugashi

    tagger = fugashi.Tagger()

    jpn, owners = load_sentences_detailed(os.path.join(args.src, "jpn_sentences_detailed.tsv"))
    eng = load_eng(os.path.join(args.src, "eng_sentences.tsv"))
    links = load_links(os.path.join(args.src, "jpn-eng_links.tsv"))

    stats = Counter()
    stats["jpn_total"] = len(jpn)

    # 1. Human-linked English.
    linked = []
    for sid, (text, owner) in jpn.items():
        targets = [t for t in links.get(sid, []) if t in eng]
        if not targets:
            continue
        linked.append((sid, text, owner, eng[targets[0]]))
    stats["has_english"] = len(linked)

    per_pattern_raw = Counter()
    per_pattern_kept = Counter()
    kept = []

    for i, (sid, text, owner, en) in enumerate(linked):
        if args.limit and i >= args.limit:
            break
        toks = [tok_fields(w) for w in tagger(text)]
        # Drop punctuation-only tokens from the length count: 。 is not a word
        # a learner reads, and counting it makes the length filter arbitrary.
        real = [t for t in toks if t["pos1"] != "補助記号"]

        # Character offset of each token, for the blank span.
        offs = []
        acc = 0
        for t in toks:
            offs.append(acc)
            acc += t["_len"]
        offs.append(acc)

        matched = {}
        for rid, sig in SIGNATURES.items():
            spans = match_all(toks, sig)
            if len(spans) >= MIN_HITS.get(rid, 1):
                # Only the FIRST match is offered as a blank. A sentence using
                # the pattern twice would need two blanks or an arbitrary
                # choice between them; one span, one question.
                a, b = spans[0]
                matched[rid] = {
                    "s": offs[a],
                    "e": offs[b],
                    # The host's dictionary form — the prompt word. UniDic's
                    # `orth` is the ORTHOGRAPHIC base (帰る), while `lemma` can
                    # normalise the spelling to a different one entirely
                    # (帰る's lemma is 返る). Showing the lemma would print a
                    # word the user is not looking at.
                    "h": toks[a]["orth"] or toks[a]["lemma"] if sig.get("host") else None,
                }
                per_pattern_raw[rid] += 1
        if not matched:
            continue

        ok_len = len(real) <= MAX_TOKENS
        ok_owner = owner and owner != "\\N" and owners[owner] >= MIN_OWNER_SENTENCES
        ok_script = all(is_kana_or_kanji(c) or c in "、。！？「」・ー" for c in text)

        if not (ok_len and ok_owner and ok_script):
            continue
        for rid in matched:
            per_pattern_kept[rid] += 1
        kept.append(
            {
                "id": int(sid),
                "jp": text,
                "en": en,
                "n": len(real),
                # Content lemmas only — the app intersects these with
                # history.facts at RUNTIME to compute the >=95% known-vocabulary
                # filter. It cannot be done here: knownness is per-user and
                # changes every session, so baking it in would freeze one user's
                # progress into a committed artifact.
                "v": sorted(set(content_lemmas(toks))),
                "p": sorted(matched),
                # Blank spans per pattern: [startChar, endChar, hostDictForm].
                "sp": {k: [v["s"], v["e"], v["h"]] for k, v in sorted(matched.items())},
            }
        )

    # Apply the per-pattern cap. A sentence survives if ANY of its patterns
    # still wants it, so a rare pattern is never starved by a common one it
    # happens to co-occur with.
    by_pattern = defaultdict(list)
    for row in kept:
        for rid in row["p"]:
            by_pattern[rid].append(row)
    wanted = set()
    per_pattern_shipped = Counter()
    for rid, rows in by_pattern.items():
        rows.sort(key=lambda r: (r["n"], r["id"]))
        for r in rows[:PER_PATTERN_CAP]:
            wanted.add(r["id"])
        per_pattern_shipped[rid] = min(len(rows), PER_PATTERN_CAP)
    kept = [r for r in kept if r["id"] in wanted]

    stats["matched_any"] = sum(per_pattern_raw.values())
    stats["kept"] = len(kept)

    print(f"japanese sentences          {stats['jpn_total']:>8,}")
    print(f"  with human english        {stats['has_english']:>8,}")
    print(f"  matched >=1 pattern       {sum(1 for _ in kept):>8,} kept after filters")
    print()
    print(f"{'pattern':<22} {'raw':>8} {'filtered':>9} {'shipped':>8}")
    print("-" * 52)
    for rid in sorted(SIGNATURES, key=lambda r: -per_pattern_raw[r]):
        raw = per_pattern_raw[rid]
        k = per_pattern_kept[rid]
        sh = per_pattern_shipped[rid]
        flag = "  <- CAPPED" if sh == PER_PATTERN_CAP else ("  <- SCARCE" if sh < 20 else "")
        print(f"{rid:<22} {raw:>8,} {k:>9,} {sh:>8,}{flag}")
    print()
    print(f"recipes with no signature: {len(NO_SIGNATURE)} (see NO_SIGNATURE)")

    if args.stats_only:
        return

    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, "grammar-corpus.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(kept, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"\nwrote {out} ({len(kept):,} sentences)")

    meta = os.path.join(OUT, "grammar-corpus-meta.json")
    with open(meta, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "generated": "scripts/ingest/grammar.py",
                "source": "Tatoeba (CC BY 2.0 FR), jpn-eng",
                "maxTokens": MAX_TOKENS,
                "minOwnerSentences": MIN_OWNER_SENTENCES,
                "perPatternCap": PER_PATTERN_CAP,
                "counts": {
                    "japanese": stats["jpn_total"],
                    "withEnglish": stats["has_english"],
                    "kept": len(kept),
                },
                "perPattern": {r: per_pattern_shipped[r] for r in sorted(SIGNATURES)},
                "perPatternBeforeCap": {r: per_pattern_kept[r] for r in sorted(SIGNATURES)},
                "noSignature": NO_SIGNATURE,
            },
            fh,
            ensure_ascii=False,
            indent=2,
        )
    print(f"wrote {meta}")


if __name__ == "__main__":
    main()
