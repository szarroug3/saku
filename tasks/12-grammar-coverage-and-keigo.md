# P2 · Grammar coverage, keigo, and pitch accent

**Status: Sam engaged — keigo and pitch directions below, awaiting final go**

## Sam's confusion resolved: "we have the words but aren't teaching them"

**We ARE teaching the words. We are not teaching the SYSTEM that connects them.**
Measured — the keigo verbs are all in vocab and taught as ordinary words:

| verb | plain equivalent | beginnerRank | in vocab? |
|---|---|---|---|
| 召し上がる | 食べる (honorific) | 824 | yes |
| いただく | 食べる/もらう (humble) | 863 | yes |
| おっしゃる | 言う (honorific) | 868 | yes |
| なさる | する (honorific) | 914 | yes |
| くださる | くれる (honorific) | 879 | yes |
| 申し上げる | 言う (humble) | 768 | yes |
| 伺う | 行く/聞く (humble) | 1229 | yes |

So a learner DOES meet 召し上がる and learns it means "eat". What they never learn:
that it is the honorific of 食べる, that いただく is the humble twin, and the RULE
for which to use when. It is isolated vocabulary with the relationships stripped
out — **exactly like transitivity**: 開く and 開ける are both in vocab as words, and
the transitivity TRACK is what teaches they are a pair. Keigo is the same shape.

**One real vocab gap:** いらっしゃる (the honorific be/come/go) is ABSENT from vocab.
It is arguably THE core keigo verb — いらっしゃいませ derives from it — so it needs
adding.

## Where keigo goes — REVISED after Sam's point (open it early)

Sam: *"if keigo is something you use every day, shouldn't it be used earlier?
should we open it up after a few words similar to grammar?"* **Agreed, and it
changes my earlier answer.**

The split that makes this work is recognition vs production:
- **Recognition comes immediately** — いらっしゃいませ is the first thing said to you
  in a shop, and 召し上がる / いただく are everyday. A learner should MEET these early,
  exactly as Sam says, so they are not baffled by the most common polite speech.
- **Production is the harder half** — choosing 召し上がる vs いただら correctly is
  N4-N3, and needs the plain verbs solid first.

So: **open a keigo track EARLY, after a handful of words, the same way grammar
opens on known words** — taught recognition-first (here is what いらっしゃいませ and
召し上がる mean, and that they are the polite form of a verb you know). The
production side (pick the right one) rides in later on the same track once the base
verbs are learned. Still modeled on the verb-pairs machinery; just gated early like
grammar rather than held to the end.

Fill the one gap: **いらっしゃる is missing from vocab** and is the core keigo verb.

## (earlier recommendation, now superseded) Where keigo goes

**A separate relationship track, modeled on the transitivity verb-pairs machinery,
placed AFTER transitivity.** Not before verb pairs. Reasons:
- Keigo is variants of verbs you must already know (食べる → 召し上がる), so it has to
  come after the plain verbs are solid.
- It is the same DATA SHAPE as transitivity: sets of related verbs plus a rule for
  which applies. The pairs machinery is the closest existing model, as this card
  already noted.
- Recognition comes free and early (the words are already taught); the SYSTEM is the
  track, and it is N4-ish, so it belongs late.

Scope: the 4-5 core honorific/humble sets (eat, say, do, go/come, give), plus the
です/ます polite layer if not already covered, plus filling いらっしゃる.

## Pitch accent — recommendation: DISPLAY, do not quiz (yet)

**We have zero pitch data.** Vocab fields are keb/reb/glosses/pos/newspaperBand/
align/beginnerRank — no pitch anywhere. Teaching it needs a NEW data source, same
shape as the KanjiVG/IDS ingests:
- **Kanjium pitch-accent database** is the standard free source (derived from the
  NHK発音アクセント辞典 + 大辞林, ~150k entries, the one Yomichan/Migaku use). Attach a
  pitch pattern to each vocab row.

**How to teach it, and the honest limit:** Sam is right that pitch is very hard to
unlearn, so early exposure matters. But the app has ruled speaking OUT (task 22) —
it does not grade the learner's voice. So:
- **DISPLAY pitch on every word card** — the standard notation (a line over the kana
  with the downstep mark: はし\ vs は\し). Low cost once the data is in, and it
  prevents the bad habit by showing the right pattern every time the word appears.
- **Do NOT quiz pitch production** — grading whether the learner SAID it right needs
  audio capture, which is the speaking feature that was ruled out. A "where does the
  pitch drop?" recognition question is possible later, but display-first is the
  honest, cheap start.

This matches how the app already handles pronunciation notes: it tells you the right
sound and trusts you, rather than grading your mouth.

## Grammar depth (the other half of this card)

Adding more grammar patterns means AUTHORING recipes (there is no dictionary of them
to import, unlike kanji/words). Ordering is already solved — JLPT level is on every
recipe. So the work is authoring, not ingest. Separate, larger, and Sam's call on
scope.

---

## Original answers (for reference)

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
