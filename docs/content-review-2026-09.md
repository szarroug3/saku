# What Saku teaches, checked three ways

September 2026, SAK-418. Nothing in this review changed any content. The last
section is the list to research; everything before it is how the list was
arrived at, and what it does not cover.

The question was: is what the app teaches actually correct, without the owner
knowing Japanese and without hiring anyone. Three kinds of content need three
different answers, so this is three checks, not one.

| Kind of content | The check | What it can prove |
|---|---|---|
| Sourced facts | Traceability: a test that the taught value equals the file it came from | Nothing changed it on the way to the screen |
| Derived facts | A second, independent derivation, then a diff | Two people working apart got the same answer |
| Hand-written explanations | Two readers with a rubric, keeping only what one of them doubts | Somebody who is not the author read every sentence |

## The limit, up front

The raw upstream archives are not in this repository. `scripts/ingest/build.py`
takes `kanjidic2.xml`, `JMdict_e` and `KRADFILE` by `--src`; `grammar.py` takes
the Tatoeba dump the same way. So no test here can reach KANJIDIC2 itself. The
pin is to the **committed reduction** under `src/data/generated/`, and it covers
every step after that reduction: the app's transforms, the hand-written override
tables, the merges, the runtime caches. That is where changes actually happen.
The reduction itself, and re-running an ingest against a newer upstream, remain
unchecked. Committing a hash of each upstream archive beside its reduction would
close that, and is a separate card.

---

## 1. Inventory

### Sourced

| Kind | File | Count | Source | What the learner sees |
|---|---|---|---|---|
| Kanji meanings, on/kun, strokes, grade, frequency | `generated/kanji.json` | 2,136 kanji | KANJIDIC2 | The kanji card |
| Kanji components | `generated/kanji-components.json` | 2,068 comps, 58 variants, 362 primitives | KanjiVG (was KRADFILE) | "Made of" tiles |
| Kangxi radicals | `generated/radicals.json` | 214 | Unicode UCD + KANJIDIC2 | Radical pages |
| Bushu names and variant forms | `generated/radical-enrichment.json` | 214 rows | Kanji Alive + Unicode | The radical's Japanese name |
| Kanji to its classical radical | `generated/kanji-radicals.json` | 2,136 | KANJIDIC2 | Which shelf a kanji sits on |
| Word forms, readings, glosses, POS | `generated/vocab.json` | 12,553 words | JMdict | The word card |
| Extra readings by sense | `generated/word-senses.json` | 117 words, 243 senses | JMdict | 人 as ひと / じん / にん |
| Sense boundaries | `generated/word-definitions.json` | 5,219 words | JMdict | The definition list |
| Kanji readings anchored to words | `generated/readings.json` | 3,496 rows | KANJIDIC2 + JMdict | Every reading quiz card |
| Pitch accent | `generated/pitch.json` | 8,684 of 12,553 words | Kanjium (NHK, Daijirin) | The pitch mark |
| Example sentences | `generated/grammar-corpus.json` | 9,653 | Tatoeba | Grammar drill sentences |
| Stroke order | `generated/strokes/` | 2,136 kanji + kana | KanjiVG | The stroke animation |
| Kanji glyph origin, raw | `generated/kanji-etymology.json` | 2,015 kanji | English Wiktionary | Superseded by the prose rewrite; see below |
| Conversation frequency | `generated/cejc-reading-frequency.json` | 7,661 words | CEJC 2022.09 | Which reading is taught first |

### Derived

| Kind | File | Count | Derived from |
|---|---|---|---|
| Conjugated forms | `src/lib/conjugate/` | 22 classes x 22 forms | JMdict class tags plus the rules table |
| Per-kanji reading alignment | the `align` field | 10,147 of 12,553 words | `scripts/ingest/aligner.py`, a heuristic |
| Teaching order | `generated/order.json` | 2,136 | KANJIDIC2 + KRADFILE + JMdict |
| Pitch homophone pairs | `generated/pitch-pairs.json` | 184 pairs | `pitch.json` |
| One example per word | `generated/word-examples.json` | 2,990 | picked out of the grammar corpus |
| Sentence-assembly pieces | `generated/assembly-corpus.json` | 605 | re-tokenized grammar corpus |
| Word rank, vehicles, catalogues | several | 12,555 / 220 / many | recombinations of the above |
| Look-alike groups | `generated/confusable-derived.json` | 16 groups | shared components plus stroke count |
| The reveal's reading rule | `src/app/(sky)/quiz-rules.ts` | 4 rule templates | the reading row's type and surface |
| Why an option was on the board | `src/app/(sky)/quiz.ts` | 7 lines | the relationship between two facts |

### Hand-written

| Kind | File | Count |
|---|---|---|
| Kanji origin stories, rewritten | `etymology-prose/batch-*.ts` | 1,816 |
| Kanji origin stories, researched from scratch | `etymology-prose/manual-*.ts` | 283 |
| Grammar lesson pages | `grammar/lessons.ts` | 143 strings |
| Phase intros | `phase-intros.ts` | 103 strings |
| Kana mnemonics | `mnemonics.ts` | 92 |
| Glossary terms | `terms.ts` | 19 terms, 57 strings |
| Sentence-ordering guides | `sentence-ordering-guides.ts` | 10 tiers, 55 strings |
| Track intros | `track-intros.ts` | 54 strings |
| Grammar recipes | `grammar/recipes.ts` | 114 rows |
| "Why this order" | `why.ts` | 11 blurbs, 42 strings |
| Counter construction pages | `counter-categories.ts` | 18 pages, 39 strings |
| Form-building pages | `grammar/form-intros.ts` | 10 page sets, 26 strings |
| Grammar concept pages | `grammar-concepts.ts` | 3 pages, 19 strings |
| Near-synonym clusters | `grammar/clusters.ts` | 12 clusters, 17 strings |
| Writing marks | `marks.ts` | 19 |
| Transitivity pairs | `transitivity.ts` | 69 pairs |
| Keigo sets | `keigo.ts` | 9 sets |
| Radical recognition tips | `radical-tips.ts` | 6 |
| Kana notes, look-alikes, variants | `characters.ts`, `confusable.ts` | 11 notes, 34 groups, 5 variants |

Total hand-written English prose extracted mechanically: **2,854 strings**, of
which 2,099 are kanji origin stories.

**Every one of the 2,015 crawled Wiktionary etymologies now reaches the learner
as hand-written prose.** None of Wiktionary's own wording is shown, and none is
suppressed without a replacement. That is pinned by a test, and it is why the
origin stories are the largest single body of unreviewed authored claims in the
app.

---

## 2. Traceability

### What was already pinned

- `src/lib/strokes.test.ts` is the strongest pin in the repo: it reads
  `generated/strokes/*.json` and checks `KANJI.strokes` against KanjiVG's own
  count for all 2,136 jouyou kanji, with nine named exceptions.
- `audit-structural.test.ts` reads `pitch.json` directly and checks coverage,
  range and orphans.
- `comps-audit.test.ts` reads `kanji-radicals.json` and `radicals.json` for
  stroke conservation and radical reachability.
- `reading-frequency.test.ts` reads `cejc-reading-frequency.json` for seven
  named words.
- `vocab-runtime.test.ts` proves `vocab-runtime.json` equals a live rebuild
  from `vocab.json` plus CEJC.
- `audit-corpus.ts --check` proves no shipped example sentence lacks the pattern
  it is filed under. `check-assembly-freshness.ts` proves the assembly corpus
  was regenerated. Both run in CI, not in the pre-commit hook.
- The seven `*.equiv.test.ts` files prove each committed cache equals what the
  code would compute now. Valuable, but a different claim: they cannot catch a
  value that was wrong in the cache and in the code alike.

### What was not

Kanji meanings, on'yomi and kun'yomi, grade, newspaper rank, the "made of"
list, word readings and glosses, part-of-speech tags, the reading index, the
bushu names, the etymology records, the pitch pairs, and the example sentence on
a word page: **none of these had a test that compared the taught value to the
file it came from.**

### The tests added

`src/data/source-pins.test.ts`, 19 tests, all passing on current data. They read
the generated JSON on one side and the app's own exported table on the other.

Where the app deliberately differs from its source, the test does not paper over
it: it pins the exact set, so a new difference fails. Those pinned sets are
themselves findings, in that nothing named them before:

- **66 kanji** have their meaning list shortened by the metadata strip.
- **77 kanji** have a hand-written decomposition instead of KanjiVG's.
- **23 kanji** have a hand-remapped etymology record.
- **2 words** are hand-added to the vocabulary and are in no JMdict cut:
  えっ and いらっしゃる.
- **3 words** are taught with a reading other than the one `vocab.json` gives,
  because CEJC's conversation counts override it: 四 (よん not し), 七 (なな not
  しち), 九 (く not きゅう).
- **2,015 kanji** show a hand-written origin story rather than the file's text.
- **818 of 2,990** example sentences underline an inflected surface rather than
  the word's dictionary spelling.

Two of those turned into real doubts and are in the list below (九 as く; the
underline, which contradicts `WordExample`'s own documentation).

Nothing failed that could not be explained. No taught value was found to differ
from its source without a documented reason.

---

## 3. Second derivations

### Conjugation

`scripts/second-conjugator.mjs` is an independent implementation, written from
the conjugation tables in *A Dictionary of Basic Japanese Grammar* appendix 1
and Tae Kim's "Verb Basics", without reading `src/lib/conjugate`. It was then
run over **5,056 words x every form the app can ask, 171,872 forms compared**.

**1,855 disagreements, in five groups:**

| Count | What | Whose bug |
|---|---|---|
| 1,573 | Causative-passive: app says 書かせられる, second says 書かされる | Neither. A real teaching choice. |
| 210 | vs-s verbs (愛する): 愛さない vs 愛しない | The second conjugator's. The app is right. |
| 40 | ずる verbs: 演ぜられる / 演ずれば vs 演じられる / 演じれば | A real disagreement. |
| 20 | ずる dictionary form: 演ずる vs 演じる | The second conjugator's. |
| 12 | ある compounds: でない vs ない | The second conjugator's. |

Plus **152 forms the second conjugator built and the app refuses**, all of them
the app's defectiveness table doing its job (ことがあれる, 食べられる for a verb
that has no potential). The app's refusal reasons are careful and well argued;
this check found nothing wrong with them.

Two examples of the causative-passive group: 泳ぐ, app 泳がせられる, second
泳がされる. 運ぶ, app 運ばせられる, second 運ばされる.
Two of the ずる group: 演ずる, app 演ぜられる, second 演じられる. 禁ずる, app
禁ずれば, second 禁じれば.

### Which reading a kanji takes in a word

**There is no JMdict furigana reduction in this repository**, and none of the
ingest inputs carries one. So the alignment cannot be diffed against an
independent source. What the app has instead is `scripts/ingest/aligner.py`: a
cost-ranked search over KANJIDIC2's readings with rules for rendaku, gemination
and handakuten.

What could be checked, and was, as part of the new test file: every one of the
per-kanji base readings the app shows is a reading KANJIDIC2 actually lists for
that kanji. **Zero exceptions** across all 10,147 aligned words.

The heuristic part is the SPLIT and the SURFACE. **866 alignment slots across
821 words** claim a sound change (rendaku, gemination or handakuten) that the
aligner inferred rather than read anywhere. Those are the ones a furigana source
would settle. The list is at
`scratchpad/sak418/align-base-not-in-kanjidic.json` (empty) and the shifted set
can be regenerated in one line from `vocab.json`.

2,406 words have no alignment at all, which is correct: 今日 is きょう and does
not decompose.

### Pitch

`src/data/pitch.ts` reads `generated/pitch.json` and nothing else. **There are
no hand-overridden pitches.** The ingest is deliberately conservative: it keeps
only rows where Kanjium gives a single integer, the written form and the taught
reading both match, and Kanjium does not contradict itself. Everything else
stores no pitch rather than a guess.

There is no second pitch source offline in this repository, so the 8,684 stored
downsteps are **unverified against anything but Kanjium**. Kanjium is itself
derived from the NHK accent dictionary and Daijirin, so this is a single-source
fact with a good source, and that is the honest description of it. The pin test
proves the app draws exactly what the file says.

### The reveal's reading rules (SAK-316)

40 sampled, spread across every rule bucket, read by hand. Three findings, all
below. The rules are generated from four templates, so a wrong sentence is wrong
on every card that hits it, and the counts in the list are how many reading rows
each affects.

### Why an option was on the board (SAK-315)

35 sampled across all six lines the app actually emits (a seventh, "the same
verb in another pattern", needs a grammar vehicle and did not come up in the
sample). Every one was true of its pair: あ against お really is drawn almost
the same, 開く against 開ける really is the other verb of the pair, 他 as ほか
against 他 as た really is another reading of the same character. **No findings.**
This mechanism is doing what it says.

---

## 4. Two readers over the hand-written prose

Every hand-written English string in `src/data` was extracted mechanically:
2,854 items. Both readers then worked from an identical set of **1,055**: all
755 non-etymology items, plus a 300-item systematic sample of the 2,099 kanji
origin stories.

**Scope cut, stated plainly.** 1,799 origin stories went to neither reader, and
reader one covered only 379 of the 1,055 (the grammar, counter, term, mark,
radical-tip, why and sentence-ordering kinds) rather than all of them. Reader
two covered all 1,055 in 24 batches of 45, each batch given to a separate model
with the rubric and the items and no other context about the app. Given that the
origin stories produced a doubt roughly every eleventh item, the untouched 1,799
should be expected to hold another 150 or so, and finishing them is the obvious
follow-up.

**67 of the extracted items are engineering notes, not lessons** (`recipes.ts`
declares its `note` field "Engineering notes, not lessons"). They were read
anyway and no doubt below comes from one.

Reader one raised 18 doubts, reader two 38. After merging, **47 distinct items**
are below; 7 are doubted by both readers and are marked so.

---

## 5. The list

Grouped by kind. Each item: what is claimed, what is wrong with it, a reference,
a confidence, and which reader. Nothing here has been changed.

### Kanji origin stories

Every one of these was checked to be present verbatim in the repository. Several
can be settled by looking at the character itself.

