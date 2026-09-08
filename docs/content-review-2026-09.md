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
