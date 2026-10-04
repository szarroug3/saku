// Take a pattern tag off every corpus sentence that does not demonstrate that
// pattern, drop the sentences whose Japanese is wrong, and record both.
//
//     node scripts/audit-corpus.ts            rewrite the shipped JSON
//     node scripts/audit-corpus.ts --check    report only; exit 1 if unclean
//
// This is a POST-PASS over scripts/ingest/grammar.py's output, not a second
// tagger. It only ever removes. The rules and the reasoning live in
// src/data/grammar/corpus-audit.ts; this file is the plumbing.
//
// WHY BUILD TIME AND NOT REQUEST TIME
// ===================================
// grammar-corpus.json is COMMITTED and is the artifact — see corpus.ts. A
// request-time filter would leave a shipped file that claims 214 examples of
// 〜ので while serving 89, and every reader of the file (this repo's tests, the
// LICENSE's sentence-count carve-out, anyone auditing the data) would be reading
// a number that is not true. So the file itself changes.
//
// Rewrites three files:
//   grammar-corpus.json          every sentence but the wrong Japanese,
//                                with the confounded tags taken off
//   grammar-corpus-meta.json     TRUE per-pattern counts, plus an `audit` block
//   grammar-corpus-dropped.json  every dropped sentence, with its reason
//
// The dropped file is the point of the exercise being auditable: "125 dropped"
// is a number, and the owner needs to be able to read the sentences and disagree.
// Nothing imports it, so it costs the bundle nothing.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { auditExample, japaneseErrorFor, AUDITED } from "../src/data/grammar/corpus-audit.ts";
import type { Example } from "../src/data/grammar/corpus.ts";

const GEN = fileURLToPath(new URL("../src/data/generated/", import.meta.url));

const read = (name: string): unknown => JSON.parse(readFileSync(GEN + name, "utf8"));

/** Written the way grammar.py writes it: minified corpus, indented meta. */
const write = (name: string, value: unknown, indent?: number) =>
  writeFileSync(GEN + name, JSON.stringify(value, null, indent) + (indent ? "\n" : ""));

interface Dropped {
  readonly id: number;
  readonly jp: string;
  readonly en: string;
  readonly pattern: string;
  readonly span: string;
  readonly why: string;
  /** True when this sentence has no pattern left. It stays for word examples
   * unless `removed` is also true. */
  readonly orphaned: boolean;
  /** True when the sentence left the corpus: its Japanese is wrong. */
  readonly removed: boolean;
}

