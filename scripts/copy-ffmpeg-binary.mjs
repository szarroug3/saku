// Copies ffmpeg-static's platform binary to a FIXED, LITERAL path (bin/ffmpeg)
// before every build, so audio-compress.ts can reference it with a static
// string instead of ffmpeg-static's own dynamic (__dirname-based) resolution.
//
// SAK-108's second attempt (outputFileTracingIncludes pointed straight at
// ffmpeg-static's node_modules path, with and without output:"standalone")
// still ENOENT'd in prod: the file was correctly listed in Next's own
// .nft.json trace, but never actually shipped in the deployed function.
// That dynamic resolution is the common thread across both failures — Next's
// file tracer is documented to be unreliable at following a package's own
// runtime path computation (path.join(__dirname, ...) + an os.platform()
// check) through pnpm's nested .pnpm symlink structure. A literal,
// build-time-materialized path removes that guesswork entirely: there is
// nothing dynamic left for the tracer to get wrong.
//
// Not committed (bin/ is gitignored) — this runs fresh on every build,
// including Vercel's, so it always gets the right platform's binary (Vercel
// downloads the linux-x64 ffmpeg-static build during its own `pnpm install`,
// same as it already did for the two earlier attempts).

import { copyFileSync, chmodSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ffmpegStaticPath from "ffmpeg-static";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEST_DIR = join(ROOT, "bin");
const DEST = join(DEST_DIR, "ffmpeg");

if (!ffmpegStaticPath) {
  // No build for the current platform/arch — audio-compress.ts falls back to
  // a bare "ffmpeg" on $PATH in this case, same as before. Nothing to copy.
  console.warn("copy-ffmpeg-binary: ffmpeg-static has no build for this platform, skipping");
  process.exit(0);
}

mkdirSync(DEST_DIR, { recursive: true });
copyFileSync(ffmpegStaticPath, DEST);
chmodSync(DEST, 0o755);
console.log(`copy-ffmpeg-binary: ${ffmpegStaticPath} -> ${DEST}`);
