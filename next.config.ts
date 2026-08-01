import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A production E2E build may run while the maintainer has `pnpm dev` open.
  // Keeping that build out of `.next` prevents it from replacing the dev
  // server's client chunks mid-session and leaving client-only UI (notably the
  // Library docks) unable to hydrate.
  ...(process.env.NEXT_DIST_DIR
    ? { distDir: process.env.NEXT_DIST_DIR }
    : {}),
};

export default nextConfig;
