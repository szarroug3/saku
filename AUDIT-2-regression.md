# Audit 2 — browser regression check

**Checkout:** `/Users/samreenzarroug/git/personal/kq-audit-a2`
**Server:** `pnpm exec next dev -p 3362` → http://localhost:3362
**Method:** driven in a real browser (Claude Browser tools). Every claim below is backed by
text/screenshots read out of the running page. `location.href` was re-asserted before each
finding (see "Environment hazard" at the end — this mattered).

---

## Scoreboard

| # | Claim | Verdict |
|---|---|---|
| 1 | Reveal shows the answer, not your own question | **CONFIRMED** (all 4 subjects) |
| 2 | en2jp kana cannot be self-answered | **CONFIRMED** |
| 3 | Accuracy does not fall as you practise | **STILL BROKEN (partially fixed)** |
| 4 | The round summary adds up | **CONFIRMED** |
| 5 | A perfect retry visibly changes something | **CONFIRMED** |
| 6 | Progress survives + rest-screen copy | **CONFIRMED** |
| 7 | Romaji graded correctly on grammar production | **CONFIRMED** |
| 8 | No kana shows a dash for its reading | **CONFIRMED** |
| 9 | Words shelf starts with common words | **CONFIRMED** |
| 10 | 〜てある is restricted | **CONFIRMED** |
| 11 | Grammar examples demonstrate their pattern | **CONFIRMED** |

One item is still broken. Details and repro below, then a "what the fixes broke" section.

---

## 1. Reveal shows the answer, not your own question — CONFIRMED

Config: Direction = **English → Japanese** only, `retryN: 2`, `showAnswer: true`. Each card was
missed **twice** to exhaust retries. Reveal text captured with a `MutationObserver` because a
multiple-choice miss auto-advances after 1600 ms.

All four subjects show the **answer**, never the prompt echoed back:

| Subject | Prompt | Reveal seen (verbatim) |
|---|---|---|
| Kana (MC) | `ke` | `ke = ケ` |
| Kanji meaning (typed) | `winter` | `winter = 冬` |
| Kanji reading (typed) | `ぜん read this way in 修繕` | `ぜん read this way in 修繕 = 繕` |
| Word meaning (MC) | `breaking off a relationship in japanese` | `breaking off a relationship in japanese = 絶交` |

No `a = a` / `life = life` shape anywhere. This one is genuinely fixed.

## 2. en2jp kana cannot be self-answered — CONFIRMED

Library → Kana → "Quiz me 214" with Direction = English → Japanese lands on `/quiz` showing:

> `ke` — **GIVE THE KATAKANA** — `ピャ 1  ビ 2  ラ 3  ケ 4  ド 5  ノ 6`

A six-option board, keyboard-selectable 1–6. No text input is rendered on kana en2jp cards.
Confirmed again on a second pool (`o` → `あ 1 ぢょ 2 しゃ 3 ぺ 4 お 5 む 6`).

## 3. Accuracy does not fall as you practise — STILL BROKEN (partially fixed)

**The bug described in the brief is fixed.** Repeating the same fact correctly does *not* halve
the pill. With a 5-fact pool (hiragana vowels, en2jp MC) answered correctly first-try every
single time, the pill read, per answer:

```
answer 1..4 → 100%   (5 distinct facts, first pass)
answer 5    →  83%
answer 6    →  86%
answer 7    →  88%
answer 8    →  89%
answer 9    →  90%
answer 10   →  91%
```

Answers 5–10 were **repeats** of already-answered facts, and accuracy *rose* toward 100% instead
of collapsing to 50% then 33%. The repeat-penalty regression is gone.

**But the pill still does not stay at 100%, and it contradicts the other two counters on the
same screen.** At the end of that run the quiz HUD read, verbatim:

> `10 answered   91% first try   🔥 10`

A streak of **10** means ten consecutive correct answers with no miss. 91% is therefore wrong.
Ending the run, the Results screen said, verbatim:

