// Server-side persistence — port of the history functions in
// legacy/kana_quiz.py. Reads/writes history.json at the repo root; the JSON
// shape must stay identical (the file is synced with the vault via git).

import "server-only";

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

import type { CharAggregate, HistoryFile, QuizSessionRecord } from "@/types";

const HISTORY_PATH = path.join(process.cwd(), "history.json");

/** Mirrors Python `json.dump(hist, f, ensure_ascii=False, indent=1)` —
 *  JSON.stringify never ascii-escapes, and neither writes a trailing newline. */
function writeHistory(hist: HistoryFile): void {
  writeFileSync(HISTORY_PATH, JSON.stringify(hist, null, 1), "utf-8");
}

function foldChar(
  chars: Record<string, CharAggregate>,
  c: string,
  s: Partial<CharAggregate>,
): void {
  const agg = (chars[c] ??= { seen: 0, missed: 0, slow: 0, firstTry: 0 });
  agg.seen += s.seen ?? 0;
  agg.missed += s.missed ?? 0;
  agg.slow += s.slow ?? 0;
  agg.firstTry += s.firstTry ?? 0;
}

export function loadHistory(): HistoryFile {
  if (existsSync(HISTORY_PATH)) {
    try {
      return JSON.parse(readFileSync(HISTORY_PATH, "utf-8")) as HistoryFile;
    } catch {
      // fall through — missing/corrupt file yields an empty history
    }
  }
  return { sessions: [], chars: {} };
}

/** Append a session and fold its per-character stats into the aggregate. */
export function saveSession(session: QuizSessionRecord): HistoryFile {
  const hist = loadHistory();
  hist.sessions.push(session);
  hist.sessions = hist.sessions.slice(-200);
  for (const [c, s] of Object.entries(session.chars ?? {})) {
    foldChar(hist.chars, c, s);
  }
  writeHistory(hist);
  return hist;
}

/** Remove sessions (by ts) or everything, then rebuild the per-char aggregate. */
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
  const chars: Record<string, CharAggregate> = {};
  for (const s of hist.sessions) {
    for (const [c, st] of Object.entries(s.chars ?? {})) {
      foldChar(chars, c, st);
    }
  }
  hist.chars = chars;
  writeHistory(hist);
  return hist;
}
