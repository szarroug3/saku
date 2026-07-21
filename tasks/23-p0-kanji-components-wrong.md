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

## RECOMMENDED FIX — for Sam's approval

**This is factually incorrect, not a copy problem.** 休 is not made of 化. So the
fix is to the data, and one change addresses both defects at once.

### Regenerate `comps` from IDS, taking only the top level

Ideographic Description Sequences model a kanji's structure as a tree with
composition operators:

```
休 = ⿰亻木          top level -> 亻 + 木          (fixes the 化 bug)
時 = ⿰日寺          top level -> 日 + 寺          (keeps the phonetic)
語 = ⿰言吾          top level -> 言 + 吾
校 = ⿰木交          top level -> 木 + 交
貨 = ⿱化貝          top level -> 化 + 貝          (keeps legitimate 化)
明 = ⿰日月          top level -> 日 + 月          (already correct, stays correct)
```

**Taking only the top level is the whole fix.** The current data is a full
recursive walk flattened into one list, which is why 貨 shows 化 + 貝 + 目 + ハ + 匕
— 目 and ハ are inside 貝, and 匕 is inside 化. Stopping at depth 1 removes them.

And because IDS describes 休 as ⿰亻木, the 亻/化 confusion cannot survive the
regeneration. It is not a substitution table; the wrong answer simply stops being
produced.

### Why this answers the depth question

The card asks what depth to stop at, and calls it a teaching decision. **IDS turns
it into a mechanical one: depth 1.** That gives 日 + 寺 rather than 日 + 土 + 寸,
which is what a learner needs, because 寺 is the phonetic shared with 持, 待, 詩
and 侍.

It also fails safe. Where a top-level part is not itself a taught character, the
learner sees a component they have not met rather than a wrong one — worth
checking the count of those before shipping, but a much smaller problem than
teaching 休 as "change plus tree".

### What still needs a ruling from Sam

- **Components that are not themselves kanji you teach** (蔵-style parts, and
  bound forms like 亻 which is a variant of 人). Show them plain, link them to the
  parent character, or suppress the row for that kanji? I lean on showing them, since
  a component you have not met is still true.
- **Whether 亻 should display as 亻 or as 人.** They are the same character
  historically and 人 is the one that gets taught. Showing 亻 is accurate; showing
  人 is more useful on day one. My preference is 亻 with 人 linked.

### Not recommended

A targeted correction table for the 109. It fixes the visible symptom and leaves
the flattening, which is the defect that costs more teaching value.

## Done when

- 休 shows 亻 + 木.
- 時 shows 日 + 寺.
- 花 still shows 化.
- A test asserts a sample of known-correct decompositions, so a regeneration cannot
  silently reintroduce this.
