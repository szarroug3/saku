# P1 · The quiz does not say what to type, name a confusion, or show how long it is

**Status: done** — merged `36e421f`. Per-kind answer guidance, a confusion note at the reveal, and a prominent x/y (or "endless").

Three gaps from the beginner probe. **Sam's review cut one of them and reframed
another**, because the probe reported absences that are really settings and
placement. What is actually left is smaller and more specific than the original
card claimed.

## 1 · Nothing says what kind of answer is expected

The input reads *"Type answer, Enter to submit."* The expected answer is romaji.
Nothing on screen says so. The tester guessed correctly and noted it was a guess.
The word "romaji" appears exactly once in the app, on Practice, which a beginner
reaches by wandering.

**Sam's ruling: add instructions for each question type, wherever they are
missing.** Not one global line — the card kinds do not ask for the same thing.
Since task 02 landed, what a card accepts varies by kind and direction:

| card | what the box wants |
|---|---|
| kanji reading, word reading, grammar production | romaji, converted live to kana as you type |
| kana en2jp | multiple choice, no box at all (task 19) |
| kanji meaning, word meaning, grammar meaning | English, typed literally |

So the instruction has to be per (kind, direction), and it should follow the same
predicate the input already uses — `answerIsJapanese(fact, dir)` in
`src/lib/engine/question.ts` — rather than a second hand-maintained list that can
drift from it.

## 2 · A miss does not name a known confusion

**The original card said a wrong answer shows no correct answer. That is wrong,
and this is the corrected version.**

Verified: `cfg.showAnswer` defaults to **true** (`src/lib/quiz-config.tsx:46`) and
is labelled *"Show the answer when you run out of goes"*. The reveal fires on
`cfg.showAnswer && rt.waiting && feedback.kind === "bad"` — and `rt.waiting` only
becomes true once retries are exhausted. `retryN` defaults to 2, so **two wrong
answers exhausts your goes**. The tester almost certainly got it right on their
second go and so never reached the reveal.

**The shake and the red ring are the wrongness signal, by design.** No "Wrong"
text is wanted. Sam: *"the screen shake and red ring are what tells you you got
it wrong."* The original card's complaint about missing feedback text is
**dropped**.

What genuinely is missing: the tester answered あ for お, a real and common
confusion, and nothing said so. The app has confusable data (`src/lib/confusions.ts`)
and a "Things you mix up" section on Progress, and none of it reaches the moment
it would matter.

**Sam's ruling: once they have exhausted retries, if it is a known confusion, say
so.** Scoped to the reveal moment — not on every miss, not while goes remain.

**Depends on task 01.** The reveal currently prints the prompt back (`a = a`), so
adding a confusion note to it would decorate a broken line. Task 01 first.

## 3 · No sense of how long a quiz is

The tester answered **18 times** without knowing whether they were near the end.

**The pill exists — it is just not on the drill screen.** `QuizProgress`
(`src/lib/quiz-session.tsx:135`) is `{done, total}`, and `drill-screen.tsx:413`
already keeps it current: `setProgress({ done: rt.resolved, total: limited ? rt.deck.length : null })`.
It is rendered as a **sidebar** chip, via `current-sessions.tsx:74`:

```ts
return p.total !== null ? `${p.done} of ${p.total} answered` : `${p.done} answered`;
```

So a learner focused on the drill never sees it. The data is right and the wiring
is done; only the placement and the prominence are wrong.

**Sam's ruling, two parts:**

- **Limited quizzes:** surface the existing `x / y` on the drill itself, and make
  it more prominent than the sidebar chip.
- **Endless quizzes:** say so explicitly. `total: null` currently degrades to a
  bare count ("18 answered"), which reads like a progress number whose total went
  missing rather than a deliberate "this does not end". Display that it is
  unlimited.

## Open questions

- How prominent for the limited pill? A header count, or something closer to the
  card? Sam said "maybe we could make it more prominent" — a preference, not a
  spec.
- Does the confusion note also belong on the grid and pairs screens, or drill
  only? Their miss handling differs (`grid-screen.tsx:147`).

## Done when

- Every typed card kind says what it wants, driven by `answerIsJapanese` rather
  than a parallel list.
- Exhausting your goes on a known confusable pair names the confusion.
- The drill shows `x / y` when limited, and says "unlimited" when endless.
