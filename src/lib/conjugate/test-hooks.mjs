// Lets `node --test` resolve this library's extensionless relative imports.
//
// Why this exists: the engine and its test are plain TypeScript, run directly
// by Node 24's built-in type stripping — no test framework, no build step, no
// new dependencies. But Node's ESM resolver needs a file extension, while the
// repo's tsconfig (`moduleResolution: bundler`) wants imports written WITHOUT
// one. Rather than edit the shared tsconfig, this hook bridges the two: it
// appends `.ts` to relative specifiers that don't resolve otherwise.
//
// Run the tests with:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/conjugate/conjugate.test.ts
//
// Nothing at app runtime uses this — Next's bundler resolves the imports on
// its own. It is test-harness plumbing only.

import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      try {
        const candidate = new URL(`${specifier}.ts`, context.parentURL);
        if (existsSync(fileURLToPath(candidate))) return next(`${specifier}.ts`, context);
      } catch {
        // fall through to the default resolver
      }
    }
    return next(specifier, context);
  },
});
