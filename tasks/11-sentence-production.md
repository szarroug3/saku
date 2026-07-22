# P2 · Sentence-level production

**Status: approved — both Assembly and Guided Substitution. Visuals drawn; build after Sam reviews the plates.**

## Sam's ruling, 21 July

**Build both shape 1 (Assembly) and shape 2 (Guided Substitution).** Translation-
with-a-tolerance-set and recognition-only are not being pursued.

## The plates (drawn for review)

Full-size kiri-theme mockups, real vocabulary, four screens:
**https://claude.ai/code/artifact/40918de5-c52f-41f0-bf4a-c9b762a36af7**

- **Assembly** — prompt and answered-right. "After eating, I go to school." The
  learner taps pieces (ごはんを · 食べてから · 学校へ · 行く) into order.
- **Guided substitution** — prompt and answered-right. "You know 食べてから. Now say
  it about 行く." Answer 行ってから.

### Design decisions made in the plates

- **Particles ride with their word** (ごはんを is one chip, 学校へ is one chip). So
  Assembly tests WORD ORDER, not particle choice, and grading stays unambiguous —
  one accepted order per set of pieces. Particle choice is task 09's job; keeping it
  out here avoids overlap and keeps the grade honest.
- **Both types grade against exactly one right answer**, which is the whole reason
  they can exist next to the "never mark correct Japanese wrong" rule. Assembly: one
  canonical order. Substitution: pattern + verb fixes the form, graded on the
  existing forgiving romaji check.
- Substitution deliberately drills the **irregular て-forms in a sentence frame**
  (行く → 行って), which nothing else does.

## Open questions for the build (shown on the last plate)

1. **Drag vs tap** for assembly pieces. Plates show tap.
2. **Corpus vs hand-authored** source for assembly items. Corpus needs task 04's
   filtering to have landed AND a known-words gate; a small hand-authored set is the
   safer start. My lean: hand-author a starter set, wire the corpus later.
3. Assembly authoring cost: each item needs its pieces chosen and its one canonical
   order pinned, inside the learner's known words.

---

## Original plan (for reference)
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
