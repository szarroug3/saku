// Everything inside a button sits in its middle (SAK-415).
//
// The rule is one line long and it is not negotiable: whatever a button draws,
// it draws on the button's own horizontal centre line. Sam saw a lesson rail
// row whose label rode high in its pill and a round expander whose chevron sat
// above the middle of its ring, and both were invisible to a reading of the
// classes: `items-baseline` looks like alignment, and `place-items-center`
// looks like centring. Only a measurement tells you.
//
// So this is the gate. It drives a PRODUCTION build with Playwright, finds
// every button-like element on the Sky's pages, measures the container against
// what is inside it, and reports anything more than a pixel out. Run it with a
// server already up:
//
//   NEXT_DIST_DIR=.next-e2e SAKU_DISABLE_AUTH=1 npx next start -p 3255
//   node scripts/button-centering.mjs --base=http://127.0.0.1:3255
//
// It exits non-zero when it finds an offender, so it can sit in a check.

import { chromium } from "@playwright/test";

const DEFAULT_BASE = "http://127.0.0.1:3255";
// One pixel. Half of one is what a 2x screen can draw, so anything at or under
// a whole pixel is a rounding decision rather than a mistake anyone can see.
const THRESHOLD = 1;

/**
 * The pages, and what to open on each so the controls that live behind a click
 * are measured too, rather than only what a page happens to draw on arrival.
 *
 * A reveal is a role and a name to click, or a key to press. One that is not
 * on the page is skipped rather than failing the run, so the list can reach
 * for something the sample learner may not have.
 */
const PAGES = [
  { path: "/?sample", name: "home", reveal: [{ role: "button", name: /Show the details/ }] },
  {
    path: "/atlas?sample",
    name: "atlas",
    reveal: [
      // the kanji shelf, which is the only one with a built-from control
      { role: "button", name: /^Kanji/ },
      // a tile, which opens the entry card and its folds beside the shelf
      { role: "button", name: /^日 / },
      { role: "button", name: /Open Readings/ },
      // last, and left open: its card floats over the shelf, so anything
      // clicked after this one would be clicking the card
      { role: "button", name: /Choose the parts a kanji is built from/ },
    ],
  },
  { path: "/lesson?picks=" + encodeURIComponent("kanji:日"), name: "lesson", reveal: [{ role: "button", name: /^日/ }] },
  { path: "/practice?sample", name: "practice", reveal: [{ role: "button", name: /^Kana/ }] },
  { path: "/settings", name: "settings", reveal: [] },
  { path: "/sessions?sample", name: "sessions", reveal: [{ role: "button", name: /Quiz · / }] },
  { path: "/observatory?sample", name: "observatory", reveal: [] },
];

/**
 * Everything the Sky treats as a button.
 *
 * `button` and `role="button"` are the bulk of it. The other roles are buttons
 * wearing a more precise name: Settings' accent swatches are radios, its
 * switches are switches, the built-from card's parts are options. `summary`
 * is here for completeness even though SAK-412 replaced the Sky's last
 * `<details>`. `[data-sky-chip]` catches `SkyMenuChip`, which is a pill made
 * of two buttons inside one bordered span, so the span is the container the
 * pill's contents have to centre in. The two anchor selectors catch the
 * things that are buttons without being `<button>`: a `SkyButton` with an
 * `href` is an `<a>` carrying the same `inline-flex` base, and the top bar's
 * entries and the Atlas rail's are links in a `header` or a `nav`.
 */
const SELECTOR = [
  "button",
  '[role="button"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="option"]',
  '[role="tab"]',
  "[data-sky-chip]",
  "summary",
  'a[class*="inline-flex"]',
  "header a[href]",
  "nav a[href]",
].join(",");

/**
 * The measurement, run inside the page.
 *
 * The container is its border box, so a stray `pt` or `pb` shows up as an
 * offset rather than hiding inside the padding. Each DIRECT child is measured
 * on its own: an element by its own box, a text node by a `Range` over it and
 * the union of the rects that range draws.
 *
 * Three things are deliberately taken back out before comparing. A
 * screen-reader-only child is not on the screen at all, and it is recognised
 * by the `clip: rect(0,0,0,0)` every such helper sets rather than by a class
 * name. An out-of-flow child is placed by its own offsets and not by the
 * container's alignment, so it is not the container's to centre: the top bar
 * pins the current page's underline to the bottom of its entry, and an
 * `ItemCard` bleeds a watermark off its own corner, and both are right. And a
 * measured ink shift is not a box that is off: `RoundButton` moves its
 * glyph's SPAN so the glyph's INK lands on the ring's centre (SAK-413), so the
 * shift is read back off the computed `translate` and `transform` and undone,
 * leaving the box where the layout put it.
 *
 * Then one of two rules applies. If every kept child overlaps every other one
 * vertically, the children are a ROW and each one has to centre on the
 * container. If any two are disjoint, the container is a STACK on purpose (an
 * Atlas tile draws a glyph over its name), and it is the union of the children
 * that has to centre, which is the same padding question one level up.
 */
