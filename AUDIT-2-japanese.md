# Japanese-language accuracy audit — kana-quiz

Audited build: `/Users/samreenzarroug/git/personal/kq-audit-a3`, served at `http://localhost:3363`.
Every quotation below was read off a rendered page at the URL given.

Scope: grammar pattern pages, 〜てある/〜ている, generated conjugation tables, kana
readings and writing rules, kanji/word reading pairings, transitivity pairs.

Ranking is by how badly a beginner would be misled, not by how many pages are affected.

---

## A. Certainly wrong — fix these first

### A1. を is taught as "wo", on the same page that says it is "o"
**URL:** `http://localhost:3363/library/hiragana/wo`

Verbatim from the page:

> を  wo · o
> A **wo**k tossing food up in an arc: を.
> Say "**wo**" as in **wo**ah!
> This is the object particle. It attaches to a noun (パンを食べる, "eat bread") and sounds exactly like お.

**Why it is wrong.** In modern standard Japanese を is /o/. There is no [w]. The line
"Say 'wo' as in woah!" is the app's own pronunciation instruction and it is false —
and it sits four lines above the app correctly saying it "sounds exactly like お".
A learner who reads top-to-bottom takes the pronunciation line, because that is the
line labelled *how to say it*; the correction reads as a footnote about a different
thing. Source: `src/data/mnemonics.ts` sets `sound: "wo"` for を.

**What it should say.** Keep the wok as a *shape* mnemonic (it is a shape mnemonic and
a good one), but the pronunciation line must read: *Say "o" — exactly like お. The
romaji "wo" is a spelling convention for typing it, not a sound.* The `sound` field
should be `"o"`.

This is the single most damaging item in the audit, because it is a first-week fact,
it is stated as an instruction, and it produces an accent error that is audible forever.

### A2. `/library/word/いる` teaches いる = "to be needed", and the existential いる does not exist in the app at all
**URL:** `http://localhost:3363/library/word/いる`

Verbatim:

> いる — to be needed · to be necessary · to be required
> polite いります | past いった | not いらない | didn't いらなかった | polite past いりました
> **In a sentence:** はい知っています。 — Yes, I know.

Three separate problems, compounding:

1. **The one verb every beginner needs is missing.** I checked
   `src/data/generated/vocab.json`: it contains 射る (to shoot), 鋳る (to mint), 入る,
   and this 要る — and **no entry for the existential/animate いる (居る, "to be, to
   exist")**. That verb is the いる of 〜ている, the answer to 誰かいますか, and roughly
   the fourth verb in any N5 syllabus. `/library/word/要る` and `/library/word/居る`
   both 404, so `/library/word/いる` is the *only* page a learner can land on for the
   string いる, and it teaches the wrong verb.
2. **The conjugations are 五段.** いった / いらない / いります are correct for 要る and
   catastrophically wrong for the existential いる (いた / いない / います). A learner
   who has met ている and looks いる up leaves believing the negative of いる is いらない.
3. **The example sentence contains no 要る.** 「はい知っています。」 is 知る + ている.
   It was matched because the string います appears in it. It is an example of the
   auxiliary, i.e. of the *other* いる — the one the app does not have.

**What it should be.** Add 居る/いる (v1, "to be, to exist (animate)") as a distinct,
high-priority entry; disambiguate the two いる pages; and re-pick the 要る example
(お金がいる, ビザがいりますか).

### A3. 入る is taught with the reading いる
**URL:** `http://localhost:3363/library/word/入る`

Verbatim: header 入る, gloss **"to enter · to go in · to get in"**, reading shown **いる**,
and the table gives 入ります / 入った / 入らない.

**Why it is wrong.** With the meaning "to enter, to go in", 入る is **はいる**. いる is
an archaic/restricted reading (surviving in 気に入る, 悦に入る, 入り婿) and is not how
this word is read in the sense glossed. The vocab row (`beginnerRank: 1170`, i.e.
served early) carries `"reb": "いる"` with the はいる glosses — a JMdict entry-merge
artifact that has been shipped as a teaching claim. The app's own transitivity data
disagrees with itself: `/library/transitivity/入る-入れる` correctly prints **はいる**.

**What it should say.** reading はいる for this sense; if いる is kept at all it needs
its own entry with its own (idiomatic-only) glosses.

### A4. `/library/word/前` teaches 前 = ぜん and then illustrates it with a sentence where it is まえ
**URL:** `http://localhost:3363/library/word/前`

Verbatim:

> 前 — last (i.e. immediately preceding) · previous · ex-
> ぜん
> **In a sentence:** 行く前に電話します。 — I'll call him before I go.

**Why it is wrong.** In 行く前に the reading is **まえ**, and the meaning is "before",
not "previous/ex-". The page pairs a ぜん reading card with a まえ sentence, so whichever
the learner trusts, one of the two things on the page is teaching a false fact. Standalone
前 as a word is まえ; ぜん is a bound on-reading (前者, 前回, 午前) that is not a
free-standing word at all.

The same pairing appears on the kanji page, `http://localhost:3363/library/kanji/前`,
which lists "ぜん | Chinese | **opens with 前**" — i.e. it names the standalone word 前
as the exemplar of the ぜん reading. It should be 午前 or 前者 (both are already in the
"Words with this character" list on that page).

### A5. 〜に行く is illustrated with 行きに行く
**URL:** `http://localhost:3363/library/grammar/ni-iku`

Verbatim:

> 〜に行く — go in order to X — any verb → stem (the ます-form minus ます) + に行く
> Any verb you know: **行く → 行きに行く** · 食べる → 食べに行く · 書く → 書きに行く

**Why it is wrong.** 行きに行く is not Japanese. Nobody says it; "go in order to go" is
not a thing you express this way. It is the *lead* example — the first thing on the row —
because 行く is the app's global default vehicle (`VERB_VEHICLES` in
`src/lib/grammar/vehicles.ts` puts 行く first for every recipe). 書きに行く is also
strained ("go somewhere in order to write") though not impossible; 食べに行く is the
only natural one and it is third.

