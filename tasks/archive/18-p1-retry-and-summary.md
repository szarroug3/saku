# P1 · Retrying successfully leaves no trace, and the summary arithmetic is wrong

**Status: done** — merged `a53a94e`

## Outcome

Root cause was deeper than this card: `roundStats` merges across legs and is
lossy about *when*, so "missed cold, nailed on the retry" and "missed cold, never
re-asked" were the same three numbers. A new `StudySession.recovered` folds once
per leg. Landing on the *second* attempt of a retry deliberately does not count.

Arithmetic is now all showings, with the third number a subtraction rather than a
third independent tally: `needAnother = total - firstTry`. The five-card lesson
reads "7 questions · 5 right first try · 2 needed another look".

**"missed" became "needed another look"** in that header — a hint-assisted answer
and a second-attempt answer both land there and neither is a miss. Flagged for Sam
as a voice change made on their behalf.

**Still open, needs Sam:** `summariseRound` counts FACTS, and
`session-complete.tsx` prints "You finished on N right first try" using it. Same
phrase as the round header, different unit. Converting it has a design question
attached: more retry legs accrue more first-try showings, so it would reward
retrying rather than improving.

## Open questions

- ~~Shares one decision with task 03: does the app count showings or facts?~~
  **Settled — Sam ruled option A on task 03: the app counts SHOWINGS.** The
  summary's "right first try" must therefore count first-try-correct showings,
  not unique facts, which is exactly the 4 + 2 = 6-from-5 discrepancy below.
- Still open: what a successful retry should do to the missed set — shrink it, or
  leave it and acknowledge the retry outcome separately?

Two findings from the beginner probe, both about the end-of-round screen.

## 1 · A successful retry changes nothing on screen

The tester finished a round with two misses. The retry screen offered *"Pick what
to retry"* with both misses pre-selected — good design. They retried both and got
**both right**.

They were returned to the **identical screen**: still "2 missed", still both
pre-selected, still offering "Retry 2".

There was no acknowledgement that the retry happened or that it went perfectly.
The tester's words: *"My perfect retry round left no trace."*

This is demotivating in the exact moment the app should be rewarding, and it makes
a learner doubt the app is registering their answers at all — which, given task 15,
it may genuinely not be.

**Fix:** the retry result has to feed back into the round summary. Either the
missed set shrinks, or the screen acknowledges the retry outcome. Decide which,
but the current state where a perfect retry is indistinguishable from not having
retried is not defensible.

## 2 · The summary arithmetic does not add up

Reported after a five-card lesson:

> **"5 questions · 4 right first try · 2 missed"**

4 + 2 = 6, from 5 questions.

The two numbers are probably counting different things — "right first try" over
unique facts, "missed" over showings, which is the same units confusion as task 03
— but a learner cannot know that, and it is the second number on that screen they
cannot trust.

**Fix:** make both counts use the same denominator, and make them sum to the
stated total. If they genuinely measure different things, label them so.

## Related

This is the same family as task 03 (the accuracy pill mixing showings and facts).
Worth fixing together, since a single decision about what the units are would
settle all three numbers.

## Done when

- A perfect retry visibly changes the round summary.
- The summary numbers sum correctly, or are labelled so their difference is
  explicable.
