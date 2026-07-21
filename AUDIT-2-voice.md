# Voice audit 2 — kq-audit-a4

Read on screen at `http://localhost:3364`, in a learner's order: home → first lesson → quiz → Library → Progress → Settings, plus the copy that only exists deeper in the walk (read in source, cited by the URL it renders at).

**Verdict.** The copy is closer to one voice than it was, and the best of it is unmistakably hers — the Progress empty state ("Two things have to get tangled before they can show up here"), the whole Settings tooltip layer, the kanji "why?" answers, the small-っ card. But the recent pass fixed statements one file at a time and left their partners behind, so the app now says several things twice, differently. Two of those pairs are flat contradictions. The single worst thing on screen is a lead sentence that its own next sentence denies.

The em-dash sweep is essentially clean: one instance, cosmetic (§16).

---

## 1. The transitivity card's lead is contradicted by its own paragraph

**URL:** `/session` — the transitivity teach walk, "Before you go on" card (`src/data/phase-intros.ts:644`).

> **The sentence already tells you which.** You will get these backwards for a while. English gives you no help here, because 'open' does both jobs. Expect to mix them up, and expect that to sort itself out with time.

The lead says English tells you which verb to use. The sentence immediately under it says English gives you no help. This is the copy pass having rewritten the paragraph (correctly — commit `bb5fed0` set out to stop claiming English always tells you) and left the lead it was written under.

The paragraph is good and should not be touched. The lead should be replaced with what the paragraph actually says:

> **You will get these backwards, and that is fine.** You will get these backwards for a while. English gives you no help here, because 'open' does both jobs. Expect to mix them up, and expect that to sort itself out with time.

(Or drop the lead entirely — the paragraph opens on its own point.)

Also on this card, note the straight apostrophes in `'The door opened'` and `'open'` (`phase-intros.ts:641`, `:645`). Every other card in the file uses curly quotes, and `why.ts` says in its own header that curly is deliberate. Two paragraphs on one screen, two quote styles.

---

## 2. …and `why.ts` still makes the claim the card just retracted, in the cheeriest possible register

**URL:** `/` — home, the "Why?" behind the verb-pairs lesson card (`src/data/why.ts:269`).

> The good news is that English already tells you which to use. Whenever you can say whether something acted on its own or someone acted on it, you have chosen the verb. That is the whole skill, and this track drills exactly that: you read the English and pick the verb that fits.

Three separate problems in three sentences:

- It is the **opposite claim** to the lesson card in §1. A learner who opens both is told English does and does not help.
- "The good news is" is the tell. Nobody who has actually mixed up 開く and 開ける opens with good news. It is also calling a hard thing easy, which is banned outright.
- "and this track drills exactly that: you read the English and pick the verb that fits" is **narrating the app** — it describes the question format, not the language.

Proposed replacement, keeping paragraphs 1 and 3 as they are:

> You will get these backwards for a while. English uses one word for both jobs, so there is no habit to fall back on; you build the distinction from scratch. It does sort itself out, but not on the first pass.

---

## 3. "kanji you have not met" — the banned verb, verbatim

**URL:** `/` — home, the words lesson lock card (`src/components/lesson/next-word-lesson.tsx:50`).

> A word written with kanji you have not met is just shapes. So a word waits until you know the kanji inside it, and then it arrives ready to read.

"You have not met" is the exact construction she ruled out, moved from words onto kanji. The second sentence is good; only the first needs fixing.

> A word written with kanji you have not learned is just shapes. So a word waits until you know the kanji inside it, and then it arrives ready to read.

**Same rule, same file family:** `/` — the hiragana "why?", paragraph 2 (`src/data/why.ts:70`):

> Those plus **a couple of marks you will meet shortly** can spell any Japanese word out loud.

→ "Those plus a couple of marks that come shortly after can spell any Japanese word out loud."

---

## 4. "Knowledge base" was swept out of one screen and left on three others

Commit `a7fc6a5` removed "knowledge base" from the claim explainer as product language. It is still on screen in four places:

- **`/stats`** — section heading `YOUR KNOWLEDGE BASE` (`src/components/stats/knowledge-base.tsx:34`)
- **`/settings`** — heading `CLEAR KNOWLEDGE BASE`, button `Clear knowledge base`, confirm dialog `"Clear your entire knowledge base?"`, success line `"Knowledge base cleared. The app is back to its first lesson."`, error `"Couldn't clear your knowledge base. Try again."` (`src/components/settings/settings-card.tsx:177, 219, 228, 241, 246`)

This is the most visible half-finished sweep in the pass. It is also the wrong register on its own terms — it is a database word for the thing she'd call *what you know*.

