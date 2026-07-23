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
//
// DURABILITY: THE FILE IS THE ONLY COPY
// =====================================
// Everything a learner has ever done lives in one JSON file that is rewritten
// in full on every save. That is a fine design for data this size and a
// dangerous one to implement carelessly, and it was implemented carelessly in
// two specific ways that compounded:
//
//   1. `writeFileSync` truncates and then streams. A crash in the middle leaves
//      a half-written file.
//   2. `loadHistory` treated an unparseable file as an EMPTY history, and every
//      mutator here is a read-modify-write on top of it. So the answer after
//      (1) was to serialize `{}` over the damage on the very next save.
//
// Together those turn one interrupted write into total, silent loss. Both are
// closed below: writes go through a temp file and a rename (see writeHistory),
// and a file that exists but is not a history THROWS (see
// HistoryUnreadableError) rather than reading as nothing. The damaged bytes are
// then never written over, because no mutator ever gets a base object to modify.

import "server-only";

import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import path from "node:path";

import {
  applyClaims,
  applyDeleteSessions,
  applyDropClaims,
  applySeen,
  applySession,
  emptyHistory,
} from "@/lib/history-ops";
import { isSupabaseStore } from "@/lib/store/mode";
import { readHistoryRow, writeHistoryRow } from "@/lib/store/supabase-store";
import type { FactId, HistoryFile, QuizSessionRecord } from "@/types";

// WHERE the local file lives. Normally the repo root (process.cwd()), unchanged
// from when this was a bare `path.join(process.cwd(), "history.json")`.
//
// SAKU_DATA_DIR is an opt-in override of the directory only, and it exists for
// one reason: the e2e suite points the file store at a throwaway directory so a
// test run never opens the maintainer's real history.json. It is unset in every
// normal run — local dev and the hosted Supabase deploy both leave it blank — so
// the default behavior here is byte-for-byte what it always was. File mode only;
// Supabase mode ignores it (there is no file to place).
const DATA_DIR = process.env.SAKU_DATA_DIR
  ? path.resolve(process.env.SAKU_DATA_DIR)
  : process.cwd();
const HISTORY_PATH = path.join(DATA_DIR, "history.json");

/**
 * The file is there and we cannot make sense of it.
 *
 * A DISTINCT OUTCOME FROM "there is no file", and the distinction is the whole
 * point of this class. loadHistory used to collapse the two: a truncated write,
 * a half-synced file, a bad merge conflict marker — all of them came back as
 * `{ sessions: [], facts: {} }`, indistinguishable from a fresh install. Every
 * mutator here is a read-modify-write on that result, so the very next answer
 * you gave serialized an empty history over your real one and the damage went
 * from recoverable to total, silently, in one step.
 *
 * So an unreadable file THROWS, and it throws on the read. Callers that mutate
 * therefore cannot write: they never get a base object to modify. The damaged
 * bytes stay exactly where they are, which is the only place they can still be
 * recovered from. `resetAll` is the one deliberate way past this, and it copies
 * the file aside before it writes (see `quarantineUnreadable`).
 */
export class HistoryUnreadableError extends Error {
  readonly path: string;
  constructor(reason: string, cause?: unknown) {
    super(`history.json is unreadable (${reason}) — refusing to overwrite it`, {
      cause,
    });
    this.name = "HistoryUnreadableError";
    this.path = HISTORY_PATH;
  }
}

/**
 * Indent 1, no ascii escaping, no trailing newline — legible under `git diff`,
 * which is the only reason the formatting is specified at all.
 *
 * ATOMIC: write a temp file, flush it to the platter, then rename over the
 * target. A bare `writeFileSync` truncates the real file first and then streams
 * into it, so a crash, a full disk, or a kill anywhere in the middle leaves a
 * half-written history.json — which is exactly the corruption the loader above
 * now has to refuse. `rename` within a directory is atomic on every platform
 * this runs on: a reader sees either the whole old file or the whole new one,
 * never a prefix of either.
 *
 * The `fsync` is not decoration. Without it the rename can reach the directory
 * before the data reaches the file, and a power loss then leaves a correctly
 * named, zero-length history.json — the one shape that looks like a fresh
 * install and is not.
 */
