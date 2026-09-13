// The margin an eyebrow cannot be given from outside (SAK-417, SAK-432).
//
// `Eyebrow` writes its own `mb-1` unless `tight` is passed, Tailwind's sheet
// orders that after every other `mb-`, and a caller's margin loses to it in
// silence. Sixteen call sites had passed a `mb-0` that never applied. The prop
// type refuses the class now, which is the check that fires where the mistake
// is typed, and it can only see a class written out: a `className` assembled
// at runtime is a `string` to the compiler and slips through.
//
// So this reads the call sites themselves. It is the same bargain
// `night-theme.test.ts` makes with the stylesheet: the rule is about what the
// source says, so the test reads the source.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = "src";

/** Every .tsx under src, which is where JSX can be written at all. */
function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(path));
    else if (entry.name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/**
 * The opening tag of every `<Eyebrow …>` in one file.
 *
 * Scanned rather than matched with `[^>]*>`, because an attribute can hold a
 * `>` of its own: `className={`col-span-full${on.length > 0 ? " mt-2.5" : ""}`}`
 * is one of the call sites, and a regex that stops at the first `>` would cut
 * it in half and read the rest as prose. Depth counts braces, so the tag ends
 * at the first `>` outside every `{…}`.
 */
function eyebrowTags(source: string): string[] {
  const tags: string[] = [];
  for (let i = source.indexOf("<Eyebrow"); i >= 0; i = source.indexOf("<Eyebrow", i + 1)) {
    let depth = 0;
    for (let j = i; j < source.length; j++) {
      const c = source[j];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) {
        tags.push(source.slice(i, j + 1));
        break;
      }
    }
  }
  return tags;
}

describe("every Eyebrow that asks for a bottom margin says tight first", () => {
  it("has no call site setting an mb- class without it", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(ROOT)) {
      for (const tag of eyebrowTags(readFileSync(file, "utf8"))) {
        if (tag.includes("mb-") && !tag.includes("tight")) offenders.push(`${file}: ${tag}`);
      }
    }
    assert.deepEqual(offenders, [], "a margin passed to an eyebrow that writes its own never applies");
  });

  it("finds the call sites at all, so a silent zero is not a pass", () => {
    const tags = tsxFiles(ROOT).flatMap((f) => eyebrowTags(readFileSync(f, "utf8")));
    assert.ok(tags.length > 20, `only ${tags.length} Eyebrow call sites found`);
    // the one whose className carries a `>` of its own, which is why the scan
    // counts braces rather than stopping at the first one
    assert.ok(tags.some((t) => t.includes("col-span-full")), "the interpolated call site was read whole");
  });
});
