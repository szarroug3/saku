// speechSynthesis helpers — Japanese voice discovery + speaking.
// Note: browsers only refresh the installed-voice list on a full restart,
// and Siri voices are never exposed to the web speech API.

import { isPackVoice, packAudioUrl } from "@/lib/voice-audio";

/**
 * The minimum a voice must carry to be chosen among. `SpeechSynthesisVoice`
 * has more, but `pickAutoVoice` reads only these, and typing the input this
 * thin is what lets it be tested with plain objects and no browser.
 */
export interface VoiceLike {
  readonly name: string;
  readonly lang?: string;
  /** Whether the voice runs on-device. A local voice can't fail offline, so a
   * real local voice is preferred over a real network one. */
  readonly localService?: boolean;
}

/**
 * macOS ships a set of multilingual NOVELTY voices that localise into ja-JP —
 * they read Japanese, they are jokes, and "Eddy" sorts first among ja-JP names,
 * which is exactly how "take the first voice" handed every learner Eddy over
 * Kyoko. These are the eight modern multilingual novelty names (Eddy, Flo,
 * Grandma, Grandpa, Reed, Rocko, Sandy, Shelley); the older classic novelty
 * voices (Albert, Bad News, Bubbles, Zarvox, ...) are English-only and would
 * not pass the ja-JP filter, but they are listed too so that if a future OS
 * localises one it is rejected here rather than shipped as a pronunciation
 * model. Matched on the BASE name (parentheticals stripped, lower-cased), so
 * "Eddy (Japanese (Japan))" and "Eddy" are the same exclusion.
 */
const NOVELTY_VOICES = new Set([
  // modern multilingual novelty set (these actually appear under ja-JP)
  "eddy",
  "flo",
  "grandma",
  "grandpa",
  "reed",
  "rocko",
  "sandy",
  "shelley",
  // classic English-only novelty voices, excluded defensively
  "albert",
  "bad news",
  "bahh",
  "bells",
  "boing",
  "bubbles",
  "cellos",
  "good news",
  "jester",
  "organ",
  "superstar",
  "trinoids",
  "whisper",
  "wobble",
  "zarvox",
  "junior",
  "kathy",
  "ralph",
  "fred",
]);

/**
 * Real Japanese voices we trust, best first — macOS's Kyoko and Otoya lead, then
 * the common Windows (Nanami, Keita, ...) and Chrome/Android ("Google 日本語")
 * names. This is a PREFERENCE, not a whitelist: an unknown non-novelty voice is
 * still eligible (it just sorts after these), so a machine with only a
 * third-party Japanese voice still degrades to it rather than to silence.
 */
const PREFERRED_VOICES = [
  "kyoko",
  "otoya",
  "google 日本語",
  "google japanese",
  "nanami",
  "keita",
  "ayumi",
  "haruka",
  "ichiro",
  "sayaka",
];

/** "Kyoko (Enhanced)" / "Otoya (Premium)" → "kyoko" / "otoya". */
function baseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .trim();
}

function isNovelty(v: VoiceLike): boolean {
  return NOVELTY_VOICES.has(baseName(v.name));
}

/** Higher is better: a Premium/Enhanced build of a voice beats its plain one. */
function qualityRank(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("premium")) return 2;
  if (n.includes("enhanced")) return 1;
  return 0;
}

/** The best of a set of same-name voices: local before network, then the
 * highest-quality build. */
function bestOf(list: VoiceLike[]): VoiceLike {
  return [...list].sort((a, b) => {
    const al = a.localService ?? true;
    const bl = b.localService ?? true;
    if (al !== bl) return al ? -1 : 1;
    return qualityRank(b.name) - qualityRank(a.name);
  })[0];
}

/**
 * Pick the voice "Auto" should use from a list of Japanese voices — a PURE
 * function so it can be tested with plain objects and no browser.
 *
 * The rule, in order:
 *   1. Never a novelty voice while a real one exists (the Eddy bug). Only if
 *      EVERY installed ja-JP voice is a novelty voice do we fall back to one,
 *      because a joke voice still beats no audio at all.
 *   2. A known-good voice, in PREFERRED_VOICES order (Kyoko, then Otoya, ...).
 *   3. Otherwise the best real voice on offer — an unknown non-novelty voice is
 *      still a real voice.
 * Among ties (a voice installed as both plain and Enhanced, local and network)
 * `bestOf` breaks it toward the local, higher-quality build.
 */
