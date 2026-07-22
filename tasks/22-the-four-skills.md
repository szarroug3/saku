# The four skills — SCOPE RULED

**Status: merged, listening COPY IS DRAFT** — `fc35d1b`. Eddy voice fixed and two opt-in word listening types live. The labels are draft; LISTEN_SHARE and the direction-coupling are my calls, flagged for you.

## Sam's ruling, verbatim in effect

- **Speaking: OUT.** Not "later", not "a smaller version" — out. The app teaches
  you how to pronounce things; it does not test your pronunciation. The
  pronunciation notes stay exactly as they are and remain good.
- **Writing: OUT as a test.** Same shape. Stroke order is taught and stays taught.
  Nothing tests whether your handwriting matches.
- **Hearing: IN**, as new quiz types. Hear it, type what you heard in romaji; and
  hear it, give the definition.
- **Optional everywhere.** A setup option, never a requirement, never a gate.
- Otherwise the scope narrows.

So the honest claim becomes: **a reading, recognition and listening trainer that
teaches pronunciation without grading it.** That is defensible and it is close to
what the app already is. The Resources page continues to point elsewhere for the
rest.

## Sam asked: does this work for sentences?

**Your instinct is right, and for three reasons — words yes, sentences no.**

1. **Grading would break the app's own rule.** "Never mark correct Japanese wrong"
   is the standing constraint. Romaji transcription of a sentence is ambiguous in
   ways a single word is not: は as *wa*, へ as *e*, long vowels (ō / ou / oo),
   word spacing that Japanese does not have, and っ. Every one of those is a way to
   be right and be marked wrong.
2. **We do not have sentence audio.** The corpus is Tatoeba TEXT. A sentence read
   by text to speech gets the pitch accent and the phrasing wrong, and wrong
   prosody taught as a listening model is worse than no listening exercise.
3. **It is the wrong level.** Sentence dictation is an N3-ish exercise. Word-level
   listening is exactly N5.

**A sentence-level variant that WOULD work later**, if you want it: hear a
sentence, choose its meaning from options. That is recognition, not transcription,
so none of the three problems apply. Not proposed now.

## BLOCKER — fix this before building any of it

**All audio is OS text to speech, and "Auto" selects macOS's novelty voice `Eddy`**
(alphabetically first among `ja-JP`) over Kyoko or Otoya. The beginner auditor was
the first person in either audit round to actually listen.

Today that is embarrassing. **The moment listening is a graded quiz type it becomes
harmful** — the app would be teaching pronunciation from a joke voice and then
testing you on it.

Fix the voice selection first. It is cheap, it is independent of everything else
here, and it should land before a single listening question ships.

## The build, narrowed

Two new question types over EXISTING word facts. No new content authoring:

| type | prompt | answer | grading |
|---|---|---|---|
| hear → romaji | audio only | romaji of the word | the existing romaji path, which already forgives spellings |
| hear → meaning | audio only | the English gloss | same as the existing meaning check |

Both are word-only. Both are opt-in in setup. Neither gates anything.

**Reuses rather than invents:** the audio already exists on every word, the romaji
grading path was fixed in task 02, and `mcOnly` (widened in task 19) already
supports forcing a direction to multiple choice if typing proves too hard.

**One real design question left:** with audio as the prompt there is no glyph on
screen, so the reveal has nothing to show but the answer. Task 01's `revealFor`
handles that fine, but check the card does not look empty while the audio plays.

## Done when

- The default voice is a real Japanese voice, not `Eddy`.
- Two listening question types exist for words, off by default.
- The app's stated scope says reading, recognition and listening, and does not
  imply it will teach you to speak.
