# P1 · The conjugation guard is too narrow, so four words show impossible forms

**Status: done** — merged to main. Branch `fix/defective-compounds`. The pre-dispatch sweep recorded
below was corrected on two counts once re-run through the engine; see
"The sweep, re-run against the engine" at the bottom.

## Decision

**Scoped to ある and できる only. いる is explicitly excluded.**

The sweep (card step 3, run before dispatch, across all 12,553 vocab rows):

| stem | words ending in it | verdict |
|---|---|---|
| ある | ことがある, である, でもある, **人気のある** | all genuine compounds |
| できる | ことができる | genuine |
| いる | 悔いる, 陥る, 気に入る, 強いる, まいる, 手に入る, 報いる, 用いる, 率いる, 老いる, **射る, 鋳る, 入る** | **all THIRTEEN are false positives** |

~~**The card undercounts: it is five words, not four.**~~ **My pre-dispatch claim,
and it was wrong.** Five words end in ある; only four conjugate. 人気のある is tagged
`exp`+`adj-no`, so it has no conjugation class and generates no forms at all. The
card's original count of four AFFECTED words was right.

> Both rows above were corrected on re-run: 人気のある turns out not to conjugate
> at all, and the いる false positives are 13, not 10. See the bottom of this card.

いる is why this must not be a naive `endsWith`. 用いる (to use), 率いる (to lead),
陥る (to fall into) are independent verbs that merely end in those characters, and
いる's rule is the harshest in the table — six forms including volitional. The
dangerous version of this fix would strip six forms from ten ordinary verbs.

**Correction to the card:** it says of である's forms "None of these are Japanese."
That holds for であれる, であられる and でありたい, but **であれ is attested** as a
literary imperative (民主的であれ, "be democratic!"). Gating it is still right for a
beginner app — shown unlabelled beside everyday forms it teaches the wrong
register — but we are hiding a form that exists, not one that doesn't, and the
rule's `reason` string must not claim otherwise.

Sam asked: how do we fix this?

## What is happening

Some Japanese verbs cannot take every form. ある ("to exist") is the clearest
case: there is no command form of ある, because you cannot order something to
exist. The app knows this. `src/lib/conjugate/policy.ts` has a `DEFECTIVE_WORDS`
table listing which forms each such verb must not generate, and for plain ある it
works correctly.

**The guard matches the word exactly.** So it catches ある, but not any longer
word that ends in ある or できる. Those slip past and the engine generates the
impossible forms anyway.

## What a learner sees today

`/library/word/である` (the standard written form of "to be") shows:

- **であれる** "can do it"
- **であられる** "it's done to them"
- **であれ** — an order
- **でありたい** "want to"

`/library/word/ことができる` shows **ことができろ**, an order.

None of these are Japanese. Plain ある is correctly gated right next to them,
which proves the guard works and is simply not reaching far enough.

Separately: **ある has no ている form**, but `teiru` is missing from its list, so
`/library/word/ある` shows **あっている** labelled "doing it now". That one affects
ある itself plus the three compounds.

## Affected

Four words: である, ことができる, ことがある, でもある. Small in count, but
ことができる is a headline beginner pattern with its own grammar recipe, and である
is the standard written copula. Both get looked up.

## Fix

1. Change the lookup from exact match to **also match a word that ends in a
   defective stem**, so である inherits ある's restrictions and ことができる
   inherits できる's. Guard against false positives: a word merely containing the
   characters is not the same as a compound built on that verb.
2. Add `teiru` to ある's defective list.
3. Sweep the whole vocabulary for any other compound ending in a word that appears
   in `DEFECTIVE_WORDS`, so the fix is measured rather than assumed to be four.
4. Add a test that generates every form of every defective word and its compounds
   and asserts none of the forbidden ones appear.

## Done when

- [x] である, ことができる, ことがある, でもある show no impossible forms.
- [x] あっている is gone.
- [x] The sweep count is recorded — see below.

## The sweep, re-run against the engine (not just the strings)

Suffix-matching every `DEFECTIVE_WORDS` spelling against both the written form
and the reading of all **12,553** vocab rows gives **24 candidate words**. Of
those, **5 changed** and **19 were left exactly as they were**.

**Corrections to the pre-dispatch sweep, both found by conjugating rather than
string-matching:**

1. **人気のある is a genuine ある compound but is NOT affected.** Its JMdict tags
   are `exp` + `adj-no`, neither of which is a conjugation class, so
   `classFromTags` returns null and it generates **no forms at all** — today or
   after this change. So the card's count of four *affected* words was right,
   though for a reason nobody had checked. Five words end in ある; four of them
   conjugate.

2. **The いる false positives are 13, not 10.** The pre-dispatch sweep missed
   射る, 鋳る and 入る, whose *reading* is exactly いる (not merely a suffix of
   it). They are safe only because the engine matches the **written** form —
   a matcher keyed on readings would have gated them outright, as exact hits.
   This makes the case against a naive suffix match stronger, not weaker.

**The 5 words whose output changed** (all losses; nothing new is generated):

| word | forms removed |
|---|---|
| ある | あっている |
| である | であれる, であられる, であらせる, であらせられる, であれ, であっている |
| ことがある | ことがあれる, ことがあられる, ことがあらせる, ことがあらせられる, ことがあれ, ことがあっている |
| でもある | でもあれる, でもあられる, でもあらせる, でもあらせられる, でもあれ, でもあっている |
| ことができる | ことができられる (×2), ことができさせる, ことができさせられる, ことができろ |

**Unchanged, and tested by name:** 用いる, 率いる, 陥る, 強いる, 悔いる, 報いる,
老いる, まいる, 気に入る, 手に入る, 射る, 鋳る, 入る — plus 見える, 聞こえる,
わかる, いる, できる, and 人気のある (which still generates nothing).

## How the match is scoped

`DefectiveRule` gained an opt-in flag, `gatesCompounds`, set on **ある and
できる only**. Compound matching is per-rule data with a written justification,
not a heuristic over the whole table — いる simply does not set it, so its rule
still matches by exact spelling and cannot reach 用いる or 率いる.

The suffix test is safe for ある on structural grounds, verified rather than
assumed: a Japanese verb ending in the *-aru* sound is written consonant+あ kana
(始まる = ま+る, 終わる = わ+る), so a bare あ+る ending is the verb ある standing
alone. Across all 12,553 rows the only longer words ending in ある are the four
genuine compounds above. できる has exactly one hit, ことができる.

## Left alone, deliberately

**でありたい is still generated.** The card lists it as impossible, but ありたい
is attested — こうでありたい ("I want to be like this") is ordinary if formal
Japanese. Plain ある does not gate `tai` either, so gating it on the compound
would have been a new restriction on the base verb, outside this card's scope.
Flag it separately if it should go.

**であれ is gated, but it exists.** The rule's `reason` string says so in
as many words, rather than claiming であれ is not Japanese.
