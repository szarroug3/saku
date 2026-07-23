// resetAll is the FULL wipe behind Settings' "Clear knowledge base": it must
// discard everything that makes a fact known — sessions, claims, AND seen —
// and leave the day-one shell. deleteSessions does NOT (it preserves claims and
// seen on purpose), so this locks in the difference the two functions carry.
//
// Two hoops, both because history.ts is server code and this harness is plain
// Node:
//   1. It imports "server-only", which throws unless the RSC bundler has
//      swapped it for an empty stub. We do that swap ourselves, via a resolve
//      hook pointed at the package's own empty.js — exactly what the bundler
//      does — and it must be registered BEFORE history.ts is imported, so the
//      import is dynamic and lives below the hook.
//   2. history.ts computes HISTORY_PATH from process.cwd() AT MODULE LOAD. We
//      chdir into a throwaway temp dir first, so the module — and every write
//      resetAll makes — targets a scratch history.json and never the repo's.

import assert from "node:assert/strict";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
// registerHooks is a Node 22+ runtime API (present at test time) not yet in
// this @types/node — the runtime has it, tsc's types don't.
// @ts-expect-error -- see above
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { FactId, QuizSessionRecord } from "@/types";

process.chdir(mkdtempSync(join(tmpdir(), "kq-reset-")));

const serverOnlyStub = new URL(
  "../../node_modules/server-only/empty.js",
  import.meta.url,
);
// history.ts now reaches the Supabase server client (through the store layer and
// @/lib/auth), which statically imports `next/headers` — a Next runtime module
// the plain-Node harness cannot resolve. In FILE mode that client is imported
// but never CALLED, so we hand `next/headers` a synthetic stub that just names
// the `cookies` export the graph links against. Nothing under test changes.
const NEXT_HEADERS_STUB = "kq-stub:next/headers";
registerHooks({
  resolve(
    specifier: string,
    context: unknown,
    next: (s: string, c: unknown) => unknown,
  ) {
    if (specifier === "server-only") return next(serverOnlyStub.href, context);
    if (specifier === "next/headers")
      return { url: NEXT_HEADERS_STUB, shortCircuit: true };
    return next(specifier, context);
  },
  load(
    url: string,
    context: unknown,
    next: (u: string, c: unknown) => unknown,
  ) {
    if (url === NEXT_HEADERS_STUB)
      return {
        format: "module",
        shortCircuit: true,
        source: "export const cookies = async () => ({});",
      };
    return next(url, context);
  },
});

const {
  loadHistory,
  saveClaims,
  saveSeen,
  saveSession,
  deleteSessions,
  resetAll,
  HistoryUnreadableError,
} = await import("@/lib/history");

// @/lib/auth is imported dynamically, below the resolve hook, for the same
// reason history.ts is: it reaches the Supabase server client, whose static
// `next/headers` import the hook above stubs out. A top-level static import
// would be resolved before the hook runs and fail. In FILE mode LOCAL_USER is
// the one implicit user; the file backend ignores it, so it is just a
// placeholder that satisfies the (userId-first) signatures.
const { LOCAL_USER } = await import("@/lib/auth");
const USER = LOCAL_USER;

const fid = (s: string) => s as unknown as FactId;

const HISTORY_FILE = join(process.cwd(), "history.json");

function seedSession(ts: number): QuizSessionRecord {
  return {
    ts,
    mode: "drill",
    redrill: false,
    total: 1,
    forgivingPct: 100,
    strictPct: 100,
    facts: {
      [fid("hira-a")]: { seen: 1, missed: 0, slow: 0, firstTry: 1, correct: 1 },
    } as QuizSessionRecord["facts"],
  };
}

test("resetAll wipes sessions AND claims AND seen AND facts", async () => {
  // Build a non-trivial knowledge base: a session (so `facts` is non-empty via
  // the fold), a claim, and a seen record.
  await saveSession(USER, seedSession(1_000));
  await saveClaims(USER, [fid("kata-ka"), fid("kata-ki")], 2_000);
  await saveSeen(USER, [fid("hira-sa")], 3_000);

  const before = await loadHistory(USER);
  assert.ok(before.sessions.length > 0, "seed left sessions");
  assert.ok(Object.keys(before.facts).length > 0, "seed left derived facts");
  assert.ok(Object.keys(before.claims ?? {}).length > 0, "seed left claims");
  assert.ok(Object.keys(before.seen ?? {}).length > 0, "seed left seen");

  const returned = await resetAll(USER);

  // Everything the model uses to call a fact "known" is gone — not just sessions.
  for (const hist of [returned, await loadHistory(USER)]) {
    assert.deepEqual(hist.sessions, [], "sessions cleared");
    assert.deepEqual(hist.facts, {}, "derived facts cleared");
    assert.deepEqual(hist.claims ?? {}, {}, "claims cleared");
    assert.deepEqual(hist.seen ?? {}, {}, "seen cleared");
  }
});

