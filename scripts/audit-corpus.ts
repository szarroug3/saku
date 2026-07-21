// Drop every corpus example that does not demonstrate the pattern it is filed
// under, and record what was dropped.
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
//   grammar-corpus.json          the survivors
//   grammar-corpus-meta.json     TRUE per-pattern counts, plus an `audit` block
//   grammar-corpus-dropped.json  every dropped sentence, with its reason
//
// The dropped file is the point of the exercise being auditable: "125 dropped"
// is a number, and the owner needs to be able to read the sentences and disagree.
// Nothing imports it, so it costs the bundle nothing.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { confoundFor, AUDITED } from "../src/data/grammar/corpus-audit.ts";
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
  /** True when the pattern was this sentence's only claim, so it left entirely. */
  readonly orphaned: boolean;
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

  for (const ex of corpus) {
    const guilty = ex.p.filter((p) => confoundFor(ex, p) !== null);
    if (guilty.length === 0) {
      kept.push(ex);
      continue;
    }
    const survivors = ex.p.filter((p) => !guilty.includes(p));
    for (const p of guilty) {
      const sp = ex.sp[p]!;
      dropped.push({
        id: ex.id,
        jp: ex.jp,
        en: ex.en,
        pattern: p,
        span: ex.jp.slice(sp[0], sp[1]),
        why: confoundFor(ex, p)!,
        orphaned: survivors.length === 0,
      });
    }
    // A sentence whose every claim was a confound has nothing left to teach.
    if (survivors.length === 0) continue;
    const sp: Record<string, readonly [number, number, string | null]> = {};
    for (const p of survivors) sp[p] = ex.sp[p]!;
    kept.push({ ...ex, p: survivors, sp });
  }

  // Seeded with every pattern the tagger has a signature for, so a pattern that
  // reaches ZERO keeps its key and stays visible to SCARCE. Dropping the key
  // would turn "no examples" into "no such pattern", which is the silent
  // failure this whole pass exists to stop.
  const after = { ...zeros(meta.perPattern), ...countByPattern(kept) };
  report(before, after, corpus.length, kept.length, dropped.length);

  if (check) {
    if (dropped.length === 0) return;
    console.error(`\nFAIL: ${dropped.length} confounded example(s) are still shipped.`);
    process.exit(1);
  }

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
        droppedExamples: dropped.length,
        droppedSentences: dropped.filter((d) => d.orphaned).length,
      },
    },
    2,
  );
  write("grammar-corpus-dropped.json", dropped, 2);
  console.log(`\nwrote grammar-corpus.json (${kept.length} sentences)`);
  console.log(`wrote grammar-corpus-meta.json`);
  console.log(`wrote grammar-corpus-dropped.json (${dropped.length} rows)`);
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
  const thin = Object.entries(after).filter(([, n]) => n < 20);
  if (thin.length > 0) console.log(`SCARCE (<20) after the audit: ${thin.map(([p, n]) => `${p}=${n}`).join(", ")}`);
}

main();
