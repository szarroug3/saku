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

import { emptyAggregate, foldSession, foldSessions } from "@/lib/aggregate";
import type { FactId, HistoryFile, QuizSessionRecord } from "@/types";

const HISTORY_PATH = path.join(process.cwd(), "history.json");

/** Indent 1, no ascii escaping, no trailing newline — legible under `git diff`,
 * which is the only reason the formatting is specified at all. */
function writeHistory(hist: HistoryFile): void {
  writeFileSync(HISTORY_PATH, JSON.stringify(hist, null, 1), "utf-8");
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
        claims: raw?.claims ?? {},
      };
    } catch {
      // fall through — missing/corrupt file yields an empty history
    }
  }
  return { sessions: [], facts: {}, claims: {} };
}

/**
 * Record "I know these" for a set of facts, at `ts`.
 *
 * Writes `claims` and NOTHING ELSE — not a session, not a count, not a fold.
 * See src/lib/claims.ts for why all three of those would be wrong; the short
 * version is that a claim is not something you did, and `facts` is rebuilt from
 * the things you did.
 *
 * Re-claiming an already-claimed fact MOVES its timestamp forward, which is the
 * intended reading: you are saying it again, today, and the model's confidence
 * should date from when you said it. Claiming is idempotent in effect and not in
 * time, and that asymmetry is the point — the belief decays, so re-asserting it
 * has to be able to refresh it.
 */
export function saveClaims(facts: FactId[], ts: number): HistoryFile {
  const hist = loadHistory();
  hist.claims ??= {};
  for (const f of facts) hist.claims[f] = ts;
  writeHistory(hist);
  return hist;
}

/** Withdraw claims — "actually, I don't". Deletes the record rather than
 * writing a zero: a fact with no claim is the state the app starts in and the
 * one every reader already handles, and an absent key says "never claimed"
 * where `0` would have to be special-cased into meaning it. */
export function dropClaims(facts: FactId[]): HistoryFile {
  const hist = loadHistory();
  if (hist.claims) for (const f of facts) delete hist.claims[f];
  writeHistory(hist);
  return hist;
}

/**
 * Append a session and fold its per-fact stats into the aggregate.
 *
 * Folds INCREMENTALLY onto the stored aggregate rather than replaying — which
 * is only sound because a new session is the newest one there is, so replaying
 * would visit it last anyway and land in the same place. That is a real
 * precondition now that the fold carries scoring state (order matters; see
 * aggregate.ts), and it is the reason this is still an append and not a rebuild.
 *
 * `hist.sessions.slice(-200)` drops the oldest sessions past the cap, and the
 * aggregate deliberately KEEPS what they taught it: the counts stay counted and
 * the stability stays where the evidence put it. A rebuild — deleteSessions —
 * cannot know that, and will quietly compute both from the surviving 200 only.
 * That predates this change for the counts; it now also costs stability, which
 * matters more per session. Noted rather than fixed: the cap and the rebuild
 * have disagreed since the file was written, and reconciling them is its own
 * change.
 */
export function saveSession(session: QuizSessionRecord): HistoryFile {
  const hist = loadHistory();
  hist.sessions.push(session);
  hist.sessions = hist.sessions.slice(-200);
  for (const [f, s] of Object.entries(session.facts ?? {})) {
    const key = f as keyof typeof hist.facts;
    foldSession((hist.facts[key] ??= emptyAggregate()), s, session.ts);
  }
  writeHistory(hist);
  return hist;
}

/** Remove sessions (by ts) or everything, then rebuild the per-fact aggregate
 * — counts AND scoring state — from what survives. See aggregate.foldSessions:
 * the replay is time-ordered, because stability depends on the order.
 *
 * `claims` SURVIVES, and does so by construction rather than by a filter: it is
 * not derived from sessions, so a rebuild of what is has nothing to say about
 * it. Deleting your history discards what you DID. What you told the app you
 * know is a separate assertion and is still true. */
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
  hist.facts = foldSessions(hist.sessions);
  writeHistory(hist);
  return hist;
}
