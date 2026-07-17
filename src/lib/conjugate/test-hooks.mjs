// Lets `node --test` resolve the app's imports: extensionless relative ones,
// and the `@/…` alias.
//
// Why this exists: the engine and its test are plain TypeScript, run directly
// by Node 24's built-in type stripping — no test framework, no build step, no
// new dependencies. But Node's ESM resolver needs a file extension, while the
// repo's tsconfig (`moduleResolution: bundler`) wants imports written WITHOUT
// one. Rather than edit the shared tsconfig, this hook bridges the two: it
// appends `.ts` to relative specifiers that don't resolve otherwise.
//
// THE ALIAS, AND WHY IT IS NOT SCOPE CREEP
// ========================================
// `@/*` → `./src/*` is in tsconfig, and every module outside this one library
// is written with it. Node has never been told, so until now a module using the
// alias could not be loaded by a test AT ALL — which quietly meant that "is it
// testable here" was decided by import style rather than by whether the module
// was pure. src/lib/budget.ts is pure, has no clock and no React, and was
// untested for that reason alone.
//
// The alias is read from tsconfig rather than restated, so the two cannot drift.
//
// Run the tests with:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/conjugate/conjugate.test.ts
//
// Nothing at app runtime uses this — Next's bundler resolves the imports on its
// own. It is test-harness plumbing only.

import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

/** The repo root — this file is src/lib/conjugate/test-hooks.mjs. */
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** tsconfig's `@/*` target, as a directory file URL. Read, not hardcoded: if
 * someone repoints the alias, the tests follow it rather than resolving against
 * a stale copy of a path that used to be right. */
const ALIAS_BASE = readAliasBase();

function readAliasBase() {
  // Matched, not JSON.parse'd: tsconfig.json is JSONC — it carries `//`
  // comments, and the parser rejects the whole file over them. This wants one
  // string out of it, so it reads that one string.
  const text = readFileSync(resolvePath(ROOT, "tsconfig.json"), "utf-8");
  const match = /"@\/\*"\s*:\s*\[\s*"([^"]+)"/.exec(text);
  if (!match) {
    // Loud. A silent null here would take every aliased test module with it and
    // report the failure as "cannot find package '@/lib'", which names the
    // wrong file.
    throw new Error(
      "test-hooks: no \"@/*\" path in tsconfig.json — the alias moved, and this hook resolves imports against it.",
    );
  }
  // A trailing slash, or `new URL` treats the last segment as a FILE and
  // replaces it: base .../src + "lib/scoring" resolves to .../lib/scoring.
  const dir = resolvePath(ROOT, match[1].replace(/\*$/, ""));
  return pathToFileURL(dir.endsWith("/") ? dir : `${dir}/`);
}

/** Add `.ts` when the bare path doesn't exist but the TypeScript file does,
 * or `/index.ts` when it names a directory. The second case is what lets a
 * test reach a module that imports a barrel — `@/data/grammar` resolves to
 * `@/data/grammar/index.ts`, exactly as the bundler resolves it at runtime. */
function withExtension(url) {
  if (/\.[a-z]+$/i.test(url.pathname)) return url;
  const asFile = new URL(`${url.href}.ts`);
  if (existsSync(fileURLToPath(asFile))) return asFile;
  const asIndex = new URL(`${url.href}/index.ts`);
  if (existsSync(fileURLToPath(asIndex))) return asIndex;
  return url;
}

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      const target = withExtension(new URL(specifier.slice(2), ALIAS_BASE));
      return next(target.href, context);
    }
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