export function pickAutoVoice<T extends VoiceLike>(voices: T[]): T | undefined {
  if (!voices.length) return undefined;
  const real = voices.filter((v) => !isNovelty(v));
  const pool = real.length ? real : voices;
  for (const want of PREFERRED_VOICES) {
    const matches = pool.filter((v) => baseName(v.name) === want);
    if (matches.length) return bestOf(matches) as T;
  }
  return bestOf(pool) as T;
}

export function jaVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return speechSynthesis
    .getVoices()
    .filter((v) => v.lang?.replace("_", "-").toLowerCase().startsWith("ja"));
}

function speakNow(text: string, voiceName: string): void {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  const voices = jaVoices();
  // "Auto" ("") — or a saved voice that is no longer installed — resolves
  // through pickAutoVoice, which prefers a real Japanese voice and refuses the
  // novelty ones. `voices[0]` (alphabetical) is exactly what put Eddy here.
  const chosen =
    (voiceName && voices.find((v) => v.name === voiceName)) ||
    pickAutoVoice(voices);
  if (chosen) u.voice = chosen;
  u.rate = 0.8;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/** The pack clip currently playing, if any — stopped before the next one so two
 * rapid taps don't overlap (the speechSynthesis path does the same via
 * `speechSynthesis.cancel()`). */
let currentClip: HTMLAudioElement | null = null;

/**
 * Play a pack-voice clip from Storage, falling back to the browser voice if the
 * clip is missing, the network is down, or autoplay is blocked. `voiceName`
 * falls back to "" (Auto) so the browser path picks its own best voice rather
 * than looking for a browser voice named after the (nonexistent) pack.
 */
function speakPack(text: string, voiceId: string): void {
  const url = packAudioUrl(voiceId, text);
  if (!url) {
    speakBrowser(text, "");
    return;
  }
  if (currentClip) {
    currentClip.pause();
    currentClip = null;
  }
  // speechSynthesis and an <audio> clip are separate outputs; cancel any
  // in-flight utterance so a fallback from the previous card doesn't overlap.
  speechSynthesis.cancel();
  const clip = new Audio(url);
  currentClip = clip;
  let fellBack = false;
  const fallback = () => {
    if (fellBack) return;
    fellBack = true;
    if (currentClip === clip) currentClip = null;
    speakBrowser(text, "");
  };
  // A missing object (404) or a decode failure surfaces as `error`; autoplay
  // refusal rejects `play()`. Either way, drop to the browser voice.
  clip.addEventListener("error", fallback, { once: true });
  clip.play().catch(fallback);
}

/** Speak Japanese text with the configured voice ("" = auto). A pack voice
 * (see voice-audio.ts) plays a pre-generated clip; everything else goes through
 * speechSynthesis. */
export function speak(text: string, voiceName: string): void {
  if (typeof window === "undefined") return;
  if (isPackVoice(voiceName)) {
    speakPack(text, voiceName);
    return;
  }
  speakBrowser(text, voiceName);
}

/** The speechSynthesis path — the browser's own Japanese voice. */
function speakBrowser(text: string, voiceName: string): void {
  if (!("speechSynthesis" in window)) return;
  // Some browsers (notably Safari/WebKit) expose an empty voice list at first
  // interaction and hydrate it moments later via `voiceschanged`. Speaking
  // before hydration uses the browser fallback voice; replay then sounds
  // "different" once the real list appears. Defer one short tick for that
  // first call so both first play and replay use the same selected voice.
  if (speechSynthesis.getVoices().length === 0) {
    let fired = false;
    const done = () => {
      if (fired) return;
      fired = true;
      speechSynthesis.removeEventListener("voiceschanged", done);
      speakNow(text, voiceName);
    };
    speechSynthesis.addEventListener("voiceschanged", done);
    // Triggers hydration in engines that lazy-load voices on first query.
    speechSynthesis.getVoices();
    // Some engines never fire `voiceschanged`; still speak after a short wait.
    setTimeout(done, 120);
    return;
  }
  speakNow(text, voiceName);
}

/** Subscribe to voice-list changes; returns an unsubscribe. */
export function onVoicesChanged(fn: () => void): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return () => {};
  }
  speechSynthesis.addEventListener("voiceschanged", fn);
  return () => speechSynthesis.removeEventListener("voiceschanged", fn);
}
