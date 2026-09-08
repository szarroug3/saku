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

`/dev/sky`: a gallery of every Sky component, one page per primitive.
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

### Building a page three times over (2026-09-06, SAK-382)

The header answered the question. Sam's 1778 ms Atlas response was 111 ms
refreshing the session, 755 ms reading her history and 737 ms building the
page. So the auth round trip I had suspected, on the strength of that 1.2 s
comment in auth.ts, was not it at all: it costs a tenth of a second.

Three things were being redone that had already been done.

`standingFor` was asked for every entry's standing three times a request:
once by the offerings pass deciding whether the learner had met it, again
when that pass built the item, and a third time in each shelf's counts. It
walks every fact of an entry and does date arithmetic on each. It is held
against the history object now, so it lives exactly as long as the request
that read that history and can never be shared between two learners; the
clock is part of the key, because a standing decays.

`all(kind)` filters thousands of entries to drop the twins, and
`shelfSections` works out the cuts a shelf is divided into. Neither looks at
a learner. Both were recomputed per shelf per request, and between them they
were 28 ms of a 58 ms build. Both are held for the life of the process now,
which is what they should always have been: they are functions of the
shipped tables.

| | before | after |
| --- | --- | --- |
| building the Atlas | 59 ms | 32 ms |
| building the home | 52 ms | 47 ms |

Locally, on the sample learner. On the function, where the same work took
twelve times as long, the saving should be the same share of a much bigger
number.

The 755 ms is not answered yet, only made answerable. That one measurement
covered making a database client, a query over the network, and normalising
a whole record. Those want different fixes, so they report separately now:
`db:client`, `db:query` and `db:normalise`, and the same for the shell's own
read of the row.

### Two round trips where one would do (2026-09-06, SAK-382)

The split header answered the 755 ms. On a cold function it read
`db:client 0.0, db:query 1240.5, db:normalise 309.5`. Making the client is
free. The rest is the database, twice.

`readHistoryRow` selected the learner's row, and then, buried inside
normalising what came back, called `readFactsTable`: a second query to a
second table, one after the other. Nothing in the second depends on the
first: the facts table is keyed by the learner, not by anything in the row.
They run together now, and `normalizeHistory` split into `shapeHistory`,
which takes the facts it needs rather than fetching them. The shell's read
of the same row got the same treatment.

That takes one round trip off every page a signed-in learner opens. It does
not make the round trip that remains any faster, and 1240 ms for one row by
primary key is not a query problem. It is distance, so the proxy's header
now names the region the function is running in, to be read against the one
on Supabase's project settings page.

The other thing the trace showed is that a slow response and a cold function
look identical from outside and want opposite fixes, so a page reports
whether it was the first request its process served.

That flag was called `boot` at first, on the assumption that a process
starts when a request arrives, so its age at the first request is what
booting cost. Fluid Compute breaks the assumption: it holds processes ready,
and the deployed app duly reported a first request 114 seconds into its
process's life, having waited for none of it. It is `first` now, and it is a
flag rather than a cost: what it still tells you is whether a request was the
one that paid for anything the modules do lazily.

Measured after the parallel read went out, on a first-request-of-its-process
Atlas load:

| phase | ms |
| --- | --- |
| `session`, the auth refresh, cross-country and cold | 660 |
| `db:query` and `db:facts`, now at the same time | 499 and 395 |
| `history`, the two of them together plus shaping | 507 |
| `atlas`, building the page | 577 |

`history` at 507 against its parts adding to 901 is the parallel read
working: the two queries overlap now instead of queueing. The same request's
second visit to the server put `session` at 96 ms rather than 660, which is
the connection being warm.

### Building a payload nobody asked to be built (2026-09-06, SAK-382)

Portland took the database from 1550 ms to 115, which left building the page
as the biggest thing in a response by five times over: 643 ms on the
function against 115 for both queries together.

Almost all of it was waste, and waste this round created.
`splitAtlas(atlasFromHistory(h))` builds 2,815 tiles and ten shelves of
section lists and then throws every one of them away, because the catalogue
already holds them and the only thing a learner changes is the standings and
the counts. The split was written as a diff against a thing that, once the
catalogue existed, no longer needed building at all.

`atlasPayloadFor` asks the catalogue what it holds and works out only what a
learner changes about it: 40.4 ms becomes 6.2 ms. `atlasFromHistory` stays,
because it is what builds the catalogue in the first place and what the
tiles and sections lookups use.

The one thing the direct route cannot discover for itself is that it needed
no `extras`, since it never builds a tile to compare against the catalogue.
So the test runs both routes over three learners and asserts they agree
exactly, `extras` included.

The home has the same shape of waste and has not been fixed. It builds
15,380 items and then spends 21 ms of a 54 ms build comparing them against
the catalogue to find out that all of them matched. Its roots genuinely need
the graph, and the graph is learner-independent and could be built once from
the catalogue, so the same treatment should work. It is a larger job than
the Atlas was, because what is "met" for the counters, grammar and keigo
comes through the Observatory's offerings rather than straight off an entry.

Tried and reverted: comparing items field by field instead of writing both
out and comparing the text. It reads better and is not order-dependent, and
it measured 56.5 ms against 54. Filtering the keys of fifteen thousand
objects allocates more than `JSON.stringify` costs. Left as it was.

### Lazy was the wrong instinct here (2026-09-06, SAK-382)

An Atlas payload takes 7 ms to work out. On the deployed app it took 554 ms,
and the trace said why: `first`, the request was the first its process had
served. It was building the catalogue inside her request.

Every memo added this round was lazy, which is the usual instinct and the
wrong one under Fluid Compute. A process is held ready before a request
arrives (the same trace showed one alive for 8.5 seconds having served
nothing), so work done as a module loads is done in that idle time and costs
the request nothing, while work left until first use is paid for by whoever
knocks first. A process that is never warmed pays the same either way, so
building eagerly is free at worst.

Both catalogues are built as their modules load now. The first payload of a
process went from 76.3 ms to 8.5 ms locally, and building them costs 722 ms
of module evaluation that a warmed process does before anyone is waiting.

The same reasoning applies to the other memos from this round (`all`,
`shelfSections`, the standings), but they are all populated as a side effect
of building the catalogues, so they come warm for free.

### Two answers that have nothing to say to each other (2026-09-06, SAK-382)

The eager catalogues took the Atlas from 554 ms to 200 on the deployed
function. The home's trace then showed what was left:

| phase | ms |
| --- | --- |
| `settings`, reading the learner's settings | 336 |
| `history`, the row and the facts table together | 116 |
| `sky`, building the home | 876 |

`settings` was 336 ms of that and it was queued behind nothing and in front
of everything: the page read the settings, waited, and only then called
`loadSky`, which read the history and waited again. Two round trips to the
same database, one after the other, for two answers with nothing to say to
each other. `loadSky` reads both at once now.

`sky` at 876 ms is the same waste the Atlas had and has not been fixed: the
home builds 15,380 items, a graph over them and every root, then keeps the
standings. The Atlas's cure does not transplant directly, because the home's
roots genuinely need the graph, and what counts as met for the counters,
grammar and keigo comes through the Observatory's offerings rather than
straight off an entry. It is the largest number left on the server.

Tried and reverted: memoising `offerings` per request, the way `standingFor`
is. The home calls it once and the new Atlas path does not call it at all,
so it bought nothing measurable, and an unmeasured cache with a subtle
lifetime is worse than none.

### A round of the things that were simply wrong (2026-09-06)

Fourteen cards, mostly found by using the app rather than reading it. Worth
keeping the reasons, since several were one mistake wearing different
clothes.

**Data loss.** Practice pushed its saved recipes and its misses together
whenever either changed, and the merge replaced the pair whole, so a laptop
renaming a recipe carried its own stale misses over a phone's. Each half is
sent on its own now and the misses merge by the larger count, which is safe
only because a miss count never goes down; the comment says so, because if
that changes the merge has to change with it (SAK-377).

**A component declared inside another.** `Row` in Settings was a new
component type on every render, so React remounted the subtree and the field
you were typing in went away under you (SAK-352). The rest of `src/sky` was
swept for the same shape and had none.

**A state that was not a state.** A lesson with nothing to teach was step
zero of zero with a live Next, which indexed past the end of an empty list
and threw. Nothing to teach is its own state now, with a way on instead of a
counter (SAK-351).

**Formatting where the reader is not.** Session times were formatted during
render, so a signed-in page carried the server's timezone into the HTML. A
new `useMounted` says whether this is the browser yet; the instant rides in
`dateTime` from the first byte and the readable form arrives with the reader
(SAK-355).

**Links that were not links.** Every button with an href was a plain anchor,
so Start lesson, Quiz me, Drill and every Back threw the loaded app away and
fetched the page again. On this deployment that is a function, a session
refresh and a database read for something the browser already had (SAK-362).

**Japanese sized by rules that did not know how wide it would be.** The
prompt stepped from 64px to 36 at three characters, so 待つ and 食べる were
half a size apart; a choice longer than its tile wrapped, and Japanese has no
spaces, so the break fell inside the word. Both are fitted now: a character
is about as wide as the type is tall, so the size that fits n of them is the
width over n (SAK-390, SAK-391).

**One string where a list was wanted.** A missed card said "You put" and
showed only the last guess, so missing twice hid the two things you had
confused, which is what the line is for (SAK-387).

**One scroller where two were wanted.** Reading a card's lesson carried the
card, the verdict and Next off the top. The reveal takes what the card leaves
and scrolls inside it now. The first attempt was a max-height that never
engaged, and the test passed anyway, which is why that test now asserts the
reveal has somewhere to scroll before checking the card stayed put (SAK-392).

**Leaving a page to do something that belonged on it.** Keeping a recipe
navigated back to Practice with the recipe in the query, throwing the results
away. It saves in place, through a naming form both screens now share, and a
name that already exists says "Replace" rather than overwriting in silence,
which the Practice page had been doing all along (SAK-395).

**Guessing where you came from.** The results and the rest screen offered
"Back to the observatory" whatever had sent you, telling practice apart by
looking for the word in the href. Whoever links to a quiz says so, and the
route turns that into a way back with a name on it (SAK-353). The Atlas had
the same shape of problem: `?entry=` opened the panel but left the shelf on
Kana (SAK-354).

**A frame that knew better than its contents.** The loading state was a line
on an empty wash, so the whole page appeared at once when the data landed; it
wears its own heading now (SAK-356). A panel's footer was two fixed columns,
so one button sat beside a hole (SAK-360).

**Asking the same question twice, and marking a right answer wrong.** 九 is
きゅう and く, both nine, and it came up as four cards: two readings each
refusing the other, and the same meaning question twice. The rule for when
two readings are interchangeable was already in the engine, in
`wordReadingCredit`: their senses overlap. A deck keeps one card per question
now rather than one per fact that asks it, and 日 is untouched, because ひ is
a day and にち is Sunday (SAK-393).

### The home gets the Atlas's cure (2026-09-07, SAK-382)

The home's `sky` phase was 876 ms on the deployed function, the largest
number left on the server after everything else this round. It was the same
waste the Atlas had: build all 15,380 items, a graph over them and every
root, then keep the standings.

`skyPayloadFor` works the payload out directly. What is the same for every
learner is done once as the module loads, which under Fluid Compute is
before anyone is waiting: the graph, which reads only ids and components;
the ids the sky holds before a learner has done anything; and the firmament
of the five kinds. Per request it works out only what a learner changes:
which stars they have met, how each is going, which constellations are
theirs, and what the Observatory adds on top.

| | built then thrown away | worked out |
| --- | --- | --- |
| the home | 58 ms | 26 ms |

