# The four skills — the strategic finding, needs a decision not a fix

**Status: needs review**

## Open questions

- **This is a scope decision, not a fix.** Narrow the claim to reading and recognition, add listening, or add speaking? Nothing gets built until you rule.
- If nothing else changes, option 1 (narrow the claim) is cheap and honest, and the Resources page already does this for other gaps.

Sam's brief for the audit set the goal as **fluency in reading, hearing, speaking
and writing**. Both the beginner probe and the Japanese auditor answered that
question independently, and they agreed.

> **No. This app alone could not make me fluent, and it isn't close.**

This is not a bug list. It is a scope decision, and it is the largest open
question in the project.

## Where each skill actually stands

### Reading — plausibly, up to a point
The strongest of the four. 214 kana, 2,136 jōyō kanji with 3,496 reading facts,
12,553 words, 81 grammar patterns. The Japanese auditor put the ceiling at
**roughly JLPT N4, edging N3 on kanji and vocabulary breadth**.

Could read: graded readers, manga with furigana, menus, signage, train
announcements, simple email. Unusually, could *decode* almost any kanji met, since
the set is full jōyō rather than an N5/N4 subset.

Could not read: newspapers, novels, business Japanese. See task 12 for the grammar
and keigo gaps that cap this.

### Hearing — no
Operating-system text to speech, one character or one word at a time. **No
connected speech, no natural audio, no listening exercises, no dictation.**

The beginner probe: *"You could learn roughly what a syllable sounds like. You
could not learn to understand spoken Japanese."*

It also could not tell whether the audio was working: no waveform, no visual
confirmation, and on a machine without a Japanese voice installed there is no
signal at all. **Nobody in this audit round could hear a clip**, so audio quality
is entirely unverified. That matters for を specifically (see `TEST-FINDINGS.md`).

### Speaking — nothing at all
**No microphone, no recording, no pronunciation feedback, no prompt to say
anything aloud.** The single largest gap.

Sharpest detail: the pronunciation notes are genuinely good coaching — *"Japanese
う is flatter than English 'oo'. Don't purse your lips"*, *"No glide. It's 'eh,'
not 'ay.'"* — and there is **no way to check yourself against any of it**. The app
tells you how to make the sound and then never listens.

The Resources page lists eight other tools and **suggests nothing for speaking or
listening.**

### Writing — taught, then discouraged, with no feedback
Stroke order sits behind a collapsed panel headed *"We don't recommend learning to
write early."* Expanded, it is good: numbered strokes, real animation, now covering
all 2,136 kanji.

But there is **no way to write anything and get feedback** — no canvas, no
tracing, no handwriting recognition. You can watch the correct stroke order and
never find out whether yours matches.

## The decision, and it is Sam's

Three honest positions:

1. **Narrow the claim.** Be explicit that this is a reading-and-recognition
   trainer, and point elsewhere for the rest. The Resources page already does this
   for grammar and kanji, and the beginner probe called that page *"the most
   trustworthy thing in the product"*. Cheapest, and defensible.
2. **Add listening.** The most tractable of the three gaps, because the corpus and
   the audio pipeline both already exist. Dictation from a sentence is a real
   exercise and it is gradeable, which speaking is not.
3. **Add speaking.** Hardest. Needs microphone capture and pronunciation scoring,
   and the app's own rule is that it must never mark correct Japanese wrong — a
   standard that is very hard to meet on pronunciation.

**If nothing else changes, do 1.** The gap between what the goal implies and what
the app does is currently invisible to a learner until they have spent weeks in it.

## Related

Task 11 (sentence-level production) is the reading-side version of this same
problem: recognition ceiling well above composition ceiling.

## Done when

Sam has ruled on scope. Nothing to build until then.
