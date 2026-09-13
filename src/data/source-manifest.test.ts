// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/source-manifest.test.ts
//
// THE OTHER HALF OF source-pins.test.ts (SAK-434).
//
// source-pins.test.ts proves the app teaches what the committed reduction under
// src/data/generated says. It cannot go further, and its own header says so: the
// upstream archives are not in this repo, so an ingest re-run against a
// different JMdict, a newer KANJIDIC2 or a KanjiVG release nobody chose would
// rewrite the reduction and every pin would keep passing. The pins reach the
// file. Nothing reached past it.
//
// src/data/generated/sources.json is what reaches past it. It records, per
// upstream archive, the URL, the version the archive declares, and the SHA-256
// of the file as downloaded; and, per ingest pass, which archives that pass read
// and which files it wrote. scripts/ingest/sources.mjs and sources.py check the
// bytes before an ingest reads them and stop when they differ.
//
// WHAT THIS FILE ADDS THAT THE INGEST CANNOT
// ==========================================
// The ingest only checks the archive in front of it, in the moment it runs. This
// checks the manifest as a whole, on every test run, and catches the failure the
// ingest structurally cannot see: ONE PASS MOVING AND THE OTHERS NOT. Accept a
// newer KANJIDIC2 while running readingtype.py and readings.json is re-cut,
// while kanji.json and radicals.json still carry the old KANJIDIC2's hash. The
// archives section says one thing, those passes say another, and the reduction
// is now a mixture of two dictionaries with nothing to say so. That is a failure
// here.
//
// It also refuses to let the record go quiet. Every file under
// src/data/generated must be named by a pass or by `unpinned`, and an `unpinned`
// entry has to say WHY the pin does not reach it. A new generated file with no
// provenance fails this test rather than slipping in unremarked.
//
// A FAILURE HERE IS A PROVENANCE BUG, NOT A TEST BUG. Either re-run the pass
// the message names, or record in `unpinned` why it cannot be re-run.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import manifest from "./generated/sources.json" with { type: "json" };
import wordDefinitions from "./generated/word-definitions.json" with { type: "json" };
import cejcReadings from "./generated/cejc-reading-frequency.json" with { type: "json" };

/** The repo root, from this file's own location rather than the cwd: the test
 * has to hold wherever it is run from. */
const REPO = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const GENERATED = join(REPO, "src", "data", "generated");

type Archive = {
  name: string;
  url: string;
  version: string;
  versionFrom: string;
  sha256: string;
  bytes: number | null;
  recordedAt: string;
  license: string;
  path: string;
  committed?: boolean;
  note?: string;
};

type Pass = {
  outputs: string[];
  archives: Record<string, string>;
  recordedAt: string;
  note?: string;
};

type Unpinned = { script: string; archives: string[]; why: string };

const ARCHIVES = manifest.archives as unknown as Record<string, Archive>;
const PASSES = manifest.builtFrom as unknown as Record<string, Pass>;
const UNPINNED = manifest.unpinned as unknown as Record<string, Unpinned>;

const SHA256 = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Every file under src/data/generated, as a path relative to it. The manifest
 * itself and the license notice are the two things with nothing to record. */
function generatedFiles(dir = GENERATED): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...generatedFiles(path));
      continue;
    }
    const rel = relative(GENERATED, path);
    if (rel === "LICENSE" || rel === "sources.json") continue;
    out.push(rel);
  }
  return out;
}