Less than the Atlas's 40 to 6, and honestly so: what remains is real. Eight
milliseconds asking every entry how it is going, twelve for `beyondWords`,
which has to build the Observatory's offerings to know which counters,
patterns and keigo sets are met, and six for the discovery rows and the
legend's counts. The offerings are the obvious next cut and the least safe
one, since which entries are offered is exactly the learner-dependent
question this whole split exists to answer carefully.

The rules are `skyFromHistory`'s restated, which is the risk, so the test
runs both over three learners and asserts the payloads agree exactly and in
order, `extras` included. They did on the first attempt, roots and all,
because the direct route iterates the catalogue in the same order
`skyItems` inserts.

Tried and reverted: memoising `subjectTally`, which the discovery rows and
the standing counts both call over the same subjects. One millisecond.

### Twenty requests nobody asked for (2026-09-07, SAK-382)

One load of the home on the deployed app fired twenty prefetches: the bar's
nine links, each twice over, plus two from somewhere else. Between them,
23 seconds of server time, and four of them over three and a half seconds,
because they were waking every cold function in the app at once. Then a
click on one of those links fetched the page again, exactly as if none of
it had happened.

That last part is the whole finding. Every Sky route is dynamic, so a
prefetch cannot carry the page; it can only carry the layout, which here is
nothing, since the layout is dynamic too. A prefetch that carries nothing is
a function call, a session refresh and a database read for no one, and it
competes with the request the learner actually made. So nothing in the Sky
prefetches now: not the bar, and not a button that is a link.

The two from somewhere else were the old app's `QuizSessionProvider`, still
mounted by the root layout, warming `/session` and `/quiz` on every page for
a Start button the Sky does not have. `/session` no longer exists, so that
one had been fetching a 404 from a function on every page load since the
archive was removed.

An e2e test loads the home and asserts no request carries a prefetch header.

### Fifteen thousand items to send four hundred (2026-09-07, SAK-382)

The Practice page was the one page with no timings on it, and the local
probe put its whole server time at 111 ms with nothing to account for it.
It had two things wrong, and the second turned out to be everywhere.

The first: `resolve` built every item the recipe matched. The empty recipe
matches the whole pool, fifteen thousand entries, and the preview sends
four hundred of them. For each of the fifteen thousand it asked `askOf` of
every fact (thirty thousand regular expressions per request, for an answer
that depends on the fact alone), then had the Observatory build the item,
then spread it to drop its components, and then sorted the lot. Now the
asks are worked out once per entry and kept, since they depend on the
shipped tables and not the learner; the pool is a list of candidates, an
entry with its misses and its facts; and the items are built for the slice
the preview sends or the deck draws. A deck of cards never builds an item at
all, since a card wants the facts. 44 ms became 19 on the empty recipe, and
10 became 1.6 on a recipe that keeps only kanji readings.

The second: `offerings()` was how every adapter got hold of `offerPick`,
and `offerings()` builds the whole sky and walks every section of the
Observatory before it hands that function back. Eleven milliseconds, for a
Sessions page that wants twenty items, an Atlas card that wants one, a
`beyondWords` that wants the counters and the grammar. So the ways of
offering are apart from the sections now (`picker`), over a sky that starts
empty, and `offerPicker` hands out just that. The picks only the Observatory
itself builds, a kana row or the 〜つ rule, have no library entry; asked for
one, the picker builds the Observatory after all and takes its items in, so
every id answers as it did. `beyondWords` went from 24 ms to under one,
Sessions from 14 to nothing, an Atlas card from 14 to under one, and a
streamed shelf's cuts from 30 to 7, those last by not building an item just
to read its id off it (`hasOffer`).

Two smaller ones on the home. The legend's counts were a second tally of
every fact that the discovery rows had already tallied; they are the sum of
the rows now. And a fact the history has nothing on was still put through
the date arithmetic before coming back "not-seen"; it is skipped. The home's
payload is 22 ms from 37, the Atlas's about the same as before.

None of this changes an answer, and each piece was held against the
previous version over the sample learner and an empty one before it stayed:
the home and Atlas payloads, 84 asks for a shelf's cuts, searches, cards,
tiles, sessions, and the preview and draw of five recipes. Two of those
checks are tests now: the picker offers every drawable entry exactly as the
Observatory does, and a preview's items count what its pool counted.

The Practice pages carry the timing meta now too, with a `practice` phase.

### Sorting twelve thousand words to pick sixteen (2026-09-07, SAK-382)

With the Practice page's meta in place, the run page was the slowest thing
left: 39 ms dealing a deck of nineteen cards, and 2 ms of every card was
the word question's distractors. A word's distractors are its neighbours
in rank, nearest first, and the way to find them was to filter and sort
the whole vocabulary around the word, for every card. The vocabulary is in
rank order once now, and the neighbours are found by walking out from the
word's place in it, both ways at once, taking each distance's words as a
group in the order the sort would have put them (length alike first, then
the table's own order). 2 ms a card became 0.01, and the deck 59 ms to 19.

The walk has to give exactly the order the sort gave, tie-breaks and all,
or the boards change under a learner for no reason. A test keeps the old
sort as the reference and holds the two to the same answer on every 37th
word of the vocabulary and both ends of the rank order, both kinds of fact,
about six hundred facts.

### Walking the history, not the library (2026-09-07, SAK-382)

With a copy of Sam's account on a test user, the function's own numbers
for the pages, split into parts: the sky's standings 51 to 83 ms, its
discovery rows 89 to 118, the Atlas's counts 38 to 70, practice's resolve
78 to 117. On a laptop those are 9, 9, 5 and 15. And they fall pass over
pass on the same process (the sky 264, then 221, then 159), which is V8
warming up: a process on Vercel serves a handful of requests, so the code
runs mostly interpreted, five to ten times slower than a benchmark that
warmed up first. There is no making that faster. There is only doing less.

Every one of those phases walked the whole library to find what the
learner had touched: fifteen thousand entries asked for their standing so
that a few hundred could answer anything but "not-seen". Sam's history,
years in, touches 227 facts. So the history is walked instead: the facts
it has anything on (answered, claimed, or opened), and from each the
entries that read it, from `knownFactsOf` turned around over the library
once (`touchedFacts`, `touchedEntries`). The home's standings, the
Atlas's standings and shelf counts, and the discovery rows' tallies go over
those, with the rest counted as "not-seen" without being asked. The
standings come out in the catalogue's order still, sorted into it, because
the roots come out in the order the met items went in.

A learner who has touched most of the library (a big synthetic one; one
day a real one) is walked the old way, over the catalogue and the
subjects, since sorting most of it costs more than walking it (`sparse`).
Both ways were held to the same answer, standings and roots in the same
order, on six learners from empty to seventeen thousand facts. On Sam's
copy the sky payload went from 42 ms to 7 and the Atlas's from 10 to 0.5,
on the laptop; the function's numbers are the ones that matter, and are
on the card.

### A recipe's pool is the same for everyone, nearly (2026-09-07, SAK-382)

Practice's `resolve` was the other phase walking fifteen thousand entries a
request: 78 to 117 ms on the function. A recipe's pool hardly depends on
the learner. Which shelves, which cuts, what was left out, and which asks
are the recipe's; the facts an entry could be asked are the library's. The
learner changes three things: a kanji's reading inside a word is askable
only once a word carrying it has been tested, a fact has misses, and an
entry has a standing.

So the pool is worked out once per shape of recipe and kept for the
process (`baseFor`): the candidates in the shelves' order, the facts the
recipe keeps of each, and which of those are gated on a proof. A request
then applies the learner from the history's side. The tested facts among
the ones the history has anything on open the gated facts they prove
(`provenReadingFacts`, the proof table turned around once), the touched
facts and the run's own misses put misses on the candidates that keep them,
and only the candidates any of that changed are new objects; the rest are
the base's own. The pool is the changed ones with misses sorted to the
front, then everything else as it stands, which is the order the stable
sort gave. A recipe cut by standing still walks every entry, since every
entry has to be asked for its standing and the asks are counted over the
ones that pass.

Held to the old pool on 90 cases (five learners, nine recipes, with and
without a run's misses, preview and draw). On Sam's copy the preview went
from 19 ms to under one on the laptop, on the sample learner from 15 to 3.

### One card for a word that is gone (2026-09-07, SAK-382)

The Sessions page took 62 to 75 ms on the function for 52 sessions, and
0.1 ms on the laptop for the sample learner's four. On a copy of Sam's
history it took 18 ms on the laptop too, and building its 122 distinct
items accounted for 0.2 of them. The rest was one card: a word since
dropped from the library, whose id the picker did not know. The picker
took any id the library did not know for one of the Observatory's own (a
kana row, the 〜つ rule) and built the whole Observatory to answer it, and
answered nothing, as the whole Observatory does for an unknown id. Now
only the Observatory's own ids go to the Observatory, and an unknown id is
nothing straight away. 18 ms to 0.5.

### The same rows, read twice (2026-09-07, SAK-382)

The test account with a big synthetic learner on it (8,264 facts, 400
sessions) showed two things the small one could not. The pages' own work
held: the sky 52 to 87 ms on the function, the Atlas and Practice about
10, Sessions 16 to 40. And two things scaled with the learner that should
not have.

The first: the root layout reads the learner's whole progress to seed the
old app's providers, and the page reads it again for its own payload. Two
round trips each, the facts table twice over, and at that size the facts
table is four megabytes. The two reads are one now, held for the request
with React's `cache`: whichever asks first pays, the other waits on the
same promise. The `history` phase on a page is what was left to wait for.

The second is on its own card (SAK-398): that seed puts the whole history
into every page's HTML, 1.7 megabytes at that size, for providers a
signed-in Sky page never reads. Retiring them is a round of its own.

### What a cold process loads (2026-09-07, SAK-399)

A process's first request took 5.5 to 7 seconds on the function against
600 to 850 warm. Profiled locally with V8's own profiler on a fresh
`next start`: the first request is 745 ms there, about 630 of it reading
and compiling the route's server chunks and 400 evaluating modules (the
vocabulary's three tables 122 ms, the eager catalogue builds 54, the kana
and kanji tables 64, then a long tail). A Sky page's server bundle was
29 MB, 22 of them JSON text the bundler had inlined as `JSON.parse`
literals, so the "ship JSON as JSON" idea on the card was already the
case.

Three of those tables the pages never read at load: `learn-index.json`
(4.4 MB) was there for a version string and the glyph spine, which the
build script now writes to a file of their own (`curriculum-meta.json`);
the dictionary's senses per word (2.3 MB) and the English synonym pool
(2.1 MB) are read from disk the first time a sense or a typed answer asks
for them (`readDataJson`), and ride with the function through the tracing
config. The bundle is 20 MB. Locally the first request did not move, which
says the local cost is not proportional to bytes; the function's is what
the round is for, and a fresh deployment's first request is the
measurement.

`fs` is looked up at run time (`process.getBuiltinModule`) rather than
imported, because a dev page's client bundle reaches `data/vocab.ts` and a
static `node:fs` import there stops the build.

On the function that round bought about a second of the seven, and a
second deployment's cold first request was 6.5 s again, so the bytes are
not where a cold process spends its time there either. The evaluation is.

### The vocabulary, built once (2026-09-07, SAK-399)

`data/vocab.ts` was the biggest evaluator on a cold start: 122 ms on a
laptop, a second or so on the function. It parsed vocab.json, the CEJC
conversation-frequency tables and the shipped senses, then built every one
of 12,555 rows: ordered them by CEJC's teaching rank, chose each word's
sense and reading by its dominant part of speech, and attached its senses.
None of that depends on anything but the tables.