> `/stats`: **WHAT YOU KNOW**
> `/settings`: **START OVER** · button "Start over" · "Wipes everything the app has learned about you… " (body text is already fine) · "Cleared. The app is back to its first lesson."

Do this as one rename across both screens or not at all — a half-rename is worse than the current state.

---

## 5. The first paragraph on the first screen is the app explaining its own buttons

**URL:** `/` — home, top card, above everything (`src/components/lesson/claim-explainer.tsx:111`).

> Saying you already know something (a kana, a kanji, a word, a grammar pattern) lets you skip its lesson and quizzes. It counts as learned, so anything that was waiting on it is no longer waiting. You can choose to completely skip the lesson and quiz or skip just the lesson and go straight to the quiz.

This is the very first prose a new reader meets, and it is:

- **entirely about the app**, not about Japanese;
- **jargon before it is taught** — "kana", "kanji" and "grammar pattern" in the first eleven words, to someone who by the app's own premise did not know hiragana existed;
- **third sentence restates the first two** in list form.

It is a tooltip that got promoted to a lede. It should sit on the "I already know these" buttons, not above the lesson. If it must stay:

> If you already know something, say so and the app will skip it — the lesson, the quiz, or both. Anything that was waiting on it stops waiting.

---

## 6. The round header and the session summary print the same phrase from two different counts

**URLs:** `/session` — round-complete screen, and `/session` — session-complete screen.

Round header (`src/components/session/round-complete.tsx:119`):

> {total} questions · {firstTry} right first try · {needAnother} needed another look

Session summary (`src/components/session/session-complete.tsx:25`):

> 3 rounds of the same 12. You finished on {last.firstTry} right first try, up from {first.firstTry}.

They are not the same number. `roundCompleteView` (`src/lib/session.ts:372`) computes `firstTry` as **Σ firstTryShowings** — a count of showings. `summariseRound` (`src/lib/session.ts:391`), which is what fills `session.rounds[]` and therefore what the session summary reads, computes it as **the number of facts whose `firstTryCorrect` flag is true** — a count of facts. A round with any retry leg makes these diverge, and the reader sees "9 right first try" on one screen and "7 right first try" on the next, one tap apart, in identical words.

This is a code fix, not a copy fix: `summariseRound` should use `firstTryShowings` and `Σ seen` like `roundCompleteView` does, or the session summary should read from `roundCompleteView`'s numbers.

---

## 7. Four different words for "you got it wrong", two of them on the same screen

- `/session` round header: **"3 needed another look"**
- `/session`, directly beneath it, the retry hint (`src/components/session/retry-grouping.ts:105, 109`): **"Your 3 misses are picked."** / **"Nothing missed. Pick anything you want another look at."**
- `/results`: **"3 characters need another pass"** (`src/components/results/summary.ts` headline)
- `/results`, the board below it: **"Needs work"** (`src/components/results/triage-board.tsx:207`)

The header/hint pair is the damaging one — same card, two vocabularies, an inch apart. `retryHint`'s last state manages both in one string.

Pick one and use it everywhere. "Needed another look" is the best of them (it is the one that is true of a hint-assisted answer as well as a wrong one, which is exactly why `needAnother` is not called `missed` in the code). Then:

- retry hint: `"Your 3 are picked. Add or drop any character."` / `"Nothing needed a second look. Pick anything you want to run again."`
- results headline: `"3 characters need another look"`

**Related, same headline:** `/results` hardcodes the word **"characters"** (`summary.ts`: `` `${n} character${s(n)} need...` ``). After a words, grammar or verb-pairs round the screen says "4 characters need another pass" about four verbs. Use the subject's own word, or "things".

---

## 8. "i-row" and "い-column" name the same thing on the same page

**URL:** `/library/writing-rule/small-ya`

Summary line, at the top (`src/data/marks.ts:248`):

> Fuse onto the **i-row** kana in front of them to make ONE syllable.

First paragraph, four lines below it (`src/data/phase-intros.ts:247`):

> Only the **い-column** kana take these: き, し, ち, に, ひ, み, り and their voiced partners.

Row vs column, romaji vs kana, in one eyeful. Commit `aac95c6` scoped the card to the い-column "matching marks.ts" — but marks.ts says row. Make the summary match the card:

> Fuse onto the い-column kana in front of them to make one syllable.

(Also drops the shouted `ONE`. The same page shouts `VOWEL` in the closing note, `marks.ts:195`. Caps-for-emphasis is house style in the code comments; on screen it reads like a different writer.)

---

## 9. The katakana combo card lost three things its hiragana twin has

