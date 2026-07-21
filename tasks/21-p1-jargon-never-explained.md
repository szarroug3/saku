# P1 · Words the app uses without ever teaching them

**Status: done — COPY IS DRAFT** — merged `348b671`. Track-open intro cards built on phase-intros. The sentences are placeholders for Sam's voice pass.

---

# DRAFT COPY TO REVIEW — all six track intro cards

These are the placeholder strings now live in `src/data/track-intros.ts`, copied
here verbatim so you can read and mark them all in one place. Each card shows once,
when its track unlocks, before the first lesson. Every card does three jobs: **what
this is · how it helps · why now.** Hiragana carries the extra job of introducing
*kana* and *romaji* themselves.

Edit them here or in the file. When you rewrite, the header of `track-intros.ts`
flags one thing to reconcile: `WHY_TRACK` in `why.ts` is a collapsed "why?"
disclosure on the Home card that says similar things in your own words, and the two
should not drift.

---

## 1 · Hiragana  ·  eyebrow: *What hiragana is*

**Title:** Japanese is written in kana, and hiragana is the first half of it.

- **Kana is the Japanese alphabet.** It comes in two sets, hiragana and katakana. A
  kana stands for a whole sound rather than a single letter: か is "ka", き is "ki".
  There are about forty-six in each set.
- **Hiragana is the set you are starting with.** It spells native Japanese words and
  the endings that hold a sentence together, so it is on every page of a beginner's
  book. Most books open assuming you have it already and never say so.
- **Japanese written in the letters you already know is called romaji.** か is "ka",
  さくら is "sakura". It is how Japanese is typed on a keyboard, and it is what you
  write when you read a character back.
- **Katakana comes after this, and kanji after that.** Hiragana is the small set
  that unlocks the most, so it is the door in.

## 2 · Katakana  ·  eyebrow: *What katakana is*

**Title:** Katakana is the other half of kana: the same sounds, a second set of shapes.

- **You already know how all of it sounds.** カ is "ka", exactly like か. Every sound
  you learned in hiragana is here again under a different shape, so the work is
  learning to recognize the shapes.
- **It marks a word as coming from somewhere else.** Borrowed words are written in
  it: コーヒー is "coffee", パン is "bread". So are names and sound effects. You run
  into it constantly.
- **It comes now because it is cheap and you need it soon.** It is about the same
  size as hiragana and reuses sounds you already have. With both sets in hand you can
  read any Japanese word out loud.

## 3 · Radical  ·  eyebrow: *What a radical is*

**Title:** Radicals are the parts a kanji is built from.

- **A radical is a small shape that recurs inside many kanji.** Kanji are the
  characters Japanese uses to write most of its words, and they are drawn out of a
  fixed stock of pieces. 氵 means water, and it sits inside 海 (sea), 泳 (swim) and
  湖 (lake). 木 means tree, and it sits inside 林 (woods) and 森 (forest).
- **Knowing one gives you a head start on a kanji you have never seen.** The radical
  often hints at what the kanji means. It is a hint rather than a promise, since some
  radicals are only structural. A radical is usually a component rather than a word
  you would say out loud, so this track asks you only for its meaning.
- **Each one arrives just before the first kanji that uses it.** That way a kanji is
  never taken apart into a piece you have not learned yet.

## 4 · Kanji  ·  eyebrow: *What kanji are*

**Title:** A kanji carries a meaning, not only a sound.

- **One character, one meaning, and usually a sound.** 山 means mountain and is read
  "yama". Sometimes a kanji is a whole word by itself. Sometimes it is one piece of a
  longer word, like the 火 inside 火山. The same character does both, depending on the
  word it is in.
- **Every kanji you learn is a discount on words you have not seen yet.** 火 is fire
  and 山 is mountain, so the first time 火山 turns up you can guess it: a volcano, and
  nobody had to teach you the word. Learn a few hundred and thousands of words stop
  arriving as strangers.
- **They also show you where one word ends.** Japanese leaves no spaces between
  words. The switch between kanji and kana is a large part of how your eye finds the
  breaks in a solid row of characters.
- **It comes now because you can read every sound already.** Kana got you the sounds.
  Kanji is what carries the meaning, and it is the larger job, so it starts once the
  small one is done.