So it is built once now, by `scripts/build-vocab-runtime.mjs`, into
`vocab-runtime.json`: the finished rows, the reading counts, each word's
part-of-speech family (the one piece of the teaching metadata the app
reads), and the legacy readings the old fact ids were minted from. The
building itself moved to `vocab-build.ts`; `vocab.ts` parses the one file
and keeps every function it had. A row whose only sense is the row itself
(12,435 of them) is written without it and gets it back at load, which
halves the file: 3.6 MB replacing the 6 MB of vocab.json and the CEJC
table, which nothing else read at run time. 23 ms to parse.

The rows came out byte-identical to what the old module built, checked
row by row. A test holds the shipped file to what the builder produces, so
a change to any source table without rerunning the script fails there.

Also that day: the proxy's session refresh went from `getUser()`, a round
trip to the auth server on every request, to `getClaims()`, which verifies
the token locally and refreshes only on expiry. On the function the
`session` phase went from 80 to 130 ms to 1 to 32.

### The catalogues, built once too (2026-09-07, SAK-399)

The sky's and the Atlas's catalogues (SAK-381) were built as their modules
loaded, on the theory written into their comments: a held-ready process
would do it before any request arrived. On the function the route's
modules load with the first request, so the first request paid for
running both pipelines over an empty history, 75 ms on a laptop and most
of a second there. They are the same for everyone per curriculum version,
which is what made them catalogues in the first place, so
`scripts/build-catalogues.mjs` runs the same builders once
(`catalogue-build.ts`) and writes `sky-catalogue.json` (1.8 MB),
`atlas-catalogue.json` (0.5 MB) and the server's own `sky-catalogue-base.json`
(the ids every sky starts with and the firmament of the five kinds). The
modules parse those. Versions came out identical to the ones the deployed
app was serving, and a test holds each file to its builder.

### Where the bytes are, and a clock that starts at the edge (2026-09-07, SAK-399)

The three rounds took a Sky page's server bundle from 29 MB to 19 and a
laptop's cold first request from 745 ms to 700, and the function's cold
first request stayed where it was: 6.0 s, against 6.5 and 5.8 on the two
deployments before. Reading the bundle back through its source maps says
why the code-side ideas would not help either: of the 17.7 MB the home
page loads, 16 are the JSON tables under `src/data/generated` and about
1.7 are code, the old app's included. So the old app is not the cold
start, and neither, apparently, are the bytes, since nine of them left
without a trace.

What is left to measure is the one span nothing inside the modules can
time: from the request arriving to the first line of the page's own code
running, which on a cold process is the load of every module the route
needs. The proxy now stamps each request with the time it reached the
edge (`x-edge-at`), and the page's meta reports `edge-to-page`, the gap
to its render. Warm, that is routing; cold, it is the cold start itself,
finally as a number of its own rather than a total minus everything else.

`getStatsRows` also moved out of `server-lookups.ts` into `stats-rows.ts`
on the way: the home imported 1,392 lines of the old app's `/learn` and
`/library` actions, and through one of them a lesson React component, for
the discovery panel's rows. The tracer no longer finds a path from the
home to either.

Read from the top of the root layout's render (the meta renders last and
was counting everything the page awaited), the first cold reading said
something the totals never had: a fresh process on a deployment already
running answered its first request in 2.7 s, 725 ms of it `edge-to-page`,
about what a laptop takes to load the same modules. The 5 to 7 second
colds were all measured on the first process of a new deployment, which
is a new instance fetching the bundle onto its disk before it can load
anything. Two kinds of cold, then: a fresh instance, after a deploy or a
long idle, and a fresh process on an instance that has the files. A
keep-warm ping is aimed at the first kind, and the idle window it needs
is what the probe in the scratchpad is bisecting.

### The words' facts, built once as well (2026-09-07, SAK-399)

With the rows baked, `vocab.ts` still took 109 ms to load on a laptop, 98
of them building the words' fact registry: every word segmented into its
reading units, which reads the dictionary's definitions for all 12,555
(so the lazy definitions file was being read at load after all). The
units differ from "the row's own reading and glosses" for 120 words. The
builder works those 120 out and writes them; `readingUnits` looks a word
up and answers the trivial unit for the rest; the facts follow from the
units in a millisecond. 23 ms to load now, the facts and every fact's
unit byte-identical to before, checked against a dump of the old module.

### Two more tables read when asked (2026-09-07, SAK-399)

The kanji etymology table (0.9 MB) and the grammar corpus (1.5 MB) were
in every Sky page's bundle because the library's entries import the
modules that own them, and neither is read at load: an origin is asked
for on a kanji's card, a pattern's examples on a grammar card. They are
read from disk on first use now, the way the dictionary's senses and the
synonym pool already are, and `CORPUS` became `corpus()` for its four
readers. Both leave the bundle; the entry model that drags their modules
in at all is SAK-400.

### The history leaves the HTML (2026-09-07, SAK-398)

The root layout read the learner's whole progress and put it in every
page's HTML to seed the old app's providers: the history for
`HistoryProvider`, the in-progress run for `QuizSessionProvider` (2,230
lines, mounted on every page), the lists for `ListsProvider`. A signed-in
Sky page reads the progress on the server and renders from it, so for a
signed-in learner every one of those was a copy nobody read, hydrated on
every page and growing with the learner: 1.7 MB of HTML for the big
synthetic one. The Sky's own client code, checked hook by hook, reads
`useQuizConfig` (which sits on the settings) and, signed out, `useHistory`
for the browser's own standings. Nothing else.

So the layout seeds the settings and nothing more; the session and lists
providers and the old save-status strip are gone from it; and
`HistoryProvider` has a page-owned mode for a signed-in learner, in which
it neither seeds nor fetches nor refreshes, and sits loaded and empty for
the one thing still under it that asks, the sign-in merge, which now
re-renders the page it ran on so the merged progress shows. Signed out,
nothing changed: the browser's own history is read there as before.

What is not done here: the providers' files and the old app's remaining
19,000 lines are still in the tree, and the settings' save errors, which
the removed strip used to show, have no surface in the Sky yet.

### Three files nothing imports, and one wrapper (2026-09-07, SAK-398)

