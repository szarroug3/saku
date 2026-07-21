# P0 · The accuracy pill punishes you for practising

**Status: in progress**

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
