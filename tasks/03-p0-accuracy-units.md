# P0 · The accuracy pill punishes you for practising

**Status: done** — merged to main as `0d8c36b`

## Outcome

A perfect learner now reads **100% at 1, 2, 3, 5, 10 and 21 showings**. A session
snapshot saved before `firstTryCount` existed derives it from the old flag, so a
resumed run reads exactly what it read before the upgrade rather than NaN or a
false 0%. `mergeStats` went from zero assertions to seven tests.

**The pill was not the only site.** Two more had the identical unit error, and
the follow-up merged as `d603d4d`:

- `quiz-session.tsx:~723` writes the flag into `history.json`
- `summary.ts:~164` `runAggregate` is the end-of-run results ring

The crux found while scoping that follow-up: **`firstTry` serves two masters.**
`aggregate.ts:65` pools it as the durable ACCURACY numerator (wants showings, to
match the pill); `aggregate.ts:89` reads it as the spaced-repetition HIT, whose
one-per-session behaviour is **deliberate** — see the comment at `aggregate.ts:30-43`,
"the requeue is the app teaching you; it is not three independent tests". So the
fix splits the field rather than changing either meaning: `firstTry` is the count,
`firstTryHit` is the verdict. Scheduling verified bit-identical over a 500-session
replay, and re-deriving the hit from the count fails 3 tests.

The ring and the durable record were both **50 points adrift downward** (29% where
the pill read 79%). All three readers now agree.

## Decision

**Sam ruled: option A.** Add a `firstTryCount`, so both sides of the ratio count
showings. Repetition is kept, and the live pill agrees with the stored aggregate.

This also settles task 18's open question — **the app counts showings, not facts** —
so the end-of-round summary numbers must use showings as their denominator too.

Sam asked: what is the effect, and what is the fix?

## The effect, in one table

A learner who gets **everything right on the first try, every single time**:

| the same fact has been shown | accuracy displayed |
|---|---|
| once | 100% |
| twice | **50%** |
| three times | 33% |
| four times | **25%** |

Endless mode repeats facts by design, so the longer a perfect learner practises,
the worse their score looks. The number is not merely wrong, it is wrong in the
direction that discourages the exact behaviour the app wants.

## Cause

`src/components/quiz/drill-screen.tsx:324`, `liveAccuracy`:

```js
agg.seen     += st.seen;                                // per SHOWING (a count)
agg.firstTry += st.firstTryCorrect === true ? 1 : 0;    // per FACT (max 1, ever)
```

Two different units in one ratio. `seen` counts how many times a card was shown.
`firstTryCorrect` is a single boolean per fact for the whole session, so it can
contribute at most 1 no matter how many times that fact appeared.

`src/lib/accuracy.ts:26` states the invariant this breaks:

> A FACT's accuracy is a RATIO. firstTry / seen, **both counted over the same
> showings**.

## Suggested fix

The numerator has to become a count, not a flag. Two options:

**Option A, preferred: count first-try-correct showings.** Add
`firstTryCount: number` to the per-fact session stat, incremented on each showing
answered right with `tries === 0`. Then `agg.firstTry += st.firstTryCount` and
both sides of the ratio are showings. `firstTryCorrect` stays as it is for the
results boards, which legitimately ask the yes/no question "did you ever nail it".

**Option B, cheaper but lossier: count facts on both sides.** `agg.seen += 1` per
fact rather than per showing. Correct arithmetic, but it throws away repetition
entirely, so a fact drilled ten times counts the same as one drilled once. That
makes the live pill disagree with the stored aggregate, which is worse.

Take A.

## Also worth doing while here

`session.mergeStats` (`src/lib/session.ts:203-222`) merges these stats and has
**zero assertions**, despite its own docstring calling `firstTryCorrect` the
number that "has to stay honest". Whatever shape the fix takes, pin it there.

## Done when

- A perfect learner reads 100% regardless of how many times a fact repeats.
- Live pill and stored aggregate agree.
- `mergeStats` has assertions on the numerator.
