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
// Server-only: shells out to an ffmpeg binary via child_process. Resolves the
// binary via `ffmpeg-static` (SAK-108) rather than assuming a bare "ffmpeg"
// is on $PATH: Vercel's Node serverless runtime does not bundle system
// binaries, so `spawn("ffmpeg", ...)` had nothing to run in the deployed
// function even though it worked fine locally/in agent sandboxes (Homebrew
// ffmpeg on PATH there). ffmpeg-static downloads a platform-matched static
// binary at `pnpm install` time — on Vercel that's the linux-x64 build,
// matching the serverless runtime — and next.config.ts's
// outputFileTracingIncludes makes sure that binary file actually ships in
// the deployed function bundle (Next's file tracer only follows `require`
// calls, not the binary ffmpeg-static's index.js points at on disk). Falls
// back to a bare "ffmpeg" on $PATH if ffmpeg-static has no build for the
// current platform/arch (its `require` resolves to null in that case).

import { spawn } from "node:child_process";

import ffmpegStaticPath from "ffmpeg-static";

/** Resolved once at module load: ffmpeg-static's platform binary, or the bare
 * command name as a last-resort fallback (e.g. an unsupported arch, or a dev
 * environment where the package's install script didn't run). */
const FFMPEG_BIN = ffmpegStaticPath ?? "ffmpeg";

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
