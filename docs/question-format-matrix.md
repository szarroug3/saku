# Question Format Matrix By Entry Type

This file describes the concrete question formats by entry type and subtype.

Scope:
- Drill mode card forms (prompt source, direction, expected response, answer control)
- Full product possibilities (intended matrix), including forms not yet implemented
- Corpus-feasible possibilities, including explicit trivial cases marked as `No`
- Current product rule: a selected typed form that cannot be graded through the text input resolves to multiple choice. Selecting typed and MC together still yields one deduplicated MC form.

Completeness rule:
- Each entry type lists every distinct prompt/response relationship its data can support, even when the relationship is not implemented.
- Typed and MC share one row when they ask the same semantic question; the two control columns and the Example cell show which controls are available.
- A same-script visible copy is still listed, but marked `By design` and `Not generated`.
- A listening transcription is not a visible copy: hearing Japanese and writing its reading can be useful, so it is `Planned` when the data can support it.
- A relationship the entry does not carry at all (for example, an English definition for a bare kana character) is listed as `By design`, with the missing data named.
- Audio prompts are Japanese only. English cues are always text because the product does not test English listening.
- Romaji is a prompt source only for the explicit kana-recognition card (`a` → pick `あ`). Elsewhere it is never shown as a prompt.

## Terms

- `jp->en`: show Japanese, answer in English or kana reading (depends on form)
- `en->jp`: show English, answer in Japanese
- `typed`: text input
- `mc`: multiple choice
- `reading fact`: a fact whose answer is a pronunciation/reading
- `meaning fact`: a fact whose answer is a meaning/gloss
- `text prompt`: Japanese is shown in text
- `audio prompt`: Japanese is played
- Japanese typing policy: whenever the expected response is Japanese, typed answers are kana. The kana-glyph → Latin reading card is the only typed-romaji format because its expected response is explicitly a Romaji reading, not Japanese text.
- The internal response setting is still named `"romaji"` in current code. In non-kana sections that legacy name selects a Japanese-reading/production question; it does not mean the learner types Latin letters.
- Japanese MC policy: outside explicit kana and word/kanji pronunciation tests, Japanese multiple-choice options use the normal written form with kanji where available.

Status labels:
- `Current`: implemented in the current engine
- `Planned`: included in full matrix, not implemented yet
- `By design`: intentionally excluded

---

## 1) Kana Entry (`kana:*`)

Kana entries have one reading fact.

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show kana glyph | `jp->en` | Romaji reading | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji", answers: includes "typed" or "mc"}` | `あ` -> type/pick `a` |
| Audio: play kana pronunciation | `jp->jp` | Kana glyph | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "romaji", answers: includes "typed" or "mc"}` | Hear `/a/` -> type/pick `あ` |
| Show romaji pronunciation | `en->jp` | Kana glyph | No | Yes | Current | `english: {answers: includes "typed" or "mc"}` (kana resolves this visible production form to MC) | `a` -> pick `あ` |
| Text: show kana glyph (self-copy) | `jp->jp` | Same kana glyph | No | No | By design | N/A (trivial self-copy excluded) | Not generated |
| Text or audio kana | N/A | English definition | No | No | By design | N/A. A bare kana character has a reading fact, but no English meaning fact. | Not generated |

---

## 2) Kanji Entry (`kanji:*`) and Radical Entry (`radical:*`)

Kanji and radicals share meaning-question controls, but only kanji entries carry anchor-word reading facts.

### 2.1 Meaning fact

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show kanji/radical glyph | `jp->en` | English meaning | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition", answers: includes "typed" or "mc"}` | `一` -> type/pick `one` |
| Audio: play a reading without an identifying word | `jp->en` | English meaning | No | No | By design | N/A. A bare kanji reading can match many kanji and does not identify which meaning fact is being asked; radicals have no audio/reading data. | Not generated |
| Show English meaning | `en->jp` | Japanese written form (glyph) | No | Yes | Current | `english: {answers: includes "typed" or "mc"}` (typed resolves to MC because the glyph is not typeable through the kana input) | Prompt `one` -> pick `一` |
| Text: show kanji/radical glyph (self-copy) | `jp->jp` | Same written form (glyph) | No | No | By design | N/A (trivial self-copy excluded) | Not generated |

