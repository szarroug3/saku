# P0 · A correct romaji answer is marked wrong on grammar production

**Status: done** — merged to main as `9467e10`

## Outcome

Both halves fixed. `tabetekudasai` now grades true (it was the only one of four
spellings rejected); the varied-vehicle branch calls `checkProduces` on both
written forms instead of raw `===`, so katakana folding comes along too.

Live romaji conversion is keyed on **`answerIsJapanese(fact, dir)`**, not on
direction — direction was the wrong axis. Readings and productions convert;
meanings do not. Sam's condition was measured, not argued: zero jp2en cards can
be answered by typing the prompt, tested against the *converted* prompt as well
as the raw one. Grammar production is safe because `builtOn` refuses a recipe
that leaves the vehicle unchanged.

A property test over 589 recipe/vehicle pairs fails 2 of 7 on the pre-fix code
and passes 7/7 after — verified independently, so it genuinely covers the bug.

**Known and not a bug:** づ can only be typed `du`, never `zu`. The converter
resolves the ず/づ collision in favour of ず, exactly as real IMEs do. So 〜づらい
is unreachable via `zurai`.

## Open questions

- Should jp2en typed cards get live romaji-to-kana conversion? Without it, a learner with no Japanese keyboard cannot answer them at all. That is a design choice, not part of the bug, so I would fix the grading now and leave this to you.

Reproduced directly. This is the worst class of failure the app has: it tells a
learner they are wrong when they are right, and they have no footing to argue.

## Reproduction

Vehicle 食べる, pattern 〜てください. Correct answer 食べてください / たべてください.

```
WITH vehicle (what the drill sends)     WITHOUT (what every test sends)
  食べてください   -> true                   食べてください   -> false
  たべてください   -> true                   たべてください   -> false
  tabetekudasai -> FALSE  <<<             tabetekudasai -> false
  タベテクダサイ   -> false                   タベテクダサイ   -> false
```

## Cause

`src/lib/engine/question.ts:865-878`, the varied-vehicle branch:

```ts
const g = given.trim();
return g === built.form || g === built.kanaForm;
```

Raw string equality. It bypasses `checkJp2en` / `checkProduces`, so no romaji
folding and no katakana folding, while **every other subject forgives an all-kana
answer**.

The branch only fires when `ctx` carries a `grammarVehicle`. The drill always
sends one (`drill-screen.tsx:505`, ungated). **No test sends one.** The suite has
been exercising a branch the app never takes.

## It compounds

`drill-screen.tsx:944` sets `romajiInput = typedMode && q.dir === "en2jp"`, so a
**jp2en typed** card has no live romaji-to-kana conversion, and `:483` keeps jp2en
typed always typed.

A learner without a Japanese IME, in a jp2en typed session, types latin into a box
that grades every grammar production answer wrong, with no way to discover why.

## Fix

1. Route the varied-vehicle branch through `checkProduces`, exactly as the baked
   path does, so an all-kana target forgives a romaji spelling.
2. Add a property test that **always passes `ctx`**: for every producible recipe
   and every legal vehicle, the romaji spelling of the accepted kana form must
   grade `true`.
3. Decide separately whether jp2en typed cards should get live romaji conversion.
   Without it, a learner with no IME cannot answer at all. Worth Sam's ruling.

## Done when

- `tabetekudasai` grades true with the vehicle attached.
- A kanji-containing answer is still exact-match only (do not loosen that).
- The property test exists and passes `ctx` on every case.
