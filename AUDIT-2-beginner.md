# Beginner audit (round 2)

Tested against `kq-audit-a1` on `localhost:3361`. I came in knowing nothing: no hiragana, no
vocabulary, no idea what "kana", "kanji", "radical", "dakuten", "romaji", "furigana" or "JLPT"
mean. I did the group 1 vowel lesson, all three quiz rounds plus a retry, then explored Practice,
Library, Progress, Settings, Resources and Lists.

Everything marked **REPRODUCIBLE** I triggered at least twice.

---

## 1. The app can silently refuse to tell you the right answer

**REPRODUCIBLE.** Practice → Mode `Drill`, Direction `English → Japanese`, answers `Multiple choice`.

Prompt is `u` with the heading `GIVE THE HIRAGANA` and six tiles. I clicked a wrong tile. Nothing
happened visually except one retry dot dimming — the tile I clicked was not marked, not removed,
not reddened. I clicked a second wrong tile. The card **advanced straight to the next question**.
I was never shown that `u` is `う`.

I repeated it on the next card (`a`): two wrong picks, silent advance to `e`. I still do not know
from the app that `a` is `あ`.

Settings has `Show the answer when you run out of goes: On`. It is on. It does not fire in
multiple-choice mode.

This is the worst thing in the app. A quiz that lets you fail and then hides the answer is not
teaching, it is scoring. In the typed drill the same failure at least shows `い = i`.

**Expected:** on the final wrong attempt, show the correct character, and say which one I picked
and why it was wrong.

---

## 2. Nothing is taught when you get something wrong

On the typed drill, wrong answer #1 gives you: the input box outline changes colour, your text gets
selected, a `0% first try` badge appears, and one retry dot dims. **There is no word anywhere on
screen saying you were wrong.** The hint image, if you had it open, disappears.

Wrong answer #2 (retries exhausted) gives you exactly this, in small type under the box:

> い = i
>
> Press Enter to continue

That is the entire lesson. It does not:

- replay the mnemonic ("two eels, one long one stubby, screeching *eee*") that it spent a whole
  lesson card building
- show the eel picture
- play the sound
- say anything about *why* I said `u` — I confused い with う, which is the single most predictable
  beginner confusion and the app's own Progress page knows it (`THINGS YOU MIX UP · い / う`)

The app has the mnemonic, the illustration, the audio, and a record of exactly which pair I mix up.
On the one screen where I have just demonstrated I need all four, it shows me none of them.

**Expected:** the wrong-answer screen is the teaching moment. Show the character, the sound, the
picture, the mnemonic sentence, and — since it tracks confusion pairs — "you said `u`; that's う,
the one in the bath. This one is い, the two eels."

---

## 3. The lesson and the Library give opposite advice about writing

**REPRODUCIBLE.** Same character, two screens.

Lesson card for あ, under `How it's written`:

> **We don't recommend learning to write early.** Why?

Library page `/library/hiragana/a`, in the same `How it's written` block:

> **Stroke order is worth learning with each character.** Why?

I clicked into the Library from the lesson card's own "Open あ in the Library" link, so this is two
clicks apart. One screen tells me not to bother, the next tells me it's worth doing. I have no
teacher to ask which is right. This is the exact thing that makes a beginner stop trusting an app.

---

## 4. The app told me I already know a character I have never seen

**REPRODUCIBLE.** `/library/hiragana/a`, section `THE FAMILY`:

> Katakana
>
> ア
>
> **all 1 solid, nothing to ask**

`/library/katakana/a` for that same character says:

> not seen

And Progress says `Kana — 5 of 214`. I have seen five characters. ア is not one of them. The あ page
claims it is "solid" with "nothing to ask".

---

## 5. "Nothing missed" and "1 needed another look" on the same screen

**REPRODUCIBLE — happened at the end of round 2 and again at the end of round 3.**

Round 2 end screen, verbatim:

> **Round 2**
>
> 8 questions · 7 right first try · 1 needed another look
>
> PICK WHAT TO RETRY
>
> **Nothing missed.** Pick anything you want another look at.

I answered 7 questions in round 2 and got every one right. The screen claims 8 questions and 1
miss, then immediately claims nothing was missed. The progress bar under the heading shows a
sizeable red segment. Round 3: `6 questions · 5 right first try · 1 needed another look` +
`Nothing missed.` — I answered 5, all correct.

