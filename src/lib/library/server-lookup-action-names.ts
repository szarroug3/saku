// Stable, auto-derived names for every server-lookups.ts action — SAK-119.
//
// THE BUG THIS FIXES: use-server-lookup.ts's cache (and its IndexedDB
// persistence) keys each resolved value by `${name}:${JSON.stringify(args)}`,
// and used to derive that name from the action function's own `.name`
// property. That works in dev, where Next keeps a Server Action's client
// reference named after its export. In a PRODUCTION build every Server
// Action's client reference collapses to the SAME minified name (observed:
// literally "t" for every export of server-lookups.ts) — so `fn.name` stops
// disambiguating anything. Two different actions called with the
// same-shaped args (getRecipeOf/getRecipesOf both taking a lone EntryId;
// getLearnIndexData/getLibraryShelves/getStatsRows all taking EMPTY_ARGS)
// collided on one cache key, and whichever resolved second silently handed
// its value to the OTHER action's callers — a wrong-shaped payload
// (`patterns` becoming a single Recipe instead of an array, etc.) that threw
// deep inside render on every grammar pattern page, and corrupted /learn's
// feed data the same way. Confirmed by instrumenting the production bundle
// directly: every action's client-side `fn.name` was `"t"`.
//
// THE FIX: derive each action's name from its EXPORT NAME instead of its
// runtime `.name` — a compile-time string, untouched by minification — via
// one `import * as actions` of the whole module and a WeakMap from function
// identity to that name. Object identity is safe here (not the collapsed
// `.name`): the same action is always the same imported binding, and ES
// modules guarantee a single shared instance per specifier, so every call
// site's `getRecipeOf` resolves to the exact same object this module put in
// the map. New actions need no manual registration — this walks whatever
// server-lookups.ts currently exports.
import * as actions from "@/lib/library/server-lookups";

type AnyAction = (...args: never[]) => Promise<unknown>;

const ACTION_NAMES: WeakMap<AnyAction, string> = new WeakMap(
  Object.entries(actions).map(([name, fn]) => [fn as AnyAction, name] as const),
);

/** The stable name for a server-lookups.ts action, for use as a cache key
 * component — see this file's header for why this exists instead of `fn.name`.
 * Falls back to `fn.name` for anything not found in the registry (shouldn't
 * happen for a real server-lookups.ts export, but keeps this total rather
 * than throwing on an unexpected caller). */
export function actionName(fn: AnyAction): string {
  return ACTION_NAMES.get(fn) ?? fn.name;
}
