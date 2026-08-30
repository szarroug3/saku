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
    files: ["src/data/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
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