function writeHistoryFile(hist: HistoryFile): void {
  const body = JSON.stringify(hist, null, 1);
  const tmp = `${HISTORY_PATH}.${process.pid}.tmp`;
  try {
    const fd = openSync(tmp, "w");
    try {
      writeSync(fd, body, null, "utf-8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, HISTORY_PATH);
  } catch (e) {
    // A failed write must not leave litter that a later run mistakes for state.
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      // best effort — the throw below is the news
    }
    throw e;
  }
}

/** A plain JSON object — not null, not an array. The three things `typeof x ===
 * "object"` cannot tell apart on its own. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Read history.json.
 *
 * Returns the day-one shell when there is NO file — a fresh install genuinely
 * has no history, and that is not an error. Throws HistoryUnreadableError when
 * there IS a file and it does not parse, or parses into something that is not a
 * history. See the class for why those two cases must not be the same value.
 *
 * The shape check is deliberately shallow: the four top-level keys have to be
 * the containers they claim to be, and anything deeper is left to the readers
 * (which already tolerate partial records — that is what the `?? 0`s in
 * aggregate.ts are for). The point is to catch a file that is no longer a
 * history, not to validate every session ever written.
 */
function readHistoryFile(): HistoryFile {
  if (!existsSync(HISTORY_PATH)) {
    return { sessions: [], facts: {}, claims: {}, seen: {} };
  }
  let text: string;
  try {
    text = readFileSync(HISTORY_PATH, "utf-8");
  } catch (e) {
    throw new HistoryUnreadableError("cannot be read", e);
  }
  // A zero-length file is the classic truncated write: `writeFileSync` opens
  // with O_TRUNC, so this is precisely what a crash mid-save leaves behind. It
  // is never something the app wrote on purpose — the empty history is 33
  // bytes, not 0 — so it is damage, not a fresh install.
  if (text.trim() === "") throw new HistoryUnreadableError("is empty");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new HistoryUnreadableError("is not valid JSON", e);
  }
  if (!isPlainObject(raw)) throw new HistoryUnreadableError("is not an object");
  if (raw.sessions !== undefined && !Array.isArray(raw.sessions)) {
    throw new HistoryUnreadableError("`sessions` is not an array");
  }
  for (const key of ["facts", "claims", "seen"] as const) {
    if (raw[key] !== undefined && !isPlainObject(raw[key])) {
      throw new HistoryUnreadableError(`\`${key}\` is not an object`);
    }
  }
  const h = raw as Partial<HistoryFile>;
  return {
    sessions: h.sessions ?? [],
    facts: h.facts ?? {},
    claims: h.claims ?? {},
    seen: h.seen ?? {},
  };
}

/**
 * The current backend's history for `userId`. Supabase in hosted mode; the local
 * file otherwise, where the id is ignored — there is one history.json and one
 * implicit user. This is the read half every mutator below builds on.
 */
export async function loadHistory(userId: string): Promise<HistoryFile> {
  return isSupabaseStore() ? readHistoryRow(userId) : readHistoryFile();
}

/** The write half — the same backend split. File mode keeps the atomic temp-file
 * + fsync + rename discipline (see writeHistoryFile); Supabase upserts the row. */
async function writeHistory(userId: string, hist: HistoryFile): Promise<void> {
  if (isSupabaseStore()) await writeHistoryRow(userId, hist);
  else writeHistoryFile(hist);
}

/**
 * Copy an unreadable history.json aside, once, before something overwrites it.
 *
 * Only `resetAll` overwrites without reading first, and it is the deliberate
 * way out of a corrupt file — the user pressing "Clear knowledge base" on an app
 * that will not load. Doing that must not be the moment the evidence
 * disappears: the damaged bytes are the only copy of whatever was in there, and
 * a JSON file with a truncated tail is very often recoverable by hand.
 *
 * Returns the path it wrote, or null when there was nothing wrong to preserve.
 * Best-effort: if the copy itself fails, the reset still proceeds — being stuck
 * in a broken app forever is the worse outcome.
 */
