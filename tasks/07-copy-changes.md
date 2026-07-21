# Copy changes — awaiting Sam's approval

**Status: needs review**

## Open questions

- Everything below is approved except the final go-ahead to apply it. Say when.
- One item still open: `WHY_STROKE_ORDER`'s first paragraph duplicates the one you hand-wrote in `WHY_WRITING_EARLY`. **I recommend cutting it entirely** rather than trimming, since that panel's other two paragraphs stand alone.

Every item: the exact current text, what it is and where it appears, what is wrong
with it, and a proposed replacement. **Nothing here is applied yet.**

Voice target, from Sam: *"i don't want the app to feel like AI is teaching you. i
want it to feel like you're reading from someone who has gone through this."*

Mnemonic content (ま, と, サ, を, ア, め) is **excluded** — that is in-progress
authoring, to be reviewed as a set when finished.

---

## A · Factual errors

### A1 · The alphabet claim
**`src/components/lesson/next-word-lesson.tsx:50`** — shown on the words track
card when a word is waiting on kanji.

> **Now:** "In English, you cannot learn words until you first learn the alphabet.
> This follows the same idea: learn the pieces first, then the words built from
> them."

Wrong: children learn spoken words years before the alphabet, and you can learn
written words by sight. It also contradicts `why.ts:236`, which correctly says
kana-only words can be learned straight away.

Sam's intent was the building-materials idea, which is sound; it just needs to be
about kanji rather than about English.

> **Proposed:** "A word written with kanji you have not met is just shapes. So a
> word waits until you know the kanji inside it, and then it arrives ready to
> read."

### A2 · Transitivity tails written in kana
**`src/data/phase-intros.ts:649, 653, 655, 661-673`** — the verb-pairs intro,
rendered in the paragraph, the example glosses and the table.

> **Now:** "the swap is usually one of a few: **-ある to -える**, -る to -す, or
> **-う to -える** cover most of them."
> Glosses: `-ある → -える` (始まる → 始める), `-る → -す` (直る → 直す),
> `-う → -える` (開く → 開ける).

Those are romaji vowel rules (hajim-**a**-ru → hajim-**e**-ru) printed as kana.
There is no ある in はじまる and no う in あく. Only the 直る/直す row is correct as
written. Knowing kana does not help; it actively misleads, because the learner
hunts for characters that are not there.

Simplest true fix: name the shift with the kana that actually change.

> **Proposed text:** "Most pairs share a kanji and swap only the kana on the end.
> The usual shifts are まる→める, る→す, and く→ける. Naming the shift helps you
> remember a pair, but it never tells you which verb is which, and some pairs
> follow no rule at all."
> **Proposed glosses:** `まる → める` · `る → す` · `く → ける`

### A3 · Okurigana card names the readings as the tails
**`src/data/phase-intros.ts:573`**

> **Now:** "生 on its own can be read several ways, and the kana after it decides
> which. 生きる takes **い**, 生まれる takes **う**: same character, different
> tail, different sound."

い and う are the *readings of 生*, not the tails. The tails are きる and まれる, as
the example rows directly below correctly show. A beginner will look for an い
inside きる.

> **Proposed:** "生 on its own can be read several ways, and the kana after it
> decide which. In 生きる the tail is きる and 生 is read い. In 生まれる the tail
> is まれる and 生 is read う. Same character, different tail, different sound."

### A4 · The door sentence
**`src/data/phase-intros.ts:641`**

> **Now:** "...'The door opened' and 'I opened the door' use different verbs."

Those two *English* sentences use the same verb. The Japanese ones differ. As
written it says the opposite of what is meant — and the real point, that English
gives you no clue, is stronger.

> **Proposed:** "...English reuses one word for both: 'The door opened' and 'I
> opened the door' are both 'open'. Japanese uses 開く and 開ける."

### A5 · Small ya/yu/yo overstated
**`src/data/phase-intros.ts:247`**

> **Now:** "A full-size kana followed by a small や, ゆ or よ is one syllable, not
> two. The two are said together, in a single beat, not as two separate kana."

Only い-column kana take these. As written, かゃ looks possible. `marks.ts:248`
already gets this right, so the app contradicts itself.

> **Proposed:** "Only the い-column kana take these: き, し, ち, に, ひ, み, り and
> their voiced partners. き with a small ゃ is one sound in one beat, kya, not
> two."

### A6 · Voicing described in opposite directions
**`src/data/phase-intros.ts:207`** and **`:519`**

> **Now (207):** "It voices the consonant, meaning your vocal cords buzz, turning
> the sound into its **harder-edged** partner."
> **Now (519):** "The second half reads as it always does, **one consonant
> softer**."

*What this is:* dakuten, the two dashes that turn か into が. Neither "harder" nor
"softer" is a real property — they are opposite guesses at the same change, on two
different cards. The accurate part is already there: your vocal cords buzz.

