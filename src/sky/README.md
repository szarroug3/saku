# The Sky

The redesign, built clean. Everything under `src/sky/` is **new work for the
Home / Planetarium / Lesson / Quiz / Practice / Atlas redesign**, kept deliberately
separate from the current app so the old surfaces can be deleted wholesale when
this replaces them.

Tracked in Linear under the `Sky: *` projects.

## The one rule

**Nothing in here imports from the existing app, and nothing in the existing app
imports from here.**

Not `@/components/*`, not `@/lib/*`, not `@/data/*`. If the Sky redesign needs
something the app already has, it gets its own copy in here, however small. A
three-line helper duplicated is cheaper than a dependency that has to be untangled
during the cutover.

This is enforced by lint, not by discipline: see the two `no-restricted-imports`
blocks in `eslint.config.mjs`. If you hit that error, the answer is to bring a
copy into `src/sky/`, not to add an exception.

### Colour: the night theme, as tokens

The Sky is a single night theme by choice: a dark ground, warm stars, gold for
actions, one palette for standings. It lives as `--sky-*` custom properties on
`:root` in `globals.css` (SAK-291), mapped into Tailwind as `bg-sky-ground`,
`text-sky-ink`, `text-sky-mint`, `border-sky-line`, `font-sky-display`,
`font-sky-ui` and the rest. They are not per app theme: the sky is the same
night under aizome or kiri. A dawn variant would redefine the same names under
a data attribute, and no component would change.

**Never write a raw hex value in Sky code.** If a semantic is missing, add it to
the `--sky-*` block once and give it a name in the `@theme` block beside it.
Two floors are enforced by `src/sky/lib/night-theme.test.ts`, which parses the
stylesheet: text tokens reach 4.5:1 on every ground and card, lines reach 3:1.
`--sky-faint` and `--sky-star-dim` are decorative only and never carry text.
The sweep and the page wash live in `src/app/sky-wash.css` as an ordered list
of layers, each a few named knobs (a glow's colour, strength, position, size,
tail and visibility). `/wash` (gallery page removed 2026-09-04) is the editor: drag glows, pick colours,
add, hide, reorder or remove layers, then Save (rewrites the file through
`/api/dev/sky-wash`) or Save + bake; Reset goes back to what the file last
held. The editor only shows in the live CSS wash mode, the one it edits.
`src/sky/lib/sky-wash-file.ts` is the parser and renderer both sides share.
What ships is the baked bitmap, `public/sky/wash-baked.png`, from
`npm run bake:sky`, which first regenerates the file from its knobs. The stars
are knobs too: `--sky-stars-*` (density per tile, radius and opacity ranges,
seed) shape the stardust tile, and the Milky Way band has `--sky-milky-shift`
(slide it along its line, or drag the MW handle), `--sky-milky-softness` (how
wide and eased its edges are; 0 is a hard stripe) plus `--sky-milky-stars*` for
its own star field: density, size and brightness ranges, `-width` (spread
across the band) and `-x` (slides the whole star field left or right while
the band stays; drag the star handle). The stars always run the band's whole
length. The field is an inline
SVG drawn for 16:9 and shown with cover so it agrees with the baked bitmap. Both images are generated on Save. To judge
scroll and resize with real content on top, the wash page and `/tokens` (gallery page removed 2026-09-04)
have a "cards" pill (bottom left) that overlays a fixed wash with a long column
of coverage cards; the wash switch beside it swaps modes. The wash (`bg-sky-mesh`) has two halves: the upper sky is text-safe, the
lower third is a vivid painted horizon where **only large ink (headings) sits
bare, and body and muted text live inside panels** (`bg-sky-card`), whose dark
glass is what the test checks them against. `/tokens` (gallery page removed 2026-09-04) shows every token live with its ratios.

### Standings: one vocabulary, painted only with its word

How an item is going is one of the app's six words (`src/sky/lib/standing.ts`,
SAK-294): solid, getting there, shaky, slipping, claimed, not seen. Each has
its own alias token (`bg-sky-solid`, `text-sky-slipping`) on the night palette,
so a screen paints the word. `standingOf(evidence)` is the Sky's copy of the
app's decision table; the caller runs the model and hands over showings, the
model's verdict (teach, probe, quiet) and the last-ten-runs accuracy, and
`standing.test.ts` proves the copy agrees with `src/lib/library/standing.ts`
on a grid of scenarios (that test is the one place Sky code imports the app,
and it goes at cutover). **A bare coloured dot never appears without its
word:** the dot is not exported; `StandingChip` and `StandingLegend` in
`src/sky/components/standing-legend.tsx` are the only ways to paint one, and a
star fill or coverage bar sits beside a legend. Inside the lesson a star is
locked, open, lit or selected (`LessonState`), never a standing; "tonight" and
"lit" are legend rows there, never chips. `/standings` (gallery page removed 2026-09-04) shows all of it.

### The prerequisite graph: what needs what, once

