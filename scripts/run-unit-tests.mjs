#!/usr/bin/env node

// Unit test launcher that supports optional file args while keeping the same
// hook/concurrency defaults as package.json scripts.

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const targets = args.length ? args : ["src/**/*.test.ts"];

const child = spawnSync(
  process.execPath,
  [
    "--conditions=react-server",
    // SAK-236: lets a test replace one of its module's own imports (e.g.
    // supabase-store.test.ts swapping out "@/lib/supabase/server" for a fake,
    // so the real Postgres client — whose factory needs a live Next.js
    // request — never has to run in a plain `node --test` process). Node
    // ships this behind a flag as of v22; harness-only, nothing at app
    // runtime touches it.
    "--experimental-test-module-mocks",
    "--import",
    "./src/lib/conjugate/test-hooks.mjs",
    "--test",
    "--test-concurrency=8",
    ...targets,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: "",
      VSCODE_INSPECTOR_OPTIONS: "",
    },
  },
);

process.exit(child.status ?? 1);
