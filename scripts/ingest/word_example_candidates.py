# -*- coding: utf-8 -*-
"""
Candidate sentences, from the WHOLE Tatoeba jpn-eng export, for the vocabulary
words the grammar corpus never reached (SAK-461).

    uv run --with fugashi --with unidic-lite scripts/ingest/word_example_candidates.py
    uv run --with fugashi --with unidic-lite scripts/ingest/word_example_candidates.py --stats-only

Writes src/data/generated/word-example-candidates.json, which is COMMITTED and
is a BUILD INPUT, not something the app ever loads: the only readers are
scripts/build-word-examples.ts and the tests beside it.

WHY THIS EXISTS
===============
word-examples.json used to be picked out of grammar-corpus.json, and
grammar-corpus.json is not "every Tatoeba sentence": scripts/ingest/grammar.py
keeps only sentences that also match one of recipes.ts's grammar patterns, then
caps each pattern at 200. That filter has nothing to do with whether a sentence
teaches a WORD well, so 9,566 of the 12,555 vocabulary words came out with no
"In a sentence" section at all, set phrases like いただきます among them. This
pass widens the pool to the whole export for exactly those words.

THE CORPUS'S ANSWER IS NEVER OVERRULED
======================================
A word the corpus already reaches is skipped here, so the 2,989 rows that
existed before this pass cannot move, and a word the corpus reaches but whose
every candidate is banned by WRONG_SENSE_EXAMPLES stays without an example on
purpose: that ban says "better none than this", and quietly going around it
with a wider pool would undo a human judgment. Coverage from the corpus is read
off grammar-corpus.json's own `v` lists, which is the same set
`indexByWord(corpus())` builds in TypeScript, so the two halves cannot drift.

THE CHOICE IS STILL MADE IN TYPESCRIPT
======================================
This pass emits CANDIDATES. The one sentence a word ends up with is chosen by
chooseExample in src/lib/library/word-example.ts, the same function that chose
the corpus rows, running in scripts/build-word-examples.ts over the corpus pool
first and this pool only when the corpus pool is empty. Nothing here ranks a
sentence against another except to apply PER_WORD_CAP, and that cap sorts on
chooseExample's own first key (the beginnerRank of the hardest other word, read
out of the same vocab-runtime.json the chooser is handed), so the cap cannot
throw away the sentence the chooser would have picked. If the two orders ever
did drift, the chooser still picks the best of what it is given: the cost would
be a slightly worse sentence, never a sentence the chooser rejects.

MATCHING: THE WRITTEN FORM AND THE READING, AT A TOKEN BOUNDARY
===============================================================
Two rules, in this order:

1. TOKEN RULE. A content token whose dictionary form (UniDic `orthBase`,
   falling back to `lemma`, the same resolution assembly.py's
   content_lemmas() and sentence_readings.py's span already use) is the word's
   `keb`, AND whose base reading (`kanaBase`, both sides folded to hiragana) is
   the word's `reb`. The reading half is what the old corpus matcher could not
   do and what word-example.ts's header says it refused coverage rather than
   guess at: 後 is あと in this vocabulary, so a 後 read ご is a different word
   and does not match. Matching whole tokens is also what keeps a short kana
   word out of the middle of a longer one.

2. KANA PHRASE RULE, for a word written in kana with no kanji in it, and only
   when the token rule found nothing. UniDic does not file いただきます,
   おはよう or ごちそうさま as one content token. いただきます is いただき +
   ます off the verb いただく and おはよう is an 感動詞, so the token rule cannot
   see a set phrase at all. Here the word matches when its literal text appears
   in the sentence STARTING at a token start and ENDING at a token end. Both
   boundaries are required: that is what tells いただきます in これをいただきます
   apart from a run of characters that happens to span the middle of two words.

Either way, a match that is only PART OF A LONGER WORD is thrown out: see
glued_to_an_affix, which is what keeps 区 out of 区立図書館 and めでとう out of
おめでとう.

A word that neither rule matches gets no candidate, which is the normal answer
for most of the long tail.

THE FILTERS
===========
Sentence-level, and deliberately the same ones grammar.py already applies,
imported from it rather than retyped:

  - a human English translation, through the jpn-eng links export. Tatoeba's
    per-language exports carry no machine translation and no MT flag: every
    sentence in them was written by a contributor and every link was made by
    one. That is the whole of what "human translation" can be checked here, and
    it is the same claim grammar-corpus.json ships under.
  - MIN_OWNER_SENTENCES: a named owner with at least 50 Japanese sentences.
    grammar.py's TRUSTED proxy, with its own warning attached: a prolific
    contributor is an established one, not a verified native speaker.
  - MAX_TOKENS: at most 14 real tokens. A learner reads this on a small card.
  - Japanese script only, no digits and no Latin.

Then, per (word, sentence), two more this pass adds:

  - THE TRANSLATION HAS TO MENTION THE WORD'S MEANING. A sentence whose English
    shares no content word with any meaning the app accepts for this word is
    rejected. This is the cheap, mechanical half of the wrong-sense problem
    WRONG_SENSE_EXAMPLES handles by hand: it does not catch a subtle drift, but
    it does catch the sentence that is simply about something else. See
    meaning_words() for which meanings count and how the two sides are matched.
  - NOTHING VULGAR OR VIOLENT, by a short named list, UNLESS the flagged term
    is one of the word's own meanings: 死ぬ means "to die" and its sentence is
    allowed to say so.

WHAT THESE FILTERS DO NOT REMOVE
================================
Everything grammar.py's docstring says about Tatoeba is true of this pool too,
and more of it, because nothing here had to match a grammar pattern first: the
corpus is community-authored, not level-vetted, contains ungrammatical
sentences, and skews literary and proverbial. A row here is "a real sentence a
human wrote, which another human translated". It is not "a good example", and
the word page must not imply otherwise.
"""

