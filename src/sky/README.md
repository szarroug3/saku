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

### Color: the night theme, as tokens

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
of layers, each a few named knobs (a glow's color, strength, position, size,
tail and visibility). `/wash` (gallery page removed 2026-09-04) is the editor: drag glows, pick colors,
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
so a screen paints the word. The file held a copy of the app's decision table
too, with a test proving the copy agreed with `src/lib/library/standing.ts` on
a grid of scenarios; nothing in the Sky ever called it, since a standing
reaches a surface already decided, on the catalogue or the payload, and it went
on SAK-433. **A bare colored mark never appears without its
word:** the mark is not exported; `StandingChip` and `StandingLegend` in
`src/sky/components/standing-legend.tsx` are the only ways to paint one, and a
star fill or coverage bar sits beside a legend. Since SAK-338 the mark is the
star itself, drawn by the sky's own `StarGlyph` and `paintFor`. Inside the lesson a star is
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
the center, its parts on a ring, their parts fanned out beyond (each level
reaching a little less), a shared piece once, between the parents that share
it, and normalizes to the unit box. Every number hashes from the root's id
(`hashUnit`, the prototype's function), never `Math.random`, so a word is the
same shape on the home sky, in the Planetarium, in the lesson, on an Atlas
tile and in Practice; `placeConstellation(layout, cx, cy, r)` is the only
thing that differs. Prerequisites + 1 stars, no more. `ConstellationFigure`
(`src/sky/components/constellation.tsx`) draws a placed layout inside an
`<svg>`: star size by role (`roleOf(kind)`: word, kanji, piece), body by kind
(`bodyOf(kind)`: grammar and sentence rules are planets, counters asteroids,
verb pairs binary stars, the rest stars), color by
standing through the standing tokens, and the state in the glow and marks
the star wears (SAK-338, at the end of this file). Lines are structure only:
one color, one weight, never dashed, none into what is undiscovered. `lit`
and `emphasis` take a star over and `tonight` is a halo on top of whatever
it already is, and `dots={false}` draws lines only so the
lesson can put its own clickable stars on the returned positions, in the same
colors via `paintFor`. `/constellations` (gallery page removed 2026-09-04) shows all of it on real words.

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
what it held open). A kana row is a `group`: picked as one,
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
one small caps label, in a tone (muted, accent, or the caller's color) and
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
neighborhood rather than at every box already down (`scatter.ts`). Fifteen
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
as progress; at two hundred (a practice deck) it was three rows of gray
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

The card is centered in whatever space is left instead, and moves when the
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
and 生 has no romaji at all. Loose, for English, compared after normalizing
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
reads the same `progress` row more than once and never memoizes it. The
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
covered making a database client, a query over the network, and normalizing
a whole record. Those want different fixes, so they report separately now:
`db:client`, `db:query` and `db:normalize`, and the same for the shell's own
read of the row.

### Two round trips where one would do (2026-09-06, SAK-382)

The split header answered the 755 ms. On a cold function it read
`db:client 0.0, db:query 1240.5, db:normalize 309.5`. Making the client is
free. The rest is the database, twice.

`readHistoryRow` selected the learner's row, and then, buried inside
normalizing what came back, called `readFactsTable`: a second query to a
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

Tried and reverted: memoizing `offerings` per request, the way `standingFor`
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

Tried and reverted: memoizing `subjectTally`, which the discovery rows and
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
the word question's distractors. A word's distractors are its neighbors
in rank, nearest first, and the way to find them was to filter and sort
the whole vocabulary around the word, for every card. The vocabulary is in
rank order once now, and the neighbors are found by walking out from the
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
component is layout again. No behavior changed; the e2e that scrolls a
streamed shelf holds it.

### The verdict and the hint, apart from the quiz screen (2026-09-07, from the review)

The quiz screen rendered an answered card's verdict, the answer and the
list of what was said inline, and the hint surface too. `QuizVerdict` and
`QuizHint` hold those now (`quiz-verdict.tsx`); the screen is the card,
its bar and the way on. No behavior changed; the e2e that reads the said
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
values instead of differences between neighbors. The same pixels with the
Sub filter are 319 KB. Decoded they are byte for byte what they were: the
same colors, the same stops, the same 4x4 dither, the same 1600x900.

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
array; `postList` had no caller. The one real behavior change is that a
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
"the part you speak and read", and "memorizing" to "memorizing", the only
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
acknowledgment was one block eleven lines long at about 200 characters a
line. The column inside each panel is `max-w-[68ch]` now, next door to the
lesson's `max-w-[64ch]`. The panel still takes the page's width; the words
stop.

About also changed subject with nothing to say so: three sections about
where Saku's data comes from, then Kana, Kanji & vocab, Grammar and the
rest of the reading list. `src/app/(sky)/reading.ts` puts a section between
them, "Other places to learn", with one line: "Saku does not teach
everything. These are other people's sites and books, worth going to for
what it leaves out." Kept on About rather than split into its own page,
because a license obligation pins About to the bar and a split would put
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

`e2e/sky.spec.ts` gained a test for the one behavior change: deleting a
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
account, that request is a foregone 401: every one of those routes
loads the user through `getUserId()`, which throws before it reads the
body, and the 401 branch does the only thing that was ever going to
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
`ask-config.ts`: the predicates, `defaultAsk`, the pair and grid response
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
mode-plus-count on first read ("none" to 0, "unl" to the 9 the quiz
always read it as, "lim" to its own `retryN`), so a learner who set 3
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
the migration landed: an error, loudly, rather than a silent slide back
onto a document that has been stale ever since.

`shapeHistory` takes the table and only the table, so `HistoryFile.facts`
for a page read is one thing from one place. `mergeFacts` went with it.

WHAT THIS DEPENDS ON, AND IT IS NOT SOMETHING THE CODE CAN CHECK.
Reading the table alone is right exactly when every learner's legacy
blob has been copied into it; that is `scripts/backfill-progress-facts.mjs`,
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
grayed, written once instead of inside `SkyChip`, again in
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

**A color per kind.** `KIND_DOT` in `lib/tokens.ts` mapped each kind to
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
tonight. And the British spellings in identifiers and comments (`color`
in sky-card.tsx and through sky-wash-file.ts, "center", "labeled",
`license` as a field name in attribution.ts) are Sam's call, as the card
says: none of it renders, and renaming a field called `license` moves the
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

### The reveal says why each of the others was on the board (2026-09-08, SAK-315)

The board was already the confusable set. `quizCards` builds it from the
app's own `buildMcOptions`, which draws the flagged lookalike pairs, a
kanji's own other readings, a word's neighbors in rank, a keigo set's
opposite register, a verb pair's other side and another pattern on the
same verb. What was missing was the naming: a distractor is the shape of a
mistake you were about to make, and the reveal confirmed the answer without
ever saying which shape.

`QuizOption.why` carries a few words, worked out by the route in
`whyOption(fact, option, onAVehicle)`, a ladder of relationships the app can
actually check between the asked fact and the option, sharpest first:

* the same entry, both reading facts: "another reading of the same character"
* `confusableWith` links the two entries, either way round (kana's
  `LOOK_GROUP`, `CONFUSABLE_WITH` for kanji, the hand-authored radical
  pairs): "drawn almost the same". This is Sam's own three, 未 against 末,
  土 against 士, 大 against 犬.
* a keigo set's other register, then another polite verb
* a verb pair's other side: "the other verb of the pair"
* a grammar production card that rolled a vehicle: "the same verb in another
  pattern"
* a word's rank neighbor: "a word about as common as this one"
* the pitch card's wrong clip, set in `pitchCard`: on a real homophone pair
  "another word said the same way", else "the same reading, said with the
  other pitch"

Anything landing on no rung gets no line. That is the engine's own backstop
showing through: when a subject runs out of sharp distractors the board is
filled from the subject at large, and there is nothing true to say about
such an option beyond "it was another one of these". 一 has no flagged
pair, so its meaning board is named nowhere, and that is the right answer.
A grammar MEANING board is the other unnamed case, since its options are
other patterns and no short phrase is honest about all of them.

`QuizWhy` (`quiz-verdict.tsx`) shows them under the verdict, and only when
the board was in front of the learner: a card that opens on its choices, or
one where Multiple choice was asked for. Naming options that were never on
screen would be noise. Nothing to name, nothing shown.

### The reveal explains which reading applies, and why (2026-09-08, SAK-316)

The quiz is mostly not asking what a thing means. It is asking which
reading applies, because that is the part of Japanese that actually goes
wrong: 水 is みず alone and すい in 水曜. The reveal confirmed the answer and
showed the Lesson's own card, which teaches the item; it explains the rule
now, which teaches every item the rule touches.

`READING_INDEX` in `src/data/kanji.ts` already held the answer per reading
fact: `type` is KANJIDIC2's on / kun / both, `base` is the reading,
`surface` is how it comes out in this word, `anchor` is the word. Rendaku
and gemination are folded into one reading there on purpose (出口's ぐち is
くち voiced, and scoring the two apart would split one piece of knowledge in
two), so a surface differing from the base is never a different reading, and
every difference in the tables is one of exactly two things: a first-mora
voicing or a clip to っ. Nothing else, checked across all 117 of them.

`quiz-rules.ts` is the authored prose and the picking. Four rules: the
on'yomi, the kun'yomi, the reading the dictionary files both ways, and the
two sets of numbers. **The prose is per RULE, not per item.** The character
and the word are filled in and the sentences are fixed, so every card that
exercises a rule says the same thing and the learner meets one explanation
many times rather than a hundred near misses. A test holds that line: three
thousand-odd readings produce three titles and at most nine shapes of
sentence, one per rule with and without the note about what happens to the
sound in this particular word.

`QuizRuleBlock` (`quiz-verdict.tsx`) puts the prose on the left and the
character's readings on the right, best attested first, capped at six, the
one that applies marked. A reading is worth little except against the ones
that did not apply, which is what the card asked for.

A card with no rule to name carries none, and its reveal is what it always
was: a meaning card is not a question about which reading applies, and a
rule attached to it would be a rule about the wrong thing. Long vowels are
the card's one item not done. おう against おお is a question about how a
reading is WRITTEN, and the tables carry no flag for it.

### What the overnight lanes left (2026-09-08, SAK-410)

Four leftovers, each of which had sat in another lane's files the night it
was found. Three commits, 1,635 lines deleted against 174 added.

`grammarVehicleBucketOf` and `grammarVehicleSlotOf` went, with the two
describes that were their only readers. They lost their caller in SAK-407,
when the deck builder they fed went with the engine's unreached half, and
were kept as the written-down account of what a vehicle slot is. That
account is in the git history; a lookup nothing calls is a lookup nothing
keeps honest.

`src/lib/session.ts` went too: 685 lines of the old app's session loop, plus
its 707-line test. `unreachable.mjs --list` read zero on it, and that was
true and misleading at once. It IS reached, but only from tests: its own,
and two LIVE ones that had borrowed it for fixtures. So the borrowers stand
on live code now. `drill-stats.test.ts` read the round summary through
`roundCompleteView`; the three numbers it asserted are `poolSessionCounts`'
own, off the same `seen` and `misses`, and the audit's case is a REPEAT
showing, which is pooled, so the test still refutes the bug it was written
for. `session-record.test.ts` folded its round fixtures with `mergeStats`;
what it tests is `buildSessionRecord` and `foldSession`, not the fold, so
the fold is a documented local helper there. Five comments that pointed at
the deleted file point elsewhere. The one in `data/how-it-works.ts` is left
alone: every path in that block names a file the old app took, and fixing
one line would not make it less stale.

`sky-lesson.tsx`'s keydown effect had no dependency list, so React ran it
after every render: every page turn, every star opened, every keystroke
removed a window listener and added another. SAK-370 fixed the same effect
in the Quiz and left this copy behind. It has the Quiz's shape now, the
handler in a ref each render refreshes and one listener added at mount, so
`canBack` and `last` are still read fresh on every press and nothing is
subscribed after mount.

And the results screen says where the record is. SAK-406 made a visitor's
finished quiz reach the browser in the caller's own turn and named what was
left: the answers still go through the `quizRecords` server action before
there is a record at all, and the screen said nothing across that window
even though `SkyQuiz` had been tracking `saved` the whole time. A visitor
who left inside it lost the run. One quiet line under the list now, "Saving
this run." then "Saved.", `aria-live` so it is not a corner you have to
watch; a failure keeps its own sentence and a sample deck stays silent.

The way back is held while it says Saving, and that is the part that
actually closes the window, because it is the one control that leaves the
page. The card asked for the action to be ordered after the write, and that
way round is not open to us: `quizRecords` is what MAKES the record, and it
is a server action because it reads `factInfo`, the ~3.6 MB fact registry.
Moving it into the browser to save a sub-second gap would put the registry
on every quiz page. `writes.ts` says so where the next reader will look.

`e2e/sky.spec.ts` gained a test that finishes a visitor's quiz, watches the
line settle from Saving to Saved, checks the record really is in the browser
by then, and only then walks the way back. 35 e2e pass, the new one six for
six at `--repeat-each=6`. 3,754 unit tests pass, 1 skipped (3,799 before,
less the 45 that went with the deleted code). `unreachable.mjs --list` at
zero.

### One answer for a word the Library skips (2026-09-08, SAK-409)

There were two `entryForGlyph`s, and for 98 words they disagreed. Those
are the kebs the entries walk skips because another page already teaches
them: 30 particles and connectives a grammar recipe owns (だけ, まで,
しか), 25 counting duplicates (一つ, 一人, １００億, 二十歳), and the 43 day
and month forms the counters track owns (１日, ７月). `entries.ts` answered
`word:だけ`, an id no entry carries, and the Sky read that one; the index
loader answered null, and the shelf and the lookup modules read that one.
A minted id that resolves to nothing is a broken link that type-checks,
which is what `entryForGlyph`'s own doc had been saying about it.

The 55 with a page now name that page. `だけ` answers `grammar:dake`, 一つ
the ひとつ counting entry, 一人 the 〜人 construction page, off the same
three maps that make the walk skip them in the first place
(`GRAMMAR_VOCAB_DUPLICATE_KEBS`, `COUNTER_VOCAB_DUPLICATE_KEBS`,
`COUNTER_TAIL_FORM_ALIASES`); the redirect `canonicalMixupEntry` already
made for a mix-up recorded against one of these words. The Atlas dropped
those words out of its related groups and WordsWith left them unlinked;
both send a reader to the page that teaches the word now.

The 43 day and month forms answer null, as the loader always did. Their
`numbers:day` and `numbers:month` pages exist, but no map names them and
no per-form entry does either, so there is no id to hand back. Worth a
card if it ever matters; the three maps are what this one followed.

There is one function, in `entries.ts`, and `library-index.ts` re-exports
it beside `libEntry` and `knownFactsOf`. The loader's copy resolved a
kanji through a precomputed glyph set, `INDEX.kanjiGlyphs`, which nothing
reads now; the field is still written, and is the next thing to drop.

Checked with the SAK-400 dump before and after: every file identical
except the two `entryForGlyph` dumps, which changed on exactly those 98
kebs and are now byte-identical to each other. The home, Atlas and
practice payloads for the sample learner and an empty one did not move.
3,758 unit tests pass, 1 skipped (3,754 before, plus four for the rule).
35 e2e pass.

### A run you leave is there when you come back (2026-09-08, SAK-404)

Close the tab halfway through twelve cards and the twelve were gone. SAK-376
had deleted the old app's 2,700-line envelope for exactly this, which nothing
read, and left the `session` column on `progress` waiting for a Sky-shaped
replacement. This is that replacement, and it is four fields.

`src/sky/lib/quiz-run.ts` is the whole model: the deck as it was dealt (card
ids, in order), where the learner had got to, the answers so far, and what
the run was asked from, plus when it was left. The per-card open state is
deliberately NOT in it, so a card you were three tries into opens fresh on the
way back. That is the kinder reading of a run left an hour ago, and it keeps
the envelope to things that are already the shape the recorder wants.

**Two copies, and which one is authoritative.** The browser's copy is written
every time, signed in or out, and it is the one a resume reads: it is there
before the write function returns, so the page never waits on a round trip to
find out whether there is a run. For an account the same run also goes to the
`session` column, which is what survives a cleared browser or a second
machine. `readSessionRow` / `writeSessionRow` are back in the store, and the
write is a plain upsert rather than the history's compare-and-set: the column
holds ONE run, nothing is folded onto it, and the run you are answering now is
the run you should come back to. Its own test holds the property nothing else
would catch, which is that an upsert of a run never names the `history` or
`settings` column.

**Nothing merges on sign-in.** The key is the same one both ways, so a visitor
who signs in halfway through a run still has that run in this browser, resumes
from it, and carries it up with their next answer. It does not ride
`migrateLocalProgress`, which would mean picking a winner when the account has
a run of its own, and that is the between-two-devices question the card puts
out of scope.

**The two ordering traps.** Both are the same shape, and both were found by
reasoning about the write rather than by a failing test.

The run is read ONCE per page load, not live. The page that reads it is also
the page writing it, so a live value changes after every answer; and the deck
the page deals is worked out from what it read. A live read would re-deal the
cards under whoever was answering them, and the moment the first answer landed
`useLoaded` would drop back to null and the screen would say "Reading your
sky…" mid-quiz. `useRunAtOpen` settles the question once and `keepRun` moves
the answer on when it writes, which is what a later screen in the same page
load would find anyway. The Planetarium and the Observatory only ever offer a
run, so they take the live value through `useSavedRun`.

And a write that would say the same thing twice is not made. `SkyQuiz` reports
where it stands the moment it mounts, and on a deck nobody has answered yet
that is nothing to keep. Without the guard, opening the quiz would clear the
column on every visit, and, worse, would throw away the run the learner had
not yet decided to replace, in the window between arriving on a different deck
and answering its first card. Starting a different run replaces the old one
when its first answer lands, which is the moment there is something to replace
it with.

**What a learner sees.** `/quiz` opened on the same ask deals the saved deck,
in the order it was dealt, on the card that was next, with the answers already
given still counted against it. Opened on a different ask it asks first,
through `InlineAsk` (SAK-364): "Only one run is kept, so starting this one lets
that one go", and "Keep it" goes back to the run you had. The Planetarium and
the Observatory carry one line beside the heading, "Continue where you left
off?" with the deck's size and how far in, linking to wherever that run is
answered. Finishing clears it. Practice runs the same way, keyed by its
recipe, so its line goes back to the practice deck rather than to the quiz.

A lesson's later rounds keep nothing: they are the same deck dealt again over
a rest, and coming back to a page offering round two of three as "the run you
left" is a worse answer than no offer at all. The rest between rounds already
survives a reload on its own key.

**The gate.** 3,788 unit tests pass, 1 skipped, from 3,754: the model's own,
the two store primitives against a fake `progress` table, and `runHref`. 36
e2e pass: the new one answers two cards as a visitor, reloads, finds the third
waiting, walks in from the home's own offer, and watches the line go once the
run is finished. A signed-in learner cannot be driven end to end here, since
auth is off in the e2e build, so the store tests are that half of the card's
gate.

### One way to open and close things (2026-09-08, SAK-412)

The Sky had five ways to fold something away. The home's Details bar was one
enormous button with the bare word "Show" at its right end. A lesson card's
sections were native `<details>` elements wearing whatever triangle the browser
felt like drawing. The "why?" behind writing early was a dotted-underline word
in an 11px caption. The stroke chart's overflow hid behind a small underlined
"Show all 29 strokes". The phone menu was the uppercase word "Menu". Meanwhile
the panels that slide aside, the quiz's rail and the Atlas's, had settled on
`RoundButton`: a glyph in a hairline circle. Sam liked that one. Now every fold
is that one.

**The glyph rule.** A panel that moves sideways keeps `‹` and `›`, pointing the
way the panel goes. Content that folds down gets `⌄` when closed and `⌃` when
open: the arrowhead points the way the content is about to travel, down as it
unfolds, back up as it shuts. That is the whole rule, and it is the reason not
to reach for `+`/`−` or a rotating triangle: a chevron already tells you which
direction the thing you cannot see will arrive from.

**When words stay beside the button.** A glyph cannot name a section or carry a
count, so the words stay wherever they say something the chevron cannot:
"Details" and its discovered count on the home, each fold's title on a lesson
card, "Why?" in the caption that raises the question, "All 29 strokes" over the
folded frames, and "Menu" in a header row that otherwise says nothing about what
is behind it. Nothing keeps a word that only means "open" or "closed": "Show",
"Hide", "Less" and "Show fewer" are all gone, because that is the chevron's job
and saying it twice is the page explaining itself.

**What each one is wired to.** `RoundButton` gained exactly one thing, an
optional `controls` for `aria-controls`; it already carried `aria-expanded`, and
its size and border did not change. Every fold now names what it opens rather
than what it is doing to it: "Show the details", "Open Readings", "Show the
reason why", "Show all 18 strokes", "Show the pages". A lesson card's `Fold` is
no longer a `<details>`, because a `<summary>` cannot hold the button without
becoming a click target of its own, so it holds its own open state and renders
its body only when open.

**The gate.** 3,792 unit tests pass, 1 skipped, unchanged: none of this is
model code. 41 e2e pass, from 36. Not one of these five folds had a test before,
so each got one that opens it, looks for something only the opened fold shows,
closes it and looks again. The phone menu's runs at 390 wide, which is the only
width it exists at. Screenshots of all five, closed and open, before and after,
went to Sam on the card.

### Four things Sam saw on the live site (2026-09-08, SAK-413)

**The parts a kanji is built from.** The Atlas's built-from cut was fifty-odd
chips in four rows, half a screen of them between the count and the first tile.
It is one control now: a chip that says what is picked, and a floating card of
components behind it. `SkyMultiSelect` (`sky-multi-select.tsx`) is the new
piece, and it follows `SkyMenuChip`: the same `Floating` over `SkyCard`, closing
on a click elsewhere, on Escape, and on any scroll. The card holds a real
`listbox` with `aria-multiselectable`, which takes the focus when it opens,
carries `aria-activedescendant`, walks on the arrows, and toggles on space or
enter. Its 868 options are cells in a grid, eight to a row, rather than rows in
a column: they are single characters, you find one by its shape, and 109 rows
beats 869. Left and right walk a cell, up and down walk a row.

It takes several parts, and a kanji has to carry all of them. That is what the
cut is for (SAK-325): a character is in front of you and you can name two of its
pieces, so naming the second should narrow the answer, not widen it. The
components are offered rarest first, because a common radical cuts almost
nothing, and the counts are off the face of it. The few components with no
character of their own, filed under a catalogue name like `CDP-8BC4`, are not
offered: a name you cannot recognize on sight is never the one you reach for.
Rarest-first does put 氵 and 口 at the very end of the grid; that is the order
the card asked for, and it is one comparator to flip.

**The readings.** They are a table, and they were flex rows: the reading came
first, so か and じつ and にち each pushed the hear button and the word list to a
different x, and a long list of words wrapped back under the reading. Three
columns now, in this order: the hear button, the reading, the words. The button
leads because it is the one cell that is the same width on every row. ONE grid
holds both the on'yomi and the kun'yomi lists, their eyebrows spanning it, so
the two share columns instead of each measuring its own; the `ul` and `li` are
`contents`, so the rows are cells of that grid while the list stays a list. A
word's own readings are the same table.

**The round button's glyph.** Centering the box does not center the ink, and Sam
saw the `⌃` riding high. Two things push it, and neither is visible to
`place-items-center`. The text baseline sits `(ascent − descent) / 2` below the
middle of any line box, 4.5px down for the UI font at 13px; and each glyph then
draws its ink its own distance above that baseline, 6.8px for `⌃` against 0.5px
for `⌄`, which is a 6.3px spread inside a 28px circle. So `sky-button.tsx`
carries a shift per glyph, measured with `measureText().actualBoundingBox*` in
the font that actually renders it and rounded to the half pixel a 2x screen can
draw. Re-measure them if the UI font or the button's font-size changes; nothing
else moves them.

**The old app's colors.** `why.tsx` came over in SAK-398 still wearing
`text-text-muted`, which on the night wash is a warm near-black a shade off the
panel behind it: the fold opened onto text nobody could read. The opened
paragraphs are the body of the fold, so they take `text-sky-ink`; the caption
above stays `text-sky-muted`, being a footnote to its section; "Why?" takes
`text-sky-accent`. The three other files from that move were swept for the same
classes: `stroke-order.tsx` twice, `pitch-mark.tsx` once, and `hear-button.tsx`,
whose `text-accent` was reaching for the Sky's accent all along.

**The gate.** 3,792 unit tests pass, 1 skipped, unchanged: none of this is model
code. 43 e2e pass, from 41. The two new ones are the two behaviors worth
holding: the built-from control takes a second part from the keyboard alone and
narrows to the kanji carrying both, and a readings table's three columns each
have exactly one x. Before-and-after screenshots of all four went to Sam on the
card.

### The stars carry the state, the lines the shape (2026-09-08, SAK-338)

The constellation's look was a placeholder from the day it was written, held
open on purpose until the model underneath it was right. Three screenshots
from Sam said it could not be read. The reason was in one line of the
drawing: a line took its fade AND its dash from the standing of the star it
happened to point at, so the same edge between the same two stars read
differently depending on which way round the layout drew it, and the sky's
warmest color, coral, was spent on "slipping".

Five rules, and the paint moved into `src/sky/lib/constellation.ts` so they
can be held to in a unit test rather than only seen.

**Lines carry the shape and nothing else.** Every line is `--sky-link`, 1.25
wide, at 0.8 (a first cut at one pixel and 0.45 was too faint to read, Sam,
2026-09-08), and none of them is dashed. A line to an undiscovered star is
not drawn at all: solid for anything discovered, nothing for anything not (Sam, 2026-09-08; a first cut faded
it to fog instead). The lesson's accent still takes over the lines at the
star the panel is showing, and something singled out elsewhere still takes
every other line back to 0.12. `linePaintFor(a, b)` gives the same answer
whichever way round the pair is handed to it, which is the whole point.

**State lives on the star, in its glow.** Solid reaches 4, getting there
2.5, shaky 1, and nothing below that glows at all (a first cut at 6, 4 and
2 made a solid star a blob beside its parts, Sam, 2026-09-08). Sizes are
still by role.

**Slipping is a star going out**, not the friendliest thing on the sky: it
keeps its coral, dimmed to 0.7, and loses its glow. A thin ring was tried as
the mark and Sam did not like it (2026-09-08), so the dimming is the whole
mark, and no dashes are needed anywhere. Untested has no glow either but
wears a faint halo, star-mid at 0.15, two past the body; undiscovered is a
bare dim dot.

**Tonight is a mark, not a state.** Picked for tonight is a wide soft halo in
star-mid, three past the body at 0.14 (nine was five times a piece star's
width, Sam, same day), drawn round whatever the star already
is: a shaky pick is still shaky underneath, with its own color and its own
glow. `lit` and `emphasis` still take a star over completely, as they did.

**The key is the drawing.** The legend's marks are stars now, drawn by
`StarGlyph` through the same `paintFor` and the same `BodyFigure` the sky
uses, at the same relative sizes, and the key behind the legend's "i" spells
out tonight as a seventh row. A flat colored dot said nothing about a glow
or a ring, so reading the key told you a color and left the rest of the
drawing unexplained.

Unchanged on purpose: the wash, the standing colors, the bodies (planet,
asteroid, binary), and every position. What did change beyond the rules is
that a glow now scales with the constellation's `unit` the way the star's own
radius always did; it used to be a fixed pixel count at every size.

`constellation.test.ts` pins all of it: the glow per standing, no ring, the
two halos, tonight over each standing, and the line rule from both ends.
`e2e/sky.spec.ts` gained two, one that no line on the home sky is dashed or
any color but the link's, and one that the key draws seven stars.

One more from the same review: a two-member group no longer links its
members to each other. Their parent already joins them, and the third line
drew a sliver of a triangle that read as a bundle once the lines were
bright enough to see.

### Three more from the live site (2026-09-08, SAK-414)

**Built from means any of the parts.** The cut above shipped as an AND: a kanji
had to carry every part picked. The argument was that naming a second piece of
a character you are staring at should narrow the answer, and on the page it did
not narrow, it emptied. Choose 丆 and 丈 and the Atlas said "Nothing here built
from 丆 and 丈", because the list of parts the app holds for a character is
short and two pieces you can see in one character are almost never both on it.
So the picks are a union now: show me the kanji made of any of these. It always
answers something, the count only grows as parts are added, and the line above
the tiles says "built from 丆 or 丈" rather than listing them with a middle dot
and leaving the reader to guess which it meant. The empty state, which now
needs a status beside the parts to happen at all, says "or" too.

**The two whys are two whys.** The stroke section asked two questions and gave
one answer twice. "We don't recommend learning to write early. Why?" opened on
the stroke-order rationale and then on the paragraph about handwriting and
technology; and under the chart, "Stroke order is worth learning with each
character. Why?" opened on that same rationale again, word for word, because
both read it from one shared constant in `src/data/why.ts`. But they are not
one question. Why the order matters is what the rationale answers, so it stays
with the why under the chart, where the order is on the screen. Why not to
learn writing yet is what the handwriting paragraph answers, and that is the
whole of that fold now. Not a word was rewritten: one paragraph moved, the
shared constant went with it, and each why owns its text where it is argued.

**One chevron, turned over.** A fold drew `⌄` when it was shut and `⌃` when it
was open, and those are not one shape the two ways up. In the UI font `⌄` is a
narrow, tall, pointed v and `⌃` is a wide, flat arrowhead, so shutting a fold
swapped the glyph rather than turning it, and Sam read the shut one as a
letter. There is one glyph now. `RoundButton` draws `⌃` and rotates it 180
degrees whenever `expanded` is false, so a caller passes the chevron and says
whether its fold is open, and which way it points is `sky-button.tsx`'s
business. The measured shift from the section above is untouched for the
upright case and is exactly negated for the turned one: the rotation is about
the span's own middle and CSS turns the ink before it moves it, so ink that sat
2.5px above the middle sits 2.5px below it, and the same number the other way
brings it back. `‹` and `›` were checked at 6x and are already each other
turned over, same weight and same size, so they were left alone.

**The gate.** 3,792 unit tests pass, 1 skipped, unchanged: none of this is
model code. 44 e2e pass, from 43. The built-from test now asserts that a second
part ADDS kanji rather than emptying the shelf and that the count line reads
"or", the writing-early fold's test looks for its own paragraph, and the new
one opens both whys and holds that neither carries the other's words.
Before-and-after screenshots of all three went to Sam on the card.

### Everything inside a button sits in its middle (2026-09-08, SAK-415)

Sam saw the lesson's "Tonight, in order" rail sitting high in its pills, and
SAK-413 had already found the round button's chevron riding above the middle of
its ring. Two sightings of the same thing is a rule, not a pair of bugs: every
button in the Sky draws what it holds on its own middle. The interesting part
is that you cannot check that by reading the classes. `items-baseline` looks
like alignment. `place-items-center` looks like centering. Both can leave the
ink somewhere else, and only a measurement says so.

**The gate is a measurement.** `scripts/button-centering.mjs` drives a
production build with Playwright, finds every button-like element on seven
pages, and compares each container's border box against what is inside it. A
child element is its own box; a child text node is a `Range` over it and the
union of the rects that range draws. Anything more than a pixel out is
reported with the page, the container, the child and the signed offset, and the
script exits non-zero.

Three things are taken back out before comparing, and each is a case where an
offset is right. A screen-reader-only child is not on the screen at all, and is
recognized by the `clip: rect(0,0,0,0)` every such helper sets rather than by a
class name. An out-of-flow child is placed by its own offsets and not by the
container's alignment, which is how the top bar pins the current page's
underline to the bottom of its entry and how an `ItemCard` bleeds its watermark
off its own corner. And a measured ink shift is not a box that is off:
`RoundButton` moves its glyph's SPAN so the glyph's INK lands on the ring's
center, so the shift is read back off the computed `translate` and undone. The
first cut of the script had none of those three and reported 31 offenders, 27
of which were the page being right.

There are also two rules, not one. Children that all overlap vertically are a
row, and each of them has to center on the container. Children that do not
overlap are a stack on purpose, an Atlas tile drawing a glyph over its name, so
it is their union that has to center, which is the same padding question one
level up.

**What it found.** 1,378 button-like elements over the seven pages, 4 of them
over a pixel, all four in the lesson rail: the label 1.62px high, the glyph
1.87px high. Everything else was already right, and the before and after
screenshots of a chip, the top bar and a round button are identical files.

**What moved.** The rail's row was `items-baseline`, and a row that holds two
sizes at once hangs the smaller off the taller one's baseline and lifts the
pair off the row's middle. It centers now. That exposed a second thing:
centering a row centers each child's MARGIN box, and `Eyebrow` writes an `mb-1`
of its own, so the eyebrow was still two pixels high. The call site had asked
for `mb-0` since the day it was written and had never once got it, because
Tailwind orders `mb-0` before `mb-1` in the sheet and the component's default
was winning over the caller. `!mb-0` is what makes the ask stick, and the row
is 3.25px shorter for those four margin pixels leaving. Sixteen other call
sites pass a plain `mb-0` to `Eyebrow` and are all quietly in the same
position; that is its own ticket.

Five more rows had the same baseline shape without being over the threshold:
the Atlas's selected-item pills, a lesson card's star buttons, a session's row,
and the quiz's card list and results list. They center now too, on the rule
rather than on a number.

**The gate.** The script at 0 over 1px, from 4. 3,801 unit tests pass, 1
skipped, unchanged: none of this is model code. 46 e2e pass, unchanged, since
nothing here changes what a page does. Before-and-after screenshots of the rail
row, a chip, the top bar and a round button went to Sam on the card.

### The rail says what tonight teaches, and what it rests on (2026-09-08, SAK-416)

Sam opened a lesson for 電車 and read "Step 1 of 8". Four of those eight steps
were a term, one was an intro, and three were the thing she had asked to learn.
`/lesson?picks=kanji:日` was worse: "Step 1 of 4", of which Kanji, Radical and
Kun'yomi and on'yomi were three. Meanwhile 日, which is under 電 and already in
her sky, was drawn on the constellation, was clickable, and was in no list at
all. Clicking it said "Already in your sky, so tonight doesn't re-teach it.
Here for reference." to a learner who had no way of knowing it was there to
click.

**One list became two.** "Tonight, in order" is what tonight teaches: the
pieces, then the character, then the word, and the step count is the count of
those. "References" under it is what tonight rests on and does not teach: the
stars already in the sky under tonight's picks, then the terms and intros the
walk put behind them. 電車 reads "Step 1 of 4" now, with 日 and four pages in
the second list. The card's apology is gone, and with it `LessonCard`'s `known`
prop, which nothing else read.

**Neither half is a hand list.** The known stars fall out of the graph the
lesson already walks: `graph.orderOf(pick)` without the groups, keeping the
nodes the learner is already carrying. The terms and intros fall out of the
app's own teaching walk, which is the thing that decides a kanji with readings
puts Kun'yomi and on'yomi in play and a kanji with parts puts "How a kanji is
built" in play. That walk was already running and its pages were already being
built through `teach.ts`; all they gained is a one-word `why`, "term" or
"intro", so a row can be labeled without reading the page. `lessonReferences`
in `src/sky/lib/lesson.ts` assembles the two halves, drops a page whose star is
not tonight's, and names each page once however many stars put it in play.

**A reference is not a step.** `lessonSteps` lost its `pages` argument
entirely: a page is a reference now and can never be a step, so there is no
list a page can be in twice and no count to keep in step with a second one.
Opening a reference goes through the lesson's own `open`, which for an id that
is not a step neither checks a lock nor calls `onOpen`. That exposed something
the known stars on the constellation had been doing quietly since they became
clickable: "Step n of N" was read off whatever was SHOWING, so opening a known
star reset the lesson to step one. Where the lesson stands is its own piece of
state now, and only a step moves it.

**One row, two lists.** Both lists draw `RailRow`, which is the row SAK-415
measured and centered, with its `items-center` and its load-bearing `!mb-0` in
one place instead of two. A star row is a glyph and a gloss, a page row is a
name, and a reference row adds the eyebrow that says what it is: "Term",
"Intro" or "In your sky". An empty References list is not a panel.

**Two panels, one scroller.** The first cut gave each panel its own
`overflow-y-auto`, and the column split its height between them: the order
scrolled 電車 out of sight while the references sat there complete. The column
scrolls now and each panel is as tall as its content, which is the shape
SAK-359 wanted anyway.

**The gates.** 3,807 unit tests pass, 1 skipped, from 3,801: six for the
references (a kanji whose parts are known, a word whose kanji are known, a
fresh learner with only the terms and intros, the order of the two halves, a
page behind a star that is not tonight's, a page named twice). 47 e2e pass,
from 46. `node scripts/button-centering.mjs` finds 0 over a pixel on the lesson
page with the new rows on it. Before and after screenshots of both lessons went
to Sam on the card.

### The Planetarium at a quarter size (2026-09-08, SAK-411)

Sam reported the home sky smooth at 100% and above, and lagging once it is
zoomed out: tooltips, panning, and zooming a little. `scripts/planetarium-perf.mjs`
is the measurement, against the production build: it sets the zoom through
the page's own minus button, which steps by 1.3, so a target of 60% is
measured at 59% and 25% at 21%, and at each stop it counts the SVG elements
in the DOM, drags 300px over about a second, wheel zooms, and hovers twenty
stars. Headless Chromium draws as fast as it can rather than at 60Hz, so the
floor in every number below is about 9ms rather than 16.7; what they say is
what a frame costs, not what a monitor would show.

**The sky the home opens on was never the problem.** The pretend learner has
641 things discovered and undiscovered stars are filtered out to start, so
that sky is under four thousand elements at its smallest and drops nothing
at any zoom, before or after. The Undiscovered chip puts the other 23,332 up
there, which is the fifteen thousand constellations, and that is the sky
this section is about. The legend already warns that showing more at once
makes the sky slower to draw, and it was right.

| zoom | elements | slow frames in a drag | p95 frame | worst frame | on release | wheel p95 | tooltip |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 100% | 25,996 to 9,990 | 1/197 to 0/180 | 10.3 to 9.9 | 33.3 to 10.3 | 33.0 to 10.3 | 82.4 to 10.1 | 26.2 to 8.0 |
| 59% | 46,886 to 17,989 | 3/194 to 0/210 | 9.9 to 9.9 | 75.6 to 18.3 | 57.3 to 26.0 | 75.3 to 9.2 | 50.9 to 8.4 |
| 35% | 83,236 to 31,968 | 6/242 to 1/241 | 18.0 to 10.3 | 141.7 to 40.1 | 116.7 to 66.9 | 116.6 to 10.2 | 74.4 to 7.6 |
| 21% | 175,191 to 67,153 | 62/256 to 1/256 | 57.3 to 16.9 | 309.7 to 109.8 | 301.2 to 191.7 | 259.9 to 41.6 | 190.3 to 16.3 |

Milliseconds, and a slow frame is one over 32.

**What the numbers said, in the order they said it.** Not the transform:
writing it on the group and forcing layout costs 2ms with 175,000 elements
in the DOM, measured on its own. Not hit testing either: turning
`pointer-events` off on all 37,702 hit circles changed nothing. A
MutationObserver over one pan said what it really was, 5,988 elements added
and 6,128 removed while the finger was still down, and the same observer
over one hover said 217ms with not a single DOM change to show for it. Both
were React: state set on a gesture, and state set on a hover, on the
component that draws the whole field.

Three changes, each measured before the next was chosen.

**A gesture does not render.** A drag and a wheel write the transform
straight to the group and commit the view once, at the end. That took the
adds and removes out of the drag entirely, and the wheel from 18 slow frames
to 15. It also fixed two older mistakes that came from reading the raw
stored view where the clamped one is what is on screen: the first drag on a
fresh sky did nothing at all, and the first zoom threw the sky to the
world's top left corner instead of keeping the center it opened on.

**A star that is one dot is one element.** Most of the sky is undiscovered,
and an undiscovered star has no glow, no halo, no ring and full opacity, so
it was a group holding a group holding one dot: 78,054 elements drawing
nothing. That cut 175,191 to 104,855 and, on its own, did almost nothing to
the frame rate, which is worth writing down. By then the cost of a frame had
moved to painting.

**The sky finds the nearest star itself.** The last of it was 37,702
transparent hit circles, each an element, a hit-test target and a tab stop,
and at that zoom each about half a pixel across, so there was nothing there
to aim at anyway. Above a couple of thousand stars they go, and a pointer
move looks up the nearest star in the positions the field has already
placed, through the browser's own matrix for the pan and zoom group so it
stays right through a gesture the field never hears about. Eight pixels of
slop, which is what a hit circle is worth at 100%. That is the change that
moved the pan, from 62 slow frames to one, and the tooltip, from 190ms to
16.

**What did not happen.** The canvas. The card kept it as a last resort and
the numbers never called for it: the p95 at the smallest zoom is 16.9ms,
under the 32 the gate asks for. Nor did anything get drawn less: no glow was
skipped and no line was dropped, so the sky looks the same at every zoom,
not only at 100%.

**Two trades, both deliberate.** The field keeps the cull band it had until
a gesture ends, so a long drag at the very smallest zoom can reach past its
one cell of slack and show sky that has not been drawn yet, which fills in
on release. At 100% a 300px drag is a third of one cell, so it cannot happen
there. And a sky of tens of thousands of stars has no focusable stars: 37,702
tab stops were not access to anything. A sky of a few thousand keeps its
circles and everything that comes with them, which is the lesson's sky and
the Planetarium's own preview.

**The gate.** The look at 100% is byte for byte what it was: the whole page,
the sky panel, the whole sky with everything showing, and the whole sky at
21% pinned to the same corner, all at 2x, all zero different pixels. The
21% shots have to be pinned to compare, because the reset button honestly
lands somewhere else now. 3,801 unit tests pass, 1 skipped, unchanged. 47
e2e pass, one more than before: a drag moves the group, the group is the
same element it was, and nothing is added to it or taken out of it while the
drag runs.

### Ten things the review found, finished (2026-09-08, SAK-419)

A read-only review of the day's seventy commits found the components clean and
the layer boundary intact, and ten things to finish. All ten are in, one commit
each.

**One builder, one page-data helper.** `practice-client.tsx` carried a
byte-identical copy of `hrefs.ts`'s private `packRecipe`, and four call sites
across it and `quiz-client.tsx` still wrote `sample ? "sample&" : ""` by hand.
The copy is gone and the four go through `skyHref`, which is now the only place
a Sky URL is assembled. `quiz/page.tsx`, `practice/page.tsx` and
`practice/run/page.tsx` were the three routes still working out sample, userId
and who for themselves and splitting a `cards=` by hand; they ask `whoFor`,
`initialFor` and `idsFrom` like the six that already did. The quiz's `wayBack`
went through `skyHref` with them, since it was the last hand-rolled `?sample`
in the file.

**The eyebrow's margin is a prop now, and SAK-417 is done.** `Eyebrow` wrote
its own `mb-1`, and Tailwind orders `mb-0` before `mb-1` in the sheet, so
fourteen call sites asked for no margin and never once got it, while two had
found `!mb-0` and worked. Asking is a `tight` prop, which the component
answers, so there is nothing for two classes to argue about. Two of the
sixteen are in files another lane holds tonight and keep their class for now,
one of them the `!mb-0` that does apply.

**Names.** `sky-quiz.tsx` had two doc comments stacked over `back`, one of them
left from before the way back knew where it went. `practice-client.tsx` had two
bindings called `saved` twenty-four lines apart, of unrelated types: the run is
`savedRun`. `sky-practice.tsx` had a `chosen` inside a map shadowing the
`chosen` outside it, which the README had already named and left; the inner one
is `cutIds`, which is what it holds.

**A pass for exports, one level under the file walker.**
`scripts/unreachable.mjs` asks whether anything loads a file, so everything a
loaded file exports rides along however private it really is. Three names had
been found by hand: `NO_RUN`, standing in for a literal `null` in one line of
its own test, and `runProgress` and `QUIZ_RUN_KEY`, read only by the modules
that declare them. `scripts/unused-exports.mjs` asks the question of a name:
it walks every import in `src`, the scripts and the specs, and prints what no
other file asks for.

It reports TWO lists and fails on the first. The first is a name nothing
outside its own file imports at all, where there is nothing to weigh: either
the module reads it and the `export` comes off, or nothing does and the name
goes. That list was 106 and is zero. `DEFAULT_SETTINGS` and the lesson's
`LessonState` had no reader anywhere and are gone, `sky-scene`'s re-export of
`STANDING_ORDER` went with them, and 104 keep their names and lose the keyword:
props interfaces, module-private constants, helpers.

The second list is a name whose only importer is the test beside it. That one
prints and does not fail, and the distinction is the point. `NO_RUN` was in it
and deserved deleting. The other twenty-seven are things like `standingOf`,
`scatterLayout` and the wash file's `layerCss`: a lib module's unit test is a
real reader of exactly the surface the module exists to offer, and clearing
that list by reflex would delete tested work rather than tidy it. `runProgress`
went anyway, as the review asked, because `runNote` is its one caller and its
two assertions read better through it.

**A class name is not a selector.** `e2e/sky.spec.ts` found the quiz card's
row with `[class*="md:flex-row"]`, so renaming a utility would have quietly
passed the test instead of failing it. It walks the card now: one surface, and
the row is the last thing on it.

**One glyph named in a row.** Sessions and Practice each wrote out the same
four classes and the same tooltip for a glyph sitting beside its English, and
the Atlas a third variant in its "built from" line. `GlyphName` in `glyph.tsx`
is that piece: the UI face rather than the display one, its standing's color,
the Japanese font the character wants, and the whole of it in the title when it
has a column to fit in. `cut={false}` is the third case, a glyph named inside a
sentence, which takes the sentence's size and hides nothing.

**Nineteen props, then seventeen.** `startAt`, `startAnswers` and `onProgress`
arrived on SAK-404 and are one idea, so they are one `run` prop: where the run
was left, what was answered there, and where to say it stands now. Splitting
the file is a separate card and was not touched.

**And no em dashes in what we write to each other.** The SAK-235 lint rule
looks at strings, template literals and JSX text on purpose, so comments were
never covered, and the day's work put em dashes into fresh lines of comment.
The test beside that rule gains a second one that reads the files as text,
because a comment, a doc block and a line of README are all just characters.
Sixty-eight lines were rewritten with a comma, a period, a colon or
parentheses, whichever the sentence wanted, and none of them says anything
different. Scoped to `src/sky`, `src/app/(sky)`, `e2e` and the two READMEs:
`src/lib` and `src/data` carry thousands from before the rule, that is its own
job, and a gate nobody can reach zero on teaches people to skip it.

**Two temporary skip lists, and why.** SAK-416 held `sky-lesson.tsx`,
`lesson.ts` and `teach.ts` tonight and SAK-411 held `sky-home.tsx`,
`sky-field.tsx`, `constellation.tsx` and `constellation.ts`, so neither the
export pass nor the em-dash test was allowed to edit them underneath another
session. Both lists say so in place and say they are temporary. `src/sky/README.md`
is on the em-dash list too, at nine lines, because it is the one file every lane
appends to; it gets its own pass once they are all in. None of the seven held
files carries an em dash today, and between them they carry twenty unread
exports for whoever clears the lists.

**The gates.** `npx tsc --noEmit` and `npx eslint` clean. 3,802 unit tests
pass, 1 skipped: 3,801 as before, plus the new em-dash test, with
`quiz-run.test.ts`'s two `runProgress` assertions rewritten through `runNote`
and its `NO_RUN` line reading `null`. 46 e2e pass, unchanged, before every one
of the ten commits. `scripts/unreachable.mjs --list` stays at zero,
`scripts/unused-exports.mjs` is at zero on its failing list, and
`scripts/button-centering.mjs` measures the same 1,378 elements with none over
a pixel, identical to SAK-415's after.

### A practice deck asks by ear and by pitch, whatever Settings say (2026-09-08, SAK-426)

Sam was 98 questions into a 202 card practice run with both switches on in
Settings and had not been asked one question by ear or one about pitch. Neither
could have happened, for two unrelated reasons, and both of them were in
practice alone: the lesson quiz was asking both all along.

**By ear.** `quizCards` makes a card a listening card only when it is handed
`audio`, and then only half the time. The lesson quiz hands it over:
`quiz-client.tsx` passes `cfg.audioPrompts` and `cfg.pitchQuestions`, and
`loadQuiz` falls back to the account's saved Settings for a signed-in learner
who did not. `practiceCards` called `quizCards(history, facts, now)` with no
options at all, so the flag was off for every practice card ever dealt, and no
draw of any size could turn one up. It takes an options object now,
`practice-client.tsx` passes the same two the quiz passes, and
`loadPracticeCards` reads the account's Settings through `extrasFor`, which is
the settings read lifted out of `loadQuiz` so the two actions cannot drift.

**By pitch.** A word's pitch is a registered fact and deliberately not a listed
one (see `data/pitch-facts.ts`): `factsOf` and `knownFactsOf` hand back a
word's reading and meaning and nothing else, so the Library's index is
unchanged and the app's own lessons do not gain a card they cannot draw. The
Sky's lesson quiz adds the fact itself, per word taught. Practice built its
pool from `knownFactsOf`, so a pitch fact never reached it, and a recipe asking
for picking from choices could not produce a pitch card however long it ran.
`asksOf` adds it now, for a vocabulary entry the registry has a pitch fact for.
`askOf` already read a pitch fact as "pick", so the ask side needed nothing.
8,626 of the 12,555 words carry one.

The two settings are read where they were always read, and only the deck's own
step is new: with pitch questions off, `practiceCards` drops the pitch facts
from the drawn facts before a card is built, which is the filter `quizFacts`
already does for the lesson quiz. The preview counts the pool as it stands, so
a word is in it for its pitch whether or not tonight's deck will ask.

**The tests say the quiz did not change.** Two in `quiz.test.ts` and three in
`practice.test.ts`, all with `Math.random` pinned so a coin flip cannot decide
whether a test passes: `quizCards` over a dozen typed word facts deals a
listening card with `{ audio: true }` and none without; a lesson deck for a
word with a pitch question carries a card whose id ends in `/pitch` with
`{ pitch: true }` and none with `{ pitch: false }`; and a practice deck of
words asked for their meaning and for picking does the same two, plus the pool
itself carries pitch facts and every one of them asks "pick".

**The voice cache did not move.** `scripts/list-speakable.mjs` walks
`teach.ts`, `observatory.ts` and the library entries, none of which this
touched, and a practice listening card plays the same word reading or kana
glyph a lesson listening card plays. It reports 15,536 items walked, 12,116
strings and 8,089 exact pitch clips, all of them in a seeded set, nothing
uncovered. Nothing was seeded.

**The gates.** `npx tsc --noEmit` clean and `npx eslint src e2e scripts` clean
(the one error `npx eslint .` reports is a parse error in
`docs/audits/workflows/06-content-style-voice.mjs`, committed on 2026-08-29 and
untouched here). 3,839 unit tests, 3,838 passing and 1 skipped: five more than
the 3,834 that were there, the five above. 48 e2e pass, unchanged, the whole
`sky.spec.ts` twice over. `scripts/unreachable.mjs --list`
at zero, `scripts/unused-exports.mjs` at zero on its failing list. And a
practice run driven on the pretend learner, over a recipe of words asked for
their meaning and for picking, deals both: a card headed LISTEN with a play
button, the word hidden and "Listen, then type what it means", and a pitch card
asking which of two clips means "rate", the two of them written out as りつ with
their pitch marks once the hint is asked for.

### The kana under a word she is supposed to know (2026-09-08, SAK-429)

Sam sent a screenshot of a meaning card: 行く, いく under it, "Type what this
word means." Her words: "when i'm supposed to know the word, don't show the
kana when it's kanji. that can be a hint instead."

She is right about what that line does. The card asks what 行く means, and いく
under it hands the reading over, so the question stops being about the kanji
and becomes read the kana, say the word, remember what you said. The half that
is actually hard is sitting there as decoration.

The line is not always wrong, though. The first time a word is asked, the quiz
is still teaching it, and its reading and its meaning are taught together. So
the rule turns on whether the learner has met the fact at all: never asked and
never claimed keeps the kana where it was, and anything else moves it behind
the Hint button.

That test lives in `quizCards` (`src/app/(sky)/quiz.ts`), not in the engine's
prompt. The engine builds a prompt for a fact and has no idea who is looking at
it, and the old app's callers still want the reading printed. `quizCards` is
already the place that reads the learner's history for `seen` and `missed`, so
it is the place that can tell the two showings apart.

A word that already had a hint keeps it. 明白 breaks down into "明 is bright, 白
is white", and the reading goes above that on its own line, so pressing Hint on
a known word gives めいはく first and the breakdown under it. `QuizHint` writes
its text a line at a time now and picks the face per line, so the Japanese line
is in the Japanese face and the English one is not. That is the whole of the
change to the hint's rendering, since SAK-427 is rebuilding the rest of it.

Three things are untouched. A reading card keeps its context, because there the
context is the glosses and they are what tells 日's にち from its ひ. A kana word
never had a reading printed under it, since the reading is the glyph. And a
listening card keeps its own hint, the written form, because its glyph is off
screen and there is nothing on it to take away.

**The gates.** `npx tsc --noEmit` clean and `npx eslint .` clean apart from the
parse error it already reports on `docs/audits/workflows/06-content-style-voice.mjs`,
which is there on a clean tree too. 3,839 unit tests pass and 1 skipped, six of
them new: the first sight, the asked word, the claimed word, the word with a
breakdown, a kana word, and a reading card. 48 e2e pass. `unreachable.mjs
--list` at zero, `unused-exports.mjs` at zero on its failing list. Two
screenshots of 明白 in the sample deck, before and after Hint, on a build of
this branch on a spare port.

### The Quiz is four files now (2026-09-08, SAK-420)

`sky-quiz.tsx` was 546 lines with seventeen props, and it had grown three
times that day: the resume (SAK-404), the reveal's explanations (SAK-315,
SAK-316) and the saving line (SAK-410). It is the one file the quality review
named to watch. Nothing else in the Sky is near it.

**Where a pass has got to is one object.** The screen kept four things for one
idea: which card is in front of you, what has been answered, whether the deck
is done with, and, threaded through every handler, the answers as they would
be after the answer that had not settled yet. `lib/quiz-pass.ts` is that idea
and the moves between them: `openPass`, `withAnswer`, `nextOpen`, `stepTo`,
`finishPass`, `answeredCount`, `allAnswered`, `passAnswers`. The component
holds it in one `useState`, so a settled answer and the position it leaves you
on are the same object rather than two that have to agree.

It is pure and imports no React, and that is not taste. The unit tests run
under `--conditions=react-server`, where `useState` does not exist, so a hook
here could not be tested at all. Eighteen tests: opening on nothing and on a
saved run, wrapping past the end so a skipped card comes back, a miss staying
on its own reveal, the last answer finishing, a step out of range handing back
the same object, deck order with a card the deck no longer has.

Not to be confused with `lib/quiz-run.ts` beside it. That one is the small
envelope a pass is written down as, so it survives a closed tab; this one is
the pass while it is being answered. They meet twice.

**The results screen records the run it is showing.** The recording belonged
to the Quiz and the saying-so belonged to the results, so the Quiz held a
`saved` state it never drew and threaded it through. `QuizResults` is the
container now and owns both: the answers go the moment it appears, which is
the click that ended the quiz, and the line under the list says where that has
got to. `HowItWent` under it is the screen and knows nothing about promises.
The state opens at "saving" rather than at nothing, because by the time
anything is painted the answers are already on their way and a first frame
saying nothing would be a flicker rather than news. It sends once, behind a
ref, because React runs an effect twice over in development on purpose and
this one writes to a schedule. `SaveState` lost its `export`.

**Six props were about a screen the Quiz does not draw.** `back`, `onFinish`,
`onRetry`, `onSave`, `savedNames` and `next` are the end of the deck, and the
room where questions are asked has an opinion about none of them: they travel
as one `results` prop, typed as `QuizEnding` where the results screen declares
it. `retries`, `onRetries` and `timerSeconds` are the quiz's own two settings
and its clock, so they are a `settings` prop. `SkyQuizProps` is ten: cards,
grade, toKana, hear, pitch, results, settings, run, title, height. It was
nineteen when the card was written.

**And then the drawing.** Those three left the file at 543 lines, three under
where it started: what came out was dense state and what went in was doc
comments. The size is what the card is about, so one more seam.
`quiz-board.tsx` is the half of the card with no opinions. `QuizPrompt` is the
top of it and the four ways one prompt is drawn, which is a fact about the
card rather than a choice: a sound, a glyph inside the word it is asked in,
Japanese, English. `QuizOrder` is a sentence to put in order. `QuizChoices` is
the board of options. Each takes what to draw and where to send a click, and
holds nothing. The typed box stays with the loop, because it is one line
inside the form the loop submits and pulling it out would mean handing over
the box's ref, the transliterator and the grader to save four lines.

**The numbers.** `sky-quiz.tsx` is 460 lines and ten props, from 546 and
seventeen, and from the 542 and nineteen the card was written against. Beside
it: `quiz-results.tsx` 211, `quiz-board.tsx` 156, `lib/quiz-pass.ts` 110 with
137 lines of test.

**Nothing was redrawn.** Every class string in the moved markup is the same
string in the same order; the two that read differently do so only because
`state.built` is `built` and `card.order` is `order` on the far side.

**The gates.** `npx tsc --noEmit` clean and `npx eslint src e2e scripts`
clean, before each of the four commits. 3,852 unit tests, 3,851 pass and 1
skipped, up eighteen on the new module. 48 e2e pass, `e2e/sky.spec.ts`
untouched, and they are the proof this is invisible: they answer a card, take
a reveal, resume a run after a reload and watch a finished quiz say it is
saving. `scripts/unreachable.mjs --list` at zero, `scripts/unused-exports.mjs`
at zero on its failing list, and `scripts/button-centering.mjs` measures the
same 1,380 elements over seven pages with none more than a pixel out.

### Two counts and a missing label (2026-09-08, SAK-428)

Sam read "106 items" on a recipe and got a run of 202 questions, and read the
whole of 知れる on its Atlas page without being told it was a る-verb. Both are
a number or a word the page already had and never said.

**An item is not a question.** A deck is one card per fact and an item carries
as many facts as it has things to be asked, so the pool's length was never the
run's length: 12,457 words are 23,012 questions. `PracticePreview` carries
`questions` now, summed over the whole pool in `practicePreview` rather than
over the `PREVIEW_CAP` items the preview actually sends, so a pool past the cap
still says how long it is. The panel reads "12,457 items, 23,012 questions",
and an item left out by hand takes its own facts out of both counts the same
way it already came out of `matched`.

**"About" is doing real work.** A limited draw is a random share of the pool,
so its questions are a rate and not a total: ten items out of 12,457 is about
18 questions, and which ten you get decides whether it is 16 or 21. The word
"about" appears only in that case, and "All of them" says the exact number
because it is exact. One item and one question take the singular.

**The word's group was computed all along.** `wordFormKind` in
`src/lib/word-forms.ts` has named every conjugating word since the old lesson
code, and nothing in the Sky read it. The teach block carries `wordKind` now,
the label with the entry that explains it, and `teach.ts` sets it for a word
that conjugates and leaves it off one that does not. 知れる is a る-verb, 知る an
う-verb, する an irregular verb, 静か a な-adjective, 高い an い-adjective, and 猫
is nothing at all.

**A chip that goes somewhere.** It renders as `SkyChip` in its unlit tone,
which is the muted informational look rather than the accent, on its own line
under the meanings and above "Written with". A tap opens the page for the
group: Godan/ichidan for the verbs, Keiyōshi/keiyōdōshi for the adjectives.
That page has to travel with the word for the tap to land, because the Atlas
panel picks by id out of the items it was handed, so `atlasEntryFromHistory`
offers the entry and puts it in the closure. Neither concept has a term of the
same name, so the concept entry is the page; `readAbout` in `atlas.ts` is the
rule for the ones that do. `onRead` is a separate prop from `onSelect` on
purpose: the Atlas can reach another page and the lesson and the quiz review
cannot, and without it the chip still says what it says.

**The gates.** `npx tsc --noEmit` clean, `npx eslint src e2e scripts` clean.
3,846 unit tests pass, 1 skipped, twelve of them new: two in `practice.test.ts`,
one counting a pool's questions both under the preview cap and past it and one
taking an excluded item's questions out with it, and ten in a new
`teach.test.ts` on the word kind. 49 e2e pass, one more than the
48 before: the practice panel reads "items, about N questions, drawn at
random", and 知れる's chip opens Godan/ichidan. `scripts/unreachable.mjs --list`
at zero, `scripts/unused-exports.mjs` at zero on its failing list,
`scripts/button-centering.mjs` at 0 elements over 1px over the 1,380 it
measures. The chip is on none of that script's pages, so it was measured on its
own: 0.000 px between its text's middle and the pill's.

`npx eslint .` still reports one parsing error in
`docs/audits/workflows/06-content-style-voice.mjs`, which is on main and is not
this lane's; `npx eslint src e2e scripts` is the clean run.


### The 317 stories that named a part their glyph does not have (2026-09-08, SAK-424)

**What the 317 were.** SAK-421 put a mechanical check beside the origin stories:
`src/data/etymology-components.test.ts` reads the pieces a story names, in the
two shapes the house style uses, and asks whether the glyph actually has them.
Of the 2,136 stories a learner can reach, 317 named something that is not there.
知 was told as "an adult (大), a mouth (口), and a child (子)" while the tiles
beside it read 矢 and 口. 容 named 公, 早 named 棗, 改 named 巳, 就 named 享.
They were pinned in a `SAK_421_LIST` so a new one would fail loudly, and left for
this card.

**The rule they now obey.** A story may name only the glyph's own parts, or a
part of one of those parts, as `KanjiRow.comps` records them and the variant map
collapses them, so a story that writes 水 meets a tile that draws 氵. Where the
true origin is disputed or unknown, the story says so instead of inventing one:
"How the two came to mean knowing is not settled" is a finished sentence, not a
gap. All 317 were rewritten in eight batches of about forty, the test run after
each, and `SAK_421_LIST` and the stale-entry test that read it are gone. The
check now asserts zero exceptions with no list at all.

**The reader pass.** Eight Sonnet readers, one per batch of forty, each given
SAK-418's rubric and its forty stories and nothing else: no knowledge of the app,
no sight of the other batches. Object only where a standard source contradicts
the story; a story that says the origin is unsettled is not a doubt; mark a doubt
high only when the objection is certain and the reference settles it.

They raised **36 doubts: 17 high, 16 medium, 3 low.** Every one was read here
against the glyph's own Wiktionary record in `src/data/generated` before anything
was touched. **33 stories changed. 3 were read and left standing.**

| Batch | Doubts | High | Medium | Low |
|---|---|---|---|---|
| 1 | 3 | 1 | 2 | 0 |
| 2 | 4 | 2 | 2 | 0 |
| 3 | 5 | 3 | 0 | 2 |
| 4 | 5 | 2 | 3 | 0 |
| 5 | 7 | 3 | 4 | 0 |
| 6 | 4 | 2 | 2 | 0 |
| 7 | 4 | 2 | 2 | 0 |
| 8 | 4 | 2 | 1 | 1 |

**What changed, and why.** Three kinds of thing came back.

The first is a piece the generated record names that no standard source does.
Wiktionary's parse gave 冶 as 呂 and 刀, 宰 as 乂, 慶 as 廌, 最 as 宀, 難 as 暵,
色 as 爪, 貴's sound as 中, 設's as 埶, 維's as 唯, 知 as 大 with 口 and 子.
Shuowen settles all ten the other way, and the rewrite follows Shuowen and says
which source it is following: 慶 is an abbreviated 鹿, 最 sits under a cap 冃,
難's sound is 堇, 色 is a person over a kneeling one, 設 joins speech and a
weapon with no sound piece at all. 知 keeps 矢 and 口 and says outright that how
they came to mean knowing is not settled, because no source has the adult and the
child that the record invented.

The second is a role swapped. 句 had the sound on 口 and the meaning on 丩;
Shuowen has it the other way (从口丩聲), and the story now does too. 焦 had the
bird carrying the meaning and the fire the sound; Shuowen is 从火雥聲, so the
fire means and the bird sounds. 翌 called 羽 the sound piece when 羽 is what
became of a 日, and the sound is 立. 外 and 旦 and 法 were told as sound-and-
meaning compounds when the standard reading of all three is ideogrammic: evening
plus divination, the sun over the ground line, water and 廌 and 去. Each now says
what the source says and, where a second reading exists, names it as a second
reading.

The third is a gloss on the shape that is simply not what is drawn. 威's axe is
戌, and the story says so; the invented history in which one axe became another
is gone. 帥's left side is 𠂤, the piece 師 shares, not a pair of hands. 替 sits
on 曰, not 日. 別 and 拐 are drawn with 另 on the side the record calls 冎. 里 is
a field over soil and always has been; the sentence claiming its strokes had
merged is gone. 見 is an eye on a pair of legs. 練's sound piece is 柬, which the
Japanese form writes 東, and saying it that way round leaves nothing to trip on.
勇's 甬 has a 用 in it that flattened into the 田 drawn here, not a 田 of its own.
奪 held a 隹, not a 雀. 向's 口 is a window, not a mouth making an echo. 微, 更,
昔 and 形 each named a sound piece the sources do not give and now name the one
they do, or say the shape's history is unsettled. 退's food vessel 皀 belongs to
the 即 and 既 family and not here; its foot now walks away from a setting sun,
which is what the glyph's own record says.

**Read and left standing, with the reason.** Three, all low confidence.

- **就.** The reader doubted the older form's temple 享 on the ground that
  Shuowen reads 就 as 京 plus 尤 with no substitution. The glyph's own Wiktionary
  record names 享 and 京, so the story is following a source rather than inventing
  one, and the reader said itself that it knew of none for the substitution
  either way. The sentence already marks it as the older form.
- **差.** The reader would have the hand rubbing 禾 rather than 來. The record in
  `src/data/generated` names 來, wheat, as the semantic piece, which is what the
  story follows. Two grain pictographs that look alike is a real question and not
  one a story here should settle against its own source.
- **那.** The reader objected to "the sound of 二, which the record writes 冉".
  That is the house pattern used across the file for exactly this case: the piece
  drawn is 二, the record's is 冉, and the sentence names both. Rewriting this one
  alone would make it the odd sentence out.

**A second pass over the 33.** The 33 rewritten stories went back to a fresh
reader, same rubric, no sight of the first round. It raised three: 威 high, 慶
medium, 帥 low. 威 was right and is the one real find of the round. The component
data records 威 as 戍 plus 女 where every source has 戌 plus 女, and the first
rewrite tried to narrate that difference as if it were history. It says the axe
is 戌 now and nothing about 戍, which is the true sentence; the decomposition is
what is wrong, and fixing KanjiVG's row for 威 is its own card. 帥 was right too:
師 is 帀 with 𠂤 and neither piece is a sound piece, so 帥's story no longer says
𠂤 gives 師 its sound. 慶 was left: the reader wanted Shuowen's 夊 where the story
writes 夂, and 夂 is both what the glyph draws and what the data records. A third
reader over those three raised nothing at all, and quoted Shuowen's entry for 慶
as 从心从夂, the 夂 the story already had.

**Ten for Sam to spot-check on Jisho.** Picked at random from the 317, none of
them among the 36 the readers doubted, so they sample the rewrite rather than the
repair. Jisho's kanji page lists the parts; the check is whether the story names
any piece that is not on that list.

| Glyph | The tiles beside it | The story's first sentence |
|---|---|---|
| 凍 | 冫 東 | This glyph means frozen. |
| 膚 | 虍 胃 | This glyph means skin. |
| 族 | 方 𠂉 矢 | Arrows (矢) gathered beneath a flag: a clan, a tribe. |
| 旨 | 匕 日 | This glyph means delicious, and by extension the gist of something. |
| 豪 | 亠 口 冖 豕 | This glyph means overpowering and great. |
| 絶 | 糸 色 | A knife cutting silk threads (糸): to sever, to cut off, to break away. |
| 奏 | 𡗗 天 | This glyph means to play music, and to present something to a ruler. |
| 撤 | 扌 育 攵 | This glyph means to remove or withdraw. |
| 闘 | 門 豆 寸 | This glyph means to fight, to war. |
| 危 | 𠂊 厄 | A person at a cliff edge above someone kneeling (卩): a dangerous, fearful height. |

**The gates.** `src/data/etymology-components.test.ts` at zero exceptions with no
list, and its reach counts unchanged: 2,136 stories, 199 about the traditional
character, 74 for a glyph with no recorded decomposition. `kanji-etymology.test.ts`
keeps the prose plain: the rewrite tripped its jargon pin once, on the word
"phonetic" in 旦, and that sentence says "carrying the sound" now. `npx tsc
--noEmit` clean, `npx eslint src scripts` clean, 3,833 unit tests with 3,832
passing and 1 skipped, the em-dash test among them. `npx eslint .` still reports
one parse error in `docs/audits/workflows/06-content-style-voice.mjs`, which
predates this card and was not touched. Nothing outside `src/data` and this file
changed, so the e2e suite was not re-run.

### The grammar card says what kind of word it is (2026-09-08, SAK-427)

Sam, on a practice run of 〜てはいけない, twice. On 知る, a word she knows, the
hint read "This is the 〜てはいけない pattern. uses the て-form": "i know it's
the 〜てはいけない because that's in the question. it should tell me that this
is a ru-verb or u-verb or something or if it's irregular, say that." On しれる,
drawn in kana because she has not met it, the question read "Type how this word
is said in the 〜てはいけない form": "when an undiscovered word is given to
conjugate and it's a ru or u verb or i/na adjective, say how do you say this
x-type word in ... rather than making the user have to guess."

**One missing argument, and both screenshots.** `quizCards` rolls the vehicle
(the verb this showing is drilled on), hands it to the prompt and to the board,
and then called `hintFor(fact, dir)` and `quizInstruction(fact, dir, mode)`
without it. Both take one. With no vehicle there is no word whose class could
be named and no word to fill the pattern gloss's X with, so the hint fell back
to the pattern name and the instruction to the old form-named sentence. Every
line Sam objected to is the no-vehicle fallback of a card that had a vehicle
sitting in a local three lines up.

**Naming the class is not a gate.** `ruVerbKindOf` and `adjectiveKindOf` answer
a narrower question: is this word's class in doubt from its SPELLING? They were
built to decide whether an unmet vehicle may be dealt at all, so they speak only
for a る-ending verb and withhold from an irregular whose paradigm label would
point at the wrong rule. Silence is a safe answer for a gate and the wrong
answer for a learner asking what kind of word is on her card, which is why 書く
got nothing (its ending "gives it away", to a reader who can already read it)
and する got nothing either. `wordKindOf` in `word-forms.ts` is the labeller for
that second question, and it answers for every conjugating class: う-verb for
the nine regular godan, る-verb for ichidan, い- and な-adjective, and irregular
verb for する, 来る, 行く, 問う, ござる and ある. `wordFormKind`, the badge on a
word's Forms heading, is now that function with the row's class looked up, so
the Atlas and a quiz card cannot disagree about 行く. It moves 行く's badge from
う-verb to irregular verb, which is what its て-form has always said.

The list of irregular classes is written out rather than pattern matched. The
obvious shortcut is "a hyphenated v5 is special" and it is wrong: v5aru (ござる)
carries no hyphen. That file's own header is about a map that was built twice
by matching on the tag string and missed the special classes both times.

**The class line first, then the arithmetic.** `grammarHint` used to lead with
"This is the X pattern", which the question has spelled out since SAK-193. That
line is now the LAST thing said rather than the first: it survives only on
しか〜ない, whose drilled verb slot lives on `recipe.wrap.close` where the
vehicle picker, `deriveProduction` and `formHintText` all cannot see it, so
there is neither a class nor a form to name instead. Everywhere else the hint
opens with "悩む is an う-verb", written in the script the rest of the card uses
(the surface once she has met the word, kana while she has not), and then shows
SAK-194's derivation under it: 悩む − む + んで → 悩んで, then 悩んで + はいけない
→ 悩んではいけない. "an う-verb" and "a る-verb" read by sound rather than by
first letter, the same table `derivation.ts` keeps for the same five words.

**The derivation reached the card at last.** It has existed since SAK-194 and
the Sky never drew it: `grammarHint` returns `{ kind: "derivation" }` and the
card mapper kept only `image` and `text`, so it fell out on the way. `QuizCard`
gains `hint.steps`, a list of already-written lines, because `src/sky` does not
import the engine that builds them; `derivationLines` in `derivation.ts` writes
them, in the format that file's own header uses. `QuizHint` draws the class line
in the UI face and each equation under it in the Japanese one, down the page so
the second reads as the first one continued.

Worth saying plainly: the last equation ends in the built answer, and the hint
opens while the card is still live. That is the leak SAK-198 closed on the OLD
app's drill, and it is being reopened here on purpose, because it is what Sam
asked for and because asking for a hint already costs the card its grade
(`gradeFor(… || state.hinted)`). If she wants the equations held back until the
card resolves, the pieces are all in place: `derivationNudge` is the safe
one-line version and the reveal is the place to move the rest to.

**The question names the type of an unmet word.** "How do you say "must not
しれる" for this る-verb?", and now "for this irregular verb" and "for this
う-verb" too, since `wordKindOf` has an answer for those. A word she HAS met
keeps the plain "word": its class rides in the hint instead, where it does not
crowd the sentence. `showableWhenUnknown` in `vehicles.ts` is untouched, and
deliberately: naming 行く as irregular tells a learner that its 音便 must be
memorized, not what it is, so it still may not be dealt on a free pick.

**The gates.** `npx tsc --noEmit` clean; `npx eslint .` reports only the one
parse error in `docs/audits/workflows/06-content-style-voice.mjs` that is
already on main and is not ours. 3,844 unit tests pass, 1 skipped, up from
3,838: `wordKindOf` over every class, `derivationLines` over its three shapes,
the class line for a known う-verb, an unknown る-verb and an irregular, the
instruction naming an unmet non-る verb and an unmet irregular, and two on
`quizCards` itself, that every grammar card's hint names a class and no grammar
card's question still says "said in the". 48 e2e pass.
`scripts/unreachable.mjs --list` at zero, `scripts/unused-exports.mjs` at zero
on its failing list, and `scripts/button-centering.mjs` measures 1,380 elements
with none over a pixel.

### A particle is taught right before the sentence it is for (2026-09-08, SAK-430)

Sam sent a screenshot of the Observatory's "Sentence rules" section holding
nine cards at once: 〜は marks the topic, 〜が marks the subject, and に, で, を,
へ, まで, だけ, か behind them. "these are all missing from the atlas i think.
also i think the ordering is wrong here. i don't think we should be teaching
all of these at once. i think we should teach just what's needed for the next
sentence type."

She was right on both counts, and the second one had a cause. The section was
the grammar track in its own order, `CURRICULUM_PATTERNS`, minus what the
learner had met. That order groups patterns by what they DO, so the nine case
particles sit in one run right behind the て patterns, and a learner who had
finished those met all nine as their next row. Worse, the ten sentence TYPES
that the particles exist to build (Simple, Te-form links, Requests, Want to,
Conditional, Because, Giving, Even though, Must, I think) had a library entry,
a teach walk and an offer shape, and no section on the Observatory offered
them at all. The picker taught the parts and never named the thing.

**The order is data now.** `src/lib/sentence-rule-order.ts` computes one list
from the shipped tables. The adjective and noun form leads, as the track
already has it, since the word classes it teaches come before everything. Then,
for each sentence type in turn: its `grammarPrereqs`, all of them, in teaching
order, because the learner has to be able to read the type's examples; then the
patterns the type's own curated sentences actually use, most used first; and
before any of those, the form it is built on when the track teaches one, which
is the rule grammar-shelf.ts already runs on. Then the type. Then, after the
last type, every recipe no type ever asked for, in the track's own order.

The first three come out like this:

    〜な  は  が  を  に  で  だけ  [Simple sentences]
    〜て  〜ている  〜てから  〜てしまう  〜てみる  〜ておく  [Te-form links and helpers]
    〜てください  〜ない  〜ないでください  〜ます  〜ましょう  [Requests and proposals]

"the first type is simple so i don't think we need all of these, right?" is
answered by counting rather than by taste. Simple's eight curated sentences use
を five times and に, で and だけ once each, and never へ, まで or か. So Simple is
preceded by は and が (its prereqs) and by を, に, で and だけ (what its sentences
turn on), and the other three wait for the tail with the rest of the leftovers.
Every recipe appears exactly once, every type exactly once, and 124 steps cover
114 recipes and 10 types.

**The Observatory stops at the next type.** The section is not the first nine
of a long list any more; it is what the next sentence type needs and then that
type, and nothing past it. That is Sam's sentence back as a rule, and it makes
the section short by construction, so it lays out whole (`show` on the section)
rather than being cut nine cards in, which could otherwise drop the very card
the other eight lead up to.

**A type you cannot start yet keeps its place and says so.** Everything else
that cannot be taken is left off the page entirely, which has been the rule
since 2026-09-04 and is still right: a locked card with no story is furniture.
A sentence type is the exception, because its POSITION is the teaching. "Simple
comes after は and が" is the lesson, and a missing card teaches nothing. So
`ItemCard` takes a `gate`, draws the hairline border instead of the muted one,
mutes its name, and gives its bottom line to what opens it: "Opens once you
know は or が". It is a div, not a button, so it cannot be clicked, cannot be
tabbed to, and is not in a shift-range.

The words say "or" because the app's rule says or. `sentenceTierUnlocked` in
sentence-ordering-plan.ts wants ANY one of a type's prereqs plus enough
sentences in its pool, and that function is now `sentenceTierBlock`, which
keeps the reason instead of throwing it away. The Observatory reads it rather
than restating it, so the picker cannot offer a lesson the planner would
refuse. Every shipped type clears its own sentence floor today, so the grammar
half is the only gate anyone will see; the other half is tested on a type asked
to want ten thousand sentences.

**The Atlas's Sentences shelf is cut into the types.** It was one flat list of
the ten, so a reader looking for は under Sentences found nothing: the particles
were on Grammar, cut by the FORM they attach to, which answers "how is this
made" and never "what is this for". Now there is a section per type in the same
order, each holding the type and then the grammar placed before it, so は sits
under "Simple sentences" and 〜てから under "Te-form links and helpers". A
pattern is on two shelves, which is allowed and already true of the number
construction pages, and the two cuts answer different questions. The leftovers
stay off: a pattern no type needs has no type to sit under, and an "Other"
bucket here would put half the grammar table on a shelf called Sentences.

One thing to look at: the shelf's header still reads "2 of 10 Sentence Rules
Known" over 50 tiles, because a shelf's total counts its own kind and the
grammar riding along is counted on Grammar. That is exactly what Counting
already does with its construction pages, so it is left alone rather than
changed on the way past.

**What was not touched.** Nothing in the sky's standing order or the
constellation layout reads `CURRICULUM_PATTERNS`; the only reader left in
`src/app/(sky)` is the sample learner, which takes the first five patterns to
give the dev pages a started track. The Planetarium's `beyondWords` walks the
library by kind and never an order, so it is unaffected.

**The gates.** `npx tsc --noEmit` clean. `npx eslint .` reports only the parse
error in `docs/audits/workflows/06-content-style-voice.mjs` that is already
there at HEAD and is not ours. 3,851 unit tests pass and 1 is skipped, up from
3,840: seven for the order, five for the Observatory's section, four for the
shelf, and two for the block. `atlas-catalogue.json` was rebuilt with
`build:catalogues`, since the Sentences shelf's cuts are baked into it. 49 e2e
pass, one more than before: the section runs to a sentence type, the type
opens, and its lesson teaches its walk. `scripts/unreachable.mjs --list` is at
zero, `scripts/unused-exports.mjs` at zero on its failing list, and
`scripts/button-centering.mjs` measures 1,382 elements over seven pages with
none more than a pixel out.

### What you said on the way to the answer, and a chip that turns its page (2026-09-08, SAK-425)

Two things Sam found in one quiz on 知る with 〜てから, and they are unrelated
except that both are the reveal.

**The retry history was never lost. It was never drawn.** A card answered
after a retry showed the right answer and nothing else, so walking back to it
with ‹ lost what the learner had actually said, which is the part of that card
worth looking at. The obvious reading is that the state throws the attempts
away: the per-card `Open` is deliberately not kept across a reload (SAK-404),
and `Open.said` is where an attempt is added as it is made.

It is not where an attempt ENDS UP. `settle` copies the list onto the answer,
`QuizAnswer.said` has held every attempt in order since SAK-387, and
`quiz-run.ts` has read and written that field since SAK-404, so a run left
part way through has always carried it into the next page load. What was
missing was in `QuizVerdict`, which listed the attempts only when
`grade === "missed"`. So the fix is one derivation and one line of markup, and
the work was proving the claim rather than making it true: the three tests
that hold it are in `quiz.test.ts` (the derivation), `quiz-run.test.ts` (the
field round-tripping through storage) and `quiz-pass.test.ts` (a pass opening
on it), which are the three places the list travels through.

`triedBefore` is the derivation, in `lib/quiz.ts` beside `tally`. On a card
that was answered in the end, the LAST thing said is the answer, and the
answer is already drawn large on its own line; what the reveal was missing is
everything before it, so it is `said.slice(0, -1)`. On a missed card there is
no right answer to be before, so it hands back nothing and SAK-387's line
under the answer is left exactly as it was. A card answered first time hands
back nothing either, which is the same code path and not a special case.

The wrong ones are ABOVE the answer, struck through in `sky-slipping`: "You
said ~~zzz~~ before this." Above, because that is the order the two happened
in and the answer should be the last thing read. Struck through, because the
card asks for them MARKED as wrong and a list of things you said with no mark
on it reads as a list of things that were accepted. `Attempts` is the sentence
both lines are made of ("A", "A, then B", "A, B, then C"), which the missed
line was already spelling out inline.

And the results screen says what a card cost, from the same `tries` it has
always recorded: "With help" under a card that took two goes and one that took
three read identically, and the run knew the difference all along. It is a
second line under the grade, muted, and only when there was more than one go.

**The Family chip was a pager with nowhere to send a click.** `LessonCard`
draws a `Pager` when a star is taught over several pages, and the Quiz draws a
`LessonCard` under a card it has just revealed. `onPage` was optional, the
Quiz passed neither it nor `page`, and `onPage?.(i)` on every chip meant a row
of buttons that did nothing: on 〜てから those chips are "〜てから" and
"Family", and Family is the cluster page `teach.ts` already builds from
`clusterOf`, listing 〜たあとで beside it with what each means and how each is
built.

So nothing needed wiring to the Atlas and no new panel was needed. The page
existed, the chip pointed at it, and the caller that drew both had no way to
turn one. The card keeps its own page when its caller does not, and drops back
to the first page when the star under it changes, since page two of 〜てから is
not page two of 水. A caller that DOES own the page (the Atlas, the lesson)
passes `page` and `onPage` and keeps owning it, unchanged. `Pager`'s `onPage`
is required now, so the next caller cannot draw a dead one by leaving it out.

"Do not render the chip when a pattern has no family" was already true and
stays true two ways over: `teach.ts` adds the Family page only when the
cluster has more than one member, and `LessonCard` draws the pager only when
there is more than one page at all.

**The gate.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean.
3,870 unit tests, 3,869 pass and 1 skipped, up eight. 50 e2e pass, two of them
new: one answers a card wrong then right, walks back to it, sees what it said
struck through above the answer, reloads and sees it again, which is the half
that proves the list is on the run and not on the open card; the other opens
〜てから's Family page from its chip and reads 〜たあとで out of the table.
`scripts/unreachable.mjs --list` at zero, `scripts/unused-exports.mjs` at zero
on its failing list, and `scripts/button-centering.mjs` measures 1,380
elements over seven pages with none more than a pixel out. Four screenshots on
a build of this branch on a spare port: the stepped-back card, a close crop of
the struck line, the results list with "after 2 tries", and the Family page
open behind its chip.

### The wrong half of a pair, in the data rather than the story (2026-09-08, SAK-431)

A kanji page puts the "Made of" tiles and the origin story next to each other.
威's story reads "A broad axe (戌) beside a woman (女): overawing, commanding
force", and its tiles drew 戍. Those are two characters, one stroke apart: 戌 is
the eleventh earthly branch, the dog, drawn as a broad axe; 戍 means to
garrison. SAK-421's components test had 威 on its list of 317 stories naming a
piece the glyph does not have, which reads as a story awaiting a rewrite. It was
the other way around. The story was right and the decomposition was wrong.

**Where the 戍 came from.** Upstream, and provably not from us. KanjiVG's
05a01.svg names the top-left piece twice, once per split half, as
`kvg:element="戍" kvg:variant="true" kvg:original="戌"`. The ingest
(`scripts/ingest/kanjivg.mjs`) keeps the element name and files the original in
the `variants` map, which is exactly right for 亻 and 氵, so nothing in our
pipeline invented this. KanjiVG then makes the same swap in the other direction:
inside 歳 and 滅 it writes `kvg:element="戌" kvg:original="戍"`. Our variant map
already refuses that pairing in both directions, as one of the nine mislabels
the audit of every `kvg:original` found (`variant-forms.ts`, `EXCLUDED`), so
neither character collapses into the other and whichever label KanjiVG picked is
what the tiles draw.

**Three sources, and then KanjiVG's own strokes.** Wiktionary, Shuowen and Jisho
all give 戌 + 女, and the first of those is already in the repo:
`generated/kanji-etymology.json` reads "Ideogrammic compound: semantic 戌 +
semantic 女". The drawing settles it without leaving the file that got it wrong.
戌 carries a horizontal inside the 戊 frame and 戍 carries a 丿 there, and
05a01.svg's third stroke sits in a group marked `kvg:element="一"` of type ㇐.
The glyph KanjiVG draws is 戌; only the name it wrote on it is 戍.

**Fixed at the layer that survives an ingest.** `kanji-components.json` is re-cut
from upstream, so a hand edit there is lost on the next run, and a source pin
would be wrong on its face: the pin table records what the source says, and the
source really does say 戍. `COMPS_OVERRIDE` in `kanji.ts` is the durable home and
already held 威, since KanjiVG splits the piece across two groups and the row
needed collapsing from three parts to two anyway. The entry now reads
`威: ["戌", "女"]` and says in place why, because it is the one entry in that
table that corrects a character and not just a count, and the table's own rule is
that it may only lower a count, never invent a part. The exception is written
down rather than left to be rediscovered.

**What moved.** `build:library-index` and `build:catalogues`, and a value-level
diff of the three files they rewrote shows 威's rows and nothing else: the atlas
tile's parts go from `["女","戍"]` to `["戌","女"]`, the sky item's first
component from `primitive:戍` to `primitive:戌`, and the library's component-use
map moves 威 out of 戍's host list and into 戌's, leaving 幾 and 蔑 under 戍 and
joining 滅 and 歳 under 戌. The three version hashes change with them.

**The other four hosts are untouched, on purpose.** 幾 and 蔑 really are built on
戍, the guard, and 歳 and 滅 really are built on 戌, so KanjiVG got four of the
five right and the correction must not spread. A new block in
`comps-audit.test.ts` pins all five: 威 is 戌 + 女 and contains no 戍, Wiktionary
says the same, the generated file still says 戍 so the override is doing the
work, and the four correct hosts keep their parts. If upstream ever fixes
05a01.svg, the third of those fails and the override entry can go.

**And a sweep for the same shape of bug.** Comparing every kanji's parts against
the Wiktionary record, restricted to the nine pairings the variant map refuses,
turns up four more places where the tiles draw one half of a refused pair and the
record names the other: 匹 (record 八, tiles 儿), 在 (record 士, tiles 土), 巡
(record 川, tiles 巛) and 替 (record 曰, tiles 日). None is the single-character
confusion 威 was, each needs a reading rather than a rule, and they are listed on
the card rather than changed here.

**The gates.** `npx tsc --noEmit` and `npx eslint src scripts` clean. 3,838 unit
tests pass, 1 skipped, up four for the new block. The components test is at zero
unlisted exceptions with its list one shorter: 威 came off it, and the count it
pins went from 317 to 316, which is the first entry taken off that list since it
was written. No page changed, so no e2e run.

### The underline was right and the comment was wrong (2026-09-12, SAK-422)

**What the 818 were.** `WordExample.span` said the span covers the word's
literal written form and is absent when the sentence inflects it. The source
pins found 818 of the 2,990 spans covering something else and had to record the
whole set as a deliberate difference so the suite would pass. Reading them
against their sentences: every one is the same word, written the way that
sentence writes it. ある underlined inside ありません, いただく inside
いただきます, 呼ぶ inside 呼ばなきゃ. The comment had simply never been updated
when SAK-97 moved the span out of a substring search in the TypeScript builder
and into `sentence_readings.py`, where a real tokenizer matches an inflected
surface back to its dictionary entry. The data was right. The comment was four
months stale and anything trusting it would have been wrong too.

**Two things the count had hidden.** Checking the 818 against the app's own
conjugator rather than against the comment separates "inflected" from "not this
word", and two groups fell out.

72 spans stopped one character short of the word. UniDic tags the て of a
て-form and the ば of a conditional as 助詞/接続助詞, not 助動詞, and the span's
auxiliary chain only absorbed 助動詞, so 包んでください underlined 包ん and left
で bare, and 守らなければ underlined 守らなけれ. That is the same half-a-word the
chain was added to prevent. The chain now also absorbs a following 接続助詞 whose
LEMMA is て or ば: lemma, not surface, is what makes で, ちゃ and じゃ one entry,
while leaving から, けど, ながら, ので and のに outside, where they join clauses
rather than inflect a word. 218 spans grew, all of them by て, で, ば or ちゃ;
none moved its start, and no kanji reading changed.

And one span was on the wrong word entirely. かえる in the vocabulary is 蛙, the
animal, and its example was 初心にかえりましょう, which is 返る. Its other
candidate, 卵がかえる前に, is 孵る. The tokenizer cannot tell the three apart,
because they all resolve to the surface base かえる, so a noun's page carried a
verb ending, which is a shape no noun has. Both ids go in
`WRONG_SENSE_EXAMPLES` and 蛙 has no example now, the same trade タイ and 脱出
already make. `EXAMPLE_COUNT` goes 2,990 to 2,989.

**The pin is a rule now.** `source-pins.test.ts` no longer records a count of
exceptions. It asks whether the underlined text is a surface of that word, using
`wordClassOf` and `conjugateAll`, the same engine the Forms section of the word
page is built from, so a span it rejects is a span the learner could not match to
anything the same page teaches. Three ways to pass: the span is the written form
or a generated form; it starts with one and continues, since the tokenizer
extends a span through trailing auxiliaries; or it agrees with a generated form
further than the word's invariant stem, which is what admits the colloquial and
composed surfaces the engine does not enumerate (招かれた, the passive past;
脱いじゃえ). The third clause is the loose one, so it is anchored on the stem:
a span on a different word that merely started with the same kanji does not
pass. Checked by moving one span one character to the right, which the test
catches. 2,172 literal, 817 inflected, zero neither.

**One more thing a regeneration needed.** Rerunning `sentence_readings.py` here
changed two kanji reading slots that had nothing to do with the span: some unidic
builds split 太鼓判 into 太鼓 + 判 and read the second half はん, the plain
on'yomi, where the committed file had ばん, which is correct, since 太鼓判 is
たいこばん with rendaku. The committed file was depending on which dictionary the
person rerunning happened to have. 判 is pinned in `SENTENCE_READING_OVERRIDES`,
the table that already exists for a tagger that is confidently wrong rather than
refusing, so the file is now the same on either build.

**One question the reading raised and did not answer.** 231 spans are the
written form plus a tail, because the chain keeps absorbing after the word
itself. For the 120 whose word is a na-adjective that is right: 危険です, 大好きな
and 裕福に are the word's own forms, and the app's Forms section shows them. The
other 111 are words with no conjugation class at all, where the tail is the
copula rather than an inflection: 仕事です, 写真だ, 台風なら, あいつなら. Nothing
there is on the wrong word, so the rule above accepts it, but whether a plain
noun's underline should stop at the noun is a call about what the highlight is
for, not something to settle inside a span check. UniDic's own tags cannot make
it either, since it files 危険, 便利 and 冷静 as 名詞 alongside 仕事 and 写真.
Left on the card for Sam.

**The gates.** `npx tsc --noEmit` and `npx eslint src scripts` clean. 3,913 unit
tests pass, 1 skipped, the same count as before: the span test was rewritten
rather than added to. No page changed, so no e2e run.

### Two forms the app was sure about, decided (2026-09-12, SAK-423)

The second conjugator (SAK-418) agreed with the app on 170,017 forms out of
171,872 and disagreed on 1,855. Two things account for 1,593 of those, and
neither was a bug on either side. They were choices nobody had made. Sam made
them.

**The causative-passive of an う-verb. Teach the long form, accept the short
one.** 泳がせられる is the regular derivation: build the causative, make that
passive, which is exactly the two steps the page already lays out. 泳がされる is
what people say. Both are right, and an app that pins one string and marks the
other wrong is teaching a learner that the Japanese she will actually hear is a
mistake.

So the tables did not change and the grader did.
`conjugate("泳ぐ", "v5g", "causativePassive")` still returns 泳がせられる, alone,
because a drill that pins two strings pins neither and a build table with two
cells in it teaches a choice rather than a rule. Beside it there is now
`alternateForms`, which answers the other question: what else would a speaker
say. It is empty for every form of every word except this one, and its whole
body is a class lookup and one `DerivedFormRule`
(`CAUSATIVE_PASSIVE_CONTRACTION`, せる off, される on) run through the same
`derive` the ordinary derived forms go through. Running it through that rather
than through a second copy of the trim-and-append is what makes defectiveness
free: ある has no causative, so it has no contracted causative-passive either,
and nothing in the alternate path had to be told.

The class list is in `policy.ts` and not in `rules.ts`, because which form the
app teaches is a teaching decision and so is which other form it accepts. It is
written out as ten named classes rather than as "godan, except v5s". The
predicate would be true today and would quietly enroll the next class somebody
adds, which is the shape of bug `POS_TO_CLASS` in `lib/word-forms.ts` has its
own header about getting wrong twice. **す-verbs are the exclusion that matters**:
話さされる is not a word, 話させられる is the only way to say it, and accepting a
contraction there would grade a non-word right, which is the same failure as
teaching one.

From the engine it travels one hop at a time. `apply` carries an optional
`alternates` beside its `value`, built by putting each alternate through the
recipe's own trim and add, so a pattern that hangs off the causative-passive
gets the alternate for free and a pattern whose trim the alternate will not take
simply drops it. `builtOn` in `lib/engine/question.ts` collects them from both
scripts and hands them to three places: `check`, which runs them through the
same `checkProduces` the taught spellings go through, so the accepted set grew
and the romaji forgiveness rule did not; `answerKey`, which is the browser's
twin of `check` and the surface that actually runs, so a key without them would
mark a learner wrong on the one path that matters; and the distractor filter,
which now refuses any wrong answer landing on a string the grader would accept.
`value` is untouched throughout, which is why the prompt, the reveal and the
option buttons needed no change at all: this is a second thing to accept, never
a second answer.

And the page says so. The causative-passive form page carries one more line
under its build tables, and the reveal mounts the same lesson card on the same
payload, so it is a line the learner sees after answering: "People usually say
およがされる; the long form is the regular one. す-verbs have no short form:
はなさせられる is the only way to say it." It is およがされる and not 泳がされる
because every example on these pages is kana and the table one row up says
およぐ. The す-verb half is there for the same reason the class list excludes
them: a learner told that う-verbs have a short form will invent one.

**The ずる verbs. The stem is じ everywhere now.** 演ずる used to keep two cells
on the older spelling, the ば form (演ずれば) and the literary passive
(演ぜられる). Both are real; both are the shape that has been leaving the
language. Modern usage is 演じれば and 演じられる, Jisho leads with 演じる, and the
second conjugator disagreed with the app on exactly those two cells for all ten
of these verbs. `VZ_FORMS` is now the plain ichidan table on a じ stem, and the
class stays a `paradigm` rather than becoming `ichidan` because 演ずる is not an
ichidan surface: drop its る and you get 演ず, not 演じ.

The paradigm grew a third variant, じる, listed between ずる and the bare ず. A
じる headword carrying the vz tag must build the same forms as its ずる twin
rather than be refused as malformed, and now the two spellings cannot disagree
about any form, which is asserted rather than assumed.

**The headword is not rewritten, and that is the one place this lands short of
the card.** The card asked for the dictionary form shown to become the じる
spelling wherever JMdict lists both. JMdict lists both for all ten, and the app
already carries both: 演じる and 演ずる are two separate entries with two
sequence numbers, two rows in `vocab.json`, two weights in the library index and
two sets of facts a learner has her own progress against. Rewriting 演ずる's
`keb` would not rename an entry. It would mint a duplicate of one that exists.
So the ずる entry keeps the spelling the dictionary gives it, the じる entry is
the one that teaches the modern spelling as it always was, and what was actually
missing is the sentence saying they are one verb.

That sentence is a `WORD_CONTRAST_PAIRS` row, which is the table that already
exists for two words a learner can answer correctly forever without ever
learning why there are two of them (いいえ and いや, SAK-229). Ten pairs, one
note each, written to read correctly from either side because the mechanism
resolves from either side: "演じる and 演ずる are the same verb, written two
ways. 演じる is the modern spelling and the one to use; 演ずる is the older one,
and you still meet it in print. The forms are the じ ones either way: 演じます,
演じられる, 演じれば." The three sample forms are read off the engine rather than
typed out, because the note's whole claim is that the forms are the じ ones and
a hand-written list could go on claiming it after somebody changed the table.
The note reaches the word's own page and the quiz reveal through `teach.notes`,
which is one field feeding both.

**The second conjugator's header was updated and its code was not.** Its ずる
note now records that the passive and ば disagreement was settled its way and
those 20 rows are gone from the diff; its dictionary-form rewrite stays listed
as its own bug, still open, because the entry keeps its own headword. Its
causative-passive branch keeps emitting the contraction, with a note saying the
1,573 rows stay in the diff as a teaching choice rather than an error on either
side. Patching it to match would turn the second derivation into a copy of the
first, and the whole value of the thing is that the two were written apart.

**No clip changed, and that is a finding rather than a shortcut.** The local
VOICEVOX container was started and `.env.local` copied in for it. Then every one
of the fourteen seed sets was dumped and read: the ずる verbs are spoken only as
their dictionary readings (えんずる, えんじる, both already cached), no set speaks
a conjugated vz form, the one ずれば in the whole corpus is a proverb sentence
and not something the engine builds, and the only causative-passive the app
speaks is たべさせられる, which is ichidan and has no contraction. The read-only
Storage audit agrees: 0 of 372,996 clips missing across all six voices, so 0
clips were seeded and 0 invalidated. `scripts/list-speakable.mjs` reports
nothing uncovered.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 3,934
unit tests pass, 1 skipped, up 21 from 3,913: the causative-passive contraction
at the engine and at the grading seam, the じ paradigm and its two spellings
agreeing, the page line, and the ずる note read back off the same `teach`
payload the reveal renders. Unreachable and unused exports both at zero. The
Sky's e2e spec passes.

### Nine leftovers from Sam's review of the In Review cards (2026-09-12, SAK-432)

Nine small things, each named on an earlier card and left there. The decisions
were already made; this is what each one turned out to be.

**A fold's whole title row opens it.** SAK-412 made the round chevron the Sky's
one expander and left the words beside it outside the click target, so the
home's Details bar was a bar the width of the page with a 28px target at one
end of it. Sam: "i prefer that the full bar be clickable to expand/collapse."
`FoldRow` in `sky-button.tsx` is that row: one button spanning it, carrying
`aria-expanded` and `aria-controls`, with the ring drawn inside it as a span,
since one button cannot hold another. The ring itself is written once now and
worn two ways, as the button in `RoundButton` and as a glyph in a row, so
SAK-413's measured ink shift and SAK-414's turned-over chevron stay in one
place rather than two.

Four folds have a title row and take it: the home's Details bar, a lesson
card's sections, the stroke chart's "All 29 strokes" line, and the "Why?"
caption. The phone menu keeps its own button, and that is the one judgment
call here: the row it sits in belongs to the logo, the nav and the account, so
there is no title row to make the target, and "Menu" is not a section's name.

The name is an `aria-label` rather than an `sr-only` word, because the row
already reads its own words aloud and a name appended to them would say the
section twice. Every label names its section ("Show the details", "Open
Readings"), so the visible words are inside the accessible name, which is what
WCAG 2.5.3 asks and what the existing e2e tests look the folds up by. The
ring's hover moved to `group-hover`, so pointing anywhere along the row lights
the chevron.

**A reference row wears the kind word.** The lesson rail's References panel
printed each page's own name for itself, "Intro" over "How a kanji is built"
and "Sound shift" over a dakuten page, while the Atlas files both under Terms.
The same page had two names depending on which screen you read it from. Sam:
"it should say term." The row reads `KIND_LABEL` now, the map the Atlas and the
Observatory read, where a mark and a concept both come out as "term".
`LessonReference` already carried the page's kind, so nothing new had to be
computed, and the name the walk wrote on each page had no other reader: it is
gone, and `push` takes one word instead of two. A star already in the sky keeps
"In your sky", because that is not a kind of thing but the reason the row is in
the list at all.

**An eyebrow refuses a margin it would only ignore.** SAK-417 gave `Eyebrow` a
`tight` prop and converted sixteen callers that passed a `mb-0` the component's
own `mb-1` beat; one survived on the home's Details bar, where it had been
doing nothing since it was written, and two more had found `!mb-0` and worked
by force. All three are `tight` now, and the prop refuses the class: a
`className` carrying any `mb-` only typechecks alongside `tight`, which is the
one arrangement where the caller's margin is the only margin there is. The
compiler catches a class written out; `sky-card.test.ts` reads the call sites
for the ones assembled at runtime, which the types cannot see, and it counts
braces rather than stopping at the first `>` because one call site's className
holds a `>` of its own.

**A reading nothing teaches yet says so.** The readings table gives each
reading three columns: hear it, the reading, the words it is read that way in.
Six of the 3,496 reading rows reach the third column with nothing to put there,
because every word that once attested the reading was dropped when the
vocabulary said it no longer takes it: 面's おもて, 開's ひら, 仏's ふつ, 埋's
うず, 畳's じょう, 背's せい. Those rows are dimmed now and the third column
reads "no word taught yet", which is also what the quiz gate says about them: a
reading is asked only once a word carrying it has been met, and there is no
such word to meet. The empty word list is the mark, so there is no second flag
to keep in step, and the test pins all six.

**A distractor that is a piece of the character gets its line.** SAK-315 gave
every wrong choice a sentence saying why it was on the board and left one of
its own examples unsaid: 曜 is 日 beside 翟, 翟 is 羽 over 隹, and an option
that is one of those is something you were just looking at inside the
character. The engine does not aim for these, it fills a board from the subject
at large and lands on one often: of the first 900 kanji, 120 of their meaning
boards carry a piece of the very character they ask about. The rung reads
`comps`, the taught decomposition the card's own "Made of" tiles draw, so the
line is true of what the app itself shows, and it sits below the flagged pairs,
since 借 is built on 昔 and is also drawn almost the same as it.

One thing the card asked for is not testable as written: 曜's OWN boards never
draw a piece of 曜. Its meaning board is filled from nearby meanings (spit,
daughter, flour) and its reading board from other readings, so the test pins
the rung on boards that do exercise it, 分's offering 刀 and 八 and 動's
offering 力, and pins 曜's decomposition beside them. The app's decomposition
also stops at 翟 rather than splitting it into 羽 and 隹, so the line on a 曜
board would read "a piece of 曜" about 日 or 翟, which is the same sentence
about the pieces the app actually teaches.

**The reveal says when two spellings are one long vowel.** SAK-316 left long
vowels out with a note saying the tables carry no flag for them. They do not
need one: holding a vowel for two beats is what おう and えい ARE, so the
reading itself says whether it holds one, and 443 of the 3,496 reading rows do.
The pair belongs to the VOWEL and not to a pair of characters, which is the
part worth writing down: こう and しょう and とう are all the same long お, and
a rule looking for the literal おう would have missed every one of them. So the
sentence reads the vowel each kana ends on, out of the kana tables the app
already teaches from, and asks whether the kana after it is one of the two that
can hold that vowel, う or お for a long お and い or え for a long え. The
vowel map is keyed by each table entry's LAST character, which is what makes
the small kana fall out for free: きゅ is one entry read "kyu", so ゅ is u, and
ちゅう can be walked character by character. A long う and a long い have one
spelling each, so their sentence offers no second one rather than inventing a
pair. It names the mark's Atlas page by reading the mark, so the page and the
sentence cannot drift apart.

**The last two clients read their data through the shared hook.** SAK-368
gathered "whose history, then its data, then the heading to draw while it
comes" into `useSkyData` and moved five clients onto it; the Quiz and Practice
were still writing the three lines out, and their loading screens repeated the
page's own title by hand. Both are on the hook now, the two practice headings
are constants, and `useWho` and `useLoaded` are no longer exported, since a
page that wants one of them wants both in that order. The six `height="100%"`
those two files passed are gone too: `SkyPageShell` has defaulted to it since
SAK-368, so every one of them was saying what would have happened anyway.

**And a prop nothing ever passed.** `Facet` in `sky-practice.tsx` carried an
optional `note` under its chips with a paragraph waiting to render it, and not
one of the five call sites passed one. SAK-371 found it and left it; it is
gone.

**U12, the two words the manual QA list doubted, and what the data says.**
Both entries are right, and neither needs a change.

こう as 侯: the vocabulary row is JMdict's own, 侯 read こう, glossed "marquis"
and "second highest rank of the five ranks of nobility", filed as a noun and as
a suffix. The reading fact is not anchored in 侯 at all: `reanchor` in
`kanji.ts` re-picks the earliest word attesting a reading at load, and it moves
this one off the generated file's 侯 onto 侯爵, so the card asks "what does 侯
read in 侯爵" rather than asking about the character inside itself.

はえ as 栄え: the row is JMdict's 栄え read はえ, glossed "glory, splendor,
honor", and it is the only 栄え in the set. It is what anchors 栄's は, and
nothing in our data reads 栄え さかえ, so there is no ambiguity for a card to
fall into. The one thing left is a curation question rather than a data error,
and it is Sam's: 侯 ranks 10,819th of 12,553 words and 栄え 10,547th, both of
them tails that a learner meets only by asking for them, and whether words like
these belong in the learner-facing set at all is a decision about the shelf,
not about the row.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 3,926
unit tests pass, 1 skipped, up twelve: the Eyebrow call-site sweep, the six
untaught readings, the piece-of rung and the long vowels. 53 e2e pass, up two:
one opens 面's readings and finds the row that says no word teaches it, and one
checks that the intro behind 電 reads "term" in the References panel. Every
fold's e2e test now clicks the far left of its row rather than the chevron,
which is the half that proves the row is the button.
`scripts/unreachable.mjs --list` at zero, `scripts/unused-exports.mjs` at zero
on its failing list, and `scripts/button-centering.mjs` measures 1,382 elements
over seven pages with none more than a pixel out. Four screenshots on a build
of this branch on a spare port: the Details bar shut and open, the References
panel with every page reading TERM, and 面's readings with おもて dimmed.

### Five leftovers from a review, and what each one turned out to be (2026-09-12, SAK-433)

Sam's read of the In Review cards left five sweeps, each already decided. Four
of them turned out to be smaller or larger than the card said, and saying which
is most of what this section is for.

**The four component mismatches were not bugs.** The 威 fix listed 匹, 在, 巡 and
替 as glyphs whose component data disagrees with the glyph's Wiktionary record,
in the four pairings the variant map refuses. Read one at a time, all four are
the same thing and it is not 威's thing. 威 was a wrong character: KanjiVG drew
戌 and wrote 戍 on it. In these four the label matches the strokes and the record
is naming where the shape came from, which is a different claim.

匹's strokes 2 and 3 are a ㇒ and a ㇟, which is 儿; 八 is ㇒ + ㇏, and KanjiVG
nests its own 八 inside the 儿 as a variant, so it agrees. 在's bottom right is
short on top and long underneath, which is 土, KANJIDIC2 files it under radical
32, and Wiktionary says in its own words that "*士 eventually corrupted into
*土". 巡's three strokes are all ㇛, curved, which is 巛; 川 is ㇒ + ㇑ + ㇑.

替 was the hard one, because 日 and 曰 are the same four stroke types and differ
only in proportion, which a bottom component loses. Measured off KanjiVG's own
paths, 普's 日 (radical 72) is 1.13 wide to tall and 曹's 曰 (radical 73) is
1.14, so geometry separates nothing and 替's 1.30 proves nothing. What settles it
is the family: KanjiVG writes 日 with original 曰 in 書 as well as 替, the repo
reads 日 in all of 替 書 曽 最 曹 普 春 昔 更 曲, and correcting 替 alone would
leave it the only 曰 tile in the app with its five siblings untouched. So nothing
is overridden, and the reading that settled each is pinned in the SAK-431 block
with the numbers in it. 匹's and 替's stories named the recorded piece flatly,
where 在's and 巡's already said the shape moved on; both now do too.

**The cold-start tail was a stale premise and one unmeasured route.**
`route_sizes.mjs` no longer names /dev/scheduling: that page went with the old
app and the line went with it a round later, by hand, after the script had been
failing on a manifest that could not exist. Fixing it by hand is the part worth
not repeating, so the list is derived-checked now, every page.tsx under src/app
mapping to a route and every route mapping back. The reverse case is what that
caught: /login has had a page of its own and no budget at all, which made the
one route a signed-out visitor always hits the one route nothing measured. It is
0.34 MB, in line with every other reading page.

The three modules the cold-start card left unbaked, measured as the median of
seven fresh processes with everything they import already loaded, so the number
is the module's own work:

| | own load |
| --- | --- |
| `src/data/kanji.ts` | 38 ms |
| `src/lib/facts.ts` | 11 ms |
| `src/data/characters.ts` | 4 ms |

The bar was 50 ms, so none of them is baked. (`src/data/facts.ts` does not
exist; the facts module the card meant is `src/lib/facts.ts`, a thin join over
ten tables that are loaded by then.) Inside kanji.ts's 38, by the same method
with a mark on each top-level step: re-attesting and re-anchoring READINGS is 14
ms, `buildAttesting` is 9, the facts are 4, building the 2,136 rows is 2, and
the rest is under a millisecond each. Both of the big two are pure functions of
the shipped tables and would bake the way the vocabulary and the vehicles did,
so the option is open; at 23 ms for the pair it is not worth a generated file
and a builder-equivalence test yet. `READINGS_BY_ANCHOR`, the line that made
this module worth looking at at all (SAK-382, 993 ms to 306), is 1 ms.

A note on the measuring, because the numbers were nearly wrong. Wall-clock
readings ranged from 35 to 78 ms for the same module while other work ran on
this laptop, which straddles the bar the decision turns on. The median of seven
fresh processes is stable at 38. CPU time reads 103 ms for the same load,
because V8 compiles on background threads, so it is the wrong meter here.

**The twenty-eight test-only exports were nineteen helpers and nine dead
functions.** SAK-419 printed the list and left it, on the argument that a lib
module's unit test is a real reader and the names it imports are the module's
surface. Reading all twenty-eight says otherwise: `export` on a name only a test
reaches records where the test chose to cut in, and nothing else.

Nineteen were private helpers, and each assertion moved to the function the app
actually calls. `isPickable` and `locksOn` through `pickState`, which is the
caller's question anyway. `isUndiscovered` through `linePaintFor`.
`encodePngRgba` through `pngDataUrl`, the value sky-wash.css stores, unwrapped
back to bytes. `skyDeclarations` and `layerCss` through `renderWashFile`, by
reading the layer block back out of the rendered file. All ten of sky-stars'
through `stardustPixels` and `milkyStarfield`, by counting the tile's lit pixels
and parsing the circles out of the field's SVG.

Two of those are better tests than what they replace. The scatter's no-overlap
checks used to call the module's own `anyOverlap`, so a scatter was checking
itself with the predicate it places by and would have agreed with itself
whatever either of them did; the test brings its own pairwise rectangle test
now. The sky-stars geometry is measured against the definition of a CSS gradient
angle rather than against the module's reading of it, for the same reason. One
test could not move and did not deserve to: it handed `scatterLayout` a sky too
small for its one box, to watch the box clamp, and through `scatterInWorld`, the
only caller, that cannot happen, because the world is sized from the boxes
first. It says that instead.

Nine were dead inside their own file too and went with their tests.
`knownCount`, `pickBreakdown` and `overlaps` had lost their callers.
`standingOf` is the one worth naming: the Sky's copy of the app's decision
table, with `isKnown`, `needsWork`, `StandingEvidence` and a parity test against
`src/lib/library/standing.ts` over two hundred scenarios, and nothing in the Sky
ever called any of it, because a standing reaches a Sky surface already decided,
on the catalogue or the payload. What is left in standing.ts is the vocabulary
and how it paints. `resolvedMesh` and `nextGlowId` are the wash editor's, and
the editor went to git on 2026-09-04; with `resolvedMesh` gone, `layerCss`'s
`resolve` flag had no caller that ever passed true, so the literal-color half of
it went too, restorable from the same commit as the editor's page.

Where a test needed a type the module no longer exports it names it off an
exported function (`Parameters<typeof milkyStarfield>[0]`), which is the same
move one level up and does not put the name back on the list. The script's
second list is part of its failing set now and prints its names whether or not
`--list` is given: a check that reports a count and not a name cannot be acted
on.

**The types barrel is gone rather than thin.** SAK-407 split a 923-line
src/types/index.ts into facts.ts, sky.ts and store.ts and re-exported all three
from the same index, because two other lanes were editing and rewriting 194 call
sites was not that card's work. 225 import statements across 223 files now name
the file that owns each name, and a statement that reached for two or three of
the files becomes two or three statements, ordered facts, sky, store, which is
the order they depend on each other in. So the imports at the top of a file read
as a sketch of where its shapes come from, which is the point of having split
it: 143 sites name an identity, 113 a stored shape, 55 an in-flight one. Nothing
outside src wanted the barrel either, so it is deleted; four spellings of it
existed and all four are gone, including a test's inline
`import("@/types").FactId` in a type position. The Sky's boundary rule lists
"@/types" beside "@/types/*", so it stays loud if anyone writes a barrel again.

**And American spelling, everywhere we write.** 841 spellings across 261 files,
by the American form each became: 177 color, 78 license, 70 memorize, 63
normalize, 58 behavior, 51 center, 50 labeled, and a long tail down to a single
traveling. User-facing copy, comments, READMEs, docs, identifiers and data field
names alike, so the `license` field on About's reading list, and the
`LICENSE_NOTE` constant that carries its wording, are both spelled the American
way now. The reward for that one is a deletion: `app/(sky)/reading.ts` carried a
function called `american` that rewrote that word on the way to the screen,
because the page was American and the data was not, and it is gone.

What the sweep did not touch, and why. Nothing under src/data/generated: JMdict's
glosses, Wiktionary's etymologies and WordNet's synonym pool are other people's
words, and a British spelling in a dictionary definition is the dictionary's.
Two strings in there are ours (a grammar-ingest reason, a generator header) and
were converted by hand beside the scripts that write them. No CSS property name,
and in fact no CSS at all outside comments. `catalogue` and `dialogue` stay,
since Merriam-Webster gives both and the first is a file name, an API route and
a build script here. `analysis` and `analyses` stay, being American already.

Three things the sweep got wrong and the checks caught. It rewrote EDRDG's own
URL, whose path is spelled the British way and is theirs to spell, which would
have 404'd the one link the license obliges us to show; a diff of every URL in
the change against every URL before it is how that was found, and it is
restored. It collapsed the Romaji term's search
aliases, where both spellings were listed on purpose so a learner typing either
finds the page, into a duplicate; the equivalence test against the library index
failed on it. And a stem like `realis` eats "realistic" if it is not guarded, so
the -is stems only convert in front of a suffix that makes them the British verb,
which is checked against a list of words that must not move: realistic,
specialist, optimism, mechanism, organism, capitalist, finalist.

`src/lib/no-british-spelling.test.ts` is the gate, beside the em-dash test and
the same shape: it reads the files as text, over the union of the trees the two
em-dash tests cover (src/data, src/app/(sky), src/sky, e2e and the two READMEs),
minus src/data/generated. Its allowlist holds four lines, each a word that is
someone else's rather than ours, and a second test fails if an allowance stops
matching anything, so an allowance cannot outlive its line. The test lives in
src/lib for the same reason the em-dash text test does not cover src/lib: that
tree carries hundreds from before the rule, sweeping it is its own job, and this
file is full of the spellings it exists to name.

One place the American spelling reads worse and was left alone anyway: 階's
story says "a story or stair", where the British spelling said which sense of
the word it meant. Changing it to "floor" is a content edit, not a spelling one,
and it is Sam's line to change.

**The gates,** run before each of the five commits. `npx tsc --noEmit` and
`npx eslint src e2e scripts` clean. 3,920 unit tests, 3,919 pass and 1 skipped,
up six on the four new pins in the SAK-431 block and three in the spelling test,
against eight assertions that went with the deleted functions. 52 e2e pass.
`scripts/unreachable.mjs --list` at zero, and `scripts/unused-exports.mjs` at
zero on both lists for the first time. The library index and the catalogues were
rebuilt twice, after the component round and after the sweep, and a value-level
walk of library-index.json, atlas-catalogue.json and sky-catalogue.json against
their previous contents reports zero differences both times, which is the
expected result when no decomposition and no shipped string changed.

### Two calls Sam made on the review, and what each cost (2026-09-13, SAK-422, SAK-433)

Both sections above end with a line left open for Sam. She answered both, and
the answers are one commit each.

**The copula is not part of the noun.** The span builder extended a span through
every trailing auxiliary, which is what an inflected verb needs and what a noun
does not have, so 仕事です, 写真だ and 台風なら were underlined whole. The chain
now runs only for a word the app gives a conjugation class; a word with no class
underlines its spelling and stops. na-adjectives are on the conjugating side of
that line, where they belong: です, な and に are their own forms (危険です,
大好きな), which is exactly the distinction UniDic cannot make, since it files
危険, 便利 and 冷静 as 名詞 right beside 仕事 and 写真.

That class is JMdict's and lives in TypeScript, which is what left the question
open the first time. `sentence_readings.py` reads it rather than repeating it:
the pos strings come out of `POS_TO_CLASS` in src/lib/word-forms.ts at run time
and the rows out of vocab-runtime.json, the file `VOCAB` itself loads, and a map
that moves or shrinks exits the script with a message instead of quietly
classing verbs as nouns. That failure mode is not hypothetical. word-forms.ts's
own header records two earlier hand-copies of the same list, both of which
covered the nine regular godan strings and dropped 行く, ある and every other
special class, and a verb with no class is indistinguishable from a noun.

**111 spans shrank**, which is the number the earlier reading predicted, and
every one of them by a copula: だ 37, です 17, なら 16, な 9, でしょ 8, でしょう
6, だった 5, and a tail down to a single じゃ. No span moved its start, no kanji
reading changed, and a value-level walk of word-examples.json against its
previous contents reports no other difference of any kind. 何しょん's 何しょ,
the oddity the earlier section flagged in passing, is now 何. The check gained
the clause that makes this a rule rather than a regeneration: a word with no
conjugation class underlines its written form exactly, checked before the three
surface clauses, since clause 2 would accept 仕事です on its own. All 2,030 such
spans pass, and the pinned counts move with them, 2,283 literal and 706
inflected.

**階 is a floor.** "A story or stair" was the sweep's honest output and the wrong
word in American English, where a story is a tale. It reads "a floor or stair"
now. The spelling map is untouched: its rewrite of the British form is the right
one everywhere that word is a spelling rather than a sense, and this line is the
one place the sense was the point.

**The gates,** run before each of the two commits. `npx tsc --noEmit` and
`npx eslint src scripts` clean. 3,953 unit tests, 3,952 pass and 1 skipped, the
same count as before: the span check gained a clause and a pin, not a test. No
page changed, so no e2e run.

## Kana orientation: what kana are, the three scripts, and how a kana is written in romaji (SAK-436)

An outside reader of the app (2026-09-13) said the Kana section did not say what kana are, and that a first-time learner had nowhere to read that there are two sets, where kanji fit, or what romaji is. Sam wrote the copy.

- The Observatory's Kana section now says what kana are, in one breath: the sounds of Japanese written down, like an alphabet except each character is a whole syllable (か is "ka", not "k" and "a"), two sets that spell the same 46 sounds, learned first because they unlock everything else. `COPY.kana` in src/app/(sky)/observatory.ts.
- How Saku works opens with a new section, "The three scripts": hiragana for grammar, endings and words with no kanji; katakana for borrowed words, names and emphasis, the way English uses italics; kanji from Chinese, each with a meaning and readings; and romaji, which is not a script Japanese uses. The four names are accented. src/data/how-it-works.ts, first entry.
- Every kana page and lesson card carries "Written as a in romaji." under the glyph, so the letter beside the kana is named for a learner who has not met the word romaji. `lesson-card.tsx`, the kana branch of the head.

Gates: tsc, eslint, the spelling and em-dash tests, the unit suite, the e2e run in the batch's final gate.

### The pins reach the dictionaries now, and three of them had moved (2026-09-13, SAK-434)

`src/data/source-pins.test.ts` proves the app teaches what the committed
reduction under `src/data/generated` says, and its own header admits where that
stops: the upstream archives are not in this repo, so an ingest re-run against a
different JMdict, a newer KANJIDIC2 or a KanjiVG release nobody chose would
rewrite the reduction and all nineteen pins would keep passing. The pins reached
the file. Nothing reached past it.

`src/data/generated/sources.json` is what reaches past it. **Nineteen upstream
archives**, each with the URL it came from, the version or date the archive
itself declares, and the SHA-256 of the file as downloaded: JMdict, KANJIDIC2,
KRADFILE, KanjiVG, Kanjium, the three Tatoeba exports, two Unicode Character
Database files, the Kanji Alive radical CSV, the CEJC workbook, and the seven
JLPT and frequency snapshots committed under `scripts/ingest/sources`. Every
ingest under `scripts/ingest` now checks the bytes it is about to read against
that record and stops with a plain message when they differ. `--accept-source`
is the one flag that records a new archive and builds from it, so an intentional
upgrade is one word on a command line and a silent change is a stop.

**The manifest is keyed by PASS, not by file, and that is the part that catches
the real failure.** Several passes write one file: `build.py` cuts `kanji.json`
from KANJIDIC2 and KRADFILE and JMdict, and `kanji-raw-readings.py` then
back-fills `on`/`kun` onto it from KANJIDIC2 alone. Keyed by file, the second
pass would overwrite the first pass's record and the file would claim an input
history it does not have. Keyed by pass, each records only what it read and what
it touched, and the interesting failure becomes visible: accept a newer
KANJIDIC2 while running `readingtype.py`, and `readings.json` is re-cut while
`kanji.json` and `radicals.json` still carry the old dictionary's hash. The
archives section says one thing, those passes say another, and the reduction is
a mixture of two dictionaries with nothing to say so.
`src/data/source-manifest.test.ts` fails on exactly that, naming the pass to
re-run. Nine passes are recorded, covering sixty-one of the eighty-nine files
under `src/data/generated`.

**The other twenty-eight are named too, with a reason each.** `unpinned` is not
a gap in the record, it is the record of the gap: thirty-one entries, each
saying which script writes the file and why no archive pin reaches it. Three of
them are partial rather than absent, and say which half is pinned:
`beginnerRank` in `vocab.json`, `on`/`kun` in `kanji.json` and `type` in
`readings.json` all reproduce byte for byte, while the rest of each row came
from `build.py`'s unrecorded archives. A new generated file with no provenance
fails the test rather than slipping in unremarked.

**The end-to-end run.** 161MB of archives into the ignored
`scripts/ingest/raw`, then every pass that could be run, run. `pitch.json`,
`radicals.json`, `kanji-radicals.json`, `radical-enrichment.json`, all fifty
stroke files and their generated chunk index, `kanji-components.json`, `readings.json`, `kanji.json` and
`vocab.json`'s `beginnerRank` all came back byte for byte identical, which is
the result that says the wiring changed nothing. Three did not, and each one is
a finding.

**Kanji Alive renamed a column and the bushu names would have vanished.** The
radical enrichment ingest reads `japanese-radicals.csv` from that project's
`master` branch. On 2026-08-30 the file was recut with different columns:
`Reading-J` is now `Reading`, and the `Radical ID#` column the script's header
describes at length is gone. The script reads `r["Reading-J"]`, which is now
undefined, so a run against `master` today drops **the kana half of all 214
bushu names** and writes the file back with only the romaji. Nothing would have
failed. The test suite has no assertion that a radical has a kana name, the
ingest reports no error, and the result is a Library page that says `nogihen`
where it used to say のぎへん. The manifest is pinned to commit
`55b1bb97` of 2026-08-27, the last revision with the columns the script reads,
and against that revision the file reproduces byte for byte. This is the whole
case for the card in one example: the pin is not bureaucracy, it is the only
thing standing between a silent upstream schema change and the data a learner
reads.

**KanjiVG had no version at all, and now has one.** `kanjivg.mjs` used to fetch
2,228 files one at a time from the `master` branch, which gave the shipped
stroke data no version to name: `master` is whatever it was on the day of the
run, and two runs a week apart could disagree with nothing to say so. It reads a
release archive now, unpacked in memory by a small dependency-free zip reader in
`scripts/ingest/sources.mjs`. Picking the release was itself a check: the
GitHub API's "latest" points at `r20250816`, and against that archive
`kanji-components.json` moved, 乞 losing 𠂉, 右 losing 丆, and 愉 諭 輸 changing
their phonetic from 俞 to 兪, plus one stroke path of 悠. Those are upstream
edits made after r20250816, which means the committed data is NEWER than the
release the API calls latest. `r20260714` is the release that actually matches,
and against it all fifty stroke files, the chunk index and the components file
reproduce byte for byte. The parse is unaffected by the switch: the only textual difference
between a release SVG and its `master` counterpart is an `xmlns:kvg` attribute
on the `<svg>` element, which nothing here reads.

**CEJC is pinned but its output is stale against a committed input.**
`cejc-reading-frequency.json` records its own archive hash, and that hash is
exactly the CEJC workbook downloaded today, so the archive itself has not
budged. Re-running the pass still moves three numbers: ちち from 50 to 684,
ちゃん from 4268 to 4273, and one `core` category count from 2 to 7. The cause
is not CEJC. The pass also reads `word-definitions.json`, which was refreshed
against a newer JMdict on 2026-08-29, after this file was last cut, so more
observed pronunciations now map to a dictionary reading. The manifest records
the pass with that note attached. Regenerating is a content decision about what
the app teaches, and is Sam's to make.

**JMdict is pinned to an archive that cannot be downloaded again, on purpose.**
EDRDG rebuilds JMdict daily and keeps only the current build. `word-definitions.json`
carries the SHA-256 of the JMdict it was cut from, and that is what the manifest
pins, rather than whatever the URL serves this morning: the manifest's job is to
say what the shipped reduction was built from, not to be trivially satisfiable.
So every JMdict pass stops today, which is the right answer, because a JMdict
re-cut is always deliberate. Against the JMdict of 2026-09-13 the definitions
file gains two words (かみそり, 公平) and changes nine (と, なり, 大小, 大気,
寂しい, 最後, 発電, 硬い, 進む), every one of them an upstream sense edit and
none of them a defect in the ingest. `build.py`'s own outputs are older still
and their archives were never recorded at all, so `vocab.json`, `word-senses.json`,
`order.json` and `confusable-derived.json` sit in `unpinned` with that said
plainly. The pin arrives the next time they are deliberately re-cut, which now
takes the flag.

**Two facts that stay single-source, recorded here so nobody has to rediscover
it.** There is **no JMdict furigana reduction in this repository**, and none of
the ingest inputs carries one, so which reading a kanji takes inside a word has
no second source to diff against. What the app has instead is
`scripts/ingest/aligner.py`, a cost-ranked search over KANJIDIC2's readings with
rules for rendaku, gemination and handakuten, and the strongest check available
is the one SAK-418 already made: every per-kanji base reading the app shows is a
reading KANJIDIC2 lists for that kanji, zero exceptions across 10,147 aligned
words. The split and the surface remain heuristic, and 866 alignment slots
across 821 words claim a sound change the aligner inferred rather than read
anywhere. **Pitch is single-source Kanjium**, itself derived from the NHK accent
dictionary and Daijirin, with no hand-overrides and no second offline source
here, so the 8,684 stored downsteps are unverified against anything but Kanjium.
Both stay single-source unless a second source is added, and the hash in the
manifest is now the honest limit of the claim: not "this is right", but "this is
exactly what that file said".

**The gates.** `npx tsc --noEmit` and `npx eslint src scripts` clean. 3,964 unit
tests, 3,963 pass and 1 skipped, up eleven on the new manifest file.
`scripts/unreachable.mjs --list` at zero and `scripts/unused-exports.mjs` at zero
on both lists. No page changed, so no e2e. The archives themselves are not
committed and never will be: `/scripts/ingest/raw/` is ignored, and one of them,
CEJC, is licensed for research and education but not for redistribution.

### A kana card takes how the sound is spelled in English (2026-09-13, SAK-435)

From an outside audit Sam relayed: the card asks how あ is SAID, in English, and
then accepts only "a". "a" is a letter. "ah" is the sound, and it is what an
English speaker types when asked that question. Marking it wrong tells her that
her own ear is wrong, which is the one thing a beginner has to trust. Every kana
accepts the sound spelling beside its romaji now, and the romaji stays first
everywhere it is shown, because it is what the lesson teaches and what a
keyboard takes.

**The rule is one line, so the table is generated and not typed.** The Hepburn
consonant, then the English spelling of its vowel: a is ah, i is ee, u is oo, e
is eh, o is oh. か takes "kah", し takes "shee", つ takes "tsoo", りょ takes
"ryoh". `buildSoundSpellings` in src/data/characters.ts derives 216 of them, 102
distinct across the two scripts, from the romaji the rows already carry, so a
row added there is covered for free and the two cannot drift apart. Only the Hepburn form converts, which is
the first of a row's accepted answers: "si" is a keyboard spelling of し, not a
sound anybody hears, so it grows no "see".

Three fixed forms the rule alone does not reach, all Sam's call. ぎ takes "gee"
AND "ghee", since English spells this hard g both ways. を takes "woh" AND "oh",
since it is written wo and said o. ん takes neither, having no vowel to convert,
and keeps the "n" and "nn" it always had. Nothing is added for long vowels or
the small っ, which are word-level and typed in kana. And "ay" is not accepted
for え or for any kana in its row: it is the spelling an English speaker reaches
for and it is the wrong sound, so accepting it would grade as right the exact
mistake え's own lesson line warns about ("No glide. It's eh, not ay.").

**The spellings sit beside `R` rather than inside it, because three readers of
`R` must not see them.** src/lib/romaji.ts builds the typing box's romaji to
kana index out of these same rows, so "ah" filed as an answer would type あ and
"koh" would eat the ko of こひ. The Library prints a kana entry's `r` as its
readings, and あ is not read "ah". And the grader's English layer fuzzes any
candidate of four letters or more by one edit, which over these would accept
"chee" for し, "soo" for つ and "kyoh" for きゃ, each of them a DIFFERENT kana's
answer. So `soundSpellingsFor` publishes them separately and the kana question
type adds them as exact alternates, in the answer key's `loose` list, which is
matched by equality and never fuzzed.

**The English matcher does not grade kana at all any more, and that turned out
to be the older bug.** The card asked for a check that a sound spelling never
collides with another kana's answers. It does not, but the synonym pool already
did. That pool is built from WordNet and keyed by the answer string, so it read
"sa", "ka" and "re" as English words and handed each kana everything they mean:
210 of the 214 kana carried a pool, 1,762 strings in all. Most were only strange
(さ took "cpp" and "grama", ど took "karate" and "answer"), but 38 were another
kana's own answer, so the drill graded "re" right for ら, "ra" right for れ,
"te" and "ti" right for し, "chee" right for つ, and "oo", which is now う's
approved spelling, right for か. A kana's answer is a sound written in latin
letters, not an English word, and あ does not mean anything, which is why
`answerIsMeaning` is already false for every card in this subject. So the whole
of what a kana card accepts is now its romaji and its sound spellings, compared
after case and spacing, and `kanaJp2enKey` says the same thing to the browser.
Nothing else uses kana's rules: they are the fallback for an unregistered
subject, and all 214 facts that reach them are kana.

**What the card says, so the box and the rule agree.** The typed box's
placeholder on a kana reading card was "The reading, in romaji" and is "In
romaji, or how it sounds". The listening card's instruction was "Listen, then
type the reading in romaji." and is "Listen, then type the reading in romaji, or
how it sounds." Those are the only two places a kana card said "in romaji" to a
learner.

**The lesson's own say lines were read and not changed.** Each mnemonic carries
a `sound`, and 31 of the 92 disagree with the rule. Twenty-seven of them only
repeat the romaji ("Say ka", "Say wa", を's "o"), which the drill accepts anyway,
so they cost nothing. Four are worth Sam's eye and are named in the card's
closing comment rather than edited here: す and ス say "sue" where the rule says
"soo", ひ says "he" where the rule says "hee" and where "he" is へ's own romaji,
and み says "me" where the rule says "mee" and where "me" is め's. The katakana
twins of the last two already say "hee" and "mee", so each pair disagrees with
itself as well as with the rule.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 3,968
unit tests, 3,967 pass and 1 skipped, fifteen of them new and all in
src/data/characters.test.ts, which types the approved list out glyph by glyph
rather than deriving it the way the code does, and grades every string through
both `checkTyped` and `answerKeyFor` so the two paths cannot disagree. 54 e2e
pass, one of them new: the あ card answered "ah" in a real browser, which is the
only proof that the spelling survives the trip from the server's key to the
grading that happens without it. `scripts/unreachable.mjs --list` at zero, and
`scripts/unused-exports.mjs` at zero on both lists.

## Three say-it lines that the quiz would have marked wrong (SAK-438)

SAK-435 let a kana card take how its sound is spelled in English, and its closing note named the lesson lines that disagreed. す and ス told the learner to say "sue", which the card does not accept; ひ said "he" and み said "me", which are the romaji of へ and め. Sam approved changing them: す and ス say "soo", ひ says "hee", み says "mee", as their katakana twins ヒ and ミ already did. `src/data/mnemonics.ts`, the `sound` field and the accented span of each `analogy`.

A test in `mnemonics.test.ts` now holds every kana's say-it spelling to what its own card accepts: its romaji, the other ways the table writes it (を is "wo" and "o"), or its sound spellings. It found nothing else.

### "Limited 30" is thirty questions (2026-09-16, SAK-437)

Sam set "Limited 30" on a 106-item recipe, read "30 items, about 66 questions,
drawn at random from the 106 below", and said what the number was always
supposed to mean: "the limited count should be the number of questions, not
items so if i say 30, i mean i want 30 questions out of the 106 items in this
case." SAK-428 had already made the second count visible; this makes it the one
she sets.

**The draw counts questions as it walks.** It shuffles the pool exactly as
before and then takes items until the questions taken reach the number asked
for: an item's facts go in whole while they fit, and the single item that would
overshoot gives up only as many of its facts as are still wanted, chosen at
random among its own so a word does not always surrender the same question. The
deck is therefore exactly the number asked for whenever the pool holds that
many, and at most one item is ever split. "All of them" is the pool in its own
order, untouched, and the cards are still shuffled after the draw (SAK-388).

**`Recipe.size` keeps its name and changes its meaning.** It is the stored
field, so renaming it would strand every saved recipe; its doc comment now says
it counts questions, and a saved "Limited 10" deals ten questions, which is what
that recipe was asking for all along. `deckSize(recipe, pool)` is
`deckQuestions(recipe, questions)`, `shortfall` is counted in questions too, and
the summary a saved recipe's chip carries reads "10 questions" rather than
"10 of them", which could only be read as ten items.

**The panel lost its estimate, because there is nothing left to estimate.** A
limited draw used to multiply the pool's rate of questions per item over the
items it would take, which is why it said "about". The number is exact now:
"30 questions, drawn at random from the 12,457 items below", and the "drawn at
random" half appears only when something is actually left behind. "All of them"
still says both counts, "12,457 items, 31,609 questions", because both are
exact and both are worth knowing. A pool shorter than the number asked for
reads "Only 18 questions match, so the deck is shorter than the 30 you asked
for." The stepper says "questions" beside its box and to a screen reader, where
it said only "How many" and left the unit to be guessed.

**A retry and a resume were already safe.** Both hand `loadQuiz` the cards by
name rather than drawing again, so neither goes near this path; the e2e that
reloads a half-finished quiz holds that.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 3,984
unit tests, 3,983 pass and 1 skipped, five of them new and all in
`src/app/(sky)/practice.test.ts`: they draw over the verb pairs, where every
item carries exactly two facts, so an odd number of questions can only be
reached by splitting one item and the assertion has somewhere to bite. They
check that the deck is exactly the number asked for, that the split item is one
and no more, that a pool with too few questions is short rather than wrong, that
"all of them" is unchanged, and that the cards dealt are one per question. 54
e2e pass, the practice step now reading "questions, drawn at random from the N
items below". `scripts/unreachable.mjs --list` at zero,
`scripts/unused-exports.mjs` at zero on both lists, and
`scripts/button-centering.mjs` at 0 elements over 1px over the 1,382 it
measures, since the stepper grew a unit beside it.

## The sky's one warning is a mark now, not a sentence (2026-09-16, SAK-439)

Sam, on a screenshot of the Planetarium's line "Showing more at once makes the
sky slower to draw.": "move this to be a tooltip that shows when you hover a
warning symbol similar to the info symbol." It is a thing you read once and
then read past forever, and it was taking a row of the page to say so.

**One mark, two tones.** `SkyInfo` grew `tone`, and that is the whole of the
difference: `info` is the drawn "i" in a ring of the accent, `warning` is the
triangle in the shaky amber, and the two share the placement, the open on hover
and on focus, the close on leave, Escape, a scroll and a resize, the aria
wiring, and the card the note is drawn in. `SkyWarning` is four lines over it
rather than a second copy of any of that, which matters because the last time
this app had two tooltips they were made to look alike by hand and behaved
differently anyway (SAK-366, the section above). It takes a `label` now, the
gist for anyone who meets the mark without opening it: "Why showing more is
slower". The accent stays where it belongs, on the hear buttons and the "Why?"
labels; a warning warns in the color it has always warned in.

**Where it sits.** At the end of the collections row, beside the chips that put
more of the sky on the screen, rather than on a row of its own under them: the
sentence needed a row, a 14px mark does not, and the thing it warns about is
right there. The standings above it end in the info mark, so the two rows now
end the same way, one in each tone. `WarnMark` moved out of
`standing-legend.tsx` into `sky-info.tsx` with nothing else left behind.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 3,985
unit tests, 3,984 pass and 1 skipped, unchanged: nothing here is a function to
pin, and the behavior is held end to end instead. 55 e2e pass, one of them new:
the home shows the mark, the sentence is nowhere on the page until the mark is
hovered, it goes again when the pointer leaves, and focusing the mark with no
pointer near it opens it and sets `aria-expanded`.
`scripts/unreachable.mjs --list` at zero, `scripts/unused-exports.mjs` at zero
on both lists, and `scripts/button-centering.mjs` at 0 elements over 1px over
the 1,383 it measures, the new one among them.

## The reveal answers in the spelling the learner typed (2026-09-16, SAK-440)

Sam, on a screenshot of the あ card marked PERFECT over the word "a": "i typed
ah in this second screenshot, not a." Since SAK-435 a kana card takes how the
sound is spelled in English beside the romaji, and the reveal went on printing
the card's own answer, so the learner was congratulated over an answer they had
not given and had no way of telling whether "ah" had counted or whether they had
been let off.

**`answerLine` decides, `QuizVerdict` draws.** The card and the answer go in,
the big line and an optional muted line come out, and the decision is a function
in `lib/quiz.ts` with eleven tests rather than a condition inside the component.
The last of `said` is the answer on a card that was answered (SAK-387,
SAK-425), so the whole rule is: when that differs from the card's answer by more
than case and spacing, which is what the grader forgives, it is what the learner
typed and it is what the reveal says, with the card's own form named under it.

**Three sentences, because the form is three different kinds of thing.** A
reading spelled in latin letters reads "Written a in romaji.", and the same for
a Kunrei spelling: "si", then "Written shi in romaji." A reading that is
Japanese is not spelled in romaji at all, so 九 answered く where the card was
minted for きゅう reads "Also written きゅう." A meaning card's alternate is a
synonym, so it reads "Also: quick". One line either way, never a list of every
alternate the key holds. The line comes back in three pieces, because its middle
is the form itself and may be Japanese, and Japanese is drawn in the Japanese
face.

**What is left alone.** A picked answer: a tile carries the card's own wording,
so a board can never put a second spelling on the screen, and the check is
against the option labels rather than against a flag the answer does not carry.
A missed card: it already lists everything said, struck through, under the right
answer. An ordering card, whose attempt is the pieces joined by spaces and whose
answer is the sentence written without any. The results list, which is per row
and shows the canonical answer, is untouched. And the pitch: a pitch belongs to
the card's reading, so it is drawn over that reading and never over a learner's
spelling of it.

`japaneseFont` grew `isJapanese` beside it, since which face a string is drawn
in and which sentence names it are the same question asked twice.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 3,996
unit tests, 3,995 pass and 1 skipped, eleven of them new and all on
`answerLine`: the sound spelling, the Kunrei spelling, the card's own spelling,
case and spacing, the synonym, the Japanese reading, the picked answer, the miss,
the ordering card, a card that recorded nothing, and a retry that ends on what
counted. 56 e2e pass, two of them new: typing "ah" on the あ card and stepping
back to its reveal shows "ah" with "Written a in romaji." under it, and typing
"a" shows the reveal with no such line anywhere on it. A right answer moves
straight on, so both step back to the card the way SAK-425's test does.
`scripts/unreachable.mjs --list` at zero, `scripts/unused-exports.mjs` at zero
on both lists, and `scripts/button-centering.mjs` at 0 elements over 1px.

## Something that slipped is not taught again (2026-09-16, SAK-442)

Sam, quoting How Saku works back at itself ("a missed card opens its lesson
right there under the quiz, and the Observatory offers it to be learned again
... It re-teaches it."): "i've mentioned this before multiple times. i do not
want the lesson to reteach it. i want it to appear in the practice as
'slipping' so people can practice it but not be forced to relearn it."

**The rule.** A thing the learner has met stays met. Missing it makes it
slipping, which is a standing and nothing else: the star wears the slipping
color in the sky and in the Atlas, the entry fills Practice's "Only things that
are: slipping" cut, and the learner drills it when they choose. It is never put
back in the Observatory as something to learn, it never re-enters a lesson on
its own, and nothing forces a re-read. The page under a missed quiz card stays,
because that is the answer's explanation, not a lesson starting over.

**The behavior was already right; only the page said otherwise.** Sam had
raised this several times, so the first thing here was a test rather than an
edit, and the test passed on its first run. `met` in `workOutStanding`
(`src/app/(sky)/learner.ts`) is a count question, not a belief one: a fact with
a showing, a claim or a lesson opening behind it is met, and no amount of
missing takes any of those away. Every Observatory section filters on that same
`met` (words, counting, the sentence rules, verb pairs, keigo, and a kana row
on whether all of its kana are met), so a slipped entry falls out of the offer
on the same test that put it there. The lesson is built from picks the learner
makes. Nothing reaches the old scheduler's relearn path. The one place
"re-teach" survived in code was a comment beside the `slipping` line in
`src/lib/library/standing.ts`, which is now the rule instead.

**The test bites.** "A met item that has slipped" in
`src/app/(sky)/observatory.test.ts` takes the FIRST word a new learner is
offered, which is by construction a thing the words section lists, then answers
it a dozen times, misses every one, and leaves it for two months. Three checks:
it is still met and reads slipping; no section of `offerings` lists it and
`learned` holds it; and a practice recipe cut to slipping over the words
collection has it in the pool. Had `met` been the belief rather than the count,
the first word on the list would have reappeared at the top of it.

**The copy.** The SRS section's third paragraph is Sam's own sentence now: "And
if something's clearly slipped, Saku doesn't send you back through its lesson.
It shows up as Slipping, in your sky, in the Atlas and in Practice, so you can
drill it when you choose. A missed card still opens its page under the quiz, so
the explanation is right there." The Slipping standing says the same thing in
both places it is defined, the reference page's bullet and the legend's key
(`src/sky/lib/standing.ts`), so a learner who never opens How Saku works still
meets the rule. The how-it-works test that pinned "re-teaches" now pins the
opposite, and refuses "re-teach", "learn again" and "relearn" in that section
outright. The "I don't know these" bullet keeps its "offered to be learned
again", because that one is true and it is the learner asking: withdrawing a
claim removes the only thing that made the item met.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 4,000
unit tests, 3,999 pass and 1 skipped, four of them new: three on the rule and
one on the Slipping standing's wording. 56 e2e pass, unchanged, since nothing
on a page moved. `scripts/unreachable.mjs --list` at zero and
`scripts/unused-exports.mjs` at zero on both lists.

## Practice counts (2026-09-16, SAK-441)

Sam, reading "How Saku works" on the practice section: "i also mentioned this
multiple times. practice should be recorded. that's the point." This reverses
SAK-318, which guaranteed the opposite and wrote that guarantee into four file
headers, a settings field, a localStorage key and a page of copy.

**One recorder, one path.** `PracticeRun` used to hand the quiz `noteMisses`, a
client function that counted the misses and stopped. It hands it `recordAnswers`
now, the same function `/quiz` hands it, so a practice run goes through
`quizRecords` into `postSession` and lands on the account, or in the browser
when there is no account, exactly the way a quiz does. The grades are the same
three, the unanswered cards record nothing the same way, a pitch card and a
listening card record as they do in the lesson quiz, and an item nobody had met
gets a first record and is discovered by it. Nothing about the recorder knows
which screen asked.

**What tells the two apart is one optional field.** `QuizSessionRecord.practice`
is the mark a practice run leaves, with the recipe's name when the deck was
dealt from a saved one. It rides through `RecordOptions` into
`buildSessionRecord`, which is the one place a record is projected, and it
changes nothing that is counted: the tests fold the same round both ways and
compare the aggregates. `sessionsFromHistory` reads it as the session's kind, so
Sessions lists "Practice: Evening drill · 30 cards" beside "Quiz · 12 cards",
and "Run it again" is offered on a practice row because dealing those cards
again is the same act either way.

**The separate miss store is gone.** Practice kept its own count of what had
been missed, per fact, under `sky:practice:misses`, pushed up as the second half
of the settings blob and merged card by card by the larger count (SAK-377). The
history answers that question now, and answers it better: `resolve` in
`app/(sky)/practice.ts` reads `history.facts[f].missed` alone for the
shakiest-first order and the "missed 14 times" column, which means a miss in a
quiz and a miss in practice weigh the same, as they should. So the key joins the
storage sweep, `PracticeFile` is one field again, `mergeSettings` loses the
one-level-deeper exception it existed for, and `practicePreview`,
`practiceDraw`, `practiceCards` and `practiceLookup` lose the argument they
threaded it through.

**The copy.** "Practice is never recorded" is now "Practice counts", and says
so: the same cards as the quiz, counted the same way, the run under Sessions,
what you keep missing coming back first. The results screen's saving line was
already there and now tells the truth on this screen too; the sample is the one
deck that still records nothing, and it stays quiet about saving rather than
claiming a run that went nowhere.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 3,999
unit tests, 3,998 pass and 1 skipped: three new on the practice mark (it rides
the record, an unnamed run still marks it, and the fold is identical to a
quiz's), three new in `app/(sky)/sessions.test.ts` on the kind and the name, and
the old assertions replaced rather than dropped, which is the settings suite's
five "practice halves" tests becoming three about one value, the sweep's live-key
list handing `sky:practice:misses` to its dead-key list, and every
`practicePreview(history, recipe, {}, NOW)` in `practice.test.ts` losing its
empty misses. 57 e2e pass, one of them new: signed out, a kana deck saved as
"Evening drill" is run, one card is answered, the browser's copy grows a
session, `/sessions` shows "Practice: Evening drill · 1 card" with "Run it
again" on it, and the home says one star is Discovered. `scripts/unreachable.mjs
--list` at zero, `scripts/unused-exports.mjs` at zero on both lists.

## The reading is always behind Hint, and the retries control fills its column (SAK-448)

SAK-429 hid a kanji word's reading on a meaning card only once the learner had been asked the fact before, and kept it under the glyph on a first sight. Sam's rule is simpler: the lesson taught the word a minute ago, so the quiz does not print half of it. `readingIsAHint` in `src/app/(sky)/quiz.ts` no longer looks at the history: every meaning card for a word written with kanji drops the reading from under the glyph and offers it as the hint (first in the hint, above a breakdown when the card has one). Kana-only words, reading cards and listening cards are as they were.

`SkyStepper` takes `fill`, and the quiz's help column passes it: the retries control is as wide as the buttons above it, with the number centered between the minus and the plus, instead of sitting at its own narrow width under them.

## The reading pages flow in two columns on a wide window (SAK-450)

SAK-361 capped a reading page's lines at 68 characters, which is right for reading and left every full-width panel half empty on a wide window. `SkyReading` now lays its sections out with CSS multi-column from the `lg` breakpoint: two columns, each panel as wide as its column and never split across them (`break-inside-avoid`), read down the left and then the right. Below that width it is one column with the 68 character cap, as before. The columns live on a block wrapper inside `SkyPageBody`, because multi-column does not lay out the children of a flex container. Both How Saku works and About use the component.

## The browser suite's port can be chosen (SAK-451)

`playwright.config.ts` reads `SAKU_E2E_PORT` (default 3249). Several worktrees running the suite on one hard-coded port took each other's web servers down part-way, which showed up as a run of connection-refused failures in tests with nothing wrong with them. A gate run that shares the machine with lanes sets its own port: `SAKU_E2E_PORT=3291 npx playwright test e2e/sky.spec.ts`.

## The word page reads like the page around it (2026-09-16, SAK-443)

Sam's review of the Atlas word page: a note in the wrong type and in a
linguist's words, an example sentence that never showed which word it was an
example of, a reading row that sounded like a scolding, and a delete that said
the same thing twice.

**A face belongs to a run, not to a paragraph.** `japaneseFont(text)` asks one
question about a whole string, which is exactly right for a glyph, a reading
or a list of words and wrong for a sentence with both languages in it. いいえ's
contrast note is English prose with two Japanese words in it, and one class on
the paragraph drew the English in the Japanese face too, so the note sat there
in a different type from everything around it. `mixedRuns` splits a sentence
and `Mixed` draws each run in its own face. Punctuation joins the run in front
of it: neither face owns a comma, and a run per character would put 。in the
UI face at the end of a Japanese sentence and draw “no” in three pieces. It is
used wherever the Sky draws authored prose, which is more places than the note:
the quiz reveal's hint and its steps, and a teach page's paragraphs, table
cells and footers, where a cell reading "きて → きって (kite → kitte)" had its
romaji in the Japanese face for the same reason. `japaneseFont` keeps every
other call site, because those strings really are one face.

**"Gloss" is what a dictionary editor says.** Sam: "'gloss' is jargon. say
'mean' instead ... same with 'land'. maybe say 'be blunt or childish'. same
with 'meet'. say 'you might still see it in print'". いいえ's note now opens
"both mean “no” but they aren't interchangeable", without the comma that read
oddly inside the quotes, and closes "so it can be blunt or childish somewhere
formal"; the ten ずる notes close "you might still see it in print". The facts
are the same ones. The word was in the copy because it is everywhere in the
code around it, a vocabulary row having `glosses` and a mnemonic's example a
`gloss`, so `src/lib/no-jargon-in-learner-copy.test.ts` reads
word-contrast-notes.ts, `src/sky` and `src/app/(sky)` through the TypeScript
parser and fails on the word inside a string, a template or JSX text. A field
of that name is untouched, which is the whole point: the name is exact and the
sentence was not.

**The sentence shows the word, so it points at it.** 仕事's fold said "In a
sentence" and printed 今から仕事ですよ。with nothing marked. The span was never
missing: `exampleFor` has carried it since SAK-422, and `teach.ts` built
`{ jp, en }` and dropped it on the way out. It rides on the payload now and
the card draws that stretch in the accent with an underline under it, in the
Atlas, the lesson and the quiz's reveal, since those are one card. The span is
the sentence's own, so the underline follows the word as the sentence inflects
it (くすぐる underlined inside くすぐらないで) rather than hunting for the
dictionary spelling, and a sentence whose word could not be found keeps its
place and is printed plain.

**Whose limit it is.** 面's おもて row read "no word taught yet", which reads as
a gap in the learner's own progress, something they have not reached. They have
nothing to do with it: the dictionary lists the reading and no word in the
app's vocabulary takes it. Six rows in the whole set are like that, and they
now read "No word in Saku uses this reading." and stay dimmed. The empty word
list is still the one thing the row reads to decide.

**One verb, said once.** Practice's delete ask read "This recipe goes for
good." over a button saying "Delete it". The button says "Delete it forever"
and the sentence is gone; "Keep it" is unchanged. `InlineAsk`'s line is
optional from here, and stays wherever it carries something the verb cannot:
what leaves with the thing, how much of it there is.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 4,010
unit tests, 4,009 pass and 1 skipped, fourteen of them new: nine on `mixedRuns`
(one face, two faces, where the punctuation goes, the iteration mark, romaji in
brackets, and that the runs joined are the sentence again), two on the jargon
gate, including one that holds it to telling a string from a field of the same
name, and three on the example payload, that the span comes across, that it
lands on the word as the sentence writes it, and that it is all the payload
carries. 57 e2e pass, one of them new: 仕事's fold opens and the one underlined
span is 仕事, drawn in the color a probe reads off `--sky-accent` and really
carrying an underline. 面's row and Practice's ask are held by the two specs
that already covered them. `scripts/unreachable.mjs --list` at zero,
`scripts/unused-exports.mjs` at zero on both lists, and
`scripts/button-centering.mjs` at 0 elements over 1px over the 1,383 it
measures.

## The pretend learner is a dev surface now, and production has none (2026-09-16, SAK-445)

Sam: "the ?sample and other dev pages should not be sent to prod." She was
right that they were. `/?sample` answered 200 on the live site and served a
made-up history to anybody who typed the word, and the same flag rode every
Sky page, every link and every server action. The lesson's `?showcase` was the
second one: a lesson built on an empty history to show one of every kind of
card.

**One switch, read in one place, at request time.** `devSurfacesOn()` in
`src/lib/dev-surfaces.ts` is on when `SAKU_DEV_SURFACES=1` or when this is not
a production build, and off otherwise. It is deliberately not
`NEXT_PUBLIC_`: the browser never decides this. It is read per request rather
than baked in, because the e2e suite runs a PRODUCTION build and still wants
the pretend learner, so `NODE_ENV` alone could not tell the e2e server and
Vercel apart. `playwright.config.ts` sets the variable in its webServer env,
beside `SAKU_DISABLE_AUTH`, and that one line is what keeps every `?sample`
step in `e2e/sky.spec.ts` working exactly as it did.

**Two doors, because a flag arrives two ways.** `devFlag(params, key)` is the
page's: `?sample` and `?showcase` count as present only when the switch is on,
so with it off the page renders as if the word had never been typed. Every Sky
page reads `?sample` through `whoFor`, which is the only caller that matters,
and the lesson reads `?showcase` the same way. `trustedWho(who)` is the
action's, and it is the one that was load bearing: a server action is handed
its `Who` in a POST body, so the claim to be the pretend learner can arrive at
one whatever page it says it came from. With the switch off that claim is
dropped and what is left is the real caller, their own browser copy when they
sent one and their own account otherwise. Never an error and never a redirect,
because a forged flag should look exactly like no flag.

**The type is what makes the second door hard to forget.** `historyFor`,
`graduateRunsFor` and `extrasFor` take `TrustedWho`, which only `trustedWho`
mints, so an action that skipped the check would not compile. There are twelve
reads in `actions.ts` and every one of them now starts by naming its parameter
`caller` and turning it into a `who`. The mark is a type and never a value, so
nothing crosses the wire and nobody can send one.

**The pretend learner's module is loaded on the branch that wants it.** It was
a static import at the top of `actions.ts`, which put `sample-learner.ts` in
every Sky route's server bundle and ran it on the first request that asked.
`historyFor` reaches it through `await import("./sample-learner")` now, so with
the switch off the branch is unreachable and a production server never
evaluates a line of it. What that does not do is take it out of the build:
Turbopack gives it a chunk of its own (3.5 KB, its own file in
`server/chunks/ssr/`) and Next's file tracing still lists that chunk beside
each route, which is what a dynamic import can honestly promise. Nothing is
imported from it by any other path, and `scripts/unreachable.mjs` counts the
dynamic import as an edge, so the file is still reached and still checked.

**Proved against a real production build, not only in unit tests.**
`playwright.dev-surfaces-off.config.ts` builds the app the way the main suite
does and starts it WITHOUT the variable, on its own port and its own output
directory so it can run beside the main suite:

    npx playwright test --config=playwright.dev-surfaces-off.config.ts

Six tests in `e2e/dev-surfaces-off.spec.ts`. `/?sample` is a 200 with the
visitor's own empty sky on it ("You haven't discovered anything yet.", 0 of
23,973 Discovered) and the flag does not survive into the page's own links.
`/atlas?sample` says 0 of 214 Kana Known. `/quiz?sample` says "Nothing to
quiz", where with the switch on the same URL deals one of every kind of card.
`/sessions?sample` says "Nothing yet". `/lesson?showcase` says "Nothing to
teach". And the sixth is the one no URL can reach: it takes the real POST the
sessions page makes, with its real action id, and sends it again with
`{"sample":true}` in place of the caller. The answer carries none of the
pretend learner's sessions, which are minted as `sample-<ts>`, and it is byte
for byte the answer the same call gets with no claim at all.

The spec belongs to that config and to nothing else, and `playwright.config.ts`
ignores it by name, because under a server started with the variable all six
assertions are false. That was checked on purpose: the same build, started once
with `SAKU_DEV_SURFACES=1`, fails all six. A test that passes either way would
have proved nothing.

**Vercel must not carry the variable.** That is the whole of the deployment
side, and it is in the root README's environment table now.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 4,015
unit tests, 4,014 pass and 1 skipped, nineteen of them new: the switch and its
two rules, `trustedWho` and `devFlag` on and off, `whoFor` on and off with the
account read mocked, and an action called with a forged `{ sample: true }` both
ways. 56 e2e pass unchanged, and 6 more in the off-state run.

## A lesson's quiz asks about everything it taught, every way it can (2026-09-16, SAK-447)

Sam, on a night of nine words: "when i did a 9 item lesson, i got an 8 item
quiz instead", and then the sharper half of it: "it's including prerequisites
but then the quiz isn't including quizzing the prerequisites so even though i
learned 18 things, i got quizzed on 8". Then, on a screenshot of a seven card
quiz that was six "Listen" cards and one written one: "the lesson quizzes
should ask each type of question available for each taught thing."

**The basket of eight was never a lesson's.** `QUIZ_CAP` is SAK-311's daily
review: what is due, cut to something a person will actually sit through. It
was applied to a lesson's own picks too, `slice(0, QUIZ_CAP)` on the way out of
`quizFacts`, which is why a lesson of nine words ended in a quiz of eight
cards. A lesson's quiz is not a basket. It is the lesson, asked back, so it is
as long as the lesson was. The cap stays exactly where it belongs, on the
branch with no picks.

**A lesson teaches more than its picks, and now the quiz knows it.** The picks
branch gathered `pickFacts` of the picks and nothing else, while the lesson had
walked the learner through `graph.orderOf(pick)`: the pieces, then the
character, then the word. Nine words are sixteen stars. `taughtStars` walks the
same order over the same items, through `offerPicker` rather than the whole
Observatory, so the quiz can only ask about what the lesson put on the screen,
and the test asserts exactly that: the set of entries behind the cards equals
the set of steps `lessonSteps` would deal that have a quizzable fact.

**"Taught tonight" is a fact with nothing recorded against it.** Not the graph's
`learned`, because opening a star in a lesson marks it SEEN, and seen is not
tested. So a prerequisite is asked when `history.facts[f].seen` is absent or
zero and there is no claim, and a prerequisite the learner already had a record
for is a reference under tonight's words rather than a step, and is left alone.
A pick is asked because it was picked. `quizzable` still gates a kanji's
readings, so a kanji taught tonight is asked what it means, and how it is said
only inside a word that proves the reading, which tonight has not proved yet.

**The sound is a card beside the writing, not instead of it.** This is Sam's
second screenshot, and it was one line: `listenIt` chose between the written
card and the listening one on a coin flip, so a fact was asked one way or the
other and a short deck could lose that flip six times running. In a lesson's
quiz `everyWay` turns the flip off: the written card is always dealt, and where
the fact has something to play, `heardTwin` deals it again by ear under the
`#listen` id the sample already used, which the recorder strips back to the
fact so both count for the one thing they ask about. The pitch card is
unchanged (SAK-344). The daily review and Practice keep the coin flip, since
there one fact is one card by design, and a due deck of eight drawn from
hundreds cannot come out all by ear the way a lesson of one word can.

**The two cards of one fact never sit together,** because the written one would
give the heard one away. Nothing new was needed: `shuffleDeck`'s spread already
moves a word's own cards apart (SAK-388), and the two cards of a fact are two
cards of its item. The test deals the nine word lesson twenty times over and
walks every pair.

**What a resumed run had quietly been dropping.** A saved run and a retry name
their cards by id, and `cardsFor` knew a fact and a word's pitch card and
nothing else, so every `#listen` id it was handed dealt nothing at all: a
lesson quiz reloaded halfway came back five cards shorter than it went away.
It deals that card now, which the e2e reload test holds end to end.

**The numbers, for the nine words Sam's lesson opened with.** Sixteen stars
taught. Before: eight cards, all of them picks. After, with audio prompts and
pitch questions off: eighteen cards, one for every star with something
quizzable behind it, the seven prerequisites among them (一, 丁, 口, 可, 何 and
言 asked what they mean, and the radical 亅). With both settings on, as Sam has
them: thirty one, eleven of them the same facts asked by ear and two of them
pitch. No copy needed bringing in line: neither How Saku works nor the lesson's
own way into the quiz ever said how many cards it would be.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 4,006
unit tests, 4,005 pass and 1 skipped, ten of them new and all in
`src/app/(sky)/quiz.test.ts`: five on what a lesson asks about (every star the
lesson teaches, no cap over it, a kanji asked its meaning, a prerequisite with a
record left alone, the daily review still cut to eight) and five on how it asks
(the written card, the same card by ear and the pitch card, nothing by ear with
audio off, the two cards of one fact never adjacent over twenty deals, a card
asked by ear dealt again when a run is resumed, and the coin flip left to the
daily review). 56 e2e pass, four expectations moved rather than loosened: the
five hiragana vowels are ten cards now, so the visitor's reload test reads
"1 of 10" and "3 of 10" and the offer to come back reads "10 cards, 2 answered".
`scripts/unreachable.mjs --list` at zero and `scripts/unused-exports.mjs` at
zero on both lists.

## Forgetting a session asks with the button alone (SAK-449)

Same pattern as the saved recipe's delete (SAK-443): the confirm in Sessions lost its sentence ("Its answers leave your schedule.") and the destructive button says what it does for good, "Forget it forever", beside "Keep it". `InlineAsk`'s line has been optional since SAK-443.

## The hint says how a word is said, and never shows the answer (2026-09-17, SAK-453, SAK-454)

Two things Sam said about the quiz hint, fixed together because they are the same few lines.

**The reading is a sentence (SAK-453).** The hint for a kanji word used to be the bare kana on a line of its own. It now reads "This is said as でる." with the kana in the accent color. The card carries it as `hint.reading`, apart from `hint.text`, so the component draws the sentence and the data stays a plain reading. Whether a reading is a hint at all is still `readingIsAHint` (SAK-448).

**The grammar hint names the kind of word and the form, nothing more (SAK-454).** Sam, on a hint whose last line was "げんきな + みせ → げんきなみせ": "this hint shows the answer. it should only give hints saying things like this is a na adjective." The last line of a derivation is the answer, so the equations are no longer part of the hint. The engine's derivation hint keeps its class line in `text` (the engine tests pin that) and adds the form line as `form`; the quiz joins the two into `hint.text`. The derivation itself goes on the card as `built` and is drawn only after the answer, under "How it is built" (`QuizBuilt` in `quiz-verdict.tsx`).

Tests: a card with a derivation has every `built` line as an equation, and its hint has no arrow and does not contain the answer; the SAK-429 and SAK-448 reading tests read `hint.reading`, and 先生 keeps "先 is before, 生 is life" as its `hint.text`.

## An unfinished quiz no longer gets in the way of a lesson (2026-09-16, SAK-444)

Sam, on SAK-404: "it works but if i start a lesson after that and then leave the
lesson, it doesn't let me proceed with the lesson."

**What was actually blocking it**, driven in a production build before anything
was changed. Two cards answered on `/quiz?picks=kana-row:h-vowels`, then
`/lesson?picks=kana-row:h-w` walked to step 3 of 8 and left:

1. The one offer knew only the quiz. The home and the Observatory carried
   "Continue where you left off? 5 cards, 2 answered", linking to
   `/quiz?picks=kana-row:h-vowels`. Nothing anywhere offered the lesson, so
   there was no way back into it at all.
2. The lesson's own place was kept nowhere. Opening `/lesson?picks=kana-row:h-w`
   again put the learner on "Step 1 of 6", not on step 3, and the 8 had become 6
   because opening a star marks it seen, which puts it in the learner's sky,
   which takes it out of what the lesson teaches.
3. The lesson's drill landed on the old run's ask. Pressing Drill went to
   `/quiz?from=observatory&picks=kana-row:h-w` and got "You left a quiz part way
   through: 5 cards, 2 answered. Only one run is kept, so starting this one lets
   that one go" -- the lesson's own quiz could not be reached without giving up
   a run from somewhere else.
4. And Sessions said nothing about any of it.

All three of the card's guesses, and the fourth is the reason the card asked for
a row in Sessions.

**A place, not a run.** `src/sky/lib/place.ts` is the model: one document with
two slots, the quiz left part way through and the lesson left part way through,
one of each and never two of either. The document says which version it is, and
a document with NO version is SAK-404's bare run, read as a place holding that
quiz and no lesson. That migration is the whole reason the version is there: a
learner who was halfway through a run on the day this shipped keeps it, in their
browser and in their `session` column alike. The key is SAK-404's, deliberately:
renaming it would have thrown away exactly the runs the migration exists for.

**One quiz, and why not two.** The column is last-writer-wins over one document,
and a list of unfinished runs needs a rule for how long a run stays in it and a
way to throw the oldest one out. One of each kind needs neither. So starting a
second quiz while one is unfinished still asks first, in the card's own words:
"You have an unfinished quiz (12 of 30). Starting this one replaces it", with
"Start and replace" and "Go back to it". `InlineAsk` grew an optional
`keepLabel` for that one case, because "Keep it" beside "Start and replace"
reads as keeping the new one; everything else keeps SAK-364's wording.

**What the lesson keeps, and what coming back cannot put back.** A lesson writes
its picks, the star it is on, that star's place in the order and how long the
order was, after every step. Not on the step it OPENS on: that is not a move,
and reporting it would either keep a lesson nobody has walked or write over the
very place that sent the learner here. Pressing Drill clears it, because the
lesson is over the moment its quiz is open; `SkyButton` now passes an `onClick`
through to a link so that can happen on the way out.

When this was written the order itself could not be put back: a star opened
was marked seen, which took it out of what the lesson teaches, so "step 3 of 8"
came back as "Step 1 of 6". SAK-446 ended that. Opening a star no longer moves
it out of the order, so a lesson comes back on the step it was left on, with the
same count. The star is still looked up by id on the way in; if it is ever not
in the order, the lesson opens where it would have opened anyway.

**One button, the newest wins.** `ResumeLine` is gone. The Planetarium and the
Observatory carry one `ContinueButton` beside the heading, saying what it goes
back to and how far in: "Continue your lesson (step 3 of 7)", "Continue your
quiz (12 of 30)". Two Continues side by side is a question rather than an offer,
so the other one waits under "Unfinished" at the top of Sessions, as a row with
Continue and Forget, and Forget asks first. A quiz is listed there whether or not
it is the one on the button, since Sessions is where letting a quiz go belongs;
a lesson is listed only when the button is not already offering it. `runNote`
went from "12 cards, 5 answered" to "5 of 12" for the same reason: it used to be
its own sentence and now it rides in three different places.

**Nothing blocks starting.** "Start lesson" has always started the lesson picked
and still does. The lesson page never reads the quiz slot, never asks about it,
and a lesson's drill is a different ask from whatever run was saved, so it deals
its own cards whichever way the learner answers.

**Two writers, one document.** `keepRun` and `keepLesson` each start from the
place this page load is holding and change one slot, so the quiz writing itself
down after every answer cannot clear the lesson. The guard that keeps a quiz
screen's opening report from wiping the column moved out of `keepRun` and into
`reportRun`, which is what the quiz calls after every answer: `keepRun(null)`
now means it, which is what a Forget from Sessions needs. The lesson has no such
guard and needs none, since it reports only when the learner steps.

**The gate.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 4,019
unit tests, 4,018 pass and 1 skipped, from 3,996: twenty-one new ones on the
place, over the shape, the migration off SAK-404's bare run, what is worth
keeping after a step, which lesson a place belongs to and what Continue offers,
and two on where each kind is continued. The signed-in half rides the store's
two primitives against a fake `progress` table, the way SAK-404 left them, since
auth is off in the e2e build. 58 e2e pass, two of them new: Sam's own sequence
end to end (an unfinished quiz, a lesson started, left, continued from the home,
and the quiz found again in Sessions and continued), and the Forget ask on an
unfinished row, backed out of and then gone through with. SAK-404's own test
needed one line changed, which is the migration seen from the other side: the
run is under the same key, in the quiz slot of the document now.
`scripts/unreachable.mjs --list` at zero, `scripts/unused-exports.mjs` at zero on
both lists, and `scripts/button-centering.mjs` at 0 elements over 1px.

The suite was run on a port of its own through a throwaway config, deleted
afterwards: another lane's run took 3249 out from under this one mid-suite, and
seventeen tests failed on a server that was no longer there.

## The lesson holds still, and reads as a two by two (2026-09-16, SAK-446)

Sam, on the lesson page: "once i open something in the lesson, it should not
move to the references section, it should stay in the tonight, in order
section." And, on the header: "step 1 of 8" turning into "step 1 of 7" every
time she pressed Next.

**One cause, three symptoms.** Opening a star in a lesson marks its facts seen
(`seeId`), which is what puts it into rotation. Seen is also what makes a star
one the learner already has, and the rail's split reads exactly that: what
tonight teaches is what is NOT already in the sky (SAK-416). So the lesson
rebuilt itself under the learner's feet. Signed out, on a row of five kana, one
press of Next read "Step 1 of 4": い had left "Tonight, in order" and was
sitting under References marked IN YOUR SKY, the step total had lost a step
while `n` stayed put, and the three terms that had been under References were
gone too, because the app's own teaching walk stops offering a term once it has
seen the learner meet the star behind it. A reload put none of it back, because
the server rebuilt from the same changed history.

**The fix is upstream of all three.** `beforeTonight` in
`src/app/(sky)/lesson.ts` hands the whole build a history with the bare seen
marks on tonight's picks and everything under them dropped: the picks and their
closure come from `offerPicker` (only the picks are built, not the whole sky),
their facts from `pickFacts`, and `applyDropSeen` takes the marks off. The
steps, the references and the walk then all read a learner who has not opened
tonight's stars yet, so they answer the same on every render and after a
reload, however many of tonight's stars have been opened. Nothing downstream
knows: `lessonSteps`, `lessonReferences` and `SkyLesson` are untouched, and the
page still computes the order from the payload the way it always did.

The two candidates the card offered were this and holding the order the first
payload gave, in the client. The client one cannot survive a reload, and the
card asked for a reload to be safe too, so it was this one.

**What a bare seen mark is, is the whole of the rule.** A star drilled or
claimed is met by its own answers (`facts[f].seen`) or its claim, and this
touches neither, so it stays a reference. Only a star whose entire history is
"it was shown to me in a lesson" counts as untaught. That is tonight's own
stars, and it is also the deliberate trade: a card read on some earlier night
and never practiced is taught again rather than listed as something the learner
has. Reading a card once is not learning it.

The header was left alone otherwise. N counts the prerequisites tonight
teaches, so nine picks really can read "Step 1 of 18", and N is always the
number of rows in "Tonight, in order", which is now pinned by a test.

**The layout is one grid with two rows.** Sam: "let's move the references
section to be to the right of the constellation panel above the tonight, in
order section. make it the same height as the constellation panel. make the
tonight in order panel the same height as the details panel." The lesson was a
sky across the top, the card under it, and one rail at the right holding both
lists in a single scroller. It is a two by two now: the sky and References
across the top, the card and "Tonight, in order" under them. One grid, two rows
(`minmax(180px,42%)` and `minmax(0,1fr)`), so each row's two panels are exactly
as tall as each other rather than two columns agreeing by eye: measured at 1440
wide, the sky and References are both 310px and the card and the order both
412px, to the pixel.

The four cells are placed by row and column rather than by their order in the
markup, which leaves the DOM reading sky, details, Tonight, References. That is
the stack a narrow window wants, so below `lg` the grid is simply off and the
four are that stack. The body scrolls there now: it used to clip, so at 760
wide References was drawn past the bottom edge with nothing that could reach
it. Each panel owns a cell and scrolls inside itself, which is what SAK-416's
one-scroller-for-both was working around when the two shared a column.

A lesson that rests on nothing leaves no hole: with no references the sky spans
the whole top row (`lg:col-span-2`), and the empty panel is not drawn, the way
SAK-416 left it. The sample learner picking a piece on its own is such a
lesson, and it is what the test and one of the screenshots use.

The cells carry `data-lesson-cell` ("sky", "card", "order", "references"),
which is what the e2e test measures the four boxes by, since two of them are
not panels and none of them is addressable by its text.

There are no hide-rail or hide-cards buttons on the lesson to keep working:
"Hide the rail" is the Atlas's and "Hide the cards" is the Quiz's.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 4,002
unit tests, 4,001 pass and 1 skipped, from 3,996: six new on
`lessonFromPicks`, all in `src/app/(sky)/lesson.test.ts` (a fresh learner is
taught the whole row; one of tonight's stars marked seen changes neither the
order nor the references; every star of the lesson opened changes neither; the
terms and intros behind tonight stay; a claimed star is still a reference and
still out of the order; a piece picked on its own rests on nothing at all).
58 e2e pass, from 56: one walks a signed-out lesson, presses Next, waits for
the seen mark to land in the browser's copy and checks that N, the rows and
the references are all where they were, then reloads and checks again; the
other measures the four cells at 1440 and at 760. `scripts/unreachable.mjs
--list` at zero, `scripts/unused-exports.mjs` at zero on both lists, and
`scripts/button-centering.mjs` at 0 elements over 1px, 17 measured on the
lesson.

## Plain words everywhere a learner reads (2026-09-17, SAK-452)

Sam: "look for jargon like 'meet', 'met', 'gloss', etc in the app and then
let's replace them", then "'land' and 'sits' are also jargon". She does not
speak Japanese and she is the app's only reader so far, so a word that is
exact to a linguist and opaque to her is simply a wrong word.

**The rule.** Everything a learner can read says the literal thing in everyday
words.

- No linguist's or programmer's term unless the app teaches that term on its
  own page, and then only after it has been introduced. Out: gloss, lemma,
  morae (say "beats"; the Terms page for mora is where the word is taught),
  register (say "level", "kind" or "form"), paradigm, surface form, "facts" of
  a word (say "its meaning and its reading"), string, frame, ichidan, clock-
  time, felt-time. The FIELD may keep its name; the sentence may not, which is
  how `gloss` walked into copy in the first place.
- No figurative verb where a plain one works. Out: meet/met a word (see, learn),
  land as, lands on, landed (be, sound, go on, was right), sits (is, goes),
  carries (has), leans on (uses, relies on), lends (gives), lives (is kept),
  arrives (is taught), wins (is what counts), picks up (takes), flags (marks),
  drops you into (takes you to), foregrounds (puts the focus on), holds (has,
  lasts). "Strokes can meet at a slightly different place" is literal and
  stays, and so is every mnemonic: a cup that sits steaming is a picture, not
  a figure of speech.
- The product words Sam chose stay: standing, Solid / Getting there / Shaky /
  Slipping / Untested / Undiscovered, claim, recipe, deck, Planetarium,
  Observatory, Atlas, constellation, star.

**Read, do not grep.** The word list is examples; the rule is the point. The
round swept the copy file by file with a TypeScript walk that prints every
string, template part and JSX text a file can put on screen, then read those
sentences. 117 sentences changed across 29 files, every one of them at the
sentence level so the other lanes editing the same files still merge. A
handful were caught only by reading: "Here's what each one is claiming" used
the product's own word "claim" to mean "assert"; "a later lesson gated on a
kanji" was programmer's English; and "A word's standing is the worst of its
facts" needed the facts naming rather than renaming, so it now reads "the
worse of its meaning and its reading".

**The gate bans only what reading cannot miss.** SAK-443's
`no-jargon-in-learner-copy.test.ts` already walked src/sky, src/app/(sky) and
word-contrast-notes.ts for "gloss". It now walks the authored prose under
src/data too, named file by file rather than as a tree, because recipes.ts and
corpus.ts keep engineering notes in string fields where "lemma" is the exact
word. The banned list is gloss, lemma, morae, paradigm, surface form, "land
as", "meet it" / "have met" / "you will meet", register and distractor: each
one is a word Sam named, each one now appears nowhere, and each one carries
the sentence it was found in and what to say instead. "sits" and "carries" are
deliberately NOT banned. A rule that cannot tell a cup sitting on a nun's lap
from a reading sitting in a word would be worse than no rule, and those were
fixed by reading. Four allowlist entries cover the places a banned word is
right, all of them ids or search keywords rather than prose, and a third test
fails on an allowlist entry that no longer matches anything, so a stale
exception cannot quietly widen the gate.

`library-index.json` bakes each term's summary, so the kanji term page went
stale the moment its summary changed and `src/lib/library/terms.test.ts`
caught it. `npm run build:library-index` is part of changing a term.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean.
4,075 unit tests pass, 1 skipped, from 4,074: one new test on the jargon gate
(every banned word offers a replacement, and no allowlist entry is stale), and
the existing gate rewritten from one word to a list. 62 e2e pass: five
assertions in `e2e/sky.spec.ts` follow reworded copy (the Observatory's empty
picks line, the reading reveal's "Same character, and the word it is in
decides", and the sky's own label, which two tests find the sky by), and three
in `src/app/(sky)/quiz-rules.test.ts` and `src/lib/grammar/formula.test.ts` do
the same. A label a test locates an element by is copy like any other, and the
suite says so within a minute.
`scripts/unreachable.mjs --list` at zero and `scripts/unused-exports.mjs` at
zero on both lists.

## How Saku works: the rounds and breaks are part of SRS, and the page says so (2026-09-17, SAK-456)

Sam: "those rounds/breaks are intended to be a form of SRS. the two are connected." The SRS section has a new third paragraph: the spacing starts inside the lesson's own quiz (three rounds, a break of 5 and then 10 minutes), and the gap gets longer after that each time the answer is right. The first paragraph of "Rounds and breaks" named spaced repetition (SRS) back.

Then Sam: "now the how saku works sections are a bit redundant. maybe merge them into one section?" So "Rounds and breaks" is gone as a section and the SRS section tells it once, in order: what SRS is, the three rounds and the breaks inside a lesson, what a break shows, the longer gaps after the lesson, and Slipping. `src/data/how-it-works.test.ts` checks that the section id `rounds-breaks` does not come back and that the break lengths are still stated.

## Hint lines are whole sentences (2026-09-17, SAK-457)

Sam, on "べんり is a な-adjective. uses the form it takes before a noun": say "Use", and end with a period. Every line `src/lib/engine/hint.ts` produces is now a sentence with its period: the kind line, the form line ("Use the て-form."), the kanji meanings line, the pattern line and the attaches-to line ("It attaches to a verb."). Lines are joined with a space, in the engine and in `hintFields` in `src/app/(sky)/quiz.ts`.

## Unselect all, on both pages that pick things (2026-09-17, SAK-458)

Sam: "add an unselect all to the observatory and atlas pages." Until now the
only way to empty a selection was to take it apart one thing at a time: click
each card again, or press the × beside each line of tonight's picks.

**One button, the same on both pages.** An outline `SkyButton` reading
"Unselect all", beside the selection's count and the other things that can be
done to it: in the Observatory's "Tonight" panel, above "I already know these"
and "Start lesson"; in the Atlas's panel for several entries, after "Quiz me".
It is drawn only when something is picked, and it asks nothing first, because
nothing is lost that another click cannot put back.

The Atlas's single entry keeps the × it has always had and gets no button: one
thing open is a reference card about that thing, not a selection with a count
and actions on it, and "Unselect all" over one entry would be a strange way to
say "close this".

**What one press takes out.** Everything, not only what is on screen. The
Atlas keeps ONE selection across its shelves, its cuts and its search results,
so a tile picked on a shelf nobody is looking at goes with the rest; neither
page writes its picks to the URL or to storage, so there is nothing else to
clear (`?picks=` is read once, when the Observatory opens). The anchor goes
too: it is the tile a shift-click draws its range from, and leaving it behind
meant the next shift-click could stretch back to something nobody had picked
since. On the Observatory the line offering the last single removal back goes
as well, since there is no longer a pick for it to return to.

**The rules of picking are now plain functions.** `src/sky/lib/select.ts`
holds a selection as data (`ids` and `anchor`) with `afterPick`, `justThis`
and `NOTHING`; `useSelection` is the same hook over those functions, and the
Observatory's own picks, which follow the cart's rules, take `NOTHING` for
the clearing. A hook cannot be unit tested in this harness (the suite is plain
`node --test` over `.ts`, with no renderer), so moving the rules out is what
gives the clearing a test at all.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean.
4,085 unit tests, 4,084 pass and 1 is skipped, from 4,077: eight new in
`src/sky/lib/select.test.ts` (a plain click, a toggle, a range in both
directions, and four on unselecting: nothing is left, ids that are not on
screen go, the anchor goes, and the page is back where it started). 64 e2e
pass, from 62: one picks two sentence rules on the Observatory, presses the
button and checks the count, the cards, the empty line and the Start lesson
that cannot be pressed; the other picks two tiles on the Atlas and checks the
count and that no tile is marked. `scripts/unreachable.mjs --list` at zero,
`scripts/unused-exports.mjs` at zero on both lists, and
`scripts/button-centering.mjs` at 0 over 1px: its Observatory page now picks a
card first, so the picks' own buttons are among the 36 it measures there
rather than 32 it never saw.

## A rule's table says what kind of word its rows hold (2026-09-17, SAK-455)

Sam, on the quiz reveal for a 〜な card: the rule's table had the columns TYPE,
VERB, RESULT, and the rows under VERB were adjectives (たかい (expensive) +
みせ (shop), しずか (quiet) + な + みせ (shop)). "Verb" is not a heading the
learner can read past: it says the wrong thing about every row under it.

**Where the word came from.** `ruleTable` in `src/app/(sky)/teach.ts` builds
every build table the app draws, on the grammar pages and in the quiz reveal
alike, and it wrote the string "Verb" over the second column with no way for a
page to say otherwise. Only the DERIVATION tables could name that column, and
they already named it right. So the heading is now `BuildHeads.word`, which
defaults to "Verb" and is set by the kind of word the rows hold.

**Set from the word class, not typed in.** `wordColumn(classes)` in
`src/data/grammar/auto-page.ts` maps the classes of the rows a table KEPT
through the recipe's own filtering to the heading over them: "Verb",
"Adjective" or "Noun", with the two adjective classes sharing one word, since
an い-adjective and a な-adjective are both adjectives. The two generators
that build grouped tables (`patternRuleTables` and form-intros'
`formRuleTables`) pass the classes of the rows they kept, and the two
hand-authored adjective tables in `src/data/grammar/lessons.ts` (the 〜な rule
and the て-form's adjectives) call the same function rather than writing the
word out.

Fourteen tables changed and no other: the 〜な rule now reads TYPE ·
ADJECTIVE · RESULT, and the adjective tables under 〜た, て/で, 〜ば and 〜たら
say Adjective too. Every verb table is untouched, and the noun rules were
already right, since they are derivation tables.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean.
4,089 unit tests, 4,088 pass and 1 is skipped, from 4,085: four new in
`src/app/(sky)/teach.test.ts`, which reads the headings off every table of
every grammar lesson the app can teach rather than off the one card that was
wrong. The 〜な rule's table is pinned whole; every table of adjectives has to
name its adjectives and must not say Verb; every table of verbs still says
Verb; every table of nouns says Noun. Each of the four counts what it found
first, so none of them can pass by matching nothing. 64 e2e pass,
`scripts/unreachable.mjs --list` at zero, `scripts/unused-exports.mjs` at zero
on both lists, `scripts/button-centering.mjs` at 0 over 1px.

## A word read several ways that mean different things takes any of them (2026-09-17, SAK-459)

Since SAK-429 a kanji word's meaning card hides its kana, so the card shows 後 on its own and asks what the word means. But 後 is read あと, behind, and ご, after, and with the kana hidden the card never said which of the two it meant. A learner who read the glyph as ご and typed "after" was marked wrong for a right answer to the question on her screen. Sam approved the fix on 2026-09-17: accept the meaning of any of the word's readings.

**64 words, 135 cards.** The vocabulary holds 89 words written with kanji and read more than one way, and 64 of them are read ways that mean different things (the card was written expecting 69; 64 is what the data says today, counted the way `readingsMeaningDifferently` counts). Between them those 64 mint 135 meaning cards, and every one of them now takes what any of the word's readings means. A word whose readings all mean the same thing is not ambiguous and is left alone: 九 is きゅう and く and both are nine, which `interchangeableReadings` already knew (SAK-393).

**Only the card that hid the reading.** A card whose reading is on the screen or in the ear asked about a reading the learner could see, so it keeps its own key: a listening card, a kanji's reading anchored in a word, a word written in kana. The widening hangs off the same `readingHint` the hidden kana hangs off, so the two can never disagree. A lesson's quiz deals the written card and the same card asked by ear, and the card asked by ear is built from the written one before it is widened, so あと played aloud takes "behind" and not "after".

**The reading cards were already fine.** A word reading card shows the meanings of the reading it asks about as its context (後 over "behind, rear" against 後 over "after"), so it says which reading it wants and never had this problem. They are untouched, and あと's card still refuses ご.

**The reveal says which is which.** `QuizCard.readings` is the line "あと: behind · ご: after", the reading the card asked about first, drawn under the answer by `Mixed` so the kana are in the Japanese face and the English is in the page's. It replaces the "Also:" line on these cards rather than sitting beside it: `answerLine` names an alternate spelling a synonym, and "Also: behind" over the word "after" would call two different meanings the same thing.

**The board never offers another reading's meaning.** The card takes "after" typed, so offering "after" as a wrong choice would mark a right answer wrong. Any choice whose wording is one of the other readings' meanings is dropped from the board. Nothing was ever dropped in practice over all 135 cards, because the choices are drawn from words of about the same rank and rarely say the same thing, and no board ever came down to one choice.

**And 後 is asked once.** With the kana hidden, its two meaning cards show the same glyph, ask the same words and take the same answers, which is SAK-393's test for two cards being one question, so the deck keeps one of them. 日's two reading cards are still two, because those say which meaning they ask about.

`cardsFor` also got shorter on the way past: a card named `fact#listen` is now dealt by asking `quizCards` for the pair and taking the one by ear, rather than rebuilding the twin a second way, so what such a card accepts is decided in one place.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 4,085 unit tests pass, 1 skipped: eight new ones in `src/app/(sky)/quiz.test.ts` (後 takes behind, rear and after; the readings line and its order; no other reading's meaning on any board over all 64 words; every meaning of every reading accepted over all 135 cards; the one card; 九 left alone; the reading cards left alone; the card by ear left alone), one in `src/sky/lib/quiz.test.ts` for the "Also:" line, and the SAK-393 test for 日 now counts its reading cards and its one meaning card. 62 e2e pass. `scripts/unreachable.mjs --list` at zero and `scripts/unused-exports.mjs` at zero on both lists. Button centering: 0 shapes over 1px across 7 pages.

## A lesson is one sitting, and Continue goes back into it (2026-09-17, SAK-444, reworked)

Sam tried the first cut and sent it back: "i'm not seeing a continue lesson on the lesson page. i think when a lesson is started and stopped mid session, the user's observatory should let you continue that lesson regardless of where the user was, mid lesson, mid quiz, mid break."

**What the reproduction found**, signed out, in a production build. (a) A lesson opened and left on step 1 wrote nothing at all: `sky:quiz:run` was empty and the Observatory offered nothing. (b) Walking the lesson to its end and pressing Drill threw the lesson away on the spot, so after two answers the only offer was "Continue your quiz (2 of 16)", a bare quiz with no lesson anywhere in the document. (c) The break could not be reached at all. Finishing round 1 signed out put "How it went" on the screen for about a quarter of a second, and then a freshly dealt round 1 replaced it: `useSkyData` loads again whenever the browser's copy of the history changes, recording a round changes it, and a new order meant a new `key` on `SkyQuiz`. So "Take a rest, then round 2 of 3" could never be pressed, and rounds 2 and 3 were unreachable for a visitor. That is a fourth thing, under Sam's three.

**A lesson is now one sitting**: the steps, round 1, a break, round 2, a break, round 3. From the moment it is opened until its last round is over (or the learner forgets it), the Planetarium and the Observatory carry one button back into it, saying where "there" is: "Continue your lesson (step 3 of 9)", "Continue your lesson (round 1, card 4 of 18)", "Continue your lesson (break before round 2 of 3, 3 min left)". The steps go back to the lesson page and the rounds and breaks to the drill, which is where each of them lives.

**The saved shape.** `SavedLesson` in `src/sky/lib/place.ts` is the picks, `leftAt`, and a `LessonPart` that is one of three: `steps` (the step, how many, and which star), `round` (which round, and the run itself, the same envelope the quiz slot holds), or `break` (which round just ended, when it started and when it is over). The document is version 3 and reads both older shapes: version 2's lesson was a step written straight onto the lesson, which reads as a sitting on its steps, and a document with no version at all is SAK-404's bare run, which reads as a place holding that quiz. The browser key is still `sky:quiz:run`, for the reason it was kept last time: renaming it throws away the very runs the migration exists for. `sky:quiz:rest`, which held the break in one tab and knew nothing about the account, is gone and is swept.

**Who writes what.** The lesson page writes the steps, and now writes them the moment the lesson opens: a lesson opened and left on step 1 is a lesson that was started, and leaving it out was the whole of (a). Reporting the opening step is safe only because SAK-446 settled the order when the lesson starts, so a resumed lesson reports the same step of the same order rather than a shorter one over it. Drill no longer clears anything. The drill writes the rounds and the breaks: a round is kept from the moment its screen mounts, before a card is answered, and the break is written when a round ends rather than when "Take a rest" is pressed, so a learner who closes the tab on the results screen is between rounds and the offer says so. Finishing the last round clears the slot, and so does Forget.

**A drill of picks is a lesson's drill.** Three rounds and breaks are what `rounds > 1` means, and that is every quiz asked for by picks, including the Atlas's "quiz me on these". So all of them keep their place in the lesson slot and read "Continue your lesson". The quiz slot is now what it says on the card: what is due, a practice deck, and a run of named cards. It is the only way the break could be kept for the Atlas path too, and it means a lesson's drill never reads the quiz slot, so it can neither lose a quiz nor ask about one.

**The deck is dealt once and holds for the sitting**, which is (c). `QuizDeck` settles the cards the first time it has them, keyed by what the page was asked for, so a reload of the history cannot re-deal them underneath a round; a retry names different cards, so it deals again as it should.

**The clock is the reader's.** A render may not call `Date.now()` here, so `useNow` (`src/sky/components/use-now.ts`, out of the break screen's own private hook) holds it in state from an effect and answers null until there is a browser. The break says "break before round 2 of 3" while it is null and gains ", 3 min left" after, which is the trade the sessions list already makes for its timestamps, and it is what lets the button render on the server for a signed-in learner.

**Sessions' Unfinished rows** lost the sentence beside the ask (Sam, 2026-09-17: "forget it forever. just put an indicator that this was a quiz in progress"). The ask is now the app's own delete, "Forget it forever" and "Keep it" with no line, and each row wears a small "In progress" tag that stays put while the ask is open.

**The gates.** `npx tsc --noEmit` and `npx eslint src e2e scripts` clean. 4,093 unit tests, 4,092 pass and 1 skipped: the place document's three parts, both migrations and every wording of the offer, plus `src/app/(sky)/account-place.test.ts`, which drives the signed-in read path (`readSessionRow` and `readPlace`, which is all of `loadPlace` under the auth layer) against a fake `progress` table, so a signed-in learner's sitting is proven to reach the button that the signed-out e2e cannot test. 65 e2e pass, three of them new: the whole sitting left and picked up at all three points, the sitting ending with its last round, and the Forget ask as Sam asked for it. `scripts/unreachable.mjs --list` at zero, `scripts/unused-exports.mjs` at zero on both lists, and `scripts/button-centering.mjs` at zero over 1px.
