// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/attribution.test.ts
//
// THE LICENCE GUARD. This test is not about code quality; it is about not
// shipping a copyright violation.
//
// WHAT CHANGED, AND WHY THAT NEEDS A TEST
// =======================================
// KanjiVG's stroke-order data is CC BY-SA 3.0 and must be credited. It used to
// credit itself: StrokeOrder rendered a line of small print under every diagram,
// so the obligation travelled WITH the component and any new screen got it for
// free. That line is gone — the credit now lives on /about/data, reached from
// each screen through <AttributionLink /> — which is a legitimate way to satisfy
// "in any reasonable manner", but it moves the obligation OFF the component and
// onto the screen. A future page can now render a stroke diagram, forget the
// link, look completely fine, and be infringing.
//
// The same holds for EDRDG, whose licence is the stricter of the two: the
// acknowledgement must appear on each screen showing the data or be REACHABLE
// from it, and README/About-box/startup-screen are excluded by name.
//
// So: every page that draws stroke order must be able to reach the credits. Not
// "should" — the test fails, loudly, and the failure message says what to add.
//
// HOW IT CHECKS
// =============
// Source-level, on the JSX. It builds a file graph over src/**/*.tsx — an edge
// A→B when A imports a component from B and renders it as a tag — then, for
// every src/app/**/page.tsx, walks that graph. If the walk reaches a file
// rendering <HowItsWritten> or <StrokeOrder>, it must also reach a file
// rendering <AttributionLink>.
//
// Static and approximate on purpose: it cannot follow a component passed as a
// prop or picked out of a map. That is the right trade — a grep-shaped check
// that catches the realistic mistake (someone adds a page, imports the section,
// ships) beats a render harness this repo would otherwise have no reason to own.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { SHORT, SOURCES, ATTRIBUTION_HREF, LICENCE_NOTE } from "./attribution.ts";

/** src/, derived from this file's own location rather than the cwd — the test
 * has to hold wherever it is run from. */
const SRC = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Every .tsx under src/, absolute. */
function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...tsxFiles(path));
    else if (name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

const FILES = tsxFiles(SRC);
const TEXT = new Map(FILES.map((f) => [f, readFileSync(f, "utf-8")]));

/** Resolve an `@/…` specifier to a file we actually have. */
function resolveAlias(spec: string): string | null {
  if (!spec.startsWith("@/")) return null;
  const base = join(SRC, spec.slice(2));
  for (const candidate of [`${base}.tsx`, join(base, "index.tsx")]) {
    if (TEXT.has(candidate)) return candidate;
  }
  return null;
}

/** Does this file render <Tag …> anywhere? */
function renders(file: string, tag: string): boolean {
  return new RegExp(`<${tag}[\\s/>]`).test(TEXT.get(file) ?? "");
}

/** The files each file can render INTO: an aliased import whose imported name is
 * used as a JSX tag in the importing file. */
function childrenOf(file: string): string[] {
  const text = TEXT.get(file) ?? "";
  const out = new Set<string>();
  const importRe = /import\s+\{([^}]+)\}\s+from\s+"(@\/[^"]+)"/g;
  for (const m of text.matchAll(importRe)) {
    const target = resolveAlias(m[2]);
    if (!target) continue;
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/).pop()?.trim() ?? "";
      if (/^[A-Z]/.test(name) && renders(file, name)) out.add(target);
    }
  }
  return [...out];
}

/** Every file reachable from `start` through rendered components, including it. */
function reachable(start: string): Set<string> {
  const seen = new Set<string>([start]);
  const stack = [start];
  while (stack.length) {
    for (const next of childrenOf(stack.pop()!)) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen;
}

const APP = join(SRC, "app");
const PAGES = FILES.filter((f) => f.startsWith(APP) && f.endsWith(`${sep}page.tsx`));
const DRAWS_STROKES = (f: string) => renders(f, "HowItsWritten") || renders(f, "StrokeOrder");
const CREDITS = (f: string) => renders(f, "AttributionLink");
const rel = (f: string) => f.slice(SRC.length + 1);

describe("stroke-order attribution is reachable", () => {
  test("the graph found something to check", () => {
    // A guard on the guard. If the walk stops finding stroke order at all —
    // renamed component, changed import style — every assertion below passes
    // vacuously and the licence check silently stops existing.
    assert.ok(PAGES.length > 0, "no app pages found; the file walk is broken");
    assert.ok(
      FILES.some(DRAWS_STROKES),
      "no file renders <HowItsWritten>/<StrokeOrder> — did they get renamed? Update this test.",
    );
    assert.ok(FILES.some(CREDITS), "no file renders <AttributionLink>");
  });

  test("every page that draws stroke order can reach the credits", () => {
    for (const page of PAGES) {
      const tree = [...reachable(page)];
      if (!tree.some(DRAWS_STROKES)) continue;
      assert.ok(
        tree.some(CREDITS),
        `${rel(page)} renders stroke-order data (KanjiVG, CC BY-SA 3.0) but no ` +
          `<AttributionLink /> is reachable from it. The inline credit under the ` +
          `diagram is gone on purpose; /about/data is the credit now, and this ` +
          `page has no route to it. Add <AttributionLink /> — this is a licence ` +
          `violation, not a style nit.`,
      );
    }
  });

  test("the stepped lesson, which draws stroke order, carries the link", () => {
    // Named outright rather than left to the sweep above: the session screen is
    // the one that reaches stroke order through three hops of components, so it
    // is the one a refactor is most likely to quietly disconnect.
    const walk = join(SRC, "components", "session", "teach-walk.tsx");
    assert.ok(TEXT.has(walk), "teach-walk.tsx moved; repoint this assertion");
    assert.ok(CREDITS(walk), "the stepped lesson lost its <AttributionLink />");
  });

  test("no component credits KanjiVG inline any more", () => {
    // The other direction: if someone re-adds the inline credit, the two places
    // will drift. /about/data is the single copy.
    for (const f of FILES) {
      if (f.includes(join(SRC, "app", "about"))) continue;
      assert.ok(
        !/kanjivg\.tagaini\.net/i.test(TEXT.get(f) ?? ""),
        `${rel(f)} links KanjiVG inline; the credit belongs on /about/data`,
      );
    }
  });
});

describe("the credits page names every borrowed source", () => {
  test("KanjiVG is on it, with holder, licence and link", () => {
    const kanjivg = SOURCES.find((s) => s.name === "KanjiVG");
    assert.ok(kanjivg, "KanjiVG is missing from SOURCES — the stroke data is uncredited");
    assert.match(kanjivg.holder, /Ulrich Apel/);
    assert.equal(kanjivg.licence, "CC BY-SA 3.0");
    assert.equal(kanjivg.href, "https://kanjivg.tagaini.net/");
    assert.match(LICENCE_NOTE, /KanjiVG/);
  });

  test("EDRDG is never dropped — its licence is the strict one", () => {
    assert.ok(SOURCES.some((s) => s.holder.includes("Electronic Dictionary")));
    assert.match(LICENCE_NOTE, /Electronic Dictionary Research and Development Group/);
    assert.match(SHORT, /EDRDG/);
  });

  test("the footer label describes everything the page documents", () => {
    // It used to say only "Dictionary data", which under-described the page once
    // stroke diagrams and sentences arrived behind the same link.
    for (const word of ["Dictionary", "stroke", "sentence"]) {
      assert.match(SHORT, new RegExp(word), `SHORT does not mention ${word} data`);
    }
    assert.equal(ATTRIBUTION_HREF, "/about/data");
  });
});