import argparse
import json
import os
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from aligner import is_kanji, kata2hira  # noqa: E402

# Everything the sentence-level half of this pass needs is already in
# grammar.py, so it is imported rather than retyped. TATOEBA_IDS especially: a
# fourth export could otherwise be added to one Tatoeba pass and forgotten in
# the other. CONTENT_POS is the same list sentence_readings.py holds the span
# match to, because a particle or an auxiliary must never resolve to a content
# word's keb.
from grammar import (  # noqa: E402
    CONTENT_POS,
    MAX_TOKENS,
    MIN_OWNER_SENTENCES,
    TATOEBA_IDS,
    content_lemmas,
    is_kana_or_kanji,
    load_eng,
    load_links,
    load_sentences_detailed,
    tok_fields,
)
from sources import (  # noqa: E402
    add_source_args,
    ensure_archive,
    open_archive_text,
    record_build,
    verify_source,
)

GEN = os.path.join(HERE, "..", "..", "src", "data", "generated")
OUT = os.path.join(GEN, "word-example-candidates.json")

# How many candidates a word keeps. A SIZE cap, not a choice; see the module
# header. Eight is enough that a later WRONG_SENSE_EXAMPLES ban on the pick has
# somewhere to fall through to, and small enough that the committed file stays
# a fraction of grammar-corpus.json.
PER_WORD_CAP = 8

# The score for a lemma no vocabulary row has, mirroring word-example.ts's
# UNRANKED: an unlisted lemma is HARDER than the hardest listed word, because a
# sentence made of nothing but proper nouns is not an easy sentence.
UNRANKED = 1_000_000

# How many words the sentence may use that the app does not teach.
#
# THE ONE FILTER THAT DOES THE MOST FOR HOW HARD A SENTENCE READS, and the
# reason it is a count and not a rank: chooseExample already prefers the
# sentence whose hardest OTHER word is commonest, and on this pool that key is
# too noisy to threshold, because UniDic files ない and ある as content words
# and beginnerRank puts them past 7,000 (SAK-174 moved them out of the spoken
# frequency head, since they categorize as grammar). So hardness is measured
# here as the plainer thing: a content word that is in no vocabulary row at
# all. 屏風 in the 坊主 tongue twister, 虚言, 受容, 本家本元, ティンホイル: one
# such word is what made every sentence a first read of this pass called too
# hard, and every sentence it called good had none.
#
# A NAME DOES NOT COUNT. トムは軍人じゃない。is a fine sentence for 軍人 and
# トム is in no vocabulary row, so 固有名詞 is exempt: a learner reads past a
# name without having to know it, which is not true of 屏風.
MAX_UNTAUGHT_WORDS = 0

