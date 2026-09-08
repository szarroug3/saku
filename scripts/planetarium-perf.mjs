// What the Planetarium costs when it is zoomed out (SAK-411).
//
// Sam's report: the home sky is smooth at 100% and larger, and once it is
// zoomed out, when more of the fifteen thousand constellations are in the
// panel at once, tooltips lag, panning lags and zooming lags a little. The
// house rule is that a number decides what to change, so this drives a
// PRODUCTION build with Playwright and measures the three things she named,
// at four zooms, the same way every time:
//
//   * how many SVG elements the sky is holding in the DOM
//   * a 300px drag over about a second: how many frames took longer than
//     32ms, and the 95th percentile frame
//   * a wheel zoom, the same two numbers
//   * twenty stars hovered one after another: how long from the pointermove
//     reaching the page to the tooltip being in the DOM
//
// The zooms are reached through the page's OWN control, the minus button,
// which steps by 1.3: from 100% it lands on 77, 59, 46, 35, 27, 21. So a
// target of 60 is measured at 59 and a target of 25 at 21, and the table
// prints what it actually measured rather than what it asked for.
//
// Both skies are measured. The home OPENS on what the learner has
// discovered, which for the pretend learner is 641 things, and that sky is
// light at every zoom. The Undiscovered chip in the legend puts the other
// 23,332 up there, which is the fifteen thousand constellations the card is
// about and the sky the legend already warns is slower to draw. That is the
// one Sam is describing, so it is the one the levers are chosen on.
//
// With `--trace` it also records a Chrome timeline of one pan at the
// smallest zoom and reports where the time went, bucketed by self time:
// scripting, style and layout, paint, hit testing. That is the number that
// says whether the answer is "stop re-rendering" or "draw less".
//
// Run it with a server already up:
//
//   NEXT_DIST_DIR=.next-e2e SAKU_DISABLE_AUTH=1 npx next start -p 3256
//   node scripts/planetarium-perf.mjs --base=http://127.0.0.1:3256 --trace
//
// It only reports; nothing here fails a build.

import { chromium } from "@playwright/test";

const DEFAULT_BASE = "http://127.0.0.1:3256";
/** A frame this long is one the eye sees drop at 60Hz. */
const SLOW_FRAME = 32;
/** The zooms to measure, as percentages of the sky's own 100%. */
const TARGETS = [100, 60, 40, 25];
/** How many stars to hover for the tooltip number. */
const STARS = 20;
/** The drag: this far, in this many steps, one frame apart. */
const PAN_PIXELS = 300;
const PAN_STEPS = 60;
const FRAME_MS = 16;
/** How long to let a sky of a hundred thousand elements finish drawing. */
const SETTLE = 1200;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = flag("base", DEFAULT_BASE);
const WANT_TRACE = args.includes("--trace");
/** Skip the tables and record the timeline only, which is the slow half. */
const TRACE_ONLY = args.includes("--trace-only");

const percentile = (xs, p) => {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};
const round = (n, places = 1) => Math.round(n * 10 ** places) / 10 ** places;

/** Start counting the gaps between animation frames, in the page. */
async function startFrames(page) {
  await page.evaluate(() => {
    const w = /** @type {any} */ (window);
    w.__frames = [];
    let last = performance.now();
    const tick = (t) => { w.__frames.push(t - last); last = t; w.__raf = requestAnimationFrame(tick); };
    w.__raf = requestAnimationFrame(tick);
  });
}

/** Stop counting and report the gaps. The first is dropped: it spans the
 * idle time between arming the counter and the gesture starting. */
async function stopFrames(page) {
  const frames = await page.evaluate(() => {
    const w = /** @type {any} */ (window);
    cancelAnimationFrame(w.__raf);
    return w.__frames.slice(1);
  });
  return {
    frames: frames.length,
    slow: frames.filter((d) => d > SLOW_FRAME).length,
    p95: round(percentile(frames, 95)),
    worst: round(Math.max(0, ...frames)),
  };
}

/** The sky's svg, its box, and the middle of it in page coordinates. */
async function skyBox(page) {
  const box = await page.locator('svg[aria-label^="Every constellation"]').boundingBox();
  if (!box) throw new Error("the sky's svg has no box");
  return box;
}

/** Click the minus button until the sky reads at or below `target` percent.
 * Returns what it actually reads. `100` resets instead. */