describe("every pinned archive is fully recorded", () => {
  test("each entry carries a URL, a version, a hash and a license", () => {
    assert.ok(Object.keys(ARCHIVES).length > 0, "the manifest records no archives");
    for (const [id, a] of Object.entries(ARCHIVES)) {
      assert.match(id, /^[a-z0-9-]+$/, `archive id "${id}" is not a plain slug`);
      assert.ok(a.name, `${id} has no name`);
      assert.match(a.url, /^https?:\/\//, `${id} has no upstream URL`);
      assert.ok(a.version, `${id} records no version`);
      assert.ok(
        a.versionFrom,
        `${id} records a version but not where that string was read from. An ` +
          `archive that declares no version of its own has to say what stands ` +
          `in for one.`,
      );
      assert.match(a.sha256, SHA256, `${id} has no SHA-256 of the archive`);
      assert.match(a.recordedAt, ISO_DATE, `${id} has no record date`);
      assert.ok(a.license, `${id} records no license`);
      assert.ok(a.path, `${id} records no path to read it from`);
    }
  });

  test("a size is recorded unless a note says why it cannot be", () => {
    for (const [id, a] of Object.entries(ARCHIVES)) {
      if (a.bytes === null) {
        assert.ok(
          a.note,
          `${id} records no size and no note. A null size means the archive ` +
            `is not on hand any more, and that needs saying in the entry.`,
        );
        continue;
      }
      assert.ok(
        Number.isInteger(a.bytes) && a.bytes > 0,
        `${id} records a size of ${a.bytes}`,
      );
    }
  });

  // The downloaded archives are ignored by version control and are not on disk
  // in a clean checkout, so this is the one place the manifest's hashes can be
  // checked against real bytes on every run. The committed snapshots are in the
  // repo, so a hand-edit to one of them fails right here.
  test("the committed snapshots still hash to what the manifest says", () => {
    const committed = Object.entries(ARCHIVES).filter(([, a]) => a.committed);
    assert.ok(committed.length > 0, "no committed snapshot is pinned");
    for (const [id, a] of committed) {
      const file = join(REPO, a.path);
      assert.ok(existsSync(file), `${id} is committed at ${a.path} but is missing`);
      const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
      assert.equal(
        digest,
        a.sha256,
        `${a.path} no longer hashes to what sources.json records for ${id}. ` +
          `Either the file was edited by hand, in which case re-run the ingest ` +
          `that reads it, or the manifest entry is wrong.`,
      );
    }
  });

  test("every pinned archive is read by something", () => {
    const referenced = new Set<string>();
    for (const pass of Object.values(PASSES)) {
      for (const id of Object.keys(pass.archives)) referenced.add(id);
    }
    for (const entry of Object.values(UNPINNED)) {
      for (const id of entry.archives) referenced.add(id);
    }
    for (const id of Object.keys(ARCHIVES)) {
      assert.ok(
        referenced.has(id),
        `nothing reads ${id}. A pin no ingest uses is a claim about nothing; ` +
          `either wire it up or drop the entry.`,
      );
    }
  });
});

describe("no generated file claims an archive it was not built from", () => {
  test("every pass names archives the manifest knows", () => {
    assert.ok(Object.keys(PASSES).length > 0, "the manifest records no ingest passes");
    for (const [script, pass] of Object.entries(PASSES)) {
      assert.ok(
        existsSync(join(REPO, script)),
        `${script} is recorded as an ingest pass but is not in the repo`,
      );
      assert.ok(pass.outputs.length > 0, `${script} records no outputs`);
      assert.match(pass.recordedAt, ISO_DATE, `${script} has no record date`);
      for (const id of Object.keys(pass.archives)) {
        assert.ok(ARCHIVES[id], `${script} claims unknown archive "${id}"`);
      }
    }
  });

  // The whole point of the file. See the header.
  test("every hash a pass recorded is still the hash that archive is pinned to", () => {
    for (const [script, pass] of Object.entries(PASSES)) {
      for (const [id, sha] of Object.entries(pass.archives)) {
        assert.equal(
          sha,
          ARCHIVES[id].sha256,
          `${script} wrote ${pass.outputs.join(", ")} from ${id} ` +
            `${sha.slice(0, 12)}, but ${id} is now pinned to ` +
            `${ARCHIVES[id].sha256.slice(0, 12)}. Something accepted a new ` +
            `archive without re-running this pass, so the reduction and the pin ` +
            `no longer describe the same bytes. Re-run ${script}.`,
        );
      }
    }
  });

  test("every file a pass claims to have written is there", () => {
    for (const [script, pass] of Object.entries(PASSES)) {
      for (const output of pass.outputs) {
        assert.ok(
          existsSync(join(GENERATED, output)),
          `${script} records writing ${output}, which does not exist`,
        );
      }
    }
  });
});

describe("the files the pin does not reach are named, with a reason", () => {
  test("every unpinned entry says which script and why", () => {
    for (const [file, entry] of Object.entries(UNPINNED)) {
      assert.ok(
        existsSync(join(GENERATED, file)),
        `sources.json lists ${file} as unpinned, but there is no such file`,
      );
      assert.ok(
        existsSync(join(REPO, entry.script)),
        `${file} names ${entry.script} as its writer, which is not in the repo`,
      );
      for (const id of entry.archives) {
        assert.ok(ARCHIVES[id], `${file} names unknown archive "${id}"`);
      }
      assert.ok(
        entry.why.length > 40,
        `${file} is unpinned with no real reason given. "Why not" is the whole ` +
          `value of the entry; a placeholder is worse than nothing.`,
      );
    }
  });

  test("every generated file is either pinned or explained", () => {
    const accounted = new Set<string>(Object.keys(UNPINNED));
    for (const pass of Object.values(PASSES)) {
      for (const output of pass.outputs) accounted.add(output);
    }
    const orphans = generatedFiles().filter((f) => !accounted.has(f));
    assert.deepEqual(
      orphans,
      [],
      `these files under src/data/generated have no provenance in ` +
        `sources.json. Record the pass that writes them, or add an unpinned ` +
        `entry saying what they are derived from: ${orphans.join(", ")}`,
    );
  });
});

// Two generated files carry their own source block, written by the ingest that
// cut them. They predate the manifest and are the only self-describing outputs
// in the tree, which makes them the one place the reduction and the manifest can
// be checked against each other from two independent records rather than one.
describe("the generated files that record their own source agree with the manifest", () => {
  test("word-definitions.json names the JMdict the manifest pins", () => {
    assert.equal(
      wordDefinitions.source.rawSha256,
      ARCHIVES.jmdict.sha256,
      "word-definitions.json records a different JMdict than sources.json pins",
    );
  });

  test("cejc-reading-frequency.json names the CEJC archive the manifest pins", () => {
    assert.equal(
      cejcReadings.source.rawSha256,
      ARCHIVES.cejc.sha256,
      "cejc-reading-frequency.json records a different CEJC archive than sources.json pins",
    );
  });
});
