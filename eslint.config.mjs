import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

import noEmDashInUserFacingCopy from "./eslint-rules/no-em-dash-in-user-facing-copy.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // SAK-235: SAK-84 swept em dashes out of user-facing copy once, by hand,
    // and new ones kept landing afterward (see SAK-235's ticket body — several
    // postdate SAK-84's own cleanup commit by hours or days). src/data holds
    // the app's content modules (lesson prose, reference-page text, tooltip
    // copy) and src/components holds the JSX/labels/props a learner actually
    // reads; those are the two trees SAK-84 itself audited. Test files are
    // excluded because the em-dash regression tests (e.g. how-it-works.test.ts)
    // legitimately hold the "—" character as the very string they check for.
    // src/sky is included for the same reason: it is redesign UI a learner
    // reads, and it would otherwise start life outside the one rule that keeps
    // em dashes out of copy.
    files: [
      "src/data/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/sky/**/*.{ts,tsx}",
    ],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    plugins: {
      local: { rules: { "no-em-dash-in-user-facing-copy": noEmDashInUserFacingCopy } },
    },
    rules: {
      // No allowedKeys here on purpose: a property name like `note` is not a
      // safe repo-wide signal (word-contrast-notes.ts and a couple of
      // components render their OWN `note` field straight to the learner) so
      // the escape hatch below is granted per FILE, not per key name.
      "local/no-em-dash-in-user-facing-copy": ["error", { allowedKeys: [] }],
    },
  },
  {
    // THE SKY BOUNDARY, half one: the redesign may not reach into the app.
    //
    // src/sky holds the new Home / Planetarium / Lesson / Quiz / Practice / Atlas work.
    // The whole point of keeping it in its own tree is that the current surfaces
    // can be deleted wholesale at cutover, and that only stays true if nothing
    // in here quietly grows a dependency on them.
    //
    // If the Sky redesign needs something the app already has, it takes its own copy.
    // A small helper duplicated is far cheaper than a dependency to untangle.
    //
    // The app's CSS design tokens are deliberately NOT restricted: those are
    // consumed as Tailwind classes, not imports, and reusing them is what keeps
    // all four themes and light/dark working. See src/sky/README.md.
    files: ["src/sky/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/*", "@/lib/*", "@/data/*", "@/types/*"],
              message:
                "The Sky redesign does not import from the existing app, so the old surfaces can be deleted at cutover. Bring a copy into src/sky instead. See src/sky/README.md.",
            },
          ],
        },
      ],
    },
  },
  {
    // THE CONTENT LIBRARY IS BUILD-TIME CODE.
    //
    // src/lib/content builds the curriculum indexes: scripts/build-learn-index.mjs
    // and the rest run it, write the JSON, and the pages read the JSON. A page
    // that imports one of those modules drags the whole library onto its cold
    // path to read something it could have been handed (SAK-398). If the Sky
    // needs a value that lives there, move the value out; do not import the
    // module.
    //
    // curriculum-meta is the exception, and the only one: it reads a
    // two-field JSON and nothing else.
    files: ["src/app/(sky)/**/*.{ts,tsx}", "src/app/layout.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/content/*", "!@/lib/content/curriculum-meta"],
              message:
                "The content library is build-time code: the index scripts run it and a page reads the JSON they write. Move the value you need out of src/lib/content instead of importing it. See src/sky/README.md.",
            },
          ],
        },
      ],
    },
  },
  {
    // THE SKY BOUNDARY, half two: the app may not depend on the redesign.
    //
    // Without this the boundary only holds one way, and the Sky redesign would slowly
    // become load-bearing for the current app — which would make it impossible
    // to iterate on freely, which is the entire reason it is separate.
    //
    // src/app/dev/sky is exempt: that route exists precisely to render the
    // gallery, and it is dev-only (the /dev subtree 404s in production).
    files: ["src/**/*.{ts,tsx}"],
    // src/app/api/dev is exempt for the same reason: it is the dev-only back
    // end of those gallery pages (the wash editor's save), and 404s in production.
    ignores: ["src/sky/**", "src/app/(sky)/**", "src/app/api/dev/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/sky/*"],
              message:
                "Only the Sky's own routes (src/app/(sky)) render the Sky; the rest of the app reaches it through them.",
            },
          ],
        },
      ],
    },
  },
  {
    // grammar/recipes.ts's `note` field is genuine internal engineering
    // commentary stored as a string property rather than a `//` comment —
    // SAK-84's own commit message calls this out by name as intentional and
    // separate from user-facing copy. Every other field on a Recipe (gloss,
    // pattern, intro, …) still goes through the base rule above.
    files: ["src/data/grammar/recipes.ts"],
    rules: {
      "local/no-em-dash-in-user-facing-copy": ["error", { allowedKeys: ["note"] }],
    },
  },
  {
    // grammar/corpus-audit.ts is the other file SAK-84's commit message named
    // as an intentional exception: it exports only confound SIGNATURES for
    // scripts/audit-corpus.ts's report-only CI step (why/holds), consumed by
    // console.error/a dropped-rows JSON, never rendered in the app. Turned off
    // wholesale rather than per-key since nothing in this file reaches a
    // learner.
    files: ["src/data/grammar/corpus-audit.ts"],
    rules: {
      "local/no-em-dash-in-user-facing-copy": "off",
    },
  },
  {
    // A leading underscore is our "deliberately unused" marker: stub params
    // that keep an API shape (_history, _range, _count) and the like. Honor
    // that convention so the intent reads as intent, not as a lint miss.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Playwright fixtures pass a callback named `use` (`async ({ page }, use)
    // => { await use(...) }`). React 19 added a `use` hook, so the react-hooks
    // plugin false-positives on those calls as "a hook called outside a
    // component". e2e/ is Playwright, not React, so the rule doesn't apply here.
    files: ["e2e/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    // a production build made somewhere else, so `next build` never rewrites
    // the tree a dev server is running from (NEXT_DIST_DIR=.next-prod)
    ".next-prod/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees live under .claude/worktrees and carry their own source
    // and .next. Bare `eslint` (the `lint` script) would otherwise walk into
    // them and drown real output in thousands of build-artifact problems. CI
    // lints `src` and never sees these; this keeps local `pnpm lint` honest.
    ".claude/**",
  ]),
]);

export default eslintConfig;
