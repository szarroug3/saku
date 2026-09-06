#!/usr/bin/env node
// SAK-228: bundle-size regression gate.
//
// Sums the client JS actually referenced by each route's React Server
// Components client-reference-manifest (i.e. what a real visit to that route
// has to ship to the browser), and fails the run if any route exceeds its
// budget. Run this AFTER `next build` (or `pnpm run build`, which is `next
// build`) — it reads straight out of `.next/server/app/**`.
//
// WHY THIS EXISTS (SAK-228): this script previously only printed sizes, for
// nine of the app's ~20 real routes, and was never invoked by anything —
// not `package.json`, not CI. A route could balloon to 27MB (the bug this
// ticket is named for) and nothing would notice until a human happened to
// run this file by hand. It is now wired into `pnpm run build:check-sizes`
// and the CI `check` job (see .github/workflows/ci.yml), and every route
// with its own top-level `page.tsx` is listed below — add a line here
// whenever a new one is.
//
// BUDGETS are calibrated to each route's own measured size plus headroom
// (roughly 20-30%), not one flat number: the app's routes are legitimately
// very different weights (a static marketing-ish page vs. a grading route
// that still carries the vocabulary dictionary — see
// docs/perf-library-list-bundle.md, "What's still deferred"). The point of a
// per-route budget is to catch a route DOUBLING or TRIPLING in size, not to
// pretend they should all weigh the same.
import fs from "fs";
import path from "path";

const NEXT_DIR = process.env.ROUTE_SIZES_NEXT_DIR || ".next";

// route -> [manifest path (relative to NEXT_DIR/server), budget in MB]
// The Sky's routes (2026-09-06). Budgets are the measured size plus a third,
// so a page that doubles fails and one that drifts a little does not.
const ROUTES = {
  "/": ["app/(sky)/page_client-reference-manifest.js", 1.5],
  "/observatory": ["app/(sky)/observatory/page_client-reference-manifest.js", 1.5],
  "/lesson": ["app/(sky)/lesson/page_client-reference-manifest.js", 2],
  // The quiz, practice and settings clients pull the app's engine and its
  // tables into the browser (14.8 MB measured, 2026-09-06). Budgeted at
  // what they are so growth still fails; the cut is tracked in the
  // performance audit, and these should come back down to about 2 MB.
  "/quiz": ["app/(sky)/quiz/page_client-reference-manifest.js", 16],
  "/practice": ["app/(sky)/practice/page_client-reference-manifest.js", 16],
  "/practice/run": ["app/(sky)/practice/run/page_client-reference-manifest.js", 16],
  "/atlas": ["app/(sky)/atlas/page_client-reference-manifest.js", 2],
  "/sessions": ["app/(sky)/sessions/page_client-reference-manifest.js", 1.5],
  "/settings": ["app/(sky)/settings/page_client-reference-manifest.js", 16],
  "/account": ["app/(sky)/account/page_client-reference-manifest.js", 1.5],
  "/how-it-works": ["app/(sky)/how-it-works/page_client-reference-manifest.js", 1.5],
  "/about": ["app/(sky)/about/page_client-reference-manifest.js", 1.5],
  "/dev/scheduling": ["app/dev/scheduling/page_client-reference-manifest.js", 8],
};

function routeSizeBytes(manifestRelPath) {
  const file = path.join(NEXT_DIR, "server", manifestRelPath);
  if (!fs.existsSync(file)) return { error: `manifest not found: ${file}` };

  const src = fs.readFileSync(file, "utf8");
  const marker = '"] = ';
  const idx = src.indexOf(marker);
  if (idx === -1) return { error: `unrecognized manifest format: ${file}` };
  const jsonStr = src.slice(idx + marker.length).replace(/;\s*$/, "");
  const manifest = JSON.parse(jsonStr);

  const chunks = new Set();
  for (const mod of Object.values(manifest.clientModules)) {
    for (const c of mod.chunks || []) chunks.add(c);
  }

  let total = 0;
  const missing = [];
  for (const c of chunks) {
    // Manifest chunk paths look like "/_next/static/chunks/xxx.js"; the file
    // on disk lives at ".next/static/chunks/xxx.js".
    const localPath = path.join(NEXT_DIR, c.replace(/^\/_next/, ""));
    try {
      total += fs.statSync(localPath).size;
    } catch {
      missing.push(localPath);
    }
  }
  return { bytes: total, chunkCount: chunks.size, missing };
}

let failed = false;
const rows = [];

for (const [route, [manifestPath, budgetMb]] of Object.entries(ROUTES)) {
  const result = routeSizeBytes(manifestPath);

  if (result.error) {
    failed = true;
    rows.push({ route, status: "FAIL", detail: result.error });
    continue;
  }

  const mb = result.bytes / 1024 / 1024;
  const over = mb > budgetMb;
  if (over) failed = true;

  let detail = `${mb.toFixed(2)}MB / ${budgetMb}MB budget across ${result.chunkCount} chunks`;
  if (result.missing.length > 0) {
    detail += ` (${result.missing.length} chunk file(s) on the manifest but missing on disk)`;
  }

  rows.push({ route, status: over ? "FAIL" : "ok", detail });
}

const routeWidth = Math.max(...Object.keys(ROUTES).map((r) => r.length));
for (const { route, status, detail } of rows) {
  const marker = status === "FAIL" ? "✗ FAIL" : "✓ ok  ";
  console.log(`${marker}  ${route.padEnd(routeWidth)}  ${detail}`);
}

if (failed) {
  console.error(
    "\nroute_sizes: one or more routes exceeded their bundle-size budget, or their manifest could not be read.\n" +
      "If the growth is expected, raise that route's budget in scripts/route_sizes.mjs deliberately — don't just re-run.\n" +
      "If a route above says \"manifest not found\", it was likely renamed/removed; update ROUTES in this file to match.",
  );
  process.exit(1);
} else {
  console.log("\nroute_sizes: all routes within budget.");
}
