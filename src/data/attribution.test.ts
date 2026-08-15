// Run:
//   node --import ./src/lib/conjugate/test-hooks.mjs --test src/data/attribution.test.ts
//
// THE LICENCE GUARD. This test is not about code quality; it is about not
// shipping a copyright violation.
//
// WHAT CHANGED, AND WHY THAT NEEDS A TEST
// =======================================
// The dictionary data (EDRDG: KANJIDIC2, JMdict, KRADFILE) and the stroke-order
// data (KanjiVG, CC BY-SA 3.0) must both be credited on, or reachable from,
// every screen that shows them. README / About-box / startup-screen are ruled
// out by name in the EDRDG licence, which is the stricter of the two.
//
// The acknowledgement USED to ride each screen as a per-page <AttributionLink />
// dropped in the footer, and this test walked the component graph to prove every
// stroke-drawing page reached one. That mechanism is gone. The link now lives
// ONCE, as "About the data" in the global sidebar (src/components/sidebar.tsx),
// which src/app/layout.tsx mounts alongside {children} for every route — so it is
// reachable from every screen the way the licence's own "menu item" example is.
//
// So the obligation moved OFF the page and INTO the chrome, and the thing that
// can now break it is different: someone removes the sidebar entry, or unmounts
// the sidebar from the layout, and every screen silently loses its only route to
// the credits. This test guards THAT: the global chrome carries a link to
// ATTRIBUTION_HREF, and the chrome is mounted on every route.
//
// HOW IT CHECKS
// =============
// Source-level and textual, on purpose. It reads src/components/sidebar.tsx and
// src/app/layout.tsx directly rather than rendering them: the check that catches
// the realistic mistake (someone deletes the nav entry, or drops <Sidebar> from
// the shell) is a grep-shaped one, and a render harness is machinery this repo
// would otherwise have no reason to own. It stays honest by also asserting the
// data it depends on is still there (stroke order is still drawn somewhere, so
// the obligation still applies) — a guard that can pass vacuously is no guard.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
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

/** Does this file render <Tag …> anywhere? */
function renders(file: string, tag: string): boolean {
  return new RegExp(`<${tag}[\\s/>]`).test(TEXT.get(file) ?? "");
}

const SIDEBAR = join(SRC, "components", "sidebar.tsx");
const LAYOUT = join(SRC, "app", "layout.tsx");
const DRAWS_STROKES = (f: string) => renders(f, "HowItsWritten") || renders(f, "StrokeOrder");
const rel = (f: string) => f.slice(SRC.length + 1);

/** Does `text` declare a link (a Next <Link> or a plain <a>) pointing at `href`?
 * Matches both the JSX-attribute form (href="/about/data") and the data form the
 * sidebar actually uses, where the route is a value in its NAV array
 * ({ href: "/about/data", … }). Escaped so a route with regex-special chars is
 * matched literally. */
function linksTo(text: string, href: string): boolean {
  const h = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`href\\s*[:=]\\s*"${h}"`).test(text);
}

describe("the credits link is carried by the global chrome", () => {
  test("the guard has something real to guard", () => {
    // If the data this obligation is about stops being rendered, the check below
    // would still pass but would be protecting nothing. Pin that stroke order is
    // still drawn (KanjiVG, the CC BY-SA source) and the sidebar/layout files are
    // where this test thinks they are, so a rename can't quietly void the guard.
    assert.ok(
      FILES.some(DRAWS_STROKES),
      "no file renders <HowItsWritten>/<StrokeOrder> — did they get renamed? Update this test.",
    );
    assert.ok(TEXT.has(SIDEBAR), "src/components/sidebar.tsx moved; repoint this test");
    assert.ok(TEXT.has(LAYOUT), "src/app/layout.tsx moved; repoint this test");
  });

  test("the sidebar links to the credits page", () => {
    // The whole compliance mechanism in one line: the global nav carries a link
    // whose href is the acknowledgement page. Remove the "About the data" entry
    // and this fails — that is a licence violation, not a nav tidy-up.
    assert.ok(
      linksTo(TEXT.get(SIDEBAR) ?? "", ATTRIBUTION_HREF),
      `src/components/sidebar.tsx has no link to ${ATTRIBUTION_HREF}. The data ` +
        `acknowledgement (EDRDG dictionaries + KanjiVG stroke order) is reachable ` +
        `from every screen ONLY through the global "About the data" sidebar entry. ` +
        `Restore it — this is a licence violation, not a style nit.`,
    );
  });

  test("the sidebar is mounted in the root layout, alongside every page", () => {
    // The link is only "reachable from every screen" if the sidebar is actually
    // in the shell that wraps every route. The root layout renders <Sidebar> and
    // {children} in the same tree; drop the sidebar and the reachable-menu-item
    // mechanism the licence relies on is gone from the whole app at once.
    const layout = TEXT.get(LAYOUT) ?? "";
    assert.ok(
      renders(LAYOUT, "Sidebar"),
      "src/app/layout.tsx no longer renders <Sidebar> — the credits link is no " +
        "longer global chrome, so no screen is guaranteed a route to /about/data.",
    );
    assert.ok(
      layout.includes("{children}"),
      "src/app/layout.tsx no longer wraps {children} — confirm the sidebar and " +
        "the page still share one shell so the menu item is reachable from each page.",
    );
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
    // The label is now a generic "Data sources"; EDRDG's acknowledgement lives on
    // the reachable /about/data page (SOURCES + LICENCE_NOTE), which is what the
    // licence requires. So this pins the PAGE names it, not the footer label.
    assert.ok(SOURCES.some((s) => s.holder.includes("Electronic Dictionary")));
    assert.match(LICENCE_NOTE, /Electronic Dictionary Research and Development Group/);
  });

  test("the link label is a non-empty pointer to the credits page", () => {
    // The obligation is satisfied by REACHABILITY: a persistent link, in the
    // global chrome of every screen, pointing at the page that acknowledges in full.
    assert.ok(SHORT.trim().length > 0);
    assert.equal(ATTRIBUTION_HREF, "/about/data");
  });
});