### 2.2 Kanji reading in written anchor context

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show kanji in anchor context | `jp->en` only | Reading (kana) | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji", answers: includes "typed" or "mc"}` (jp->en only per fixedDir constraint) | `生` (in `人生`) -> type/pick `せい` |
| Audio: play anchor-word pronunciation | N/A | Reading of a particular kanji | No | No | By design | N/A. Audio does not identify which written kanji in the word is being tested. | Not generated |
| Show English anchor meaning/context without the written anchor | N/A | Reading of a particular kanji | No | No | By design | N/A. An English meaning does not uniquely identify the intended kanji or reading. | Not generated |

Kanji do not have one context-free pronunciation. The Current text form asks for the reading used by a visibly identified kanji inside a visibly written anchor word; it does not treat a bare kanji as independently readable.

### 2.3 Radical reading relationships

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Radical glyph, meaning, or audio | N/A | Japanese reading/pronunciation | No | No | By design | N/A. Radical entries in this product carry a glyph and English meaning, but no authoritative Japanese reading. | Not generated |

---

## 3) Word Entry (`word:*`)

Words can have:
- meaning fact (all words)
- reading fact (non-kana words)

### 3.1 Kana-only words (example: `これ`)

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show word | `jp->en` | English meaning | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition", answers: includes "typed" or "mc"}` | `これ` -> type/pick `this` |
| Audio: play word | `jp->en` | English meaning | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "definition", answers: includes "typed" or "mc"}` (kana words are listenable) | Hear `これ` -> type/pick `this` |
| Show English meaning | `en->jp` | Written word form | Yes | Yes | Current | `english: {answers: includes "typed" or "mc"}` (kana-only words are typeable en->jp) | Prompt `this` -> type/pick `これ` |
| Text: show kana-only word | `jp->jp` | Pronunciation written in kana | No | No | By design | N/A. The answer is visibly identical to the prompt, so this is a trivial copy. | Not generated |
| Audio: play kana-only word | `jp->jp` | Pronunciation written in kana | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "romaji", answers: includes "typed" or "mc"}`. The form is carried by the meaning fact because a kana-only word has no separate reading fact. | Hear `これ` -> type/pick `これ` |
| Show romaji pronunciation | `en->jp` | Written kana word | No | No | By design | N/A. Romaji is not used as a prompt source. | Not generated |