> **91%**
> **Clean run, nothing missed**
> お took over 5s though, and speed is what's left
> **5 / 5 first try · 1 slow but right**

So one screen simultaneously claims `91%`, `Clean run, nothing missed`, and `5 / 5 first try`.
`5 / 5 first try` is 100%.

**Mechanism (from the evidence):** exactly one answer was flagged **Slow** (お, "took over 5s"),
and the pill lost exactly one unit of denominator. A slow-but-correct answer is being deducted
from a counter *labelled* "% first try", which it is not a miss of. The drop appeared at the
first slow card, not at the first repeat.

### Reproduction

1. Settings/Practice: Direction = English → Japanese, EN→JP answers = Multiple choice.
2. Library → Kana → click the section header **Hiragana · Vowels あ** to select those 5 → **Quiz me 5**.
3. Answer every card correctly, but let **one** card sit for more than 5 seconds before answering
   (`slowFloorMs` is 1500 ms; the "Slow" flag fired at >5 s).
4. Watch the pill: it drops below 100% while the 🔥 streak keeps counting up unbroken.
5. End quiz. Results shows a sub-100% ring next to "Clean run, nothing missed" and "N / N first try".

**Expected:** the "% first try" pill equals `first-try-correct ÷ facts asked`, agrees with
"N / N first try" on the Results screen, and cannot disagree with an unbroken streak.

**Note on tooling bias:** each of my answers took several seconds because they were driven through
tool round-trips. A human plays faster and would trip the Slow flag less often — but the
contradiction is real and reproducible whenever it does trip, and the label "% first try" is wrong
regardless of how often it fires.

## 4. The round summary adds up — CONFIRMED

Session flow (Home → "Quiz me on these only" for か-group). Round-end screen, verbatim:

> **Round 1**
> **11 questions · 8 right first try · 3 needed another look**

8 + 3 = 11. ✅

After a retry leg it re-rendered as:

> **13 questions · 10 right first try · 3 needed another look**

10 + 3 = 13. ✅ Still sums after the retry.

⚠️ See "What the fixes broke" #2 — the quiz HUD said `10 answered` for the same leg the summary
calls `11 questions`.

## 5. A perfect retry visibly changes something — CONFIRMED

Missed か and こ once each. Round screen offered **"Retry 2"** with the copy
*"Your 2 misses are picked. Add or drop any character."*

Clicked Retry 2, answered both correctly (`0 / 2` → `1 / 2 100% first try` → done). The screen it
returned to was **not** identical — four things changed:

- Counts: `11 questions · 8 right first try · 3 needed another look` → `13 questions · 10 right first try · 3 needed another look`
- New green line appeared: **`Back on the retry: こ か`**
- Copy changed to: *"You got all 2 back. Nothing left over, but pick anything you want another look at."*
- Button changed from **`Retry 2`** to **`Retry …`** — it no longer offers "Retry 2".

## 6. Progress survives — CONFIRMED

Completed Round 1 → rest screen. Verbatim, at the bottom of `/session`:

> **Your finished rounds are saved.** Reloading or closing the page will not lose your progress.

Then `location.reload()`:

- Still on `/session`, still `5 items · resting before round 2`.
- Countdown continued rather than resetting (`UNTIL ROUND 2 4:47` → `4:25` after reload).
- `/stats` afterwards: **`10 solid`**, **`Kana 10 of 214`**, and `THINGS YOU MIX UP · 2`.
- Home advanced from `GROUP 1 OF 27` to **`UP NEXT · HIRAGANA · GROUP 2 OF 27`**.

Progress is genuinely persisted across reload.

## 7. Romaji graded correctly on grammar production — CONFIRMED

Grammar production cards are typed in the **jp2en** direction (en2jp falls back to multiple choice
whenever the answer contains kanji — see `drill-screen.tsx:484`, `en2jpTypeable`). Set Direction =
Japanese → English (`styleJp2en: "typed"`), then Library → Grammar → Quiz me 143.

