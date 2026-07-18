#!/usr/bin/env node
// Optimize + register kana mnemonic images — the self-service pipeline.
//
// WHAT IT DOES
// ============
// Run `pnpm mnemonic-images`. The source dir (default ~/Downloads/kana) holds
// two subfolders, `hiragana/` and `katakana/`. For every `<romaji>.png` in each
// whose name is a real kana romaji, it:
//   1. checks the PNG has REAL transparency (transparent pixels, not just an
//      all-opaque alpha channel) — opaque ones are skipped with a warning so
//      you know to re-export them cut out;
//   2. optimizes it into public/mnemonics/<script>/<romaji>.webp (512px long
//      edge, WebP q82), overwriting any prior copy.
// Splitting by script is what keeps か and カ (both romaji "ka") from colliding
// on one filename. That's it — no registry, no manifest. The app derives the
// candidate path /mnemonics/<script>/<romaji>.webp for every kana and shows the
// picture when the file exists, so dropping the webp in public/mnemonics/<script>
// IS the registration.
//
// A romaji filename alone can't say hiragana vs katakana ("ka" is both), so a
// loose PNG sitting directly in the source dir (the OLD flat layout) can't be
// placed — the run prints a clear warning telling you to move it into
// `hiragana/` or `katakana/`.
//
// It edits no data table and no test. Safe to run repeatedly — same inputs
// produce the same outputs.
//
// SOURCE DIR: arg 1, or $KANA_SOURCE_DIR, or ~/Downloads/kana. It must contain
// `hiragana/` and/or `katakana/` subfolders holding the PNGs.
//   pnpm mnemonic-images                 # ~/Downloads/kana/{hiragana,katakana}
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

// The scripts we split storage by, and the subfolder each lives in — both under
// the source dir (input PNGs) and public/mnemonics (output webp).
const SCRIPTS = ["hiragana", "katakana"];

// Every base-kana romaji, in the spelling the mnemonics table uses (shi / chi /
// tsu / fu / wo). The same 46 readings name both syllabaries. A source PNG must
// be named `<one of these>.png`; any other basename is ignored (it isn't a kana
// we teach).
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
        `       Create it with hiragana/ and katakana/ subfolders and drop\n` +
        `       <romaji>.png files in, or pass a path:\n` +
        `         pnpm mnemonic-images /path/to/kana`,
    );
    process.exit(1);
  }

  const written = []; // { script, romaji }
  const skippedOpaque = []; // { script, file }
  const skippedName = []; // { script, file } (basename not a romaji)

  for (const script of SCRIPTS) {
    const srcDir = join(SOURCE_DIR, script);
    if (!existsSync(srcDir)) continue; // that syllabary just has no drawings yet

    const outDir = join(PUBLIC_DIR, script);
    mkdirSync(outDir, { recursive: true });

    const pngs = readdirSync(srcDir)
      .filter((f) => extname(f).toLowerCase() === ".png")
      .sort();

    for (const file of pngs) {
      const romaji = basename(file, extname(file));
      if (!VALID_ROMAJI.has(romaji)) {
        skippedName.push({ script, file });
        continue;
      }
      const src = join(srcDir, file);

      if (!hasRealTransparency(src)) {
        skippedOpaque.push({ script, file });
        continue;
      }

      const out = join(outDir, `${romaji}.webp`);
      // Resize to 512px on the long edge (never upscale), preserve alpha, WebP q82.
      magick([
        src,
        "-resize", "512x512>",
        "-quality", "82",
        "-define", "webp:alpha-quality=100",
        out,
      ]);
      written.push({ script, romaji });
    }
  }

  // Loose PNGs sitting DIRECTLY in the source dir are the old flat layout. Their
  // romaji filename can't say hiragana vs katakana, so we can't place them — warn
  // rather than silently miss them.
  const loosePngs = readdirSync(SOURCE_DIR)
    .filter((f) => extname(f).toLowerCase() === ".png")
    .sort();

  // ---- Summary -------------------------------------------------------------

  console.log(`\nSource: ${SOURCE_DIR}`);
  console.log(`Output: ${PUBLIC_DIR}\n`);

  if (written.length) {
    console.log(`Optimized ${written.length} image(s) → public/mnemonics/<script>/:`);
    for (const { script, romaji } of written) console.log(`  ✓ ${script}/${romaji}.webp`);
  } else {
    console.log("No images optimized this run.");
  }

  if (skippedOpaque.length) {
    console.log(
      `\nSkipped ${skippedOpaque.length} PNG(s) with NO transparency ` +
        `(re-export cut out, on a transparent background):`,
    );
    for (const { script, file } of skippedOpaque) console.log(`  ⚠ ${script}/${file}`);
  }

  if (skippedName.length) {
    console.log(`\nIgnored ${skippedName.length} PNG(s) not named after a kana romaji:`);
    for (const { script, file } of skippedName) console.log(`  · ${script}/${file}`);
  }

  if (loosePngs.length) {
    console.log(
      `\n⚠ ${loosePngs.length} loose PNG(s) sit directly in ${SOURCE_DIR} ` +
        `(old flat layout) and were NOT processed.\n` +
        `  A romaji filename alone can't say which syllabary, so move each into\n` +
        `  the hiragana/ or katakana/ subfolder:`,
    );
    for (const file of loosePngs) console.log(`  ! ${file}`);
  }

  // What the app will now show, straight from disk — no manifest to keep in sync.
  for (const script of SCRIPTS) {
    const outDir = join(PUBLIC_DIR, script);
    const present = existsSync(outDir)
      ? readdirSync(outDir)
          .filter((f) => extname(f).toLowerCase() === ".webp")
          .map((f) => basename(f, extname(f)))
          .filter((name) => VALID_ROMAJI.has(name))
          .sort()
      : [];
    console.log(
      `\npublic/mnemonics/${script} now holds ${present.length} drawn kana: ` +
        `${present.join(", ") || "(none)"}`,
    );
  }
  console.log("");
}

main();
