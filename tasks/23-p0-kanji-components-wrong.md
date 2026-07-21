# P0 · The "Made of" row teaches wrong kanji components

**Status: needs review** — found overnight, measured, NOT fixed

Surfaced as a low-confidence flag in `AUDIT-2-japanese.md` (§F, on `/library/kanji/前`).
The auditor wrote: *"if other kanji show the same shape it is systemic."* I checked.
It is systemic, and it is worse than the one page they saw.

## Why this is P0

The kanji track's entire premise is stated in `why.ts`: *"kanji are how words are
built, and knowing the pieces means new words aren't fully new."* The "Made of" row
IS that promise. When it is wrong, it is not a cosmetic error, it teaches a false
building block that a learner will then use to reason about every other kanji
containing that shape.

## Defect 1 · The person radical 亻 is shown as 化

**Measured: 109 kanji list 化 as a component.** The great majority do not contain
it. They contain 亻.

```
休 -> 化 + 木        should be 亻 + 木   (a person beside a tree = rest)
仁 -> 化 + 二        should be 亻 + 二
何 作 使 借 住 体 ... ~100 more, all 亻-left
```

**This destroys the mnemonic rather than merely being inaccurate.** 休 is one of the
first kanji taught and its whole story is a person resting against a tree. The app
currently says it is "change" plus "tree".

### A blanket substitution would be WRONG — I checked before proposing one

Some of the 109 genuinely contain 化 and must keep it:

```
花 -> 化 + 匕 + 艾     花 IS 艹 + 化, correct
貨 -> 化 + 貝 + 目 + ハ + 匕
靴 -> 化 + 革 + 匕
貸 袋 褒 also legitimate
```

So the fix must distinguish "亻 misidentified as 化" from "化 correctly present",
not sweep the character.

## Defect 2 · The decomposition is a flattened recursive walk

Intermediate nodes and their own children are listed side by side, at the same
level, so the meaningful component is lost among its own parts:

| kanji | shows | should be | what was lost |
|---|---|---|---|
| 時 | 寸 + 土 + 日 | 日 + 寺 | **寺, the phonetic** |
| 語 | 言 + 口 + 五 | 言 + 吾 | 吾 |
| 校 | 父 + 木 + 亠 | 木 + 交 | 交 |
| 前 | 一 + 刈 + 月 + 并 | 丷 + 一 + 月 + 刂 | (and 刈, 并 are wrong outright) |
| 貨 | 化 + 貝 + 目 + ハ + 匕 | 化 + 貝 | 目/ハ are inside 貝; 匕 is inside 化 |

**寺 is the single most valuable fact about 時** — it is the phonetic, shared with
持, 待, 詩, 侍. Flattening it to 土 + 寸 throws away exactly the transfer the kanji
track exists to teach.

Correct cases do exist and should be preserved: 明 → 月 + 日, 男 → 田 + 力.

## Where it lives

`comps` is baked into `src/data/generated/kanji.json` per row:

```json
{"c": "休", "meanings": ["rest", ...], "comps": ["化", "木"]}
```

Read by `madeOf` (`src/lib/library/entries.ts:603`), rendered by the "Made of"
LinkRow (`src/app/library/[...entry]/page.tsx:443` and `:472`). The app code is
fine — **this is bad generated data**, so the fix belongs in whatever produces
`kanji.json`, plus a regeneration.

## Scale

- 2,136 kanji entries; **2,062 have a "Made of" row**.
- 736 (36%) list parts not including their own classical radical — though that
  figure is inflated by codepoint variants (｜ vs 丨, ノ vs 丿), which are the same
  radical in a different character and are NOT a bug. Do not chase that 36%; it is
  a soft signal, not a count of errors.
- 109 involve the 化 confusion specifically. That one is exact.

## Why I did not fix it overnight

It is data-generation work. It needs the KanjiVG (or equivalent) source, a decision
about **what depth to stop at** — which is a teaching decision, not a technical one
— and validation against a reference for 2,062 entries. Getting it wrong replaces
one set of false components with another, and the app states components as fact.

The depth question is the real one and it is Sam's: 時 should show 日 + 寺, not
日 + 土 + 寸, but "stop at the first meaningful level" needs a definition the
generator can apply.

## Done when

- 休 shows 亻 + 木.
- 時 shows 日 + 寺.
- 花 still shows 化.
- A test asserts a sample of known-correct decompositions, so a regeneration cannot
  silently reintroduce this.
