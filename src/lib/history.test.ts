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
import { mkdtempSync, readFileSync } from "node:fs";
// registerHooks is a Node 22+ runtime API (present at test time) not yet in
// this @types/node — the runtime has it, tsc's types don't.
// @ts-expect-error -- see above
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import type { FactId, QuizSessionRecord } from "@/types";

process.chdir(mkdtempSync(join(tmpdir(), "kq-reset-")));

const serverOnlyStub = new URL(
  "../../node_modules/server-only/empty.js",
  import.meta.url,
);
registerHooks({
  resolve(
    specifier: string,
    context: unknown,
    next: (s: string, c: unknown) => unknown,
  ) {
    if (specifier === "server-only") return next(serverOnlyStub.href, context);
    return next(specifier, context);
  },
});

const { loadHistory, saveClaims, saveSeen, saveSession, resetAll } =
  await import("@/lib/history");

const fid = (s: string) => s as unknown as FactId;

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

test("resetAll wipes sessions AND claims AND seen AND facts", () => {
  // Build a non-trivial knowledge base: a session (so `facts` is non-empty via
  // the fold), a claim, and a seen record.
  saveSession(seedSession(1_000));
  saveClaims([fid("kata-ka"), fid("kata-ki")], 2_000);
  saveSeen([fid("hira-sa")], 3_000);

  const before = loadHistory();
  assert.ok(before.sessions.length > 0, "seed left sessions");
  assert.ok(Object.keys(before.facts).length > 0, "seed left derived facts");
  assert.ok(Object.keys(before.claims ?? {}).length > 0, "seed left claims");
  assert.ok(Object.keys(before.seen ?? {}).length > 0, "seed left seen");

  const returned = resetAll();

  // Everything the model uses to call a fact "known" is gone — not just sessions.
  for (const hist of [returned, loadHistory()]) {
    assert.deepEqual(hist.sessions, [], "sessions cleared");
    assert.deepEqual(hist.facts, {}, "derived facts cleared");
    assert.deepEqual(hist.claims ?? {}, {}, "claims cleared");
    assert.deepEqual(hist.seen ?? {}, {}, "seen cleared");
  }
});

test("resetAll writes the day-one shell a fresh install starts with", () => {
  saveClaims([fid("hira-na")], 5_000);
  saveSeen([fid("hira-ni")], 6_000);
  resetAll();

  // Byte-for-byte the empty shell (`{ sessions: [], facts: {} }`) — claims and
  // seen are dropped from the FILE, not just emptied, so on-disk shape matches a
  // never-touched install.
  const raw = readFileSync(join(process.cwd(), "history.json"), "utf-8");
  assert.equal(raw, '{\n "sessions": [],\n "facts": {}\n}');
});