async function zoomTo(page, target) {
  const readout = page.getByRole("button", { name: "Back to 100%" });
  await readout.click();
  const percent = async () => Number((await readout.textContent()).replace("%", ""));
  if (target >= 100) return percent();
  const out = page.getByRole("button", { name: "Zoom out" });
  let at = await percent();
  for (let i = 0; i < 24 && at > target; i++) {
    await out.click();
    const next = await percent();
    if (next === at) break;
    at = next;
  }
  return at;
}

/** Everything the sky is holding: elements inside the pan and zoom group,
 * and the whole svg including the hit circles. */
async function countElements(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label^="Every constellation"]');
    if (!svg) return { drawn: 0, hits: 0, total: 0 };
    return {
      drawn: svg.querySelectorAll("[data-view] *").length,
      hits: svg.querySelectorAll("[data-hit]").length,
      total: svg.querySelectorAll("*").length,
    };
  });
}

/** What the sky is transformed by right now, as a string to compare. */
async function transformNow(page) {
  return page.evaluate(() => {
    const g = document.querySelector('svg[aria-label^="Every constellation"] [data-view]');
    return g ? `${g.getAttribute("transform") ?? ""}|${g.style.transform}` : "";
  });
}

/** A 300px drag across the sky, a step per frame, with the frame gaps.
 *
 * LEFTWARD, and this matters. The world is anchored to the window's top
 * left and the clamp pins the pan at zero, so a drag to the RIGHT from a
 * sky that has just been reset moves nothing at all, costs nothing, and
 * reports beautiful numbers for a gesture that never happened. That is what
 * the first cut of this script measured. So the sky's transform is read
 * before and after and the row says whether it actually moved. */
async function pan(page, box, direction = -1) {
  const x0 = box.x + box.width / 2 - (direction * PAN_PIXELS) / 2;
  const y0 = box.y + box.height / 2;
  await page.mouse.move(x0, y0);
  const was = await transformNow(page);
  await startFrames(page);
  await page.mouse.down();
  const t0 = Date.now();
  for (let i = 1; i <= PAN_STEPS; i++) {
    await page.mouse.move(x0 + (direction * PAN_PIXELS * i) / PAN_STEPS, y0);
    await page.waitForTimeout(FRAME_MS);
  }
  const elapsed = Date.now() - t0;
  // the drag ends here, and the frames of the drag are the drag's. What the
  // release costs is its own number: the view is committed then, the field
  // works out which cull cells it is over, and that is one render, once,
  // with the finger already up.
  const during = await stopFrames(page);
  const moved = (await transformNow(page)) !== was;
  await startFrames(page);
  await page.mouse.up();
  await page.waitForTimeout(900);
  const release = await stopFrames(page);
  return { ...during, elapsed, moved, release: release.worst };
}

/** A wheel zoom in and back out, with the frame gaps. */
async function wheelZoom(page, box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await startFrames(page);
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, i < 6 ? -100 : 100);
    await page.waitForTimeout(FRAME_MS);
  }
  return stopFrames(page);
}

/** Up to twenty star centres spread across what the window is showing.
 * A hit circle when the sky still draws them, and the star's own dot when
 * it does not, which above a couple of thousand stars is every time. */
async function starPoints(page) {
  return page.evaluate((want) => {
    const svg = document.querySelector('svg[aria-label^="Every constellation"]');
    if (!svg) return [];
    const frame = svg.getBoundingClientRect();
    const circles = [...svg.querySelectorAll("[data-hit]")];
    const hits = circles.length ? circles : [...svg.querySelectorAll("[data-star]")];
    const out = [];
    const step = Math.max(1, Math.floor(hits.length / (want * 3)));
    for (let i = 0; i < hits.length && out.length < want; i += step) {
      const r = hits[i].getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const inFrame = x > frame.left + 8 && x < frame.right - 8 && y > frame.top + 8 && y < frame.bottom - 8;
      // the zoom control sits in the bottom right corner and would swallow
      // the pointer, so nothing near it counts
      const underControls = x > frame.right - 180 && y > frame.bottom - 60;
      if (r.width > 0 && inFrame && !underControls) out.push({ x, y });
    }
    return out;
  }, STARS);
}

/** How long from the pointermove landing in the page to the tooltip being
 * in the DOM, for each star in turn. The clock starts inside the page, on
 * the event itself, so the time it takes to drive the mouse is not counted. */