**What it should say.** This recipe needs a vehicle exclusion for 行く/来る the same way
〜てある got a transitivity restriction, and the lead example should be 食べに行く or
買いに行く.

### A6. The passive is led by 行く → 行かれる
**URL:** `http://localhost:3363/library/grammar/passive`

Verbatim:

> 〜られる (受身) — **is X-ed (by someone)** — any verb → passive form
> Any verb you know: **行く → 行かれる** · 食べる → 食べられる · 書く → 書かれる

**Why it is wrong.** The gloss "is X-ed (by someone)" is the direct passive. 行く is
intransitive and has no direct passive: 行かれる exists only as the *adversative*
("suffering") passive — 友達に行かれた, "my friend went (and it inconvenienced me)" —
or as a light honorific. Presenting it as the flagship example of "is X-ed" teaches a
learner that 行かれる means "is gone", which is meaningless, and hides the fact that a
whole separate construction is in play. 書かれる is the correct model and is third.

**What it should say.** Lead on a transitive verb (書く → 書かれる). If 行かれる is kept
at all, it needs its own line labelled as the adversative passive.

### A7. Adjectives are said to have a ます-form
**URLs:** `http://localhost:3363/library/grammar/sugiru`, `http://localhost:3363/library/grammar/sou-appearance`

Verbatim from `/library/grammar/sugiru`:

> any い-adjective → **stem (the ます-form minus ます)** + すぎる
> Any い-adjective you know: 高い → 高すぎる · いい → よすぎる
> any な-adjective → **stem (the ます-form minus ます)** + すぎる
> Any な-adjective you know: 静か → 静かすぎる

**Why it is wrong.** 高い has no ます-form. 静か has no ます-form. The gloss for "stem"
is a verb-only definition that has been reused verbatim for adjective rows, so the page
states, as a rule, something that is not true of the category it is stating it about.
The *outputs* are all correct (高すぎる, よすぎる, 静かすぎる, 高そう, よさそう, 静かそう);
it is the rule statement that is false. Same text on the 〜そう (様態) page.

**What it should say.** For い-adjectives: "drop the final い". For な-adjectives: "the
adjective as it is". Three different definitions of "stem" are needed, one per host,
not one verb definition applied to all three.

### A8. The handakuten page claims 25 new characters and uses a dakuten example
**URL:** `http://localhost:3363/library/writing-rule/handakuten`

Verbatim, in the hiragana section of the **handakuten** page:

> (handakuten): a small circle, and it only ever lands on the は row.
> You already know every shape here. **か and が are the same character with a mark, so this is 25 more characters without a single new drawing to learn.**

**Why it is wrong.** か→が is dakuten, not handakuten, and it is on the wrong page.
Handakuten produces exactly **five** characters (ぱぴぷぺぽ), not 25 — the page itself
says two lines earlier that the circle "only ever lands on the は row", so the paragraph
contradicts its own page. The identical paragraph is correct on
`/library/writing-rule/dakuten` and has been copied across.