- Card: `行く` / **〜たら form**. Typed `ittara` → box live-converted to `いったら` → **Enter**.
  Accepted: `1 answered · 100% first try`, advanced with no reveal.
  (Target is `行ったら` with kanji; the kana romaji spelling was correctly accepted.)
- Card: `行く` / **〜なきゃ form**. Typed `ikanakya` → **Enter**. Accepted: `2 answered · 100% first try`.

## 8. No kana shows a dash for its reading — CONFIRMED

`/library?kind=kana`. **Zero `—` characters on the entire page** (counted in the DOM). All the
named cases render real readings:

`し shi · si` · `ち chi · ti` · `つ tsu · tu` · `を wo · o` · `ん n · nn` ·
`しゃ sha · sya` · `ちゃ cha · tya` · `じゃ ja · jya · zya`

Katakana equivalents likewise (`シ shi · si`, `ヲ wo · o`, `ン n · nn`, `ジャ ja · jya · zya`).

## 9. The words shelf starts with common words — CONFIRMED

`/library?kind=word` → **EVERYDAY WORDS**, *"Common everyday words. The first 120 are here.
Search to find any of the others."*

First tiles, in order: **何 (なに) · あなた · 言う (いう) · 行く (いく) · 知る (しる) · 話 (はなし) ·
話す · 来る · 聞く · 前 · 中 · あの · 大丈夫 · 自分 · 持つ · 時間 …**

Searched the rendered shelf for the four bad words — **あべこべ, あやふや, うんこ, おっぱい: all absent.**
The tail of the 120 is likewise ordinary (`医者 · 映画 · 町 · 始まる`).

## 10. 〜てある is restricted — CONFIRMED

`/library/grammar/te-aru`, verbatim:

> **〜てある** — has been done (and stays done)
> attaches to **a verb that somebody does to something**
>
> **HOW TO BUILD IT** — `any verb that somebody does to something` → `て-form` + `ある`
> Any verb you know that somebody does to something: **書く → 書いてある · 食べる → 食べてある · 話す → 話してある**

No bare "any verb", and **no 行く → 行ってある**. The restriction is stated in plain language
("a verb that somebody does to something" = transitive) rather than jargon.

Minor: the phrase still *contains* the substring "any verb", but always qualified — never the bare
unrestricted claim the bug was about.

## 11. Grammar examples demonstrate their pattern — CONFIRMED

The entry page carries no example sentences; they appear in the **lesson** (Teach me). The
〜ので lesson shows, verbatim:

> **Used like this**
> 私の娘は尻が重いので困る。
> My daughter's slowness to take action is a pain.

That sentence **does contain ので** and uses it causally. The old bad example is gone.

Verified corpus-wide against the shipped data rather than trusting one sample:

- `grammar-corpus.json`: **89 examples tagged `node`, and 0 of them lack ので.**
- `kara-reason`: **213 examples, 0 of them lack から.**
- 「ログアウトするんじゃなかったよ」 is **not present anywhere in the shipped corpus.**
- Build meta records the audit: `{"patterns":["ba","kara-reason","made-ni","nikui","node","ta-tokoro"],"droppedExamples":506,"droppedSentences":142}`.

⚠️ Caveat, not a failure: the English gloss *"My daughter's slowness to take action is a pain"*
does not render the "because" structure, so the one example on screen shows the **form** of ので
but not its **meaning** in translation. 尻が重い is also an idiom a learner at this level won't know.
Worth a better example; not the bug that was filed.

---

## What the fixes broke — findings beyond the eleven

### 1. `% first try` contradicts both the streak and the Results screen (see #3)
Highest-value finding here. One screen showing `91%`, `Clean run, nothing missed`, `5 / 5 first
try` and `🔥 10` at the same time is a number the user cannot reconcile. Repro in §3.

### 2. Quiz HUD `N answered` disagrees with the round summary `N questions`
Same leg, two screens, two numbers:

