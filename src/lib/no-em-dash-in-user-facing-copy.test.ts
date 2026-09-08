// SAK-235: SAK-84 removed em dashes from user-facing copy by a one-time
// manual sweep, and new instances kept landing afterward, several of them
// within hours or days of SAK-84's own cleanup commit (see SAK-235's ticket
// body). The lasting fix lives in eslint.config.mjs, which wires
// eslint-rules/no-em-dash-in-user-facing-copy.mjs onto src/data and the two
// trees a learner reads, src/app/(sky) and src/sky (see that config for the
// documented per-file exceptions:
// grammar/recipes.ts's internal `note` field, grammar/corpus-audit.ts's
// report-only confound table).
//
// `pnpm run lint` already enforces that rule in CI. This test runs the SAME
// project ESLint config, scoped to the SAME trees, so `pnpm test` catches
// a regression too: a contributor who runs tests but skips lint locally
// still gets caught before it reaches review, and a reader of the how-it-
// works.test.ts-style content-assertion tests finds this alongside them
// instead of only inside eslint.config.mjs.
//
// This only exercises `local/no-em-dash-in-user-facing-copy`'s own findings, and
// it filters every other rule out of the results, so it fails ONLY for an
// em dash regression, never as collateral damage from an unrelated lint rule
// changing elsewhere.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";

const RULE_ID = "local/no-em-dash-in-user-facing-copy";
const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

describe("no em dash in user-facing copy (SAK-235)", () => {
  test("the copy trees stay free of em dashes outside the documented internal-note exceptions", async () => {
    const eslint = new ESLint({ cwd: REPO_ROOT });
    const results = await eslint.lintFiles([
      "src/data/**/*.{ts,tsx}",
      "src/app/(sky)/**/*.{ts,tsx}",
      "src/sky/**/*.{ts,tsx}",
    ]);

    const violations = results.flatMap((result) =>
      result.messages
        .filter((message) => message.ruleId === RULE_ID)
        .map((message) => `${path.relative(REPO_ROOT, result.filePath)}:${message.line}: ${message.message}`),
    );

    assert.deepEqual(
      violations,
      [],
      `Found em dash(es) in user-facing copy (house style; SAK-84/SAK-235):\n${violations.join("\n")}\n\n` +
        "Rewrite with a period, comma, or colon. If this is genuinely internal-only " +
        "commentary (not shown to a learner), add a scoped exception in eslint.config.mjs " +
        "next to the existing recipes.ts / corpus-audit.ts ones. Do not disable this rule broadly.",
    );
  });
});

// AND THE SAME RULE FOR WHAT WE WRITE TO EACH OTHER (SAK-419). The lint rule
// above deliberately looks only at strings, template literals and JSX text, so
// engineering notes were never covered, and the day the Sky was built put em
// dashes into 226 fresh lines of comment. The house rule is none anywhere, so
// the second test below reads the files as text: a comment, a doc block and a
// line of README are all just characters, and a character is either there or
// it is not.
//
// SCOPED TO THE SKY AND THE TWO READMEs. The old app's src/lib and src/data
// carry thousands of them in comments written before the rule; sweeping those
// is its own job, and a gate nobody can get to zero teaches people to skip it.
// The trees here are the ones being written now.

/** The em dash, spelled rather than typed, so this file is not its own hit. */
const EM_DASH = "\u2014";

/** The trees whose comments are covered, and the two READMEs. */
const COVERED = ["src/sky", "src/app/(sky)", "e2e", "README.md", "src/sky/README.md"];

// TEMPORARY, and it goes when the lanes below land (SAK-419).
//
// SAK-416 holds sky-lesson.tsx, lesson.ts and teach.ts and SAK-411 holds
// sky-home.tsx, sky-field.tsx, constellation.tsx and constellation.ts, so
// those seven were not edited underneath another session. src/sky/README.md is
// the one file every lane appends to, and it gets its own pass once they are
// all in. None of the seven carries an em dash today; the README carries nine.
// Delete this list and the line that reads it once those lanes are in.
const HELD = new Set([
  "src/app/(sky)/lesson.ts",
  "src/app/(sky)/teach.ts",
  "src/sky/components/sky-lesson.tsx",
  "src/sky/components/sky-home.tsx",
  "src/sky/components/sky-field.tsx",
  "src/sky/components/constellation.tsx",
  "src/sky/lib/constellation.ts",
  "src/sky/README.md",
]);

const TEXT = /\.(ts|tsx|mjs|js|md)$/;

function filesUnder(rel: string): string[] {
  const full = path.join(REPO_ROOT, rel);
  if (statSync(full).isFile()) return [rel];
  return readdirSync(full, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(path.join(rel, e.name)) : TEXT.test(e.name) ? [path.join(rel, e.name)] : [],
  );
}

describe("no em dash anywhere in the Sky, comments included (SAK-419)", () => {
  test("the Sky's own trees, its specs and the two READMEs are free of em dashes", () => {
    const hits = [...new Set(COVERED.flatMap(filesUnder))]
      .filter((f) => !HELD.has(f))
      .flatMap((f) =>
        readFileSync(path.join(REPO_ROOT, f), "utf8")
          .split("\n")
          .map((line, i) => ({ f, n: i + 1, line }))
          .filter(({ line }) => line.includes(EM_DASH)),
      )
      .map(({ f, n, line }) => `${f}:${n}: ${line.trim()}`);

    assert.deepEqual(
      hits,
      [],
      "Em dash found, comments and docs included (house style; SAK-84, SAK-235, SAK-419):\n" +
        `${hits.join("\n")}\n\n` +
        "Rewrite with a comma, a period, a colon or parentheses, whichever the " +
        "sentence wants, and do not change what it says.",
    );
  });
});
