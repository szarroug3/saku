# The Grove

The redesign, built clean. Everything under `src/grove/` is **new work for the
Nursery / Garden / Quiz / Practice / Library redesign**, kept deliberately
separate from the current app so the old surfaces can be deleted wholesale when
this replaces them.

Tracked in Linear under the `Grove: *` projects.

## The one rule

**Nothing in here imports from the existing app, and nothing in the existing app
imports from here.**

Not `@/components/*`, not `@/lib/*`, not `@/data/*`. If the Grove needs
something the app already has, it gets its own copy in here, however small. A
three-line helper duplicated is cheaper than a dependency that has to be untangled
during the cutover.

This is enforced by lint, not by discipline: see the two `no-restricted-imports`
blocks in `eslint.config.mjs`. If you hit that error, the answer is to bring a
copy into `src/grove/`, not to add an exception.

### The one exception: CSS design tokens

The Grove **does** use the app's CSS custom properties (`bg-card`, `text-text`,
`text-accent`, `border-border`, and the rest of the `@theme inline` block in
`globals.css`).

That is on purpose. Those tokens are the thing being kept — four themes
(aizome, graphite, momentum, kiri), accent variants, and light/dark, all driven
from one semantic set. Hardcoding hex here would mean rebuilding all of that and
losing theme support, which is the opposite of what we want.

So: **layout, components and logic are new; colour comes from the existing
scheme.** Never write a raw hex value in Grove code. If a semantic token does not
exist for something, add it to `globals.css` for every theme rather than
inventing a local colour.

## Layout

```
src/grove/
  lib/         types, tokens, small self-contained helpers
  components/  the shared primitives (ItemCard, ItemSection, ...)
```

Page-level composition lives in the route that renders it, not here.

## Where to look at it

`/dev/grove` — a gallery of every Grove component, one page per primitive.
Dev-only: the whole `/dev/*` subtree 404s in a production build, and the nav
group is compiled out.

## Migration, when the time comes

Because the boundary is enforced both ways, the cutover is mechanical:

1. Point the real routes at Grove components.
2. Delete the old `src/components/<surface>` trees.
3. Remove the lint boundary and, if you like, flatten `src/grove/` up into `src/`.

No untangling step, because there is nothing tangled.
