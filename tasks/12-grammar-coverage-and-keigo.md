# P2 · Grammar coverage, keigo, and pitch accent — Sam's questions answered

**Status: needs review**

## Open questions

- Narrow the app's claim to reading and recognition, or expand? See task 22, which is the same decision at a larger scale.
- Add keigo? It is a system, not vocabulary, and the verb-pairs machinery is the closest existing model.
- Pitch accent: out of scope and said so on the Resources page, or in scope for common words?

## "Can we import more grammar? How would we determine difficulty order?"

**Not the way words and kanji were imported.** That is the key difference.

- Kanji came from KANJIDIC2, words from JMdict, sentences from Tatoeba. Those are
  bulk dictionaries; the app ingests them and sorts by frequency.
- **The 81 grammar patterns are hand-authored recipes.** Each one carries a build
  rule the conjugation engine can execute, the hosts it attaches to, worked
  examples and a gloss. There is no dictionary of those to import. Adding patterns
  means authoring recipes.

**Ordering is the easier half.** JLPT levels already exist on every recipe
(`r.level`, currently N5 and N4). The app deliberately never *shows* the level —
that decision is argued at length and is correct, since a learner cannot act on
"N4" — but nothing stops it being used internally to sequence new material, the
way `beginnerRank` sequences words. So the ordering question is already solved;
it is the authoring that is the work.

## "Is it possible we've given the user enough to learn by experience?"

Genuinely arguable, and I think **partly yes**. The learner finishes with all
2,136 jōyō kanji, 12,553 words and N5+N4 grammar. That is enough to read graded
material and start learning from context, which is how people actually get past
N4.

The honest counter is that the two things that *stop* someone reading real
Japanese at that point are not vocabulary:

- **Grammar depth.** 〜わけだ, 〜において, 〜に違いない, and complex nominalisation
  are structural. You cannot guess them from context the way you can guess a noun.
- **Keigo.** Below.

So: enough vocabulary to learn by experience, not enough structure.

## "Keigo — I'm assuming this means normal business like restaurants?"

Close, and it is bigger than that. **Keigo is the politeness system**: how Japanese
changes shape depending on who you are talking to and who you are talking about.
It has three modes — polite, honorific (raising the other person), and humble
(lowering yourself) — and it changes the verbs themselves, not just the tone.

食べる becomes 召し上がる when the other person eats, and いただく when you do.

You meet it immediately in any shop, restaurant, station or workplace, and
**いらっしゃいませ is the first thing said to you when you walk into a shop.** The
app currently has that as a vocabulary word (it is in the first twenty on the
words shelf) with no explanation of what it is.

Adding it would be a real feature: a set of verb pairs plus the rule for when each
applies. The verb-pairs machinery built for transitivity is arguably the closest
existing model.

## "No pitch accent anywhere — what does that mean?"

Japanese distinguishes some words by **pitch**, not stress. 箸 (chopsticks) and 橋
(bridge) are both *hashi*; they differ in whether the pitch falls after the first
or second syllable.

It is not like English stress. Getting it wrong rarely makes you
unintelligible — context usually saves you — which is why most courses skip it, and
why skipping it is defensible. But it is why a learner can be word-perfect and
still sound distinctly foreign, and it is very hard to add later once habits set.

The app teaches pronunciation carefully in other respects (*"Japanese う is flatter
than English oo. Don't purse your lips"*), so the omission is notable rather than
sloppy. **Decision for Sam:** out of scope and say so on the Resources page, or in
scope for common words.

## Nothing here is scheduled

All three are open questions, not queued work.
