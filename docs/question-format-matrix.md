# Question Format Matrix By Entry Type

This file describes the concrete question formats by entry type and subtype.

Scope:
- Drill mode card forms (prompt source, direction, expected response, answer control)
- Full product possibilities (intended matrix), including forms not yet implemented
- Corpus-feasible possibilities, including explicit trivial cases marked as `No`
- Current product rule: if MC is not selected, typed forms that would require MC are dropped (not auto-converted)

## Terms

- `jp->en`: show Japanese, answer in English or kana reading (depends on form)
- `en->jp`: show English, answer in Japanese
- `typed`: text input
- `mc`: multiple choice
- `reading fact`: a fact whose answer is a pronunciation/reading
- `meaning fact`: a fact whose answer is a meaning/gloss
- `text prompt`: Japanese is shown in text
- `audio prompt`: Japanese is played
- Romaji typing policy: only kana entries use typed romaji; all other Japanese output rows use kana/kanji typing, not romaji input

Status labels:
- `Current`: implemented in the current engine
- `Planned`: included in full matrix, not implemented yet
- `By design`: intentionally excluded

---

## 1) Kana Entry (`kana:*`)

Kana entries have one reading fact.

| Prompt | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Text: show kana glyph | `jp->en` | Romaji reading | Yes | Yes | Current | `あ` -> type `a` |
| Audio: play kana pronunciation | `jp->jp` | Kana glyph | Yes | Yes | Planned | Hear `a` -> type/pick `あ` |
| Show romaji/English side | `en->jp` | Kana glyph | No | Yes | Current | Prompt `a` -> pick `あ` |
| Text: show kana glyph (self-copy) | `jp->jp` | Same kana glyph | No | No | By design | `あ` -> type `あ` (trivial copy) |

---

## 2) Kanji Entry (`kanji:*`) and Radical Entry (`radical:*`)

Kanji/radical behavior shares the same question-type rules for meaning facts.

### 2.1 Meaning fact

| Prompt | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Text: show kanji/radical glyph | `jp->en` | English meaning | No | Yes | Current | `一` -> choose `one` (MC only: English gloss can have multiple acceptable phrasings) |
| Audio: play canonical reading | `jp->en` | English meaning | No | No | By design | Not possible for kanji/radical meaning facts |
| Show English meaning | `en->jp` | Japanese written form (glyph) | No | Yes | Current | Prompt `one` -> pick `一` |
| Text: show kanji/radical glyph (self-copy) | `jp->jp` | Same written form (glyph) | No | No | By design | `一` -> type `一` (trivial copy) |

### 2.2 Reading fact (kanji only)

| Prompt | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Text: show kanji in anchor context | `jp->en` only | Reading (kana) | Yes | Yes | Current | `生` (in `人生`) -> type `せい` |
| Audio: play anchor-word pronunciation | `jp->en` only | Reading | No | No | By design | Not possible: audio cannot disambiguate which kanji reading fact is asked |
| `en->jp` reading | N/A | N/A | N/A | N/A | By design | Not generated |

---

## 3) Word Entry (`word:*`)

Words can have:
- meaning fact (all words)
- reading fact (non-kana words)

### 3.1 Kana-only words (example: `これ`)

| Prompt | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Text: show word | `jp->en` | English meaning | No | Yes | Current | `これ` -> choose `this` (MC only: multiple valid English translations/paraphrases) |
| Audio: play word | `jp->en` | English meaning | No | Yes | Current | Hear `これ` -> choose `this` (MC only: multiple valid English translations/paraphrases) |
| Show English meaning | `en->jp` | Written word form | Yes | Yes | Current | Prompt `this` -> type `これ` |
| Text: show kana-only word (self-copy) | `jp->jp` | Same written form | No | No | By design | `これ` -> type `これ` (trivial copy) |

### 3.2 Single-kanji words (example: `人`)

| Prompt | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Text: show word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | `人` -> choose `person` (MC only: multiple valid English glosses) |
| Audio: play word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | Hear `ひと` -> choose `person` (MC only: multiple valid English glosses) |
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | Prompt `person` -> pick `人` |
| Text: show word (reading fact) | `jp->jp` | Reading (kana) | Yes | Yes | Current | `人` -> type `ひと` |
| Audio: play word (reading fact) | `jp->jp` | Reading | Yes | Yes | Current | Hear `ひと` -> type `ひと` |
| Show English meaning (reading fact) | `en->jp` | Reading (kana) | Yes | Yes | Current | Prompt `person` -> type `ひと` |

### 3.3 Multi-kanji words (example: `先生`)

