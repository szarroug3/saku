// Server-side persistence — reads/writes history.json at the repo root.
//
// This file used to say the JSON shape "must stay identical (the file is synced
// with the vault via git)". Only half of that was ever true, and the half that
// wasn't was blocking the entry/fact rekey. Git IS the sync — that part stands,
// and it is why this stays a plain file at the repo root rather than growing a
// database. But the SHAPE was never owed compatibility to anything: the data in
// it is disposable test data, so the rekey from `chars` to `facts` simply
// changes it. There is no migration and none is owed. An old history.json is
// read as an empty history (`facts` is absent → `{}`), which is correct: those
// keys were characters, and a character is not a fact.

import "server-only";

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

import type { FactAggregate, FactId, HistoryFile, QuizSessionRecord } from "@/types";

const HISTORY_PATH = path.join(process.cwd(), "history.json");

/** Indent 1, no ascii escaping, no trailing newline — legible under `git diff`,
 * which is the only reason the formatting is specified at all. */
function writeHistory(hist: HistoryFile): void {
  writeFileSync(HISTORY_PATH, JSON.stringify(hist, null, 1), "utf-8");
}

function foldFact(
  facts: Record<FactId, FactAggregate>,
  f: FactId,
  s: Partial<FactAggregate>,
): void {
  const agg = (facts[f] ??= {
    seen: 0,
    missed: 0,
    slow: 0,
    firstTry: 0,
    correct: 0,
  });
  agg.seen += s.seen ?? 0;
  agg.missed += s.missed ?? 0;
  agg.slow += s.slow ?? 0;
  agg.firstTry += s.firstTry ?? 0;
  agg.correct += s.correct ?? 0;
}

export function loadHistory(): HistoryFile {
  if (existsSync(HISTORY_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(HISTORY_PATH, "utf-8")) as
        | Partial<HistoryFile>
        | null;
      return {
        sessions: raw?.sessions ?? [],
        facts: raw?.facts ?? {},
      };
    } catch {
      // fall through — missing/corrupt file yields an empty history
    }
  }
  return { sessions: [], facts: {} };
}

/** Append a session and fold its per-fact stats into the aggregate. */
export function saveSession(session: QuizSessionRecord): HistoryFile {
  const hist = loadHistory();
  hist.sessions.push(session);
  hist.sessions = hist.sessions.slice(-200);
  for (const [f, s] of Object.entries(session.facts ?? {})) {
    foldFact(hist.facts, f as FactId, s);
  }
  writeHistory(hist);
  return hist;
}

/** Remove sessions (by ts) or everything, then rebuild the per-fact aggregate. */
export function deleteSessions(
  ids: number[] | null,
  deleteAll: boolean,
): HistoryFile {
  const hist = loadHistory();
  if (deleteAll) {
    hist.sessions = [];
  } else {
    const drop = new Set(ids ?? []);
    hist.sessions = hist.sessions.filter((s) => !drop.has(s.ts));
  }
  const facts: Record<FactId, FactAggregate> = {};
  for (const s of hist.sessions) {
    for (const [f, st] of Object.entries(s.facts ?? {})) {
      foldFact(facts, f as FactId, st);
    }
  }
  hist.facts = facts;
  writeHistory(hist);
  return hist;
}