There is a phantom extra question counted as a miss at the start of every round.

---

## 6. A correct answer makes your accuracy go down

**REPRODUCIBLE — identical in round 2 and round 3.**

Round 3, answering correctly every time, watching the badge row:

| after answer | badges |
|---|---|
| 1 | `1 answered` · `100% first try` |
| 2 | `2 answered` · `100% first try` |
| 3 | `3 answered` · `100% first try` · `🔥 3` |
| 4 | `4 answered` · `100% first try` · `🔥 4` |
| 5 | `5 answered` · **`83% first try`** · `🔥 5` |

Five correct answers in a row, a visible unbroken streak of 5, and the accuracy drops from 100% to
83%. It then climbs 86%, 88% as I keep going. The count is round-scoped, the percentage is
something else (session-wide, apparently), and they sit inside the same badge row pretending to
describe the same thing.

The demoralising version of this happened in round 1: I answered あ correctly and watched `75%`
become `67%`.

Also in Match pairs mode: I deliberately mismatched え with `u`, got a red outline, and the badge
still read `100% first try`.

---

## 7. Words used on me that I was never taught

I started from zero. Each of these appeared with no introduction, in the order I met them.

| Term | Where |
|---|---|
| **kana** | Page title `Kana quiz`, first thing on screen |
| **kana, kanji, grammar pattern** | Home dismissible banner, above everything: "Saying you already know something (a kana, a kanji, a word, a grammar pattern) lets you skip its lesson and quizzes." This sits *above* the `Why?` explainer that defines hiragana/katakana/kanji |
| **hiragana** | `UP NEXT · HIRAGANA · GROUP 1 OF 27` — the label appears before the explainer that defines it |
| **romaji** | Practice page: `Type romaji`, `JP → EN answers`. Never defined anywhere. This is the format of every answer I am asked to type |
| **drill** | Practice ("then drill"), quiz gear menu `DRILL VIEW`, Settings `THE DRILL` |
| **pool** | Practice: "Pick a pool and how it should ask" |
| **script** | Quiz settings `Script label`, Settings `Script label on the card` |
| **pips** | Quiz settings `Retry pips` |
| **re-queued** | Quiz badge `1 re-queued` |
| **solid** | Library chip legend, Progress `5 solid`, character pages |
| **not seen** | Library chip legend — shown as a grey pill in front of the character row, reads like a character name |
| **spacing** | Break screen: "Spacing works best when you do the rests" |
| **dakuten / handakuten** | Library group headings `HIRAGANA · DAKUTEN G が`, `HANDAKUTEN P ぱ`. The `Why?` explainer only says "a couple of marks you will meet shortly" and never names them |
| **combo** | Library group headings `HIRAGANA · COMBO き` |
| **radical** | Library shelf `Radicals`, 214 entries, no intro text at all explaining what a radical is or why I'd want one |
| **N5 / N4** | Library Grammar shelf: `N5 PATTERNS`, `N4 PATTERNS`, and every single entry tagged `N5 pattern`. JLPT is never mentioned or explained |
| **て-form, ない-form, stem** | Grammar pages, load-bearing, undefined |
| **gloss, frame** | `/grammar/obligation`: "all seven gloss as 'must'", "interchangeable in nearly every frame" |
| **furigana, JLPT** | Resources page |
| **deck** | Lists page, Settings ("import a deck") |
| **knowledge base** | Settings `CLEAR KNOWLEDGE BASE`, Progress `YOUR KNOWLEDGE BASE` |
| **okurigana** | Word pages — this one *is* explained in place, which is the right pattern; almost nothing else follows it |

The `Writing rules` shelf in the Library contains short, excellent definitions of dakuten,
handakuten, small っ, small ゃゅょ, long vowels, rendaku, okurigana and punctuation. **Nothing in
the lesson flow ever sends you there.** I found it by clicking every filter chip. Those definitions
should fire the first time each term is used.

---

## 8. The quiz never tells you it's going to end, or that it has

Round 1 ran for **21 questions on five characters** with no completion indicator of any kind. The
badges say `N answered`, and that number just goes up. There is no "x of y", no shrinking pool, no
signal. I stopped because I was bored, not because I was finished.