**URL:** `/library/writing-rule/small-ya`, "IN KATAKANA" — and `/session`, the katakana combo card (`src/data/phase-intros.ts:264`).

Read side by side with the hiragana card, the katakana one:

**(a) Drops the reassurance.** Hiragana closes its "size is the tell" paragraph with *"You will misread a few at first. That is normal, and it stops once you have seen enough of them."* Katakana's otherwise near-identical paragraph just stops. A learner who reaches katakana is more likely to misread キャ/キヤ than きゃ/きや, not less. Add the same two sentences.

**(b) Drops the scoping, and is wrong without it.** Hiragana: *"Only the い-column kana take these."* Katakana: *"A full-size kana followed by a small ャ, ュ or ョ…"* — which is not true of every full-size kana.

**(c) Says one thing twice.**

> A full-size kana followed by a small ャ, ュ or ョ is one syllable, not two. The two are said together, in a single beat, not as two separate kana.

Two sentences, one fact, and "not two" / "not as two separate kana" in both. Compare the hiragana card's single clean line: *"き with a small ゃ is one sound in one beat, kya, not two."*

Proposed replacement for the katakana opening paragraph:

> Only the イ-column kana take these: キ, シ, チ, ニ, ヒ, ミ, リ and their voiced partners. キ with a small ャ is one sound in one beat, kya, not two.

---

## 10. The hiragana lede promises what its own paragraph was rewritten to stop promising

**URL:** `/` — home, first lesson card (`src/data/why.ts:66`).

Lede, always on screen:

> It's the smallest set of characters that lets you **read and write anything**.

Paragraph 2, behind the "Why?" (rewritten in `bb5fed0` specifically to stop over-promising):

> Those plus a couple of marks you will meet shortly can spell any Japanese word **out loud**.

And paragraph 3 goes on to say there are two more writing systems you will need. The lede is now the loudest false claim on the home screen, and it is the one sentence a reader cannot avoid.

> It's the smallest set of characters that gets you reading Japanese at all.

---

## 11. "Words are made up of kanji and radicals"

**URL:** `/` — home, words lesson lock card (`src/components/lesson/next-word-lesson.tsx:46`).

Words are not made of radicals; kanji are. The app's own radical "why?" says so (`why.ts:224`: *"A radical is a small shape that recurs inside many kanji"*), and this card's own next sentence talks only about kanji. The words track "why?" also says only *"Most are made of kanji"* (`why.ts:243`).

> **Words are made up of kanji.**

---

## 12. "The easiest ones first" — the same sentence, twice, calling a hard thing easy

**URLs:** `/` — grammar lesson lock card (`src/components/lesson/next-grammar-lesson.tsx:62`) and `/` — grammar track "Why?" (`src/data/why.ts:259`).

> Learn a verb on the words track and this grammar lesson opens. Patterns are taught starting with the **easiest** ones first.

> Patterns are taught starting with the **easiest** ones first so early grammar leans on the simple verbs and words you're already learning in the other tracks.

Two screens, near-identical sentence, and "easiest" is the judgement she asked the app not to make. "Simplest" is a claim about the pattern, not about the reader, and is the honest word here:

> Patterns come in order of how much machinery they need, so the early ones lean on verbs and words you already have.

Same card, `next-grammar-lesson.tsx:62`: **"Learn a verb on the words track"** — "the words track" is app furniture. The pass swept "grammar track" out of the okurigana card and left this one. → "Learn a verb and this grammar lesson opens."

Same card, `:57`–`:58`, the lede restates itself:

> **Grammar attaches to words.** Grammar needs words to apply to. Until you know a verb to practise with, you can't learn the verb ending.

The second sentence is the first sentence again. Cut it.

Same card, `:61`: **"〜ので leans on a な-adjective"** — な-adjective is jargon a beginner has not met on any prior screen.

---

## 13. The "It's not X, it's Y" tic, and a stray straight apostrophe

**URL:** `/` — grammar track "Why?" (`src/data/why.ts:257`).

> It's a different kind of thing from a word or a kanji. **It's a rule for combining, not another item to memorize.**

The construction she flagged, and the sentence before it already made the point. Also note this sentence uses a straight `'` while the sentence before it uses a curly `’` — visible on screen as two different apostrophes in consecutive sentences.

> It's a different kind of thing from a word or a kanji: a rule for combining rather than another item to memorize.

**Related, `why.ts:82`:** *"which is why it's a quick second step rather than a whole new climb"* — same shape, and "quick" is calling a hard thing easy. The two preceding sentences (same sounds, new shapes) already earn the point without the verdict.

---

## 14. The stroke-order "out" is a 33-word instruction manual

