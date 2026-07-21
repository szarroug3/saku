# P1 · Three shipped-data problems that make the app look unfinished

**Status: in progress** — `lists.json` done; items 2 and 3 dispatched on `fix/shelf-data`

## Decision

**Sam ruled: sort the words shelf by `beginnerRank`** (item 3), and investigate and
fix the dashed readings (item 2). Glosses in the grid remain out of scope.

**Item 2 root cause, found before dispatch:** `src/components/library/entry-tile.tsx:79`
shows a reading only when there is exactly one, else falls back to `meanings[0] ?? "—"`.
That guard is right for kanji — 生 has nine readings and showing one would present it
as THE reading — but kana carry no meanings, so any kana with more than one
romanisation dashes. Measured: **42 entries, all `kind === "kana"`; zero non-kana
entries reach the fallback.** Their multiple readings are alternative spellings of one
sound (し = shi·si), not distinct readings, so the kanji protection does not apply.

All three verified directly. All three are visible within a minute of installing.

## 1 · A list named "test" ships to every user

`lists.json` is **tracked in git** and contains exactly one list:

```
name="test"  kind=fixed  entries=213
```

On a fresh install it appears on Lists, on Practice, and on individual character
pages, labelled *"your list"*. The user has never made a list.

**Fix:** stop tracking `lists.json`, or track an empty one. Decide which, because
untracking it means a fresh clone has no file at all and the loader must handle
that. Check `history.json`'s treatment for the pattern already in use.

## 2 · About 40 Library entries show their reading as "—"

In the Library grid: し, ち, つ, ふ, を, ん, じ, ぢ, づ and every しゃ/ちゃ/じゃ
combination.

**These are exactly the irregular kana a beginner most needs told.** The ones
whose romanisation is not mechanical are the ones showing a dash.

The detail pages are fine — `/library/hiragana/shi` correctly says "shi · si". It
is only the grid, so this is a display bug rather than missing data.

**Fix:** find why the grid's reading lookup misses these and show the reading it
already holds.

## 3 · "Common everyday words" is not common everyday words

The words shelf says *"Common everyday words. The first 120 are here."* The actual
first twenty, verified:

> 明白 あそこ あっさり あっという間に あの あの人 あの方 あべこべ あやふや あら
> あれ あんな いやいや いかにも いざこざ いそいそ いらっしゃい いらっしゃいませ
> うずうず うっかり

あべこべ (topsy-turvy), あやふや (vague), いざこざ (trouble), うずうず (itching
to) are not core vocabulary. The tester continued into うんこ, ウンチ, おしっこ,
おっぱい — vulgar words, inside the first 120 of a beginner's shelf, with no
English glosses in the grid to warn you what you are looking at.

The ordering is clearly not frequency, despite the label claiming it is. The app
**has** `beginnerRank`, and the kanji shelf already sorts by teaching order, so the
machinery exists.

**Fix:** sort the words shelf by `beginnerRank` like the rest of the curriculum,
or change the label to describe what it actually shows. Prefer the former. While
there, consider whether the grid should show glosses; without them the shelf is
unreadable to the person it is for.

## Done when

- A fresh install has no lists.
- No kana in the grid shows a dash for its reading.
- The first screen of the words shelf is words a beginner would recognise.
