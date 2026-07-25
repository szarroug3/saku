# Question Format Matrix By Entry Type

This file describes the concrete question formats by entry type and subtype.

Scope:
- Drill mode card forms (prompt source, direction, expected response, answer control)
- Full product possibilities (intended matrix), including forms not yet implemented
- Current product rule: if MC is not selected, typed forms that would require MC are dropped (not auto-converted)

## Terms

- `jp->en`: show Japanese, answer in English, reading, or Japanese (depends on form)
- `en->jp`: show English, answer in Japanese
- `typed`: text input
- `mc`: multiple choice
- `reading fact`: a fact whose answer is a pronunciation/reading
- `meaning fact`: a fact whose answer is a meaning/gloss
- `text prompt`: Japanese is shown in text
- `audio prompt`: Japanese is played

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
| Audio: play kana pronunciation | `jp->en` | Kana glyph | Yes | Yes | Planned | Hear `a` -> type/pick `あ` |
| Show romaji/English side | `en->jp` | Kana glyph | No | Yes | Current | Prompt `a` -> pick `あ` |

---

## 2) Kanji Entry (`kanji:*`) and Radical Entry (`radical:*`)

Kanji/radical behavior shares the same question-type rules for meaning facts.

### 2.1 Meaning fact

| Prompt | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Text: show kanji/radical glyph | `jp->en` | English meaning | Yes | Yes | Current | `一` -> type `one` |
| Audio: play canonical reading | `jp->en` | English meaning | Yes | Yes | Planned | Hear `いち` -> type/pick `one` |
| Show English meaning | `en->jp` | Japanese written form (glyph) | No for non-kana targets | Yes | Current | Prompt `one` -> pick `一` |

### 2.2 Reading fact (kanji only)

| Prompt | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Text: show kanji in anchor context | `jp->en` only | Reading (kana/romaji accepted by check) | Yes | Yes | Current | `生` (anchor word shown) -> type reading |
| Audio: play anchor-word pronunciation | `jp->en` only | Reading | Yes | Yes | Planned | Hear anchor pronunciation -> type/pick reading |
| `en->jp` reading | N/A | N/A | N/A | N/A | By design | Not generated |

---

## 3) Word Entry (`word:*`)

Words can have:
- meaning fact (all words)
- reading fact (non-kana words)

### 3.1 Kana-only words (example: `これ`)

| Prompt | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Text: show word | `jp->en` | English meaning | Yes | Yes | Current | `これ` -> type `this` |
| Audio: play word | `jp->en` | English meaning | Yes | Yes | Current | Hear `これ` -> pick/enter `this` |
| Show English meaning | `en->jp` | Written word form | Yes | Yes | Current | Prompt `this` -> type `これ` |

### 3.2 Single-kanji words (example: `人`)

| Prompt | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Text: show word (meaning fact) | `jp->en` | English meaning | Yes | Yes | Current | `人` -> type `person` |
| Audio: play word (meaning fact) | `jp->en` | English meaning | Yes | Yes | Current | Hear `ひと` -> pick/enter `person` |
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | Prompt `person` -> pick `人` |
| Text: show word (reading fact) | `jp->en` | Reading | Yes | Yes | Current | `人` -> type `hito` |
| Audio: play word (reading fact) | `jp->en` | Reading | Yes | Yes | Current | Hear `ひと` -> type `hito` |
| Show English meaning (reading fact) | `en->jp` | Reading (kana) | Yes | Yes | Current | Prompt `person` -> type `ひと` |

### 3.3 Multi-kanji words (example: `先生`)

| Prompt | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Text: show word (meaning fact) | `jp->en` | English meaning | Yes | Yes | Current | `先生` -> type `teacher` |
| Audio: play word (meaning fact) | `jp->en` | English meaning | Yes | Yes | Current | Hear `せんせい` -> pick/enter `teacher` |
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | Prompt `teacher` -> pick `先生` |
| Text: show word (reading fact) | `jp->en` | Reading | Yes | Yes | Current | `先生` -> type `sensei` |
| Audio: play word (reading fact) | `jp->en` | Reading | Yes | Yes | Current | Hear `せんせい` -> type `sensei` |
| Show English meaning (reading fact) | `en->jp` | Reading (kana) | Yes | Yes | Current | Prompt `teacher` -> type `せんせい` |

### 3.4 Mixed kanji+kana words (example: `食べる`)

| Prompt | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Text: show word (meaning fact) | `jp->en` | English meaning | Yes | Yes | Current | `食べる` -> type `to eat` |
| Audio: play word (meaning fact) | `jp->en` | English meaning | Yes | Yes | Current | Hear `たべる` -> pick/enter `to eat` |
| Show English meaning (meaning fact) | `en->jp` | Written word form | No | Yes | Current | Prompt `to eat` -> pick `食べる` |
| Text: show word (reading fact) | `jp->en` | Reading | Yes | Yes | Current | `食べる` -> type `taberu` |
| Audio: play word (reading fact) | `jp->en` | Reading | Yes | Yes | Current | Hear `たべる` -> type `taberu` |
| Show English meaning (reading fact) | `en->jp` | Reading (kana) | Yes | Yes | Current | Prompt `to eat` -> type `たべる` |

---

## 4) Grammar Pattern Entry (`grammar:*`)

Grammar can be asked through Japanese and sentence sources; rows below include current and planned shapes.

| Prompt source | Direction | Expected response | Typed | MC | Status | Example |
|---|---|---|---|---|---|---|
| Japanese source (text) | `jp->en`/`en->jp` depending on fact type | Depends on fact type | Depends | Depends | Current | Pattern prompt shown in text |
| Japanese source (audio) | `jp->en` | Depends on fact type | Fact-dependent | Fact-dependent | Planned | Audio prompt for pattern cards |
| Sentence source + Definition (text) | `jp->en` | Definition via selection board | No | Yes | Current | Fill-the-blank sentence board |
| Sentence source + Definition (audio) | `jp->en` | English meaning recognition | No | Yes | Current | Hear sentence, choose meaning |
| Sentence source + Romaji | `jp->en` | Romaji/transcription | Yes | Yes | Planned | Hear/read sentence -> type/pick romaji |

---

## 5) Keigo / Verb Pair / Other Special Subjects

These subjects can enforce fixed direction and/or MC-only constraints per fact type.

Practical rule:
- If a fact/direction is MC-only and user did not select MC, that form is omitted.
- If typed would be untypeable for a target (non-kana `en->jp`), that typed form is omitted.

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

---

## Why Current Runs May Show Fewer Cards Than This Matrix

If setup is typed-only, forms that require MC are dropped. Typical dropped cases:
- Kana `en->jp`
- Non-kana target `en->jp` meaning cards (for kanji-containing written answers)
- Any subject/fact marked MC-only in that direction

This is expected under the current rule set. Planned rows become visible only after implementation.