> **Proposed (207):** "It voices the consonant: your vocal cords buzz. か becomes
> が, さ becomes ざ, た becomes だ, は becomes ば. Put a finger on your throat and
> say ka, then ga. The second one hums."
> **Proposed (519):** "The second half takes the same voicing you know from
> dakuten. You will see it constantly in compounds from here on."

### A7 · The iteration mark contradicts itself
**`src/data/phase-intros.ts:476-477`**

> **Now (lead):** "It repeats the character, not the reading."
> **Now (text):** "**The copy** is read like the second half of a compound, which
> often uses rendaku so that 人々 is "hito-bito", not "hito-hito"."

The lead says the reading does not repeat; the next line explains that it does,
with voicing. Also "The copy" reads as *the app's copy* on a page that is itself
copy.

> **Proposed (lead):** "It stands in for the character before it."
> **Proposed (text):** "人々 is 人 written twice, and you read it as though it were
> written out. The second half usually picks up the same voicing as dakuten, so it
> is ひとびと, hito-bito, not hito-hito."

---

## B · Product jargon

The app stops talking about Japanese and starts describing itself. Worst cases are
`lede.rest` strings, which are **always on screen, unopened**.

### B1 · `src/data/why.ts:220` — APPROVED by Sam
> **Now:** "Once you've learned all the kanji required for a set of words, the word
> set will be unlocked as a separate Word track. Because of this, it may be a while
> before you unlock the next set of words. By default, we use commonality for
> ordering but this can be updated in the settings."
>
> **Approved:** "A word is only taught once you know every kanji in it, so words
> arrive in bursts: nothing for a while, then several at once."

### B2 · `src/data/why.ts:223`
> **Now:** "Kanji carry meaning and are reused across many words, so learning one
> kanji can unlock several words at once. This makes the word track inconsistent.
> Sometimes it will have a lot of content while other times, it will be locked for
> a long time."

> **Proposed:** "Kanji are reused across many words, so learning one can open up
> several at once. That makes the pace uneven. Some days you will have a pile of
> new words, some days none, because you are still collecting the kanji they
> need."

### B3 · `src/data/why.ts:225`
> **Now:** "The words track waits for complete sets so new word lessons open with
> material you can actually understand. By default, we use commonality ordering, so
> the most common useful material is prioritized first. You can change this in the
> settings menu."

Restates B1 and B2, and ends on settings for the third time.

> **Proposed:** "Words wait for their full set of kanji, so when one arrives you
> can actually read it. The most common ones come first."

