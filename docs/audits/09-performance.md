# Audit 09: performance audit

Read `how-to-run-an-audit.md` in this folder first — this file only covers what's specific to this audit.

**Subject**: real load-time and interaction-latency measurement, especially true COLD-START conditions. Sam (2026-08-28): "the page still starts slow on cold start and stuff so i want it to audit that and independently verify it's not just me."

**Role**: a performance engineer.

## Why this one, despite existing automated coverage

`e2e/page-load-performance.spec.ts` already measures load times across real pages with pass/fail budgets, and `scripts/route_sizes.mjs` already computes per-route JS bundle size from the build's client-reference manifests. Neither currently targets true cold-start conditions specifically — the e2e suite doesn't test cold-vs-warm as a variable at all, which is exactly the condition Sam is describing and exactly the kind of thing that's easy to miss when a developer's own iterative testing runs against an already-warm cache. This audit's first job is figuring out WHY the existing coverage isn't catching what she's feeling, not assuming from scratch that nothing exists.

## Distinguish CLIENT cold start from SERVER cold start — different causes, different fixes

- **Client-side**: JS bundle size and hydration cost on a genuinely fresh page load — no cached chunks, no warmed-up runtime. `route_sizes.mjs` is a real head start here; there's already a known, named instance of this problem (`/learn` shipping ~8.6MB it never renders, per the perf-learn-bundle refactor plan, not yet done).
- **Server-side**: a cold serverless function boot, a cold database connection, a cold external-service call. Invisible to a bundle-size check — needs actual request-timing measurement, ideally after a real idle period, not back-to-back requests that keep everything warm.

## What to check

- Reproduce genuinely cold conditions per measurement — a fresh incognito/private session with a cleared cache for client cold start; for server cold start, space measurements apart in time rather than hammering requests that keep the server warm as a side effect of testing it.
- Measure client and server cold start SEPARATELY, reported separately — they point at different fixes, don't collapse them into one "the page felt slow" number.
- Check whether `page-load-performance.spec.ts`'s existing budgets are actually calibrated to catch this, or lenient enough that a real regression could pass, and whether it's testing warm-cache conditions by construction.

## Verify technique — this IS the audit's own core mechanic

"Independently verify it's not just me" means: don't trust a single measurement from a single environment as proof either way. Measure from more than one condition (different network-throttle profile, a genuinely separate run rather than repeated runs in the same warmed-up session), and have a SECOND, independent pass reproduce the same slow numbers before concluding it's a real, general problem. If the second pass doesn't reproduce it, THAT is the finding — report the discrepancy, don't just keep whichever result matches the initial impression.

## Execution note

Mix of live browser measurement (real cold-condition timing) and reading existing tooling (`page-load-performance.spec.ts`, `route_sizes.mjs`, the build output) — split naturally into a client-cold-start agent and a server-cold-start agent. Needs live browser tools and a running dev server for the measurement half.