When I pressed `End quiz` — the only button that looked like an exit, which I expected to abandon
my progress — I got a summary screen headed `round 1 of 3 · done`. **That was the first time I
learned there were three rounds.** The round was apparently already complete and I could have
pressed that button 15 questions earlier.

Meanwhile, a *retry* run shows a proper counter: `0 / 1`. So the app knows how to display finite
progress; the main round just doesn't.

**Expected:** tell me up front there are 3 rounds; show progress within a round; and when the round
is done, say so rather than letting me grind on until I guess.

---

## 9. Multiple choice is a game of "pick the only one I recognise"

**REPRODUCIBLE — every question.**

I know five characters: あいうえお. The multiple-choice distractors are drawn from all of kana:

- prompt `i` → `れ ほ い りゅ そ み`
- prompt `u` → `う ぢゃ ひょ ど ぎ みゃ`
- prompt `u` (later) → `い りゃ う お ちょ ぐ`
- prompt `e` → `ぢゃ だ く え に ろ`

Five of six options are characters I have never been shown, several are two-character clusters.
I don't have to know the answer — I just pick the only shape I have seen before. It is not a test,
and worse, it teaches nothing on a miss (see finding 1).

**Expected:** distractors from the pool I have actually studied, and from my recorded confusion
pairs (い/う, い/え) in particular.

---

## 10. Grammar and word pages are reference tables for people who already read Japanese

`/library/grammar/te-request`, the very first N5 entry, in full:

> **〜てください** — please do X
>
> attaches to a verb
>
> HOW TO BUILD IT: any verb → て-form + ください
>
> Any verb you know: 行く → 行ってください · 食べる → 食べてください · 書く → 書いてください

No definition of "て-form", no link to one, no romaji, no English for any of the three example
verbs, no audio. I cannot read one character of it.

`/grammar/obligation` ("must — seven ways to say the same thing") is a three-column table of
行かなければならない, 行かなくてはいけない and so on, with a build column like
`行かない − い + ければならない`. Closing note: "All seven are ない-form + a fixed ending, and all
seven **gloss** as 'must'... interchangeable in nearly every **frame**."

The Library `Words` shelf lists 120 everyday words as kanji + kana reading with **no English at
all** — `何 / なに`, `話す / はなす`. For a beginner the entire shelf is meaningless.

The individual word pages are the best content in the app — `/library/word/食べる` labels its
conjugations in plain English ("it's done to them", "made to do it", "an order"), which is genuinely
good writing. But there is still no romaji anywhere on it, so I can't pronounce a single form.

---

## 11. All audio is your operating system's robot voice, and it picks the joke one

There are no recorded audio files. Every `Hear あ` button calls the browser's speech synthesiser.
I instrumented the call; the utterance was:

```
{ text: "あ", lang: "ja-JP", voice: "Eddy (Japanese (Japan))", rate: 0.8 }
```

`Eddy` is one of macOS's novelty character voices. Settings → `Speech voice: Auto` picks the first
`ja-JP` voice alphabetically, which puts `Eddy`, `Flo`, `Grandma`, `Grandpa` ahead of `Kyoko` and
`Otoya` — the two actual Japanese voices. So the default pronunciation model for a beginner is a
cartoon voice at 0.8× speed.

On a machine with no Japanese voice installed, this button does nothing at all, or reads kana with
an English voice. Nothing warns you.

I never once heard a human being say a Japanese word in this app.

---

## 12. Text problems

- **`REPRODUCIBLE`** Break screen, missing space: "…but you can complete early if you need
  to.**Y**our finished rounds are saved." (both the round‑1→2 and round‑2→3 breaks)
- **`REPRODUCIBLE`** Round-end footer always reads "Retries bring you back to this screen.
  **Complete round** starts the break." — but on the final round the button is labelled
  `Complete session` and there is no break after it.
- **`REPRODUCIBLE`** Practice page mixes spellings: heading `Practice`, section heading
  `WHAT TO PRACTISE`.
- Session complete screen: "3 rounds of the same 5. You finished on 5 right first try, **up from
  4**." Round 1 reported `20 right first try`, round 2 reported `7`. There is no 4 anywhere. The
  number is meaningless to me.
- Session complete screen offers both `Quiz again` and `Complete session` — but I had *just*
  pressed `Complete session` to get here, and the header already says `complete`.
- Round-end screen: "**Your 1 miss is picked.**" directly under "22 questions · 20 right first try ·
  **2 needed another look**". One or two?
