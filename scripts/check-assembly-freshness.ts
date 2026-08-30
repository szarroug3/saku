// SAK-274: the assembly corpus is DERIVED from grammar-corpus.json by a
// separate script (scripts/ingest/assembly.py) that a human has to remember to
// re-run. Nothing enforced that: the source corpus grew by 1,125 sentences
// across two updates and assembly-corpus.json quietly went stale, missing 7
// already-approved べきだ-pattern sentences until this was caught by audit.
//
//     node scripts/check-assembly-freshness.ts
//
// This does NOT re-run the tokenizer (that needs fugashi/unidic-lite, which CI
// does not install) — it only checks that assembly-corpus-meta.json's recorded
// input size still matches the committed grammar-corpus.json. That number is
// stamped by assembly.py every time it runs, so any additive (or subtractive)
// change to the source corpus that wasn't followed by a regeneration shows up
// here as a mismatch, exactly the way this ticket's bug would have been caught
// before it shipped.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const GEN = fileURLToPath(new URL("../src/data/generated/", import.meta.url));

const read = (name: string): unknown => JSON.parse(readFileSync(GEN + name, "utf8"));

function main() {
  const corpus = read("grammar-corpus.json") as readonly unknown[];
  const meta = read("assembly-corpus-meta.json") as { counts: { input: number; kept: number } };
  const assembly = read("assembly-corpus.json") as readonly unknown[];

  const problems: string[] = [];

  if (meta.counts.input !== corpus.length) {
    problems.push(
      `assembly-corpus-meta.json says it was generated from ${meta.counts.input} grammar-corpus ` +
        `sentences, but grammar-corpus.json currently has ${corpus.length}. The source corpus ` +
        `changed since assembly-corpus.json was last generated.`,
    );
  }

  if (meta.counts.kept !== assembly.length) {
    problems.push(
      `assembly-corpus-meta.json says ${meta.counts.kept} items were kept, but ` +
        `assembly-corpus.json currently has ${assembly.length}. The two files were committed out ` +
        `of sync with each other.`,
    );
  }

  if (problems.length > 0) {
    console.error("STALE assembly corpus:\n");
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      "\nRe-run the regeneration script and commit its output:\n" +
        "  python3 scripts/ingest/assembly.py   (needs: pip install fugashi unidic-lite)\n",
    );
    process.exit(1);
  }

  console.log(
    `assembly corpus is fresh (${corpus.length} source sentences -> ${assembly.length} kept)`,
  );
}

main();
