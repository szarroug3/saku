# P1 · Three kana are read differently when used as particles

**Status: needs review**

## Open questions

- Approve the draft card copy in this file before it is built.

Sam asked: *"i know the kana for ha. i didn't know you can read it as wa. is that
something we should be teaching as a rule somewhere or is it specific to this
character? is this grammar?"*

## The answer

**It is a rule, not a quirk of は, and it covers exactly three characters:**

| kana | normally | as a particle | example |
|---|---|---|---|
| は | ha | **wa** | 私**は** = watashi **wa**, "as for me" |
| へ | he | **e** | 学校**へ** = gakkou **e**, "to school" |
| を | wo | **o** | パン**を**食べる = pan **o** taberu, "eat bread" |

A particle is a little word that marks what job the word before it is doing. When
these three kana are doing that job, they are pronounced differently from their
normal reading. Everywhere else they keep their usual sound.

**Is it grammar?** It sits on the boundary. Particles themselves are grammar, but
this is a *reading* rule, and you need it on day one — 私は is one of the first
things anyone learns to say. Waiting for the grammar track means a learner reads
私は as "watashi ha" for weeks and has to unlearn it.

## What the app does now

- を's card **does** teach its particle function, and says it "sounds exactly like
  お" (though the prominent line still teaches "wo" — see `TEST-FINDINGS.md`).
- **は has nothing.** Grepped `characters.ts` NOTES, `phase-intros.ts` and
  `why.ts`: no mention that は can be read wa.
- **へ has nothing.**

Because を's card explains its particle role, the silence on は and へ reads as
"there is nothing to say about those", which is the wrong signal.

## Suggested fix

Teach it once, as one rule, covering all three. It fits naturally as a card in the
writing-rules shelf, since it is a rule about writing rather than a character to
learn, and it can fire early — right after the kana that carry it are known.

Draft copy, for approval:

> **Three kana change their sound when they do a job.**
>
> は is normally *ha*, but when it marks the topic of a sentence it is read *wa*:
> 私は is "watashi wa".
> へ is normally *he*, but when it points somewhere it is read *e*: 学校へ is
> "gakkou e".
> を is only ever used for this job, and it is always read *o*.
>
> Everywhere else, they keep their usual sound. You will meet 私は on your first
> day, so this one is worth knowing early.

## Done when

- The rule is taught once, covering all three characters.
- は and へ carry a note, as を already does.
