# P1 · The conjugation guard is too narrow, so four words show impossible forms

**Status: in progress** — dispatched on `fix/defective-compounds`

## Decision

**Scoped to ある and できる only. いる is explicitly excluded.**

The sweep (card step 3, run before dispatch, across all 12,553 vocab rows):

| stem | words ending in it | verdict |
|---|---|---|
| ある | ことがある, である, でもある, **人気のある** | all genuine compounds |
| できる | ことができる | genuine |
| いる | 悔いる, 陥る, 気に入る, 強いる, まいる, 手に入る, 報いる, 用いる, 率いる, 老いる | **all ten are false positives** |

**The card undercounts: it is five words, not four — 人気のある is missing from it.**

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

- である, ことができる, ことがある, でもある show no impossible forms.
- あっている is gone.
- The sweep count is recorded, so we know the real size of the set.
