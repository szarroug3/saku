import type { NextConfig } from "next";

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
};

export default nextConfig;
