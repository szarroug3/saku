#!/usr/bin/env node
// Optimize + register kana mnemonic images — the self-service pipeline.
//
// WHAT IT DOES
// ============
// Run `pnpm mnemonic-images`. For every `<romaji>.png` in the source dir
// (default ~/Downloads/kana) whose name is a real hiragana romaji, it:
//   1. checks the PNG has REAL transparency (transparent pixels, not just an
//      all-opaque alpha channel) — opaque ones are skipped with a warning so
//      you know to re-export them cut out;
//   2. optimizes it into public/mnemonics/<romaji>.webp (360px long edge,
//      WebP q82), overwriting any prior copy.
// That's it — no registry, no manifest. The app derives the candidate path
// /mnemonics/<romaji>.webp for every kana and shows the picture when the file
// exists, so dropping the webp in public/mnemonics IS the registration.
//
// It edits no data table and no test. Safe to run repeatedly — same inputs
// produce the same outputs.
//
// SOURCE DIR: arg 1, or $KANA_SOURCE_DIR, or ~/Downloads/kana.
//   pnpm mnemonic-images                 # ~/Downloads/kana
//   pnpm mnemonic-images ~/Desktop/kana  # explicit
//   KANA_SOURCE_DIR=/tmp/foo pnpm mnemonic-images
//
// Requires ImageMagick's `magick` on PATH (brew install imagemagick).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---- Paths -----------------------------------------------------------------

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const PUBLIC_DIR = join(REPO_ROOT, "public", "mnemonics");

const DEFAULT_SOURCE = join(homedir(), "Downloads", "kana");
const SOURCE_DIR = resolve(process.argv[2] ?? process.env.KANA_SOURCE_DIR ?? DEFAULT_SOURCE);

// ---- The valid names -------------------------------------------------------

// Every base-hiragana romaji, in the spelling the mnemonics table uses (shi /
// chi / tsu / fu / wo). A source PNG must be named `<one of these>.png`; any
// other basename is ignored (it isn't a kana we teach).
const VALID_ROMAJI = new Set([
  "a", "i", "u", "e", "o",
  "ka", "ki", "ku", "ke", "ko",
  "sa", "shi", "su", "se", "so",
  "ta", "chi", "tsu", "te", "to",
  "na", "ni", "nu", "ne", "no",
  "ha", "hi", "fu", "he", "ho",
  "ma", "mi", "mu", "me", "mo",
  "ya", "yu", "yo",
  "ra", "ri", "ru", "re", "ro",
  "wa", "wo", "n",
]);

// ---- magick helpers --------------------------------------------------------

function magick(args) {
  return execFileSync("magick", args, { encoding: "utf-8" }).trim();
}

function ensureMagick() {
  try {
    magick(["-version"]);
  } catch {
    console.error(
      "error: ImageMagick's `magick` was not found on PATH.\n" +
        "       Install it with:  brew install imagemagick",
    );
    process.exit(1);
  }
}

// True when the PNG has at least one transparent pixel. `%[opaque]` is "True"
// for a flat image OR one whose alpha channel is present but all-255 — exactly
// the cases we want to reject — and "False" only when real transparency exists.
function hasRealTransparency(pngPath) {
  const opaque = magick(["identify", "-format", "%[opaque]", pngPath]);
  return opaque.toLowerCase() === "false";
}

// ---- The run ---------------------------------------------------------------

function main() {
  ensureMagick();

  if (!existsSync(SOURCE_DIR)) {
    console.error(
      `error: source dir not found: ${SOURCE_DIR}\n` +
        `       Create it and drop <romaji>.png files in, or pass a path:\n` +
        `         pnpm mnemonic-images /path/to/kana`,
    );
    process.exit(1);
  }

  mkdirSync(PUBLIC_DIR, { recursive: true });

  const pngs = readdirSync(SOURCE_DIR)
    .filter((f) => extname(f).toLowerCase() === ".png")
    .sort();

  const written = []; // { romaji }
  const skippedOpaque = []; // { file }
  const skippedName = []; // file (basename not a romaji)

  for (const file of pngs) {
    const romaji = basename(file, extname(file));
    if (!VALID_ROMAJI.has(romaji)) {
      skippedName.push(file);
      continue;
    }
    const src = join(SOURCE_DIR, file);

    if (!hasRealTransparency(src)) {
      skippedOpaque.push({ file });
      continue;
    }

    const out = join(PUBLIC_DIR, `${romaji}.webp`);
    // Resize to 360px on the long edge (never upscale), preserve alpha, WebP q82.
    magick([
      src,
      "-resize", "360x360>",
      "-quality", "82",
      "-define", "webp:alpha-quality=100",
      out,
    ]);
    written.push({ romaji });
  }

  // ---- Summary -------------------------------------------------------------

  console.log(`\nSource: ${SOURCE_DIR}`);
  console.log(`Output: ${PUBLIC_DIR}\n`);

  if (written.length) {
    console.log(`Optimized ${written.length} image(s) → public/mnemonics/:`);
    for (const { romaji } of written) console.log(`  ✓ ${romaji}.webp`);
  } else {
    console.log("No images optimized this run.");
  }

  if (skippedOpaque.length) {
    console.log(
      `\nSkipped ${skippedOpaque.length} PNG(s) with NO transparency ` +
        `(re-export cut out, on a transparent background):`,
    );
    for (const { file } of skippedOpaque) console.log(`  ⚠ ${file}`);
  }

  if (skippedName.length) {
    console.log(`\nIgnored ${skippedName.length} PNG(s) not named after a kana romaji:`);
    for (const file of skippedName) console.log(`  · ${file}`);
  }

  // What the app will now show, straight from disk — no manifest to keep in sync.
  const present = readdirSync(PUBLIC_DIR)
    .filter((f) => extname(f).toLowerCase() === ".webp")
    .map((f) => basename(f, extname(f)))
    .filter((name) => VALID_ROMAJI.has(name))
    .sort();
  console.log(
    `\npublic/mnemonics now holds ${present.length} drawn kana: ` +
      `${present.join(", ") || "(none)"}\n`,
  );
}

main();
