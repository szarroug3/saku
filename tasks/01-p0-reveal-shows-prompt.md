# P0 · The wrong-answer reveal shows the prompt back

**Status: not started**

Found independently by three agents. Reproduced directly.

## What a learner sees

Get a card wrong in the English to Japanese direction, press Enter for the
answer, and the app shows you the question again:

| card | reveal |
|---|---|
| kana あ | `a = a` |
| kana し | `shi = shi` |
| kanji 生 meaning | `life = life` |
| kanji reading | `い read this way in 生かす = い` |
| word 先生 meaning | `teacher in japanese = teacher` |

**1,108 of 1,200 sampled showings** reveal the prompt. It fires on typed and
multiple-choice alike, because the reveal sits outside the `q.mc` fork.

The learner who could not produce the answer is shown the question again and
never told what it was. This is the single moment the app exists for.

## Cause

`src/components/quiz/drill-screen.tsx:1213-1226`:

```jsx
<span className="text-lg text-text">{prompt.glyph}</span>
...
{questionsFor(q.f).answerReveal?.(q.f, q.dir, ctx) ?? factInfo(q.f)?.answers[0] ?? ""}
```

`answerReveal` is implemented by **`grammarQuestions` alone**
(`src/lib/engine/question.ts:987`). Kana, kanji, word and transitivity fall
through to `answers[0]`, which in the en2jp direction **is the prompt**.

The grammar override exists because this exact fault was found and fixed there;
its own comment names it ("printed 'decide to X pattern = decide to X'"). The fix
was never generalised.

## Fix

Do **not** add `answerReveal` to four more subjects. That repeats the mistake and
leaves the next subject exposed.

Extract the composition into a pure function in `src/lib/engine/question.ts`:

```ts
export function revealFor(fact: FactId, dir: Direction, ctx?: PromptContext): string
```

It returns what the drill should print. `drill-screen.tsx` calls it and nothing
else. Then a table-driven test asserts, for **every fact and both directions**:

    revealFor(f, dir, ctx) !== promptFor(f, dir, ctx).glyph

That kills the class rather than one subject at a time, and converts the
highest-impact untestable line in the app into a testable one.

## Done when

- Every subject reveals the answer, not the prompt, in both directions.
- The invariant above is asserted over all facts.
- The three `test.fail()` specs in `feat/e2e-tests` start passing.