| Item | Claim | Objection | Reference | Confidence | Reader |
|---|---|---|---|---|---|
| 知 | "An adult (大), a mouth (口), and a child (子)" | 知 is 矢 (arrow) plus 口. There is no 大 and no 子 anywhere in it. | Wiktionary; Shuowen Jiezi | high | both |
| 外 | "the definition of 卜 (divination) and the sound of 月" | The left half of 外 is 夕 (evening), not 月, and the traditional reading is ideogrammic, not phonetic. | Wiktionary citing Shuowen Jiezi | high | two |
| 冶 | "Metal ingots (呂) with a ladle (刀)" | 冶 is 冫 (ice) plus phonetic 台. Neither 呂 nor 刀 is in it. | Wiktionary citing Shuowen Jiezi | high | two |
| 選 | "the definition of 止 (foot) and the sound of 巽" | The semantic component is 辵 / 辶 (movement), which is the radical 選 is filed under (162), not 止 (77). | Wiktionary citing Shuowen Jiezi | high | two |
| 法 | "the sound of 盍" | 法 (old 灋) is 水 + 廌 + 去. 盍 is not a component of it and does not supply the sound. | Shuowen Jiezi | high | two |
| 難 | "the sound of 暵" | Shuowen gives 堇 / 𦰩 as the phonetic. 暵 is a separate character that merely shares that piece. | Shuowen Jiezi; Wiktionary | high | two |
| 准 | "a water (氵) leveling tool with 隹 for the sound (じゅん)" | The phonetic of 準 is 隼, not 隹; 隹 is read すい, not じゅん. | Shirakawa 字統 | high | two |
| 香 | "Millet (黍) over a mouth (口)" | The lower element is 甘 (sweet), not 口. | Shuowen Jiezi; Wiktionary | medium | two |
| 科 | "the definition of 斗 (measuring tool) and the sound of 禾" | Standard sources make this ideogrammic, both halves meaning-bearing (measuring out grain), not phono-semantic. | Wiktionary | medium | two |
| 年 | "the definition of 禾 (grain) and the sound of 人" | Shuowen gives 千 as the phonetic; 人 does not match 年's reading. | Shuowen Jiezi | medium | two |
| 公 | "The dividing mark (八) over 厶 (the old form of private)" | This is the Han Feizi moral gloss. Paleographers read the oracle-bone form as unrelated to 八 + 厶. | Shirakawa 字統 | medium | two |
| 仁 | "the definition of 二 and the sound of 人 (じん)" | The roles are reversed: 人 carries the meaning (kindness between people), and every other 人-radical entry in the same file treats it that way. | Wiktionary | medium | two |
| 妃 | "A woman (女) beside a kneeling man (卩)" | 妃 is 女 plus phonetic 己. 卩 is a different component. | Wiktionary | medium | two |
| 市 | "the definition of 兮 (bustling) and the sound of 之" | The semantic element is 冂, a marketplace boundary, not 兮. | Wiktionary | medium | two |
| 庶 | "the definition of 火 (fire) and the sound of 石" | Shuowen has 广 plus 炗 (an old form of 光), with no 石 and no phonetic relation. | Shuowen Jiezi | medium | two |
| 奨 | "the definition of 大 (big) and the sound of 将" | The semantic element is historically 犬 (urging a dog on), which the shinjitai reshaped into something that looks like 大. | Wiktionary | medium | two |
| 求 | "The original glyph pictured a centipede." | The standard account is a fur garment or pelt, the ancestor of 裘. | Wiktionary; Shirakawa 字統 | medium | two |
| 染 | "Hanging cloth from a tree (木) on a hook (九)" | There is no cloth component; 木 is the dye plant and 九 indicates repeated dipping. | Shuowen Jiezi | medium | two |
| 学 | "two hands guiding a child (子) under a roof" | The paleographic form has 爻 (crossed counting sticks) held by the hands above the child; dropping 爻 changes the story. | Wiktionary | medium | two |
| 明 | "日 (sun) beside 月 (moon)" (in the "built from" intro) | The oracle-bone form has 囧 (a window) beside 月, "moonlight through a window"; the window later came to look like 日. | Wiktionary | medium | two |
| 旬 | "the sound of 螾" | 旬 is 勹 over 日; any cited phonetic relative is 匀, not 螾. | Shuowen Jiezi | low | two |

### Grammar

| Item | Claim | Objection | Reference | Confidence | Reader |
|---|---|---|---|---|---|
| `grammar-concepts.ts` verb classes | "An う-verb drops its last kana and adds the ending." | An う-verb changes its last kana to the matching vowel row, it does not drop it: 書く gives 書きます, not 書ます. The very next sentence uses "drops" correctly for る-verbs, which invites the wrong reading of this one. | Genki I lesson 3; Tae Kim, "Verb Basics" | high | one |
| `form-intros.ts`, five pages | "a る-verb adds させる" / "adds られる" / "adds よう" (causative, causative-passive, passive, potential, volitional) | Taken literally these give たべるさせる. The sibling pages for ば, ない and the stem all say "drops る and adds", so the omission reads as a rule, not shorthand. | Genki I lessons 8, 21; Tae Kim | high | one |
| `form-intros.ts` causative-passive; `src/lib/conjugate` | "An う-verb ends in 〜せられる" | The contracted 〜される (書かされる, 待たされる) is the form beginners hear, and DBJG lists it. The app can neither produce nor accept it, on 787 verbs. This is the 1,573-form diff above. | DBJG, "causative passive"; Tae Kim, "Causative-Passive" | medium | one |
| `src/lib/conjugate`, vz class | 演ずる passive is 演ぜられる; conditional 演ずれば | Correct for the ずる paradigm, but modern usage is overwhelmingly 演じられる / 演じれば, and Jisho leads with 演じる. Affects 10 verbs. | Jisho; Daijirin | medium | one |
| `clusters.ts` に vs で | "There is no rule for choosing between them" | It states the actual rule in the sentence immediately before (に for existence and destination, で for the site of an action), then denies that a rule exists. Beginners are taught exactly that rule and it works for the basic cases. | Genki I lessons 3-5; Tae Kim | medium | both |
| `clusters.ts` は vs が | "There is no rule for choosing between them" | Same shape as the above, one cluster over. | DBJG, は and が entries | low | one |

### Keigo

| Item | Claim | Objection | Reference | Confidence | Reader |
|---|---|---|---|---|---|
| `terms.ts` keigo | "It comes in two registers: honorific ... and humble" | Keigo is standardly three registers: sonkeigo, kenjougo and teineigo (です / ます). The app's own `grammar-concepts.ts` page says three, so the two pages contradict each other. | Genki II keigo chapter; Imabi | medium | both |
| `track-intros.ts` keigo | "You do not conjugate the verb or add an ending. A keigo verb replaces the plain verb outright" | A large part of keigo is exactly affixation: お + stem + になる, お / ご + stem + する, and れる / られる as a light honorific. | DBJG; Genki II | high | two |
| `why.ts` keigo lede | "the same verb changes shape by whose action it is" | The core keigo verbs are suppletive, not reshaped: 食べる to 召し上がる, 言う to おっしゃる. The next paragraph of the same blurb says so. | Genki II honorific verb list | medium | two |

### Counters and numbers

| Item | Claim | Objection | Reference | Confidence | Reader |
|---|---|---|---|---|---|
| `counter-categories.ts` 個 | "冊, 回 and 歳 double the same way." | Only 回 does. 六冊 is ろくさつ and 六歳 is ろくさい, with no small っ, and this file's own 冊 and 歳 pages say so. | Genki I counters | high | both |
| `phase-intros.ts` numbers | "the other reading turns up in fixed words and telling the time" | For 4, telling the time uses a third reading, よじ, not し. The learner meets that exception on the first clock lesson. | Genki I lesson 3 | medium | two |
| `track-intros.ts` counters | "Math, a phone number, a price, a page, a year." given as bare numbers | A price takes 円, a page takes ページ, a year takes 年. Only math and phone numbers are genuinely counter-less. | Genki I lessons 2-3 | medium | two |
| `vocab` primary reading of 九 | 九 is taught as く | Standing alone, nine is きゅう; く appears in 九時 and 九月. CEJC's conversation counts, which are what override the JMdict reading here, are counting those compounds. 四 as よん and 七 as なな are both right, so this is the one of the three worth checking. | NHK accent dictionary; Genki I lesson 3 | medium | one |

### Kana and writing

| Item | Claim | Objection | Reference | Confidence | Reader |
|---|---|---|---|---|---|
| `phase-intros.ts` combos, hiragana and katakana | "Only the い-row kana take these: き, し, ち, に, ひ, み, り and their voiced partners." | に, み and り have no voiced partners. Only き, し, ち and ひ do. Two items, one in each script. | Tae Kim, kana charts | high | two |
| `track-intros.ts` hiragana | "Every kana is one mora" | きゃ, しゅ, ちょ are two kana and one mora, which the learner meets in the same track. | Tae Kim, mora and pitch accent | high | two |
| `phase-intros.ts` dakuten | "The two strokes alone give you 25 more characters." | The dakuten rows (が, ざ, だ, ば) are 20 characters. 25 only counts the handakuten ぱ row, which the next paragraph introduces separately. | Genki I kana chart | high | two |
| `terms.ts` kana | "Each kana stands for one syllable" | Kana stand for morae. ん and small っ are each a mora and neither is a syllable, which `terms.ts`'s own mora entry says two entries later. | Tae Kim, phonology | medium | both |
| `marks.ts` long vowels | "Hold a vowel a beat longer ... a doubled vowel in hiragana" | Long e is normally written い (せんせい) and long o normally う (がっこう). True doubling is the exception (とおい, おおきい, こおり). A learner following this literally misspells the commonest cases. | Tae Kim, "Long Vowels" | medium | both |
| `marks.ts` small vowel kana | "Fuse onto the i-row kana in front of them to make ONE syllable." | The same entry's note gives ファ, ティ and ウェ, which are not i-row; and the unit is a mora, not a syllable. | Tae Kim, katakana extensions | medium | one |
| `track-intros.ts` katakana | "With both sets in hand you can read any Japanese word out loud." | Most running text is kanji, whose readings kana do not give you. | Tae Kim | medium | two |

### Kanji parts

| Item | Claim | Objection | Reference | Confidence | Reader |
|---|---|---|---|---|---|
| `radical-tips.ts` 勹 | "包 (wrap, hugging 己)" | The wrapped element in 包 is 巳, not 己. The two are a classic confusion and the tip is a tip about not confusing shapes. | Wiktionary | medium | both |

### The quiz reveal (SAK-316)

These are generated sentences, so each wrong claim appears on every card that
hits its rule.

| Item | Claim | Objection | Reference | Confidence | Reader |
|---|---|---|---|---|---|
| On'yomi rule template | "Standing alone as a word it takes a kun'yomi instead." | Shown on **354 reading rows over 332 kanji that KANJIDIC2 gives no kun'yomi at all** (樹, 徹, 派, 宴, 仁 …). 樹 standing alone is じゅ. It is also false for the numbers: the card for 一 = いち anchors it in 一 standing alone while telling the learner that standing alone takes a kun'yomi. | DBJG, on'yomi and kun'yomi; Jisho entries for the affected kanji | high | one |
| Surface-shift note | "Inside 一杯 it voices, はい to ぱい. A part joined onto the back of a word often softens its first sound." | h to p is handakuten, not voicing, and it is a hardening rather than a softening. **29 of the 72 non-gemination shifts are this case** (敗, 杯, 歩, 波, 派, 表, 配, 髪 …). | Imabi, "Rendaku"; Tae Kim | high | one |
| "Filed both ways" template | "The dictionary files い as an on'yomi and as a kun'yomi, for different senses, so there is no rule to lean on here." | For several of the 20 rows this is an artifact of stripping okurigana from KANJIDIC2's kun readings: 医's い.やす, 死's し.ぬ, 秘's ひ.める. い in 医者 is unambiguously the on'yomi, and telling a learner there is no rule here is worse than saying nothing. | KANJIDIC2 reading format; `scripts/ingest/readingtype.py`'s own note on this normalisation | medium | one |

### Words

| Item | Claim | Objection | Reference | Confidence | Reader |
|---|---|---|---|---|---|
| `word-contrast-notes.ts` いいえ / いや | "いや is casual and carries feeling: it usually means 'I don't want to' or 'I'd rather not'" | As the bare interjection contrasted with いいえ, いや is mostly just a casual "no" or a hesitation filler. "I don't want to" is いやだ, the na-adjective. | Jisho, いや | medium | both |
| `word-examples.ts` documentation | The `span` field is documented as where the word's literal written form appears, absent when the sentence inflects it | 818 of 2,990 spans cover an inflected surface (ある underlined inside ありません). The underline is on the right word, so nothing is misteaching; the doc is wrong about the data, and anything trusting the doc would be wrong too. | the file's own `WordExample.span` comment | medium | one |

---

## What to do with this

Nothing here is a fix. The three highest-confidence items, and the ones cheapest
to settle, are:

1. **知's origin story names three components the character does not contain.**
   Look at 知 and at 矢. One line to check, one line to fix, and it is the kind
   of error that makes a learner distrust the rest.
2. **"Standing alone it takes a kun'yomi" is shown to a learner on 332 kanji
   that have no kun'yomi.** One template sentence, and it is on a card the app
   shows constantly.
3. **"冊, 回 and 歳 double the same way" contradicts the app's own 冊 and 歳
   pages.** Three counters, one sentence, and the two sides are already both in
   the repository.

The etymology items cluster: 15 of the 21 are a component named wrongly, which
suggests the batch rewrites sometimes reworded a Wiktionary entry without
checking the glyph. A pass that mechanically checks each story's named
components against `kanji-components.json` would find the rest of them without
another reader, and is worth its own card.

---

## Origin stories, the rest (2026-09-08, SAK-421)

The section above read 300 of the origin stories and left 1,799 unread, and it
guessed that most of the doubts it did raise were one mechanical class: a story
naming a piece the character does not contain. This section closes both. Nothing
here changed any content either.

Two counts moved since that section was written, and the numbers below use the
current ones: **every one of the 2,136 taught kanji now has a hand-written origin
story** (it was 2,099), because the batch and manual files have kept growing.

### The mechanical check

`src/data/etymology-components.test.ts` reads each story, pulls out the glyphs it
names as pieces, and asks whether the kanji actually has them. It is a test, not
a script, so it runs in the pre-commit hook and a new story that names a piece
the glyph lacks fails there.