- `/library/hiragana/a`, under `Commonly mixed up with`: `お` — `a guess`. Showing a learner the
  label "a guess" invites them to distrust it.
- Library character grid renders as a green `✓` in the accessibility tree for **every** character
  including all 209 I have never seen (visually they are empty selection circles). Screen-reader
  users are told they know all of hiragana and katakana.
- `/library/word/食べる` renders the **entire conjugation set twice** — once as the "The part that
  changes" map and again as a `FORMS` table further down. Both are `display: visible`, verified in
  the DOM; the page is 7,900px tall. **REPRODUCIBLE.**
- Library, learned vs unlearned characters look almost identical — the あいうえお row is a barely
  perceptible shade different from かきくけこ. I could not tell at a glance what I'd studied.
- Resources: "WaniKani — **Radicals up to 2,000 kanji** on a schedule." Sentence is broken.
- `/library/grammar` and `/grammar/…` grammar names are shown as `〜から (理由)`, `〜から (起点)`,
  `〜そう (様態)`, `〜そうだ (伝聞)`, `〜られる (可能)`, `〜られる (受身)` — Japanese linguistic
  terminology in kanji, on a shelf a beginner is invited to click.
- `Match pairs` mode opens with a bare grid of ten tiles and **no instruction of any kind**. I
  guessed that I was meant to pair characters with sounds.

---

## 13. Where I actually got stuck or lost

1. **First screen.** The banner about "a kana, a kanji, a word, a grammar pattern" sits above
   everything and is written for someone who already knows what those are. I did not know what I
   was being offered to skip.
2. **First quiz question.** `い` in a circle, `HIRAGANA` underneath, and a box that says
   `Type answer, Enter to submit`. **Type what?** There is no question. Nobody had told me that the
   answers are English letters or what they're called. I guessed.
3. **Mid round 1.** No idea whether the quiz was 10 questions or 100. Kept going past the point of
   boredom because stopping looked like quitting.
4. **`Look again` button.** Unlabelled purpose. It took me back to lesson card 1 of 5 — not to い,
   the card I had just failed. If the point is "go review", it should go to the thing I got wrong.
5. **`End quiz`.** Looked destructive. It's the normal way to finish.
6. **The break screen.** Told me spacing works best if I rest. I don't know what spacing is or why
   5 minutes helps. Also 27 groups × 3 rounds × (5 + 10 min rests) is a schedule nobody described
   to me before I started.
7. **Practice page.** `Direction at least one`, `JP → EN answers`, `Just the shaky ones (3)`. I only
   ever got one character wrong; where did 3 shaky come from?
8. **Grammar shelf.** Clicked it out of curiosity because I want to speak Japanese, hit `N5
   PATTERNS`, `〜てください`, `て-form`, and closed it.

---

## 14. Where it stops sounding like a person

The `Why?` explainer on the home card is the best writing in the app and does sound like someone
who went through it:

> Japanese isn't written with the letters you already know. There's no way to sound あ out with
> A, B, C: it's a separate system, and you can't step around it to get to the "real" Japanese
> later. Hiragana is where that system starts.

The `Writing rules` entries and the plain-English conjugation labels on word pages are the same
quality. The retry screen's "You got it back. Nothing left over, but pick anything you want another
look at." is warm and right.

Where it breaks:

- **Every screen with a number on it.** `0% first try`, `1 re-queued`, `N answered`, `RETRIES`,
  `Retry pips`, `Clean runs to clear a mix-up`, `YOUR KNOWLEDGE BASE`. This is the vocabulary of
  a spaced-repetition engine describing itself, not a teacher talking to a student. `1 re-queued`
  is not something a person says.
- **`DRILL VIEW (applies instantly)`** and its rows: `Script label`, `Retry pips`, `Live accuracy
  follows your accuracy setting`, `Fade controls — they wake on mouse move`. That last one is a
  developer describing their own implementation.
- **`/grammar/obligation`**: "all seven **gloss** as 'must'", "interchangeable in nearly every
  **frame**". Linguistics-paper register.
- **Em dashes in learner-facing text:** quiz settings row `Fade controls — they wake on mouse
  move`.
- **`Commonly mixed up with お — a guess`.** A person who had learned this would just say
  "people mix these up constantly, watch the little tail."
