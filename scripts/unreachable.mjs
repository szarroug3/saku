#!/usr/bin/env node
// What nothing reaches: every file under src that no entry point imports,
// walking `import ... from`, `export ... from` and `import("...")` lines
// from the app's routes (all but /dev), the root layout, the proxy, the
// scripts and the e2e specs. Written for SAK-398, retiring the old app once
// its dev galleries went. Prints the list; `--delete` removes the files.
// Tables read by name (readDataJson) are kept by that name.
//
// `--runtime` walks from the app alone (routes, layout, proxy), leaving the
// scripts and the e2e specs out: what it lists is code no page loads, which
// is either build-time code (a script reaches it; keep it, out of src/app and
// src/sky) or dead (nothing does; delete it). Never deletes in that mode.
import { readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DELETE = process.argv.includes("--delete");
const EXTS = [".ts", ".tsx", ".mjs", ".js", ".json"];
const walk = (dir, out = []) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else out.push(p); } return out; };
function resolve(spec, from) {
  let base;
  if (spec.startsWith("@/")) base = path.join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const c of [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => path.join(base, "index" + e))]) { try { if (statSync(c).isFile()) return c; } catch { /* no */ } }
  return null;
}
const FROM_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g;
const DYN_RE = /import\(\s*["']([^"']+)["']\s*\)/g;
const BARE_RE = /(?:^|\n)\s*import\s*["']([^"']+)["']/g;
const NAMED_RE = /readDataJson[^(]*\(\s*["']([^"']+)["']/g;
/** Internal specifiers a file imports that resolve to nothing: a test whose
 * subject or helper was deleted shows here, and goes too. */
function unresolved(file) {
  let text; try { text = readFileSync(file, "utf8"); } catch { return []; }
  const out = [];
  for (const re of [FROM_RE, DYN_RE, BARE_RE]) for (const m of text.matchAll(re)) if ((m[1].startsWith("@/") || m[1].startsWith(".")) && !resolve(m[1], file)) out.push(m[1]);
  return out;
}
function edges(file) {
  let text; try { text = readFileSync(file, "utf8"); } catch { return []; }
  const out = [];
  for (const re of [FROM_RE, DYN_RE, BARE_RE]) for (const m of text.matchAll(re)) { const t = resolve(m[1], file); if (t) out.push(t); }
  for (const m of text.matchAll(NAMED_RE)) { const t = path.join(ROOT, "src/data/generated", m[1]); try { if (statSync(t).isFile()) out.push(t); } catch { /* no */ } }
  return out;
}
const isTest = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f);
// code only: the JSON tables are data, some read by scripts by path, and stay
const srcFiles = walk(path.join(ROOT, "src")).filter((f) => /\.(ts|tsx|mjs|js)$/.test(f));
const DEV = path.join(ROOT, "src/app/dev");
// the test loader is named on the command line, not imported
const protectedFiles = new Set(walk(path.join(ROOT, "src/lib/conjugate")).filter((f) => f.endsWith(".mjs")));
const RUNTIME_ONLY = process.argv.includes("--runtime");
const baseEntries = [
  ...srcFiles.filter((f) => f.startsWith(path.join(ROOT, "src/app")) && !f.startsWith(DEV) && !isTest(f)),
  path.join(ROOT, "src/proxy.ts"),
  ...protectedFiles,
  ...(RUNTIME_ONLY ? [] : walk(path.join(ROOT, "scripts")).filter((f) => /\.(mjs|ts|js)$/.test(f))),
  ...(RUNTIME_ONLY ? [] : walk(path.join(ROOT, "e2e"))),
].filter((f) => { try { return statSync(f).isFile(); } catch { return false; } });
const reach = (entries) => { const seen = new Set(); const stack = [...entries]; while (stack.length) { const f = stack.pop(); if (seen.has(f)) continue; seen.add(f); for (const t of edges(f)) if (!seen.has(t)) stack.push(t); } return seen; };
// Pass one: what the app itself reaches. A test whose subject (the module
// beside it with the same name) is gone goes with it; every other test is an
// entry point of its own in pass two, so a helper only tests use survives.
const first = reach(baseEntries);
// the module beside a test with the same name, whichever extension it has
const subjectOf = (t) => { const stem = t.replace(/\.(test|spec)\.[cm]?[jt]sx?$/, ""); for (const e of [".ts", ".tsx", ".mjs", ".js"]) if (statSyncSafe(stem + e)) return stem + e; return stem + ".ts"; };
const goneTests = srcFiles.filter((f) => isTest(f) && (f.startsWith(DEV) || unresolved(f).length > 0 || (statSyncSafe(subjectOf(f)) && !first.has(subjectOf(f)))));
function statSyncSafe(f) { try { return statSync(f).isFile(); } catch { return false; } }
const keptTests = srcFiles.filter((f) => isTest(f) && !goneTests.includes(f));
const reachable = reach([...baseEntries, ...keptTests]);
const gone = srcFiles.filter((f) => !reachable.has(f) && !f.startsWith(DEV) && !isTest(f));
const goneSet = new Set(gone);
// and a test goes only when its subject actually goes
const finalGoneTests = goneTests.filter((f) => f.startsWith(DEV) || goneSet.has(subjectOf(f)) || unresolved(f).length > 0 || !statSyncSafe(subjectOf(f)));
const dev = srcFiles.filter((f) => f.startsWith(DEV));
const all = [...dev, ...gone, ...finalGoneTests];
const lines = (f) => { try { return readFileSync(f, "utf8").split("\n").length; } catch { return 0; } };
const byDir = new Map();
for (const f of all) { const d = path.relative(ROOT, path.dirname(f)).split("/").slice(0, 3).join("/"); const v = byDir.get(d) || { files: 0, lines: 0 }; v.files++; v.lines += lines(f); byDir.set(d, v); }
console.log(`${all.length} files (${dev.length} under /dev, ${gone.length} unreachable, ${finalGoneTests.length} their tests), ${all.reduce((n, f) => n + lines(f), 0)} lines`);
for (const [d, v] of [...byDir].sort((a, b) => b[1].lines - a[1].lines)) console.log(`${String(v.lines).padStart(7)} lines ${String(v.files).padStart(4)} files  ${d}`);
if (process.argv.includes("--list")) for (const f of all.sort()) console.log("  " + path.relative(ROOT, f));
if (DELETE && !RUNTIME_ONLY) { for (const f of all) unlinkSync(f); console.log("deleted"); }
