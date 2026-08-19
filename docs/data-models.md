# Data models: what exists, and why you extend it

Every model in this app was built to answer one question precisely, and every
duplication bug on record came from a second answer to a question that already
had one. This doc is the map: what the core models are, where they live, and
the discipline for adding to them without forking them.

**Read this before adding a field, a record, a status word, or a per-track
file.** If what you need looks close to something below, it almost certainly
*is* that thing, reached through a narrower door than you expected.

This doc covers the **stable core** — identity, history, status, and query,
all shipped on `main` and unlikely to change shape. For the **content/lesson
layer**, which is mid-refactor, see
[`architecture-refactor.md`](./architecture-refactor.md) instead — don't
re-derive facts, schedulers, or per-track UI without reading that doc first;
it exists specifically to stop the eight-forks-of-one-pipeline pattern this
doc's "known duplication traps" section names by example.

---

## 1. Identity: `EntryId` and `FactId`

*(`src/types/index.ts` §"identity: entries and facts", minted in
`src/lib/fact-id.ts`, resolved in `src/lib/facts.ts`.)*

A character string used to be the identity, the display glyph, and the
primary key, all at once. That's fine for 214 kana and breaks on kanji — not
on collisions, on **granularity**. 生 has ~11 readings; `history.chars["生"]`
had room for exactly one accuracy number.

So identity splits in two:

- **Entry** — what you look up. `kanji:生`, `word:先生`, `kana:し`.
- **Fact** — one thing you can be *asked*. 生 is 1 meaning + ~10 readings,
  each reading keyed on `(kanji, word)` — never on the kanji alone, because
  "what is the reading of 生" has eleven answers and can't be graded.

**Both ids are opaque.** They are minted in one file and resolved by lookup
in one file. Nothing else may parse one — the moment a call site does
`id.startsWith("kana:")`, the model is welded shut and every future subject
becomes a special case instead of another row of data. The brand is
compiler-enforced in both directions: a `Record<FactId, T>` won't take a bare
`string` index, and a function typed for `FactId[]` won't silently accept
`EntryId[]`.

### Adding a subject is the extension seam, not a new model

From `facts.ts`'s own header:

> Publish a `FactInfo[]` from the subject's own module and add it to
> `SUBJECTS` below. That is the whole contract. Kanji, vocabulary, grammar
> patterns, conjugation, counters and whatever comes after are all one line
> here plus their own data file; none of them is a special case anywhere
> downstream, because nothing downstream can tell them apart.

If you're adding a new kind of content (a new track, a new question type over
existing content), the question is never "what new record do I need" — it's
"what `FactInfo[]` does this publish, and does it belong in `SUBJECTS`."

---

## 2. History: `HistoryFile`, and its four records

*(`src/types/index.ts` §"history.json shapes")*

`HistoryFile` is the one persisted record of a learner. It holds **four**
distinct things, and the split is deliberate — each answers a question the
others structurally cannot:

| Record | Answers | Written by | Rebuilt? |
|---|---|---|---|
| `sessions` | What did you actually **do** | A completed quiz round | No — append-only, capped at 200 |
| `facts` | What the model **believes** now (`FactAggregate`: counts + stability) | `aggregate.ts`'s fold over `sessions` | **Yes** — rebuilt from `sessions` on every `deleteSessions()` |
| `claims` | What you **said** you know (`FactId → ms epoch`) | "I already know this" | No |
| `seen` | What you asked to be **quizzed on** (`FactId → ms epoch`) | "Quiz me" | No |
| `learnedAt` | When a fact **first** entered your knowledge base | Write-once, keep-earliest | No |

A claim is not folded into `facts` and must never be, for a reason worth
repeating verbatim from `claims.ts` because it's the exact shape of bug this
doc exists to prevent:

> `history.facts` is DERIVED. `deleteSessions()` rebuilds it from `sessions`
> (`aggregate.foldSessions`), so anything written there that did not come
> from a session is silently erased the next time you delete one. The claim
> would work, and then one day it wouldn't, and nothing would say why.

If you're tempted to write a claim (or any self-reported/inferred belief) as
`{lastTested: now, stability: big}` directly into `facts`, don't — write it
to its own record, the same way `claims` and `seen` do, and read it back
through `effectiveState` (§3).

**Don't invent a fifth record without asking first whether it's really a new
*kind* of evidence.** `claims` and `seen` look almost identical
(`FactId → ms epoch`) and still needed to be two records, because they mean
different things to the model — one clears material out of rotation for a
season, the other puts it back in front of you almost immediately. If your
new thing is a genuinely new kind of evidence (not derivable from the four
above), it earns a fifth record on the same terms: its own key, in
`HistoryFile`, documented with what it means and who may write it. If it's
derivable, it belongs in `facts` via the fold, not as a new top-level key.

---

## 3. The one place three records become one belief: `effectiveState`

*(`src/lib/claims.ts`)*

Three records — a tested aggregate, a claim, a "quiz me" — can all speak to
the same fact. **`effectiveState(agg, claimedAt, seenAt)` is the only place
that resolves them into one `FactState`,** and the rule is newest-record-wins,
nothing merged:

- Claim を today, missed it in March → the claim wins. March isn't evidence
  about now.
- Claim を today, miss it tomorrow → tomorrow's session wins, and the claim
  is discarded outright — a claim never floors what a later answer shows.

Three call sites already share this function rather than re-deriving
"known": `kanji-known.ts`, `word-unlock.ts`, `grammar/readable.ts`. The
comment on `kanji-known.ts` is the rule, stated once, worth keeping in view:

> It is the model `word-unlock.ts` and `grammar/readable.ts` already share...
> A re-implementation always forgets `claims`, and that is the half that
> makes a returning learner's screen wrong.

**If you're writing a fourth "is this known" check for a new subject, it is
almost certainly the same bug that comment describes, not a new fact about
your subject.** Call `effectiveState`, or the higher-level helper for what
you actually need (below) — don't recompute "has this been tested, claimed,
or asked-for" by hand.

Two levels above `effectiveState`, matched to two different questions:

- **`knownFactIds(history)`** (`known-facts.ts`) — the *union* of
  `facts ∪ claims ∪ seen`: "is this in the learner's knowledge base at all,"
  used for confusion-search candidates. Deliberately generous — a fact
  they've merely met is a plausible thing to mix another up with.
- **`standingOf` / `bandOf`** (§4 below) — the *crossing* of recency and
  accuracy: "how well do they know it," used everywhere the UI shows a
  status word.

Reach for `knownFactIds` when the question is membership; reach for
`bandOf`/`standingOf` when the question is quality. Neither is a
looser-or-stricter version of the other — they answer different questions,
and that's why both exist rather than one with a threshold parameter.

---

## 4. Status, as a word: `FactBand` / `Standing`

*(`src/lib/library/standing.ts`, wrapped by `bandOf` in `src/lib/selection.ts`)*

The learner never sees a probability. They see **New / Shaky / Getting
there / Solid / Slipping / Claimed**, because those are things a person can
mean about their own memory. `standing.ts` is **the one file where a number
becomes one of those words** — everywhere else in the app that shows a
status is reading this, not computing its own.

The crossing that makes "solid" mean something:

> `status` is a RECENCY reading... so it spikes to `quiet` the instant after
> any drill, however badly the drill went. Reading "solid" off `quiet` alone
> was the bug: a fact the learner had just missed four times out of five
> read `quiet` and therefore "solid"... So "solid" is the CROSSING: the
> model expects you to recall it right now (`quiet`) **and** your record
> backs that up (accuracy ≥ `SOLID_PCT`).

**Two call sites currently compute a mix-up/status count independently** —
this is a live example, not a hypothetical, and it's exactly the kind of
drift this file exists to prevent. If you're fixing a status count that
disagrees between two screens (Practice vs. Progress, for one confirmed
case), the fix is almost never "reconcile the two formulas" — it's "delete
one of them and read `standingOf`/`bandOf` in both places." Two screens
computing the same word from the same history should be structurally unable
to disagree, because there should be exactly one function computing it.

`FactBand` also carries `"mixup"`, which is *not* on the same axis as the
others — a mixed-up fact can independently be solid, shaky, or new. That's
why `Selection.states` is a set that ORs rather than a single value that
partitions: "mix-ups" and "shaky" are different questions, and the answer to
both can be yes for the same fact. Don't collapse them into one enum value.

---

## 5. Query, not storage: `Selection`

*(`src/types/index.ts` §"selection: a query, not a set", resolved by
`resolve()` in `src/lib/selection.ts`)*

`Selection` replaced a stored `char → bool` map — workable at 214 kana,
un-tickable and 400KB-per-toggle at 21,449 facts. **A selection is a
question, not a set**: a fixed handful of fields (`subjects`, `types`,
`list`, `states`, `text`, `session`, `learned`) regardless of how much
material exists, resolved on demand.