With the layout no longer mounting them, `quiz-session.tsx` (2,230 lines
of the old app's quiz), `lists-provider.tsx` and `save-status.tsx` had no
importer left but each other; they are gone. What mentions them now is
comments, which is where they belong.

And from the components review: five screens carried the same page-body
class string, two with the reading width. `SkyPageBody` is that column,
with `width="reading"` for the quiz and its results, so a change to how a
page scrolls is a change in one place.

### The Atlas's streaming, apart from its layout (2026-09-07, from the review)

The Atlas component carried the Words shelf's streaming inline: which
cuts had been fetched for which standing, which tiles were being fetched,
the effect that asked the server. `useStreamedShelf` holds that now and
hands the component `streamedCuts`, `streamKey` and `fetchTiles`; the
component is layout again. No behaviour changed; the e2e that scrolls a
streamed shelf holds it.

### The verdict and the hint, apart from the quiz screen (2026-09-07, from the review)

The quiz screen rendered an answered card's verdict, the answer and the
list of what was said inline, and the hint surface too. `QuizVerdict` and
`QuizHint` hold those now (`quiz-verdict.tsx`); the screen is the card,
its bar and the way on. No behaviour changed; the e2e that reads the said
list and the reveal holds it. The audio button stays where it is: it
needs the speech and quiz-config libraries, which `src/sky` may not
import, and the route layer hands it in as a prop, which is right.

### The dev galleries and the old app go (2026-09-07, SAK-398)

The `/dev` galleries were the last thing rendering the old app's
components; Sam does not use them. `scripts/unreachable.mjs` walks every
`import` from what still counts as an entry point (the app's routes, the
root layout, the proxy, the scripts, the e2e specs, and every test whose
subject the app still reaches) and lists what nothing reaches. With the
galleries gone that was 84 files and 15,400 lines: the galleries, 48 old
components (the library views, the lesson views, the old quiz), and the
old sync and lesson libraries under `src/lib`. Deleted. What is left of
`src/components` is what the Sky's route layer still hands in as props
(the audio button, tooltips, the sign-in merge) and the content builders
the scripts run.

The rule that decided tests: a test goes only when the module beside it
goes; every other test stays and keeps whatever it imports, which is how
a helper only tests use survives.

### A map nobody read (2026-09-07, SAK-399)

`library-index.json` carried `factEntry`, every fact's entry id, 1.1 MB
of the 5.3 the index weighed in every server bundle. Nothing read it: its
one reader outside the index module was the old app's actions, and the
index's own equivalence test had been proving for months that it agreed
with `entryOf`, the live function, on every fact. The old actions call
`entryOf` now, the map is no longer written, and the index is 5.0 MB on
disk from 6.4.

### One source for the entries (2026-09-07, SAK-400)

The app had two sources for its entries. `entries.ts` built all 15,553 as
it loaded, walking every subject's tables; `library-index.json` carried the
same entries, minted by that same walk at build time, and the index loader
read those. Twenty-three modules read the first and ten the second, and the
loader's own header explained that it existed to avoid the first. The two
agreed field for field, which the index's equivalence test had been proving
for months. What they were was a second copy waiting to drift.

The walk is `buildEntries` in `entries-build.ts` now, and nothing a page
serves imports it. `scripts/build-library-index.mjs` runs it and writes the
file; `entries.ts` reads the file and is the model: `LIB_ENTRIES`, the
buckets by kind, `libEntry`, and one `knownFactsOf`, which reads back the
answer the per-kind rule wrote into the index. The rule itself,
`knownFactsRule`, moved with the build. The loader re-exports the model
instead of re-declaring it and keeps the smaller tables it always added.
The rebuilt index is byte-identical to the committed one.

Checked before and after, over the code paths a page uses: every entry,
the buckets, `libEntry` for every id, `entryForGlyph` for 14,597 glyphs on
every kind, `knownFactsOf` for every entry, and the home, Atlas and
practice payloads for the sample learner and an empty one. All identical.
The 3,920 tests pass.

Measured, and worth saying plainly: the walk was cheap. After the fact
registry, `entries.ts` took about 60 ms to load and the loader's parse of
the JSON 30 more; now the parse is in `entries.ts` and the two together
take 85 to 90. So the build itself was 5 to 10 ms of a cold load, and
this round shortens the cold path by about that. What it removes is the
duplicate. The per-import numbers looked like they had found one real
cost, `kanji-parts.ts` at 16 ms, reached through `builtFrom`, which nothing
calls any more; but the import walker reports the shortest chain, and the
production bundle (`scripts/route_sources.mjs`, which reads the build's
source maps) shows every Sky route carries `teach.ts`, which imports the
same module for its own reasons. Deleting `builtFrom` removes dead code,
not milliseconds. `grammar-concepts.ts`, 25 ms, is reached through the
Atlas regardless of this file. The lesson: a walker says what could load a
module, the bundle says what does.

One difference between the two sources was found and kept: `entryForGlyph`
for a word. `entries.ts` answers `wordEntry(keb)` for any VOCAB row; the
loader answers null for the 98 kebs the build skips, the grammar and
counter duplicates (だけ, 一つ, 一人, …), because no entry carries that id.
The Sky reads the first, the shelf and lookup modules the second. Neither
changed, and the loader's doc now names the difference rather than
claiming the two agree.

### The vehicles, built once (2026-09-08, SAK-399)

`vehicles.ts` holds the pool a grammar production question is drilled on,
and it derived the verb half of that pool as it loaded: for each of the
ten regular conjugation classes a filter, a sort and a slice over all
12,555 vocabulary rows, ten passes, to reach 220 vehicles. On the way it
asked the dictionary for each candidate's register, so that an
honorific-only verb never becomes an unlabeled filler, and that read
`word-definitions.json` from disk. A 4.7 MB table meant to be read when
a word card asks for a sense was therefore read by every process on its
first request instead.

Written out the pool is 18.6 KB. `vehicles-build.ts` holds the
derivation, `scripts/build-vehicles.mjs` runs it into
`src/data/generated/vehicles.json`, and `vehicles.ts` reads that file and
keeps live everything that depends on the recipe or the learner:
`vehiclesFor`, `pickVehicle`, `exampleVerb`, `showableWhenUnknown`,
`transitivityOf`. Loading the module with its own dependencies already
imported went from 50 ms to 3 on a laptop, middle of three fresh runs,
and nothing under `src/data/generated` is read at its load any more.

The proof it changed nothing: every export dumped over a fixed input set
before and after, and compared. The four pools, `transitivityOf` over all
12,555 words, and for each of the 114 recipes its worked example, both
recipe predicates over the whole pool, and `vehiclesFor` and a seeded
`pickVehicle` across every host, every known-word gate and every class
and pinned-verb bucket, plus a 40-pick session-dedup run. Byte-identical.
`vehicles.equiv.test.ts` holds the file to the builder from here, the way
`vocab-runtime.test.ts` holds the vocabulary.

The adjective and noun pools stayed where they are. They are ten
hand-written rows that derive from nothing, so there is nothing to bake,
and the prose explaining why いい leads the adjectives belongs beside it.

Route sizes did not move, and were not expected to: `route_sizes.mjs`
measures the JavaScript a visit ships to the browser, and none of this
was ever on the client. This is server load time, which is what a cold
start is made of.

### The last of the old app (2026-09-08, SAK-398)

Four rounds after the history left the HTML, this is what was still in
the tree: `src/components`, twelve files the Sky's routes handed in or
the root layout mounted; `src/lib/content`, which every Sky route's
server bundle carried thirteen modules of; and the old entry page's code,
still exported from `entries.ts` with no caller outside its own tests.

**The settings page says when a save has not landed.** The old app's
save-status banner showed the settings provider's `saveError` with a
retry button, and it went with the layout's strip, leaving the Sky no
surface. The settings page carries it now, above the groups, in the Sky's
own words (`SAVE_TEXT`) rather than the provider's string. `role="status"`,
not `alert`: it is never urgent enough to cut into a screen reader.
Signed out the provider reports null forever, which is right, since there
is no account to save to. There is no test: `src/sky` has no component
test harness, and nothing in the tree renders React in a unit test.

**The entry page's code left `entries.ts`.** The generic facts table
(`factRows`, `factsTitle`, `factsColumnHeader`, `FactRow`, five per-kind
row builders), the kanji "Built from" section (`builtFrom`, `BuiltPiece`,
`builtPieceMeaning`, `madeOf`), `readingRowsOf` and `clusterOf`: 793
lines from 1,414, and twenty-five imports with them. What stays is what a
page still reads, `builtPieceEntryId` included, so the exclusion set still
guards which shape a piece links to.

**The Sky stopped loading the content library.** It read exactly two
things out of those thirteen modules: `derivePosition`, which `teach.ts`
calls to name where a radical variant sits, reached through
`character-entry-content.ts`, whose own imports were what dragged the
library in; and `sentenceTierShortLabel`, three lines that trim a trailing
"sentences" off a tier label. `derivePosition` moved to
`lib/radical-position.ts` (first under `app/(sky)`, moved at review so the library never imports the route layer), `sentenceTierShortLabel` into
`data/assembly.ts` beside the tiers it describes. A lint rule holds it:
nothing under `app/(sky)` or the root layout may import `@/lib/content/*`,
`curriculum-meta` excepted, because the content library is build-time
code, run by the index scripts, read by a page as JSON.

**The components moved into the route layer.** Seven files, `git mv`'d
flat into `app/(sky)`: the audio button, the stroke order and its
why-disclosure, the pitch mark, the two auth components. Two providers
went instead of moving, `ConfirmProvider` and `TooltipProvider`, mounted
on every page with nothing under the Sky asking either for anything, and
`HydrationMarker` with them, its one reader having lost its last caller
when the performance spec went. `src/components` is gone.

Measured off the production build's source maps
(`scripts/route_sources.mjs`, which reads what the bundle actually
carries rather than what a walker says could):

| | before | after |
| --- | --- | --- |
| `lib/content` modules per route | 13 on six of seven | 1 (`curriculum-meta`) |
| `components/` sources per route | 5 to 15 | 0 |
| sources on `/` | 807 | 755 |
| sources on `/atlas` | 873 | 836 |
| `/` client bundle | 0.48 MB, 8 chunks | 0.38 MB, 6 chunks |
| `/atlas` client bundle | 0.52 MB, 9 chunks | 0.44 MB, 7 chunks |
| `/sessions` client bundle | 0.46 MB, 8 chunks | 0.36 MB, 6 chunks |

The client-bundle drop is all step four: the two providers and `ui.tsx`
leaving every page. Steps two and three moved nothing there, and it is
worth saying which round earned which number.

**No load-time win, and the numbers say so.** `teach.ts` loads in about
188 ms before and after; `observatory.ts` in 169 before and 155 after,
against a shared `@/lib/facts` baseline that itself drifted from 220 to
300 ms between the two rounds, so the second is inside the noise. The
content modules were thin over the same data tables the routes load
anyway, and `kanji-parts.ts`, the one module a walker blamed on
`builtFrom`, stays on every route through `teach.ts`. What these rounds
remove is bundle surface and a dependency, not milliseconds. This is the
same lesson SAK-400's section ends on, met again from the other side.

Nothing in `src` is unreachable now: `scripts/unreachable.mjs` reports
zero files, from 84 two rounds ago. Sixteen files and 2,503 lines were
deleted outright this round and seven more moved, 3,671 lines removed
across the four commits; the entry-model dump (every entry, the buckets, `libEntry`,
`entryForGlyph` over 14,597 glyphs, `knownFactsOf`, and the home, Atlas
and practice payloads) is identical before and after every deletion. 3,867
unit tests pass, 26 e2e, and `route_sizes.mjs` passes for the first time
in a while: it still listed a `/dev` route deleted a round earlier.

One thing the round left odd and the review put right:
`lib/library/character-entry-content.ts` imported `derivePosition` from
under `app/(sky)`, a build-time module reaching into the route layer,
because the plan had assumed that file would be deleted and
`scripts/seed-content-entries.mjs` still runs it. The function and its
table live in `lib/radical-position.ts` now, a leaf with no imports of
its own, read by the page and the seed code alike.

### The test account goes (2026-09-08, SAK-397)

A fake email-provider account and a secret way in for it: `/signin/<key>`,
a 404 unless the address matched `EMAIL_SIGNIN_KEY`, showing the account
page with an email and password form under the Google button. The form
only ever signed in; it could not make an account. All of it is gone: the
page, the form, the `onSignInWithPassword` prop that carried it, and the
`.env.example` entry. The Google button is the only way in again.

The reviewing session removed the `EMAIL_SIGNIN_KEY` variable from Vercel
and deleted the account's 8,265 rows on 2026-09-08. The auth user row
itself, under `auth.users`, is Sam's to delete in the Supabase dashboard.

### A gradient that never met a filter (2026-09-08, SAK-383)

The baked wash was 611 KB, the second largest thing on any page, and the
reason was one byte per row. A PNG row carries a filter type, and the bake
wrote 0, none, on all nine hundred of them, so deflate saw absolute pixel
values instead of differences between neighbours. The same pixels with the
Sub filter are 319 KB. Decoded they are byte for byte what they were: the
same colours, the same stops, the same 4x4 dither, the same 1600x900.

Choosing a filter per row, which is what most encoders do, is worse here
and was measured twice: the usual sum-of-absolute heuristic gives 436 KB
and an entropy one 438, because mixing filter types row to row costs
deflate the matches it would otherwise find between one row and the next.
So `png-encode.ts` compresses the whole image five times, once per filter,
and keeps the smallest, which for a script that runs when Sam edits the
knobs costs a few seconds and cannot lose.

The card's other idea did not survive being measured. Lossless WebP is
367 KB and lossless AVIF is 507, both bigger than the filtered PNG: the
dither is about 1.8 bits a pixel of real entropy and no lossless codec
takes it away. "Well under 100 KB" only happens lossy (WebP q90 13 KB,
AVIF q80 8 KB), and lossy takes the dither with it: the longest flat run
in a row goes from a median of 14 pixels to about 110, which is the
banding the bake dithers against. That is the one property of the wash
worth 300 KB, and it is Sam's to spend, not mine.

The other half was the header. Next serves everything in public/ with
`max-age=0`, so a browser could not paint the background without asking
first: a conditional GET and a 304 on every navigation of every page,
which is not what "cached after the first visit" means. The bake now names
the file for its own contents (`wash-baked-<hash>.png`, the trick
`catalogue-version.ts` plays on the catalogues) and rewrites the two rules
that point at it, so `next.config.ts` can serve it `immutable` honestly: a
re-bake is a new URL rather than a stale one.

| | before | after |
| --- | --- | --- |
| the wash on disk | 625,314 bytes | 326,784 |
| its rows' filters | 0, all 900 | 1 (Sub) |
| a repeat visit | a 304 per navigation | nothing |

`npm run bake:sky` had not run since the wash editor's route went (SAK-398
took the last thing that imported it): `sky-stars.ts` imports `./random`,
and plain Node, which is what runs the script, resolves neither the
extension nor the alias. It says `./random.ts` now, the way
`sky-wash-file.ts` already imported it.

### What "loads every page twice" turned out to be (2026-09-08, SAK-383)

It does not. Counted request by request on the e2e production build, a
signed-out navigation is one document and one server action, never two
documents and never an RSC fetch of the page it is already on: `/` is
20,650 bytes and 1,405, `/atlas` 21,439 and 180, `/sessions` 20,998 and
71, `/about` 59,473 and no action at all. The 1.7 MB payload the card
describes went with SAK-381 and SAK-382, and the prefetch half was fixed
in SAK-382 and is held by a test already. What is left is the shell, then
the browser's own history going up and the page's data coming back, which
is what "sign-in preferred, never required" costs. Two e2e tests hold the
shape rather than change it.

One thing the card has backwards, worth writing down because it is still
true: the largest asset on every page is not the wash.
`/brand/saku-wordmark.png` is 973 KB, 1254 by 1254, preloaded in the root
layout, and drawn at 36 by 36 CSS pixels. It is already adaptively
filtered, so there is nothing lossless left in it; only a resize would
help, and it is Sam's artwork rather than a generated file, so it is hers
to decide. `public/brand/saku-mark.png` (877 KB) is reachable from nothing
at all now that the landing page has gone.

### The saved lists go (2026-09-08, SAK-375)

Lists were the old app's way of naming what to drill: a fixed set you
filed things into, or a saved search that re-ran itself. The Sky replaced
them with practice recipes, which live in `settings.practice` and share
none of this code. What was left was the whole line still standing with
nothing on either end of it: `progress.lists`, `/api/lists`, `lists.ts`
and its compare-and-set writer, the pure ops and their membership
helpers, a `saku-local-lists` copy for a signed-out browser, and a replay
of that copy into the account on sign-in.

Seven files, 904 lines, deleted outright. Out of the files that stay:
`SavedList` and `ListsFile` from the types, `postList` / `deleteList`
and their local twins, the six local list writers and `clearLocalLists`,
`replayLists` and the read-back that gated its clear, and
`readListsRow` / `readListsRowVersioned` / `writeListsRowGuarded` from
the store. 1,555 lines gone against 137 added.

