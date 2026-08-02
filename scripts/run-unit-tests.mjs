#!/usr/bin/env node

// Unit test launcher that supports optional file args while keeping the same
// hook/concurrency defaults as package.json scripts.

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const targets = args.length ? args : ["src/**/*.test.ts"];

const child = spawnSync(
  process.execPath,
  [
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