async function tooltipTimes(page, box, points) {
  const times = [];
  for (const p of points) {
    // off the sky first, so the field clears whatever it was showing
    await page.mouse.move(box.x + box.width / 2, box.y - 30);
    await page.waitForFunction(() => !document.querySelector('[role="tooltip"]'));
    await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      w.__t0 = null;
      w.__t1 = null;
      const onMove = () => { if (w.__t0 === null) w.__t0 = performance.now(); };
      window.addEventListener("pointermove", onMove, { capture: true, once: true });
      const poll = () => {
        if (w.__t1 !== null) return;
        if (document.querySelector('[role="tooltip"]')) { w.__t1 = performance.now(); return; }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    });
    await page.mouse.move(p.x, p.y);
    try {
      await page.waitForFunction(() => /** @type {any} */ (window).__t1 !== null, null, { timeout: 15000 });
    } catch {
      continue;
    }
    const { t0, t1 } = await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      return { t0: w.__t0, t1: w.__t1 };
    });
    if (t0 !== null && t1 !== null) times.push(t1 - t0);
  }
  return {
    stars: times.length,
    median: round(percentile(times, 50)),
    p95: round(percentile(times, 95)),
    worst: round(Math.max(0, ...times)),
  };
}

/** Which bucket a timeline event's name belongs to. */
function bucketOf(name) {
  if (/^(FunctionCall|EvaluateScript|v8|V8|TimerFire|EventDispatch|RunMicrotasks|MajorGC|MinorGC|GCEvent|ProfileCall|RequestAnimationFrame|FireAnimationFrame)/.test(name)) return "scripting";
  if (/^(UpdateLayoutTree|Layout|InvalidateLayout|ScheduleStyleRecalculation|ParseAuthorStyleSheet|RecalculateStyles|ComputeIntersections)/.test(name)) return "style and layout";
  if (/^(Paint|PrePaint|UpdateLayer|Layerize|CompositeLayers|RasterTask|Commit|DecodeImage|PaintImage|ScrollLayer)/.test(name)) return "paint";
  if (/HitTest/.test(name)) return "hit testing";
  return "other";
}

/** Self time per bucket over a recorded pan: a nested event's time belongs
 * to the innermost event that was running, not to everything above it. */
function digestTrace(events) {
  const byThread = new Map();
  for (const e of events) {
    if (e.ph !== "X" && e.ph !== "B" && e.ph !== "E") continue;
    if (typeof e.ts !== "number") continue;
    const key = `${e.pid}/${e.tid}`;
    if (!byThread.has(key)) byThread.set(key, []);
    byThread.get(key).push(e);
  }
  const self = new Map();
  const byName = new Map();
  let total = 0;
  for (const list of byThread.values()) {
    const spans = [];
    const open = [];
    for (const e of [...list].sort((a, b) => a.ts - b.ts || (a.ph === "E" ? -1 : 1))) {
      if (e.ph === "X") spans.push({ name: e.name, start: e.ts, end: e.ts + (e.dur ?? 0) });
      else if (e.ph === "B") open.push(e);
      else if (e.ph === "E") {
        const b = open.pop();
        if (b) spans.push({ name: b.name, start: b.ts, end: e.ts });
      }
    }
    // outermost first at the same start, so a parent is always on the stack
    // before its children
    spans.sort((a, b) => a.start - b.start || b.end - a.end);
    const done = [];
    const stack = [];
    for (const s of spans) {
      while (stack.length && stack[stack.length - 1].end <= s.start) done.push(stack.pop());
      const parent = stack[stack.length - 1];
      if (parent) parent.child += Math.min(s.end, parent.end) - s.start;
      stack.push({ name: s.name, start: s.start, end: s.end, child: 0 });
    }
    while (stack.length) done.push(stack.pop());
    for (const n of done) {
      const own = Math.max(0, n.end - n.start - n.child) / 1000;
      const bucket = bucketOf(n.name);
      self.set(bucket, (self.get(bucket) ?? 0) + own);
      byName.set(n.name, (byName.get(n.name) ?? 0) + own);
      total += own;
    }
  }
  const rank = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, round(v)]);
  return { total: round(total), buckets: rank(self), names: rank(byName).slice(0, 12) };
}