**What it should say.** "…so this is 5 more characters, on shapes you already know."

---

## B. True in isolation, wrong impression left

### B1. 〜ている leads with 行っている under the gloss "is doing X"
**URL:** `http://localhost:3363/library/grammar/te-iru`

Verbatim:

> 〜ている — **is doing X / is in the state of X** — any verb → て-form + いる
> Any verb you know: **行く → 行っている** · 食べる → 食べている · 書く → 書いている

**Why it misleads.** 行っている does not mean "is going". It means "has gone and is
there". This is the single most notorious 〜ている trap and the page walks straight into
it: the gloss offers two readings, the reader picks the first one, and 行っている is
sitting there as the lead example inviting exactly the wrong pairing. The same page's
other two examples (食べている, 書いている) *are* the progressive, so the learner gets
no signal that 行っている belongs to the other half of the gloss.

**What it should say.** Either lead on 食べている and keep 行く out, or annotate:
"行っている = has gone (and is still there), not 'is going'". The recipe's own note in
`src/data/grammar/recipes.ts` already argues that the ている/てある contrast is "the thing
worth seeing" — the change-of-state vs. progressive contrast *inside* ている is at least
as important and is nowhere on the page.

### B2. 〜てある: the restriction is right, but the pool is not idiomatic
**URL:** `http://localhost:3363/library/grammar/te-aru`

Verbatim:

> 〜てある — has been done (and stays done) — attaches to a verb that somebody does to something
> any verb that somebody does to something → て-form + ある
> Any verb you know that somebody does to something: 書く → 書いてある · **食べる → 食べてある** · 話す → 話してある

**The restriction itself is correct** and the fix was the right one: 〜てある does require
a transitive verb, 行ってある / 死んである / 来てある are indeed not Japanese, and 書いてある
is the canonical example. Good.

**But "transitive" is necessary, not sufficient.** 〜てある carries a strong implicature
of *deliberate preparation whose result is on display*. Verbs that leave no inspectable
residue do not take it:

- **食べてある** (shown on the page) — essentially not said. "The food has been eaten"
  is 食べられている or 食べてしまった. 食べてある would only work in a contrived
  preparation reading ("I've pre-eaten it").
- **見てある** — the drill can produce this. `VERB_VEHICLES` includes 見る (v1, vt) and
  `transitivityAllows` passes it, so 〜てある quiz items can be built on it. 見てある is
  not idiomatic; 見ておいた is what is meant.
- Also reachable from the same pool: 飲んである, 待ってある, 遊んである(no—intransitive),
  読んである. 読んである is marginal; 飲んである and 待ってある are not said.

**話してある is fine** — 話してあります ("I've already told them") is genuinely idiomatic.

**What it should be.** The example row should read 書く → 書いてある · 置く → 置いてある ·
準備する → 準備してある, and the vehicle pool for this recipe needs a hand-curated
allowlist (書く, 置く, 開ける, 閉める, 貼る, 買う, 準備する, 予約する, 話す), not a
JMdict `vt` filter. A `vt` tag is a syntactic fact; idiomaticity here is a lexical one,
and no dictionary field encodes it.

**〜ている was correctly left unrestricted.** That call is right — 開いている and 食べている
must both be reachable.

### B3. 陥る's "potential" is displayed as 陥れる, which reads as a different verb
**URL:** `http://localhost:3363/library/word/陥る`

Verbatim: **can do it | 陥れる**

