import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_DIR = join(process.cwd(), "src", "app");

/**
 * Walk src/app and return every route the App Router serves, split into the
 * ones that need no params and the ones that do.
 *
 * The brief asks for routes to be *enumerated* rather than hardcoded, so that a
 * newly added page is covered by the smoke test the moment it lands, and a
 * deleted one stops being asserted. Only `page.tsx` counts; `route.ts` files
 * are API handlers, not pages.
 */
export type AppRoutes = {
  /** Routes with no dynamic segments, directly fetchable. */
  static: string[];
  /** Routes containing [param] / [...param] segments, needing real values. */
  dynamic: string[];
};

function walk(dir: string, segments: string[], out: AppRoutes): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Route groups (x) and private folders _x do not appear in the URL.
      const name = entry.name;
      if (name.startsWith("_")) continue;
      if (name.startsWith("@")) continue; // parallel route slot
      // /dev/* are development-only reference pages: the route layout 404s them in
      // a production build (src/app/dev/layout.tsx), which is what e2e runs
      // against, so they are not production routes to smoke-test.
      if (name === "dev" && segments.length === 0) continue;
      const next =
        name.startsWith("(") && name.endsWith(")")
          ? segments
          : [...segments, name];
      walk(join(dir, name), next, out);
    } else if (entry.name === "page.tsx" || entry.name === "page.ts") {
      const path = "/" + segments.join("/");
      const url = path === "/" ? "/" : path;
      if (segments.some((s) => s.includes("["))) out.dynamic.push(url);
      else out.static.push(url);
    }
  }
}

export function appRoutes(): AppRoutes {
  if (!existsSync(APP_DIR)) {
    throw new Error(`Expected the app directory at ${APP_DIR}`);
  }
  const out: AppRoutes = { static: [], dynamic: [] };
  walk(APP_DIR, [], out);
  out.static.sort();
  out.dynamic.sort();
  return out;
}