Two things went with them that the audit had not named. `Selection.list`,
a field on the query every drill resolves, and with it `factsOfList`, the
`lists` parameter threaded through `resolve`, `countOf`, `dueFacts` and
`whatSentence`, and the `"lists"` member of `PracticeScope`. And
`fixedRunList` in `server-lookups.ts`, which minted a `SavedList` out of
an in-progress run for the old /current page and has had no caller since
that page went. The audit's third claim, that `Selection` itself should
go, is wrong: it is `QuizConfig.selection`, which the Sky's quiz and
settings read on every page. Only its `list` field was list machinery.

The `lists` column stays. Dropping it is a by-hand migration that buys
nothing, and a learner's row keeps whatever it holds rather than having
it thrown away; `schema.sql` now says the column is dead and names the
card. The seed read is `select history, settings, session`, so a page
load stops moving a blob nobody opens.

Nothing a learner sees changes. No Sky page could make, read or name a
list; `app/(sky)/quiz.ts` already called `dueFacts` with an empty lists
array; `postList` had no caller. The one real behaviour change is that a
signed-out browser still holding `saku-local-lists` from the old app
stops replaying it into the dead column on sign-in, and stops clearing
the key, so that copy is left alone rather than deleted. A stored
`selection.list` survives too: `normalizeConfig` spreads the stored
object over the defaults, so the value is carried forward and simply
never read.

3,843 unit tests pass, 1 skipped, from 3,872: the 29 that went were the
list ops', the compare-and-set writer's, the local store's list half and
`fixedRunList`'s. 26 e2e pass. `scripts/unreachable.mjs` still reports
zero files.

### The in-progress run envelope goes (2026-09-08, SAK-376)

The old app could hand a half-answered quiz from one device to another.
The run's cursor, deck position, current question, answers so far, phase
and round, lived in `progress.session` as a small envelope with an id and
a timestamp, posted through `/api/session-state` and reconciled
last-writer-wins under a compare-and-set. Four modules and a route, and
by tonight not one caller: the provider that wrote it went with the old
app, and `ProgressSeedRow.session` was read by nobody.

Six files, 829 lines, deleted: the route, `session-state.ts` and its
test, `session-store.ts`, `session-mutate.ts` and its test. With them,
`readSessionRow` / `readSessionRowVersioned` / `writeSessionRowGuarded`
from the store, `session` off the seed row and off the seed select, which
is `select history, settings` now, and four localStorage keys in
`settings-keys.ts` that nothing had read since the provider went:
`saku-session`, `kanaquiz-session`, `saku-session-sync` and
`saku-current-run-count`. 993 lines gone against 33 added.

The column stays, noted dead in `schema.sql` beside `lists`, and that
note says what it is waiting for. The Sky's quiz keeps its state in
component memory and only the rest between rounds in `sky:quiz:rest`, so
a reload mid-quiz still loses the round and there is no continue
anywhere. Giving it a small envelope of its own is the good half of the
card and it is Sam's to take: it changes what a signed-in learner sees
and what is stored for them, which this pass does not do. Nothing in the
shape it would take depended on the code deleted here.

