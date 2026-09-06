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
tail and visibility). `/dev/sky/wash` (gallery page removed 2026-09-04) is the editor: drag glows, pick colours,
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
scroll and resize with real content on top, the wash page and `/dev/sky/tokens` (gallery page removed 2026-09-04)
have a "cards" pill (bottom left) that overlays a fixed wash with a long column
of coverage cards; the wash switch beside it swaps modes. The wash (`bg-sky-mesh`) has two halves: the upper sky is text-safe, the
lower third is a vivid painted horizon where **only large ink (headings) sits
bare, and body and muted text live inside panels** (`bg-sky-card`), whose dark
glass is what the test checks them against. `/dev/sky/tokens` (gallery page removed 2026-09-04) shows every token live with its ratios.

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
"lit" are legend rows there, never chips. `/dev/sky/standings` (gallery page removed 2026-09-04) shows all of it.

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
reported, never hidden. `/dev/sky/graph` (gallery page removed 2026-09-04) builds it from the app's real kanji
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
colours via `paintFor`. `/dev/sky/constellations` (gallery page removed 2026-09-04) shows all of it on real words.

### The coverage bar

`CoverageBar`
(`src/sky/components/coverage-bar.tsx`) is the stacked bar by standing, in
the standing tokens, with no labels of its own: pair it with a headline and
a `StandingLegend` carrying the same counts. It takes the size of the whole
collection as a separate argument and is always drawn against that, never
the filtered part (`src/sky/lib/coverage.ts`, tested); a counted segment
never disappears (a hairline at least) and an empty bar still draws.
`/dev/sky/filters` (gallery page removed 2026-09-04) has both, live.

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
`src/app/dev/sky/learner.ts` reads the Library's entries and the learner's
history (a multi-fact entry's star wears the worst of its facts; a radical
taught as its kanji is the kanji's star), and `/dev/sky/planetarium` renders it on
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
`src/app/dev/sky/planetarium.ts` (kana rows from the character sets, words in
curriculum order, counting, grammar behind a plain-hiragana gate, verb pairs
and keigo attached to their plain verb); `/dev/sky/observatory` (`?sample`).

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

## Migration, when the time comes

Because the boundary is enforced both ways, the cutover is mechanical:

1. Point the real routes at Sky components.
2. Delete the old `src/components/<surface>` trees.
3. Remove the lint boundary and, if you like, flatten `src/sky/` up into `src/`.

No untangling step, because there is nothing tangled.

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