test("resetAll writes the day-one shell a fresh install starts with", async () => {
  await saveClaims(USER, [fid("hira-na")], 5_000);
  await saveSeen(USER, [fid("hira-ni")], 6_000);
  await resetAll(USER);

  // Byte-for-byte the empty shell (`{ sessions: [], facts: {} }`) — claims and
  // seen are dropped from the FILE, not just emptied, so on-disk shape matches a
  // never-touched install.
  const raw = readFileSync(join(process.cwd(), "history.json"), "utf-8");
  assert.equal(raw, '{\n "sessions": [],\n "facts": {}\n}');
});

// ---------- a damaged file is not an empty one ----------
//
// The failure this pins is the one that turns recoverable damage into total
// loss: loadHistory used to answer "corrupt" and "absent" with the same empty
// object, and every mutator is a read-modify-write on that answer. One truncated
// write, one more answer, and the real file was gone.

/** Every shape of "there is a file and it is not a history". */
const DAMAGED: Array<[label: string, bytes: string]> = [
  ["truncated mid-write", '{\n "sessions": [{"ts": 1, "mo'],
  ["zero length", ""],
  ["whitespace only", "\n  \n"],
  ["valid JSON, not an object", '"hello"'],
  ["valid JSON null", "null"],
  ["sessions is not an array", '{"sessions": {}, "facts": {}}'],
  ["facts is not an object", '{"sessions": [], "facts": []}'],
];

for (const [label, bytes] of DAMAGED) {
  test(`a history.json that is ${label} is refused, not read as empty`, async () => {
    await resetAll(USER);
    writeFileSync(HISTORY_FILE, bytes);
    await assert.rejects(() => loadHistory(USER), HistoryUnreadableError);
  });
}

test("no mutator overwrites a damaged history.json", async () => {
  await resetAll(USER);
  const damaged = '{\n "sessions": [{"ts": 1, "mode": "dri';
  writeFileSync(HISTORY_FILE, damaged);

  // Every read-modify-write path refuses, and refuses by throwing rather than
  // by writing something safe-looking over the top.
  await assert.rejects(
    () => saveSession(USER, seedSession(9_000)),
    HistoryUnreadableError,
  );
  await assert.rejects(
    () => saveClaims(USER, [fid("hira-a")], 9_000),
    HistoryUnreadableError,
  );
  await assert.rejects(
    () => saveSeen(USER, [fid("hira-a")], 9_000),
    HistoryUnreadableError,
  );
  await assert.rejects(
    () => deleteSessions(USER, null, true),
    HistoryUnreadableError,
  );

  // The evidence is still on disk, byte for byte.
  assert.equal(readFileSync(HISTORY_FILE, "utf-8"), damaged);
});

test("resetAll is the way out, and preserves the damaged file first", async () => {
  await resetAll(USER);
  for (const f of readdirSync(process.cwd())) {
    if (f.startsWith("history.corrupt-")) {
      // Leftovers from an earlier test in this file would make the count below
      // meaningless.
      writeFileSync(join(process.cwd(), f), "");
    }
  }
  const before = readdirSync(process.cwd()).filter((f) =>
    f.startsWith("history.corrupt-"),
  ).length;

  const damaged = '{"sessions": [{"ts": 1, "mode": "dri';
  writeFileSync(HISTORY_FILE, damaged);
  await resetAll(USER);

  // The app is usable again…
  assert.deepEqual((await loadHistory(USER)).sessions, []);
  // …and the bytes that could not be parsed were copied aside rather than
  // destroyed, because a JSON file with a truncated tail is often recoverable
  // by hand and this is the only copy of it.
  const quarantined = readdirSync(process.cwd()).filter((f) =>
    f.startsWith("history.corrupt-"),
  );
  assert.equal(quarantined.length, before + 1, "one file quarantined");
  assert.ok(
    quarantined.some(
      (f) => readFileSync(join(process.cwd(), f), "utf-8") === damaged,
    ),
    "the quarantined copy holds the damaged bytes",
  );
});

test("a healthy history.json is NOT quarantined by resetAll", async () => {
  await resetAll(USER);
  await saveSession(USER, seedSession(11_000));
  const before = readdirSync(process.cwd()).filter((f) =>
    f.startsWith("history.corrupt-"),
  ).length;
  await resetAll(USER);
  const after = readdirSync(process.cwd()).filter((f) =>
    f.startsWith("history.corrupt-"),
  ).length;
  assert.equal(after, before, "nothing to preserve, so nothing copied");
});

