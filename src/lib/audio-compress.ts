// WAV → Opus, the one encode step every audio writer in the app shares — the
// live /api/tts and /api/pitch-tts routes (a cache miss) and the bulk
// scripts/seed-voice-audio.mjs pre-seed job alike. One implementation so the
// two paths can never disagree about what format lives at a given
// voiceObjectPath/pitchObjectPath.
//
// WHY OPUS, WHY 24kbps. VOICEVOX's /synthesis returns raw 24kHz/16-bit/mono
// WAV — ~48KB/sec, uncompressed. Pre-seeding the whole speakable surface
// (kana, on/kun readings, every word, the full sentence corpus) across the
// 6-voice roster projected to ~11GB of that, well past Supabase's free-tier
// storage. Opus is a codec built for speech; at 24kbps (the same ballpark as
// Discord/WhatsApp voice calls) it is real, lossy, perceptual compression —
// not just a lower sample rate — and measured ~16x smaller with no audible
// quality loss Sam could hear across the 6-voice roster (a real side-by-side
// was done before committing to this). That brings the same corpus to well
// under 1GB.
//
// Server-only: shells out to an ffmpeg binary via child_process.
//
// SAK-108, attempt 3. Attempts 1 and 2 both resolved the binary via
// `ffmpeg-static`'s own dynamic path (path.join(__dirname, ...) + an
// os.platform() check) and tried to get Next to ship it with
// outputFileTracingIncludes (with, then without, output:"standalone"). Both
// ENOENT'd identically in prod: the file was correctly listed in Next's own
// .nft.json trace but never actually landed in the deployed function. A
// third-party package's runtime-computed path through pnpm's nested .pnpm
// symlink structure is exactly the case Next's file tracer is documented to
// get wrong.
//
// So this attempt removes the dynamic resolution entirely.
// scripts/copy-ffmpeg-binary.mjs (wired into the `prebuild` step) copies
// ffmpeg-static's resolved binary to a FIXED, LITERAL path — bin/ffmpeg —
// before every build, including Vercel's. Referencing that literal string
// (not a package's internal path math) is the pattern Next's tracer handles
// reliably. Falls back to ffmpeg-static's own resolution, then a bare
// "ffmpeg" on $PATH, for a local dev environment where `prebuild` (a
// `next build`-only hook) hasn't run.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import ffmpegStaticPath from "ffmpeg-static";

const COPIED_BIN = join(process.cwd(), "bin", "ffmpeg");

/** Resolved once at module load: the build-time-copied literal-path binary if
 * present, else ffmpeg-static's own resolution, else the bare command name as
 * a last-resort fallback (e.g. an unsupported arch). */
const FFMPEG_BIN = existsSync(COPIED_BIN) ? COPIED_BIN : (ffmpegStaticPath ?? "ffmpeg");

/** Real speech-call quality (Discord/WhatsApp territory) verified by ear
 * against the raw WAV across the whole voice roster before picking this —
 * not a guess. Bumping it trades size for headroom if a future voice sounds
 * worse than the ones tested. */
const OPUS_BITRATE_KBPS = 24;

/** The Content-Type every Opus clip is uploaded and served with — Ogg is the
 * container ffmpeg's `-f ogg` produces around the Opus stream. */
export const AUDIO_CONTENT_TYPE = "audio/ogg";

/**
 * WAV bytes → Ogg Opus bytes at OPUS_BITRATE_KBPS, via a piped `ffmpeg`
 * subprocess (stdin: WAV, stdout: Ogg Opus — no temp files). Rejects if
 * ffmpeg is missing or exits non-zero, carrying its stderr so a caller can
 * tell "not installed" apart from "bad input".
 */
export function encodeOpus(wavBytes: ArrayBuffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_BIN, [
      "-y",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-c:a", "libopus",
      "-b:a", `${OPUS_BITRATE_KBPS}k`,
      "-f", "ogg",
      "pipe:1",
    ]);

    const chunks: Buffer[] = [];
    let stderr = "";
    ff.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    ff.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    ff.on("error", (err) => reject(new Error(`ffmpeg not runnable: ${err.message}`)));
    ff.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.trim()}`));
    });

    ff.stdin.write(Buffer.from(wavBytes));
    ff.stdin.end();
  });
}