| Prompt | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Text: show word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | `先生` -> choose `teacher` (MC only: multiple valid English glosses) |
| Audio: play word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | Hear `せんせい` -> choose `teacher` (MC only: multiple valid English glosses) |
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | Prompt `teacher` -> pick `先生` |
| Text: show word (reading fact) | `jp->jp` | Reading (kana) | Yes | Yes | Current | `先生` -> type `せんせい` |
| Audio: play word (reading fact) | `jp->jp` | Reading | Yes | Yes | Current | Hear `せんせい` -> type `せんせい` |
| Show English meaning (reading fact) | `en->jp` | Reading (kana) | Yes | Yes | Current | Prompt `teacher` -> type `せんせい` |

### 3.4 Mixed kanji+kana words (example: `食べる`)

| Prompt | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Text: show word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | `食べる` -> choose `to eat` (MC only: multiple valid English glosses) |
| Audio: play word (meaning fact) | `jp->en` | English meaning | No | Yes | Current | Hear `たべる` -> choose `to eat` (MC only: multiple valid English glosses) |
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | Prompt `to eat` -> pick `食べる` |
| Text: show word (reading fact) | `jp->jp` | Reading (kana) | Yes | Yes | Current | `食べる` -> type `たべる` |
| Audio: play word (reading fact) | `jp->jp` | Reading | Yes | Yes | Current | Hear `たべる` -> type `たべる` |
| Show English meaning (reading fact) | `en->jp` | Reading (kana) | Yes | Yes | Current | Prompt `to eat` -> type `たべる` |

---

## 4) Sentence Cards (`sentence:*`)

Sentence cards are for full-sentence prompts. Intended behavior: if a sentence is shown or played,
the learner can type the full sentence in kana.

| Prompt source | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Sentence source (text) with kanji in sentence | `jp->jp` | Full sentence in kana | Yes | Yes | Planned | `先生は学校へ行く。` -> type `せんせいはがっこうへいく。` |
| Sentence source (audio) with kanji in sentence | `jp->jp` | Full sentence in kana | Yes | Yes | Planned | Hear `せんせいはがっこうへいく。` -> type `せんせいはがっこうへいく。` |
| Sentence source + Definition (text) | `jp->en` | Definition via selection board | No | Yes | Current | `先生は学校へ行く。` -> choose `The teacher goes to school.` (MC only: sentence meaning can be translated in multiple valid ways) |
| Sentence source + Definition (audio) | `jp->en` | English meaning recognition | No | Yes | Current | Hear `せんせいはがっこうへいく。` -> choose `The teacher goes to school.` (MC only: sentence meaning can be translated in multiple valid ways) |
| Sentence source (text) already in kana (self-copy) | `jp->jp` | Same full kana sentence | No | No | By design | `これはほんです。` -> type `これはほんです。` (trivial copy) |

---

## 5) Grammar Pattern Entry (`grammar:*`)

Grammar rows here are only grammar-source behavior.

### 5.1 Meaning fact

| Prompt source | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Japanese source (text) | `jp->en` | English meaning | No | Yes | Current | `〜てから` -> choose `after doing X` (MC only: grammar meanings have multiple acceptable English paraphrases) |
| Japanese source (audio) | `jp->en` | English meaning | No | Yes | Planned | Hear `たべてから` -> choose `after doing X` (MC only: grammar meanings have multiple acceptable English paraphrases) |

### 5.2 Production fact

| Prompt source | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Japanese source config (text card cue is English in this direction) | `en->jp` | Japanese production form | No | Yes | Current | Prompt `after doing X (eat)` -> pick `食べてから` |
| Japanese source config (audio prompt is Japanese) | `jp->jp` | Japanese production form | No | Yes | Planned | Hear `たべる` cue -> pick `食べてから` |
| Japanese source (text self-copy of pattern label) | `jp->jp` | Same pattern text | No | No | By design | `〜てから` -> type `〜てから` (trivial copy) |

---

## 6) Keigo / Verb Pair / Other Special Subjects

This section is corpus-first: what is possible for these subjects from the data model and content, even if not all rows are implemented yet.

### 6.1 Keigo (`keigo:*`) — corpus possibilities

Keigo sets contain Japanese forms plus role/register semantics, so both recognition and production are feasible.