### B4 · `src/components/lesson/next-grammar-lesson.tsx:58` — Sam's own wording
> **Now:** "A pattern unlocks once you've learned a word it can attach to."
>
> **Proposed (Sam's):** "Grammar needs words to apply to. Until you know a verb to
> practise with, you can't learn the verb ending."

### B5 · The remaining lock lines
> **`next-grammar-lesson.tsx:62` now:** "Learn a word of the needed type on the
> words track, and this grammar lesson unlocks."
> **Proposed:** "Learn a verb on the words track and this grammar lesson opens."

> **`next-grammar-lesson.tsx:120` now:** "Learn X to unlock the next grammar
> lesson."
> **Proposed:** "Learn X and the next grammar lesson opens."

> **`next-word-lesson.tsx:47` now:** "We wait until the complete set of kanji are
> learned for the word set before unlocking it." (also a subject-verb error)
> **Proposed:** "A word waits until you know every kanji in it."

Other instances to sweep with the same treatment: `settings-card.tsx:395`,
`claim-explainer.tsx:110` ("knowledge base"), `phase-intros.ts:593`, `:649` tail.

**Not** flagged, deliberately: "session", "deck", "pool", "item" on Practice,
Current and Lists. Those are control surfaces and the words are honest there.

---

## C · Craft

### C1 · Progress page subtitle — the X-not-Y tic
**`src/app/stats/page.tsx:74`**

> **Now:** `sub="Where you are. Not how you're doing."`

> **Proposed:** "How much you have covered so far."

### C2 · Say it will be hard
**`src/data/phase-intros.ts:251`**

> **Now:** "きゃ, with the small ゃ, is "kya". きや, with a full-size や, is "kiya":
> two separate sounds, two beats. Side by side the difference is obvious; on its
> own, look at the height."

> **Proposed:** append — "You will misread a few at first. That is normal, and it
> stops once you have seen enough of them."

### C3 · The one place the app calls a hard thing easy
**`src/data/phase-intros.ts:644`**

> **Now:** "In English you can always hear the difference: whether something acts
> on its own, or someone acts on it."

Transitive/intransitive pairs are a multi-year sticking point, and this also
contradicts the A4 fix, which correctly says English reuses one word.

> **Proposed:** "You will get these backwards for a while. English gives you no
> help here, because 'open' does both jobs. Expect to mix them up, and expect that
> to sort itself out with time."

---

## E · Items from the audit not yet ruled on

These were reported but had no proposal. Adding them so nothing is lost.

### E1 · Two cards contradict each other about verb pairs
**`src/data/why.ts:258`** vs **`src/data/phase-intros.ts:648`** — both shown to the
same learner.

> **why.ts:258:** "**There is no rule that builds one verb from the other**, so
> each pair is learned as a pair."
> **phase-intros.ts:648 (lead):** "**The endings often shift in familiar ways.**"

Both cannot be true as stated. The accurate position is the second one plus a
caveat: the shifts are real and common, they just do not tell you *which* verb is
which, and some pairs follow no pattern.

> **Proposed (why.ts:258):** "The endings shift in familiar ways, but the shift
> never tells you which verb is which, and some pairs follow no pattern at all. So
> each pair is learned as a pair."

### E2 · "forty-six kana can spell any Japanese word"
**`src/data/why.ts:70`**

> **Now:** "There are about forty-six of them, and together they can spell any
> Japanese word out loud."

Not without dakuten and the small kana, both of which the same curriculum teaches
later. As written it promises completeness the learner will discover is untrue.

> **Proposed:** "There are about forty-six of them. Those plus a couple of marks
> you will meet shortly can spell any Japanese word out loud."

### E3 · "25 more sounds"
**`src/data/phase-intros.ts:215`** (and `:236`)

> **Now:** "so this is 25 more sounds without a single new drawing to learn."

25 more *characters*, 23 more *sounds*, because ぢ is じ and づ is ず.
`dakuten-rows.ts:115` already states this correctly.

> **Proposed:** "so this is 25 more characters without a single new drawing to
> learn." (Two of them, ぢ and づ, sound the same as じ and ず.)

### E4 · A card that points back at nothing
**`src/data/phase-intros.ts:443`**

> **Now (lead):** "And the thing that is missing."

This is the card's *only* lead, so it opens by referring to a paragraph that does
not exist. The card is about punctuation and the absence of spaces.

> **Proposed:** "And the thing that isn't there: spaces."

### E5 · "points" as a verb for punctuation
**`src/data/phase-intros.ts:440`** and **`src/data/marks.ts:325`**

> **Now:** "Japanese **points** its sentences differently."
> **Now:** "How a Japanese sentence is **pointed**: 。 、 「 」 ・ 〜, and no spaces."

Archaic typesetter's usage. A beginner reads it as a typo.

> **Proposed:** "Japanese punctuates its sentences differently."
> **Proposed:** "How a Japanese sentence is punctuated: 。 、 「 」 ・ 〜, and no
> spaces."

### E6 · A sentence with no structure
**`src/data/phase-intros.ts:318`**

> **Now:** "The same rule you saw in hiragana, a held vowel is a different word,
> written a different way. Katakana uses a single dash, ー, whatever the vowel is."

Three clauses, two commas, no signposting.

> **Proposed:** "Same rule as hiragana: a held vowel makes a different word.
> Katakana just writes it differently, with a single dash, ー, whatever the vowel
> is."

### E7 · Broken parallelism
**`src/data/why.ts:181`**

> **Now:** "...learning how to read, speak, and understanding what you hear."

> **Proposed:** "...learning how to read, speak, and understand what you hear."

### E8 · Straw-man negations, and a duplicate
Reported, no rewrite proposed yet, listed for a decision:

- **`phase-intros.ts:290` + `:293`** — title and first sentence are the same
  sentence, both landing on "not a decoration". Nobody arrived thinking vowel
  length was decorative.
- **`phase-intros.ts:569`** — "part of the word, not a separate thing tacked on."
- **`WHY_STROKE_ORDER` para 1 and `WHY_WRITING_EARLY` para 1** are near-duplicates
  of each other, about 60 words each. One should go or they should be merged.

### E9 · Look-alike kana get near-identical hooks
**Structural, not authoring** — recording it here because it is a design note
rather than a wording fix.

る and ろ are the two most-confused hiragana and are given near-synonymous stories
("looping route" / "winding road"). **The one fact that separates them is never
stated: る closes into a loop, ろ does not.** Same problem for ケ/け, せ/セ, て/テ.

Whatever the mnemonic says, the distinguishing feature should be stated
explicitly somewhere on the card. Worth deciding as part of the mnemonic review
rather than patching one pair.

---

## D · No change proposed — Sam asked what it meant

**`src/components/settings/settings-card.tsx:599`** — "A 90% from three cards isn't
really 90%."

This is the `info` tooltip on the Settings toggle **"Show how much you've
practised"**. Turning it on prints the raw count next to the percentage. The line
explains why you would want that: a percentage from a tiny sample is not
meaningful. It is accurate and in the target voice. **Recommend keeping it.**
