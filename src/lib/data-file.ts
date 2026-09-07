// A generated table read from disk the first time it is asked for, instead of
// being baked into every server bundle that imports the module owning it.
//
// The first request a process serves loads the route's whole bundle, and on
// the function that took 5 to 7 seconds because the bundle was 29 MB, 22 of
// them JSON text the bundler had inlined (SAK-399). A table only a few code
// paths read (a word's dictionary senses, the English synonym pool) does not
// have to be part of that: it can be read from the file when first needed,
// which is after the page has already answered, or never.
//
// The files ride with the function through `outputFileTracingIncludes` in
// next.config.ts, and are read relative to the working directory, which is
// the project root under `next start`, in a script, and on the function.
//
// `fs` is looked up at run time rather than imported: the modules that own
// these tables (data/vocab.ts, the engine) are also reached by a dev page's
// client bundle, where a static `node:fs` import stops the build. Nothing on
// the client ever calls this; on the server the lookup is the same module.

const loaded = new Map<string, unknown>();

/** The parsed contents of `src/data/generated/<name>`, read once. */
export function readDataJson<T>(name: string): T {
  let value = loaded.get(name);
  if (value === undefined) {
    const fs = process.getBuiltinModule("node:fs") as typeof import("node:fs");
    value = JSON.parse(fs.readFileSync(`${process.cwd()}/src/data/generated/${name}`, "utf8")) as unknown;
    loaded.set(name, value);
  }
  return value as T;
}