function collect(selector, threshold) {
  const out = [];
  let measuredCount = 0;

  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // The screen-reader-only signature, in either of its two spellings.
  const offScreen = (cs) => cs.clip === "rect(0px, 0px, 0px, 0px)" || cs.clipPath === "inset(50%)";

  // How far this element's own transforms moved it down the page. Tailwind
  // writes `translate-y-*` to the `translate` property and `rotate-*` to
  // `rotate`, but a hand-written `transform` matrix is read too.
  const shiftOf = (cs) => {
    let dy = 0;
    if (cs.translate && cs.translate !== "none") {
      const parts = cs.translate.trim().split(/\s+/);
      if (parts.length > 1) dy += parseFloat(parts[1]) || 0;
    }
    if (cs.transform && cs.transform !== "none") {
      const nums = cs.transform.slice(cs.transform.indexOf("(") + 1, -1).split(",").map(Number);
      if (nums.length === 6) dy += nums[5] || 0;
      else if (nums.length === 16) dy += nums[13] || 0;
    }
    return dy;
  };

  const describe = (el) => {
    const cls = (el.getAttribute("class") ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".");
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 28);
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
  };

  for (const el of document.querySelectorAll(selector)) {
    if (!visible(el)) continue;
    const box = el.getBoundingClientRect();
    const kids = [];
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!(node.textContent ?? "").trim()) continue;
        const range = document.createRange();
        range.selectNode(node);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
        range.detach?.();
        if (rects.length === 0) continue;
        const top = Math.min(...rects.map((r) => r.top));
        const bottom = Math.max(...rects.map((r) => r.bottom));
        kids.push({ top, bottom, label: `text "${(node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 28)}"` });
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const cs = getComputedStyle(node);
      if (offScreen(cs)) continue;
      if (cs.position === "absolute" || cs.position === "fixed") continue;
      if (!visible(node)) continue;
      const r = node.getBoundingClientRect();
      const dy = shiftOf(cs);
      kids.push({ top: r.top - dy, bottom: r.bottom - dy, label: describe(node) });
    }
    if (kids.length === 0) continue;
    measuredCount += 1;

    const middle = box.top + box.height / 2;
    // Disjoint boxes mean the children are stacked, which is a layout choice,
    // not a centring mistake; the union of them still has to sit in the middle.
    const stacked = kids.some((a) => kids.some((b) => a.bottom <= b.top || b.bottom <= a.top));
    const measured = stacked
      ? [{ top: Math.min(...kids.map((k) => k.top)), bottom: Math.max(...kids.map((k) => k.bottom)), label: `all ${kids.length} children, stacked` }]
      : kids;

    for (const k of measured) {
      const offset = (k.top + k.bottom) / 2 - middle;
      if (Math.abs(offset) > threshold) {
        out.push({ container: describe(el), child: k.label, offset: Math.round(offset * 100) / 100 });
      }
    }
  }
  return { measured: measuredCount, offenders: out };
}

async function main() {
  const base = (process.argv.find((a) => a.startsWith("--base=")) ?? `--base=${DEFAULT_BASE}`).slice("--base=".length);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "en-US", timezoneId: "UTC" });

  // Grouped by the shape of the offence rather than by the element: a rail of
  // forty rows is one mistake in one component, not forty.
  const groups = new Map();
  const counted = [];
  let total = 0;

  for (const spec of PAGES) {
    await page.goto(`${base}${spec.path}`, { waitUntil: "load" });
    // The Sky's pages hydrate and then fill in; give the last of it a moment.
    await page.waitForTimeout(1500);
    for (const r of spec.reveal) {
      if (r.key) {
        await page.keyboard.press(r.key);
      } else {
        const target = page.getByRole(r.role, { name: r.name }).first();
        if (!(await target.count().catch(() => 0))) continue;
        await target.click({ timeout: 3000 }).catch(() => {});
      }
      await page.waitForTimeout(500);
    }
    // `collect` is written here but runs there, so it goes over as its own
    // source and is called on the far side.
    const { measured, offenders } = await page.evaluate(`(${collect.toString()})(${JSON.stringify(SELECTOR)}, ${THRESHOLD})`);
    counted.push(`${spec.name}: ${measured}`);
    for (const f of offenders) {
      total += 1;
      const key = `${spec.name} ${f.container} ${f.child}`;
      const seen = groups.get(key);
      if (!seen) groups.set(key, { page: spec.name, ...f, count: 1, worst: f.offset });
      else {
        seen.count += 1;
        if (Math.abs(f.offset) > Math.abs(seen.worst)) seen.worst = f.offset;
      }
    }
  }

  await browser.close();

  const rows = [...groups.values()].sort((a, b) => Math.abs(b.worst) - Math.abs(a.worst));
  const lines = [];
  lines.push(`button centering, ${PAGES.length} pages, over ${THRESHOLD}px`);
  lines.push("");
  for (const r of rows) {
    lines.push(`${r.worst > 0 ? "+" : ""}${r.worst}px  [${r.page}] ${r.container}`);
    lines.push(`         child: ${r.child}${r.count > 1 ? `  (x${r.count})` : ""}`);
  }
  lines.push("");
  lines.push(`measured: ${counted.join(", ")}`);
  lines.push(`${rows.length} shapes, ${total} elements over ${THRESHOLD}px`);
  const report = lines.join("\n");
  process.stdout.write(report + "\n");
  process.exitCode = rows.length === 0 ? 0 : 1;
}

await main();
