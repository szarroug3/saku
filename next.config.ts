import type { NextConfig } from "next";
import createBundleAnalyzer from "@next/bundle-analyzer";

// SAK-188: build-time bundle composition, gated behind an env flag so it never
// runs on a normal build. `ANALYZE=true pnpm build` writes an HTML treemap per
// bundle (client/nodejs/edge) to `<distDir>/analyze/` instead of the usual
// build output.
const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // A production E2E build may run while the maintainer has `pnpm dev` open.
  // Keeping that build out of `.next` prevents it from replacing the dev
  // server's client chunks mid-session and leaving client-only UI (notably the
  // Library docks) unable to hydrate.
  ...(process.env.NEXT_DIST_DIR
    ? { distDir: process.env.NEXT_DIST_DIR }
    : {}),

  // SAK-108, attempt 3: /api/tts and /api/pitch-tts shell out to ffmpeg
  // (audio-compress.ts). Pointing this at ffmpeg-static's own node_modules
  // path (attempts 1 & 2) ENOENT'd in prod despite being correctly listed in
  // Next's own .nft.json trace — a third-party package's dynamically-computed
  // path is exactly what Next's tracer is documented to handle unreliably.
  // scripts/copy-ffmpeg-binary.mjs (prebuild) now materializes the binary at
  // this fixed, literal path first — audio-compress.ts references the SAME
  // literal path, so there is nothing dynamic left for either the tracer or
  // the runtime code to get wrong.
  outputFileTracingIncludes: {
    "/api/tts/**": ["./bin/ffmpeg"],
    "/api/pitch-tts/**": ["./bin/ffmpeg"],
  },

  // SAK-125: several Server Actions in src/lib/library/server-lookups.ts
  // (getQuizzableFacts, resolveWeakestFacts, getComponentUses,
  // getKnownWordsUsing, getActiveMixupEntries, resolveLessonSteps) take a
  // learner's `history` as a literal Server Action argument, and that
  // argument IS the request body Next measures against its default 1MB
  // Server Action limit. Reproduced directly: a real e2e run's captured
  // network trace showed a Server Action call carrying `seen` alone with
  // 16,402/26,758 curriculum facts (src/data/generated/learn-index.json) at
  // ~1.2MB — already over the default before `facts`/`claims`/`learnedAt`
  // are even counted — and the server log showed the resulting 413 twice in
  // that same run.
  //
  // getLearnFrontier, the action this ticket started on, no longer has this
  // problem for a SIGNED-IN learner at all — server-lookups.ts's own
  // signedInSlice reads their known-set straight from Supabase server-side
  // instead of receiving it as an argument, so nothing crosses the wire for
  // that path (see that function's header, and its `facts` was separately
  // trimmed to just `{stability, lastTested}` per fact for the SIGNED-OUT
  // path, which still has to send something). What THIS number bounds is:
  // (a) a signed-out learner's own known-set (localStorage is the only
  // source of truth there, so it must still be sent), and (b) the sibling
  // actions above, which still take the full, untrimmed HistoryFile and
  // have no slice to trim down to, for EITHER a signed-in or signed-out
  // caller.
  //
  // Grounded in the curriculum's real fact count (26,758, from
  // learn-index.json) rather than a guess: a known-set can never exceed
  // roughly one record per curriculum fact. At ~73 bytes/entry (the actual
  // measured rate from the trace above), a signed-out learner who has
  // touched literally every fact across `seen`+`claims`+`learnedAt`
  // (~2MB apiece) plus the trimmed `facts` slice (~1.9MB) tops out around
  // ~7.8MB. 10MB leaves real headroom above that computed ceiling — not
  // "exactly at the line" — while staying a deliberate, bounded number
  // rather than an arbitrarily large escape hatch.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default withBundleAnalyzer(nextConfig);
