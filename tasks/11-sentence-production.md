# P2 · Sentence-level production — plan only, do not build yet

**Status: needs review**

## Open questions

- Which of the four shapes: assembly, guided substitution, translation with a tolerance set, or stay recognition-only and say so? **Plan only, do not build from this file.**

Sam: *"add a task to plan work for this."*

## The gap, as the Japanese auditor put it

> The app drills characters, words, and single patterns attached to single
> vehicles, never a whole sentence. **Recognition ceiling is well above
> composition ceiling.**

Today the largest thing a learner is ever asked to produce is one pattern on one
verb: 食べる → 食べてから. They are never asked to assemble a sentence, and never
asked to choose between two patterns in a real context beyond the cloze items.

So a learner finishing everything can *recognise* a great deal and *produce* very
little. That gap widens the further they get, because vocabulary and kanji keep
growing while production stays at one pattern.

## Why this is a planning task, not a build task

It is the largest open design question in the app, and it collides with several
decisions already made:

- **The app grades.** A sentence has many correct forms. The project has already
  ruled, twice and correctly, that it must never mark correct Japanese wrong
  (the は/が cloze was killed for exactly this). Free-form sentence production
  cannot be graded the same way a character can.
- **The corpus is the obvious source** and it is currently mislabelled (task 04)
  and mostly above a beginner's level (measured: two thirds of cloze sentences use
  a word past beginner rank 2000).
- **The known-words gate exists** and would have to apply here too, or a
  production prompt will use words the learner has never met.

## Shapes worth drawing before committing

1. **Assembly rather than free text.** Give the pieces, ask for the order. Gradeable
   without judging free-form Japanese, and it teaches word order, which nothing
   currently does.
2. **Guided substitution.** "You know 食べてから. Now say it about 行く." Small step
   up from what exists, reuses the vehicle machinery.
3. **Translation with a tolerance set.** Highest value, hardest to grade honestly.
   Would need an accepted-answers set per item, which is authoring, not generation.
4. **Recognition-only, and say so.** A legitimate answer: keep the ceiling where it
   is and be explicit that composition is what you take elsewhere. The Resources
   page already does this for other gaps.

## Next step

Draw these as plates, in kiri, against real data. **Do not dispatch a build from
this file.**