**How the prose names a piece.** Two shapes carry the claim, and the house style
in `kanji-etymology-prose.ts` keeps to them: a parenthesis opening with a glyph,
hung off the English name of the piece ("a mouth (口)", "(貝, money and gain)",
"(彐 and 寸)"), and the phono-semantic frame ("the definition of 心", "the sound
of 及", "見 for its sense"). A parenthesis that opens with prose is a remark, not
a piece ("(the opposite of 下)"), and is skipped.

**What it compares against.** `KanjiRow.comps`, which is
`generated/kanji-components.json` with `kanji.ts`'s hand-written COMPS_OVERRIDE
on top: the same list the "Made of" tiles show the learner. Depth two, since a
story may name a part of a part. Both sides collapse through the variant map
(亻 → 人, 氵 → 水, ⺼ → 肉), plus a small table for the forms the prose writes with
a different codepoint than the tiles (每/毎, 曾/曽, 犭/⺨), so no finding here is
really two spellings of one shape.

**What it cannot speak to, and does not:**

- **199 stories about the traditional character** ("this glyph is the simplified
  form of 經 ..."). They name that character's pieces on purpose, and the drawn
  glyph's parts cannot settle them either way.
- **74 stories for a glyph the data records no decomposition for** (皮, 生, 食).
  There are no parts to check a name against.
- A sentence that says the shape moved on ("the sound of 囟, later corrupted to
  look like 田") is not claiming the piece is there now, so its names are not
  read as claims.

**The result: 317 stories name at least one piece the glyph does not have.** That
is 17 percent of the 1,863 the check can speak to, and it is a far bigger class
than the review above guessed from its 15 hits. The full list is below.

A word on what a row means. It is not automatically a false claim about history:
some of these stories are telling the truth about an older form (思's 囟, 具's
鼎) while the tiles show what the character became. But the learner sees the
story and the tiles side by side on one page, and in all 317 cases they
disagree, with nothing on the page saying why. **29 of the 317 name a piece that
is not in the glyph's own Wiktionary etymology record either**, and those are the
ones where nothing at all supports the wording; the table marks the missing
pieces so they can be checked against the record quickly. 21 of the 317 have no
etymology record to check against.

### The reading gap

**Reconstructing the read set.** The section above records no ids for its
300-item systematic sample, so it was reconstructed by the method it describes:
every 7th story in teaching order, 306 of them. Those, plus the 21 origin stories
already on its list, were set aside; **1,812 stories were treated as unread**.
The reconstruction cannot be exact, so a handful of stories may have been read
twice and a handful of read ones may have slipped through as unread.

**Reader one (this pass, with the rubric).** All 363 items of a systematic
every-5th sample of the 1,812, in 15 batches of 25. **This is a sample, not the
whole set**: reading 1,812 items by hand at the rate a doubt needs (look at the
character, recall what the sources say, decide whether the objection has a
reference behind it) does not fit the time this card had. The sample is spread
evenly across the whole teaching order rather than taken off the front, so it is
not biased toward the common kanji.

**Reader two (a separate model per batch).** All 1,812, in 46 batches of 40. Each
batch went to its own agent with the rubric and the items and nothing else about
the app: no file paths, no other stories, no knowledge of what this section
would say.

The rubric is at the end of this section. Only doubts with a claim, an
objection, a reference and a confidence were kept.

A doubt on a glyph already on the mechanical list was kept only where the reader
adds something the list does not have, which in practice means naming what the
piece actually is or which way round the roles go. The list itself only says
that the story and the tiles disagree.

**Reader one raised 18 doubts over its 363 items, reader two 130 over its 1,812.
After merging, 134 distinct items are below; 13 are doubted by both readers and
are marked so.** By confidence: 47 high, 69 medium, 18 low. 67 of the 134 sit on
a glyph that is also on the mechanical list, and each of those names the piece
the story should have named.

### Where to start

Three that are cheap to settle and worth settling first:

1. **亡 is told 刃's story.** "The original glyph added a line to 刀 (knife) to
   mark the blade" is the origin of 刃, not of 亡, and it is in
   `etymology-prose/batch-03.ts` word for word. Nothing about 亡 involves a
   knife. This looks like a line that landed on the wrong key.
2. **戦's story says 単 lends it the sound せん.** 単 reads たん. せん is 戦's own
   reading, so the sentence tells a learner a reading of 単 that no dictionary
   gives.
3. **容's story names 公 as the sound piece.** It is 谷, the same piece that
   gives 浴 and 欲 their よく. 公 is not in 容 at all.


### The doubts

Each item: what is claimed, what is wrong with it, a reference, a confidence,
and which reader. Nothing here has been changed.

| Item | Claim | Objection | Reference | Confidence | Reader |
|---|---|---|---|---|---|
| 亡 | "added a line to 刀 (knife) to mark the blade" | That is the standard origin story for 刃 (blade), not 亡. 亡 traces to a person going behind a barrier out of sight, and has no relation to 刀. | Wiktionary; Shuowen Jiezi | high | two |
| 令 | "A mouth (亼)" | 亼 means to gather or assemble, not mouth. The mouth radical is 口, which is not a component here; 令 is 亼 (assemble) over 卩 (kneeling person). | Wiktionary glyph origin for 令 and 亼 | high | two |
| 共 | "an object (口)" | 共 is made of 廾 (two hands) plus 廿 (twenty, a bundle), not 口. There is no 口 anywhere in 共. | Wiktionary | high | two |
| 冒 | "the sound of 冃 (a hat over the eyes)" | Shuowen gives 冒 as 从冃从目, an ideogrammic compound where 冃 (a covering) supplies meaning, not sound. 冃 is not used as a phonetic elsewhere. | Shuowen Jiezi | high | two |
| 制 | "a tree (朱)" | Shuowen gives 制 as 刀 plus 未 ('from 未'), a tree with overhanging branches, not 朱. 朱 is a different character. | Shuowen Jiezi | high | two |
| 千 | "the definition of 一 (one, a number)" | 千 is drawn as 人 over 十, not 一. The standard account treats the base piece as 十 (ten), extending the same pattern as 十 and 百, with 人 as the phonetic; there is no 一 in it. | Wiktionary | high | two |
| 句 | "It uses the definition of 丩 (two ropes entangled) and the sound of 口." | 句 is a phono-semantic compound with 口 as the semantic piece (mouth, utterance) and 丩 as the phonetic. This item has the two roles swapped. | Wiktionary | high | two |
| 変 | "a hand in action (夂)" | The bottom-right piece of 變/変 is 攴 (a hand holding a stick, action), not 夂 (the 'go slowly' radical seen in 冬 and 各). Shuowen gives 變 as 攴 plus the phonetic 䜌. | Shuowen Jiezi; Wiktionary | high | two |
| 夜 | "the definition of 夕 (moon)" | 夕 is glossed as evening or dusk, not moon (that is 月). 夜 is standardly 夕 (evening) plus the phonetic 亦. | KANJIDIC2; Wiktionary glyph origin for 夜 | high | two |
| 奪 | "seizing a bird (雀) from a robe (衣)" | 奪 is made of 奞 (大 plus 隹, a bird spreading its wings) over 寸 (hand). There is no 衣 (robe) in it, and the bird piece is 隹, not the full character 雀 (sparrow). | Wiktionary | high | two |
| 安 | "It uses the definition of 宀 (roof) and the sound of 女." | Both pieces carry meaning here (a woman settled under a roof); Shuowen reads 从女在宀下. 女 (じょ, にょ) does not lend あん its sound. | Shuowen Jiezi; Wiktionary | high | both |
| 宰 | "a house (宀) where governing is done (乂)" | 宰 is 宀 over 辛, not 乂. 辛 (a knife or awl tied to punishment and servitude) is the standard lower component, and there is no 乂 in the character. | Shuowen Jiezi; standard kanji dictionaries | high | two |
| 容 | "the sound of 公" | Shuowen Jiezi gives 容 as 从宀, 谷聲: the phonetic is 谷 (valley), not 公. The same phonetic series shows up in 浴 and 欲, both read よく, close to 容's よう. | Shuowen Jiezi | high | two |
| 寺 | "a hand (又) grasping" | 寺 does not contain 又. The meaning piece is 寸 (hand/inch), with 之 as the phonetic; Shuowen glosses it 从寸之聲. | Shuowen Jiezi | high | two |
| 就 | "A tall hall (享) and a high tower (京)" | 就 is formed from 京 (mound, high place) and 尤 (exceptional, the phonetic), not 享. 享 is a separate, unrelated character and does not appear in 就 (stroke count also confirms: 京 8 + 尤 4 = 12, matching 就; 享 8 + 京 8 would be 16). | Wiktionary; Shuowen Jiezi | high | two |
| 尿 | "a body (尾)" | 尾 means "tail," not "body." The body/person component analyses give for 尿 is 尸, so labeling 尾 as "a body" mislabels the piece regardless of which paleographic account is preferred. | Wiktionary glyph origin of 尿; KANJIDIC2 gloss of 尾 | high | two |
| 幸 | "combined animals counted as lucky, a dog and a sheep" | No standard source shows 幸 built from a dog and a sheep. Shuowen Jiezi glosses it as 屰 over 夭 (escaping misfortune), and the paleography followed by Shirakawa and Wiktionary reads the early form as a pair of shackles, not two animals. | Shuowen Jiezi; Wiktionary | high | two |
| 庫 | "the definition of 广 (building) and the sound of 車" | Shuowen classifies 庫 as an ideogram, a chariot (車) stored under a roof (广), not a phono-semantic compound. 車's on'yomi (シャ/キョ) also does not match 庫's on'yomi (コ), so 車 cannot be the sound piece. | Shuowen Jiezi | high | two |
| 庸 | "It uses the definition of 庚 and the sound of 同." | Standard sources treat 用 as the meaning piece and 庚 as the phonetic (Shuowen: from 用, from 庚). 同 does not appear in 庸 and is not its sound source, and the roles given for 庚 are reversed. | Shuowen Jiezi; Wiktionary | high | two |
| 強 | "the sound of 彊" | 強 is 虫 (insect, the rice weevil) plus 弘 for sound, not 彊. 彊 is a separate character (弓+畺) that shares a meaning with 強 but is not the phonetic used to build it. | Wiktionary glyph origin for 強 | high | two |
| 当 | "two fields (田) set opposite and matching" | 當's accepted analysis has one 田 as the meaning element and 尚 as the phonetic, not a second field. Shuowen Jiezi glosses it as 田相值也, from 田, 尚聲. | Shuowen Jiezi | high | two |
| 微 | "It uses the definition of 攴 (a hand with a tool) and the sound of 美 (び)." | Shuowen reads 微 as 从彳𢼸聲: the meaning piece is 彳 (going), and the sound piece is 𢼸, not 美. 攴 is part of the sound piece, not the meaning. | Shuowen Jiezi | high | both |
| 慶 | "A deer (廌)" | 廌 is the mythical one-horned xiezhi beast used in characters like 法/灋, 薦, and 解-type forms, not this piece. Shuowen and Wiktionary describe the top of 慶 as an abbreviated 鹿 (deer), tied to the custom of giving a deer skin as a congratulatory gift, so the piece named here is the wrong animal glyph. | Shuowen Jiezi; Wiktionary | high | two |
| 戦 | "単 for its sound (せん)" | 単's on'yomi is たん, not せん; せん is 戦's own reading, not 単's. The phonetic component does not itself carry that reading. | Jisho; KANJIDIC2 | high | two |
| 拐 | "the sound of 冎" | 拐 is composed of 扌 and 另 (lìng), not 冎. 冎 (bone) is a separate, rare component found in characters like 咼/過 and does not appear in 拐. | Wiktionary; standard hanzi dictionaries | high | two |
| 改 | "the sound of 巳" | 改 is built from 己 (phonetic) plus 攴, not 巳. Shuowen gives it as 从攴己聲, and 己 and 巳 are different characters with different shapes and readings. | Shuowen Jiezi; Wiktionary | high | two |
| 旦 | "the sound of 丁" | 旦 is not phono-semantic; 丁 is not a component of 旦 at all. The standard account is an ideogrammic compound of 日 (sun) over 一 (the horizon or ground), depicting sunrise, and 旦's reading たん does not match 丁's readings てい/ちょう. | Wiktionary glyph origin for 旦 | high | two |
| 早 | "the sound of 棗" | 早 does not contain 棗 as a component. Standard sources treat 早 as an ideogrammic compound of 日 and 甲 (or 十), not a phono-semantic compound using 棗. | Wiktionary glyph origin for 早 | high | two |
| 津 | "the sound of 盡" | 津 is water (氵, 3 strokes) plus 聿 (6 strokes), the same phonetic seen in 筆; 盡 is a 14-stroke character on its own and cannot be a component of a 9-stroke glyph at all. | Wiktionary; Shuowen Jiezi | high | two |
| 滴 | "the sound of 啻" | The phonetic in 滴 is 啇 (as in 摘, 敵, 嫡), a different character from 啻, which means only or merely as in 不啻. The two look alike but are not the same piece. | Wiktionary glyph origin for 滴 and 啇 | high | two |
| 焦 | "the sound of 小 (しょう)" | 焦 is 隹 (bird) over 火/灬 (fire); Shuowen gives it as a plain semantic compound (从火从隹), not phono-semantic. There is no 小 anywhere in the character. This looks like it borrowed the しょう reading from the unrelated 肖 phonetic family (消, 硝, 宵). | Shuowen Jiezi; Wiktionary | high | two |
| 熊 | "combines 能 (bear) with the sound of 炎" | 熊 does not contain 炎 (two 火). It contains 灬, a reduced form of a single 火, and that fire piece is treated as the semantic addition, not the sound; the phonetic piece is 能 itself. | Wiktionary; Shuowen Jiezi | high | two |
| 状 | "爿 for its sound (しょう)" | 状's on'yomi is じょう, as in 状態, 状況, and 現状, not しょう. | standard kanji dictionary on'yomi for 状 | high | two |
| 真 | "It uses the definition of 貝 (shell) and the sound of 𠂈." | 眞 is 鼎 (a cauldron) with 匕 for the sound. The 鼎 was corrupted into something that looks like 貝, and 匕 is the sound piece, not 𠂈. | Wiktionary citing Shuowen Jiezi | high | both |
| 砂 | "the sound of 沙 (さ)" | 砂's right-hand piece is 少, not 沙. 沙 is water plus 少 and is a separate character that does not appear inside 砂; the actual shared phonetic is 少. | Wiktionary; KANJIDIC2 | high | two |
| 維 | "the sound of 唯" | 維 is 糸 plus the phonetic 隹 alone (stroke count 6+8=14 matches 維's 14 strokes). 唯 is a different character that adds a 口 (mouth) to 隹, and is not the piece present in 維. | Wiktionary; Shuowen Jiezi | high | two |
| 罪 | "A net (网) closing over wrongdoing (非): guilt, crime." | 罪 originally named a bamboo fishing net (网+非) with no connection to crime. It was substituted for the real crime character 辠 under Qin Shi Huang because 辠 resembled 皇; the 'net catches wrongdoing' reading is a later folk gloss, not the original account, and the story does not flag it as such. | Wiktionary; Shuowen Jiezi | high | two |
| 肖 | "the definition of 月 (moon)" | The 月 in 肖 is the flesh/meat radical (derived from 肉), not the celestial moon. 肖 means resemblance via 小 (small) plus 肉 (flesh), i.e. a small or miniature body, so glossing this piece as moon misidentifies it the same way calling 甘 a mouth would. | Wiktionary; standard kanji radical references (肉/月 radical 130) | high | two |
| 設 | "It uses the definition of 言 (speech) and the sound of 埶." | 設 is 言 plus 殳 (a hand wielding a tool); Shuowen reads it 从言从殳, with no phonetic at all. 埶 is a rare character that shares the piece and is not the sound of せつ. | Shuowen Jiezi; Wiktionary | high | both |
| 譜 | "the definition of 言 (sound)" | 言 means words or speech, not sound; 音 is the character for sound. Glossing 言 as "sound" mislabels the semantic component in this phono-semantic compound. | KANJIDIC2 radical meaning; Wiktionary glyph origin of 譜 | high | two |
| 貌 | "the definition of 皃 (looks) and the sound of 豹" | 貌 does not contain 豹 (leopard); it contains 豸, a radical. 貌 is read identically to 皃, so 皃 is the piece that carries the sound as well as the sense, and the roles here are swapped and the named sound piece is not even present. | Wiktionary | high | two |
| 赦 | "It uses the definition of 攴 (a hand holding a stick) and the sound of 亦." | Shuowen reads 赦 as 从攴赤聲: the sound piece is 赤 (せき, しゃく), which is the left half of the character. 亦 is not in 赦 at all. | Shuowen Jiezi | high | both |
| 辞 | "shows hands untangling silk threads on the left beside 辛" | The current glyph 辞 is written with 舌 (tongue) on the left, not the silk-thread hands of the traditional 辭. The story describes the traditional character's etymology without saying that is what it is doing, unlike the other items here that name the simplification explicitly. | Wiktionary; Jisho | high | two |
| 適 | "the sound of 啻" | 適's phonetic is 啇 (as in 摘, 敵, 滴), not 啻. 啻 is an unrelated character meaning only or merely. | Wiktionary glyph origin for 適 and 啇 | high | two |
| 配 | "a person kneeling (卩)" | 配 is composed of 酉 (wine jar) and 己, not 卩. The character does not contain 卩. | Wiktionary glyph origin for 配; standard kanji dictionary decomposition | high | two |
| 酎 | "the sound of 肘" | 酎 is 酉 (wine) plus 寸, not 肘. 酎 has 10 strokes, matching 酉(7)+寸(3); 肘 alone is 7 strokes and does not appear in the character. | Wiktionary; KANJIDIC2 | high | two |
| 顔 | "彦 for its sound (げん)" | 顔's on'yomi is がん, as in 顔面, 童顔, and 洗顔, not げん. げん is 彦's own reading, but it is not the reading 顔 actually takes. | standard kanji dictionary on'yomi for 顔 | high | two |
| 丼 | "the dot (丶) showing the bucket in the well" | The usual account has the dot representing the plop of something dropping into the well (an onomatopoeic 'don'), not a bucket sitting in it. | Wiktionary glyph origin (丼) | medium | two |
| 伝 | "the sound of 云" | 伝 is the shinjitai simplification of 傳, which swapped the phonetic 專 for the visually simpler 云 purely as a graphic simplification. 云 (on'yomi un) is not phonetically related to 伝's reading (den) and is not really functioning as a sound piece. | Wiktionary | medium | two |
| 位 | "the sound of 立 (stand)" | 位 is standardly analyzed as an ideogrammic compound of 人 and 立 (a standing person, hence rank), not as a phono-semantic compound. 立 supplies the meaning here, not the sound. | Wiktionary; Shuowen Jiezi | medium | two |
| 傷 | "the sound of 𥏻" | The standard phonetic in 傷 is 昜 (Shuowen: 从人易声/昃声), not the rare character 𥏻. I don't recognize 𥏻 as an attested component of this glyph at all. | Shuowen Jiezi | medium | two |
| 冥 | "held up by two hands (廾)" | Shuowen gives 冥 as 日 plus 六, with 冖 as the phonetic (the 六 tied to the sixteenth day of the lunar month, when the moon starts to wane). The modern glyph's lower piece is 六, not a two-hands shape, so a learner looking for 廾 will not find it. | Shuowen Jiezi | medium | two |
| 労 | "力 (strength) for its meaning of toil, beneath a piece giving its sound." | Standard sources treat 勞 as an ideogrammic compound of 力 and an abbreviated 熒 (torches, fire), not a phono-semantic one. The top piece contributes meaning (working by firelight), not sound, and its reading does not match 勞's anyway. | Wiktionary; Shuowen Jiezi | medium | two |
| 協 | "It builds on 劦 (to work together) with 十 added for the sound." | The roles are swapped. 劦 (three strengths pulling together) is the sound piece as well as the picture, and 十 is the piece that means many. 十 (じゅう) does not lend きょう its sound; 劦 (きょう) does. | Shuowen Jiezi; Wiktionary | medium | both |
| 卸 | "It comes from 御 with the 彳 dropped, keeping 午 for the sound" | Shuowen Jiezi defines 御 as composed from 彳 plus 卸 (从彳从卸), meaning 卸 is the earlier, independent graph that 御 was built on top of, not a reduction of 御. The direction of derivation given here is backwards. | Shuowen Jiezi (entry for 御) | medium | two |
| 厄 | "a person kneeling with a small stroke marking the bent knee" | 厄 is usually explained as a kneeling person (卩) under a cliff (厂), the cliff bearing down to suggest danger or hardship. This account drops the cliff entirely and turns it into a stroke on the knee, losing the source of the 'hardship' meaning. | Wiktionary glyph origin (厄) | medium | two |
| 叔 | "A hand (又) using a wooden stake (尗) to dig the ground." | 尗 is the sound piece in 叔 (Shuowen: 从又朮聲), not a stake with a meaning of its own. The digging picture is invented for a piece that carries no sense here. | Shuowen Jiezi; Wiktionary | medium | both |
| 同 | "The original glyph looked like a pipe, the early form of 筒." | That is one minority reading offered as settled. Shuowen reads 同 as 冂 plus 口, a gathering, and Wiktionary calls the origin uncertain. | Shuowen Jiezi; Wiktionary | medium | both |
| 吏 | "a hand holding a flag" | Standard sources analyze 吏 (and the related 史/事) as a hand holding a forked recording tool or tally, not a flag or banner. | Wiktionary glyph origin of 吏 and 史 | medium | two |
| 向 | "a sound echoing in a place" | Shuowen glosses 向 as a window that opens to the north (北出牖也), which is the source of the later 'facing' meaning. This account replaces that with an echoing-sound story and does not say it is departing from the standard one. | Shuowen Jiezi; Wiktionary | medium | two |
| 在 | "borrows the sounds of 才 and 士 (later corrupted to 土)" | Standard sources give 在 as phonetic 才 plus semantic 土 (earth) only. There is no 士 in its history that was later corrupted into 土. | Wiktionary; Shuowen Jiezi | medium | two |
| 夏 | "A man (頁) toiling under the scorching sun (日)" | 夏 does not contain 日 in its oracle-bone, bronze, or modern forms. The top of the character derives from a head or figure shape, not a sun radical, and standard sources do not describe a sun piece here. | Wiktionary; Shuowen Jiezi | medium | two |
| 天 | "It uses the definition of 大 (a standing man) and the sound of 丁, marking what is high above his head." | 天 is ideogrammic, not phono-semantic: a person (大) with the head or the space above it marked by a stroke. Shuowen has 从一大 and no phonetic. 丁 does not read てん. | Shuowen Jiezi; Wiktionary | medium | both |
| 奈 | "a tree (木) standing on an altar (示)" | Shuowen Jiezi analyzes 柰 as a phono-semantic compound with 示 as the sound component (示聲), not as a pictorial altar contributing meaning. Describing 示 as an altar turns a sound piece into a meaning piece. | Shuowen Jiezi | medium | two |
| 孔 | "An opening (丿) in a child's head (子): the soft spot in a newborn's skull" | The standard accounts (Wiktionary's ideogrammic-compound analysis of a child nursing, and Shuowen Jiezi's swallow-bird story) do not describe a skull opening or fontanelle, and give a different sense (nursing, or an auspicious arrival) for why the character means "hole, to pass through." The fontanelle story departs from both without flagging that it does. | Wiktionary glyph origin of 孔; Shuowen Jiezi | medium | two |
| 寡 | "A single head (頁) under a roof (宀): only one person in the house, alone, few" | Shuowen Jiezi derives 寡 from 宀 plus 頒 (分 plus 頁), where the idea of things being divided out (分) is what leaves each share few, not a lone head under a roof. The story gives a different mechanism from the traditional account without saying so. | Shuowen Jiezi | medium | two |
| 局 | "It uses the definition of 尸 (body)" | The semantic piece in 局 is 尺 (restricted, cramped), which was corrupted to look like 尸 in the modern form. Standard sources give 尺, not a body gloss, as the meaning piece. | Wiktionary | medium | two |
| 帰 | "sweeping the enemy away and returning" | The standard accounts (Shuowen and later paleography) tie the broom 帚 in 歸 to a bride's homecoming or a ritual purification broom, not to sweeping away an enemy. That detail looks invented rather than drawn from a recognized source. | Shuowen Jiezi; Wiktionary | medium | two |
| 度 | "the sound of 石" | 度 does not contain 石. Shuowen gives the phonetic as an abbreviated 庶 (度 from 又, 庶省聲), not 石. | Shuowen Jiezi | medium | two |
| 形 | "the sound of 井" | 形's phonetic is 开/幵 (as in 型, 刑, 研, 妍), not 井. The two look similar but are different components, and 形's readings (けい/ぎょう) do not match 井's (せい/しょう) the way a true phonetic pairing would. | Wiktionary glyph origin for 形 | medium | two |
| 徴 | "It joins 彳 (to go) with 攵 (a hand striking), from an old sense of calling someone in." | Shuowen Jiezi gives 徵 as an abbreviated 微 with 壬 added (从微省,壬爲徵), not a plain 彳 plus 攵 compound. The story drops the 壬/山 core of the character and invents a two-piece account in its place. | Shuowen Jiezi; Wiktionary | medium | two |
| 志 | "It uses the definition of 心 (heart) and the sound of 士 (し)." | Shuowen reads 志 as 从心之聲: the sound piece is 之, which the modern glyph draws so that it looks like 士. Naming 士 teaches the learner the corrupted shape as the source. | Shuowen Jiezi | medium | both |
| 念 | "A thought held close (今) over the heart (心)" | 今 is the sound piece in 念 (Shuowen: 从心今聲), and giving it the meaning "a thought held close" invents a sense for a piece that carries none. The file treats 今 as a pure sound piece elsewhere. | Shuowen Jiezi | medium | one |
| 憩 | "Tranquil (恬) plus rest (息)" | 憩 is not built from the whole characters 恬 and 息. Its real pieces are 舌 (tongue) and 心 (heart), traditionally read as resting one's tongue after talking; 恬 (calm) is a separate character made of 忄 plus 舌, not a component here, and 息 only appears if you regroup part of 心 with an unrelated 自. | Wiktionary (憩); Shuowen Jiezi, which gives 从心从舌 | medium | two |
| 戚 | "the definition of 戊 (scythe)" | 戚 is a phono-semantic compound of phonetic 尗 and semantic 戉, a battle-axe, not 戊. 戉 and 戊 are easily confused but are different characters, and 戉 is glossed as an axe, not a scythe. | Wiktionary | medium | two |
| 教 | "with the sound of 爻" | 教 is standardly analyzed as an ideogrammic compound of 爻 (imitation), 子 (child), and 攴 (hand with rod), not as a phono-semantic compound. 爻 functions as a meaning piece here, not the phonetic. | Wiktionary glyph origin for 教 | medium | two |
| 散 | "Trees or stalks (林) beaten apart with a stick (攴)" | The upper element of 散 is not 林 (two 木, trees); standard glyph histories trace it to bundles of hemp/fiber (related to 麻, sometimes cited as 𣏟), which only looks like 林. Naming it as trees could send a learner looking for the wrong component. | Wiktionary glyph origin for 散 | medium | two |
| 斑 | "the sound of 班" | 斑 is written with two 文 flanking 王 (jade marked with patterns), an ideogrammic compound; it does not contain 班 (which has 刀 between two 王) at all, and 班 is not its historical phonetic. The character in Shuowen's related entry 辬 uses 辡 as the phonetic, not 班. | Wiktionary glyph origin for 斑; Shuowen Jiezi (辬 entry) | medium | two |
| 旋 | "A flag (㫃), a foot (止), and a circle (〇): to turn around, to rotate." | There is no circle in 旋. Shuowen reads it 从㫃从疋, a banner and a foot, and the turning is what the two together mean. The circle is invented, and 疋 is not 止. | Shuowen Jiezi; Wiktionary | medium | both |
| 昔 | "the sound of 龷" | Shuowen and Wiktionary treat 昔 as an ideogrammic compound (dried meat drying under the sun, or older readings of floodwaters over the sun), not a phono-semantic one. The top piece carries meaning, not a reading, and 龷 is not a phonetic used elsewhere. | Shuowen Jiezi; Wiktionary | medium | two |
| 晶 | "Three suns (日) together" | The oracle-bone form of 晶 depicts three stars, not suns; it is the original form later disambiguated as 星 by adding 生 for sound. Telling a learner it is three suns invites reading 日 here as literally 'sun'. | Wiktionary glyph origin for 晶 and 星 | medium | two |
| 服 | "the definition of 凡 (tray)" | Shuowen Jiezi gives 服 as 从舟, 𠬝聲: the semantic piece is 舟 (boat, which later became 月), not 凡 (tray). | Shuowen Jiezi; Wiktionary | medium | two |
| 柳 | "the sound of 卯" | 柳's onyomi (りゅう) does not match 卯's onyomi (ぼう), and standard glyph origin sources trace the phonetic to 丣, an older unrelated form that was later graphically merged into 卯. Presenting 卯 flatly as the sound piece with no mention of that merger misleads a learner about the actual phonetic. | Wiktionary glyph origin for 柳 | medium | two |
| 業 | "something big (大)" | The lower part of 業 is 木 (a wooden stand/frame), not 大. The character depicts a saw-toothed board (丵) mounted on a wooden frame used to hang bells and chime stones. | Wiktionary; Shuowen Jiezi | medium | two |
| 樹 | "the sound of 尌 (to plant a tree)" | 尌 means to stand something upright or to establish (as in 廚, 澍), not to plant a tree. That gloss borrows the meaning of 樹 itself rather than the phonetic component's own sense. | Wiktionary; Shuowen Jiezi | medium | two |
| 段 | "the sound of 厂: a hammer breaking stone into pieces" | Shuowen analyzes 段 as 从殳, 耑省聲, meaning the phonetic is an abbreviated 耑, not 厂. The 厂-like part is better described as the rock being struck, not the sound-bearing piece. | Shuowen Jiezi | medium | two |
| 減 | "the sound of 咸, damming a stream to slow its flow" | 咸 does not depict damming a stream. Shuowen defines it as 皆 (all, complete), built from 戌 plus 口, with no water or damming sense attached to 咸 itself. A learner could wrongly take 咸 to mean 'dam'. | Shuowen Jiezi; Wiktionary | medium | two |
| 災 | "It uses the definition of 屮 (vegetation) and the sound of 𡿧 (a flood)" | Standard sources treat 災 as an ideogrammic compound of 巛 (flood, water) over 火 (fire), both meaning pieces with no phonetic component, not a phono-semantic pairing of a vegetation piece and a sound piece. Calling the top piece 屮 and giving it a sound role misstates both the gloss and the formation type. | Wiktionary glyph origin of 災 | medium | two |
| 用 | "looked like 同 with a handle added to it" | Standard sources describe the original glyph of 用 as a bucket, pail, or ritual wooden fence, not a variant of 同 with a handle. Shuowen's own gloss derives it from 卜 and 中, which also does not match this claim. | Wiktionary; Shuowen Jiezi | medium | two |
| 監 | "A person with a wide eye (臥)" | 臥 means to lie down or lie prostrate, not a wide eye; the wide eye is the 臣 component alone. Labeling 臥 itself as "a wide eye" misglosses that piece. | Wiktionary (臥, 監) | medium | two |
| 秋 | "after the harvest the fields are burned, marking autumn" | This is a popular but mistaken gloss. Shuowen and the oracle-bone forms trace 秋 to a cricket or locust pictograph (an autumn sign), with the fire-like element coming from an abbreviated phonetic component, not literal field-burning. | Shuowen Jiezi; Wiktionary | medium | two |
| 秘 | "the definition of 禾 (grain)" | 秘 is a variant of 祕, whose semantic piece is 示 (altar, spirit), as in Shuowen's entry for 祕 (from 示, sound of 必), not 禾. The grain radical in 秘 is a graphic corruption of 示, so calling 禾 the meaning piece is wrong. | Wiktionary; Shuowen Jiezi | medium | two |
| 稚 | "the sound of 屖" | 稚's actual right-hand piece is 隹, not 屖. Standard sources analyze modern 稚 as 禾 (grain) plus phonetic 隹 (zhui); 屖 is the phonetic of the older variant form 稺, not of 稚 itself. | Wiktionary | medium | two |
| 窯 | "the sound of 羔" | 羔 (lamb) reads こう and belongs to the 高/考/孝 phonetic family, not よう. 窯 reads よう, matching the phonetic seen in 遥, 摇, 瑶, 謡, and 徭, a component that looks similar to but is distinct from 羔. | Wiktionary glyph origin | medium | two |
| 童 | "a chisel (䇂) over an eye (見)" | The early form pairs the tattoo needle with 目 (eye), not 見. 見 is a separate character (eye over legs, meaning 'to see') and is not the piece described in the standard paleographic account of this glyph. | Shirakawa 字統; Wiktionary | medium | two |
| 筋 | "Bamboo (竹) is stringy when peeled (𠛧)" | Standard sources give 筋 as bamboo (竹, fibrous) over flesh (肉/月) and strength (力): sinew as fiber in the body, like bamboo. There is no 力 here, and no attested source for a 'peeled bamboo' piece in its place. | Wiktionary | medium | two |
| 素 | "Hands (廾) braiding raw thread (糸)" | The top of 素 is 𠂹 (a drooping/hanging shape), not 廾 (two hands). Standard etymology describes silk hung out to bleach white, not hands braiding it. | Wiktionary; Shuowen Jiezi | medium | two |
| 繭 | "needlework (黹)" | 繭 does not contain 黹, the embroidery/needlework radical. The third piece is 芇, a cocoon-shaped enclosure, not 黹. | Wiktionary glyph origin | medium | two |
| 羅 | "a bird tied with string (維)" | 維 means a cord, or to bind and hold together, not a bird. Shuowen glosses 維 as the rope of a net; a bird (隹) is only a phonetic piece inside 維 itself, not what 維 means. | Shuowen Jiezi; Wiktionary | medium | two |
| 翌 | "the definition of 昱 (daylight) and the sound of 羽" | 翌 is not 昱 plus a separate 羽 piece; it is 昱 itself (日+立) with the 日 corrupted in shape to look like 羽, still paired with 立. 羽 on its own reads ウ, unrelated to 翌's ヨク, so it is not functioning as a genuine sound component here, and the story does not say the shape changed. | Wiktionary (glyph origin, 翌) | medium | two |
| 者 | "looked like a sugarcane with full stems and a mouth below" | 者's accepted origin is a bundle of burning firewood or a cooking vessel, not sugarcane. Neither Wiktionary nor Shuowen describe a sugarcane shape. | Wiktionary; Shuowen Jiezi | medium | two |
| 肘 | "the sound of 寸" | 寸 in 肘 is not a phonetic borrowing; it derives from 又 (hand) marking the elbow's location, and its reading does not match 肘. Standard sources treat 肘 as an ideogrammic compound (会意) of 肉 and 寸/又, not a phono-semantic one. | Shuowen Jiezi; Wiktionary | medium | two |
| 色 | "A hand (爪) pressing down on a kneeling person (卩)" | The standard account has one kneeling person (人) on top of another kneeling person (卩), not a hand. There is no 爪 in the accepted origin story. | Wiktionary glyph origin for 色 | medium | two |
| 蔑 | "A person (𦰋) and a dagger-axe (戈)" | Shuowen describes 蔑 as 苜 (tired eyes, the brow-and-eye piece) plus 戍 (a person carrying a halberd, standing guard), not a bare 戈. The eye piece is mislabeled here as 'a person'; the actual person is inside 戍 along with the weapon. | Shuowen Jiezi | medium | two |
| 見 | "A kneeling person (卩)" | 見 is 目 (eye) over 儿 (legs), not 卩. Wiktionary and the standard IDS decomposition both give 儿 as the bottom piece; 卩 is the kneeling-figure radical seen in characters like 印 and 卻, a different component. | Wiktionary; KANJIDIC2 | medium | two |
| 覧 | "the sound of 監 (らん)" | 監 does not read らん. Its on'yomi is かん, and the app's own readings data says so. The sound 覧 takes is inherited from the old 覽, not a reading a learner can look up under 監. | KANJIDIC2; Jisho, 監 | medium | one |
| 退 | "leaving a food vessel (皀)" | 退 does not contain 皀. Its actual component is 艮, which depicts an eye or stubborn retreat, not a food vessel. | Wiktionary glyph origin for 退 | medium | two |
| 道 | "the definitions of 行 (street) and 止 (foot)" | 道 is built from 辵 (walking, made of 彳 plus 止) and 首, not from the full character 行. 行 means crossroads and is not a piece of this character; only its half, 彳, is present via 辵. | Wiktionary glyph origin for 道 | medium | two |
| 金 | "It uses the definition of 呂 (two blocks of metal) and the sound of 今." | Shuowen builds 金 from 土 (earth) with 今 for the sound, and the two dots are the metal nuggets. 呂 is not a component of 金, and no standard account gives it the meaning role. | Shuowen Jiezi; Wiktionary | medium | both |
| 鉄 | "the sound of 失" | 鉄 is a simplified vulgar form (itaiji) of 鐵 that substitutes 失 for the old right-hand element as a graphic shortcut, not because 失 is its historical phonetic. Shitsu and tetsu are not close enough in Middle Chinese or Japanese for a genuine phono-semantic reading, which is why 鉄 is the well known kanji some steel makers avoid, reading it as losing gold. | Wiktionary entries for 鉄 and 鐵 | medium | two |
| 需 | "A person (天)" | The standard old-form account (a person drenched by rain) uses 大 for the person, not 天. 天 is a separate character meaning sky or heaven, so naming it here mislabels the piece. | Wiktionary | medium | two |
| 章 | "A chisel (辛) working a piece of jade (now 日)" | Standard accounts of this glyph's early form describe a tattoo needle (辛) marking a pattern over 田 or 曰, not working jade. Shuowen Jiezi instead derives it from 音 plus 十. No standard source I know mentions jade. | Wiktionary; Shuowen Jiezi | medium | two |
| 食 | "A mouth (亼) over a bowl of rice on a stand (皀)" | The same piece 亼 is glossed "a lid" in the story for 合 in this same body of text. One of the two is wrong, and a learner who meets both is told a component means two different things. | Wiktionary, 亼 and 合 | medium | both |
| 骨 | "It uses the definition of 肉 (flesh) and the sound of 冎." | The roles are backwards: 冎 IS the bone, the piece that carries the meaning, and Shuowen reads 骨 as 从冎有肉, bone with flesh on it. Nothing in it is a sound piece, and 冎 (か) does not read こつ. | Shuowen Jiezi | medium | one |
| 鬱 | "People (大, 勹) hiding in a lush forest (林)" | The standard breakdown of 鬱 is 林 (forest) plus 缶, 鬯 (aromatic wine) and 彡 (fragrance marks), with no person figure. There is no 大 or 勹 in the accepted account. | Wiktionary glyph origin (鬱) | medium | two |
| 鮮 | "Fish (魚) and sheep (羊), both delicious: fresh, vivid" | This is a popular folk story, not the paleography. Standard sources treat 鮮 as a phono-semantic compound of 魚 for meaning and an abbreviated 羴 as the sound, originally naming a fish; the fish-and-mutton-are-both-delicious account is a mnemonic that paleographers reject. | Wiktionary, 鮮 etymology section | medium | two |
| 丸 | "A form of 夗 set apart to mean round, something that can be tilted and rolled." | Shuowen derives 丸 from a reversed 仄 (leaning), not from 夗, and Wiktionary follows it. 夗 is a separate character for lying curled up. | Shuowen Jiezi; Wiktionary | low | one |
| 入 | "looked like an arrowhead pointing inward" | Shuowen describes 入 as something entering or converging from above, closer to a tent flap or wedge shape, not an arrowhead. I could not find a standard source describing it as an arrowhead. | Shuowen Jiezi; Wiktionary | low | two |
| 冬 | "The origin is unclear." | Shuowen Jiezi gives an explicit account: 冬 derives from a pictograph of a cord tied at both ends (the original form of 終, meaning 'end'), later borrowed for the end of the year, winter. Calling the origin unclear understates a well documented standard account. | Shuowen Jiezi; Wiktionary | low | two |
| 寧 | "A house (宀) with a food vessel (皿) inside, contentment: peaceful" | This drops 心 (heart), which standard sources give as the component that actually carries the sense of contentment (a heart put at ease by food under a roof); as written it implies 寧 is only 宀 plus 皿. | Wiktionary | low | two |
| 嵐 | "the sound of 葻" | The visible lower component of 嵐 is 風 (wind); most sources describe 嵐 as an ideogrammic compound of 山 and 風 (mountain plus wind), not a phono-semantic compound with 葻 as phonetic. | Wiktionary glyph origin for 嵐 | low | two |
| 幾 | "attending to tiny things, hence how many, how much" | Shuowen's account (fine threads a guard watches over, implying danger from something subtle) supports the sense of "subtle, nearly," but presenting the numeral sense "how many" as a direct consequence of that story overstates the connection; the quantifier use is usually treated as a separate borrowed usage. | Shuowen Jiezi | low | two |
| 徐 | "the definition of 彳 (to walk slowly)" | 彳 is glossed as step or go (the road/walking radical seen in 行, 往, 径), not slowly. The slow-walking sense of 徐 comes from the compound as a whole, not from this piece. | Wiktionary; KANJIDIC2 | low | two |
| 才 | "The original glyph looked like a sharp peg" | Shuowen Jiezi describes 才 as a young plant just sprouting from the ground (a stroke passing up through a horizontal line representing earth), not a peg. This may reflect a newer paleographic reading instead of a contradiction, so flagging for a second look rather than as a clear error. | Shuowen Jiezi entry for 才 | low | two |
| 挙 | "Hands (手) lifting together" | Shuowen gives 舉 as 从手與聲, a phono-semantic compound with 與 as the phonetic, not a plain ideogram of hands. The story drops the phonetic role of 與 without saying the standard account differs. | Shuowen Jiezi | low | two |
| 斜 | "from the idea of scooping something out" | Shuowen gives 斜's original sense as to ladle out (抒也), which is unrelated in meaning to slanting or diagonal; the diagonal sense is a separate borrowed usage, not a semantic outgrowth of scooping. A learner could wrongly take away that tilting a ladle explains the diagonal meaning. | Shuowen Jiezi | low | two |
| 普 | "The sun (日) shining side by side (並) over everything: universal, widespread." | Shuowen reads 普 as 从日並聲, with 並 as the sound piece and no meaning of its own. Reading a picture into it gives the learner a story the sources do not support. | Shuowen Jiezi | low | one |
| 暴 | "Hands (共) lifting a plant up into the sun" | The etymological hands piece in 暴 is 廾 (two hands radical), not 共 (together). Modern glyph decomposition sometimes shows a 共-shaped middle component, but naming it 共 mixes up a different character with the actual radical the origin story is describing. | Wiktionary glyph origin of 暴 | low | two |
| 策 | "the numbered bamboo writing strips" | Shuowen glosses 策 as a horse whip (馬箠也), with 竹 for the bamboo cane and 朿 as the phonetic (thorn/goad); the writing-strip story belongs more properly to 冊. There may be a separate classical usage (bamboo strips for written exam answers) behind the plan/policy sense, but that is not the Shuowen account and the item does not flag the departure. | Shuowen Jiezi | low | two |
| 索 | "Thread (糸) being stripped from a hemp stalk (𣎳)" | Standard glyph histories describe this as hands twisting plant fiber into a rope or cord, not thread being stripped from a stalk. I am not confident the 'hemp stalk' framing or the component named as 𣎳 matches the accepted account. | Wiktionary | low | two |
| 豊 | "A drum (壴) and strings of jade (玨)" | The commonly cited account for 豊/豐's top is paired jade strands (丰丰 or 珏) over the vessel 豆. The drum reading belongs to the visually similar 壴 used in 喜/鼓, and is not the piece usually given for 豊. Worth checking against Wiktionary before trusting the drum claim. | Wiktionary | low | two |
| 軸 | "the axle that passes through a cartwheel" | 由's own pictographic origin is disputed among paleographers (a lamp wick, a sprout, or a fruit are the usual candidates); no standard source glosses it as a cart axle. This looks like the meaning of 軸 being read backward into 由's shape, which could leave a learner with an invented picture of where 由 comes from. | Wiktionary (由, disputed etymology) | low | two |
| 量 | "combined a sun (日) and a bag (東)" | The top of 量 is not a sun pictograph. Early forms show a sack (東) with an opening or funnel on top for pouring in grain, which later flattened into a shape that only resembles 日. | Wiktionary glyph origin for 量 | low | two |
| 録 | "金 (metal, from inscribing on bronze)" | Shuowen gives 錄's original meaning as "the color of metal" (金色也), not an origin tied to inscribing records on bronze; the record sense is a later borrowed use. The parenthetical invents a specific rationale for the meaning piece that isn't the standard account. | Shuowen Jiezi | low | two |

### The mechanical list, in full

All 317, the ones whose named piece is in no etymology record first. "The
glyph's parts" is what the "Made of" tiles show the learner.

| Glyph | Pieces the story names that it does not have | The glyph's parts | The story |
|---|---|---|---|
| 夜 | 亦 | 亠 亻 夕 | This glyph means night. It uses the definition of 夕 (moon) and the sound of 亦. |
| 退 | 夊 皀 | 艮 ⻌ | A foot turned back (夊) leaving a food vessel (皀): rising from the table, to withdraw. |
| 得 | 又 貝 | 彳 㝵 | A hand (又) picking up a cowry shell (貝) on the road (彳): to obtain, to gain. |
| 素 | 廾 | 龶 糸 | Hands (廾) braiding raw thread (糸): plain and undyed, the basic element. |
| 器 | 犬 | 口 口 大 口 口 | By the classical reading, a dog (犬) guarding four vessels (口): utensils, a vessel. |
| 恐 | 巩 | 工 凡 心 | This glyph means fear or dread. It uses the definition of 心 (heart) and the sound of 巩. |
| 勝 | 力 朕 | 月 劵 | This glyph means victory. It uses the definition of 力 (strength) and the sound of 朕. |
| 包 | 巳 | 勹 己 | A fetus (巳) wrapped inside a womb (勹): to wrap, to cover. |
| 善 | 言 | 羊 口 | Two words (言) beside a sheep (羊): the sheep stood for good and beautiful, giving the sense of virtuous and good. |
| 漢 | 熯 | 氵 艹 口 夫 | This glyph means China or Sino-. It uses the definition of 水 (water) and the sound of 熯. It began as the name of a river. |
| 興 | 舁 | 𦥑 同 𦥑 八 | Four hands (舁) lifting an object together: to raise up, to revive. |
| 旬 | 螾 | 勹 日 | This glyph means a ten-day period. It uses the definition of 日 (day) and the sound of 螾. |
| 陶 | 匋 | ⻖ 勹 缶 | This glyph means pottery. It uses the definition of 阜 (mound of earth) and the sound of 匋 (making pottery). |
| 闘 | 鬥 斲 | 門 豆 寸 | This glyph means to fight or war. It uses the definition of 鬥 (two people grappling) and the sound of 斲. |
| 敢 | 又 豕 | 耳 攵 | A hand (又) wielding a tool to hunt a wild boar (豕): to be daring, bold. |
| 寧 | 宀 皿 | 寍 丁 | A house (宀) with a food vessel (皿) inside, contentment: peaceful, and by extension rather or preferably. |
| 奏 | 廾 | 𡗗 天 | The glyph shows two hands (廾) holding up an object, perhaps a musical instrument offered in ritual: to play music, to present. |
| 絶 | 刀 | 糸 色 | A knife (刀) cutting silk threads (糸): to sever, to cut off, to break away. |
| 装 | 壯 | 壮 衣 | This glyph means to dress or outfit. It uses 衣 (clothing) for its meaning and 壮 (壯) for its sound. |
| 汚 | 于 | 氵 二 | This glyph means dirty. It uses the water radical (氵), foul standing water, for its meaning and 于 for its sound. |
| 届 | 凷 | 尸 由 | This glyph means to reach or arrive. It uses 尸 (a bent body) for its meaning and a sound piece (凷) below. |
| 将 | ⺼ | ⺦ ⺤ 寸 | This glyph comes from 將. It showed meat (⺼) offered by a hand (寸) beside 爿 for the sound; from presenting offerings came the sense of one who leads, a commander. |
| 稲 | 臼 | 禾 ⺤ 旧 | This glyph means the rice plant: the grain stalk (禾) gives the meaning, and 舀, a hand scooping grain from a mortar (旧 stands for 臼), gives the sound. |
| 耗 | 禾 | 耒 毛 | This glyph means to consume or wear down. It uses 耒, a plough, for meaning and 毛 for the sound; it was first written 秏, with grain (禾). |
| 堕 | 隋 | 陏 土 | This glyph means to fall or degenerate. It uses the earth (土) one falls to for meaning and 陏 (隋) for the sound. |
| 徳 | 直 | 彳 十 罒 心 | A straight line (直) over a heart (心), set on the road (彳): straight-hearted conduct, virtue. |
| 壱 | 壺 | 士 冖 匕 | This is the formal, document form of the number one. It is the simplified 壹, a jar (壺) enclosing 吉 for the sound. |
| 奈 | 木 | 大 示 | This glyph began as 柰, a tree (木) standing on an altar (示). In Japanese it writes Nara and the question word what, how. |
| 准 | 氵 | 冫 隹 | This glyph means standard, quasi. It comes from 準, a water (氵) leveling tool with 隹 for the sound (じゅん); the form 准 writes 冫. |
| 出 | 止 | 山 凵 | A foot (止) stepping out of a hollow (凵): to step outside, to exit. |
| 合 | 亼 | 人 一 口 | A lid (亼) closing over a container's mouth (口): things coming together and fitting. |
| 年 | 禾 人 | 丿 干 | This glyph originally meant harvest but changed to year over time. It uses the definition of 禾 (grain) and the sound of 人. |
| 見 | 卩 | 目 儿 | A kneeling person (卩) with a big eye (目) for a head: to see. |
| 尚 | 八 向 | ⺌ 冋 | This glyph means to esteem. It uses the definition of 八 and the sound of 向. |
| 事 | 又 中 | 口 ⺕ 亅 | A hand (又) holding up a flag on its pole (中): to carry out one's work, a matter. |
| 定 | 正 | 宀 疋 | This glyph means to fix or settle. It uses the definition of 宀 (roof) and the sound of 正. |
| 外 | 月 | 夕 卜 | This glyph means outside. It uses the definition of 卜 (divination) and the sound of 月. |
| 老 | 人 毛 | 耂 匕 | A man (人) with long hair (毛) leaning on a cane (匕): an old man. |
| 直 | 丨 | 十 目 | A straight vertical line (丨) above an eye (目): looking straight ahead, honest. |
| 前 | 止 舟 | 八 月 刂 | A foot (止) on a boat (舟) moving ahead: in front, before. |
| 書 | 者 | 聿 日 | This glyph means write. It uses the definition of 聿 (writing brush) and the sound of 者. |
| 里 | 田 土 | 日 | A field (田) over soil (土): a measure of land, a village. |
| 重 | 人 東 | 千 里 | This glyph means heavy. It uses the definition of 人 (man) and the sound of 東, picturing a man carrying a heavy bag. |
| 内 | 入 | 冂 人 | To enter (入) a house (冂): inside, within. |
| 正 | 丁 | 一 止 | This glyph means correct. It uses the definition of 止 (foot) and the sound of 丁, a foot marching straight toward a goal. |
| 先 | 止 | 儿 | A foot (止) above a person (儿): to go forward, to be ahead. |
| 成 | 戊 丁 | 𠂊 戈 | This glyph means become. It uses the definition of 戊 (a weapon guarding city walls) and the sound of 丁. |
| 真 | 貝 | 十 具 | This glyph means true. It uses the definition of 貝 (shell) and the sound of 𠂈. |
| 知 | 大 子 | 矢 口 | An adult (大), a mouth (口), and a child (子): to pass on knowledge, thus to know. |
| 法 | 盍 | 氵 去 | This glyph means law. It uses the definitions of 水 (water) and 廌 (a legendary beast) and the sound of 盍. |
| 向 | 宀 | 丿 冂 口 | A house (宀) and a mouth (口): a sound echoing in a place, and by extension facing toward. |
| 天 | 丁 | 一 大 | This glyph means heaven or sky. It uses the definition of 大 (a standing man) and the sound of 丁, marking what is high above his head. |
| 差 | 來 | 羊 丿 工 | Wheat (來) and a left hand (𠂇): hulling grain by rubbing it between the hands. |
| 色 | 爪 卩 | 𠂊 巴 | A hand (爪) pressing down on a kneeling person (卩). It first meant to press down, then was borrowed to mean color. |
| 道 | 行 | 首 ⻌ | This glyph means road, a way. It uses the definitions of 行 (street) and 止 (foot) and the sound of 首. |
| 期 | 日 | 其 月 | This glyph means a period of time. It uses the definition of 日 (sun) and the sound of 其. |
| 強 | 彊 | 弓 厶 虫 | This glyph originally meant a rice weevil but changed to strong over time. It uses the definition of 虫 (insect) and the sound of 彊. |
| 別 | 冎 | 口 勹 刂 | A knife (刀) cutting apart bone and flesh (冎): to separate, to branch off. |
| 原 | 泉 | 厂 CDP-8BC4 | A spring (泉) bursting out from under a cliff (厂): the source, the origin. |
| 冷 | 仌 | 冫 令 | This glyph means cold. It uses the definition of 仌 (ice) and the sound of 令 (れい). |
| 形 | 井 | 开 彡 | This glyph means shape. It uses the definition of 彡 (pattern, decoration) and the sound of 井. |
| 表 | 毛 | 二 丨 衣 | Fur (毛) worn on the outside of a garment (衣): the outer surface. |
| 屋 | 室 | 尸 至 | This glyph means house. It uses the definition of 室 (room) and the sound of 𡉉. |
| 急 | 及 | 𠂊 ⺕ 心 | This glyph means to hurry. It uses the definition of 心 (heart) and the sound of 及 (きゅう). |
| 青 | 生 井 | 龶 月 | This glyph means the blue-green of growing plants. It uses the definition of 生 (growth) and the sound of 井 (しょう). |
| 最 | 宀 | 日 取 | This glyph originally meant to gather but changed to utmost over time. It uses the definition of 宀 (roof) and the sound of 取. |
| 受 | 舟 | ⺤ 冖 又 | Two hands (爪 and 又) passing a boat (舟) between them: to hand over, to receive. |
| 教 | 爻 | 孝 攵 | A hand holding a cane of authority (攴) teaching a child (子), with the sound of 爻: to teach. |
| 保 | 子 | 亻 呆 | A person (人) carrying a child (子) on their back: to carry, to protect. |
| 配 | 卩 | 酉 己 | A person kneeling (卩) beside a wine jar (酉): pouring out and sharing wine, to distribute. |
| 早 | 棗 | 日 十 | This glyph means early. It uses the definition of 日 (sun) and the sound of 棗. |
| 務 | 敄 | 矛 攵 力 | This glyph means task. It uses the definition of 力 (strength) and the sound of 敄. |
| 開 | 廾 一 | 門 开 | Two hands (廾) lifting the latch (一) off a door (門): to open. |
| 命 | 令 | 人 一 口 卩 | This glyph means command. It uses the definition of 口 (mouth) and the sound of 令. |
| 然 | 肰 | 月 犬 灬 | This glyph originally meant to burn but was borrowed to mean so or thus. It uses the definition of 火 (fire) and the sound of 肰. |
| 共 | 廾 口 | 八 | Two hands (廾) holding up an object (口): doing something together. |
| 死 | 尸 | 歹 匕 | This glyph means death. It uses the definition of 歹 (bare bones) and the sound of 尸. |
| 制 | 朱 | 牛 巾 刂 | A knife (刀) cutting a tree (朱) down to shape: to control, a system. |
| 送 | 灷 | 关 ⻌ | This glyph means to escort or send off. It uses the definition of 辵 (to walk) and the sound of 灷. |
| 野 | 田 | 里 予 | This glyph means open field or plains. It uses the definition of 田 (field) and 土 (earth), and the sound of 予. |
| 支 | 竹 | 十 又 | A hand (又) holding half a bamboo branch (竹): a branch, to prop up and support. |
| 可 | 丂 | 丁 口 | This glyph means can or approval. It uses the definition of 口 (mouth) and the sound of 丂, with a sense of breath pushed out. |
| 失 | 手 | 丿 夫 | One reading shows something slipping out of a hand (手): to lose, to let fall. |
| 市 | 兮 之 | 亠 巾 | This glyph means market or town. It uses the definition of 兮 (bustling) and the sound of 之. |
| 突 | 犬 | 穴 大 | A dog (犬) bursting out of a den (穴): to thrust out suddenly, to stab. |
| 弱 | 彡 | 弓 冫 弓 冫 | A bow (弓) dressed up with decorative flourishes (彡): a bow good only for show, hence weak. |
| 電 | 申 | 雨 日 | This glyph means electricity. It uses the definition of 雨 (rain) and the sound of 申, which pictured a lightning bolt. |
| 親 | 辛 | 立 木 見 | This glyph means parent or closeness. It uses the definition of 見 (to see) and the sound of 辛 (しん). |
| 難 | 暵 | 艹 口 夫 隹 | This glyph now means difficult, but first named a kind of bird. It uses the definition of 隹 (bird) and the sound of 暵. |
| 質 | 斦 | 斤 斤 貝 | Axes (斦) set against a cowrie shell (貝, money): goods given as a pledge, hence substance and quality. |
| 害 | 丯 | 宀 龶 口 | This glyph means harm or injury. It uses the definition of 宀 (house) and 口 (mouth), and the sound of 丯. |
| 業 | 丵 大 | 业 羊 木 | Chisel-teeth (丵) over something big (大): the notched board this pictured came to mean work and vocation. |
| 愛 | 旡 | ⺤ 冖 心 夂 | This glyph means love. It uses the definition of 心 (heart) and the sound of 旡. |
| 具 | 廾 鼎 | 目 八 | Two hands (廾) holding up a cauldron (鼎): to prepare and set out, hence tools and utensils. |
| 服 | 凡 | 月 卩 又 | This glyph means to serve and obey, later clothing. It uses the definition of 凡 (tray) and the sound of 𠬝. |
| 軍 | 勹 | 冖 車 | Chariots (車) drawn up in an encircling ring (勹): an army, troops. |
| 容 | 公 | 宀 谷 | This glyph means to hold or contain. It uses the definition of 宀 (roof) and the sound of 公. |
| 常 | 巾 | 尚 吊 | This glyph originally meant a long skirt but changed to usual or constant over time. It uses the definition of 巾 (cloth) and the sound of 尚. |
| 達 | 羍 | 土 羊 ⻌ | This glyph means to reach or arrive. It uses the definition of 辵 (to walk) and the sound of 羍. |
| 散 | 林 | 月 攵 | Trees or stalks (林) beaten apart with a stick (攴): to break up, to scatter. |
| 選 | 止 | 巽 ⻌ | This glyph means to choose. It uses the definition of 止 (foot) and the sound of 巽. |
| 布 | 父 | 巾 | This glyph means cloth. It uses the definition of 巾 (cloth) and the sound of 父 (ふ). |
| 光 | 火 卩 | ⺌ 兀 | A fire (火) held above a kneeling person (卩): light, radiance. |
| 改 | 巳 | 己 攵 | This glyph means to reform or change. It uses the definition of 攴 (a hand with a stick) and the sound of 巳. |
| 段 | 厂 | 殳 | This glyph means steps or grade. It uses the definition of 殳 (a hammer striking) and the sound of 厂: a hammer breaking stone into pieces. |
| 茶 | 余 | 艹 人 木 | This glyph means tea. It uses the definition of 艸 (plant) and the sound of 余. |
| 細 | 囟 | 糸 田 | This glyph means thin or fine. It uses the definition of 糸 (thread) and the sound of 囟. |
| 報 | 㚔 | 幸 卩 又 | Handcuffs (㚔) and a hand subduing a person (𠬝): to convict and pass judgment, hence to report. |
| 滅 | 烕 | 氵 戌 火 | This glyph means to destroy. It uses the definition of 水 (water) and the sound of 烕, wiping something out as with a flood. |
| 滴 | 啻 | 氵 啇 | This glyph means a drip or drop. It uses the definition of 水 (water) and the sound of 啻. |
| 適 | 啻 | 啇 ⻌ | This glyph means suitable. It uses the definition of 辵 (to walk) and the sound of 啻. |
| 印 | 爪 | 丿 丨 卩 | A hand (爪) pressing down on a kneeling person (卩): to press down, hence a stamp or seal. |
| 替 | 竝 | 夫 夫 日 | Two figures (竝) changing places above 曰: to swap, to substitute. |
| 類 | 犬 頪 | 米 大 頁 | This glyph means sort or kind. It uses the definition of 犬 (dog) and the sound of 頪. |
| 血 | 一 | 皿 | A single drop (一) inside a vessel (皿): blood collected in a bowl for sacrifice. |
| 更 | 攴 | 一 日 乂 | This glyph means the night watch, sitting up late. It uses the definition of 攴 (a hand with a whip, action) and the sound of 𰀒, which pictured two chariots. |
| 省 | 生 | 少 目 | This glyph means to inspect, and by extension to leave out. It uses the definition of 目 (eye) and the sound of 生 (しょう). |
| 負 | 人 | 𠂊 貝 | A person (人) with shell money (貝) on their back: to shoulder a burden, to owe, to lose. |
| 旅 | 从 㫃 | 方 𠂉 亻 | People (从) gathered under a flag (㫃): a band of troops, hence a journey. |
| 設 | 埶 | 言 殳 | This glyph means to set up or establish. It uses the definition of 言 (speech) and the sound of 埶. |
| 農 | 林 | 曲 辰 | A hoe (辰) clearing weeds among the plants (林): to farm, agriculture. |
| 敷 | 尃 | 旉 攵 | This glyph means to spread out. It uses the definition of 攴 (action) and the sound of 尃 (to distribute). |
| 句 | 丩 | 勹 口 | This glyph means phrase. It uses the definition of 丩 (two ropes entangled) and the sound of 口. |
| 台 | 㠯 | 厶 口 | This glyph means stand. It uses the definition of 口 (mouth) and the sound of 㠯. |
| 赤 | 大 火 | 土 | A person (大) beside a fire (火): the color of fire, red. |
| 夏 | 頁 日 | 一 自 夂 | A man (頁) toiling under the scorching sun (日): summer. |
| 宿 | 人 | 宀 佰 | A person (人) resting on a mat under a roof (宀): lodging, an inn. |
| 敬 | 茍 | 苟 攵 | A kneeling person (茍) and a hand holding a stick (攴): to show respect, reverence. |
| 罰 | 詈 刀 | 罒 䚯 | Verbal abuse (詈) together with a knife (刀): a crime and its punishment. |
| 暴 | 共 | 日 㳟 | Hands (共) lifting a plant up into the sun (日) to dry it out. It later also came to mean violent, an outburst. |
| 舞 | 無 | 丿 一 舛 | This glyph means to dance. It uses the definition of 舛 (two feet stepping) and the sound of 無 (ぶ). |
| 号 | 丂 | 口 一 | A mouth (口) plus forced-out breath (丂, like a tiger's cry): a loud call, a shouted name. |
| 危 | 厃 | 𠂊 厄 | A person at a cliff edge (厃) above someone kneeling (卩): a dangerous, fearful height. |
| 存 | 才 | 亻 子 | This glyph means to exist. It uses the definition of 子 (child) and the sound of 才. |
| 低 | 氐 | 亻 氏 一 | This glyph means to lower. It uses the definition of 人 (person) and the sound of 氐. |
| 毒 | 屮 毐 | 龶 毋 | This glyph means poison. It uses the definition of 屮 (vegetation) and the sound of 毐, suggesting a poisonous plant. |
| 則 | 鼎 | 貝 刂 | A knife (刀) carving marks into a bronze cauldron (鼎): a fixed rule or law. |
| 及 | 人 | 丿 又 | A hand (又) reaching to grab a person (人) from behind: to reach, to catch up to. |
| 骨 | 冎 | 月 | This glyph means bone. It uses the definition of 肉 (flesh) and the sound of 冎. |
| 乾 | 倝 | 𠦝 乞 | This glyph means dry. It uses the definition of 乙 and the sound of 倝. |
| 雪 | 彗 | 雨 ⺕ | This glyph means snow. It uses the definition of 雨 (rain) and the sound of 彗. |
| 寒 | 人 茻 | 宀 三 八 冫 | A person (人) in a house (宀) huddled in grass (茻) against the cold. |
| 麻 | 厂 | 广 林 | Hemp plants (𣏟) drying under a shelter (厂): hemp, flax. |
| 兵 | 廾 | 丘 八 | Two hands (廾) holding an axe (斤): a soldier bearing a weapon. |
| 系 | 手 | 丿 糸 | A hand (手) holding silk threads (糸): connected threads, a lineage, a system. |
| 封 | 土 丰 | 圭 寸 | This glyph means to seal. It uses the definition of 土 (earth) and 寸 (hand), and the sound of 丰. |
| 春 | 艸 屯 | 𡗗 日 | This glyph means spring. It uses the definition of 艸 (grass) and 日 (sun), and the sound of 屯 (swollen sprout). |
| 荒 | 巟 | 艹 亡 川 | This glyph means laid waste. It uses the definition of 艸 (grass, plant) and the sound of 巟. |
| 射 | 弓 矢 | 身 寸 | A bow and arrow (弓, 矢) drawn by a hand: to shoot. The bow later became 身 and the hand became 寸. |
| 執 | 㚔 丮 | 幸 丸 | Handcuffs (㚔) beside a hand (丮): to seize and arrest, hence to grasp and hold on tenaciously. Today those pieces are written 幸 and 丸. |
| 飲 | 酓 | 飠 欠 | This glyph means to drink. It uses the definition of 欠 (an open mouth) and the sound of 酓. |
| 去 | 大 口 | 土 厶 | A man (大) above an opening (口): a man leaving a doorway or cave, giving the sense to go away, to depart. |
| 刑 | 井 | 开 刂 | This glyph means punishment or penalty. It uses the definition of 刀 (knife) and the sound of 井. |
| 典 | 冊 丌 | 曲 八 | Official books (冊) resting on a table (丌): a canon of law, a ceremony. |
| 岸 | 屵 | 山 厂 干 | This glyph means shore. It uses the definition of 屵 (cliff) and the sound of 干: the edge of the land. |
| 承 | 卩 廾 | 了 三 水 | A kneeling person (卩) and two raised hands (廾): to hold up and carry, to receive. |
| 族 | 㫃 | 方 𠂉 矢 | A flag (㫃) with arrows (矢) gathered beneath it: a clan, a tribe. |
| 喜 | 壴 | 吉 口 | A drum (壴) above a mouth (口): singing to the beat, to rejoice. |
| 診 | 㐱 | 言 人 彡 | This glyph means to examine a patient. It uses the definition of 言 (words) and the sound of 㐱. |
| 貴 | 臾 | 中 貝 | This glyph means precious. It uses the definition of 貝 (a cowrie shell used as money) and the sound of 臾. |
| 遂 | 㒸 | 豕 ⻌ | This glyph means to accomplish. It uses the definition of 辵 (movement) and the sound of 㒸. |
| 微 | 美 | 彳 山 兀 攵 | This glyph means tiny or delicate. It uses the definition of 攴 (a hand with a tool) and the sound of 美 (び): combing out fine hairs, something minute. |
| 棄 | 廾 | 亠 厶 丗 木 | Two hands (廾) throwing out a child in a basket (𠀠): to abandon, to discard. |
| 飾 | 飤 | 飠 𠂉 巾 | This glyph means to decorate or adorn. It uses the definition of 巾 (cloth) and the sound of 飤. |
| 練 | 柬 | 糸 東 | This glyph means to train or practice. It uses the definition of 糸 (silk) and the sound of 柬. |
| 敵 | 啻 | 啇 攵 | This glyph means enemy or foe. It uses the definition of 攴 (to hit) and the sound of 啻. |
| 籍 | 耤 | 竹 耒 昔 | This glyph means a register or roster. It uses the definition of 竹 (bamboo) and the sound of 耤: the bamboo census books. |
| 千 | 一 人 | 丿 十 | This glyph means thousand. It uses the definition of 一 (one, a number) and the sound of 人. |
| 巡 | 川 | 巛 ⻌ | This glyph means to patrol or go around. It uses the definition of 辵 (to walk) and the sound of 川. |
| 即 | 皀 | 艮 卩 | A food vessel (皀) beside a kneeling person (卩): to come near and eat, to approach. |
| 妻 | 肀 | ⺕ 女 | A hand grabbing hair (肀) above a woman (女): a wife, marking her as taken. |
| 宜 | 多 | 宀 且 | Two pieces of meat (多) set on a sacrificial altar (且): a proper offering, and so what is right and good. |
| 屈 | 尾 | 尸 出 | This glyph means to bend or yield. It uses the definition of 尾 (tail) and the sound of 出. |
| 延 | 彳 | 正 廴 | Walking (彳) and a foot (止): to travel far, to stretch out and prolong. |
| 武 | 戈 | CDP-8CB8 止 | A dagger-axe (戈) and a foot (止): an army marching on an expedition, military might. |
| 威 | 戌 | 戍 女 | A broad axe (戌) beside a woman (女): overawing, commanding force. |
| 施 | 㫃 | 方 𠂉 也 | This glyph means to bestow or carry out. It uses the definition of 㫃 (a fluttering banner) and the sound of 也. |
| 為 | 又 象 | 丶 勹 灬 | A hand (又) leading an elephant (象): to work, to do, to make. |
| 砂 | 沙 | 石 少 | This glyph means sand. It uses the definition of 石 (stone) and the sound of 沙 (さ). |
| 香 | 黍 口 | 禾 日 | Millet (黍) over a mouth (口): the sweet smell of grain, fragrance. |
| 候 | 矦 | 亻 丨 矢 | This glyph means season or weather. It uses the definition of 人 (person) and the sound of 矦. |
| 凍 | 仌 | 冫 東 | This glyph means frozen. It uses the definition of 仌 (ice) and the sound of 東 (とう). |
| 祭 | 又 | 月 示 | A hand (又) offering a piece of meat (肉) at an altar (示): a ritual, a festival. |
| 第 | 弟 | 竹 弔 丿 | This glyph means order or number. It uses the definition of 竹 (bamboo) and the sound of 弟 (だい): the numbered bamboo writing strips. |
| 陰 | 侌 | ⻖ 今 云 | This glyph means shade, the yin side. It uses the definition of 阜 (hill) and the sound of 侌. |
| 隊 | 㒸 | ⻖ 豕 | This glyph means a troop or company. It uses the definition of 阜 (hill) and the sound of 㒸. |
| 幹 | 木 倝 | 𠦝 人 干 | This glyph means tree trunk. It uses the definition of 木 (tree) and the sound of 倝. |
| 携 | 雟 | 扌 隽 | This glyph means to carry in the hand. It uses the definition of 手 (hand) and the sound of 雟. |
| 競 | 誩 | 立 兄 立 兄 | Two men (儿, 儿) with an argument (誩) between them: to compete, to contend. |
| 丈 | 又 十 | 一 乂 | A hand (又) measuring out ten (十) units: a zhang, a measure of length. |
| 令 | 亼 卩 | 人 一 マ | A mouth (亼) giving orders above a kneeling man (卩): to command. |
| 旦 | 丁 | 日 一 | This glyph means daybreak. It uses the definition of 日 (sun) and the sound of 丁. |
| 灰 | 又 | 厂 火 | A hand (又) over fire (火) cool enough to touch: ashes. |
| 昔 | 龷 | 廾 日 | This glyph means long ago. It uses the definition of 日 (sun, standing for past days) and the sound of 龷. |
| 炊 | 吹 | 火 欠 | This glyph means to cook. It uses the definition of 火 (fire) and the sound of 吹. |
| 肥 | 卪 | 月 巴 | Flesh (肉) beside a kneeling person (卪): to grow fat, fertile. |
| 侵 | 帚 | 亻 ⺕ 冖 又 | A person (人) holding a broom (帚) in hand (又), sweeping forward: to encroach, to invade. |
| 冒 | 冃 | 日 目 | This glyph means to risk. It uses the definition of 目 (eyes) and the sound of 冃 (a hat over the eyes). |
| 勇 | 甬 | マ 男 | This glyph means courage. It uses the definition of 力 (strength) and the sound of 甬. |
| 炭 | 岸 | 山 灰 | This glyph means charcoal. It uses the definition of 火 (fire) and the sound of 岸. |
| 臭 | 犬 | 自 大 | A dog (犬) beside a nose (自): a strong smell, hence stinking. |
| 凄 | 仌 | 冫 妻 | This glyph means chilling and eerie. It uses the definition of 仌 (ice) and the sound of 妻. |
| 既 | 皀 | 艮 旡 | A person kneeling (旡) turned away from a bowl of rice (皀): already finished eating, already done. |
| 翌 | 昱 | 羽 立 | This glyph means the next or following day. It uses the definition of 昱 (daylight) and the sound of 羽. |
| 責 | 朿 | 龶 貝 | This glyph means to demand or blame, originally a debt owed. It uses the definition of 貝 (money) and the sound of 朿. |
| 逸 | 兔 | 免 ⻌ | A rabbit (兔) and a movement piece (辵, road): a rabbit darting off, to escape or stray. |
| 就 | 享 | 京 尤 | A tall hall (享) and a high tower (京): to go to a high place, to settle down or take up. |
| 焦 | 小 | 隹 灬 | This glyph means to char or scorch. It uses the definition of 隹 (bird) and the sound of 小 (しょう). |
| 嘆 | 歎 | 口 艹 口 夫 | This glyph means to sigh or lament. It uses the definition of 口 (mouth) and the sound of 歎. |
| 豊 | 壴 玨 | 曲 豆 | A drum (壴) and strings of jade (玨): a bountiful ceremonial offering. |
| 維 | 唯 | 糸 隹 | This glyph means fiber, or a rope tie. It uses the definition of 糸 (thread) and the sound of 唯. |
| 岡 | 网 | 冂 山 | This glyph means a hill or ridge. It uses the definition of 山 (mountain) and the sound of 网. |
| 蔑 | 戈 | 艹 罒 戍 | A person (𦰋) and a dagger-axe (戈), a weapon striking someone down: to wipe out, to hold in contempt. |
| 監 | 臥 | 臣 𠂉 皿 | A person with a wide eye (臥) bending over a container (皿) to see their reflection: to watch over, to oversee. |
| 範 | 笵 | 竹 車 卩 | This glyph means a pattern or model. It uses the definition of 車 (carriage) and the sound of 笵. |
| 緊 | 臤 | 臣 又 糸 | This glyph means tight or tense. It uses the definition of 糸 (thread) and the sound of 臤. |
| 賢 | 臤 | 臣 又 貝 | This glyph means wise or worthy. It uses the definition of 貝 (money) and the sound of 臤: valuable like money. |
| 臨 | 人 | 臣 𠂉 品 | An eye (臣) and a person (人) bending over some objects (品): to look down at, to face. |
| 騰 | 馬 朕 | 月 駦 | This glyph means to leap or rise up. It uses the definition of 馬 (horse) and the sound of 朕: a horse's gallop. |
| 充 | 儿 | 亠 允 | A newborn (𠫓) above a standing person (儿): a child grows to full maturity, to fill out. |
| 旨 | 甘 | 匕 日 | This glyph means delicious. It uses the definition of 甘 (tasty) and the sound of 匕 (a spoon). |
| 徹 | 又 鬲 | 彳 育 攵 | A hand (又) clearing away a pot (鬲) after a meal: to remove, and so to pierce through and make clear. |
| 刷 | 㕞 | 尸 巾 刂 | This glyph means to print or brush. It uses the definition of 刀 (knife) and the sound of 㕞. |
| 卑 | 甲 | 丿 田 丿 十 | A hand (𠂇) holding up a fan (甲) for a master: a lowly servant, and so base. |
| 甚 | 匕 | 甘 匹 | Something sweet (甘) taken with a spoon (匕): great indulgence, and so extremely, very. |
| 肺 | 巿 | 月 市 | This glyph means lungs. It uses the definition of 肉 (flesh) and the sound of 巿. |
| 宴 | 妟 | 宀 日 女 | This glyph means banquet. It uses the definition of 宀 (roof) and the sound of 妟. |
| 菌 | 囷 | 艹 囗 禾 | This glyph means fungus, germ. It uses the definition of 艸 (plants) and the sound of 囷. |
| 軟 | 耎 | 車 欠 | This glyph means soft. It uses the definition of 車 (carriage) and the sound of 耎. |
| 堅 | 臤 | 臣 又 土 | This glyph means hard, solid. It uses the definition of 土 (earth) and the sound of 臤. |
| 稚 | 屖 | 禾 隹 | This glyph means young or immature. It uses the definition of 禾 (grain plant) and the sound of 屖. |
| 聖 | 呈 | 耳 口 王 | This glyph means holy, a sage. It uses the definition of 耳 (ear), keen hearing, and the sound of 呈. |
| 旗 | 㫃 | 方 𠂉 其 | This glyph means a flag or banner. It uses the definition of 㫃 (flag) and the sound of 其. |
| 憂 | 夊 㥑 | 百 冖 心 夂 | This glyph means grief or melancholy. It uses the definition of 夊 (a slow, trailing step) and the sound of 㥑. |
| 憩 | 恬 | 舌 息 | Tranquil (恬) plus rest (息): to take a rest, to relax. |
| 融 | 蟲 | 鬲 虫 | This glyph means to melt, to dissolve. It uses the definition of 鬲 (cauldron) and the sound of 蟲. |
| 癖 | 病 | 疒 辟 | This glyph means a habit or vice. It uses the definition of 病 (illness) and the sound of 辟. |
| 襲 | 龖 | 龍 衣 | This glyph means to attack. It uses the definition of 衣 (cloth) and the sound of 龖. |
| 鬱 | 大 勹 林 | 缶 木 木 冖 鬯 彡 | People (大, 勹) hiding in a lush forest (林): dense growth, and by extension gloom and depression. |
| 冗 | 儿 宀 | 冖 几 | A person (儿) at home under a roof (宀) with nothing to do: idle, superfluous. |
| 斥 | 广 屰 | 斤 丶 | This glyph means to reject. It uses the definition of 广 (building) and the sound of 屰. |
| 希 | 爻 | 乂 布 | Crossed threads (爻) over cloth (巾): to hope, to beg. |
| 狂 | 㞷 | ⺨ 王 | This glyph means crazy. It uses the definition of 犬 (dog) and the sound of 㞷. |
| 那 | 冉 | 二 ⻏ | This glyph means what or that. It uses the definition of 邑 (city) and the sound of 冉. It began as the name of a state and was later borrowed for its sound. |
| 奉 | 廾 丰 | 𡗗 丨 | This glyph means to offer or present. It uses the definition of 廾 (two hands) and the sound of 丰. |
| 拐 | 冎 | 扌 口 刀 | This glyph means to kidnap. It uses the definition of 手 (hand) and the sound of 冎. |
| 肯 | 冎 | 止 月 | Meat (肉) attached to the bone (冎): to consent, to agree. |
| 契 | 㓞 | 龶 刀 大 | This glyph means a pledge or contract. It uses the definition of 大 (person) and the sound of 㓞 (to engrave), like a person carving an agreement. |
| 津 | 盡 | 氵 聿 | This glyph means harbor. It uses the definition of 水 (water) and the sound of 盡. |
| 珍 | 㐱 | 王 人 彡 | This glyph originally meant a fine gem but came to mean rare. It uses the definition of 玉 (jade) and the sound of 㐱. |
| 畏 | 鬼 | 田 一 | The early glyph showed a ghost (鬼) holding a stick: something to fear. |
| 虐 | 虎 人 | 虍 | A tiger (虎) about to eat a person (人): to be cruel, to tyrannize. |
| 衷 | 中 | 衣 口 丨 | This glyph means inmost feelings. It uses the definition of 衣 (clothes) and the sound of 中 (ちゅう). |
| 唐 | 庚 | 广 ⺕ 口 | This glyph names the Tang dynasty. It uses the definition of 口 (mouth) and the sound of 庚. |
| 拳 | 龹 | 二 人 手 | This glyph means fist. It uses the definition of 手 (hand) and the sound of 龹. |
| 捗 | 步 | 扌 歩 | This glyph means to make progress. It uses the definition of 手 (hand) and the sound of 步. |
| 班 | 珏 | 王 刂 王 | Two pieces of jade (珏) with a knife (刀) between them, cutting jade apart: to divide into groups. |
| 酎 | 肘 | 酉 寸 | This glyph means refined sake. It uses the definition of 酉 (wine) and the sound of 肘. |
| 庶 | 石 | 广 廿 灬 | This glyph means commoner. It uses the definition of 火 (fire) and the sound of 石. |
| 旋 | 㫃 止 | 方 𠂉 疋 | A flag (㫃), a foot (止), and a circle (〇): to turn around, to rotate. |
| 爽 | 㸚 | 大 爻 爻 | A figure (大) with bright markings (㸚) at its sides: bright, refreshing. |
| 赦 | 亦 | 赤 攵 | This glyph means to pardon. It uses the definition of 攴 (a hand holding a stick) and the sound of 亦. |
| 僅 | 堇 | 亻 艹 三 | This glyph means only a little. It uses the definition of 人 (person) and the sound of 堇. |
| 喪 | 㗊 桑 | 十 口 口 衣 | This glyph means mourning or loss. It uses the definition of 㗊 (many mouths) and the sound of 桑. |
| 嵐 | 葻 | 山 風 | This glyph means a mountain storm. It uses the definition of 山 (mountain) and the sound of 葻. |
| 惰 | 隋 | 忄 左 月 | This glyph means lazy. It uses the definition of 心 (heart) and the sound of 隋. |
| 琴 | 珡 | 王 王 今 | This glyph means a koto or harp. It uses the definition of 珡 and the sound of 今. |
| 彙 | 㣇 胃 | 彑 冖 果 | This glyph means to collect or classify. It uses the definition of 㣇 and the sound of 胃 (い). |
| 殿 | 臀 | 尸 共 殳 | This glyph means a hall or mansion. It uses the definition of 殳 (a hand holding a weapon) and the sound of 臀. |
| 睦 | 坴 | 目 土 儿 土 | This glyph means friendly and harmonious. It uses the definition of 目 (eye) and the sound of 坴. |
| 羨 | 㳄 | 羊 氵 欠 | Saliva (㳄) over a sheep (羊): to drool with envy, to covet. |
| 雷 | 畾 | 雨 田 | This glyph means thunder. It uses the definition of 雨 (rain) and the sound of 畾. |
| 奪 | 又 雀 衣 | 奞 寸 | A hand (又) seizing a bird (雀) from a robe (衣): to snatch away by force. |
| 寡 | 頁 | 宀 自 分 | A single head (頁) under a roof (宀): only one person in the house, alone, few. |
| 熊 | 炎 | 能 灬 | This glyph means bear. It combines 能 (bear) with the sound of 炎. It first described a blazing fire, then took over the meaning bear when 能 was borrowed away. |
| 獄 | 㹜 | ⺨ 言 犬 | Two dogs (㹜) and words (言): dogs barking at each other, a jail with guard dogs. |
| 豪 | 高 | 亠 口 冖 豕 | This glyph means overpowering and great. It uses the definition of 豕 (pig, boar) and the sound of 高. |
| 貌 | 豹 | 豸 皃 | This glyph means appearance. It uses the definition of 皃 (looks) and the sound of 豹. |
| 撤 | 徹 | 扌 育 攵 | This glyph means to remove or withdraw. It uses the definition of 手 (hand) and the sound of 徹 (てつ), from the idea of removing by hand. |
| 膚 | 盧 | 虍 胃 | This glyph means skin. It uses the definition of 肉 (meat) and the sound of 盧. |
| 膝 | 桼 | 月 木 氺 | This glyph means the knee. It uses the definition of 肉 (body) and the sound of 桼. |
| 凝 | 仌 | 冫 疑 | This glyph means to congeal or freeze. It uses the definition of 仌 (ice) and the sound of 疑. |
| 樹 | 尌 | 木 壴 寸 | This glyph means trees or timber. It uses the definition of 木 (tree) and the sound of 尌 (to plant a tree). |
| 衡 | 角 | 行 𩵋 | This glyph means a measuring scale. It uses the definition of 角 (horn) and 大 (big), and the sound of 行 (こう). |
| 癒 | 病 | 疒 愈 | This glyph means to heal. It uses the definition of 病 (illness) and the sound of 愈. |
| 韓 | 倝 | 𠦝 韋 | This glyph means Korea. It uses the definition of 韋 (surround) and the sound of 倝. |
| 孔 | 丿 | 子 乙 | An opening (丿) in a child's head (子): the soft spot in a newborn's skull, and by extension a hole. |
| 妃 | 卩 | 女 己 | A woman (女) beside a kneeling man (卩): a consort, a queen. |
| 冶 | 呂 刀 | 冫 台 | Metal ingots (呂) with a ladle (刀): to melt and cast metal, smelting. |
| 尿 | 尾 | 尸 水 | A stream of water (水) below a body (尾): urine. |
| 奔 | 人 止 | 大 卉 | A person (人) over hurrying feet (止): to run and bustle. |
| 岳 | 羋 | 丘 山 | This glyph means mountain peak. It uses the definition of 山 (mountain) and the sound of 羋. |
| 弥 | 尔 | 弓 尓 | This glyph means increasingly, all the more. It uses the definition of 弓 (bow) and the sound of 尔. |
| 炉 | 盧 | 火 戸 | This glyph means hearth or furnace. It uses the definition of 火 (fire) and the sound of 盧. |
| 帥 | 寻 | 丿 巾 | Two hands (寻) and a cloth sash (巾): to don the sash and lead troops. |
| 疫 | 役 | 疒 殳 | This glyph means epidemic. It uses the definition of 疒 (sickness) and the sound of 役 (えき). |
| 冥 | 廾 | 冖 日 六 | A cloth cover (冖) over the sun (日) held up by two hands (廾): darkness. |
| 剝 | 彔 | 彑 氺 刂 | This glyph means to peel off. It uses the definition of 刀 (knife) and the sound of 彔. |
| 宰 | 乂 | 宀 辛 | A house (宀) where governing is done (乂): to manage, to rule. |
| 泰 | 廾 大 | 𡗗 氺 | This glyph means calm and peaceful. It uses the definition of 廾 (two hands) and 水 (water) with the sound of 大 (たい). |
| 畝 | 田 每 | 亩 久 | This glyph means a furrow or ridge in a field. It uses the definition of 田 (field) and the sound of 每. |
| 陛 | 坒 | ⻖ 比 土 | This glyph means the steps to the throne, Your Majesty. It uses the definition of 阜 (mound, stairs) and the sound of 坒. |
| 庸 | 庚 同 | 广 ⺕ 用 | This glyph means commonplace or ordinary. It uses the definition of 庚 and the sound of 同. |
| 淫 | 㸒 | 氵 ⺤ 壬 | This glyph means lewd or excessive. It uses the definition of 水 (water) and the sound of 㸒. |
| 隆 | 降 | ⻖ 夂 生 | This glyph means high and prosperous. It uses the definition of 生 (to grow) and the sound of 降. |
| 斑 | 班 | 王 文 王 | This glyph means a spot or speckle. It uses the definition of 文 (pattern) and the sound of 班. |
| 款 | 柰 | 士 示 欠 | This glyph means goodwill, also an article or clause. It uses the definition of 欠 (to lack, to desire) and the sound of 柰. |
| 硫 | 流 | 石 㐬 | This glyph means sulphur. It uses the definition of 石 (stone) and the sound of 流 (りゅう). |
| 腎 | 臤 | 臣 又 月 | This glyph means kidney. It uses the definition of 肉 (flesh) and the sound of 臤. |
| 賊 | 戈 則 | 貝 戎 | This glyph means thief or traitor. It uses the definition of 戈 (weapon) and the sound of 則. |
| 辣 | 剌 | 辛 束 | This glyph means pungent or spicy. It uses the definition of 辛 (spicy) and the sound of 剌. |
| 慶 | 廌 | 广 心 夂 | A deer (廌) and a heart (心): the joy of receiving a prized deer, hence to celebrate. |
| 畿 | 幾 | 幺 幺 戈 田 | This glyph means the capital region. It uses the definition of 田 (field) and the sound of 幾. |
| 墾 | 貇 | 豸 艮 土 | This glyph means to break ground for farmland. It uses the definition of 土 (earth) and the sound of 貇. |
| 懇 | 貇 | 豸 艮 心 | This glyph means kind or courteous. It uses the definition of 心 (heart) and the sound of 貇. |
| 繭 | 黹 | 艹 冂 糸 虫 | Silk (糸), an insect (虫), and needlework (黹) together: a silkworm's cocoon. |
| 勤 | 堇 | 菫 力 | This glyph means to work hard. It uses 力 (strength) for its meaning and 菫 (堇) for its sound. |

### The rubric both readers worked from

You are reading hand-written English sentences that a beginners' Japanese app
shows on a kanji page, under the heading "where this glyph came from". Each item
is one kanji and one sentence or two about the origin of its shape.

Read as a skeptic. Your job is to find claims that are wrong, or that would
mislead a learner, not to praise the ones that are fine. Most items are fine: a
doubt roughly every tenth item is the expected rate. Raising nothing on a batch
is a legitimate answer.

#### What counts as a doubt

- The story names a piece the character does not contain (知 told as "an adult
  大, a mouth 口 and a child 子" when 知 is 矢 plus 口).
- The story swaps the roles: it calls the meaning piece the sound piece, or the
  reverse.
- The sound piece it names does not match the character's reading, or is not the
  phonetic the standard sources give.
- The gloss on a piece is wrong (calling 甘 a mouth, calling 巳 a 己).
- The account contradicts the standard account and does not say it is doing so
  (a moral gloss from Han Feizi given as the paleography).
- The sentence is true but a learner would take a false rule from it.

#### What does not count

- Style, tone, length, wording preference, or a missing detail you would have
  liked. Silence about a scholarly dispute is not a doubt.
- A doubt you cannot attach to a reference you actually know. Do not invent a
  reference, a page number, or a source you are unsure of.
- A story that says plainly that the shape changed ("the sound of 囟, later
  corrupted to look like 田") is not claiming the piece is there now.
- A story about the traditional character ("this glyph is the simplified form of
  經") is describing that character's pieces on purpose.

#### Acceptable references

Wiktionary's glyph origin, Shuowen Jiezi, Shirakawa 字統, Jisho, KANJIDIC2,
Genki, Tae Kim, Imabi, a standard kanji dictionary you know. Name the one that
settles the point.

#### What to return

One JSON object per doubt, written as JSON Lines (one object per line) to the
output file you were given. No other prose in the file.

    {"id":"e0123","glyph":"知","claim":"An adult (大), a mouth (口), and a child (子)","objection":"知 is 矢 (arrow) plus 口. There is no 大 and no 子 in it.","reference":"Wiktionary; Shuowen Jiezi","confidence":"high"}

- `claim` quotes the words at issue from the story, not the whole story.
- `objection` is one or two plain sentences.
- `confidence` is high, medium or low. High means you are sure and the reference
  settles it. Low means it is worth a look and nothing more.
- No em dashes anywhere. Plain American English.
