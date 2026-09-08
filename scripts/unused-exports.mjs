#!/usr/bin/env node
// What nothing imports: every exported name under the roots given that no
// other file ever imports (SAK-419).
//
// `scripts/unreachable.mjs` walks whole files, so a module the app loads is
// reachable and everything it exports rides along with it, however private
// that name really is. Three such names were found by hand on 2026-09-08:
// `runProgress` and `QUIZ_RUN_KEY`, exported and then read only by the module
// that declares them, and `NO_RUN`, standing in for `null` in one line of its
// own test. This asks the same question one level down: not "does anything
// load this file" but "does anything outside it want this name".
//
//   node scripts/unused-exports.mjs                     the Sky and its routes
//   node scripts/unused-exports.mjs src/lib             somewhere else
//
// TWO LISTS, and only the first is a failure.
//
// The first is a name nothing outside its own file imports at all. There is
// nothing to weigh: either the module itself reads it, and the `export` comes
// off, or nothing does, and the name goes. It exits non-zero on any of these,
// so it can sit in a check.
//
// The second is a name whose only importer is the test beside it. That is
// worth knowing and is not automatically wrong: a lib module's unit test is a
// real reader, and the exports it names are the surface it exists to check.
// `NO_RUN` was in this list and deserved deleting, because it stood in for a
// literal `null` and the test read better without it. Most of the rest are
// the module's own tested surface. Read the list; do not clear it by reflex.
//
// What it does NOT report, because the reader is not an import:
//   - a Next.js route file's contract (`default`, `metadata`, `dynamic` and
//     the rest of the framework's names), which the framework reads by
//     convention rather than by importing;
//   - anything in a module some other file imports with `import * as`, since
//     a star says nothing about which names it wanted.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EXTS = [".ts", ".tsx", ".mjs", ".js", ".json"];
const DEFAULT_ROOTS = ["src/sky", "src/app/(sky)"];

const walk = (dir, out = []) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else out.push(p); } return out; };
const statSyncSafe = (f) => { try { return statSync(f).isFile(); } catch { return false; } };
const isCode = (f) => /\.(ts|tsx|mjs|js)$/.test(f);
const isTest = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f);

function resolve(spec, from) {
  let base;
  if (spec.startsWith("@/")) base = path.join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const c of [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => path.join(base, "index" + e))]) if (statSyncSafe(c)) return c;
  return null;
}

// One statement at a time. A clause may not carry a quote or a semicolon, so
// a bare `import "./a"` cannot swallow the statement after it and hand its
// names to the wrong module.
const IMPORT_RE = /(?:^|\n)\s*import\s+([^;"']*?)\s+from\s*["']([^"']+)["']/g;
const REEXPORT_RE = /(?:^|\n)\s*export\s+([^;"']*?)\s+from\s*["']([^"']+)["']/g;
const BARE_RE = /(?:^|\n)\s*import\s*["']([^"']+)["']/g;
const DYN_RE = /import\(\s*["']([^"']+)["']\s*\)/g;

/** The names one import clause asks for, or "*" when it asks for the module
 * whole (`import * as ns`, `export * from`, a bare or dynamic import). */
function namesOf(clause) {
  if (clause.includes("*")) return ["*"];
  const out = [];
  const braced = clause.match(/\{([\s\S]*)\}/);
  if (braced) {
    for (const part of braced[1].split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (name) out.push(name);
    }
  }
  const head = (braced ? clause.slice(0, clause.indexOf("{")) : clause).replace(/^type\s+/, "").replace(/,\s*$/, "").trim();
  if (head) out.push("default");
  return out;
}

/** Every name a file asks of every module it names, as module to names. */
function imports(file) {
  let text; try { text = readFileSync(file, "utf8"); } catch { return new Map(); }
  const out = new Map();
  const add = (spec, names) => { const t = resolve(spec, file); if (!t) return; const have = out.get(t) ?? new Set(); for (const n of names) have.add(n); out.set(t, have); };
  for (const re of [IMPORT_RE, REEXPORT_RE]) for (const m of text.matchAll(re)) add(m[2], namesOf(m[1]));
  for (const re of [BARE_RE, DYN_RE]) for (const m of text.matchAll(re)) add(m[1], ["*"]);
  return out;
}

const DECL_RE = /(?:^|\n)export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|interface|enum|abstract\s+class)\s+([A-Za-z_$][\w$]*)/g;
const TYPE_RE = /(?:^|\n)export\s+type\s+([A-Za-z_$][\w$]*)/g;
const LIST_RE = /(?:^|\n)export\s*\{([^}]*)\}\s*(?!\s*from)/g;
const DEFAULT_RE = /(?:^|\n)export\s+default\b/;

