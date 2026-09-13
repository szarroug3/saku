// The source manifest: what upstream archive each ingest read, and the exact
// bytes it read (SAK-434).
//
// WHY THIS EXISTS
// ===============
// src/data/source-pins.test.ts pins every taught fact to the committed
// reduction under src/data/generated. It cannot reach further than that,
// because the upstream archives are not in the repo, so a re-run of an ingest
// against a different JMdict, a different KANJIDIC2 or a newer Tatoeba export
// would rewrite the reduction and every pin would still pass. The pins stop at
// the file; the file's own provenance was unrecorded.
//
// This module is the missing half. src/data/generated/sources.json records, for
// each upstream archive, the URL it came from, the version or date the archive
// itself declares, and the SHA-256 of the file as downloaded. Every ingest
// checks the archive it is about to read against that record and stops when it
// differs. An intentional upgrade is one flag; a silent change is a stop.
//
// THE TWO SECTIONS, AND WHY THEY ARE SEPARATE
// ===========================================
// `archives` is what the upstreams are pinned to NOW. `builtFrom` is one entry
// per INGEST PASS, keyed by the script: which archives that pass read and which
// files under src/data/generated it wrote, stamped at the moment it wrote them.
//
// A pass, not a file, because several passes write one file. build.py cuts
// kanji.json from KANJIDIC2 + KRADFILE + JMdict and kanji-raw-readings.py then
// back-fills on/kun onto it from KANJIDIC2 alone. Keyed by file, the second
// pass would overwrite the first pass's record and the file would claim an
// input history it does not have; keyed by pass, each records only what it read
// and what it touched.
//
// Nothing writes both sections at once: --accept-source rewrites an `archives`
// entry, and only a real write of outputs rewrites that pass's `builtFrom`
// entry. So accepting a newer KANJIDIC2 while running one script leaves every
// OTHER pass that read KANJIDIC2 carrying the old hash, and
// src/data/source-manifest.test.ts fails until those passes are re-run. That is
// the drift this is for: a reduction cannot go on claiming an archive it was
// not built from.
//
// The Python half of the ingest uses scripts/ingest/sources.py, which reads and
// writes the same file in the same format. Keep the two in step.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, inflateRawSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, "..", "..");
export const MANIFEST = join(REPO, "src", "data", "generated", "sources.json");

/** Today, as the date-only string the manifest stores. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Key order is not meaningful in JSON, so the file is written with every
 * object's keys sorted. Python's json.dumps(sort_keys=True) does the same, which
 * is what lets both halves of the ingest write this file without churning it. */
function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortDeep(value[key]);
    return out;
  }
  return value;
}

export function readManifest() {
  return JSON.parse(readFileSync(MANIFEST, "utf8"));
}