**URL:** `/session` — any character step, "How it's written", behind "Why?" (`src/components/lesson/how-its-written.tsx:153`).

> That being said, if you would prefer to learn how to write now, expand this section using the **Show** button above and you will see stroke order step by step as well as in an animation.

"That being said" is throat-clearing, and the rest narrates two controls and their contents. The paragraph above it (`WHY_WRITING_EARLY`, which is hers and should not be touched) is short, blunt sentences; this one is a single clause-chain.

> If you'd rather learn to write now, hit **Show** — the strokes are there, in order and animated.

Lower-confidence note, flagged rather than rewritten: `WHY_WRITING_EARLY` and the radical "why?" both speak as **"we"** (*"We don't recommend…"*, *"We think your time is better spent…"*, *"We teach a radical just before…"*), while every other screen has no narrator at all. That may be deliberate — it is where the app is giving advice rather than facts — but it is the one place a second voice appears, so it is worth a decision rather than a drift.

---

## 15. Jargon appearing before it is taught

- **"combo"** — never defined anywhere, and used in three places a beginner reaches early: the Library shelf headings `HIRAGANA · COMBO き` (`/library`, from `src/data/characters.ts:197`+), the kana family table cell `Combos` (`/library/hiragana/き`, `src/lib/library/kana-family.ts:113`), and inside the teaching card itself — *"Every **combo** is two characters you already know, one of them shrunk"* (`/library/writing-rule/small-ya`, `phase-intros.ts:254`) and *"Same rule as the hiragana **combos**"* (`:277`). The card that would define it never does. Either define it in the first line of `COMBO_H`, or say "pair" / "these" in the prose and leave "combo" to the section labels.
- **"romaji"** — `/session` drill input placeholder *"Type romaji, Enter to submit"* (`src/components/quiz/drill-screen.tsx:1178`) and `/practice` mode buttons *"Type romaji"* (`src/components/practice/quiz-options.tsx:76, 98`). Reachable on the reader's first quiz. "Type the sound" or "Type it in English letters" costs nothing.
- **"な-adjective"** — `/` grammar lock card (§12).
- **"い-adjective"** — `/library/writing-rule/okurigana`, *"On a verb or an い-adjective, the tail changes"* (`phase-intros.ts:588`).
- **"furigana"**, **"JLPT"** — `/resources` blurbs (`src/data/resources.ts:113`, `:83`). Defensible on a page of outside links, but "furigana" in particular is used with no gloss and the app never teaches the word.

---

## 16. Em dashes

The sweep is clean. Every em dash in `src/` is in a code comment or a doc block, which is house style, except:

- **`/library/kanji/生`** (and every entry page with a readings table) — `— {row.answer}` (`src/app/library/[...entry]/page.tsx:878`), rendering as `セイ — life` in the "how it's going" table. A separator rather than prose, but it is an em dash a learner sees. Use `·`, which the app already uses as its separator on the same screens (`a · i · u · e · o`, `ame · rain`).

The bare `—` used as a null placeholder in `src/lib/accuracy.ts:175`, `src/components/library/kanji-readings.tsx:129`, `src/components/lesson/lesson-readings.tsx:115`, `src/lib/library/sub-label.ts:42` and `src/components/lists/manage-lists.tsx:73` is the "no value" glyph, not punctuation. I would leave these; flagging only because a literal reading of the rule catches them.

---

## 17. Text that is doing nothing

- **`/`** — *"Learn them first. Step through each one: its picture, its sound, and how it's written, before you're quizzed."* The button underneath says **Start**, and the walk shows all three things a second later. "Learn them first" is instruction for a screen with one obvious action.
- **`/stats`** — *"Nothing yet. Drill something and it will show up here."* The empty state four rows down does this properly (*"Two things have to get tangled before they can show up here"* — that one is hers, keep it exactly). This one tells you to operate the app. → "Nothing yet."
- **`/library`** — *"Every character, reading and word the app knows. Search it, or open a shelf."* Second sentence describes a search box and some headings that are both visible. → "Every character, reading and word the app knows."

---

## Genuinely good, left alone

Named so nobody "improves" them: the kanji/radical "why?" answers in `why.ts` (`WHY_KANJI`, `WHY_TRACK.radical`, `WHY_TRACK.words`); the whole Settings tooltip layer, which is the most consistent voice in the app; `WHY_WRITING_EARLY`'s two paragraphs; the small-っ and iteration-mark cards; the "things you mix up" empty state; the mnemonic sound cues (*"Say the open ah in father"*); and `/settings`' clear-everything body copy. These are plain and blunt on purpose and read as one person throughout.
