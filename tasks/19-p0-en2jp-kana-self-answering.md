# P0 · The English to Japanese kana card answers itself

**Status: in progress**

## Open questions

- Forcing kana en2jp to multiple choice **removes the mnemonic-picture hint from that direction**, because hints are suppressed on MC boards. That is consistent (the picture would give the answer away on a six-option board) but it is a real loss, arguably in the direction where the picture helps most. Accept, or make an exception for kana?

**Found by Sam**, using the app. Reproduced and scoped.

## What happens

Sam's description: *"the quiz for english → japanese asks you how to type a in
japanese and then all i have to do is type a in the box and it converts to the
kana for me. i never have to actually answer anything."*

The input conversion is a red herring. **The grader itself accepts the prompt.**

```
kana あ
  jp2en: prompt shows "あ"
     typing "a"  -> true      (correct)
     typing "あ" -> false
  en2jp: prompt shows "a"
     typing "a"  -> TRUE      <<< you retyped the prompt
     typing "あ" -> true
```

Even with romaji-to-kana conversion turned off, typing the character on screen is
marked correct. The card tests nothing.

## Scope

**Kana only, but that is all 214 of them** — and kana is the entire first phase of
the app, the part every beginner spends longest in. Verified that the other
subjects reject the prompt correctly:

| card | prompt | typing the prompt back |
|---|---|---|
| kana あ | "a" | **ACCEPTED** |
| kana きゃ | "kya" | **ACCEPTED** |
| kanji 生 meaning | "life" | rejected, correct |
| word 先生 reading | "teacher" | rejected, correct |
| word 先生 meaning | "teacher" | rejected, correct |

## Cause

`kanaQuestions.check` routes the en2jp direction to `checkEn2jp`, which is
`checkProduces(glyphOfFact(fact), given)`. `checkProduces` forgives a romaji
spelling when the target is all kana.

That forgiveness is **correct and wanted** in general: a learner with no Japanese
IME must be able to type `kore` for これ. But on a kana card in the en2jp
direction the prompt *is* the romaji, so the same forgiveness makes the question
self-answering.

## This is the root of task 01, not a separate quirk

Task 01 records that the wrong-answer reveal prints `a = a`. That is the same
fact seen from the other side: in en2jp for kana, **the prompt and the accepted
answer are the same string**. Fixing one without the other leaves the pairing
incoherent.

## Fix

The en2jp kana card has to require the kana. Options:

1. **Reject romaji for this fact kind in this direction only.** Narrow and
   surgical: `kanaQuestions.check` on en2jp accepts the glyph, not a romaji
   spelling of it. Cost: a learner with no IME cannot answer at all, unless the
   input conversion is guaranteed on, which is currently
   `typedMode && dir === "en2jp"` and therefore is on exactly here. Check that
   holds before relying on it.
2. **Drop en2jp typed for kana** and ask it as multiple choice, where choosing あ
   from a board is a real recall test.
3. **Change what the card asks**, so the prompt is not the answer in another
   script.

Option 1 is smallest and preserves the direction. Confirm the IME-less path first.

## Done when

- Typing the prompt back on an en2jp kana card is rejected.
- A learner with no Japanese keyboard can still answer it.
- A test asserts, for every fact and direction, that the prompt is never an
  accepted answer. Pair this with task 01's reveal invariant; one test file can
  hold both.