- In-quiz HUD at the moment I pressed End quiz: **`10 answered`**
- Round-end summary for that leg: **`11 questions · 8 right first try · 3 needed another look`**

The summary is internally consistent (8+3=11), so item 4 passes — but it counts one more question
than the HUD ever admitted answering. Consistent with the same off-by-one behind §3 (an in-flight
or slow card entering the "asked" tally). Repro: start any drill, answer exactly 10 cards, press
End quiz, compare the two numbers.

### 3. Patterns with no example sentence — **pre-existing, NOT caused by these fixes**
I checked this specifically because the brief warned about corpus filtering starving patterns.
It did not happen:

- The six audited patterns all retain healthy counts after filtering:
  `ba 257 · kara-reason 213 · made-ni 85 · nikui 63 · node 89 · ta-tokoro 139`.
- The only patterns at or near zero were **already** zero *before* the audit ran:
  `ta-ato-de 0 (0 before cap too) · zurai 9 · tari-tari 26 · nakute-wa-ikenai 27`.
- **〜てある has no examples by design**, documented in `grammar-corpus-meta.json → noSignature`:
  *"てある vs ている overlap in the tagger's 有る/居る split more than is safe."* 22 patterns are in
  that list.

Rendering degrades cleanly: `/api/grammar-example?recipe=te-aru` and `?recipe=ta-ato-de` both
return `null`, and the lesson simply omits the "Used like this" panel — **no empty panel, no
blank value, no error**. Verified in the browser on both `/library/grammar/te-aru` and
`/library/grammar/ta-ato-de`.

### 4. Console and network — clean
No JavaScript errors on any page visited (`/`, `/practice`, `/library` all shelves, `/library/[entry]`,
`/quiz`, `/session`, `/results`, `/stats`). One benign artifact:

```
GET /api/grammar-example?recipe=te-aru → [FAILED: net::ERR_ABORTED]
GET /api/grammar-example?recipe=te-aru → 200 OK
```

An aborted-then-retried fetch, i.e. the React StrictMode double-effect cancelling its first
request in dev. Not user-visible. All `/api/history`, `/api/lists`, `/api/session` calls returned 200.

(The only console errors seen at all were `Encountered a script tag while rendering React
component…` — emitted by the Next dev overlay on first paint, present on every page including
untouched ones, and not attributable to these fixes.)

### 5. Cosmetic / data nits worth a glance
- **Prompt casing:** a word-meaning card read `breaking off a relationship in japanese` — lowercase
  "japanese" in a user-facing prompt.
- **Library gloss for 前:** the words shelf lists **前 / ぜん**. For the common everyday word the
  reading should be **まえ**; ぜん is the on-reading. Visible on the first screen of
  `/library?kind=word`, tile 10.

---

## Environment hazard — read this before re-running

Four dev servers were live during this audit, one per parallel audit checkout:

```
3361 → kq-audit-a1    3362 → kq-audit-a2 (mine)
3363 → kq-audit-a3    3364 → kq-audit-a4
```

**The shared browser pane was hijacked mid-session from 3362 to 3364** by a parallel agent, while
the tool's own tab-context banner still printed `http://localhost:3362`. I caught it because
`localStorage` came back with an unexpected config, and re-checked `location.href` directly.

Every finding in this report was (re-)verified with an explicit `location.href` read showing
`http://localhost:3362/...`, on a dedicated tab. **Do not trust the tool's reported URL** — assert
`location.href` in-page before believing any observation.

Two other tooling notes for whoever repeats this:
- The browser pane's screenshot space and the page viewport must be made to match, or coordinate
  clicks below the mismatch line are silently swallowed (this is why "Quiz me" appeared to do
  nothing at first). `resize_window` to 760×540 aligned them.
- `key: "Return"` and `key: "Backspace"` do not reach the page; `key: "Enter"` does. The answer box
  is a live romaji→kana IME, so typed text is converted as you go (`zzz` → `っっz`).
