#!/usr/bin/env node

// Why is THIS in that bundle?
//
// route_sizes.mjs says a route got fat; this says what dragged it in. Give it
// a starting module and something to look for, and it walks `import ... from`
// lines breadth-first and prints the shortest chain from one to the other.
//
//   node scripts/import_path.mjs src/app/\(sky\)/quiz-client.tsx word-definitions
//   node scripts/import_path.mjs src/components/ui/hear-button.tsx src/data
//
// A "use server" module is a wall: the browser gets a call, not the code, so
// the walk stops there. `--all` walks through it, which is the right question
// when you are asking what the SERVER loads.
//
// The needle is a plain substring of a resolved path, so "src/data" finds any
// data table and "en-synonyms" finds one file. With no needle it prints every
// file reachable from the start, biggest first, which is the same question
// asked the other way round.
//
// Written for SAK-380, where one import of the engine put 15 MB of curriculum
// tables into the Quiz, Practice and Settings pages. Text only: it reads the
// import lines, so a dynamic import or a re-export through a barrel that this
// misses is worth checking by hand. It is a pointer, not a proof.

import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const WALK_SERVER = argv.includes("--all");
const [start, needle] = argv.filter((a) => a !== "--all");
if (!start) {
  console.error("usage: node scripts/import_path.mjs <file> [substring]");
  process.exit(2);
}

const ROOT = process.cwd();
const EXTS = [".ts", ".tsx", ".mjs", ".js", ".json"];

/** The file a specifier names, or null when it leaves the repo (a package). */
function resolve(spec, from) {
  let base;
  if (spec.startsWith("@/")) base = path.join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const candidate of [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => path.join(base, "index" + e))]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not this one
    }
  }
  return null;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g;

/** A "use server" module is replaced by a stub in the browser: the client gets
 * a call, not the code, so nothing it imports is downloaded. Stopping there is
 * what makes this answer "what does the browser get" rather than "what does
 * this file mention". Pass --all to walk through them anyway. */
function isServerOnly(text) {
  return /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/.test(text);
}

function importsOf(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  if (!WALK_SERVER && file !== from && isServerOnly(text)) return [];
  const out = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    const target = resolve(m[1], file);
    if (target) out.push(target);
  }
  return out;
}

const from = path.resolve(ROOT, start);
const seen = new Map([[from, null]]); // file -> the file that imported it
const queue = [from];
let hit = null;

while (queue.length) {
  const file = queue.shift();
  if (needle && file !== from && file.includes(needle)) {
    hit = file;
    break;
  }
  for (const next of importsOf(file)) {
    if (seen.has(next)) continue;
    seen.set(next, file);
    queue.push(next);
  }
}

const rel = (f) => path.relative(ROOT, f);
const sizeOf = (f) => {
  try {
    return statSync(f).size;
  } catch {
    return 0;
  }
};
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

if (needle) {
  if (!hit) {
    console.log(`${rel(from)} does not reach anything matching "${needle}".`);
    process.exit(0);
  }
  const chain = [];
  for (let f = hit; f; f = seen.get(f)) chain.unshift(f);
  console.log(`${rel(from)} reaches ${rel(hit)} (${mb(sizeOf(hit))}) through:\n`);
  chain.forEach((f, i) => console.log(`${"  ".repeat(i)}${i ? "└ " : ""}${rel(f)}`));
  process.exit(0);
}

const files = [...seen.keys()].filter((f) => f !== from);
const total = files.reduce((n, f) => n + sizeOf(f), 0);
console.log(`${rel(from)} reaches ${files.length} files, ${mb(total)} of source.\n`);
for (const f of files.sort((a, b) => sizeOf(b) - sizeOf(a)).slice(0, 15)) {
  console.log(`  ${mb(sizeOf(f)).padStart(9)}  ${rel(f)}`);
}