### 3.2 Single-kanji words (example: `人`)

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show word (meaning fact) | `jp->en` | English meaning | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition", answers: includes "typed" or "mc"}` | `人` -> type/pick `person` |
| Audio: play word (meaning fact) | `jp->en` | English meaning | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "definition", answers: includes "typed" or "mc"}` | Hear `ひと` -> type/pick `person` |
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | `english: {answers: includes "typed" or "mc"}` (typed resolves to MC for the kanji target) | Prompt `person` -> pick `人` |
| Text: show word (reading fact) | `jp->jp` | Reading (kana) | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji", answers: includes "typed" or "mc"}` | `人` -> type/pick `ひと` |
| Audio: play word (reading fact) | `jp->jp` | Type the kana reading or identify the written word | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "romaji", answers: includes "typed" or "mc"}`. Typed answers use kana; MC options show written words. | Hear `ひと` -> type `ひと` / pick `人` |
| Show English meaning (reading fact) | `en->jp` | Type the kana reading or identify the written word | Yes | Yes | Current | `english: {answers: includes "typed" or "mc"}`. Typed answers use kana; MC options show written words. | Prompt `person` -> type `ひと` / pick `人` |
| Text: show written word | `jp->jp` | Same written word | No | No | By design | N/A. This would copy the visible prompt. | Not generated |
| Show romaji pronunciation | `en->jp` | Written kanji word | No | No | By design | N/A. Romaji is not used as a prompt source; it would also be ambiguous across homophones. | Not generated |

### 3.3 Multi-kanji words (example: `先生`)

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show word (meaning fact) | `jp->en` | English meaning | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition", answers: includes "typed" or "mc"}` | `先生` -> type/pick `teacher` |
| Audio: play word (meaning fact) | `jp->en` | English meaning | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "definition", answers: includes "typed" or "mc"}` | Hear `せんせい` -> type/pick `teacher` |
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | `english: {answers: includes "typed" or "mc"}` (typed resolves to MC for the kanji target) | Prompt `teacher` -> pick `先生` |
| Text: show word (reading fact) | `jp->jp` | Reading (kana) | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji", answers: includes "typed" or "mc"}` | `先生` -> type/pick `せんせい` |
| Audio: play word (reading fact) | `jp->jp` | Type the kana reading or identify the written word | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "romaji", answers: includes "typed" or "mc"}`. Typed answers use kana; MC options show written words. | Hear `せんせい` -> type `せんせい` / pick `先生` |
| Show English meaning (reading fact) | `en->jp` | Type the kana reading or identify the written word | Yes | Yes | Current | `english: {answers: includes "typed" or "mc"}`. Typed answers use kana; MC options show written words. | Prompt `teacher` -> type `せんせい` / pick `先生` |
| Text: show written word | `jp->jp` | Same written word | No | No | By design | N/A. This would copy the visible prompt. | Not generated |
| Show romaji pronunciation | `en->jp` | Written kanji word | No | No | By design | N/A. Romaji is not used as a prompt source; one pronunciation can also identify multiple spellings. | Not generated |

### 3.4 Mixed kanji+kana words (example: `食べる`)

| Prompt | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Text: show word (meaning fact) | `jp->en` | English meaning | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition", answers: includes "typed" or "mc"}` | `食べる` -> type/pick `to eat` |
| Audio: play word (meaning fact) | `jp->en` | English meaning | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "definition", answers: includes "typed" or "mc"}` | Hear `たべる` -> type/pick `to eat` |
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | `english: {answers: includes "typed" or "mc"}` (typed resolves to MC for the mixed-script target) | Prompt `to eat` -> pick `食べる` |
| Text: show word (reading fact) | `jp->jp` | Reading (kana) | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji", answers: includes "typed" or "mc"}` | `食べる` -> type/pick `たべる` |
| Audio: play word (reading fact) | `jp->jp` | Type the kana reading or identify the written word | Yes | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "romaji", answers: includes "typed" or "mc"}`. Typed answers use kana; MC options show written words. | Hear `たべる` -> type `たべる` / pick `食べる` |
| Show English meaning (reading fact) | `en->jp` | Type the kana reading or identify the written word | Yes | Yes | Current | `english: {answers: includes "typed" or "mc"}`. Typed answers use kana; MC options show written words. | Prompt `to eat` -> type `たべる` / pick `食べる` |
| Text: show written word | `jp->jp` | Same written word | No | No | By design | N/A. This would copy the visible prompt. | Not generated |
| Show romaji pronunciation | `en->jp` | Written mixed-script word | No | No | By design | N/A. Romaji is not used as a prompt source; pronunciation alone also does not reliably identify the intended kanji spelling. | Not generated |

---

## 4) Sentence Cards (`sentence:*`)

The Sentences settings card has independent Japanese and English subsections. Japanese prompts ask for an English meaning. English prompts ask the learner to order Japanese chunks or choose the matching Japanese sentence. Sentence drills assume the words and their readings were learned in the word/kanji tracks; they do not retest kanji-to-kana transcription. A setting is `Current` only when configuration, generation, presentation, and grading are all implemented.

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Japanese sentence (text or audio) | `jp->jp` | Full sentence in kana | No | No | By design | N/A. Sentence drills test sentence meaning or structure, not readings already taught in the word/kanji tracks. The settings UI does not expose this response. | Not generated |
| Japanese sentence (text) | `jp->en` | English meaning recognition | No | Yes | Current | `sentence: {prompts: includes "text", responses: includes "definition"}`. Definition is inherently MC; the stored `sentence.answers` field does not alter it. | `先生は学校へ行く。` -> pick `The teacher goes to school.` |
| Japanese sentence (audio) | `jp->en` | English meaning recognition | No | Yes | Current | `sentence: {prompts: includes "audio", responses: includes "definition"}`. Definition is inherently MC; the stored `sentence.answers` field does not alter it. | Hear `せんせいはがっこうへいく。` -> pick `The teacher goes to school.` |
| Sentence source (text) already in kana (self-copy) | `jp->jp` | Same full kana sentence | No | No | By design | N/A (trivial self-copy excluded) | Not generated |
| Sentence source (text) with any script | `jp->jp` | Same written sentence or reordered visible chunks | No | No | By design | N/A. The complete Japanese answer is already visible, so copying or rearranging it does not test recall. | Not generated |
| Sentence source (audio) | `jp->jp` | Exact kanji/kana orthography | No | No | By design | N/A. Audio does not uniquely determine kanji spelling, and sentence drills do not retest word readings. | Not generated |
| English sentence (text) | `en->jp` | Build or choose the matching Japanese sentence | Drag/order | Yes | Ordering: Current; selection: Planned | Drill mode + Sentences kind + at least one learned sentence rule. `sentence: {englishResponses: includes "ordering"}` generates chunk ordering; `"selection"` is stored but its MC board is not generated yet. English prompts are always text. | `I eat this.` -> order the chunks / pick `私はこれを食べる。` |
| English sentence (text) | `en->jp` | Type a complete Japanese translation | No | No | By design | N/A. An English sentence can have multiple correct Japanese translations, so a single free-form typed answer cannot be graded reliably. | Not generated |

---

## 5) Grammar Pattern Entry (`grammar:*`)

Grammar rows here are only grammar-source behavior. Grammar meaning facts can also appear in sentence source (see Section 4).

### 5.1 Meaning fact

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Japanese source (text) | `jp->en` | English meaning | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition", answers: includes "typed" or "mc"}` | `〜てから` -> type/pick `after doing X` |
| Japanese example phrase containing the pattern (audio) | `jp->en` | English meaning | Yes | Yes | Planned | Intended: `japanese: {prompts: includes "audio", responses: includes "definition", answers: includes "typed" or "mc"}`. The audio is a contextual phrase containing the pattern, not a pronunciation of the pattern label. Grammar facts are not currently listenable. | Hear `たべてから` (`食べてから`, “after eating”) -> type/pick `after doing X` |
| English meaning (text) | `en->jp` | Japanese pattern label | No | Yes | Current | `english: {answers: includes "typed" or "mc"}`. Grammar meaning reverse recall is forced to MC because an English gloss can have more than one natural Japanese realization. | Prompt `after doing X` -> pick `〜てから` |

