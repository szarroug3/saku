# Architecture refactor: one model, many surfaces

Status: in progress on branch `refactor/content-model` (main untouched). Author:
pairing session, Aug 2026.
Goal: stop re-wiring every surface by hand for each new content type. An update to
a content **type** (or a new word) should propagate consistently across lessons,
quizzes, and the library — with the compiler and tests catching what's missing.

> **Progress at a glance** — the content model and the ONE generic scheduler are
> built and tested in isolation; nothing live consumes them yet, so main is safe.
> The next step is the first live track migration (numbers/counters), the largest
> and riskiest slice. See [§6 Progress](#6-progress-branch-refactorcontent-model).

---

## 1. The problem, precisely

The app has one of each pipeline **per track** (words, kanji, kana, counters/
numbers, keigo, grammar, transitivity, sentence-ordering), forked and hand-kept:

| Surface | Count today | Examples |
|---|---|---|
| Schedulers (`nextXLesson`) | ~8 | `counter-lesson.ts`, `keigo-lesson.ts`, `grammar-lesson.ts`, `transitivity-lesson.ts`, `curriculum-lesson.ts`, `sentence-ordering-plan.ts`, words in `lesson.ts` |
| Lesson-preview components | ~8 | `next-lesson`, `next-counter-lesson`, `next-keigo-lesson`, `next-grammar-lesson`, `next-transitivity-lesson`, `next-curriculum-lesson`, `next-sentence-ordering-lesson` |
| Quiz screens | 13 | `drill-screen`, `grid-screen`, `pairs-screen`, `number-reading-screen`, `substitution-screen`, `assembly-screen`, `sentence-listen-screen`, … |
| Library entry views | ~7 | `term-view`, `keigo-set-view`, `verb-pair-view`, `number-construction-view`, `grammar-concept-view`, `mark-view`, `kana-family-view` |

A new content type = a new parallel stack, hand-integrated into every surface.
Whatever you forget becomes a bug.

### Three failure mechanisms (every bug we hit is one of these)

1. **Fact assembly is imperative and per-scheduler**, not derived from an item's
   type. Words use `factsOf(entry)` (all facts). The counters path hand-builds
   `[...prereqFacts, ...readingFacts, marker]`, and number kanji ride the
   kanji-**prereq** path (`collectPrereqs`, which seeds only the *meaning* fact).
   - → numbers lost their reading (patched twice: `tensReadingFactsForPrereqs`,
     then extended for 百/千/万).
   - → "Kanji · Word" instead of "Number" (tiles labeled by generic roles because
     "number-ness" isn't a fact the tile can read).

2. **Preview, HUD label, and resume are re-derived separately from the taught
   fact-list.** When they disagree:
   - → card said "2,3,4 + generating 10+" but taught only 2,3,4.
   - → continue-session lands on the wrong card.

3. **The scheduler is a hand-rolled state machine** (markers, `prepOnly`,
   backfill) rather than a pure "next unlearned item, in order":
   - → 10+ taught after 4, before 5 (a rule card reachable before its prereqs).

---

## 2. Target architecture

**One source of truth per content item; ONE viewport, ONE quiz shell, ONE library
entry component, all polymorphic over it. Schedulers decide only ORDER.**

### 2.1 The content/fact model (the keystone)

A content item declares its **kind** and owns its **facts**; every surface reads
facts, never re-derives them.

```ts
interface Fact { id: FactId; kind: FactKind; }   // FactKind = ResponseKind, via jp2enResponse(id)

// A fact is NOT one prompt→answer. It is asked in MULTIPLE forms — both
// directions (jp→en, en→jp), text/listen, typed/MC — all forms of the SAME fact.
// That set is already first-class in ask-forms.ts and is the source of truth:
type CardForm = { source; response; dir: "jp2en" | "en2jp"; listen; answer };
function enabledFormsFor(fact: FactId, ask: AskConfig): CardForm[];  // the quizzable forms

interface ContentItem {
  entry: EntryId;
  kind: "word" | "kanji" | "kana" | "counter" | "number" | "grammar" | ...;
  glyph: string;
  facts: Fact[];     // derived ONCE from kind + dictionary row (see facts.ts)
  roles: RoleName[]; // already centralized in character-role.ts — extend, don't fork
  prereqs: EntryId[];
}
```

- **A fact carries identity, not a single prompt/answer.** Its quizzable forms —
  both directions and every mode — come from `enabledFormsFor` (ask-forms.ts),
  the source the drill already trusts. jp→en and en→jp are one fact, two forms.
- The **dictionary is the source of truth.** `factsOf(entry)` (facts.ts) already
  expands an entry into its facts. Adding a word = add a row; its facts follow.
- **Numbers are just words with kind `number`** — same fact set as any word
  (meaning + reading), plus a `number` role for labeling. No special threading.
- **A new quiz mode (mic "say it")** is a new *value* on the ask-forms axes
  (a `PromptFormat`/`response`), reached in one place and rendered by one
  registered per-form renderer — not a new fact type or a per-track edit.

### 2.2 One generic scheduler; prerequisites are data on the item

There is **one** scheduler, not one per track. Two facts make that possible:

- **A track is just an ordered list of items.** `Track.order(history)` returns the
  curriculum sequence; that is all a track does.
- **Every item carries its own prerequisites** (`ContentItem.prereqs`) — a single
  DAG over the whole corpus, independent of tracks.

```ts
interface Track { id: string; order(history): ContentItem[]; }        // ordering ONLY
interface ContentItem { …; prereqs: EntryId[]; }                       // its DAG edges

type NextLesson = (track, resolve, history, range) => Lesson | null;   // the one engine
```

The engine does the same thing for every track:

1. Walk `order` for the next **unknown** items.
2. Gather each item's **untaught** prerequisites transitively — **across tracks**.
   A number freely pulls a non-number kanji owned by the word track; the engine
   teaches it here regardless of which track "owns" it. (`resolve` maps an entry
   to its item so any track's items are reachable.)
3. Emit items in dependency order, each preceded by its untaught prereqs, until
   the `LessonRange` budget is full (always ≥ 1 item).
4. **Depth gate** (`MAX_PREREQ_DEPTH`): defer an item whose untaught-prereq chain
   is too deep — A>B>C>D>E with nothing known is too much cascade for one lesson.
   It resurfaces once its deep prereqs are learned (on their own, or in earlier
   lessons) and the remaining depth is within bound. **This one rule replaces the
   counters track's `prepOnly`/marker machinery.**

No per-track fact-assembly, no per-track marker state. Generative units ("drill
11–99") are just a `ContentItem` (kind `generative-rule`) with its own prereqs and
facts, scheduled by the same engine.

### 2.3 One lesson viewport

```tsx
<LessonWalk items={ContentItem[]} onClaim={…} />
```

- Renders any lesson from a typed item list. Each item-kind registers a card
  renderer (`kanji`, `word`, `number`, `generative-rule`, …) in ONE registry.
- **Preview, HUD, and resume all read the SAME `items` array** → they cannot
  disagree with what's taught. The generative lesson would have "just rendered"
  because it's one more item-kind in the registry, not a new component.

### 2.4 One quiz shell, one library entry

```tsx
<Quiz facts={Fact[]} mode={QuizMode} />      // per-fact-kind question renderers, registered
<EntryPage entry={Entry} />                  // reads entry.facts + entry.roles, renders sections declaratively
```

Add a word → it renders in the library and quizzes automatically. A new
fact-kind's quiz UI is registered once and reused by every track.

---

## 3. Migration plan (strangler fig — no big-bang rewrite)

Each stage is shippable on its own and lands behind the shared interface, with an
invariant test that would have caught the corresponding bug class. Migrate one
track at a time; delete each forked file only when its track is fully moved.

- **Stage 0 — Interfaces, no behavior change. ✅ Done.** Define `ContentItem`,
  `Fact`, `FactKind`, `Track`, and the item-renderer/quiz-renderer registries
  alongside today's code. Nothing consumes them yet.

- **Stage 1 — Consume the existing `factsOf`; the kind axis already exists.** Two
  pieces are already in place and should be *reused*, not re-modeled:
  `src/lib/facts.ts` (subjects publish `FactInfo[]`; `factsOf(entry)` reads them),
  and `src/lib/ask-forms.ts` (a fact's kind is `PromptFormat` × `ResponseKind`
  [definition·romaji = meaning·reading] × `AnswerStyle`, with `enabledFormsFor`
  computing what each fact supports). So the real fix is **fact INCLUSION, not a
  new field**: route the counters/numbers scheduler through `factsOf(entry)` so a
  number gets ALL its facts (meaning + reading) by construction, and retire the
  `tensReadingFactsForPrereqs`/`numberUnitReadingFacts` band-aids. A future "say
  it" (mic) mode is a new *value* on the ask-forms axes, reached once. **Guard:**
  every taught item's fact-set equals `factsOf(entry)`. (Kills mechanism 1:
  readings, labels.)
  *Status: 🟡 keystone done —* `buildItem(entry, kind)` reads `factsOf` +
  `jp2enResponse` + `characterRoles` and derives prereq edges, so an item is
  "whole" by construction (tested: a number-word carries BOTH meaning and
  reading). *Remaining:* route the live counters scheduler through it under the
  fact-set guard (part of the Stage-3 track swap below).

- **Stage 2 — One `<LessonWalk>`.** Have preview, HUD, and resume read the same
  `items` array the walk teaches. Migrate tracks into it one by one; delete each
  `next-X-lesson.tsx` as it moves. **Guards:** preview tile-set == taught item-set;
  resume returns the session's stored current item. (Kills mechanism 2.)

- **Stage 3 — One generic scheduler.** Each track supplies only `order()`; every
  item carries `prereqs`; the single engine resolves untaught prereqs across
  tracks, budget-fills, and depth-gates (`MAX_PREREQ_DEPTH`), retiring the
  `prepOnly`/marker machinery. All ~8 `nextXLesson` functions collapse into one.
  **Guards:** the engine never returns an item whose prereqs are unsatisfied; and
  it never returns an item whose untaught-prereq chain exceeds the depth cap.
  (Kills mechanism 3: ordering.)
  *Status: 🟡 engine done, no track on it yet —* `planLesson` (pure core) +
  `nextLesson` (history seam) + `resolveItem` (kanji-corpus resolve) are built and
  tested standalone. *Remaining, and the next real step:* write the first
  `Track.order()` (numbers/counters — including the `generative-rule` units that
  have no normal entry) and swap the live counter scheduler onto `nextLesson`.
  This is the largest, riskiest slice — it touches shipped lesson behavior — so it
  is its own session.

- **Stage 4 — One `<Quiz>` shell and one `<EntryPage>`.** Collapse the 13 quiz
  screens to a shell + registered per-fact-kind renderers, and the ~7 library
  views to one declarative entry page. **Guard:** the mic-pronunciation dry run —
  adding a `FactKind` requires touching exactly one renderer registration.

Order rationale: 1 first (highest leverage — it fixes the classes we actually hit
and is the smallest), then the viewport (2), then scheduler (3), then the broad
UI collapse (4).

---

## 4. Invariant tests to add (the safety net)

These encode "consistency" so a future update can't silently drift:

- **Fact completeness:** ∀ curriculum item, taught facts == `factsOf(item.kind)`.
- **Preview ↔ content:** ∀ lesson, preview tiles == taught items.
- **Prereq monotonicity:** the scheduler never emits an item before its prereqs.
- **Resume identity:** resume(session) == session.currentItem.
- **Label single-source:** no surface phrases a role label except via
  `characterRoleTitle` (grep-guard).

---

## 5. Concrete file collapse (target)

| Today (forked per track) | Collapses into |
|---|---|
| `next-*-lesson.tsx` (×8) | `LessonWalk` + item-renderer registry |
| `*-lesson.ts` / `*-plan.ts` schedulers (×8) | `Track.order()` each + one shared `nextLesson` engine |
| `*-screen.tsx` quiz (×13) | `Quiz` shell + per-fact-kind renderers |
| `*-view.tsx` library (×7) | `EntryPage` + section registry |
| ad-hoc fact assembly (`counterFacts`, prereq stitching, `tensReadingFactsForPrereqs`) | `factsOf(item)` |

Nothing here is a from-scratch rewrite: it's introducing the shared seam, then
moving tracks across it one at a time, each move deleting a fork.

---

## 6. Progress (branch `refactor/content-model`)

The shared model and the one scheduler are built and tested in isolation. Nothing
live imports `@/lib/content` yet — main is safe, and each piece landed as its own
green commit.

`src/lib/content/`:

| File | What it is | Tests |
|---|---|---|
| `fact.ts` | `Fact { id, kind }`; `FactKind = ResponseKind` via `jp2enResponse` (alias, not a new enum) | `fact.test.ts` |
| `item.ts` | `ContentItem { entry, kind, glyph, facts, roles, prereqs }` — the keystone shape | — |
| `build-item.ts` | `buildItem(entry, kind)` — derives facts (`factsOf`+`jp2enResponse`), roles (`characterRoles`), and prereq edges (`teachableParts`/kanji-in-glyph). An item is "whole" by construction | `build-item.test.ts` |
| `scheduler.ts` | `planLesson` (pure: cross-track prereq ordering, `MAX_PREREQ_DEPTH` gate, floor/ceiling fill) + `nextLesson` (history seam: due = fresh fact, cost = `glyphDifficulty`) | `scheduler.test.ts` |
| `resolve.ts` | `resolveItem` — build-once kanji-corpus map the engine follows prereq edges through (a lookup, not an id parse) | `resolve.test.ts` |
| `track.ts` | `Track { id, order(history) }` — ordering only; prereqs live on items | — |
| `ordered-track.ts` | `orderedTrack(id, spec)` — turn a fixed (entry, kind) sequence into a Track, built through `buildItem` | `ordered-track.test.ts` |
| `registry.ts` | `createRegistry`, `itemRenderers` — for the Stage-2/4 renderer maps | `registry.test.ts` |
| `index.ts` | barrel |  |

**What's proven:** a number-as-word carries BOTH its meaning and its reading
(the drop can't happen by construction); the engine emits prereqs before
dependents across tracks, gates chains past depth 3 (and the gate lifts as the
tail is learned), fills to the floor without crossing the ceiling, and teaches a
real due item out of an empty history.

**The reusable toolkit is now complete** — model (`buildItem`), engine
(`planLesson` / `nextLesson`), resolve (`resolveItem`), and the Track adapter
(`orderedTrack`), each tested in isolation and composed on real data. There is no
smaller safe/additive piece left; what remains is the integration.

**Next (own session):** assemble the numbers/counters track from the real
curriculum — `orderedTrack` for the entry-backed base (number-words + counter
forms), plus the `generative-rule` units built directly (they have no normal
entry) — then swap the live counter scheduler onto `nextLesson` under the
fact-set guard. Stage 1's live half and Stage 3's first track, together. Largest
and riskiest slice; everything above is the safety net it lands on. The one
caution: this authors/faithfully mirrors live curriculum data, so it must be done
against `counter-lesson.ts` as its source, not from memory.
