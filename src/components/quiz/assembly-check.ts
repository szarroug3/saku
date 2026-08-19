// The assembly screen's per-card grading state machine, pulled out of
// assembly-screen.tsx (a "use client" component with JSX, which the test
// runner's native TS loader cannot parse) so SAK-19's retry/reveal timing can
// be pinned with a plain node:test — see assembly-check.test.ts.

import { newFactStat } from "@/lib/engine";
import {
  assemblyFacts,
  canonicalOrder,
  gradeAssembly,
  type AssemblyItem,
} from "@/data/assembly";
import type { SessionStats } from "@/types";

export interface AsmCard {
  item: AssemblyItem;
  /** Surfaces still in the pool (unplaced). */
  pool: string[];
  /** Surfaces placed in the tray, in the learner's current order. */
  tray: string[];
  state: "open" | "right" | "wrong";
  tries: number;
}

export interface AsmRuntime {
  cards: AsmCard[];
  pos: number;
  streak: number;
  stats: SessionStats;
  source: "lesson-examples" | "practice-corpus";
}

/** A freshly-dealt, unanswered card for `item`, with stats seeded so
 * checkCard has somewhere to write. Test helper — buildRuntime in
 * assembly-screen.tsx does the equivalent inline for the real deck. */
export function newAsmCard(item: AssemblyItem, tray: string[] = []): AsmCard {
  return {
    item,
    pool: canonicalOrder(item).filter((s) => !tray.includes(s)),
    tray,
    state: "open",
    tries: 0,
  };
}

export function newAsmRuntime(item: AssemblyItem): AsmRuntime {
  const stats: SessionStats = {};
  for (const fact of assemblyFacts(item)) stats[fact] = newFactStat();
  return { cards: [], pos: 0, streak: 0, stats, source: "practice-corpus" };
}

/** Grade the current tray. Returns "right", "retry" (wrong, still open), or
 * "locked" (wrong, out of retries — the canonical order is revealed).
 *
 * SAK-19: `retries` is the number of WRONG Check presses the config tolerates
 * (the pips shown in the UI — `retriesLeft = allowed - card.tries`). Locking
 * on `card.tries > retries` let one extra, pip-less wrong press through: with
 * Retries: 2, the 2nd wrong press already drove the pips to zero (nothing
 * left to spend), but `2 > 2` is false, so the card stayed open for a 3rd
 * press that had no pip to consume and no feedback of its own — the reveal
 * only landed on THAT one. `>=` locks on the same press that empties the
 * pips, so the number of wrong presses before reveal always equals the
 * configured retry count, and every one of them (including the last) is a
 * real Check with visible feedback — a shake mid-round, or the reveal itself
 * when it's the last. */
export function checkCard(
  rt: AsmRuntime,
  card: AsmCard,
  retries: number,
): "right" | "retry" | "locked" {
  const ok = gradeAssembly(card.item, card.tray);
  const facts = assemblyFacts(card.item);
  for (const f of facts) {
    const st = rt.stats[f];
    if (st.firstTryCorrect === null) {
      st.firstTryCorrect = ok;
      if (ok) st.firstTryCount = (st.firstTryCount ?? 0) + 1;
    }
  }
  if (ok) {
    if (card.tries === 0) rt.streak++;
    for (const f of facts) {
      rt.stats[f].everCorrect = true;
      rt.stats[f].correct++;
    }
    card.state = "right";
    return "right";
  }
  rt.streak = 0;
  card.tries++;
  for (const f of facts) rt.stats[f].misses++;
  if (card.tries >= retries) {
    // The learner's own (wrong) tray order is kept exactly as they left it —
    // it must never silently snap to canon here. The correct answer is shown
    // separately, in the reveal panel below the tray (assembly-screen.tsx),
    // which reads it straight from item.jp rather than from card.tray. A
    // wrong-position mismatch computed against the learner's placement (see
    // findAssemblyMismatch in assembly-screen.tsx's check()) stays meaningful
    // after locking only because the tray it was computed against is still
    // the tray on screen (Sam, changes requested).
    card.pool = [];
    card.state = "wrong";
    return "locked";
  }
  return "retry";
}
