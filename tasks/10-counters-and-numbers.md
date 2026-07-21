# Numbers and counters — a separate track · PROPOSAL, awaiting Sam's approval

**Status: needs review** — Sam ruled 21 July that this becomes its own track and
asked for a gating proposal to approve.

## What is already in the data (measured, not assumed)

This changes the shape of the work, so it goes first:

| counter | counted forms present in vocab |
|---|---|
| **〜つ** (generic) | **complete** — 一つ through 九つ |
| **〜人** (people) | 一人 ひとり · 二人 ふたり · 四人 — **the three irregulars, which are the ones that matter** |
| **〜匹** (animals) | 一匹 いっぴき only |
| **〜本** (long things) | **none** |
| **〜枚** (flat things) | **none** |

All 13 number kanji (一〜十, 百, 千, 万) are present. Ten counters exist as vocab
rows but **as nouns, not as counters** — 本 is in there as "book", 回 as "a time".

**So the two counters a beginner needs first are already done, and the missing ones
are exactly the ones that teach the sound-change rule.** Phase 1 costs almost
nothing; phase 2 is where the authoring is.

## The constraint that should drive this

The app's established pattern is **word-gating**: `lesson-steps.ts` teaches a rule
when a real word first needs it, and `phase-intros.ts` says why — "rather than
hypothetical". Counters are the awkward case, because they are genuinely a
*system*: the whole point of 一本 いっぽん / 三本 さんぼん / 六本 ろっぽん is the
pattern across them. Word-gating would scatter that across six unrelated nouns and
the learner would never see it as one rule.

That tension is the real design question here, and it is why a separate track is
probably right.

## Three gating options

### A · Word-gated inside the existing vocabulary track
Counters ride in on the first word that needs one. Cheapest, perfectly consistent
with everything else.
**Against:** it fragments a system into scattered exceptions. The sound-change rule
never gets a moment where it is visible as a rule.

### B · Separate track, phase 1 gated on KANA only · **recommended**
Numbers and the first two counters need no kanji at all. いち, に, さん, ひとつ,
ひとり are sounds and words; you can be useful with them on day two. Prices, ages,
ordering food, "two people" at a restaurant.

Then **phase 2 gated on the number kanji being solid**, because 三本 cannot be read
until 三 can. That is where the sound changes live and where the authoring is
needed.

**Against:** brief duplication — "the word いち" and "the kanji 一 read いち" are two
facts about one thing. Manageable: the number track owns the *word*, the kanji
track owns the *character*, and they cross-link, exactly as words and kanji already
do.

### C · Separate track, all of it gated on kanji 一〜十
Conceptually cleanest — you read numerals before you count with them.
**Against:** it puts a day-one survival skill behind the kanji track. A learner who
can read hiragana can already say "two, please" and this would stop them.

## The proposal, concretely

**Phase 1 — needs kana only. Nearly free, the data exists.**
1. Numbers 1–10 as spoken words, including the branches: 四 よん/し, 七 なな/しち,
   九 きゅう/く. These are not trivia — picking wrong is the commonest beginner tell.
2. **〜つ, the escape hatch.** Taught explicitly as the counter you use when you do
   not know the right one. This is the single most useful thing in the whole track
   and it is already fully in the data.
3. **〜人**, with ひとり and ふたり as the irregulars they are. Already present.
4. 11–99, then 百 / 千 / 万.

**Phase 2 — gated on the number kanji. This is the authoring.**
5. 〜本 / 〜枚 / 〜匹 as a set, chosen because together they teach the h→p/b shift:
   一本 いっぽん, 三本 さんぼん, 六本 ろっぽん, 八本 はっぽん.
6. The sound-change rule itself, presented **the way the Writing rules shelf
   presents dakuten** — as a rule with a table, not as six memorised words. That
   shelf is the piece the beginner auditor called excellent, so it is the right
   model.

**Phase 3 — long tail, ungated.** 〜冊 〜台 〜杯 〜回 〜歳 as vocabulary, no new
machinery.

## Questions for Sam

1. **Approve option B?** Phase 1 on kana, phase 2 behind the number kanji.
2. **Is 〜つ taught as the escape hatch?** I think it should be explicit — "when you
   don't know, use this and you will be understood" is true, useful, and the kind
   of thing someone who has been through it tells you.
3. **How many counters total?** I propose 5 taught properly (つ 人 本 枚 匹) and the
   rest as plain vocabulary. More than that and it becomes a memorisation slog for
   a beginner.
4. **Does this become a seventh SUBJECT** (`src/lib/facts.ts:29`) with its own fact
   kind, or vocabulary with a track label? Real consequences for scoring and the
   Library shelf; I lean toward vocabulary with a label, since the counted forms
   genuinely are words.

## Done when

Sam has approved the gating. Nothing is built before that.