test("a missing history.json is a fresh install, not damage", async () => {
  await resetAll(USER);
  rmSync(HISTORY_FILE);
  assert.deepEqual(await loadHistory(USER), {
    sessions: [],
    facts: {},
    claims: {},
    seen: {},
  });
});

test("a write leaves no temp file behind", async () => {
  await resetAll(USER);
  await saveSession(USER, seedSession(12_000));
  const litter = readdirSync(process.cwd()).filter((f) =>
    f.startsWith("history.json."),
  );
  assert.deepEqual(litter, [], "the temp file was renamed, not left");
});

// ---------- posting the same record twice is not doing it twice ----------

test("saveSession is idempotent on `id`", async () => {
  await resetAll(USER);
  const record = { ...seedSession(13_000), id: "round-1" };
  await saveSession(USER, record);
  // A retry after a lost RESPONSE: same bytes, sent again.
  const hist = await saveSession(USER, record);

  assert.equal(hist.sessions.length, 1, "appended once");
  assert.equal(hist.facts[fid("hira-a")].seen, 1, "counted once");
});

test("saveSession still appends two records that have no id", async () => {
  await resetAll(USER);
  await saveSession(USER, seedSession(14_000));
  const hist = await saveSession(USER, seedSession(14_001));
  assert.equal(hist.sessions.length, 2, "no id means nothing to be sure about");
  assert.equal(hist.facts[fid("hira-a")].seen, 2);
});

// ---------- deleteSessions: a no-op must not silently shrink the aggregate ----------
//
// hist.facts is folded INCREMENTALLY by saveSession and can hold contributions
// from sessions the 200-cap has since evicted from hist.sessions. deleteSessions
// rebuilds hist.facts from the survivors — correct when you actually delete
// something, but an EMPTY delete (empty POST body → deleteSessions(null, false))
// deletes nothing yet still rebuilds, discarding every evicted contribution.

test("deleteSessions with nothing selected is a true no-op (does not rebuild-and-shrink the aggregate)", async () => {
  await resetAll(USER);
  // Fill past the 200-cap so hist.facts carries evicted contributions that a
  // rebuild-from-survivors would drop. Each session contributes seen:1.
  for (let i = 0; i < 250; i++) await saveSession(USER, seedSession(20_000 + i));

  const before = await loadHistory(USER);
  assert.equal(before.sessions.length, 200, "the cap held");
  const seenBefore = before.facts[fid("hira-a")].seen;
  assert.equal(seenBefore, 250, "the aggregate counts all 250, not just the 200 kept");

  // The empty-POST path: no ids, not deleteAll. This must change nothing.
  const after = await deleteSessions(USER, null, false);
  assert.equal(
    after.facts[fid("hira-a")].seen,
    250,
    "an empty delete must not discard evicted-session contributions",
  );
  // And on disk, too.
  assert.equal((await loadHistory(USER)).facts[fid("hira-a")].seen, 250);
});

test("deleteSessions([], false) is likewise a no-op", async () => {
  await resetAll(USER);
  for (let i = 0; i < 250; i++) await saveSession(USER, seedSession(30_000 + i));
  const after = await deleteSessions(USER, [], false);
  assert.equal(after.facts[fid("hira-a")].seen, 250);
});

// ---------- deleteSessions keys on a STABLE identity, not the wall clock ----------
//
// Two records made in the same millisecond share a `ts`. Keying deletion on `ts`
// deletes both when the user asked to drop one. The record `id` (task 15) is the
// stable identity, and deletion must use it.

test("deleting one of two same-ms sessions by id leaves the other", async () => {
  await resetAll(USER);
  const keep = { ...seedSession(40_000), id: "keep" };
  const drop = { ...seedSession(40_000), id: "drop" }; // SAME ts
  await saveSession(USER, keep);
  await saveSession(USER, drop);
  assert.equal((await loadHistory(USER)).sessions.length, 2, "both stored");

  const after = await deleteSessions(USER, ["drop"], false);
  assert.equal(after.sessions.length, 1, "only the targeted record went");
  assert.equal(after.sessions[0].id, "keep", "the other same-ms record survived");
  // The aggregate is rebuilt from the one survivor: seen counted once, not twice.
  assert.equal(after.facts[fid("hira-a")].seen, 1);
});

test("deleteSessions still deletes legacy (id-less) records by ts", async () => {
  await resetAll(USER);
  await saveSession(USER, seedSession(41_000)); // no id
  await saveSession(USER, seedSession(42_000)); // no id
  const after = await deleteSessions(USER, [41_000], false);
  assert.equal(after.sessions.length, 1);
  assert.equal(after.sessions[0].ts, 42_000);
});
