// SAK-235: SAK-84 removed em dashes from user-facing copy by a one-time
// manual sweep, and new instances kept landing afterward — several of them
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
// a regression too — a contributor who runs tests but skips lint locally
// still gets caught before it reaches review, and a reader of the how-it-
// works.test.ts-style content-assertion tests finds this alongside them
// instead of only inside eslint.config.mjs.
//
// This only exercises `local/no-em-dash-in-user-facing-copy`'s own findings —
// it filters every other rule out of the results — so it fails ONLY for an
// em dash regression, never as collateral damage from an unrelated lint rule
// changing elsewhere.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
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
        .map((message) => `${path.relative(REPO_ROOT, result.filePath)}:${message.line} — ${message.message}`),
    );

    assert.deepEqual(
      violations,
      [],
      `Found em dash(es) in user-facing copy (house style; SAK-84/SAK-235):\n${violations.join("\n")}\n\n` +
        "Rewrite with a period, comma, or colon. If this is genuinely internal-only " +
        "commentary (not shown to a learner), add a scoped exception in eslint.config.mjs " +
        "next to the existing recipes.ts / corpus-audit.ts ones — do not disable this rule broadly.",
    );
  });
});
