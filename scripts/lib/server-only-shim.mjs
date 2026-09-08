// Lets a plain `node` script import the Sky's server adapters (the
// `src/app/(sky)/*.ts` modules) the way the app does.
//
// Those modules reach the app's tables through `@/lib/auth` and `@/lib/history`,
// which pull in the `server-only` package. That package's whole job is to throw
// the moment it is loaded outside a React Server Component, so importing
// `teach.ts` from a script dies at import time with "This module cannot be
// imported from a Client Component module" long before any of its data code
// runs. Nothing a script calls here touches a request, a cookie or a session:
// `teachFor` and `offerPick` read the shipped tables and an empty history.
//
// So this resolves `server-only` to an empty module and leaves every other
// specifier alone. Paired with src/lib/conjugate/test-hooks.mjs (which teaches
// Node the `@/` alias and the extensionless imports), that is enough to run the
// Sky's own teaching code outside Next:
//
//   node --import ./src/lib/conjugate/test-hooks.mjs \
//        --import ./scripts/lib/server-only-shim.mjs scripts/list-speakable.mjs
//
// Script-side only. Nothing at app runtime loads this, so the real guard still
// guards the real app.

import { registerHooks } from "node:module";

/** An empty ES module, inline. Nothing imports a binding from `server-only`. */
const EMPTY_MODULE = "data:text/javascript,";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: EMPTY_MODULE, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