**Why it misleads.** 陥る is おちいる, so its potential is おちいれる — but 陥れる is the
standard written form of **おとしいれる**, "to entrap / to plunge (someone) into". A
learner reading 陥れる off this page learns a real word with the wrong meaning and the
wrong reading. This is precisely the failure mode `src/lib/conjugate/policy.ts`
documents for 分かる → 分かれる ("exactly the plausible-and-false output this list exists
to stop") — the same trap is live one entry over and unguarded.

Same shape, milder: `/library/word/知る` shows **can do it | 知れる**. 知れる is a real
word but means "to become known", not "can know"; the everyday potential of 知る is
suppletive (分かる / 知ることができる).

### B4. ぢ and づ are labelled "di" and "du" with no explanation on their own pages
**URLs:** `http://localhost:3363/library/hiragana/di`, `http://localhost:3363/library/hiragana/du`

Both pages are bare: 「ぢ | ji · di」 and 「づ | zu · du」, with no prose at all.

**Why it misleads.** In isolation, "di"/"du" invite [di]/[du]. The correct explanation
*does* exist and is excellent — on `/library/writing-rule/dakuten`:

> ぢ and づ sound EXACTLY like じ and ず: same sounds, different characters. They are rare; when you do need them, they are typed "di" and "du".

That is accurate and well judged. It just is not on the two pages where a learner who
looks up ぢ will actually be. Cross-link, or repeat the sentence on those two pages.

(Missing but minor: *why* they occur — rendaku (鼻血 はなぢ) and repetition
(続く つづく) — so a learner knows when to expect them rather than treating them as noise.)

### B5. は and へ get no particle note, while を does
**URLs:** `http://localhost:3363/library/hiragana/ha`, `http://localhost:3363/library/hiragana/he`

は's page says only 「Say "ha" as in ha! ha! ha!」; へ's says 「Say "heh" as in Helens」.
Neither mentions that as a particle は is read **わ** and へ is read **え**. を's page
does carry a particle note (see A1). This is an asymmetry a learner cannot detect: they
will read わたしは as "watashi ha" and 学校へ as "gakkou he" with nothing on either page
to stop them. These two facts are needed in the first lesson, not later.

### B6. The transitivity pattern labels contradict the same page's own worked example
**URLs:** `http://localhost:3363/library/transitivity/集まる-集める`, `http://localhost:3363/library/transitivity/開く-開ける`

Verbatim (集まる/集める):

> Base stem: あつ | 集まる = あつ + **まる** | 集める = あつ + **める**
> Pattern: **-ある → -える**. In this pattern, the it happens verb uses **-ある** and the someone does it verb uses **-える**.

Verbatim (開く/開ける):

> Pattern: **-う → -える**. In this pattern, the it happens verb uses **-う** and the someone does it verb uses **-える**.

**Why it misleads.** The notation "-ある" means "an a-vowel kana plus る" (i.e. *-aru*),
and "-う" means "any u-row kana" (i.e. *-u*). That is a legitimate linguists' convention,
but it is written in kana, unglossed, immediately below a breakdown that literally spells
the tail as まる and める. あつまる has no あ after あつ; 開く has no う. The learner is
shown two incompatible statements about the same word on one screen.

**What it should say.** Either romanise the pattern (*-aru → -eru*, *-u → -eru*), or
write it with a placeholder ("-Xあ+る → -Xえ+る"), or state it in words: "the tail's
vowel goes a → e".

The surrounding prose is otherwise excellent and honest — "You cannot build one from the
other, so learn them together as a pair" is exactly right, and marking 入る/入れる as an
"Exception" rather than forcing it into a rule is the correct call.

---

## C. Generated forms that are not real Japanese

The conjugation engine's policy file (`src/lib/conjugate/policy.ts`) is unusually careful
and its reasoning is sound. The gaps below are all of one kind: the defectiveness table
gates `potential` / `passive` / `causative` / `imperative` for the semantically-defective
verbs but **does not gate `volitional`, `tai`, or (for the perception verbs) `causative`
and `imperative`** — so the impossible forms come out the other door.

All of these are visible in the "Forms" table at the bottom of the named page.

| URL | Shown verbatim | Verdict |
|---|---|---|
| `/library/word/できる` | **want to \| できたい** | Not Japanese. "Want to be able to" is not expressible this way (できるようになりたい). Gate `tai`. |
| `/library/word/できる` | **let's \| できよう** | Not used. Gate `volitional`. |
| `/library/word/ことができる` | **want to \| ことができたい** | Not Japanese. |
| `/library/word/ことができる` | **let's \| ことができよう** | Not Japanese. The policy file's own comment anticipates ことができろ but not this. |
| `/library/word/見える` | **an order \| 見えろ** · **want to \| 見えたい** · **let's \| 見えよう** · **make or let them do it \| 見えさせる** | None are usable. You cannot command, want, or propose being visible. Gate `imperative`, `volitional`, `tai`, `causative`. |
| `/library/word/聞こえる` | **an order \| 聞こえろ** · **want to \| 聞こえたい** · **let's \| 聞こえよう** · **make or let them do it \| 聞こえさせる** | Same, for audibility. |
| `/library/word/わかる` | **it's done to them \| わかられる** | Not used. (わからせる and わからせられる are real; わかりたい is strained but attested.) |
| `/library/word/ある` | **want to \| ありたい** | Marginal-literary only (こうありたい). Shown unlabelled next to あります it reads as ordinary. |
| `/library/word/である` | **want to \| でありたい** | The policy file states outright that でありたい "is simply not a word" — and the page prints it. The `gatesCompounds` rule covers potential/passive/causative/imperative/teiru but not `tai`, so the stated intent is not enforced. |

**Verbs that merely end in the same characters kept all their forms — this is correct.**
I checked every one named in the brief: 用いる, 率いる, 強いる, 射る, 鋳る, 陥る, 入る all
show the full paradigm including 用いられる, 率いられる, 強いられる, 射られる, 鋳られる.
The decision in `policy.ts` not to set `gatesCompounds` on いる is right, and the reasoning
written there is correct. (The one casualty of matching on the bare string いる is A2/A3
above, which is a data problem, not a policy one.)

### C1. Register, not existence: である's polite form
**URL:** `http://localhost:3363/library/word/である`

Verbatim: **polite | であります** · **polite past | でありました** · **polite, not | でありません**

These are morphologically correct and essentially nobody says them. であります is
military/parliamentary/period-drama register; the polite counterpart of である in real
life is **です**. Nothing on the page says である is a *written* register (essays, papers,
newspapers) that is not spoken. A learner who meets である here and uses it in
conversation sounds like a textbook from 1930.

**What it should say.** A register line on the entry: "である is the written/formal
counterpart of だ. In speech use だ or です."

---

## D. Register and naturalness — grammatical, but nobody says it

1. **`/library/grammar/e` — 本へ · 車へ · 水へ.**
   へ marks a direction or destination. 本へ ("toward the book") and 水へ ("toward the
   water") are not sentences anyone produces. The noun pool (`本 / 車 / 水` in
   `vehicles.ts`) is reused for every particle regardless of what the particle selects for.

2. **`/library/grammar/made-ni` — 本までに · 車までに · 水までに.**
   Worse than unnatural: **wrong**. までに means "by (a deadline)" — the page says so —
   and it requires a time expression (三時までに, 金曜までに). 本までに is not a deadline
   and cannot be read as one. Rank this near the bottom of section A rather than here if
   you want it treated as an error; I have left it in D only because the *rule* is stated
   correctly and it is the examples that fail.

3. **`/library/grammar/rashii` — 本らしい · 車らしい · 水らしい** under the gloss
   "apparently X". 本らしい far more readily reads as the *suffix* らしい, "book-like /
   typical of a book". The noun+らしい slot is genuinely ambiguous and the page picks the
   reading that isn't the natural one for these nouns.

4. **`/library/grammar/causative-passive` — 行く → 行かせられる.**
   Correct, but for 五段 verbs the contemporary spoken form is the contracted
   **行かされる**; 行かせられる is stiff and increasingly literary. Worth a line, because
   a learner drilled only on 行かせられる will not recognise 行かされる when they hear it.

5. **`/library/grammar/nagara` — 行きながら.** Grammatical, unusual; 歩きながら is the
   verb people actually use for this.

6. **`/library/word/知る` — an order | 知れ.** Only survives in fixed expressions
   (思い知れ). Shown as the plain imperative of 知る it invites 知れ！ as a command.

---

## E. Oversimplified past the point of being true

Most of the app's simplifications are correctly judged. These are the three where I think
the line was crossed.

1. **〜てある has no particle story.** `/library/grammar/te-aru` never mentions that the
   construction re-marks its object as the subject: 窓**を**開ける → 窓**が**開けてある.
   A learner who takes "て-form + ある" literally will write 窓を開けてある, which is at
   best marked. The single most distinctive syntactic fact about the pattern is absent,
   while a transitivity restriction that is harder to state was added. (Also absent: the
   purposive nuance — 〜てある means someone did it *on purpose, and left it that way*,
   which is what separates it from ている and from the passive.)

2. **"の part" of 〜のに, 〜ので, 〜のに etc. is fine, but `/library/grammar/noni` glosses
   〜のに as only "even though X".** 〜のに also means "for the purpose of / in doing"
   (この機械は米を作るのに使う). Restricting the gloss is a defensible beginner
   simplification; showing 行くのに / 食べるのに / 書くのに as the examples is not, because
   those three read most naturally as the *purposive* sense, i.e. the sense the page has
   declared doesn't exist.

3. **`/library/writing-rule/long-vowel` romanises せんせい as "sensee"** while romanising
   おとうさん as "otōsan" on the same screen. Both are defensible systems; using both in
   adjacent rows teaches neither. The rule statement itself ("え is usually lengthened
   with い, and お usually with う") is correct and correctly hedged with "usually" —
   good, since おおきい/とおい/おねえさん are real exceptions.

**Simplifications I checked and think are right:** the rendaku page ("It is a tendency,
not a requirement"); the small-っ page ("It is a beat, not a gap" — the mora account is
the correct one and rarely made this well); small ゃゅょ ("Only the い-column kana take
these" — accurate, including the voiced partners); the okurigana page (生きる/生まれる is
the right pair of examples); the iteration-mark page (人々 = ひとびと with the rendaku
noted); the punctuation page (all seven marks correctly named and described).

---

## F. Things I checked and found correct

Recording these so the fix list doesn't accidentally churn them.

- 〜てある's transitivity restriction and its 書いてある worked example — correct.
- 〜ている deliberately left unrestricted — correct, and the reasoning in `recipes.ts` is right.
- い-adjective irregulars: いい → よくて, よければ, よかったら, よさそう, よすぎる — all correct,
  including the さ-insertion in よさそう.
- な-adjective before ので: 静か**な**ので, labelled "the form it takes before a noun" — correct.
- Conditional set (ば / たら / と / なら) glossed distinctly and correctly.
- The full paradigm retained for 用いる, 率いる, 強いる, 射る, 鋳る, 陥る, 入る (see C).
- 射る conjugated as 一段 (射ます, 射た, 射ない) — correct, and easy to get wrong.
- じ = "ji, not zi" heads-up on the dakuten page — correct and well placed.
- 生 kanji readings (せい・しょう・い・う・なま・は・き・お) with correct exemplar words.
- `/library/word/後` (あと) and `/library/word/上` (うえ) — reading, gloss and example
  sentence all agree. This is what the 前 entry should look like.
- 集まる/集める, 開く/開ける, 入る/入れる pair data: readings, glosses and English
  it-happens/someone-does-it sentences all correct.

**Low confidence, flagging anyway:** `/library/kanji/前` says **"Made of 一 + 刈 + 月 + 并"**.
前 is conventionally analysed as 丷 + 一 + 月 + 刂. 刈 (to mow) and 并 are not parts of it in
any decomposition I know; this looks like a KanjiVG component walk surfacing intermediate
nodes. I am not certain enough about what the "Made of" row is claiming to call it an error,
but it is worth a second look, and if other kanji show the same shape it is systemic.

---

## G. The ceiling

**Realistic reach on this app alone: solid N5, most of the way to N4 for
recognition, and short of N4 for production.**

What gets you there. Kana coverage is genuinely complete and the writing-rule pages
(dakuten, small っ, small ゃゅょ, long vowels, rendaku, okurigana, 々, punctuation) are
better than most textbooks' equivalents — they explain *why*, they hedge correctly, and
they use mora rather than "pause" for っ. The grammar table is 81 patterns spanning N5
through N4 with correct formation rules and, apart from the items above, correct outputs.
The conjugation engine is right about morphology and, uniquely in my experience of
generated tables, has a documented defectiveness policy at all.

What stops you going further.

1. **No sentences.** Every grammar page shows `pattern → built form` and nothing else.
   There is no "In a sentence" on any grammar page I loaded. A learner finishes 〜ば
   knowing that 行く becomes 行けば and never seeing a ば sentence, so they cannot know
   that ば prefers a stative consequent, that たら is the general-purpose one, or that と
   cannot take a volitional main clause. Those distinctions *are* N4, and they are
   invisible here. This is the hard ceiling.

2. **No particle grammar beyond the six atoms.** を, へ, まで, までに, だけ, から are
   present as one-line "attaches to a noun" cards. は vs が — the defining problem of
   Japanese for an English speaker, and unavoidable by N4 — is nowhere. Neither is に vs
   で, nor topic-comment structure.

3. **No register axis at all.** である is presented beside だ with no note that one is
   written-only (C1). Plain vs polite is a *label on a form*, never a choice with social
   consequences. Keigo is absent. That caps you below N3 regardless of vocabulary.

4. **Vocabulary is dictionary-shaped, not learner-shaped.** 鋳る (to mint) has a full
   page; the existential いる does not exist (A2). `beginnerRank` is doing a lot of work
   and it is not always doing it well.

5. **Every example is a single word or a two-word transformation.** Nothing in the app
   is longer than a clause, so nothing teaches clause linking, relative clauses, or the
   nominalisers (こと/の) beyond the two fixed patterns that happen to contain こと.

Fix A1–A8 and B1–B2 and the app is a trustworthy N5 tool that will not plant anything
a learner has to unlearn. To go past N4 it needs sentences, not more patterns.