- The two contradictions in findings 3 and 5 read like two different authors who never compared
  notes.

---

## 15. Could this app alone make me fluent?

Honestly, no — and it's not close in three of the four.

**Reading — partly.** It can get me to recognise all 214 kana, and there is real kanji, vocabulary
and grammar data behind the Library. But recognition of isolated characters is not reading. In an
entire session I was never asked to read a *word*. The lesson showed me `あめ · ame · rain`,
`いぬ · inu · dog`, `うみ · umi · sea`, `えき · eki · station`, `おと · oto · sound` — five real
words — and then quizzed me on none of them, 23 times. I finished group 1 unable to read a single
Japanese word, having spent 20 minutes on it. There are no sentences, no passages, no graded
reading. The Resources page sends me to NHK News Web Easy for that, which is an admission.

**Hearing — no.** There is no listening question type anywhere. `HOW TO ASK` offers Drill, Match
pairs, Grid; directions JP→EN and EN→JP; answers typed romaji or multiple choice. Nothing plays a
sound and asks what it was. The only audio is an optional speaker button on a card where the answer
is already printed next to it, and it's a synthetic voice (finding 11). I cannot learn to
understand spoken Japanese here.

**Speaking — no.** There is no microphone, no recording, no shadowing, no pronunciation check,
nothing. The pronunciation notes on lesson cards are good ("Japanese う is flatter than English
'oo'. Don't purse your lips." / "No glide. It's 'eh,' not 'ay.'") but nothing ever checks whether I
did it. Japanese pitch accent is never mentioned. The app cannot tell me I'm saying it wrong,
because it never hears me.

**Writing — no.** The app explicitly discourages it on every lesson card, and there is no way to
produce a character: no canvas, no stroke input, no handwriting check. Even in `English → Japanese`
direction the only typed answer format is `Type romaji` — I type Latin letters, always. Stroke
diagrams exist behind a `Show` toggle but nothing ever asks me to draw. And the Library page then
tells me stroke order *is* worth learning (finding 3), leaving me with contradictory advice and no
tool either way.

**What's missing, in order:** listening questions; any production of Japanese characters; real
words and sentences as quiz material rather than isolated characters; recorded native audio; a
speaking loop of any kind; and grammar written for someone who cannot yet read kanji.

What this app actually is: a well-built kana and vocabulary **recognition** trainer with an unusually
good writing voice in its explainers and an unusually rich reference library behind it. Marketing
it to myself as the path to fluency would be a lie I'd discover in about week three.

---

## 16. What would make me quit

In the order they'd get me:

1. **Failing a card and not being told the answer** (finding 1). Two of those and I'd assume the
   app is broken and close the tab. This is the one.
2. **Being told my accuracy dropped after five correct answers in a row** (finding 6). I would
   believe the app over my own memory, feel like I was getting worse, and lose heart.
3. **21 questions on five characters with no end in sight** (finding 8). Round 1 was already dull
   at question 12. There are 26 more groups.
4. **Rounds 2 and 3 being byte-identical to round 1** — same five characters, same direction, same
   format, separated by a 5- and 10-minute wait. Three rounds plus rests is roughly 20 minutes to
   learn five characters, and 17 of those minutes are staring at a countdown.
5. **The stroke-order contradiction** (finding 3). Once I catch an app disagreeing with itself
   about something I asked it, I stop believing the rest.
6. **Clicking `Grammar` because I want to speak Japanese and getting `〜てください → て-form +
   ください`** with nothing I can read. It tells me the app isn't actually for me yet, and doesn't
   say when it will be.

The thing that would keep me: the `Why?` explainer, the `Writing rules` entries, and the
`THINGS YOU MIX UP` panel that noticed い/う and い/え on its own. Somebody who has learned this
wrote those. They just aren't wired into the moments where I need them.

---

## Appendix — possible content errors (flagging, not confident)

- Library `Words` shelf lists `前 / ぜん`. As a standalone everyday word 前 is normally read `まえ`;
  `ぜん` is the compound reading. Worth checking how readings were selected for the everyday list.
- Progress reports `Radicals 0 of 214` and `Kana 5 of 214` — the identical total is a coincidence
  (214 Kangxi radicals) but reads like a copy-paste bug at a glance.
- Library footer says `Words, 22980 questions` while Progress says `Words 0 of 12,553`. Different
  units, no explanation of which is which.