/** Record one pan with the Chrome timeline on, and say where it went. */
async function tracedPan(page, box) {
  const cdp = await page.context().newCDPSession(page);
  const events = [];
  cdp.on("Tracing.dataCollected", ({ value }) => events.push(...value));
  await cdp.send("Tracing.start", {
    traceConfig: {
      recordMode: "recordAsMuchAsPossible",
      includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "blink.user_timing"],
    },
  });
  await pan(page, box);
  const finished = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
  await cdp.send("Tracing.end");
  await finished;
  await cdp.detach();
  return digestTrace(events);
}

/** One sky, at every zoom. */
async function sweep(page, say) {
  say("| zoom | asked | elements | hit circles | pan frames >32ms | pan p95 ms | pan worst ms | release ms | wheel >32ms | wheel p95 ms | tooltip median ms | tooltip p95 ms |");
  say("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  let smallest = null;
  for (const target of TARGETS) {
    const at = await zoomTo(page, target);
    await page.waitForTimeout(SETTLE);
    const box = await skyBox(page);
    smallest = box;
    const counts = await countElements(page);
    // a sky already against the clamp on one side cannot move that way, and
    // a gesture that moves nothing costs nothing, so the other way is tried
    let panned = await pan(page, box, -1);
    if (!panned.moved) {
      await page.waitForTimeout(SETTLE);
      panned = await pan(page, box, 1);
    }
    await page.waitForTimeout(SETTLE);
    const wheeled = await wheelZoom(page, box);
    await page.waitForTimeout(SETTLE);
    // the wheel and the pan both moved the sky, so put it back before the
    // stars are picked, or they would not be where they were measured
    await zoomTo(page, target);
    await page.waitForTimeout(SETTLE);
    const points = await starPoints(page);
    const tips = points.length ? await tooltipTimes(page, box, points) : { stars: 0, median: 0, p95: 0, worst: 0 };
    const pans = panned.moved ? `${panned.slow}/${panned.frames}` : "DID NOT MOVE";
    say(`| ${at}% | ${target}% | ${counts.drawn.toLocaleString()} | ${counts.hits.toLocaleString()} | ${pans} | ${panned.p95} | ${panned.worst} | ${panned.release} | ${wheeled.slow}/${wheeled.frames} | ${wheeled.p95} | ${tips.median} | ${tips.p95} |`);
  }
  return smallest;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const lines = [];
  const say = (s) => { lines.push(s); console.log(s); };

  await page.goto(`${BASE}/?sample`, { waitUntil: "networkidle" });
  await page.locator('svg[aria-label^="Every constellation"]').waitFor();
  // the sky settles its opening view in an effect, so give it a moment
  await page.waitForTimeout(2000);

  say(`# the Planetarium, zoomed out (SAK-411)`);
  say(`base ${BASE}, viewport 1440x900, ${new Date().toISOString()}`);
  say("");
  say("Headless Chromium draws as fast as it can rather than at 60Hz, so the");
  say("floor here is about 9ms rather than 16.7. What the numbers say is how");
  say("much work a frame costs, not what a monitor would show.");
  say("");
  if (!TRACE_ONLY) {
    say("## the sky as it opens: what the learner has discovered");
    say("");
    await sweep(page, say);
    say("");
  }

  say("## the whole sky: the Undiscovered chip on");
  say("");
  await zoomTo(page, 100);
  await page.getByRole("button", { name: /^Undiscovered/ }).first().click();
  await page.waitForTimeout(6000);
  const smallest = TRACE_ONLY ? await skyBox(page) : await sweep(page, say);

  if ((WANT_TRACE || TRACE_ONLY) && smallest) {
    await zoomTo(page, TARGETS[TARGETS.length - 1]);
    await page.waitForTimeout(SETTLE);
    const digest = await tracedPan(page, smallest);
    say("");
    say(`## where one pan at the smallest zoom of the whole sky goes (${digest.total} ms of self time)`);
    say("");
    say("| bucket | ms | share |");
    say("| --- | --- | --- |");
    for (const [name, ms] of digest.buckets) say(`| ${name} | ${ms} | ${Math.round((ms / (digest.total || 1)) * 100)}% |`);
    say("");
    say("| the work itself | ms |");
    say("| --- | --- |");
    for (const [name, ms] of digest.names) say(`| ${name} | ${ms} |`);
  }

  await browser.close();
  const out = flag("out", null);
  if (out) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(out, `${lines.join("\n")}\n`);
    console.log(`\nwritten to ${out}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