function main() {
  const check = process.argv.includes("--check");
  const corpus = read("grammar-corpus.json") as Example[];
  const meta = read("grammar-corpus-meta.json") as Record<string, unknown> & {
    counts: Record<string, number>;
    perPattern: Record<string, number>;
  };

  const before = countByPattern(corpus);
  const dropped: Dropped[] = [];
  const kept: Example[] = [];

  // What happens to one sentence, and why, is auditExample() in
  // corpus-audit.ts. This loop records it.
  for (const ex of corpus) {
    const { kept: row, struck } = auditExample(ex);
    const removed = row === null;
    const orphaned = removed || row.p.length === 0;
    for (const { pattern, why } of struck) {
      const sp = ex.sp[pattern]!;
      dropped.push({ id: ex.id, jp: ex.jp, en: ex.en, pattern, span: ex.jp.slice(sp[0], sp[1]), why, orphaned, removed });
    }
    if (row) kept.push(row);
  }

  // Seeded with every pattern the tagger has a signature for, so a pattern that
  // reaches ZERO keeps its key and stays visible to SCARCE. Dropping the key
  // would turn "no examples" into "no such pattern", which is the silent
  // failure this whole pass exists to stop.
  const after = { ...zeros(meta.perPattern), ...countByPattern(kept) };
  const untagged = kept.filter((ex) => ex.p.length === 0).length;
  report(before, after, corpus.length, kept.length, dropped.length, untagged);

  if (check) {
    if (dropped.length === 0 && kept.length === corpus.length) return;
    console.error(`\nFAIL: ${dropped.length} confounded tag(s) or ${corpus.length - kept.length} wrong sentence(s) are still shipped.`);
    process.exit(1);
  }

  // The shipped corpus has already lost what earlier runs dropped, so this run
  // only finds what a new rule catches. Keep the earlier rows in the record
  // so the file still lists every sentence the audit ever took out.
  const earlier = read("grammar-corpus-dropped.json") as Dropped[];
  const fresh = new Set(dropped.map((d) => `${d.id} ${d.pattern}`));
  // Rows written before SAK-511 have no `removed`. Then only wrong Japanese
  // removes a sentence, so that is what it means for them too.
  const record = [
    ...earlier
      .filter((d) => !fresh.has(`${d.id} ${d.pattern}`))
      .map((d) => ({ ...d, removed: d.removed ?? japaneseErrorFor({ id: d.id } as Example) !== null })),
    ...dropped,
  ];

  write("grammar-corpus.json", kept);
  write(
    "grammar-corpus-meta.json",
    {
      ...meta,
      counts: { ...meta.counts, kept: kept.length },
      // REDEFINED, on purpose. grammar.py wrote min(owned, cap) here, which was
      // 200 for 33 patterns while the file actually held 2,029 `wo` examples —
      // the cap counts sentences SELECTED for a pattern, and a sentence selected
      // for one pattern carries its other tags in with it. Post-audit the only
      // number worth recording is the one SCARCE and the coverage question both
      // need: how many examples of this pattern the shipped file really has.
      perPattern: after,
      audit: {
        by: "scripts/audit-corpus.ts",
        rules: "src/data/grammar/corpus-audit.ts",
        patterns: AUDITED,
        droppedExamples: record.length,
        droppedSentences: new Set(record.filter((d) => d.removed).map((d) => d.id)).size,
        untaggedSentences: untagged,
      },
    },
    2,
  );
  write("grammar-corpus-dropped.json", record, 2);
  console.log(`\nwrote grammar-corpus.json (${kept.length} sentences)`);
  console.log(`wrote grammar-corpus-meta.json`);
  console.log(`wrote grammar-corpus-dropped.json (${record.length} rows, ${dropped.length} new)`);
  // word-examples.json is derived FROM the corpus, so it is now stale. Its own
  // test catches this, but saying so here is cheaper than reading that failure.
  console.log(
    "\nNOW RERUN, or word-examples.json is stale:\n" +
      "  node --import ./src/lib/conjugate/test-hooks.mjs scripts/build-word-examples.ts",
  );
}

function zeros(known: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.keys(known).map((p) => [p, 0]));
}

function countByPattern(rows: readonly Example[]): Record<string, number> {
  const n: Record<string, number> = {};
  for (const ex of rows) for (const p of ex.p) n[p] = (n[p] ?? 0) + 1;
  return Object.fromEntries(Object.entries(n).sort(([a], [b]) => a.localeCompare(b)));
}

function report(
  before: Record<string, number>,
  after: Record<string, number>,
  rowsBefore: number,
  rowsAfter: number,
  drops: number,
  untagged: number,
) {
  console.log(`${"pattern".padEnd(16)} ${"before".padStart(7)} ${"after".padStart(7)} ${"dropped".padStart(8)}`);
  console.log("-".repeat(42));
  for (const p of AUDITED) {
    const b = before[p] ?? 0;
    const a = after[p] ?? 0;
    const pct = b === 0 ? 0 : Math.round(((b - a) / b) * 100);
    console.log(`${p.padEnd(16)} ${String(b).padStart(7)} ${String(a).padStart(7)} ${String(b - a).padStart(6)} ${String(pct).padStart(3)}%`);
  }
  console.log(`\nsentences ${rowsBefore} -> ${rowsAfter}; ${drops} pattern claims dropped`);
  console.log(`${untagged} sentences carry no pattern and are kept for word examples only`);
  const thin = Object.entries(after).filter(([, n]) => n < 20);
  if (thin.length > 0) console.log(`SCARCE (<20) after the audit: ${thin.map(([p, n]) => `${p}=${n}`).join(", ")}`);
}

main();