| Prompt source | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Japanese source (text) | `jp->en` | Meaning + register recognition | No | Yes | Current | `召し上がる` -> choose `eat / drink (honorific)` (MC only: multiple acceptable English wording while register stays fixed) |
| Japanese source (audio) | `jp->en` | Meaning + register recognition | No | Yes | Planned | Hear `めしあがる` -> choose `eat / drink (honorific)` (MC only: multiple acceptable English wording while register stays fixed) |
| English/register source (text) | `en->jp` | Keigo production form | No | Yes | Planned | Prompt `eat / drink (honorific)` -> pick `召し上がる` |
| English/register source (audio is Japanese cue only) | `jp->jp` | Keigo production form | No | Yes | Planned | Hear plain cue `たべる` + honorific target -> pick `召し上がる` |
| Japanese source (text self-copy) | `jp->jp` | Same keigo form | No | No | By design | `召し上がる` -> type `召し上がる` (trivial copy) |

### 6.2 Verb Pair / Transitivity (`transitivity:*`) — corpus possibilities

Verb-pair rows include English cues plus paired Japanese lemmas/readings, so disambiguation and recognition directions are both feasible.

| Prompt source | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| English cue source (text) | `en->jp` | Choose correct pair member (intransitive vs transitive) | No | Yes | Current | `The door opened.` -> pick `開く` |
| Japanese source (text) | `jp->en` | Meaning/usage recognition for shown pair member | No | Yes | Planned | `開く` -> choose `to open (intransitive)` (MC only: multiple acceptable English phrasings) |
| Japanese source (audio) | `jp->en` | Meaning/usage recognition for heard pair member | No | Yes | Planned | Hear `ひらく` -> choose `to open (intransitive)` (MC only: multiple acceptable English phrasings) |
| English role source (text) | `en->jp` | Produce/select the correct Japanese pair member | No | Yes | Planned | Prompt `open (something)` -> pick `開ける` |
| Japanese source (text self-copy) | `jp->jp` | Same verb form | No | No | By design | `開く` -> type `開く` (trivial copy) |

### 6.3 Cross-cutting feasibility rules (corpus-level)

These apply across special subjects when deciding if a row is practical to ship.

| Rule | Applies to | Constraint | Status | Example |
|---|---|---|---|---|
| Japanese-audio policy | All audio rows | Audio cues should be Japanese audio only | Current policy | No English-audio -> Japanese rows |
| Typed feasibility for Japanese targets | `en->jp` production rows | Non-kana targets are usually MC-first unless kana-only entry mode is provided | Current | `召し上がる`/`開ける` rows are MC-first |
| Multi-answer English meaning filter | `jp->en` meaning/definition rows | If multiple English phrasings are valid, typed is disabled and the row is MC-only | Current policy | Sentence/word/grammar meaning rows use MC to avoid rejecting valid paraphrases |
| Romaji typing scope | All typed rows | Typed romaji is allowed only for kana entries; non-kana subjects type kana/kanji when Japanese output is required | Current policy | Kanji reading row types `せい`, not `sei` |
| Register/role disambiguation | Keigo/transitivity | Prompt must encode register or transitivity role to avoid ambiguous grading | Current | `honorific` vs `humble`, `open (itself)` vs `open (something)` |
| Corpus-backed examples | All planned rows | A row should have at least one corpus-backed cue/example path | Current | Plain-form cue `たべる` -> keigo target row |
| Trivial self-copy filter | All text->same-text rows | If prompt and target are effectively identical copy tasks, mark row as `No` | Current policy | `これ` -> type `これ` is marked trivial |

Practical result:
- Include rows that are feasible from corpus content and grading semantics, even if implementation is pending.
- Mark those rows as `Planned` until implemented.
- Mark feasible but trivial self-copy rows as `By design` with `Typed=No`, `MC=No`.
- Any row with multiple acceptable English answers is MC-only (`Typed=No`).

---

## Global Rules That Filter Forms

A candidate form is valid when all apply:

1. Source enabled in setup (`ask.japanese`, `ask.english`, `ask.sentence`)
2. Direction allowed for the fact (`fixedDir` and fact semantics)
3. Response kind compatible with fact (`definition` vs `romaji`)
4. Prompt type supported (audio only on listenable forms)
5. Answer control viable:
   - MC-only constraints honored
   - Typed only when typeable for that target
6. Product rule: no auto-upgrade from typed to MC when MC is not selected
7. Script rule: typed romaji exists only for kana entry cards
8. Triviality rule: text self-copy rows are explicitly excluded
9. Ambiguity rule: multi-acceptable-answer rows are MC-only

---

## Why Current Runs May Show Fewer Cards Than This Matrix

If setup is typed-only, forms that require MC are dropped. Typical dropped cases:
- Kana `en->jp`
- Non-kana target `en->jp` meaning cards (for kanji-containing written answers)
- Any subject/fact marked MC-only in that direction

This is expected under the current rule set. Planned rows become visible only after implementation.