### 5.2 Production fact

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Japanese source config (text vehicle cue; answer is Japanese) | `jp->en` internal direction | Produce the transformed Japanese form | Yes | Yes | Current | `japanese: {prompts: includes "text", responses: includes "romaji", answers: includes "typed" or "mc"}`. The legacy response name selects Japanese production. Typed output is kana; MC uses the normal written form. | Prompt `行く` + `〜てから` -> type `いってから` / pick `行ってから` |
| Japanese source config (audio prompt is Japanese) | `jp->jp` | Produce the transformed Japanese form | Yes | Yes | Planned | Intended: `japanese: {prompts: includes "audio", responses: includes "romaji", answers: includes "typed" or "mc"}`. Typed output is kana; MC uses the normal written form. Grammar production facts are not currently listenable. | Hear `たべる` cue -> type `たべてから` / pick `食べてから` |
| Japanese source (text self-copy of pattern label) | `jp->jp` | Same pattern text | No | No | By design | N/A (trivial self-copy excluded) | Not generated |
| Japanese source (text showing a completed vehicle form) | `jp->jp` | Same completed production form | No | No | By design | N/A. The learner would only copy the visible answer. | Not generated |

> **Note on "direction":** ask-forms models grammar production as `jp→en` with the legacy response key `"romaji"` because the answer is Japanese (a conjugated form) — `answerIsJapanese` is true, so `candidateDirs` returns `["jp2en"]`. The learner types kana, not Latin-letter romaji. The `en→jp` English source does not generate grammar production forms.

---

## 6) Keigo / Verb Pair / Other Special Subjects

This section is corpus-first: what is possible for these subjects from the data model and content, even if not all rows are implemented yet.

### 6.1 Keigo (`keigo:*`) — corpus possibilities