# No other word in the sentence may be HARDER THAN THE WORD BEING TAUGHT, or
# than the EASY_FLOOR-th word in teaching order, whichever comes later.
#
# The filter above asks whether a word is taught at all. This one asks when: a
# sentence can be built entirely out of the vocabulary and still be no use to
# the learner who has just met 体育, because 保健体育の講義 and 資源管理の大原則
# are sentences for somebody several thousand words further on. Every row a
# first read of this pass called too hard in the first thousand words was this
# shape.
#
# The floor is what keeps the rule from starving the long tail. 猟犬 is the
# 10,692nd word and its sentence is allowed 嗅覚 and 獲物, because a sentence
# about hunting dogs made only of the first 3,000 words does not exist. A word
# the learner meets early gets a sentence out of the early vocabulary; a word
# they meet late gets a sentence no harder than itself.
#
# Dependent verbs and adjectives (UniDic 非自立可能: ある, いる, くる, みる,
# ない) are left out of the measure, along with names and numbers. They are
# grammar rather than vocabulary, they are in every sentence, and beginnerRank
# puts several of them past 7,000 because SAK-174 took them out of the spoken
# frequency head. Counting them would mean nothing passed.
EASY_FLOOR = 3000

# Parts of speech left out of the hardness measure. See EASY_FLOOR.
NOT_VOCABULARY = ("非自立可能", "固有名詞", "数詞")


# ---------------------------------------------------------------------------
# English, stemmed just enough to compare a meaning with a translation.
# ---------------------------------------------------------------------------

# English words that are never what a Japanese word MEANS, only how a meaning is
# written: articles, prepositions, pronouns, conjunctions and the auxiliaries.
# Dropped from the meaning side only. The sentence side keeps everything,
# because a wide sentence vocabulary costs nothing here: the question this
# filter asks is whether the MEANING is present, not whether the sentence is
# about anything in particular.
#
# "be", "do" and "have" are in here and that is a real cost: a word meaning
# "to be" can no longer be checked at all. It is the right way round: left in,
# they match nearly every English sentence ever written, and a filter that
# always passes is not a filter. A word whose every meaning reduces to nothing
# is simply not checked; see meaning_words().
#
# STEMMED ON THE WAY IN, because the comparison is between stems: without that
# "this" stems to "thi", which is in no list, and every sentence containing the
# word "this" then matched every meaning containing it. Two rows had already
# slipped through that way when source-pins.test.ts's independent check found
# it.
_MEANING_STOPWORD_TEXT = """
    a an the to of in on at by for with from into onto over under about
    and or but not no nor so than then that this these those there here
    i me my mine you your yours he him his she her hers it its we us our ours
    they them their theirs who whom whose which what where when why how
    be am is are was were been being do does did done have has had having
    will would shall should can could may might must let lets
    one ones s t etc eg ie esp e g i e usu somebody someone something
    oneself itself himself herself themselves yourself myself
    """

# The fallback, for the 40 words whose whole meaning is function words: その is
# "that; the", こと is "thing", のに is "although". Dropping the stopwords leaves
# nothing, and skipping the check then let その's sentence be じゃあその時に。
# ("See you then"), whose translation does not contain the word in any form,
# while その本どこで買ったの？("Where did you buy that book?") was sitting in the
# same pool. So when the strong set is empty the check runs again against
# everything but the articles, and "that" becomes a word the translation has to
# say. It is a weak test, and it is only reached where there is no strong one.
_LOOSE_STOPWORD_TEXT = "a an the to of s t etc eg ie e g i usu"

