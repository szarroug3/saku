// One-off mining helper for Package 3 (particle-drill-examples.ts). NOT wired
// into prebuild — this is a manual-review aid, run once by hand, its output
// hand-verified before anything ships into the real data file. See
// docs/particle-teaching-workplan.md "Package 3" for the full brief.
//
// Usage: node scripts/mine-particle-drill-examples.ts [particle...]
//   e.g. node scripts/mine-particle-drill-examples.ts は が を に で

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

interface Piece {
  readonly t: string;
  readonly h: string;
}

interface CorpusRow {
  readonly id: number;
  readonly en: string;
  readonly jp: string;
  readonly pieces: readonly Piece[];
}

const CORPUS_PATH = fileURLToPath(
  new URL("../src/data/generated/assembly-corpus.json", import.meta.url),
);
const CORPUS: readonly CorpusRow[] = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));

const particles = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["は", "が", "を", "に", "で"];

for (const particle of particles) {
  console.log(`\n=== ${particle} ===`);
  let count = 0;
  for (const row of CORPUS) {
    for (const piece of row.pieces) {
      if (!piece.t.startsWith(piece.h)) continue;
      const remainder = piece.t.slice(piece.h.length);
      // Remainder must equal the particle EXACTLY, not just end with it — this
      // is what rules out the いいのに false positive from the workplan: there
      // the remainder was "のに" (a different pattern's bare text), not "に".
      if (remainder !== particle) continue;
      // Reject if the target particle appears more than once in the sentence.
      const occurrences = row.jp.split(particle).length - 1;
      if (occurrences !== 1) continue;
      count++;
      console.log(`${row.id}\t${piece.h}+${particle}\t${row.jp}\t// ${row.en}`);
    }
  }
  console.log(`-- ${count} candidate(s) for ${particle} --`);
}