/** Every name a file exports, with the line it is declared on. */
function exportsOf(file) {
  let text; try { text = readFileSync(file, "utf8"); } catch { return []; }
  const lineAt = (i) => text.slice(0, i).split("\n").length;
  const out = new Map();
  for (const re of [DECL_RE, TYPE_RE]) for (const m of text.matchAll(re)) if (!out.has(m[1])) out.set(m[1], lineAt(m.index));
  for (const m of text.matchAll(LIST_RE)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim();
      if (name && !out.has(name)) out.set(name, lineAt(m.index));
    }
  }
  const d = text.match(DEFAULT_RE);
  if (d) out.set("default", lineAt(text.indexOf(d[0])));
  return [...out].map(([name, line]) => ({ name, line }));
}

/** Whether the module that declares a name also reads it. One that does keeps
 * the name and drops the `export`; one that does not has nothing left to keep,
 * and the name goes with whatever it was for. A word in a comment counts, so
 * this errs towards keeping and the reader decides. */
function usedInside(file, name) {
  let text; try { text = readFileSync(file, "utf8"); } catch { return false; }
  return [...text.matchAll(new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`, "g"))].length > 1;
}

// A route file's contract with Next: read by the framework, never imported.
const ROUTE_FILE = /^(page|layout|route|template|default|loading|error|global-error|not-found|sitemap|robots|manifest|icon|apple-icon|opengraph-image|twitter-image)\.[jt]sx?$/;
const ROUTE_EXPORTS = new Set(["default", "metadata", "generateMetadata", "viewport", "generateViewport", "dynamic", "dynamicParams", "revalidate", "fetchCache", "runtime", "preferredRegion", "maxDuration", "generateStaticParams", "alt", "size", "contentType", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const isRouteFile = (f) => f.includes(`${path.sep}app${path.sep}`) && ROUTE_FILE.test(path.basename(f));

/** The test beside a module: same name, `.test` or `.spec` before the
 * extension. */
const ownTests = (file) => {
  const stem = file.replace(/\.[jt]sx?$/, "");
  return new Set([".test", ".spec"].flatMap((k) => [".ts", ".tsx", ".mjs", ".js"].map((e) => stem + k + e)).filter(statSyncSafe));
};

// TEMPORARY, and it goes when the two lanes below land (SAK-419).
//
// SAK-416 holds sky-lesson.tsx, lesson.ts and teach.ts; SAK-411 holds
// sky-home.tsx, sky-field.tsx, constellation.tsx and constellation.ts. Both
// were being written while this pass was added, so their unread exports were
// left alone rather than edited underneath another session. Delete this list
// and the line that reads it once they are in, and fix what it uncovers.
const HELD = new Set([
  "src/app/(sky)/lesson.ts",
  "src/app/(sky)/teach.ts",
  "src/sky/components/sky-lesson.tsx",
  "src/sky/components/sky-home.tsx",
  "src/sky/components/sky-field.tsx",
  "src/sky/components/constellation.tsx",
  "src/sky/lib/constellation.ts",
]);

const roots = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const scope = (roots.length ? roots : DEFAULT_ROOTS).map((r) => path.join(ROOT, r));
// Every file that could do the importing: all of src, the scripts, the specs.
const readers = [
  ...walk(path.join(ROOT, "src")).filter(isCode),
  ...walk(path.join(ROOT, "scripts")).filter(isCode),
  ...walk(path.join(ROOT, "e2e")).filter(isCode),
];
const wanted = new Map();
for (const r of readers) for (const [target, names] of imports(r)) {
  const have = wanted.get(target) ?? new Map();
  have.set(r, names);
  wanted.set(target, have);
}

const subjects = scope.flatMap((s) => (statSyncSafe(s) ? [s] : walk(s))).filter((f) => isCode(f) && !isTest(f) && !HELD.has(path.relative(ROOT, f)));
const unread = [];
const testOnly = [];
for (const file of subjects.sort()) {
  const mine = ownTests(file);
  const byReader = [...(wanted.get(file) ?? new Map())].filter(([r]) => r !== file);
  if (byReader.some(([, names]) => names.has("*"))) continue;
  const readByTest = new Set(byReader.filter(([r]) => mine.has(r)).flatMap(([, names]) => [...names]));
  const readByOthers = new Set(byReader.filter(([r]) => !mine.has(r)).flatMap(([, names]) => [...names]));
  for (const { name, line } of exportsOf(file)) {
    if (readByOthers.has(name)) continue;
    if (isRouteFile(file) && ROUTE_EXPORTS.has(name)) continue;
    const at = { file: path.relative(ROOT, file), line, name };
    if (readByTest.has(name)) testOnly.push(at);
    else unread.push({ ...at, inside: usedInside(file, name) });
  }
}

console.log(`${unread.length} exports nothing outside their own file imports, over ${subjects.length} files`);
for (const f of unread) console.log(`  ${f.file}:${f.line}  ${f.name}  ${f.inside ? "(drop the export)" : "(dead)"}`);
console.log(`${testOnly.length} more whose only importer is the test beside them`);
if (process.argv.includes("--list")) for (const f of testOnly) console.log(`  ${f.file}:${f.line}  ${f.name}`);
process.exit(unread.length ? 1 : 0);