# Past tenses and plurals a suffix rule cannot reach. Short and named, like
# every other list in this pipeline: the alternative is a stemming library and
# a new dependency for sixty words.
IRREGULAR = {
    "am": "be", "is": "be", "are": "be", "was": "be", "were": "be", "been": "be",
    "has": "have", "had": "have", "does": "do", "did": "do", "done": "do",
    "went": "go", "gone": "go", "goes": "go", "got": "get", "gotten": "get",
    "made": "make", "took": "take", "taken": "take", "saw": "see", "seen": "see",
    "came": "come", "knew": "know", "known": "know", "gave": "give", "given": "give",
    "found": "find", "thought": "think", "told": "tell", "became": "become",
    "left": "leave", "felt": "feel", "brought": "bring", "began": "begin",
    "begun": "begin", "kept": "keep", "held": "hold", "wrote": "write",
    "written": "write", "stood": "stand", "heard": "hear", "meant": "mean",
    "ran": "run", "paid": "pay", "sat": "sit", "spoke": "speak", "spoken": "speak",
    "led": "lead", "grew": "grow", "grown": "grow", "lost": "lose", "fell": "fall",
    "fallen": "fall", "sent": "send", "built": "build", "understood": "understand",
    "drew": "draw", "drawn": "draw", "broke": "break", "broken": "break",
    "spent": "spend", "rose": "rise", "risen": "rise", "drove": "drive",
    "driven": "drive", "bought": "buy", "wore": "wear", "worn": "wear",
    "chose": "choose", "chosen": "choose", "ate": "eat", "eaten": "eat",
    "slept": "sleep", "drank": "drink", "drunk": "drink", "taught": "teach",
    "caught": "catch", "flew": "fly", "flown": "fly", "forgot": "forget",
    "forgotten": "forget", "swam": "swim", "sang": "sing", "sung": "sing",
    "rode": "ride", "ridden": "ride", "won": "win", "threw": "throw",
    "thrown": "throw", "woke": "wake", "stole": "steal", "stolen": "steal",
    "sold": "sell", "told": "tell", "put": "put", "cut": "cut", "read": "read",
    "children": "child", "people": "person", "men": "man", "women": "woman",
    "feet": "foot", "teeth": "tooth", "mice": "mouse", "geese": "goose",
    "lives": "life", "wives": "wife", "knives": "knife", "leaves": "leaf",
}