**Every field narrows.** Empty `Selection` = everything; each populated
field intersects with the others. `resolve()` is the only thing that turns
a `Selection` into facts, and it's pure — a function of `(query, history,
lists)` and nothing else.

If a new screen needs "give me the facts matching X," the answer is very
likely a new `Selection` field (narrowing, composing with the rest) rather
than a bespoke filter function living beside `resolve()`. Practice, the
Library, and Rerun-a-session all go through this one function today — a
past session literally *is* `{session: ts}`, which is what makes "run this
again" free instead of a separate feature with its own code path.

`SavedList` (`fixed` vs `derived`) is the one place this splits in two on
purpose: a fixed list is a set a person edits; a derived list is a
`Selection` re-resolved on every read. The split is exactly "does a person
or a rule decide what's in it" — don't build a third kind that's a person-set
today and hope to make it a rule later, or vice versa; pick which one it is
up front.

---

## 6. Configuration: `QuizConfig` / `AskConfig`, `SettingsFile`

*(`src/types/index.ts` §"quiz config", §"settings")*

`AskConfig` organizes "how to ask" **by source** (`japanese` / `sentence` /
`english`), not by an abstract direction — direction is *inferred* from the
combination, which is why there's no separate `dirs` field. If you're adding
a new prompt format or response kind, it's a new value on one of
`JapaneseAsk`/`SentenceAsk`/`EnglishAsk`'s existing axes, resolved through
`enabledFormsFor` in `ask-forms.ts` — not a new top-level config shape per
question type.

`SettingsFile` is a server-synced blob where **every field is optional**,
meaning "this learner never set it, use the default." That's what lets a
single-field POST (just the theme) merge into the stored blob without
disturbing the rest. A new setting is a new optional field here, read
through its own validated accessor — not a new persistence mechanism.

---

## 7. The content/lesson layer is mid-refactor — read that doc, not this one, for tracks

The identity/history/status/query models above are stable and unlikely to
move. The **lesson-scheduling and per-track UI layer is not** —
[`architecture-refactor.md`](./architecture-refactor.md) documents an
active, merged-in-part refactor collapsing eight forked
scheduler/preview/quiz-screen/library-view stacks (one per track) into one
`ContentItem`/`Fact`/`Track` model with registered renderers.

The short version, if you're touching anything lesson- or track-shaped:

- **`factsOf(entry)`** (`facts.ts`) already expands an entry into its facts.
  If a new track hand-assembles its fact list instead of calling this, it
  will eventually drop one — this already happened twice (numbers losing
  their reading fact, patched twice before the real fix routed through
  `factsOf`).
- **Prerequisites are data on the item** (`ContentItem.prereqs`), not a
  per-track marker/state machine. If you're adding gating logic for a new
  track, it is a DAG edge, not a new `prepOnly`-style flag.
- **Registries throw on duplicate registration** (`src/lib/content/registry.ts`)
  — adding a content kind means registering one renderer, and the registry
  itself refuses to let two things silently claim the same key. That's the
  mechanical version of this whole doc's argument, enforced at runtime for
  one layer already.

If you're about to write `next-<track>-lesson.tsx`, a new `*-screen.tsx` quiz
component, or a new `*-view.tsx` library page: stop and check
`architecture-refactor.md` §2–3 first. The doc's whole premise is that this
is exactly the pattern that turns one bug into eight.

---

## 8. Known duplication traps, with real examples

These are drawn from actual bugs, not hypotheticals — the app has already
paid for each of these once.

- **A second "is this known" check.** Every occurrence of this bug is the
  same shape: a new subject or screen needs to know if a fact is learned,
  and re-derives it from `history.facts` alone, forgetting `claims` (or
  `seen`). Fix: call `effectiveState` or `knownFactIds`, never re-check
  `lastTested > 0` by hand.
- **A second status vocabulary.** If a screen needs to show "how well do you
  know this" and the five words already in `Standing` don't fit, that's a
  reason to extend `standing.ts`'s crossing — not to invent a sixth word
  computed locally. Two screens showing different counts for what should be
  the same status (confirmed: Practice's mix-up count vs. Progress's
  mix-up count disagreeing) is the symptom of exactly this.
- **A denominator that moves with a setting.** `lesson-position.ts` exists
  because three tracks independently answered "what's the total" and one of
  them ("lesson 1 of 1068") was counting *lesson groups*, a number that
  shifts every time the lesson-length slider moves — 1068 becomes 1250 with
  no new material learned. The fix: **count the material** (2,136 kanji is a
  fact about Japanese; it doesn't move when a slider does), and show a
  *range* when one lesson teaches several items ("Kanji 5–8 of 2,136," not
  "Kanji 5 of 2,136" for a four-item lesson). If you're adding a "N of M"
  label anywhere, read this file before writing a new one — and if the
  denominator you're counting can change when a *setting* changes rather
  than when *content* changes, that's the tell you've built the old bug
  again.
- **A per-track fact-assembly function.** `counterFacts`,
  `tensReadingFactsForPrereqs`, and similar hand-built fact lists are the
  exact failure `factsOf(entry)` exists to replace (§7). A new track
  building its own list is reintroducing a fork the refactor is actively
  retiring.
- **A per-track scheduler state machine.** Markers, `prepOnly` flags, and
  similar per-track bookkeeping for "what's taught next" are what the one
  generic scheduler (`planLesson`/`nextLesson` in `src/lib/content/`) exists
  to replace. A new track writing its own marker logic is the same fork one
  layer up.

---

## Before you add anything: four questions

1. **Is this a new kind of evidence, or a derived view of evidence that
   already exists?** Derived → compute it from `HistoryFile`'s four records
   through an existing fold (`effectiveState`, `aggregate.ts`), don't store
   it. Genuinely new → it earns its own key in `HistoryFile`, documented
   with who may write it and why the existing four don't cover it.
2. **Is there already a function that answers this question for another
   subject?** `effectiveState`, `knownFactIds`, `standingOf`/`bandOf`,
   `resolve()`, and `factsOf` are all subject-agnostic on purpose. Check
   before writing a subject-specific version.
3. **Does this denominator/count change when a *setting* changes, or only
   when *content* changes?** If a setting can move it, you've built
   `lesson-position.ts`'s bug again — count material, not lesson groups.
4. **Are you about to write a new per-track scheduler, quiz screen, or
   library view?** Read `architecture-refactor.md` first — that's the doc
   defining where it belongs, and whether it belongs at all.