The card's other note, shrinking `QuizMode` to `drill` and `assembly`,
is not ready. `pairs` and `grid` still have readers (the board-mode
carve-out in `realQuestionCount`, the count-limited-pairs cases in the
deck builder's tests), `listen-sentence` is migrated forward in
`normalizeConfig` for a stored config that still names it, and the type
also describes `QuizSessionRecord.mode`, a field in every session record
a learner already has. Narrowing it would be a claim about their data,
not only about our code.

3,824 unit tests pass, 1 skipped, from 3,843: the 19 that went were the
envelope's own and its compare-and-set writer's. 26 e2e pass. Nothing in
`src` is unreachable.

### A table written on every deploy and read by nobody (2026-09-08, SAK-379)

`content_entries` held a precomputed detail payload per Library entry, so
a detail page could deserialize one instead of pulling the curriculum
dictionary into the browser to rebuild it. The views that read it went
with the old app in SAK-398 and the Atlas builds an entry from the
bundled tables per request, so what was left was a write with no read:
`scripts/seed-content-entries.mjs`, 365 lines, run by a `seed-content`
job in CI on every push to main.

Gone: the script, `lib/library/content-seed-delta.ts` and its test (its
only caller was the script), and the CI job, 39 lines of workflow.
`character-entry-content.ts` stays, because `server-lookups.ts` calls it
per request on the live path, and its header now says so instead of
naming a script that is not there. `scripts/unreachable.mjs` reports zero
files before and after.

The table is noted dead in `schema.sql`, the way `lists` and `session`
were tonight, with one difference said out loud: it holds no learner
data, only content, so unlike those two columns dropping it is free. The
`drop table` is written into the note for Sam and nothing needs it to
run.

The other half of the card was `progress_facts`, whose definition lived
in `scripts/sql/add-progress-facts-table.sql` and not in `schema.sql`, so
nothing in the repo said whether a given database had the table.
`schema.sql` is the one definition now: the table, the index, the four
policies and `clear_legacy_history_facts`, verbatim, with the rollout
note that says to run `backfill-progress-facts.mjs` in the same window.
The four references to the old path are repointed.

**The 42P01 fallback stays, and that is the answer, not a deferral.**
`isUndefinedTable` is the only thing between a missing table and every
signed-in read throwing. Whether production has the table is a question
about production, which this pass may not query. Confirming it is one
line in the SQL editor, and the follow-up is small and named on the card.
Removing a fallback because it looks unused, without checking the thing
it guards against, is how a deploy takes an app down.

Last, a real contradiction the audit found in `HistoryFile.facts`. The
type said the aggregate is derived "entirely" from `sessions`; `sessions`
is capped at 200; `deleteSessions` rebuilds the aggregate by folding the
survivors. All three cannot hold. The code already knew which wins:
`history.ts`'s `deleteSessions` carries a comment about the aggregate
legitimately holding contributions from evicted sessions, which is why it
refuses to rebuild for a delete that selects nothing. The incremental
fold wins, forgetting one session past the cap silently drops what the
evicted ones contributed, and that is the accepted cost of an honest
delete. The type says all of that now.

3,822 unit tests pass, 1 skipped, from 3,824: the two that went were the
seed delta's. 26 e2e pass. The workflow parses and has one job left.

### Every word, every voice, cached ahead (2026-09-08, SAK-402)

Every string the app can speak is supposed to be sitting in Storage
before a learner asks for it, in all six roster voices, so no hear button
ever waits on live synthesis. `scripts/seed-voice-audio.mjs` puts it
there in bulk, one set per shape of string, and its sets are hand
written, so the app growing past them is silent by construction: SAK-216
and SAK-244 were both a whole shape of string nobody noticed was live,
found months after the button that spoke it shipped.

The Sky grew. `scripts/list-speakable.mjs` is the noticing, done by the
machine. It walks the Sky's own teaching code, calling `teachFor` on
every item `offerPick` builds, and collects exactly what the hear buttons
are handed: the head glyph of a kana, word, counter or keigo card, every
on'yomi and kun'yomi row, a kana's mnemonic example word, a verb pair's
and a keigo set's forms, a word's other readings, the quiz's listening
card, and both clips of a pitch card. All speech in the Sky goes through
one button and only two components mount it, so that is the whole
surface. Anything the seed script's sets do not cover is reported by
where it is spoken, and the script exits non-zero. It synthesizes
nothing and uploads nothing, so it is safe to run against production at
any time. `scripts/lib/server-only-shim.mjs` is what lets a plain script
import the Sky's server adapters at all.

It found 102 things the Sky can say that nothing seeded: 22 word
readings, 17 kana mnemonic example words, 3 keigo words, and 60 exact
pitch clips. The pitch ones are the interesting kind. The old `pitch`
set walks what the pitch QUIZ asks, each word at its one legacy reading
plus the quiz's distractor, but a lesson card narrows a word to the
reading it is teaching and then speaks THAT reading at the word's own
downstep, which is a pair the quiz never asks for: 人 at ひと, 七 at なな,
四 at よん.

Four sets cover them, and walk their whole source rather than the gap,
so the next word read two ways cannot open a new one: `word-readings`
(11,543 items), `mnemonic-words` (92), `keigo` (28) and `lesson-pitch`
(8,117). `pitchSet` is the pitch-shaped twin of the existing `textSet`
factory, so the second pitch set is a list of pairs and nothing else.
Fourteen sets now, 62,166 items, 372,996 clips over the six voices.

Against the bucket, 598 of those 372,996 clips were actually missing:
`word-readings` 132, `mnemonic-words` 102, `keigo` 16, `lesson-pitch`
348, spread evenly over the voices except where a live play had already
cached one under the default voice. All 598 were generated on the local
VOICEVOX container, never Cloud Run, and the recount afterwards is 0 of
372,996 missing: every string the Sky can say is now cached ahead, in
every voice.

### The look the Sky never asked for (2026-09-08, SAK-374)

Four palettes, three modes, seven accents, and a paint-blocking script in
every page's head to stamp the learner's choice on `<html>` before the
first pixel. All of it for a screen that is one night sky. The Sky wears
its own `--sky-*` tokens and the wash, and the Settings page has offered
no theme picker since cutover, so the machinery ran on every load to
answer a question nothing asked.

Gone: `theme.tsx`, the pinned constants and the no-flash script in the
root layout, `ThemeProvider` around every page, and `intro-shown.ts`, the
registry that remembered which once-ever concept cards a learner had
read. With them the seven dead fields of the settings blob: `theme`,
`appearance`, `accents`, `claimHintDismissed`, `lessonWriting`,
`lessonReadings`, `introShown`. `SettingsFile` is `cfg` and `practice`
now, and `SETTINGS_KEYS` in `settings-merge.ts` says so, which is what
drops the other seven from a row on its next save.

`introShown` was dead twice over. The Sky's lesson calls the app's
`lessonSteps(facts, history)` with no shown set, so a concept card is
shown every time its lesson reaches it, and has been since cutover.
Nothing was reading the field to decide anything.

Two things the card asked for that did not happen, and why.
`settings-local.ts` stays, stripped to two fields: besides the seven it
carries `cfg` and `practice`, and Practice's saved recipes and misses live
in localStorage and nowhere else, so `applyServerSettings` is the only
way an account's practice reaches a second browser. And `<html>` keeps
`data-theme="kiri" data-appearance="system" data-accent="magenta"` as
literals, because `globals.css` defines the app's tokens only inside a
`[data-theme]` block and three files in the route layer still wear them:
`stroke-order.tsx`, `why.tsx`, `pitch-mark.tsx`. Nothing reads or writes
those attributes now.

So the one visible change: a learner whose account carried a theme from
the old app sees those three in kiri from here. That is the whole surface
of it, and there has been no way to pick a theme for two days.

The tests followed the modules. `intro-shown.test.ts` went with its
subject; `spine-intros.test.ts` and `pitch-intro.test.ts` each lost the
one line pinning a card's id to the registry; the settings merge, mutate
and local tests say the same things over `cfg` and `practice` instead of
over a theme and a dismissal flag. 1,095 lines deleted against 214 added,
3,867 unit tests
pass, 26 e2e.

### The config keeps what the Sky reads (2026-09-08, SAK-373)

`QuizConfig` was the old app's whole settings panel, 31 fields, and the
Sky reads twelve of them. Thirteen of the dead ones are gone: `requeue`,
`showAnswer`, `scriptLabel`, `blurSubmit`, `showVolume`, the two lesson
costs and `wordsPerLesson`, the four drill-HUD booleans, and `selection`.

Seven more stay, and it is worth writing down why, because the field
count alone would say the job is half done. `QuizSnapshot` in
`quiz-session-types.ts` is `Pick<QuizConfig, "mode" | "ask" |
"pairResponses" | "gridResponses" | "length" | "limType" | "limCount">`,
and that is the in-progress session envelope, which is SAK-376 in another
session's hands tonight. Cutting those seven means editing a file that
card may be deleting. `selection` left the config but the `Selection`
type stayed, for the same reason from the other side: its `list` field is
a saved list's id, and lists are SAK-375.

The half that matters more landed whole. `normalizeConfig` used to be
`{ ...defaultConfig(), ...raw }` followed by a list of stale keys to
delete, which meant every key the old app had ever written rode the
spread into the object and went straight back to the server on the next
save. Cutting fields off the type would have changed nothing about what
is stored. It reads field by field now, so a key no field names is gone
the moment the config is next saved, and the delete list went with the
spread.

So did the migrations the list existed for: `dirs`, `styleJp2en`,
`styleEn2jp`, the two `listen*`, the tri-state `input`, `newKanjiOrder`,
`enabled`, the `mixed` / `number-reading` / `listen-sentence` mode
rewrites, `pitchVoiceId` with the Azure voice ids, and the `askOverride`
test seam, whose last reader went with the e2e helper trim. `voiceName`
keeps its roster check and `fonts` its `randomFont` fallback, because
both are values the Sky shows. With the migrations went their half of
`ask-config.ts`: `deriveAudioPrompts`, `normalizeAsk` and
`migrateLegacyAsk`, 128 lines whose only remaining caller was their own
test. `clampLessonRange` went too, its last caller being the lesson-cost
fields.

493 lines deleted against 146 added, the README section included. 3,858
unit tests pass, from 3,867: nine went with the migration functions they
were written for. 26 e2e.

Left for whoever picks it up after the session envelope lands: the seven
fields above, the `Selection` type with `FactBand`, and folding `retries`
plus `retryN` into one number, which `retriesOf` and `retriesPatch` in
`app/(sky)/retries.ts` already present as one.

### The keys of features that are gone (2026-09-08, SAK-378)

A learner's browser was still holding a theme for a picker that does not
exist, an in-progress run for a quiz that cannot be resumed, nine "you
have read this card" flags for a registry deleted an hour earlier, and an
outbox whose module went with the old app. None of it was read, so none
of it was breaking anything. What it cost was honesty: open the storage
inspector and you read a version of this app that has not existed for
weeks, and every one of those keys would have been carried forward by the
next shim someone wrote.

`storage-sweep.ts` removes them on the first client render, from
`SettingsProvider`, which is the one module mounted on every page that
already owns localStorage. Nine keys by name, plus every `saku-intro-*`
and every `kanaquiz-*`, and the run-count cookie, which is expired rather
than removed because that is the only way a cookie goes. It runs on every
load rather than recording that it has run: a `removeItem` on an absent
key is a miss on a hash map, and a "swept" marker would be one more dead
key a year from now, which is the thing the file exists to remove.

With them went `storage-migrate.ts`, the 2024 rename shim that copied a
`kanaquiz-*` value forward on first read. Its last two readers were the
config's own load path and the settings map, both of which read
`saku-cfg` directly now. `settings-keys.ts` is three keys: the config and
Practice's two. The session pair, the run-count cookie and the
pending-records pair were constants nothing had imported since the old
app went; the dead names live in the sweep instead, which is where a dead
name belongs.

One key the card called dead is not, and it stays: `saku-local-lists`.
`store/local-progress.ts` still writes a signed-out visitor's lists
there. `saku-server-lookup-cache` is an IndexedDB database rather than a
Storage key, so the sweep cannot reach it; its module went tonight and
the database is Sam's to drop.

Two things the card asked to be written down rather than changed, and
they are now doc comments on the fields themselves. `HistoryFile.seen`
still told the old app's story, "quiz me": in the Sky it is written when
a star is opened in a lesson (`seeId`) and read back as "in your
knowledge base, untested". The model gets away with the two meanings
because it only ever asks the field one question, whether the fact is in
rotation and due soon, and both answer yes. And `learnedAt` is maintained
on every history write for a question no screen asks any more, the
Practice date filter having gone; its one reader is `resolve`'s date
window in `selection.ts`, which no live path calls. It stays because it
is write-once and keep-earliest, so it cannot be rebuilt once dropped.

Not done, and deliberately: splitting `src/types/index.ts` into four
files. The card asks for it after the QuizConfig, lists and session cuts,
and two of those three are being made in another session tonight, in that
same file. Rewriting every import of every type is the worst diff to hand
a concurrent card. It wants to happen once both lanes are in.

259 lines deleted against 315 added, the sweep and its test included. 3,853 unit tests pass, from 3,858:
nine went with the rename shim and two with the legacy-key half of the
settings map, and six new ones hold the sweep. 26 e2e.

### One rule for a page's title (2026-09-08, SAK-357)

The eyebrow is the page's name in the bar. The title is a question on a
page that asks something of you, and a noun for what is in front of you on
the screens inside a run. No title ends in a period.

Questions, unchanged: "What have you discovered?", "What would you like to
learn next?", "What would you like to know?", "What would you like to
practice?", "What have you done lately?", "How should Saku behave?", "Who
is learning?", "Want to keep your sky?", "How does Saku work?", "Where does
the data come from?".

Nouns: "Tonight's lesson" and "How it went" already were. Three changed.

* The bar: "Home" is now "Planetarium". The page has called itself that
  everywhere else since the cutover; the bar was the last holdout.
* The quiz: title "Quiz" under the eyebrow "Quiz" is now what the quiz is
  of. `SkyQuiz` takes an optional `title`, default "Tonight's drill";
  `/practice/run` passes "Your practice deck".
* The rest: "Take a break and come back." is now "A break between rounds".

`e2e/sky.spec.ts` asserts the two new headings in place of the old ones.

### Casing, and what a standing means (2026-09-08, SAK-363)

Four small disagreements, from a walkthrough that read the app as several
hands.

**Buttons are sentence case.** "Start Lesson" and "Start Lesson anyway" on
the Observatory were the only two that were not. They are "Start lesson"
and "Start lesson anyway" now.

**A standing's word gets its first letter, and only that.** CSS
`capitalize` was painting "Getting There" in the legend, the standing key,
the tally, the Atlas rail and the practice chips, while How Saku works, the
tooltips and the results all said "Getting there". The labels in `STANDING`
stay lowercase, because they are also spoken inside a sentence ("Hide
getting there", a coverage bar's read-out); `standingWord(standing)` in
`lib/standing.ts` is what anything showing the word on its own calls, and
every `capitalize` is gone. The Atlas's headline count made the same
mistake in JavaScript, running the label through `titleCase`: it calls
`standingWord` too, so a filtered shelf reads "43 Getting there".
`titleCase` stays for a shelf's unit, "214 Radicals Known".

**Two meanings did not match the page that explains them.** They are the
short form of those sentences now:

* slipping: "You haven't tested this recently" is now "You had this, and
  Saku no longer expects you'd get it right today".
* not seen: "You haven't learned this yet" is now "You haven't opened this
  in a lesson, and haven't claimed it".

**Title case after a number is for headline counts only.** The line that
sums a panel up title-cases its unit: "3 of 23,973 Discovered", "0 of 12
Pieces", "17 of 214 Radicals Known". Prose in a row is prose, whatever
number it starts with: "and 15,236 more that match, not listed here",
"missed 1 time". A standing is never a unit, so it never gets title case.

### The copy stops insisting (2026-09-08, SAK-365)

A read of every rendered string. What it took out were the words a sentence
leans on when it is worried you will not believe it.

`src/data/how-it-works.ts`: "genuinely unsure" to "unsure"; "until you're
actually asked" to "until you're asked"; "until you actually answer
something" to "until you answer something"; "Here's exactly what each one
is claiming" to "Here's what each one is claiming"; "You've actually been
tested, recently" to "You've been tested recently"; "Untested is untested:"
to "It stays untested:"; "Saku deliberately shows you nothing" to "Saku
shows you nothing"; "The real learning happens when you come back and try
to recall it" to "You learn it by coming back and trying to recall it". The
rounds paragraph said its point twice, so the second half went: "Each round
runs through the same whole set of cards, not just what you got wrong last
time, so you see everything more than once across the quiz, on purpose"
is now "Each round runs through the whole set of cards, not just what you
got wrong last time."

`src/app/(sky)/observatory.ts`: "the part you actually speak and read" to
"the part you speak and read", and "memorising" to "memorizing", the only
British spelling left in a rendered string.

`sky-rest.tsx`: "The real learning happens when you take a break and then
try to recall the thing you're learning. Feel free to leave and come back
to this page. The timer will continue counting even if you close the page."
is now "You learn it by taking a break and then trying to recall it. You
can close this page; the timer keeps counting."

`sky-quiz.tsx`, the help bar: the eyebrow packed three facts into small
caps, "HELP ME · 2 TRIES LEFT · 8S". It is "Help me" again. The tries are
their own muted line under it, in the words the card feedback already uses
("2 tries left.", "One more try."), and the seconds sit beside the timer
bar they count down.

### Nine entries in the bar become six, plus two to read (2026-09-08, SAK-358)

Before: Planetarium, Observatory, Atlas, Practice, Sessions, Settings,
Account, How Saku works, About, with "Sign in" on the right going to the
same page as Account, or "Sign out" there when signed in.

After: Planetarium, Observatory, Atlas, Practice, Sessions, Settings, then
a hairline, then How Saku works and About at the far end of the row, in the
same small caps but not bold. `ShellEntry` carries `quiet?: boolean` and
`SkyShell` does the grouping; the Menu fold on a phone makes the same
group, with a rule across it instead of down.

The right-hand slot is the account and nothing else: "Sign in" signed out,
"Account" signed in, both links to the same page. Signing out left the bar
and lives on the account page, under "You", which already had the button.

Not done: the learner's name in place of the word "Account". The layout
knows only `signedIn`; the name is in the session's claims, and reading it
there is a second `getClaims()` on every page in the app, which is the cost
SAK-382 spent the week cutting. One line to change if the layout ever holds
the claims for another reason.

### A panel stops at its content (2026-09-08, SAK-359)

Four panels were told to fill their column so their body could scroll and
their actions could sit at the end. That is right when the list is long and
wrong when it is short: the Observatory's "Tonight" with nothing picked put
"Nothing picked. Your sky stays as it is." at the top and a disabled Start
lesson 204px below it at 1440 by 900, and Sessions, Practice and the
lesson's rail did the same.

`SkyPanel` takes `fit`: `flex max-h-full min-h-0 w-full flex-col self-start`.
The panel is as tall as its content, capped at the room it was given, so the
body's own `min-h-0 flex-1 overflow-y-auto` only starts scrolling, and the
actions only end up pinned, once there is more content than room. The three
classes cover both parents: in a grid cell `self-start` beats the stretch
and `max-h-full` puts the ceiling back; in a flex column the caller drops
its `flex-1` and `w-full` keeps `self-start` from narrowing it instead.

Taking `fit`: the Observatory's "Tonight", both of Sessions' panels,
Practice's "What you would get", and the lesson's "Tonight, in order"
(which also dropped `self-stretch`). The Observatory's empty line dropped
its own `flex-1`, which was the other half of the void. Practice's "The
recipe" is left alone: it scrolls as a whole and pins nothing.

`e2e/sky.spec.ts` gained a test that measures the gap from the empty line
to the button on the Observatory: 204px before, 12px after.

### The reading pages get a measure and a warning (2026-09-08, SAK-361)

`SkyReading` had no width on its prose, so on a wide window About's
acknowledgement was one block eleven lines long at about 200 characters a
line. The column inside each panel is `max-w-[68ch]` now, next door to the
lesson's `max-w-[64ch]`. The panel still takes the page's width; the words
stop.

About also changed subject with nothing to say so: three sections about
where Saku's data comes from, then Kana, Kanji & vocab, Grammar and the
rest of the reading list. `src/app/(sky)/reading.ts` puts a section between
them, "Other places to learn", with one line: "Saku does not teach
everything. These are other people's sites and books, worth going to for
what it leaves out." Kept on About rather than split into its own page,
because a licence obligation pins About to the bar and a split would put
the list one more click away.

Two small ones on the same component. The "↗" after a link's name is inside
an `aria-hidden` span, so the link is named "JMdict" and not "JMdict
up-right arrow"; it stays on screen, being the only sign the link leaves the
app. The credit under each file was an `Eyebrow`, bold and letter-spaced at
10.5px, which is a loud way to say "Electronic Dictionary Research and
Development Group · CC BY-SA 4.0". It is a plain muted line at 12.5px now.

`e2e/sky.spec.ts` gained a test: About opens, "Other places to learn" is
there, and the first paragraph is under 600px inside a panel 200px wider.

### Asking, undoing and saying there is nothing (2026-09-08, SAK-364)

Three families of interaction that each worked several ways.

**Asking.** The rule: ask before anything the learner cannot get back, and
only then. `InlineAsk` (`inline-ask.tsx`) is the one shape: a line saying
what happens, the verb in coral, "Keep it" beside it. Sessions and Account
each carried a near-identical copy and now call it. Practice's saved-recipe
"Delete" fired on the click with no ask at all; it asks now, "This recipe
goes for good." / "Delete it" / "Keep it". Clearing a mix-up still does
not ask, deliberately: a cleared pair is un-watched, not deleted, and comes
back the next time the two get swapped.

**Undoing.** `UndoLine` (`undo-line.tsx`): what happened, a period, the way
back, and a second way back after a middot when there is one. The
Observatory's "Removed 日 · Undo" is "Removed 日. Undo"; Practice's "Left
out 日. Put it back" is "Left out 日. Undo" with "Undo all 3" beside it.
Practice's standing line, "One item left out by hand. Put it back", is the
same component keeping its own verb, since it is not the last thing you did.

**Empty states**, all in the shape the home already used, what this is then
what to do:

* "You currently have no mix-ups." to "No mix-ups. When you keep swapping
  two things for each other, they show up here."
* "Every quiz you finish is kept here. There are none so far." to "Every
  quiz you finish is kept here. Take one from the Observatory, or drill
  something in Practice."
* "Nothing picked. Your sky stays as it is." to "Nothing picked. Choose
  something to learn and it lands here."
* "Nothing here with that status." to "Nothing here with that status. Try
  another, or clear the filter." (Same for the "built from X" variant.)
* The quiz's "Nothing is due..." now names Practice alongside the
  Observatory and the Atlas.

`e2e/sky.spec.ts` gained a test for the one behaviour change: deleting a
saved recipe asks, "Keep it" keeps it, "Delete it" deletes it.

### The visitor's finished quiz is in the browser before the next page (2026-09-08, SAK-406)

The e2e "a visitor's quiz is kept in the browser and shows up under
sessions" failed twice under a loaded suite and passed four times out of
four alone. It was a real race, not a slow test.

`SkyQuiz.finish` paints "How it went" in the same click that ends the
quiz, then fires `onFinish` and never waits for it. Signed out, that
promise was two round trips deep before anything durable happened: the
`quizRecords` server action to turn answers into session records, then
POST /api/session, which answers 401 because there is no account, and
only then did `resolveProgressWrite` call `applyLocal` and the record
reach `saku-local-history`. The test navigated the moment the heading
painted, so under load it left before the write. Nothing about
`/sessions` was late: `useWho` already waits on the provider's `loaded`,
and a signed-out `HistoryProvider` reads localStorage in its mount
effect.

So the POST stops being made. When the shell has said there is no
account, that request is a foregone 401 — every one of those routes
loads the user through `getUserId()`, which throws before it reads the
body — and the 401 branch does the only thing that was ever going to
happen. `postWithLocalFallback` now does it first, in the caller's own
turn, and returns. The condition is `isSignedIn() === false` and not
"not signed in": the signal reads true while unknown, so a write made
before the shell has spoken still takes the full path and is still
queued rather than written to a store the learner may not own. The
signed-in path is untouched, refresh-and-retry and all.

The test stops assuming the write beat it and waits on the store itself
before navigating, which is a wait on the real event and not a longer
timeout.

What is left, and it is worth a card. The `quizRecords` server action
still runs before the record exists, so a visitor who navigates inside
that window loses the quiz, and the results screen never says it is
saving even though `SkyQuiz` already tracks the state. The honest fix is
a saving state on the results screen, or computing the record before the
screen paints; both are `src/sky/components`, which another lane held
tonight.

Two files touched, 3 lines deleted against 46 added. 3,809 unit tests
pass, 1 skipped. 28 e2e, run at `--repeat-each=6`: 168 passed, the
visitor test six times for six.

### The seven fields the Sky never read leave the config, and the types file splits (2026-09-08, SAK-407)

The seven were pinned twice. `QuizSnapshot` in `quiz-session-types.ts`
named five of them in a `Pick`, and four functions in the engine's
unreached half still took a whole `QuizConfig` and read them: `buildDeck`
and `pickDir` in `engine/index.ts`, `realQuestionCount` in
`ask-forms.ts`, and its server wrapper `getRealQuestionCount`, whose one
caller (`slice-bar.tsx`) went with the old app. Nothing outside a test
imported any of them; the live imports from `@/lib/engine` are
`answerKeyFor`, `buildMcOptions` and `newFactStat`.

So they went, and the cut ran further than the card guessed. `enabledDirs`
was `pickDir`'s only caller, and it was the last live use of
`ask-config.ts` — the predicates, `defaultAsk`, the pair and grid response
helpers, and finally `askFromAudioPrompts` itself, once `QuizConfig.ask`
was gone and nothing built an `AskConfig` at runtime any more. The Sky
reaches its cards from `audioPrompts` directly (`quizFromHistory`), never
through an ask. `vehicle-spread.ts` went the same way, as `buildDeck`'s
only caller of it. `AskConfig` stays as a type: `enabledFormsFor`,
`buildCoverageDeck`, `coverageQuestionCount` and `configIsReachable` take
one directly, and the coverage tests that drive them are real.

`QuizSnapshot`'s own reader was `StudySession.snapshot`, which nothing
read: its only mention outside the type was `{} as
StudySession["snapshot"]` in a test's fixture.

`retries` and `retryN` are one number now. `{ retries: "none", retryN: 3 }`
was representable and meant nothing; the quiz always wanted the number,
and `retriesOf` existed to compute it. `normalizeConfig` migrates a stored
mode-plus-count on first read — "none" to 0, "unl" to the 9 the quiz
always read it as, "lim" to its own `retryN` — so a learner who set 3
keeps 3.

`engine/retries.test.ts` went with `effectiveRetries`, and the SAK-54 rule
it guarded is not lost: `SkyQuiz` enforces it live, `Math.min(retries + 1,
options.length - 1)`, which is zero retries for a two-option board.

The types split. `src/types/index.ts` is three files and a barrel:
`facts.ts` for the identities everything is keyed by, `sky.ts` for the
Sky's own in-flight shapes, `store.ts` for what is written to and read
from a learner's `progress` row. The arrow only points one way, store to
sky, and only twice: `SettingsFile.cfg` and `QuizSessionRecord.detail`
carry a Sky shape whole. What did NOT happen is the import rewrite: 194
files import `@/types` and 135 name a stored type, including both other
lanes' files tonight, so `@/types` stays the one surface and no call site
changed. That is a separate change from splitting the file.

The root layout loses the `curriculum-version` meta tag, whose reader
(`use-server-lookup.ts`) is gone, and four comments that pointed at
`sidebar.tsx` and `landing.tsx`. The wordmark preload stays: the Sky's
shell draws it on every page.

2,286 lines deleted against 964 added, seven files gone. 3,750 unit tests
pass, 1 skipped, from 3,809: the 59 that went were the deleted engine and
ask-config tests. 28 e2e. The entry-model dump is byte-identical across
all 13 files, and `node scripts/unreachable.mjs --list` is still zero.

### The facts have one home, and the reads stop asking the history column (2026-09-08, SAK-405)

`progress_facts` shipped behind a fallback. Every query against it caught
Postgres' 42P01 and reported `migrated: false`, and `history.ts` answered
that by running the pre-SAK-237 whole-document op instead: `applySession`
for a save, `applyDropClaims` for a withdrawn claim, `applyDeleteSessions`
for a rebuild, with a probe query in front of the last one to choose. The
read did the same thing more quietly, merging the `facts` key still
sitting in the `history` jsonb under the table's rows.

That was right for a window in which the code could reach production
before the SQL did. The window closed a long time ago: the table is there
and it has held every fold since. So the flag is gone, the three
fallbacks are gone, `factsTableMigrated` is gone with the branch it
existed for, and a 42P01 is now what it should have become the day after
the migration landed — an error, loudly, rather than a silent slide back
onto a document that has been stale ever since.

`shapeHistory` takes the table and only the table, so `HistoryFile.facts`
for a page read is one thing from one place. `mergeFacts` went with it.

WHAT THIS DEPENDS ON, AND IT IS NOT SOMETHING THE CODE CAN CHECK.
Reading the table alone is right exactly when every learner's legacy
blob has been copied into it — that is `scripts/backfill-progress-facts.mjs`,
which the schema's own rollout note says to run in the same maintenance
window as the migration. `to_regclass` says the table exists; it does not
say the copy happened. A fact last folded before SAK-237 on an account
that was never backfilled lives only in the blob today, and after this
change it reads as unknown: its counts and its stability start over, its
claims and seen and sessions untouched. Answering that question needs a
read of real learners' rows, which is not mine to make, so before this
merges: `node --env-file=.env.local scripts/backfill-progress-facts.mjs
--dry-run` reports the counts without writing anything. If it says there
are rows still to copy, run it for real first.

The `facts` key itself is not cleared here. That is
`clear_legacy_history_facts`'s job, which the backfill already calls per
user once that user's copy has landed, and two things clearing one key on
two schedules is worse than one.

The schema's rollout note said "the app code tolerates this table being
ABSENT". It does not any more, and the note now says so.

Four code files and the schema, 222 lines deleted against 167 added.
3,748 unit tests pass, 1 skipped, from 3,750: the three pre-migration
fallback cases are gone and one new one takes their place, and the
store's table-absent cases now assert a throw instead of a flag. 28 e2e.
The entry-model dump is byte-identical across all 13 files, and `node
scripts/unreachable.mjs --list` is still zero.

### Every Sky URL is built in one place (2026-09-08, SAK-367)

Nine places did the same string surgery, each with its own `sample ?
"sample&" : ""` and `includes("?") ? "&" : "?"`: the Atlas's `withPicks`
(twice), the Observatory's Start lesson, the lesson's Drill, Sessions'
rerun, the quiz's retry, Practice's start, back and retry, and the
`sample ? "/observatory?sample" : "/observatory"` ternaries in four
clients and the quiz route.

`src/app/(sky)/hrefs.ts` is `skyHref(path, { sample, from, recipe, picks,
cards })`, and the keys come out in that order, which is the order every
one of those nine already used. An empty list is no key at all, which is
what "quiz me on what is due" looks like. `idsFrom(value)` is the mirror
the pages read a `picks=` or `cards=` back with, and it handles the
repeated key Next hands over as an array, which two of the pages did and
two did not.

Two Sky components knew query names and now do not. `SkyAtlas` takes
`picksHref(ids)` and `quizHref(ids)`; `SkyObservatory` takes
`lessonHref(ids)` where it took a `lessonPath` string it appended to. The
prop's old comment said "a path, not a function: the route is a server
component", which stopped being true when the clients were split out.
`SkyHome` and `SkyLesson` keep plain string hrefs, neither one appending
anything.

Eight of the nine emit the same string they always did, pinned in
`hrefs.test.ts` against the strings captured before the change. The ninth
moved, and it is worth naming: the Atlas encoded a list as
`ids.map(encodeURIComponent).join(",")` while the other five used
`encodeURIComponent(ids.join(","))`, so `/observatory?picks=kanji%3A日,…`
now separates with `%2C` like everywhere else. Both forms decode to the
same two ids and both still parse, so a link written yesterday still
opens; no id anywhere holds a comma (0 of 15,380 sky items, 0 of 2,815
atlas items), so the two forms have never differed in meaning.

`skyHref` covers `recipe` and `cards` but nothing here calls those yet:
`quiz-client.tsx`, `practice-client.tsx` and the quiz and practice route
modules are another session's tonight (SAK-370, 372, 315, 316), and their
four call sites are one line each when that lane is in. `packRecipe`
stays in `practice-client.tsx` until then, and the builder packs its own.

31 lines of hand-rolled URL gone against 62 in the builder. 3,822 unit
tests pass, from 3,810, the twelve new ones being the pinned strings. 31
e2e.

### A Sky page says who is here in one line (2026-09-08, SAK-368)

Eight route files opened with the same four lines: read the query, is it
`?sample`, if not who is signed in, and then a three-armed conditional
picking the sample's data, the account's, or nothing because the history
is in a browser the server cannot see. Every one of the eight had typed
it out.

`page-data.ts` is `whoFor(params, pretend?)` and `initialFor(who, load)`.
The first answers the three questions at once and hands back `{ sample,
signedIn, who }`; the second is the conditional, which reads as what it
is now that it is named: the route's data, or null because the browser
holds it. `pretend` is the lesson's `?showcase`, one of everything on an
empty history, which asks nobody's account and still says signed in.

On the client the same three lines were in five files:
`useWho(sample, signedIn)`, `useLoaded(who, load, initial)`, then a
`SkyLoading` with the page's eyebrow and title. `useSkyData` in
`local.tsx` is all three, returning `{ who, data, loading }`. It returns
the loading page rather than rendering it, because the caller decides
when to give up: the home waits on its stars and the Atlas on its
shelves and its lookups, so `if (!payload || !stars) return loading` is
still the page's own sentence. `who` comes back because the Atlas binds
its four lookups to whose history they read.

Six `<>…</>` wrappers holding a single child went with them, left from a
dev frame that used to sit around each page.

The height, folded in from the card. Every route caller passed
`height="100%"`, and the `calc(100vh - 8rem)` default that two
components carried was reached by nothing. `SkyPageShell` defaults to
`100%`, `SkyHome` passes its own through instead of defaulting, and the
ten `height="100%"` in the route layer are gone. The prop stays for a
route whose chrome is its own; nothing renders one pixel differently,
the new default being the string every caller was passing.

Not this card's, and untouched: `quiz/page.tsx`, `practice/page.tsx`,
`practice/run/page.tsx`, `quiz-client.tsx` and `practice-client.tsx`,
which are another session's tonight (SAK-370, 372, 315, 316). Three
`whoFor` calls, four `useSkyData` calls and two more fragments when they
land, and the four `height="100%"` that are left are theirs.

93 lines out against 73 in, the new module and the README included.
3,822 unit tests pass, unchanged: this card moves lines rather than
adding behavior, and the e2e is where the proof is. 31 e2e, which opens
the home, the Observatory, the Atlas, a lesson, Sessions and the account
page, sampled, signed out and as a visitor.

### The Sky stops writing the same small piece twice (2026-09-08, SAK-369)

From a read of every component on 2026-09-06. Several of its bullets had
already closed by tonight: `useNarrow` came out of the Atlas into its own
file, `PIP` is gone, and `VERDICT` is exported from quiz-results and worn
by three components. Three of the eight underlined text buttons went into
`UndoLine` on SAK-364. What was left, and is now one thing each:

**A glyph.** `glyph.tsx` is the display face, the Japanese font that
suits the character, and its standing's color. Four places wrote those
four classes out, differing only in size: the mix-ups panel's `Name`, the
Atlas's selected pill, the tooltip's head glyph and the lesson card's
`StarButton`. No standing means the ink, which is what the star card
already did and what the tooltip means by `tonight`: a thing picked for
tonight is not "not seen" any more. Every one of the four emits the same
class attribute it emitted before, character for character.

**An underlined word in a line of text.** `SkyTextButton`, in
`sky-button.tsx` with the rest of them, ink or coral. Clear in the
mix-ups panel and both of `UndoLine`'s.

**A pill's colors.** `CHIP_TONE`, also in `sky-button.tsx`: lit, unlit and
greyed, written once instead of inside `SkyChip`, again in
`sky-menu-chip.tsx` and again by hand for Settings' font chips, which
need their own size and face but not their own colors.

**Two names.** `GRADES` was declared in `lib/quiz.ts` and again at the top
of sky-sessions, which was already importing `GRADE` from that module.
And there were three unrelated functions called `tally`: the quiz's over
answers, the sessions module's over a session, and a local one in the
Atlas over a shelf. They are `tally`, `tallySession` and `shelfCounts`
now, so a reader who greps the name finds one thing.

Four things the card asks for that did not happen, and why. A `SkyRow`:
the exact pair of classes is in quiz-questions and quiz-results only, and
the other four "selectable rows" are real variants, one sitting on
`bg-sky-panel`, one on `bg-sky-accent/10` with a locked state, one a
different row entirely; a component with five modes reads worse than five
lines. The `×` and the big-number-over-a-colored-eyebrow block are two
call sites each, and in both cases one is in a quiz or practice component,
which another session had open tonight, so they want making when both
halves can move together. `GlyphName` with a note and a click: Sessions
and Practice draw their glyph in a different face, `font-medium
leading-tight truncate` and no display face, so it is not the same piece.
And `sky-tooltip.tsx:44` is the one glyph in the Sky with no
`leading-none`, which is either an oversight or a decision, and not one to
make blind.

The British spellings, and `chosen` shadowing `chosen` in sky-practice,
are SAK-371's.

3,822 unit tests pass, unchanged, and 31 e2e. Nothing renders
differently: every class attribute touched here is the same string it was.

### The Sky drops what nothing reaches (2026-09-08, SAK-371)

A grep across `src` on 2026-09-06, checked again tonight against a tree
two rounds of cuts smaller.

**Four entry points from before `Who`.** `learnerSky`,
`learnerObservatory`, `learnerAtlas` and `learnerQuiz` each read the
session, loaded the signed-in learner's history and handed a page its
data. Every page asks a server action with a `Who` now, so a visitor's
own history can ride up with the call, and the four had no caller left,
tests included. The card named three; the Atlas's is the same thing and
went with them. With them go their imports: `currentUserId`,
`loadHistory`, `emptyHistory`, `getStatsRows` and `loadSettings` are read
by nothing in three of those modules any more. `learnerHistory` stays,
`actions.ts` being its reader.

**A colour per kind.** `KIND_DOT` in `lib/tokens.ts` mapped each kind to
one of the old app's `bg-sentence-*` tokens, and its header explained
that the components using it drew inside the old app's chrome. That app
went last night, and nothing had read the map for a while before that.
The file is `KIND_LABEL` now, which is what a kind is called, and the
header says what the file is rather than what it used to be.

**Three props nothing passes.** `SkyShell`'s `notice`, a band under the
bar for a visitor whose sky is in this browser, removed on Sam's ask when
the bar got a permanent Sign in; the header sentence about it went too.
`StandingLegend`'s `extra`, rows for the lesson's own "tonight" and
"lit", which its one caller does not pass, along with `LegendExtra`.
`ItemSection`'s `start.disabled`, whose one caller computed it as
`ids.length === 0` three lines under an early return for exactly that,
so it was always false.

**`isInSky`** in standing.ts, whose only caller was one line of its own
test, which now checks the other two helpers and not a third that does
not exist.

**One word in a comment.** `lib/quiz.ts` said a wrong answer gets
"MAX_TRIES in all"; the constant is `DEFAULT_RETRIES`.

Two of the card's items were already gone: the README's "Migration, when
the time comes" section, and `SkyPageShell`'s unused default height,
which went on SAK-368 an hour ago.

Left where they are, and why. `Facet`'s `note` prop, the `chosen` that
shadows `chosen`, and the stale header line about the page saying so at
the top are all in `sky-practice.tsx`, which another session had open
tonight. And the British spellings in identifiers and comments (`colour`
in sky-card.tsx and through sky-wash-file.ts, "centre", "labelled",
`licence` as a field name in attribution.ts) are Sam's call, as the card
says: none of it renders, and renaming a field called `licence` moves the
attribution data and its tests for a spelling nobody sees. New comments
are American.

109 lines out against 17 in. `scripts/unreachable.mjs --list` stays at
zero, 3,822 unit tests pass with one assertion fewer, and 31 e2e.

### The quiz's three tries become one (2026-09-08, SAK-370)

`sky-quiz.tsx` had the same rule written three times. Typing an answer,
picking a choice and placing an ordering card's pieces each counted a try,
graded a right answer with `gradeFor`, and on a wrong one either settled
"missed" at the last try or patched the card and wrote a "Not that ..."
line. The three differed only in what they compared, what they recorded as
said, and what a wrong go left behind.

`attempt({ right, said, note, wrong })` holds it once and says which of the
three things happened, so a caller with more to do on a wrong go can do it:
the typed box empties itself, and nothing else needs to. The card's open
state went to `lib/quiz.ts` with it: `Open`, `FRESH`, `triesNote`, and
`maxTriesFor(card, retries)`, which is the rule that a board of choices
runs out one pick short of giving itself away. Two choices give one go,
three give two, and a typed or ordering card has no board to exhaust, so it
gets the retries as set. That last one was an expression in the middle of
the component and is a tested function now.

The keyboard effect had no dependency list, so it took the window listener
off and put it back on every render, which on a timed card is ten times a
second. It subscribes once now, through a ref holding the latest handler,
the way `onTimeOut` in the same file already did. The handler also returns
early when there is no card: on the empty quiz, Enter read `card.order` and
threw.

### Two recipes that mean the same deck are one recipe (2026-09-08, SAK-372)

A recipe is a description, and nothing in it is ordered: drawing from kana
and words is the same deck as drawing from words and kana. Practice
compared two recipes with `JSON.stringify`, which is neither key-order nor
array-order blind, and the page builds its recipes by appending. So
turning a collection off and back on moved it to the end of the list,
`toggleCut` moved a collection's key to the end of `cuts` every time a cut
was picked, and a recipe that came back through the URL was rebuilt as
`{ ...EMPTY_RECIPE, ...parsed }`, in `EMPTY_RECIPE`'s key order. Each of
those read as a different recipe: "Saved as X" flipped to "Update X" with
nothing on the page changed, and the preview cache in `fresh` missed and
refetched a preview it already had.

`canonicalRecipe` writes the six fields in one order with every list
sorted, `recipeKey` is that as JSON and `sameRecipe` compares the two keys.
The key is deliberately a valid recipe, so the effect that follows the
recipe can key on it and parse it back to send, without keeping a second
copy. What a recipe means and what it draws are untouched, since none of
those orders was ever read for anything.

`recipeSummary(recipe, collections)` is the other half of the card. Sam
took the panel's summary line out on purpose, so this is not that: it is
the saved recipe's chip carrying what it draws from, the way a collection's
chip carries its count. "Kana (Hiragana and Yōon) and Words, only shaky,
asked for the meaning and the reading, 10 of them". A clause that says
nothing is left out, so no standing picked means any standing and all five
asks means asked every way. Everything empty says "Everything".