export function writeManifest(manifest) {
  writeFileSync(MANIFEST, JSON.stringify(sortDeep(manifest), null, 2) + "\n");
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Where an archive lives when it was downloaded to the ignored raw directory.
 * Absolute, so a script can hand it straight to its reader. */
export function archivePath(id, manifest = readManifest()) {
  const entry = manifest.archives[id];
  if (!entry) throw new Error(`no archive "${id}" in ${relative(REPO, MANIFEST)}`);
  return join(REPO, entry.path);
}

/**
 * Put an archive on disk at its manifest path if it is not there already, and
 * return that path.
 *
 * The ingest reads FROM A FILE rather than straight from the network, because a
 * response body that is never written down cannot be hashed the same way twice,
 * and the hash is the whole point. The raw directory is ignored by git, so
 * nothing here is committed.
 */
export async function ensureArchive(id) {
  const manifest = readManifest();
  const entry = manifest.archives[id];
  if (!entry) throw new Error(`no archive "${id}" in ${relative(REPO, MANIFEST)}`);
  const file = join(REPO, entry.path);
  if (existsSync(file)) return file;
  if (entry.committed) {
    throw new Error(`${entry.name} is committed at ${entry.path} but is missing`);
  }
  mkdirSync(dirname(file), { recursive: true });
  console.log(`downloading ${entry.name} from ${entry.url}`);
  const res = await fetch(entry.url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

/** An archive's text, gunzipped when the pinned file is a .gz. The hash is
 * always of the file as downloaded, so the decompression happens here rather
 * than leaving a second, unpinned copy on disk. */
export function readArchiveText(id, manifest = readManifest()) {
  const file = archivePath(id, manifest);
  const bytes = readFileSync(file);
  return (file.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString("utf8");
}

/**
 * Read a pinned .zip archive without unpacking it to disk.
 *
 * Dependency-free on purpose: the ingest scripts run under plain `node` with
 * nothing installed, and scripts/ingest/cejc_reading_frequency.py already reads
 * its nested XLSX the same way on the Python side. Only the one shape these
 * archives use is handled: no zip64 (the largest here is 22MB over 11,661
 * entries, both far under the 4GB / 65,535 limits) and store or deflate.
 *
 * Returns { has(name), read(name) }, where read gives a Buffer.
 */
export function openArchiveZip(id, manifest = readManifest()) {
  const buf = readFileSync(archivePath(id, manifest));
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`${id}: no zip end-of-central-directory record`);
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error(`${id}: bad zip directory entry`);
    const method = buf.readUInt16LE(at + 10);
    const compressedSize = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const localAt = buf.readUInt32LE(at + 42);
    const name = buf.toString("utf8", at + 46, at + 46 + nameLen);
    entries.set(name, { method, compressedSize, localAt });
    at += 46 + nameLen + extraLen + commentLen;
  }
  const read = (name) => {
    const entry = entries.get(name);
    if (!entry) throw new Error(`${id}: no member "${name}"`);
    const start =
      entry.localAt + 30 + buf.readUInt16LE(entry.localAt + 26) + buf.readUInt16LE(entry.localAt + 28);
    const raw = buf.subarray(start, start + entry.compressedSize);
    if (entry.method === 0) return Buffer.from(raw);
    if (entry.method === 8) return inflateRawSync(raw);
    throw new Error(`${id}: member "${name}" uses compression method ${entry.method}`);
  };
  return { has: (name) => entries.has(name), read };
}

/** True when the argv carries the flag that lets an ingest record a new
 * archive. One flag for an intentional upgrade; without it a changed archive
 * stops the run. */
export function acceptSource(argv = process.argv) {
  return argv.includes("--accept-source");
}

/**
 * Check the bytes an ingest is about to read against the manifest.
 *
 * Returns the archive's SHA-256 on success, so the caller can hand it to
 * recordBuild. With `accept`, the manifest entry is rewritten to this file
 * instead and the new digest is returned.
 *
 * `version` lets a caller pass the version string it read out of the archive
 * itself (KANJIDIC2's database_version, JMdict's creation date). It is only
 * used when accepting; a plain check never rewrites anything.
 */
export function verifySource(id, { path, accept = false, version = null } = {}) {
  const manifest = readManifest();
  const entry = manifest.archives[id];
  if (!entry) {
    throw new Error(
      `No archive "${id}" is recorded in ${relative(REPO, MANIFEST)}. ` +
        `Add it there before an ingest can read it.`,
    );
  }
  const file = path ? resolve(path) : join(REPO, entry.path);
  if (!existsSync(file)) {
    throw new Error(
      `${entry.name} is not on disk at ${relative(REPO, file)}.\n` +
        `Download it from ${entry.url} to that path. The raw directory is ` +
        `ignored by git on purpose; the archives are not committed.`,
    );
  }
  const digest = sha256File(file);
  if (digest === entry.sha256) return digest;
  if (!accept) {
    throw new Error(
      `${entry.name} is not the archive src/data/generated was built from.\n` +
        `  recorded  ${entry.sha256}\n` +
        `            version ${entry.version}, recorded ${entry.recordedAt}\n` +
        `  on disk   ${digest}\n` +
        `            ${relative(REPO, file)}\n` +
        `Stopping rather than rebuilding the reduction from an archive nobody\n` +
        `chose. If this newer archive is the one you want, rerun with\n` +
        `--accept-source: that records it here and builds from it. Every other\n` +
        `pass that reads ${id} then has to be re-run too, and\n` +
        `src/data/source-manifest.test.ts fails until it is.`,
    );
  }
  manifest.archives[id] = {
    ...entry,
    sha256: digest,
    bytes: statSync(file).size,
    version: version ?? entry.version,
    recordedAt: today(),
  };
  writeManifest(manifest);
  console.log(`recorded ${entry.name}: ${digest} (${version ?? entry.version})`);
  return digest;
}

/**
 * Record one ingest pass: which archives it read, which files it wrote.
 *
 * `script` is the pass's path from the repo root and is the entry's key.
 * `outputs` are paths under src/data/generated. `ids` are archive ids. The
 * hashes stored are the manifest's current ones, so this is only ever called
 * after verifySource has agreed the bytes on disk are those.
 */
export function recordBuild(script, outputs, ids) {
  const manifest = readManifest();
  const archives = {};
  for (const id of ids) {
    const entry = manifest.archives[id];
    if (!entry) throw new Error(`no archive "${id}" to record`);
    archives[id] = entry.sha256;
  }
  manifest.builtFrom ??= {};
  manifest.builtFrom[script] = {
    outputs: [...outputs].sort(),
    archives,
    recordedAt: today(),
  };
  writeManifest(manifest);
}
