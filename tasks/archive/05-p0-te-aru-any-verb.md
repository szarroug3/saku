# P0 · 〜てある is taught as attaching to "any verb"

**Status: done** — merged `ea522c8`. 9 of 16 vehicles left. An existing test
was asserting 行ってある graded true; the case builder now filters it. 〜ている
deliberately left unrestricted. Volitionality and animacy constraints left for Sam.

Sam asked: what does this mean?

## The Japanese, in plain terms

Japanese has two ways to say something is in a finished state, and which one you
use depends on whether a person did it:

- **〜てある** means *someone did this and it is still done*. It only works with
  verbs where a person acts on something. 書いてある = "it is written" (somebody
  wrote it).
- **〜ている** is what you use for things that just happen by themselves.
  開いている = "it is open".

So 〜てある attaches only to verbs where someone acts on an object. Verbs like
行く (to go), 死ぬ (to die), 来る (to come) describe something that just happens,
and **行ってある, 死んである, 来てある are not Japanese**. Nobody says them.

## What the app does

`/library/grammar/te-aru` states the rule as:

> **any verb** → て-form + ある

and gives as its lead worked example **行く → 行ってある**, which is ungrammatical.

Worse, the drill can serve any intransitive verb as the vehicle for this pattern
and will **grade the ungrammatical answer correct**.

## Why it happened

The app already knows which verbs are which. `isIntransitive` exists in
`src/lib/word-forms.ts`, and `transitivity.ts` holds 69 curated pairs. But the
grammar layer's `Vehicle` type carries no transitivity field, so the recipe has no
way to say "only transitive verbs" and the vehicle picker has no way to honour it.

## Fix

1. Add transitivity to the vehicle model, so a recipe can restrict which verbs it
   accepts.
2. Mark `te-aru` transitive-only.
3. Make the vehicle picker respect the restriction, so worked examples and drill
   items both come from the legal set.
4. Fix the rule text: it is not "any verb".

Check whether any **other** recipe has the same restriction before building this,
so the mechanism is designed once for the real set rather than for one pattern.

## Done when

- No worked example or drill item for 〜てある uses an intransitive verb.
- The stated rule matches what the pattern actually accepts.
- A test asserts no recipe can serve a vehicle it forbids.