function quarantineUnreadable(): string | null {
  if (!existsSync(HISTORY_PATH)) return null;
  try {
    readHistoryFile();
    return null;
  } catch {
    // unreadable — that is the case this function exists for
  }
  const dest = path.join(
    path.dirname(HISTORY_PATH),
    `history.corrupt-${Date.now()}.json`,
  );
  try {
    copyFileSync(HISTORY_PATH, dest);
    return dest;
  } catch {
    return null;
  }
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
export async function saveClaims(
  userId: string,
  facts: FactId[],
  ts: number,
): Promise<HistoryFile> {
  const next = applyClaims(await loadHistory(userId), facts, ts);
  await writeHistory(userId, next);
  return next;
}

/**
 * Record "quiz me" for a set of facts, at `ts` — the group is now in your
 * knowledge base and fair game to drill, on your word.
 *
 * The twin of `saveClaims`: same write discipline (its own key, no session, no
 * count, no fold), same idempotent-in-effect-not-in-time re-recording (saying
 * "quiz me" again moves the timestamp forward, and the belief dates from when
 * you said it). What differs is only what the model does with the record — see
 * claims.seenState. Kept a separate function rather than a flag on saveClaims so
 * the two writes read as the two intents they are.
 */
export async function saveSeen(
  userId: string,
  facts: FactId[],
  ts: number,
): Promise<HistoryFile> {
  const next = applySeen(await loadHistory(userId), facts, ts);
  await writeHistory(userId, next);
  return next;
}

/** Withdraw claims — "actually, I don't". Deletes the record rather than
 * writing a zero: a fact with no claim is the state the app starts in and the
 * one every reader already handles, and an absent key says "never claimed"
 * where `0` would have to be special-cased into meaning it. */
export async function dropClaims(userId: string, facts: FactId[]): Promise<HistoryFile> {
  const next = applyDropClaims(await loadHistory(userId), facts);
  await writeHistory(userId, next);
  return next;
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
export async function saveSession(
  userId: string,
  session: QuizSessionRecord,
): Promise<HistoryFile> {
  // IDEMPOTENT ON `id`, and the dedup path must NOT write. The client queues
  // records and retries them until the server acknowledges one, and a retry
  // whose original DID land (the response was lost, not the request) would
  // otherwise append the same round twice and double every count in it. The
  // fold, the 200-cap and the id-dedup all live in applySession now (see
  // history-ops.ts); when it returns the SAME object it was given, the record
  // was already stored, so writing again is pointless churn on the durable file.
  const hist = await loadHistory(userId);
  const next = applySession(hist, session);
  if (next !== hist) await writeHistory(userId, next);
  return next;
}

/** Remove sessions (by ts) or everything, then rebuild the per-fact aggregate
 * — counts AND scoring state — from what survives. See aggregate.foldSessions:
 * the replay is time-ordered, because stability depends on the order.
 *
 * `claims` and `seen` SURVIVE, and do so by construction rather than by a
 * filter: neither is derived from sessions, so a rebuild of what is has nothing
 * to say about them. Deleting your history discards what you DID. What you told
 * the app you know, and what you asked to be quizzed on, are separate assertions
 * and are still true. */
export async function deleteSessions(
  userId: string,
  ids: (number | string)[] | null,
  deleteAll: boolean,
): Promise<HistoryFile> {
  // A delete that selects NOTHING must change nothing AND must not touch the
  // file. The rebuild folds hist.facts from the SURVIVING sessions, but
  // hist.facts is grown incrementally by saveSession and legitimately carries
  // contributions from sessions the 200-cap has already evicted from
  // hist.sessions — so rebuilding on an empty request would silently shrink the
  // durable aggregate for a request that asked to delete nothing. applyDeleteSessions
  // owns the guard, the id-vs-ts keying and the rebuild (see history-ops.ts) and
  // returns the SAME object on the no-op, so `next !== hist` is exactly "did
  // anything change": bail before touching the file when it did not.
  const hist = await loadHistory(userId);
  const next = applyDeleteSessions(hist, ids, deleteAll);
  if (next !== hist) await writeHistory(userId, next);
  return next;
}

/**
 * Full reset — restart from zero. Discards EVERYTHING that makes a fact known:
 * `sessions` (what you did), `claims` ("I already know this"), `seen` ("quiz
 * me"), and `facts` (the derived aggregate). The result is the day-one shell a
 * fresh install starts with, `{ sessions: [], facts: {} }`, byte-for-byte.
 *
 * DELIBERATELY NOT deleteSessions. That one drops sessions and by design PRESERVES
 * claims and seen (see its note, and the HistoryFile field docs) — they are
 * things you SAID, not things you did, and deleting a run must not silently
 * revoke an assertion. A reset is the opposite intent: the user is asking to
 * un-know everything, so the assertions go too. Writing a fresh object (rather
 * than clearing keys on the loaded one) also drops `claims`/`seen` from the file
 * entirely, so the on-disk shape matches a never-touched install exactly.
 */
export async function resetAll(userId: string): Promise<HistoryFile> {
  // The ONE writer that does not read first, which makes it the one way out of
  // a history.json nothing else will touch — and therefore the one place the
  // damaged bytes have to be preserved before they go. See quarantineUnreadable.
  // File-only: Postgres has no half-written-row failure to quarantine against.
  if (!isSupabaseStore()) quarantineUnreadable();
  const empty = emptyHistory();
  await writeHistory(userId, empty);
  return empty;
}
