# P1 · The conjugation guard is too narrow, so four words show impossible forms

**Status: not started**

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