Keigo sets contain Japanese forms plus role/register semantics, so both recognition and production are feasible.

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| Japanese source (text) | `jp->en` | Meaning + register recognition | No | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition", answers: includes "typed" or "mc"}`. Keigo is MC-only, so typed resolves to MC. | `召し上がる` -> pick `eat / drink (honorific)` |
| Japanese source (audio) | `jp->en` | Meaning + register recognition | No | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "definition", answers: includes "typed" or "mc"}`. The stored kana reading is spoken; Keigo recognition is MC-only. | Hear `めしあがる` -> pick `eat / drink (honorific)` |
| Japanese Keigo form (text or audio) | `jp->jp` | Reading in kana | No | No | By design | N/A. Keigo drills test register and usage; direct reading recall belongs in the word/kanji tracks. | Not generated |
| English meaning/register source (text) | `en->jp` | Produce the Keigo form | Yes | Yes | Current | `english: {answers: includes "typed" or "mc"}`. Typed answers use the stored kana reading; MC options show written Keigo forms. Curated usage text distinguishes multiple same-register forms for one action. | Prompt `eat / drink (honorific)` -> type `めしあがる` / pick `召し上がる` |
| Japanese plain-form source (audio) + register target | `jp->jp` | Keigo production form | No | Yes | Planned | No current settings path models an audio plain-form cue plus a register target; this requires a dedicated production-source configuration. | Hear plain cue `たべる` + honorific target -> pick `召し上がる` |
| Japanese source (text self-copy) | `jp->jp` | Same keigo form | No | No | By design | N/A (trivial self-copy excluded) | Not generated |

### 6.2 Verb Pair / Transitivity (`transitivity:*`) — corpus possibilities

Verb-pair rows include English cues plus paired Japanese lemmas/readings, so disambiguation and recognition directions are both feasible.

| Prompt source | Direction | Expected response | Typed | MC | Status | Settings | Example |
|---|---|---|---|---|---|---|---|
| English cue source (text) | `en->jp` | Produce or choose the correct pair member | Yes | Yes | Current | `english: {answers: includes "typed" or "mc"}`. Typed production targets the stored kana reading; MC is exactly the pair's two written members. | `The door opened.` -> type `あく` / pick `開く` |
| Japanese source (text) | `jp->en` | Meaning/usage recognition for shown pair member | No | Yes | Current | `japanese: {prompts: includes "text", responses: includes "definition", answers: includes "typed" or "mc"}`. Role recognition is MC-only and offers the pair's two curated English cues. | `開く` -> pick `The door opened.` |
| Japanese source (audio) | `jp->en` | Meaning/usage recognition for heard pair member | No | Yes | Current | `japanese: {prompts: includes "audio", responses: includes "definition", answers: includes "typed" or "mc"}`. Audio speaks the member's stored kana reading; role recognition stays MC-only. | Hear `あく` -> pick `The door opened.` |
| Japanese pair member (text or audio) | `jp->jp` | Reading in kana | No | No | By design | N/A. Verb-pair drills test which verb fits the role; direct reading recall belongs in the word/kanji tracks. | Not generated |
| Short role label without the curated sentence cue | `en->jp` | Produce/select the correct Japanese pair member | No | No | By design | N/A. The current full-sentence English cue already identifies the role in meaningful context; a second, weaker label-only card would duplicate it. | Not generated |
| Japanese source (text self-copy) | `jp->jp` | Same verb form | No | No | By design | N/A (trivial self-copy excluded) | Not generated |

### 6.3 Cross-cutting feasibility rules (corpus-level)

These apply across special subjects when deciding if a row is practical to ship.

| Rule | Applies to | Constraint | Status | Example |
|---|---|---|---|---|
| Audio-language policy | All audio rows | Audio cues are Japanese only; English cues are always text | Current policy | No English-audio rows |
| Typed feasibility for Japanese targets | `en->jp` production rows | Typed production uses an authoritative kana target when the fact stores one; MC shows the normal written form. A glyph with no stored production reading is MC-only. | Current | Keigo/verb pairs type stored kana and pick written forms; a kanji meaning picks the glyph |
| Multi-answer English meaning filter | `jp->en` meaning/definition rows | Typed is available when the fact has gradable accepted answers; a format that cannot grade its valid paraphrases must force MC | Current policy | Sentence definitions and special relationship facts force MC; ordinary word/grammar meanings can type or pick |
| Japanese typing scope | All typed rows | Every Japanese expected response is typed in kana; Latin-letter romaji is used only when the expected response itself is explicitly a Romaji reading | Current policy | Kanji reading types `せい` and grammar production types `いってから` |
| Register/role disambiguation | Keigo/transitivity | Prompt must encode register or transitivity role to avoid ambiguous grading | Current | `honorific` vs `humble`, `open (itself)` vs `open (something)` |
| Corpus-backed examples | All planned rows | A row should have at least one corpus-backed cue/example path | Current | Plain-form cue `たべる` -> keigo target row |
| Trivial self-copy filter | All text->same-text rows | If prompt and target are effectively identical copy tasks, mark row as `No` | Current policy | `これ` -> type `これ` is marked trivial |
| Reading-track ownership | Sentence, grammar, Keigo, and transitivity | Direct kanji/word → kana transcription belongs in the word/kanji tracks; higher-level tracks test meaning, structure, register, role, or transformation | Current policy | Grammar may type `いってから` after conjugating `行く`, but Keigo does not ask `召し上がる` → `めしあがる` |
| Japanese MC orthography | Every Japanese-answer MC outside pronunciation tests | Show the normal written form with kanji where available; kana is for typed production and explicit pronunciation testing | Current policy | `to eat` -> type `たべる` / pick `食べる` |

Practical result:
- Include rows that are feasible from corpus content and grading semantics, even if implementation is pending.
- Mark those rows as `Planned` until implemented.
- Mark feasible but trivial self-copy rows as `By design` with `Typed=No`, `MC=No`.
- Any row with multiple acceptable English answers is MC-only (`Typed=No`).

---

## Global Rules That Filter Forms

A question format appears in the deck when ALL these conditions apply:

1. **Source enabled**: The appropriate source setting must have entries:
   - Japanese source (for jp->en and jp->jp forms): requires `japanese.prompts` or `japanese.responses` to be non-empty
   - English source (for en->jp forms): requires `english.answers` to be non-empty
   - Sentence source (for grammar meaning facts only): requires `sentence.prompts` or `sentence.responses` to be non-empty

2. **Response kind enabled**: The response type in the setting must match what the fact supports:
   - Meaning facts require: `responses.includes("definition")` (jp->en) or `english.answers` (en->jp)
   - Reading facts require: `responses.includes("romaji")` (jp->en) or `english.answers` (en->jp for reading en->jp)

3. **Prompt type supported**: Audio prompts only work on listenable facts:
   - Kana entries: text and audio; audio asks the learner to produce the kana glyph
   - Kanji entries: text only (no audio for meaning; audio kanji reading is not disambiguated)
   - Words: text and audio both supported
   - Sentences: text and audio both supported (for grammar meaning facts only)
   - Grammar patterns: text only (audio awaiting implementation)

4. **Direction allowed**: Some facts pin to one direction:
   - Kana character facts: the closed matrix is kana → Romaji, audio → kana, and Romaji → kana
   - Kanji reading facts: jp->en only (fixedDir="jp2en")
   - Grammar production facts: internally jp->en only because their answer is Japanese
   - Keigo and transitivity facts: both recognition and production directions
   - Others: both directions available (both derived from settings)

5. **Answer control viable**:
   - MC-only constraints are enforced (sentence/register/role recognition, kana en->jp, and untypeable en->jp targets)
   - Typed only when typeable for that target
   - A typed intent that is not typeable resolves to the required MC control
   - Equivalent typed-forced-to-MC and explicit-MC forms are deduplicated

6. **Required-control resolution**: Forms intended as typed but forced to MC still appear as MC:
   - Example: a kanji target requested through typed English-source settings resolves to MC rather than producing an unusable text box

7. **Script rule**: Japanese typed responses always use kana:
   - Kanji reading, word reading, and grammar production use kana characters, never Latin-letter romaji
   - The only Latin-letter typed answer is the explicit kana-glyph → Romaji-reading card, such as `あ` → `a`

8. **Triviality filter**: Text self-copy rows are explicitly excluded:
   - `あ` -> type `あ` (kana self-copy): not generated
   - `先生` -> type `先生` (word self-copy): not generated

9. **Ambiguity rule**: MC is forced only when the current grader cannot safely accept the valid answer space:
   - Ordinary word, kanji/radical, and grammar meanings can type or pick because their accepted English answers are gradable
   - Sentence definitions are MC-only because free-form sentence translation admits too many valid paraphrases
   - Keigo/transitivity relationship meanings are MC-only because the register or role distinction is part of the answer
   - Reading facts allow type or pick when an authoritative reading is stored

---

## Unreachable Rows: Planned Forms Blocked by Implementation

Some Planned rows cannot be reached even if the user selects the settings shown, because the underlying feature is not implemented. Selecting these settings will silently drop those forms:

| Blocked Row | Blocking Reason | Selecting This Setting | Does Not Generate | When Will It Be Unblocked? |
|---|---|---|---|---|
| Grammar Meaning + Audio (jp→en) | Grammar patterns are not listenable | `japanese: {prompts: includes "audio", responses: includes "definition", answers: includes "typed" or "mc"}` | Grammar audio forms | When grammar audio support is added |
| Grammar Production + Audio (jp→jp) | Requires a listenable production vehicle cue | `japanese: {prompts: includes "audio", responses: includes "romaji", answers: includes "typed" or "mc"}` | Grammar production audio | When grammar production vehicles gain an authoritative audio source |
| English Sentence + Choose Sentence | Assembly currently renders chunk ordering only | `sentence: {englishResponses: includes "selection"}` | Japanese-sentence MC boards | When the assembly screen gains a sentence-selection variant |

---

## Why Current Runs May Show Fewer Cards Than This Matrix

The matrix shows all corpus-feasible forms for each entry type. A real deck will show fewer, based on settings:

**If Japanese source is off** (`japanese.prompts` and `japanese.responses` both empty):
- No jp->en or jp->jp forms are generated
- Example: meaning definitions, kanji readings, word readings—all disappear

**If English source is off** (`english.answers` empty):
- No en->jp forms are generated
- Example: kana en->jp MC, word en->jp en->jp typed—all disappear

**If typed is not selected** (`answers` does not include "typed"):
- Typed forms are dropped, but MC-only forms remain
- Example: if `japanese: {answers: ["mc"]}`, typed kana and word readings disappear
- MC-only Japanese targets remain available; visible Romaji → kana is always MC

**If MC is not selected** (`answers` does not include "mc"):
- Objective typed forms remain typed
- Forms that cannot be typed safely resolve to MC instead of disappearing
- Example: kanji-word en->jp still renders as MC

**If audio is not selected** (`prompts` does not include "audio"):
- Audio forms are dropped
- Text forms of the same row remain

**Planned features not yet implemented**:
- English sentence selection: the setting exists, but the assembly quiz currently implements ordering only
- Grammar audio: awaiting audio support for patterns
- Keigo production from a heard plain verb plus an explicit register target: awaiting a dedicated source configuration

**Real example**: If settings are:
```
japanese: { prompts: ["text"], responses: ["definition"], answers: ["mc"] }
english: { answers: ["mc"] }
```
Then visible forms are: jp->en meaning definitions (MC), en->jp glyphs (MC). No reading facts, no audio, no typed.

---

## Multiple Settings Paths to the Same Question Format

Some question formats in the matrix can be reached via multiple settings combinations. This is expected and correct — each combination produces a different FORM (different prompt type or answer control):

| Question Format | Reachable Via | Settings Path |
|---|---|---|
| Word meaning fact (jp→en text) | Text prompt only | `japanese: {prompts: includes "text", responses: includes "definition", answers: includes "typed" or "mc"}` |
| Word meaning fact (jp→en audio) | Audio prompt only | `japanese: {prompts: includes "audio", responses: includes "definition", answers: includes "typed" or "mc"}` |
| Word reading fact (jp→jp text) | Text prompt only | `japanese: {prompts: includes "text", responses: includes "romaji", answers: includes "typed" or "mc"}` |
| Word reading fact (jp→jp audio) | Audio prompt only | `japanese: {prompts: includes "audio", responses: includes "romaji", answers: includes "typed" or "mc"}` |
| Word reading fact (en→jp) | Any en→jp setting | `english: {answers: includes "typed" or "mc"}` |
| Grammar meaning fact (jp→en text) | Text prompt only | `japanese: {prompts: includes "text", responses: includes "definition", answers: includes "typed" or "mc"}` |
| Grammar meaning fact (jp→en audio) | Audio prompt only | `japanese: {prompts: includes "audio", responses: includes "definition", answers: includes "typed" or "mc"}` (blocked) |
| Grammar production fact (internal jp→en) | Japanese text + Kana response | `japanese: {prompts: includes "text", responses: includes "romaji", answers: includes "typed" or "mc"}` (legacy setting name; learner types kana) |

The ask-forms.ts dedup logic ensures each resolved form appears exactly once in a coverage deck, even if multiple settings intents collapse to the same card.
