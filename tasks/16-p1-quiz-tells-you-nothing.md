# P1 · The quiz does not tell you what to type, what you got wrong, or how long it is

**Status: unreviewed**

Three separate gaps from the beginner probe, grouped because they are one theme:
the drill withholds information the learner needs.

## 1 · Nothing says what kind of answer is expected

The input reads *"Type answer, Enter to submit."* The expected answer is **romaji**.
Nothing on screen says so. The tester guessed correctly and noted it was a guess.

Typing the kana itself is silently rejected. The word "romaji" appears exactly
once in the entire app, on the Practice page, which a beginner reaches by
wandering.

**Fix:** say what to type, in the placeholder or beside the box. It costs one
short line and it is only needed on day one, which is exactly when the app has
nobody to ask.

## 2 · A wrong answer teaches nothing

Getting it wrong produces a red flash and a shake. **No text. No "wrong". No
correct answer.** Just try again. The answer only appears after you have already
got it right.

The tester answered あ for お, which is a real and common confusion, and the app
said nothing about it — no comparison to what they typed, no note that あ/お/え
are a known confusable set. The app *has* confusable data and a "Things you mix
up" section on Progress; none of it reaches the moment it would matter.

**Fix:** on a miss, show what they typed against what was right. If the two are a
known confusable pair, say so. This is where the learning is supposed to happen
and currently nothing happens there.

Note this is separate from task 01, which is about the reveal printing the prompt.
Both need fixing; this one is about there being no feedback at all before the
reveal.

## 3 · No sense of how long a quiz is

No "question 3 of 12". The tester answered **18 times** without knowing whether
they were near the end. The retry drill *does* show "0 / 2", so the app already
has the idea and the inconsistency is visible within one session.

**Fix:** show position in the round, matching the retry drill's existing
treatment.

## Done when

- A learner on their first card knows what to type.
- A miss shows what was expected and, where known, why they confused it.
- The main drill shows position like the retry drill does.