## 5 · Word  ·  eyebrow: *What this track teaches*

**Title:** Words are the part you actually speak and read.

- **This is what the scripts were for.** 先生 (teacher), 電車 (train), たべる (to
  eat). Kanji are the characters a word is written with, and grammar is how you join
  words into a sentence. The word is the thing in the middle that you say.
- **A word is taught here once you know every kanji in it.** 電車 waits until you have
  learned both 電 and 車, so when it arrives you can read it rather than take its shape
  on trust. Words with no kanji at all, like これ and もう, have nothing to wait for.
- **Expect it to come in bursts.** Nothing for a while, then several at once, as the
  kanji they need come in. Learning a word is also what settles which reading its
  kanji take, so this track is what gives those characters their real pronunciation.

## 6 · Grammar  ·  eyebrow: *What grammar is here*

**Title:** Grammar is how words become sentences.

- **A pattern is a rule for combining.** It is what turns 食べる ("eat") into "after
  eating", "want to eat", "please eat". You learn it once and reuse it on every word
  you know.
- **Knowing words is not the same as knowing how to join them.** A sentence needs the
  pattern as much as it needs the vocabulary, and this is where Japanese sits furthest
  from English. Word order, and the small words that mark who did what, both work
  differently.
- **You do not need a large vocabulary to start.** Each pattern is taught on words you
  have already learned, so it opens as soon as the first ones are in hand. Kanji
  unlocks words; grammar is what you do with them.

---

## Two things flagged with the drafts

- **`combo` should probably be retired.** It is our coinage, not Japanese; the real
  term is yōon. The kana combo cards already teach the concept without leaning on the
  word for meaning, so only the Library shelf header still carries it. Relabel to
  "small-や sounds" or "yōon" when you do the voice pass.
- **Still undefined, out of reach of a track intro:** JLPT (Settings, Progress),
  furigana (Resources). These live on surfaces a track intro does not open, so they
  need a define-on-first-use fix where they appear.

---

## Original open questions (now answered by the ruling above)

- ~~Per term: define on first use, or cut it?~~ **Answered:** introduce at track
  open. Cut `combo`.
- ~~An intro card before each lesson type?~~ **This is exactly what was built.**

From the beginner probe. It kept a list of every term used on screen that it had
not been taught, having started from zero.

## The list

| term | where it appears | problem |
|---|---|---|
| **kana** | the **very first banner on the home page** | Used before anything is taught. Defined nowhere the tester could find. |
| **romaji** | the quiz expects it; the word appears **once**, on Practice | The learner must type romaji on their first card and is never told the word, let alone what it means. |
| **dakuten** | mark lessons, Library shelf | Taught as a concept, but the word itself is used before it is introduced. |
| **handakuten** | same | same |
| **combo** | Library shelf headers | App vocabulary, not Japanese. Means yōon. |
| **radicals** | kanji track, Library | Never defined for a beginner. |
| **JLPT** | Settings, Progress | An exam system with no explanation. |
| **furigana** | Resources | Undefined. |

**Stroke order is explained, and well.** That is the standard the rest should meet.

## Why this matters more than it looks

The tester's first screen was a banner reading *"Saying you already know something
(a kana, a kanji, a word, a grammar pattern) lets you skip its lesson and
quizzes."* Their note: *"I know none of those words. It's the first thing on
screen and it's aimed at someone who already knows Japanese."*

The app is otherwise carefully pitched at zero knowledge. These terms are the
places it forgets.

## Fix

Two separate jobs, and they are not the same:

1. **Define on first use.** A term that appears in teaching copy should be
   introduced the first time it is used, in a clause, not a glossary. "kana, the
   two alphabets Japanese is written in" costs six words.
2. **Or replace it.** *combo* should probably just go: it is our word, not a
   Japanese one. *romaji* may be better replaced by showing rather than naming,
   which overlaps with task 16 (the quiz never says what to type).

Decide per term. Some are worth teaching (kana, dakuten, radicals are real
vocabulary a learner will meet elsewhere). Some are ours and should be cut
(combo). Some can wait (JLPT, furigana are not needed on day one but should be
defined where they appear).

## Done when

- No term is used in teaching copy before it is introduced.
- The first-run banner does not assume Japanese vocabulary.
