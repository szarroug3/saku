import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Multiple independent reports (vercel/next.js discussions #47293, #55228)
  // say `outputFileTracingIncludes` is silently NOT applied on Vercel without
  // this — matches our exact symptom: the binary is correctly listed in
  // .next/server/**/route.js.nft.json locally, but ENOENTs at runtime on
  // Vercel. Trying this as the fix for SAK-108's still-failing ffmpeg include.
  output: "standalone",

  // A production E2E build may run while the maintainer has `pnpm dev` open.
  // Keeping that build out of `.next` prevents it from replacing the dev
  // server's client chunks mid-session and leaving client-only UI (notably the
  // Library docks) unable to hydrate.
  ...(process.env.NEXT_DIST_DIR
    ? { distDir: process.env.NEXT_DIST_DIR }
    : {}),

  // SAK-108: /api/tts and /api/pitch-tts shell out to ffmpeg (audio-compress.ts)
  // via the `ffmpeg-static` package. Next's file tracer only follows
  // `require`/`import` calls to build each route's deployed bundle — it can't
  // see that ffmpeg-static's index.js points at a sibling *binary* file on
  // disk at runtime, so without this the binary silently doesn't ship to
  // Vercel and the routes 502/fall back exactly as before. Force-include it
  // for both routes explicitly.
  outputFileTracingIncludes: {
    "/api/tts/**": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/pitch-tts/**": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;
