// Server-side persistence — port of the history functions in
// legacy/kana_quiz.py. Reads/writes history.json at the repo root; the JSON
// shape must stay identical (the file is synced with the vault via git).

import "server-only";

import type { HistoryFile, QuizSessionRecord } from "@/types";

// TODO(agent:server): implement against history.json at process.cwd() root.
// Same semantics as the Python: tolerate missing/corrupt file, cap 200
// sessions, fold per-char aggregates on save, rebuild them on delete.
// Write with JSON.stringify(hist, null, 1) to match the Python indent=1.

const TODO = () => new Error("TODO(agent:server): not implemented yet");

export function loadHistory(): HistoryFile {
  throw TODO();
}

export function saveSession(session: QuizSessionRecord): HistoryFile {
  throw TODO();
}

export function deleteSessions(
  ids: number[] | null,
  deleteAll: boolean,
): HistoryFile {
  throw TODO();
}