def stem(word):
    """A deliberately small stemmer: enough that "runs", "running" and "ran"
    all meet at "run", and no more. Both sides of the comparison go through it,
    so what matters is that it agrees with itself, not that it is correct
    English morphology."""
    word = IRREGULAR.get(word, word)
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    for suffix in ("ing", "ed", "es", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            base = word[: -len(suffix)]
            if len(base) > 2 and base[-1] == base[-2] and base[-1] not in "aeiou":
                base = base[:-1]
            return base
    return word


def words_of(text):
    """The stemmed word set of an English string."""
    out = set()
    token = []
    for ch in text.lower():
        if ch.isalpha():
            token.append(ch)
            continue
        if token:
            out.add(stem("".join(token)))
            token = []
    if token:
        out.add(stem("".join(token)))
    return out


MEANING_STOPWORDS = frozenset(stem(w) for w in _MEANING_STOPWORD_TEXT.split())
LOOSE_STOPWORDS = frozenset(stem(w) for w in _LOOSE_STOPWORD_TEXT.split())


def strip_notes(meaning):
    """A meaning with its parenthesized notes removed.

    JMdict writes the note inside the meaning, as in "purposely (of
    something needless, unexpected ...)", and those notes are long, general
    English that
    matches far too much. "purposely" is the meaning; "unexpected" is a note
    about when to use it.
    """
    out = []
    depth = 0
    for ch in meaning:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif depth == 0:
            out.append(ch)
    return "".join(out).strip()


def page_meanings(row, units):
    """The meanings THE WORD PAGE SHOWS for this word, and no others.

    THE NARROW SET IS THE POINT. The obvious wider choice is every JMdict
    sense in word-definitions.json, and it was measurably wrong: 一人歩き is
    taught as "taking on a life of its own (of a rumour)", JMdict also lists
    "walking by oneself", and against the wider set a sentence translated "I
    like a solitary walk" passed a check whose whole job is to ask whether the
    translation says what the page says the word means. 満面 and 粘る failed
    the same way. So the set is exactly what src/app/(sky)/teach.ts puts on the
    page: `readingUnits`'s glosses for the reading this word is taught under,
    which is vocab-runtime.json's `units` for the 120 words that have several,
    and the row's own glosses for everyone else.
    """
    entries = units.get(row["keb"])
    if not entries:
        return list(row["glosses"])
    reb = kata2hira(row["reb"])
    for unit in entries:
        if kata2hira(unit["reb"]) == reb:
            return list(unit["glosses"])
    return [g for unit in entries for g in unit["glosses"]]


def meaning_words(texts, stopwords=None):
    """Every English word that counts as a word's meaning, stemmed.

    Returns an empty set when nothing survives `stopwords`. The caller then
    falls back to the looser set (see LOOSE_STOPWORDS) and, failing that, does
    not run the check at all rather than reject everything: a word meaning "to
    be" cannot be checked this way, and refusing it every sentence would be a
    wrong answer dressed as a careful one.
    """
    stopwords = MEANING_STOPWORDS if stopwords is None else stopwords
    out = set()
    for text in texts:
        stripped = strip_notes(text)
        for word in words_of(stripped or text):
            if word and word not in stopwords:
                out.add(word)
    return out


# ---------------------------------------------------------------------------
# Vulgar and violent.
# ---------------------------------------------------------------------------

# A short named list, the same honest tool WRONG_SENSE_EXAMPLES is. It is not a
# safety system and does not pretend to be: it keeps the obvious off a card a
# beginner reads, and the pool is big enough that losing a sentence to it costs
# almost nothing. Stemmed on the way in, so "killed" and "killing" are covered
# by "kill".
#
# A word is only flagged when it is NOT one of the word's own meanings -- 死ぬ
# is "to die", 戦争 is "war", and the whole point of the section is to show what
# the word means.
# Swearing and sex, and THIS half has no exception for the word's own meaning.
# くそ is in the vocabulary, taught as "damn; shit", and the pool's pick for it
# was くそ食らえ！("Eat shit!"). The meaning was no argument for printing it on
# a beginner's card, so くそ now has no example instead, which is the same
# answer this pass gives 5,800 other words.
PROFANITY_EN = frozenset(
    stem(w)
    for w in """
    fuck fucking shit shitty crap damn damned bastard bitch cunt dick asshole
    whore slut porn sex sexual naked nude penis vagina erection orgasm
    rape raped raping incest molest prostitute brothel
    """.split()
)

# Violence, death and the rest of what a learner should not be handed
# unasked. THIS half does have the exception: 死ぬ means "to die", 戦争 means
# "war", 殺す means "to kill", and the sentence on those pages is allowed to
# say so, because the section's whole job is to show what the word means.
HARSH_EN = frozenset(
    stem(w)
    for w in """
    kill killed killing murder murdered murderer slaughter massacre
    suicide corpse dead death die died dying drown strangle
    blood bleeding stab stabbed shoot shot gun rifle pistol bomb bombed
    war battle weapon torture hostage kidnap hanged
    assault abuse violence violent cruel bully harass harassment
    drunk drunken cocaine heroin
    """.split()
)

# The same two, in Japanese, for the sentence whose English says it gently.
# Substrings, so 銃 catches 拳銃 and 殺 catches 殺人.
PROFANITY_JA = ("強姦", "レイプ", "売春", "痴漢", "セックス", "くそ", "糞")

# Each Japanese marker carries the English it means, because the exception
# above is written in English: 殺す's own page may show a sentence about
# killing, so the marker has to be able to recognize "kill" among the word's
# meanings.
HARSH_JA = {
    "殺": ("kill", "murder"),
    "自殺": ("suicide",),
    "戦争": ("war",),
    "拷問": ("torture",),
    "爆弾": ("bomb",),
    "銃": ("gun", "rifle", "pistol"),
    "麻薬": ("drug", "narcotic"),
    "首吊り": ("hanging",),
    "死体": ("corpse", "body"),
    "虐待": ("abuse",),
}


def unwanted(jp, en_words, meanings):
    """Is this sentence one a beginner's word page should not show?"""
    if PROFANITY_EN & en_words:
        return True
    if any(marker in jp for marker in PROFANITY_JA):
        return True
    if (HARSH_EN & en_words) - meanings:
        return True
    for marker, english in HARSH_JA.items():
        if marker in jp and not (meanings & {stem(w) for w in english}):
            return True
    return False


# ---------------------------------------------------------------------------
# Matching.
# ---------------------------------------------------------------------------


def token_reading(raw):
    """A token's BASE reading, folded to hiragana, or "" when UniDic has none.

    `kanaBase` is the reading of the token's DICTIONARY form, which is the one
    to compare against `reb`: the surface reading of 行き is イキ and the word
    in the vocabulary is いく. Both sides are folded to hiragana so that a
    katakana headword (コーヒー) compares against a katakana reading without a
    second rule.

    An empty answer rejects the token. UniDic leaves `kanaBase` empty on tokens
    it has no dictionary entry for, and a word whose reading cannot be read off
    the sentence is exactly the case this pass refuses to guess at.
    """
    return kata2hira(getattr(raw.feature, "kanaBase", None) or "")


# Classical auxiliaries. A sentence carrying one of these is a proverb or a
# literary line, not a sentence anybody says: 流れる水は腐らず。("Flowing water
# does not stagnate"), 光るもの必ずしも金ならず。("All that glitters is not
# gold"), 良酒は看板を要せず。("Good wine needs no bush"). grammar.py's docstring
# warns that Tatoeba's register skews literary and proverbial and that its own
# filters do not fix it; on THIS pool, where nothing had to match a modern
# grammar pattern first, one short list of classical auxiliaries fixes most of
# it. Matched on the auxiliary's LEMMA and only on a 助動詞, so 死ぬ (a verb
# ending in ぬ) and 成り (a verb) are untouched.
CLASSICAL_AUX = frozenset(("ず", "べし", "なり", "ごとし", "けり", "む"))


def classical(toks):
    """Does this sentence use a classical auxiliary?"""
    return any(t["pos1"] == "助動詞" and t["lemma"] in CLASSICAL_AUX for t in toks)


def untaught_words(toks, raws, kebs, rebs):
    """Content words in this sentence that no vocabulary row teaches, names
    excepted. See MAX_UNTAUGHT_WORDS for why this is the hardness measure.

    A WORD IS TAUGHT IF EITHER ITS SPELLING OR ITS READING IS. Asking only
    about the written form makes this filter about orthography rather than
    about hardness: 来る written くる, 言う written いう, 所 written ところ,
    おいしい, 子ども and 私 written わたし are all words the app teaches, and
    all of them are spelled in the export the way nobody spells them in a
    dictionary. Matching the reading as well is what tells those apart from
    屏風, 受容 and 虚言, which are not in the vocabulary under any spelling.
    """
    out = []
    for t, raw in zip(toks, raws):
        if t["pos1"] not in CONTENT_POS:
            continue
        if t["pos1"] == "固有名詞" or t["pos2"] in ("固有名詞", "数詞"):
            continue
        form = t["orth"] or t["lemma"]
        if form in kebs or token_reading(raw) in rebs:
            continue
        out.append(form)
    return out


def vocabulary_lemmas(toks):
    """The content lemmas the hardness measure looks at. See EASY_FLOOR."""
    out = []
    for t in toks:
        if t["pos1"] not in CONTENT_POS or t["pos1"] == "固有名詞":
            continue
        if t["pos2"] in NOT_VOCABULARY:
            continue
        out.append(t["orth"] or t["lemma"])
    return sorted(set(out))


def glued_to_an_affix(toks, i):
    """Is the token at `i` only part of a longer word?

    A 接尾辞 straight after it or a 接頭辞 straight before it means the
    sentence writes a word this word is merely the front or back of, and what
    the page would underline is a piece of that word:

        区立図書館   区 + 立(接尾辞)         the ward's library, not a ward
        自衛隊       自衛 + 隊(接尾辞)       the Self-Defense Forces
        くすぐったがり屋  くすぐった + がり(接尾辞) + 屋
        細っこい     細 + っこい(接尾辞)
        おめでとう   お(接頭辞) + めでとう

    All five matched the token rule and all five read as a mistake on a card.
    A compound of two plain nouns is NOT this case and stays: 写真撮影 is 写真
    + 撮影, both 名詞, and 撮影 means photography there as plainly as it does
    alone.
    """
    if i + 1 < len(toks) and toks[i + 1]["pos1"] == "接尾辞":
        return True
    return i > 0 and toks[i - 1]["pos1"] == "接頭辞"


def match_words(jp, toks, raws, by_form, kana_words, max_kana_len):
    """Every gap word this sentence is a candidate for.

    Rule 1 (tokens) then rule 2 (kana phrases), as the module header describes.
    """
    found = set()
    for i, (fields, raw) in enumerate(zip(toks, raws)):
        if fields["pos1"] not in CONTENT_POS:
            continue
        form = fields["orth"] or fields["lemma"]
        want = by_form.get(form)
        if want is None:
            continue
        reading = token_reading(raw)
        if reading and reading in want and not glued_to_an_affix(toks, i):
            found.add(form)

    if kana_words:
        starts = {}
        cursor = 0
        for fields in toks:
            starts[cursor] = True
            cursor += fields["_len"]
        ends = dict(starts)
        ends.pop(0, None)
        ends[cursor] = True
        for start in sorted(starts):
            for length in range(2, max_kana_len + 1):
                end = start + length
                if end > len(jp) or end not in ends:
                    continue
                piece = jp[start:end]
                if piece in kana_words:
                    found.add(piece)
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="debug: stop after N sentences")
    ap.add_argument("--stats-only", action="store_true")
    add_source_args(ap)
    args = ap.parse_args()

    for archive_id in TATOEBA_IDS:
        ensure_archive(archive_id)
        verify_source(archive_id, accept=args.accept_source)

    import fugashi

    runtime = json.load(open(os.path.join(GEN, "vocab-runtime.json"), encoding="utf-8"))
    rows, units = runtime["rows"], runtime["units"]
    corpus = json.load(open(os.path.join(GEN, "grammar-corpus.json"), encoding="utf-8"))

    covered = set()
    for row in corpus:
        covered.update(row["v"])

    rank = {row["keb"]: row["beginnerRank"] for row in rows}
    kebs = set(rank)
    rebs = {kata2hira(row["reb"]) for row in rows}
    gaps = [row for row in rows if row["keb"] not in covered]
    print(f"vocabulary {len(rows):,}, reached by the grammar corpus {len(rows) - len(gaps):,}, gaps {len(gaps):,}")

    by_form = defaultdict(set)
    kana_words = set()
    meanings = {}
    for row in gaps:
        keb, reb = row["keb"], kata2hira(row["reb"])
        by_form[keb].add(reb)
        if not any(is_kanji(c) for c in keb):
            kana_words.add(keb)
        texts = page_meanings(row, units)
        meanings[keb] = meaning_words(texts) or meaning_words(texts, LOOSE_STOPWORDS)
    max_kana_len = max((len(w) for w in kana_words), default=0)
    print(f"  of those, written in kana and matched as a phrase: {len(kana_words):,}")
    print(f"  with no checkable meaning (the English check is skipped): "
          f"{sum(1 for m in meanings.values() if not m):,}")

    jpn, owners = load_sentences_detailed(open_archive_text("tatoeba-jpn-sentences"))
    eng = load_eng(open_archive_text("tatoeba-eng-sentences"))
    links = load_links(open_archive_text("tatoeba-jpn-eng-links"))
    print(f"japanese sentences {len(jpn):,}")

    tagger = fugashi.Tagger()
    seen = 0
    n_english = 0
    n_trusted = 0
    n_script = 0
    n_length = 0
    n_modern = 0
    n_taught = 0
    n_matched = 0
    dropped_hard = 0
    dropped_meaning = 0
    dropped_unwanted = 0
    pools = defaultdict(list)

    for sid, (text, owner) in jpn.items():
        if args.limit and seen >= args.limit:
            break
        seen += 1
        targets = [t for t in links.get(sid, []) if t in eng]
        if not targets:
            continue
        n_english += 1
        if not owner or owner == "\\N" or owners[owner] < MIN_OWNER_SENTENCES:
            continue
        n_trusted += 1
        if not all(is_kana_or_kanji(c) or c in "、。！？「」・ー" for c in text):
            continue
        n_script += 1
        raws = list(tagger(text))
        toks = [tok_fields(w) for w in raws]
        real = [t for t in toks if t["pos1"] != "補助記号"]
        if len(real) > MAX_TOKENS:
            continue
        n_length += 1
        if classical(toks):
            continue
        n_modern += 1
        if len(untaught_words(toks, raws, kebs, rebs)) > MAX_UNTAUGHT_WORDS:
            continue
        n_taught += 1
        hits = match_words(text, toks, raws, by_form, kana_words, max_kana_len)
        if not hits:
            continue
        n_matched += 1
        en = eng[targets[0]]
        en_words = words_of(en)
        lemmas = sorted(set(content_lemmas(toks)))
        vocabulary = vocabulary_lemmas(toks)
        for keb in hits:
            hardest_other = max((rank.get(x, 0) for x in vocabulary if x != keb), default=0)
            if hardest_other > max(EASY_FLOOR, rank[keb]):
                dropped_hard += 1
                continue
            want = meanings[keb]
            if want and not (want & en_words):
                dropped_meaning += 1
                continue
            if unwanted(text, en_words, want):
                dropped_unwanted += 1
                continue
            pools[keb].append((int(sid), text, en, len(real), lemmas))

    print(f"  with human english        {n_english:>8,}")
    print(f"  trusted owner             {n_trusted:>8,}")
    print(f"  japanese script only      {n_script:>8,}")
    print(f"  at most {MAX_TOKENS} tokens        {n_length:>8,}")
    print(f"  no classical auxiliary    {n_modern:>8,}")
    print(f"  every other word taught   {n_taught:>8,}")
    print(f"  contains a gap word       {n_matched:>8,}")
    print(f"  dropped, a word in it is harder than the word taught {dropped_hard:>8,}")
    print(f"  dropped, translation does not mention the meaning {dropped_meaning:>8,}")
    print(f"  dropped, vulgar or violent                       {dropped_unwanted:>8,}")

    def hardest(row, target):
        worst = 0
        for lemma in row[4]:
            if lemma == target:
                continue
            worst = max(worst, rank.get(lemma, UNRANKED))
        return worst

    sentences = []
    index = {}
    by_id = {}
    for keb in sorted(pools):
        ordered = sorted(pools[keb], key=lambda r: (hardest(r, keb), r[3], r[0]))[:PER_WORD_CAP]
        slots = []
        for row in ordered:
            slot = by_id.get(row[0])
            if slot is None:
                slot = len(sentences)
                by_id[row[0]] = slot
                sentences.append([row[0], row[1], row[2], row[3], row[4]])
            slots.append(slot)
        index[keb] = slots

    kept = sum(len(v) for v in index.values())
    print(f"\nwords with at least one candidate: {len(index):,} of {len(gaps):,} gaps")
    print(f"candidate rows {kept:,} over {len(sentences):,} distinct sentences")

    for band in (1000, 3000, len(rows)):
        head = sorted(rows, key=lambda r: r["beginnerRank"])[:band]
        has = sum(1 for r in head if r["keb"] in covered or r["keb"] in index)
        print(f"  first {band:>6,} words by beginnerRank: {has:>6,} could have a sentence ({100 * has / len(head):.1f}%)")

    if args.stats_only:
        return

    payload = {
        "meta": {
            "generated": "scripts/ingest/word_example_candidates.py",
            "source": "Tatoeba (CC BY 2.0 FR), jpn-eng",
            "maxTokens": MAX_TOKENS,
            "minOwnerSentences": MIN_OWNER_SENTENCES,
            "perWordCap": PER_WORD_CAP,
            "words": len(index),
            "rows": kept,
            "sentences": len(sentences),
        },
        "sentences": sentences,
        "byWord": index,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    print(f"\nwrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)")
    record_build(
        "scripts/ingest/word_example_candidates.py",
        ["word-example-candidates.json"],
        list(TATOEBA_IDS),
    )
    print(
        "\nNOT DONE. The sentence each word ends up with is still chosen in TypeScript:\n"
        "  node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-word-examples.ts\n"
        "  uv run --with fugashi --with unidic-lite scripts/ingest/sentence_readings.py"
    )


if __name__ == "__main__":
    main()