`src/sky/lib/graph.ts` (SAK-299) is the one model of composition and
prerequisites, and the Planetarium, the Lesson, the constellation renderer,
the Atlas and Practice all read it. `buildGraph(items)` takes the flat item
list (a word's `components` are its kanji, a kanji's its parts; a verb pair or
keigo form has its own kanji plus a `headword` it attaches to and needs) and
answers: `prerequisitesOf`, `dependentsOf`, `closureOf`, `orderOf` (pieces,
then kanji, then the word: the lesson's sequence), `unmetPrerequisites`,
`isAvailable` (every direct prerequisite learned), `wouldUnlock` (the
Planetarium's hints), `costOf` and `pieceCount` (the cart: shared pieces once,
learned ones free) and `constellationOf` (every node once with its depth, and
every edge). "Learned" is the caller's predicate, usually `isKnown(standing)`.
Two rules: a piece used by two parents is one node with one state; and
learning a thing says nothing about its parts, so a claimed word is only the
word and its unknown kanji and radicals are still counted and taught.
Dangling references and cycles are cut and
reported, never hidden. `/graph` (gallery page removed 2026-09-04) builds it from the app's real kanji
and vocab tables (that dev route is exempt from the boundary).

### Constellations: one seeded shape, every screen

`src/sky/lib/constellation.ts` (SAK-296) turns the graph's shape into
positions: `layoutConstellation(graph.constellationOf(id))` puts the root at
the centre, its parts on a ring, their parts fanned out beyond (each level
reaching a little less), a shared piece once, between the parents that share
it, and normalises to the unit box. Every number hashes from the root's id
(`hashUnit`, the prototype's function), never `Math.random`, so a word is the
same shape on the home sky, in the Planetarium, in the lesson, on an Atlas
tile and in Practice; `placeConstellation(layout, cx, cy, r)` is the only
thing that differs. Prerequisites + 1 stars, no more. `ConstellationFigure`
(`src/sky/components/constellation.tsx`) draws a placed layout inside an
`<svg>`: star size by role (`roleOf(kind)`: word, kanji, piece), body by kind
(`bodyOf(kind)`: grammar and sentence rules are planets, counters asteroids,
verb pairs binary stars, the rest stars), colour by
standing through the standing tokens, glow on known stars, lines that fade
and dash to stars not lit or known; the lesson's looks (`tonight`, `lit`,
`emphasis`) override the standing, and `dots={false}` draws lines only so the
lesson can put its own clickable stars on the returned positions, in the same
colours via `paintFor`. `/constellations` (gallery page removed 2026-09-04) shows all of it on real words.

### The coverage bar

`CoverageBar`
(`src/sky/components/coverage-bar.tsx`) is the stacked bar by standing, in
the standing tokens, with no labels of its own: pair it with a headline and
a `StandingLegend` carrying the same counts. It takes the size of the whole
collection as a separate argument and is always drawn against that, never
the filtered part (`src/sky/lib/coverage.ts`, tested); a counted segment
never disappears (a hairline at least) and an empty bar still draws.
`/filters` (gallery page removed 2026-09-04) has both, live.

### The home: one call

`SkyHome` (`src/sky/components/sky-home.tsx`, SAK-329 to 336) is the whole
home page: given `SkyHomeData` (items, the constellation roots, mix-ups) it
draws the sky, the legend, "How much you've discovered" and "Mix-ups". Every
part is its own component and reused elsewhere: `SkyCanvas` (the SVG with
seeded dust, a viewport group, and pan and zoom when interactive),
`SkyField` (scatters and draws the constellations with hover tooltips; the
Planetarium preview and the lesson use it at other sizes and with their own
looks), `SkyTooltip`, `DiscoveryPanel` ("x of y" per
subject, grouped as Progress groups them: Sam chose the breakdown by subject
over the one by standing; each bar is the standing breakdown and hovering
it gives the numbers), `MixUpsPanel` ("日 day and 目 eye, 4 times", every
pair). The panels share `SkyPanel` (the card with the small caps title);
every card that floats over the sky (a star's tooltip, a bar's numbers, the
legend's key) is `SkyCard` inside `Floating` from `sky-card.tsx`, which
renders on the body and anchors by the edge facing away from the pointer.
The legend is the filter through `useStandingFilter`: click a word to show
only that standing, hover one to single its stars out, and the counts sit
inline. `StandingTally` is the same counts as words with no dots. The page
explains nothing the visual already says.
`src/sky/lib/scatter.ts` places boxes without overlap, seeded; `sky-scene.ts`
decides roots (met items not under another met item), the star set and the
tally. The data comes from an adapter outside the tree: for now
`src/app/learner.ts` reads the Library's entries and the learner's
history (a multi-fact entry's star wears the worst of its facts; a radical
taught as its kanji is the kanji's star), and `/` renders it on
the signed-in learner's progress, or on a pretend learner with `?sample`.

### The Observatory: one call

`SkyObservatory` (`src/sky/components/sky-observatory.tsx`, SAK-300 to 304)
is the whole page: given `SkyObservatoryData` (every item on offer and under
it, what is learned, and the sections) it lays out the picker and the rail.
The picker is `ItemSection`s of `ItemCard`s, English only, each priced in the
real pieces it brings beside what is learned and what is already picked;
what cannot be picked yet is not shown, nor a finished track, and a section
says what its kind of thing is and when to start it until it is started. The rail is the preview sky (`SkyField` with `tonight` set to the
picks: known stars lit, the rest faint), the `PieceMeter` against a
comfortable lesson (12, a placeholder), and tonight's picks with what each
brings and a remove with undo. Every number comes from `src/sky/lib/cart.ts`
over the graph: `cartSummary` (per-pick `costOf`, total `pieceCount`, the two
pinned equal), `pickState` (a part never locks; a headword or a kana row
does, and the cart can supply it), `withoutPick` (removing a pick takes down
what it held open), `pickBreakdown`. A kana row is a `group`: picked as one,
locks what builds on it, drawn, but never a piece itself. The data comes from
`src/app/.ts` (kana rows from the character sets, words in
curriculum order, counting, grammar behind a plain-hiragana gate, verb pairs
and keigo attached to their plain verb); `/observatory` (`?sample`).

Type: `font-sky-display` is Shippori Mincho for Japanese and display, falling
back to Hiragino Mincho; `font-sky-ui` is Karla, falling back to the system
stack. Both are loaded once by the Sky layout, never per component.

The app's own tokens (`bg-card`, `text-text`) are still fine where a Sky
component sits inside current-app chrome, which today means the dev gallery.
New Sky surfaces paint with `--sky-*`.

## Layout

```
src/sky/
  lib/         types, tokens, small self-contained helpers
  components/  the shared primitives (ItemCard, ItemSection, ...)
```

Page-level composition lives in the route that renders it, not here.

## Where to look at it

`/dev/sky` — a gallery of every Sky component, one page per primitive.
Dev-only: the whole `/dev/*` subtree 404s in a production build, and the nav
group is compiled out.

## Migration, done

The boundary was enforced both ways, so the cutover was mechanical: the real
routes point at Sky components (2026-09-06, below), and the old
`src/components/<surface>` trees went with the archive the same day. The
lint boundary stays: nothing in `src/sky` imports the app, and only the
Sky's own routes render the Sky.

### Shared pieces (2026-09-05 cleanup)

`SkyButton` and `RoundButton` (`sky-button.tsx`) are every action and
control on every page: solid in the accent for the main thing to do,
outline for the quieter choice, quiet for a step back, coral for a warning,
round for a close, widen or fold. `SkySurface` (`sky-panel.tsx`) is the
see-through box every panel, card and rail sits in, and `SkyPanel` is that
box with a small caps title. `DetailFrame` (`detail-frame.tsx`) is the frame
of a panel that shows one thing and acts on it: controls across the top, a
body that scrolls inside the box when asked, actions pinned at the bottom;
the lesson's card (`LessonCard`, the star's head and its kind's blocks), the
Atlas's entry and its selection wear it. `teach-page.tsx` renders a page of
teaching (paragraphs, a build formula, tables, worked examples, the pager);
a star's pages and the pages between stars are the same `TeachPage`. The
Atlas is composed from `AtlasRail`, `atlas-grid.tsx` (tiles in cuts that
mount as they scroll near), `useSelection` (plain, cmd and shift picks over
the tiles on screen) and `useEntries` (entries fetched once, fetched ahead
on hover).

Added in the second audit (2026-09-05): `SkyChip` (`sky-button.tsx`) is the
one pill that is on or off (a pager's pages, the Atlas's "also found"
counts); `SkyInput` (`sky-input.tsx`) is the one text box (the Atlas's
search, the Quiz's answer); `SkyBox` (`sky-panel.tsx`) is the bordered box
inside a card (a table, a worked example); `Eyebrow` (`sky-card.tsx`) is the
one small caps label, in a tone (muted, accent, or the caller's colour) and
a size, wherever a label sits over content. Non-primary actions are the
outline button; quiet is only for a step back. A raw `<button>` is for a
thing that is selected (a tile, a row, a choice), never for an action. The
Quiz's results screen is its own component (`quiz-results.tsx`). Since
(2026-09-06): `SkyMenuChip` (`sky-menu-chip.tsx`) is a chip with a caret
that opens a floating card of finer choices (a collection's cuts in the
practice recipe); it uses `Floating` with `interactive` and `belowAnchor`,
so the card floats on the body like every other card and is never clipped
by a scrolling panel.


### Practice (2026-09-05)

`SkyPractice` (`sky-practice.tsx`) describes a deck rather than assembling
it: a `Recipe` (`lib/practice.ts`) says what to draw from, which cuts of a
collection to keep (kana by script and row type, grammar by form, the
counting shelf's three parts, keigo's two: the Library's own sections,
never the fifty-wide scroll buckets of kanji, words and radicals; chosen
from a menu on the collection's chip, `SkyMenuChip`, which floats on the
body like every other floating card), what
standing it should have, what to be asked for, and how many. A collection's
pool is its shelf's sections, so Counting holds the counting rules and the
numbers as the Atlas shelf does. A saved recipe is the recipe under a name, kept
by the learner and shown only once there is one. The preview is the recipe
resolved now, shakiest first, with any item droppable. A kanji's readings
are asked inside the words that carry them, each once such a word has been
met (`quizzableFacts` keeps that gate), so "The reading in a word" lights
up as the learner meets words. The run is `SkyQuiz` with the write target
handed in: the Quiz route passes the schedule's recorder, the practice
route passes a client function that only notes misses in the browser, so
no practice answer can reach the schedule.

### The Atlas since (2026-09-05)

The kanji shelf carries a "Built from" row of radicals and cuts by one,
together with the status list. A shelf over 3,000 entries (Words) ships
its cuts as ids only: each cut fetches its tiles as it scrolls near
(`AtlasLookup.tiles`), and a status cut of it is answered by the server
(`AtlasLookup.sections`).

### Settings, account, reading pages, rests and the pitch fact (2026-09-06)

`SkySettings` (`sky-settings.tsx`, model `lib/settings.ts`) is a row per
setting over the app's own QuizConfig, mapped in the dev route; the Sky
never invents a setting. `SkyAccount` lays out the app's sign-in and
sign-out, handed in. `SkyReading` (`lib/reading.ts`) renders How Saku
works and About from the app's data files. `SkyRest` (`lib/rest.ts`) is
the clock between a lesson's three rounds, a timestamp in the browser.
New primitives: `SkyToggle`, `SkyStepper`, `ChipRow` (equal-width chips),
`SkyMenuChip`. Pitch is a fact (`word:<keb>/pitch`, `src/data/pitch-facts.ts`):
in the registry, so it schedules and records, but off its word's fact list,
so the Library's known rule and the app's lessons are untouched; the Sky's
lesson quiz adds it for each word taught while pitch questions are on.

### Listening, the timer, ordering, sessions (2026-09-06, later)

`QuizCard.listen` is a listening card: the reading plays itself, glyph and
context hidden until answered or "Show it"; `timerSeconds` on `SkyQuiz`
counts a card down from the clock's tick. `QuizCard.order` is a sentence
tier's ordering board (tap to place, tap to take back); the recorder
credits its pattern facts in an "assembly" session, the app's own kind.
`SkySessions` (`lib/sessions.ts`) lists the learner's session records
with the quiz's grades derived from each record's counts. The retries
count lives on the quiz's help bar and the rest length on the rest
screen: one home per setting, the place you would reach for it.

### Sign-in preferred, never required (2026-09-06)

Every Sky read is a server action that takes whose history to read
(`who.ts`: the sample's, the browser's, or the account's). A route renders
its data when it had a history to read (sample or signed in); signed out,
the page's client (`local.tsx`: `useWho`, `useLoaded`) hands up the
browser's own copy from the app's HistoryProvider, lean of its sessions
except where they are needed. Every write goes through the app's own
progress calls (`writes.ts`), which land on the account when signed in and
in the browser when not, carried up on sign-in as the app has always done.

### Cutover (2026-09-06)

The Sky is the app. Its routes moved from `src/app/dev/sky` to
`src/app/(sky)`: `/` (the Planetarium), `/observatory`, `/lesson`, `/quiz`,
`/practice` and `/practice/run`, `/atlas`, `/sessions`, `/settings`,
`/account` (also served at `/login`), `/how-it-works`, `/about`. The old
app's pages were archived first, unrouted, in `src/app/_classic` with
their end-to-end specs in `e2e/_classic`, then removed on Sam's word the
same day (see "The archive, removed"). The lint boundary now reads: only
the Sky's own routes render the Sky. Anywhere this file
says `/dev/sky`, read the top-level path.

### The archive, removed (2026-09-06)

The old app is gone from the tree: `src/app/_classic`, `e2e/_classic`, the
old frame under `/dev` (the sidebar and its dock), and every component and
library file that nothing live reached any more (the old lesson planner,
the session and results screens, the Library pages, lists, the old
Progress page, the pairs, grid, substitution and sentence-listening quiz
modes). A few helpers stayed because live tests build fixtures with them
(`curriculum-lesson.ts`, `lesson.ts`, `sentence-ordering-plan.ts`,
`session-accuracy.ts`, `list-membership.ts`); they are dead to the app and
listed for the data-model cleanup.

To read anything from the old app, use the last commit that carried it:

    git show 0bccca51:src/app/_classic/library/page.tsx
    git ls-tree -r 0bccca51 --name-only | grep -E '_classic|components/(session|results|library)'

The removal itself is commit f2cf0827 ("Remove the old app's archive: the
Sky is the app").

### The shell (2026-09-06)

`SkyShell` (`sky-shell.tsx`) is the app's frame: the wash fixed under
everything, a thin bar along the top with the Saku mark, the pages in a
row of small caps with the current one underlined in the accent, and the
account on the right; a visitor's notice as a slim band under it; the
page below in a flex column, so a page passes `height="100%"` and fills.
The route group's layout (`src/app/(sky)/layout.tsx`, `shell-client.tsx`)
hands it the path, the learner's look (accent and kana face from
Settings, as the tokens the Sky reads) and the sign-in or sign-out control.
The root layout is providers only; the dev galleries keep the old frame in
their own layout. `SkyNote` is the line over a page (whose progress, the
sample toggle) that the old dev wrapper used to carry.

### Everything in the sky, and only what the window shows (2026-09-06)

Nothing is excluded from the Planetarium any more (Sam: "if it gets taught,
it should appear", and "everything should behave according to its own
filter regardless of where it is"): the firmament is every kana, piece,
kanji and word, on top of the counters, grammar, sentence rules, verb pairs
and keigo, so about 15,400 constellations. Every kind that can be a star
is therefore up there as itself as well as inside whatever is built from
it, which is what lets a piece survive Kanji being turned off. Only the
pages to read (a term, a writing rule, a concept) stay out: nothing is ever
asked about them, so they have no standing to paint. A piece written the
same as a kanji is that kanji, one node with one standing, so it answers to
Kanji. Three things make the size affordable.

**The scatter is no longer quadratic.** Every box is registered in the
cells of a uniform grid it touches, so a clash test looks at its
neighbourhood rather than at every box already down (`scatter.ts`). Fifteen
thousand boxes went from 1.7 seconds to 44 milliseconds. Placements are
byte-for-byte what they were: only the candidate list got shorter.

**A field draws only what the window can show.** `SkyCanvas` reports the
world rectangle on screen and the zoom it is drawn at; `SkyField` cuts the
world into 24 columns and keeps the constellations in the cells the window
covers plus a ring of slack, so a pan redraws only when it crosses a cell
(`CULL_ABOVE`, `CULL_CELLS`). Below 400 constellations nothing is culled,
which keeps the previews and the lesson simple. Zoomed far out the hit
circles go too (`HIT_ZOOM`): a dot that small cannot be aimed at, and there
would be tens of thousands. The band the sky OPENS on comes from `focus`
alone, so the server renders what the client first draws.

**The sky packs around what is shown.** A constellation the filters leave
out, or whose every star they hide, is not laid out at all. Turn
Undiscovered off and the sky closes up around what the learner knows,
instead of leaving it scattered across a world sized for everything.

The filters are two rows of one-width chips (`useEqualChips`, the hook
behind `ChipRow`): the standings, then the collections
(`sky/lib/groups.ts`, the Atlas's own names). BOTH cut star by star, and a
star answers to its own collection wherever it is: a word constellation is
a word, the kanji it is written with and the pieces under those, so with
Words and Radicals on and Kanji off it draws the word and the pieces and
leaves the kanji dark (Sam, 2026-09-06). A constellation is laid out when
its ROOT is drawn, so one whose collection or standing is off goes
entirely. Asking instead whether ANY star showed drew every undiscovered
word that held a kanji the learner knows, and a kanji sits in dozens of
words, so filtering to Words alone put thousands of stray pieces up there.
Under the rows, a warning: showing more at once makes the sky slower to
draw.

### The whole firmament, and a clear box (2026-09-06)

The undiscovered sky used to be every kana and every kanji and nothing
else, so a learner saw no planet, asteroid or binary until they had
learned one, while the legend counted all of them as undiscovered
(Sam: "im not seeing any undiscovered planets/asteroids"). `beyondWords`
(`src/app/(sky)/observatory.ts`, was `metBeyondWords`) now offers every
counter, grammar pattern, sentence rule, verb pair and keigo set, not
only the met ones, and returns the rest as `firmament` for
`skyFromHistory` to append: 2,557 constellations undiscovered rather
than 2,350, and 121 planets, 67 binaries and 10 asteroids among them.
Words stay out, as they always have: twelve thousand of them would be
the whole sky.

The home's sky sits in a `.sky-wash-clear` box (`src/app/sky-wash.css`):
the wash's baked gradient with neither of its two star layers, attached
to the viewport so it lines up with the wash behind it. The box reads as
a window onto the same sky rather than a panel over it, and the only
stars inside it are the learner's own. With one or two constellations
discovered, the wash's stardust showing through was indistinguishable
from a sky.

### One info mark, and the quiz's helpers moved out (2026-09-06, SAK-366)

The "i" that opens a note existed twice: this tree's own, drawn for the
standing legend, and the app's Radix tooltip restyled to match and handed
to Practice, Settings and the results as a `tip` prop, since nothing in
`src/sky` may import the app. They were made to look alike by hand and
still behaved differently. `SkyInfo` (`sky-info.tsx`) is the one, so the
prop is gone from `SkyQuiz`, `QuizResults`, `SkyPractice` and
`SkySettings`. It opens above the mark, or below it near the top of the
window, where there would be nothing above.

`quiz-client.tsx` was also where `grade`, `retriesOf`, `retriesPatch` and
that `Tip` lived, so Settings and Practice imported the Quiz to reach
them. They are `grade.ts` and `retries.ts` now. Settings imports none of
it, and the page went from 14.83 MB of JavaScript to 0.48 MB: one
component from the quiz's client file had been pulling the app's engine
and every data table in with it. SAK-380 is the same cut for the quiz and
practice, which grade on the client and so genuinely reach the engine.

### The box types kana (2026-09-06, SAK-386)

A reading card used to ask for romaji and grade it against the kana, so a
learner read Japanese all lesson and then answered in Latin letters, and
the reveal showed kana they had never typed. The box now transliterates as
it goes: `meihaku` becomes めいはく, `nanajuugo` becomes ななじゅうご, and
an unfinished run stays latin (`meih` is めいh) so nothing is guessed at
mid-word.

The one exception is a kana card, where romaji IS the answer: shown あ you
say "a". That falls out of the existing predicate rather than a new rule.
The adapter asks the app's `answerIsJapanese` and puts `answerInKana` on
the card, naming the script so a katakana reading does not come out
hiragana; `SkyQuiz` reads that for the box and for its placeholder, and the
transliteration itself is handed in like the grader (`typing.ts` over
`@/lib/romaji`), since `src/sky` may not reach into the app. Grading is
untouched: `romajiMatches` folds both sides to hiragana and passes kana
through, so a box that now holds kana grades exactly as it did.

### The deck as a list, not a strip of pips (2026-09-06, SAK-384)

The Quiz's header carried one pip per card. At a couple of dozen that read
as progress; at two hundred (a practice deck) it was three rows of grey
lozenges, and finding a card meant hovering them one at a time for a
title. `QuizQuestions` (`quiz-questions.tsx`) is a foldable list down the
right instead: the number, what the card asks, and its grade once
answered, with the card being asked lit and scrolled into view. It never
spoils a listening card, which reads "Listen" until it is answered.

It slides in from the right rather than taking a column, and the card
slides with it (see SAK-396 below, which reversed the first answer here).
The panel stays mounted so it can slide both ways, and is `inert` while
parked, so nothing in it can be tabbed to or read out. Below `lg` there is
no room for both, so it takes the card's place instead and tapping a row
jumps there and folds it again, which is what the Atlas does with its
entry panel.

The header keeps the count and "End the quiz", and gains "The cards" when
the list is away, in the same outline the other actions wear. The fold is
not remembered across quizzes: that would need the app's storage, which
`src/sky` cannot reach, and a quiz is one sitting.

`useNarrow` came out of `sky-atlas.tsx` into its own file for this, since
two surfaces now ask the same question (part of SAK-369).

### A grammar card rolls a verb again (2026-09-06, SAK-389)

A grammar production card is a fact about a PATTERN, drilled on some verb,
and which verb is a property of the showing rather than of the fact: the
pool prefers one the learner already knows, and when she knows none of it
the pool hands back a filler which every surface then draws in KANA. That
is a standing rule of Sam's, because a card built on 買う measures whether
you can read 買う and not whether you know the pattern.

`grammarVehicleFor` lost its only caller at the cutover, when the old
drill screen was archived. Nothing rolled a vehicle after that, so every
grammar card fell back to the verb baked into the fact, in kanji,
whoever was looking: 待つ, 話す, 食べる, 行く, one per conjugation class,
to a learner who might read none of them.

`quizCards` rolls one again and threads the context through the whole
card: the prompt, the board (a distractor should be this verb's wrong
form, not another verb's), the reveal, and the answer. The verb rides
back in `meta` so the client grades the pattern built on the verb it was
ASKED on, since the answer is recomputed from the vehicle and grading it
against the baked one would mark every right answer wrong. A malformed or
stale one is dropped by the engine's own check, which then grades the
baked showing, so the round trip can only be right or harmless. The deck
keeps a set of the verbs it has used, so two patterns in one sitting do
not both roll およぐ.

### Enter answers a card that has no box (2026-09-06, SAK-385)

A typed card answers itself: its box sits in a form, and Enter there is
that form's implicit submit. A card with no box has no form, so its Enter
reached nothing and a pitch card, a verb pair, a keigo set or an ordering
card all had to be answered by going and clicking Check.

The window takes the key for those, but ONLY when it did not come from the
box, so a typed card is still answered by its own form exactly once. Enter
on a choice that is not yet picked falls through to the button, which
picks it; a second Enter checks it. That is the same two steps the mouse
takes, and the reason for them is unchanged: a pitch clip should be
hearable before the pick is committed.

### The deck is dealt (2026-09-06, SAK-388)

The quiz asked its cards in the order the facts came out of the tables:
the picks in the order they were picked, or what is due in the schedule's
order. That order never varied, so a lesson's three rounds were the same
run three times and the second and third were partly answered from the
rhythm of the first rather than from recall. A retry from the results and
"Run it again" from Sessions re-asked in the order the answers were
recorded in.

`shuffleDeck` deals it. Two things, because a shuffle alone only fixes
one of them: the order is random, and a word's own cards are then moved
apart, since a word's meaning followed by its reading means the second is
answered off the first. The spread trades each card that landed beside
another of its own item for the nearest one that fits both places,
looking ahead first and then back, because a clash in the last two places
has nowhere ahead to go. A deck with nothing else to offer, every card of
one word, keeps them together instead of looping.

It is applied where the deck is built, never inside `quizCards`, so the
cards themselves still come back in the order they were asked for: what
is due is chosen in the schedule's order and cut to the cap FIRST, and
only the order nobody chose is thrown away. Practice was already drawing
at random, but it draws items, and a drawn word's facts came out
together; a deck of "all of them" was not shuffled at all.

The rounds after the first deal again in the browser, from a seeded
generator rather than `Math.random`, so a re-render cannot move the card
out from under whoever is answering it. The first round keeps the order
it arrived in, which is the one the server rendered, so hydration has
nothing to disagree with.

The sample quiz with no picks is the exception and keeps its order: it is
a showcase deck, one card of every kind, and its sequence is chosen.

`seeded` moved out of `sky-stars.ts` into `random.ts` alongside
`shuffled`, since the sky now wants chance for two opposite reasons: a
placement is seeded so it never moves, and a deck is shuffled so it never
repeats.

### The card slides with the list, and stops being cut off (2026-09-06, SAK-396)

Holding the card still while the list opened cost more than it was worth.
The way it was done was to reserve the list's width on BOTH sides of the
card at every width from `lg` up, 480px of the page, so the card never
had to move. Just above the breakpoint that left a 1024px window only
496px for a card whose row wants 470 at its narrowest, and the card body
would not shrink: a flex item keeps its content's own minimum unless it
is told otherwise, so the row overflowed and `overflow-clip` cropped the
help bar off the right edge with no scrollbar and no warning. Plenty of
empty page, a cut-off card.

The card is centred in whatever space is left instead, and moves when the
list does (Sam, 2026-09-06). The room is padding on the box the two share,
so the only thing that moves the card is the same 200ms the list slides
in; an absolutely positioned child sits against the padding box, so the
list itself does not move with the padding. At 1024 the card is now 720px
with the list open, where it was 496.

`min-w-0` on the card body and its box is the other half. It is not
needed at any width the app currently has, since the list only opens from
1024 up and the card fits whole there, but without it the failure is
silent: the row overflows into a clip nobody can scroll. With it a card
too narrow for its row shrinks instead.

The clip itself stays. `overflow-hidden` is still a scroll port, and the
parked list hanging off the right edge made the box scrollable, so the
browser scrolled to it and eased back, carrying the card along.

### The quiz stops shipping the curriculum (2026-09-06, SAK-380)

The Quiz, Practice and Practice's run page each sent about 15 MB of
JavaScript to the browser. Everything else in the Sky sends about half a
megabyte. The production audit measured 19 script chunks, 15.4 MB decoded,
3.5 MB on the wire, first paint at 4.6 seconds against 1.1 elsewhere.

One import did it. Grading happens on the client, deliberately, so an
answer is right or wrong with no round trip; the grader called `checkTyped`,
`checkTyped` is in the engine, and the engine's index reaches every table
the app owns: word definitions at 4.6 MB, the library index at 6.6 MB, the
learn index, the English synonyms, the reading frequencies, the vocabulary,
the grammar corpus. Fifteen megabytes to answer one yes-or-no question.

The answer travels with the card instead. The server already builds every
card, so it also works out what that card accepts and sends it along as an
`AnswerKey`: four rules, because the engine has four and no more. Strict
equality (a kana card asked the other way wants the glyph, and forgiving
romaji there would grade the prompt as the answer). Produce, which is exact
or a romaji spelling when the target is all kana, since あ can be typed "a"
and 生 has no romaji at all. Loose, for English, compared after normalising
case and spacing, carrying the glosses, the curated synonyms and the
gloss's comma and parenthetical slices, all expanded on the server. And
typo, the same English candidates allowed a length-scaled edit distance,
kept apart from loose because a synonym must never be fuzzed.

The key is built where the check lives. Every question type in
`question.ts` now has an `answerKey` sitting directly under its `check`,
and `src/lib/answer-key.test.ts` grades the whole curriculum through both:
every fact, both directions, a battery of answers built from the fact
itself, plus the rolled showings the Sky actually sends (a counting card's
count, a grammar card's verb, a word's sense). Over 100,000 gradings, and
a single disagreement fails the test naming the fact and the answer that
split them. That is what makes two implementations of one decision safe.

Two things moved to make it possible. The English matcher's deterministic
layers came out of `en-match.ts` into `en-text.ts`, which has no data
behind it, leaving the 3.2 MB synonym pool with `matchesEnglish` where it
belongs; the browser gets the layers and the expanded strings, never the
pool. And `normalizeDigits` moved to `answer-key.ts`, where the rule that
uses it lives.

| route | before | after |
| --- | --- | --- |
| /quiz | 14.83 MB | 0.54 MB |
| /practice | 14.83 MB | 0.55 MB |
| /practice/run | 14.83 MB | 0.55 MB |

Their budgets in `scripts/route_sizes.mjs` came down from 16 MB to 1.5, in
line with every other page, so a table finding its way back into the
browser fails CI. When it does, `node scripts/import_path.mjs <file>
src/data` prints the shortest chain of imports that dragged it in. That
script stops at a `"use server"` module by default, because the browser
gets a call there and not the code, which is the difference between asking
what a file mentions and asking what a learner downloads.

Two things the audit also asked about came back clean. `HearButton`, which
is in every Sky page, reaches 33 files and 0.25 MB of source with no table
among them. Settings was fixed earlier by SAK-366 and stayed at 0.48 MB.

### The home stops sending the sky (2026-09-06, SAK-381)

The home sent every star it could draw on every request. For the sample
learner that was 2.2 MB; for someone who had never opened the app it was
the same 2.2 MB, because their sky is empty and they still got the whole
curriculum. Fifteen thousand three hundred and eighty items, and between
any two learners the only thing that differed was one word per item.

So the items go out once, as a CATALOGUE: every star this build could
hold, without its standing, at `/api/sky-catalogue/<version>`. The version
is a hash of the contents, so it is served `immutable` and a repeat visit
makes no request at all, not even a revalidation. It is prerendered by
`generateStaticParams`, so in production it is a file on the CDN and no
function runs for it.

What a learner gets is the difference: the standings that are not
"not-seen", the constellations, the mix-ups, the discovery rows, and two
short lists where their sky and the catalogue disagree. `joinSky` puts the
two back together in the browser and hands `SkyHome` exactly the
`SkyHomeData` it always took, so nothing in `src/sky` knows any of this
happened.

| | before | after |
| --- | --- | --- |
| a learner with a history | 2202 KB | 28 KB |
| a learner who has never opened it | 2201 KB | 1 KB |
| the home's own HTML response | about 2.2 MB | 49 KB |

The catalogue is 2.3 MB, 443 KB compressed, once per browser per build.
The page starts it downloading with `preload` rather than after hydration,
and it knows the version without knowing whose sky it is, since the
version is the same for everybody.

Two things make this safe rather than merely fast.

The catalogue is built by running the real pipeline against an empty
history, not by a second implementation of it. `skyCatalogue` calls the
same `skyFromHistory` the home calls, given nobody, so a star cannot be
shaped one way there and another way on a learner's own sky.

And there is an escape hatch, because that is not quite enough on its own:
the Observatory offers things by what has been met, and offering an entry
can change its kind, so a learner's sky can hold an item the empty one
does not, or hold one differently. `splitSky` compares each item against
the catalogue and sends anything that does not match exactly, whole, as
`extras`. Today there are none for any learner tested; correctness never
depends on there being none.

`sky-payload.test.ts` builds the sky the old way for three learners,
splits it, joins it, and asserts the result is the same sky. `items` is
compared as a map rather than a list, because the catalogue's order is its
own and a learner's tail is theirs; the order is not read on the home,
which is proved rather than assumed by building the prerequisite graph
from both and walking every constellation the sky shows, star for star.
`roots` and `firmament`, whose order IS read, are compared exactly.

One thing deliberately not sent: the roots. The firmament never holds a
root, so `joinSky` takes them out itself instead of the payload listing
598 ids twice.

The Atlas had the same shape of problem and got the same answer. It sent
630 KB on every request, of which 2,815 tiles and ten shelves of section
lists were identical for everybody; the only things that differed were
each tile's standing and each shelf's counts. Its catalogue is at
`/api/atlas-catalogue/<version>`, 570 KB and 133 KB compressed.

| | before | after |
| --- | --- | --- |
| the home, a learner with a history | 2202 KB | 28 KB |
| the home, a learner with nothing | 2201 KB | 1 KB |
| the home's HTML response | about 2.2 MB | 49 KB |
| the Atlas, a learner with a history | 630 KB | 10 KB |
| the Atlas, a learner with nothing | 630 KB | 0.1 KB |
| the Atlas's HTML response | about 630 KB | 31 KB |

Three pieces are shared rather than written twice. `item-split.ts` holds
the item half, which is the same question on both surfaces: which
standings are not the default, and which items the catalogue does not have
exactly. `catalogue-version.ts` names a catalogue by hashing it, which is
what makes `immutable` honest. `use-catalogue.ts` is the fetch, held once
per tab so a second visit to a page in one session does not go back even
as far as the browser cache, and so two mounts in the same tick share one
request.

### The first request after a rest (2026-09-06, SAK-382)

The first hit on a data-heavy route after an idle period took 3 to 4
seconds in production, and about 1.3 seconds locally. The audit put it down
to the function loading about 30 MB of JSON before it could answer
anything. That was not it. The JSON parses in single-digit milliseconds;
Node's JSON module import is fast. It was one line.

`READINGS_BY_ANCHOR` in `src/data/kanji.ts` groups a kanji's readings by
the word they are learned in. It collected its keys and then filtered the
whole of `READINGS` once per key: about three thousand passes over three
thousand rows, ten million string builds and comparisons, all at module
level, so every cold start paid it before the app could answer anything at
all. One grouping pass gives the same keys in the same order with the same
rows in each.

| | before | after |
| --- | --- | --- |
| loading `@/lib/facts` | 993 ms | 306 ms |
| a cold `/practice`'s modules | 1268 ms | 607 ms |

What is left is real work: 193 ms to build fourteen thousand vocabulary
rows and their senses, 205 ms for the library and learn indexes, and the
rest spread thin across fifty imports. Nothing else on the cold path has a
shape like this one.

The card's other three suggestions did not survive being looked at.

Making the reading pages static cannot work while the shell asks who is
looking. Both layouts await `currentUserId()`, which reads a cookie, and a
dynamic layout takes the whole route with it, which is why `/about` and
`/how-it-works` build as dynamic without ever declaring it. Moving the
answer to the browser would trade a hundred milliseconds on two low-traffic
pages for a flash of "Sign in" on every page in the app. Partial
prerendering is the real answer there, and it is a decision about the whole
app rather than about these two pages.

Precomputing `practiceCollections()` at build time saves 21 milliseconds:
it was 1.1 seconds in the audit because the measurement included the module
load above.

Splitting what a cold function loads turned out to be mostly done already.
`node scripts/import_path.mjs` says the reading pages, Settings and Account
never reach `@/lib/facts` at all, and what the heavy routes do reach, they
use. The 3.1 MB synonym pool is on the practice route's server path because
grading needs it, which is right; it stopped being in the browser under
SAK-380.

### Asking the server where its time went (2026-09-06, SAK-382)

Sam, signed in, timed a switch from Sessions to the Atlas at 2400 ms, on a
warm deploy, against the 240 to 360 ms I had measured with curl. Both
numbers were right. curl asks for the document; signed in, the document IS
the work. Her first request had a 231 ms time to first byte and took
1167 ms, so the server sent the shell and then spent about 936 ms before it
finished the response.

Which of the things inside that 936 ms is the expensive one cannot be
answered from a laptop. The function is not this machine, and signed out,
with no database involved at all, work that takes 58 ms here took about a
second there.

So the response says. Two halves, because Next gives a page no way to set a
response header:

* The proxy runs before rendering and can set one, so what it does goes out
  as a real `Server-Timing` header and appears under Timing in the network
  panel with no tooling. It calls `supabase.auth.getUser()` on every matched
  request, which is a network round trip to Supabase's auth server. SAK-202
  replaced that same call in `auth.ts` with `getClaims()`, which verifies
  the token locally, and priced the network one at about 1.2 seconds in that
  file's own comment. The proxy was left as it was. Whether it is really
  costing that is now a number rather than a suspicion.
* A page measures its own phases (`seeds`, `history`, `settings` for the
  database reads, `sky` or `atlas` for the build) and renders them as a
  `<meta name="server-timing">` in the same format. React hoists it into the
  head, so it arrives with the stream.

`timed` and `timedSync` write into a list scoped to the request with React's
`cache`, so a layout and the page inside it report into one place.

The other thing that came out of reading this path: a signed-in request
reads the same `progress` row more than once and never memoises it. The
root layout selects `history, settings, session, lists`; the page then
selects `history` from the same row; the home selects `settings` on top of
that. `sessionUserId` next door is wrapped in `cache` and these are not.
The header will say whether that is worth fixing before anything else.

Two things it is NOT, both measured on production rather than assumed: the
catalogues, served from cache in 5 ms, and the join that puts them back
together, 1 ms for the Atlas and 4 ms for the sky over 15,380 items.
