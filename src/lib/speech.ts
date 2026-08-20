// speechSynthesis helpers — Japanese voice discovery + speaking.
// Note: browsers only refresh the installed-voice list on a full restart,
// and Siri voices are never exposed to the web speech API.

import { isVoiceId, voiceApiUrl, voiceAudioUrl, voicesEnabled } from "@/lib/voice";

/**
 * Duplicate-speak guard for intermittent double-trigger races.
 *
 * Listening cards should auto-play once when shown, but in rare lifecycle races
 * (remount + hydration timing, duplicate effect fire, etc.) the same
 * voice+text request can be issued twice within a few milliseconds, which
 * sounds like overlapping speech. This guard drops only near-instant repeats;
 * normal replay taps remain unaffected.
 */
const SPEAK_DEDUPE_MS = 250;
let lastSpeakKey = "";
let lastSpeakAt = 0;

function shouldSkipDuplicateSpeak(text: string, voiceName: string): boolean {
  const now = Date.now();
  const key = `${voiceName}\u0000${text}`;
  if (key === lastSpeakKey && now - lastSpeakAt < SPEAK_DEDUPE_MS) return true;
  lastSpeakKey = key;
  lastSpeakAt = now;
  return false;
}

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

/** The roster-voice clip currently playing, if any — stopped before the next
 * one so two rapid taps don't overlap (the speechSynthesis path does the same
 * via `speechSynthesis.cancel()`). */
let currentClip: HTMLAudioElement | null = null;

/** Clips warmed this session, so a second hover/tap on the same word doesn't
 * re-fetch. A prefetch that fails drops back out so a later attempt can retry. */
const prefetched = new Set<string>();

/**
 * Warm a roster-voice clip before it is played — call it on HOVER/FOCUS of a
 * Hear button, not on mount, so only the clip a pointer is aiming at is
 * fetched (a dense page does not fire a hundred synth requests at VOICEVOX at
 * once).
 *
 * If the CDN object is already there (every kana, or a word heard before) the
 * GET just fills the browser cache; if it is not (an on-demand word or
 * sentence) this hits /api/tts to synthesize and cache it, so the synthesis is
 * paid while the pointer is still travelling rather than on the click.
 * Fire-and-forget, silent on failure, and a no-op unless the roster is
 * configured and `voiceName` names one of its voices.
 */
async function warmOne(text: string, voiceName: string): Promise<void> {
  if (!text || !isVoiceId(voiceName) || !voicesEnabled()) return;
  const key = `${voiceName} ${text}`;
  if (prefetched.has(key)) return;
  prefetched.add(key);
  const cdn = voiceAudioUrl(voiceName, text);
  const api = voiceApiUrl(voiceName, text);
  try {
    if (cdn) {
      const hit = await fetch(cdn);
      if (hit.ok) return; // seeded already; the browser has cached it now
    }
    if (api) await fetch(api); // synthesize + cache (miss), or 302 (hit)
  } catch {
    prefetched.delete(key); // let a later attempt retry
  }
}

export function prefetchClip(text: string, voiceName: string): void {
  if (typeof window === "undefined") return;
  void warmOne(text, voiceName);
}

// A small rate-limited queue for warming MANY clips at once — a quiz priming
// every word it will speak. At most MAX_WARMING run together, so a long deck
// does not fire fifty synth requests at VOICEVOX in one burst; the rest wait
// their turn and trickle in while the learner works through the earlier cards.
const warmQueue: Array<() => Promise<void>> = [];
let warming = 0;
const MAX_WARMING = 2;
function pumpWarmQueue(): void {
  while (warming < MAX_WARMING && warmQueue.length) {
    const job = warmQueue.shift()!;
    warming += 1;
    void job().finally(() => {
      warming -= 1;
      pumpWarmQueue();
    });
  }
}

/**
 * Warm a batch of clips through the rate-limited queue — call at the start of a
 * quiz with every word it will speak, so each is ready before its card comes up.
 * Deduped and gated exactly like prefetchClip (already-warm clips are skipped for
 * free), so calling it again with an overlapping set costs nothing extra.
 */
export function prefetchClips(texts: readonly string[], voiceName: string): void {
  if (typeof window === "undefined") return;
  if (!isVoiceId(voiceName) || !voicesEnabled()) return;
  const seen = new Set<string>();
  for (const text of texts) {
    if (!text || seen.has(text)) continue;
    seen.add(text);
    warmQueue.push(() => warmOne(text, voiceName));
  }
  pumpWarmQueue();
}

/**
 * Play a roster-voice clip (VOICEVOX, pitch-corrected — see
 * src/lib/tts-synth.ts), in two tiers, falling back to the browser voice last.
 *
 *   1. The CDN object (voiceAudioUrl) — instant for anything already cached
 *      (all kana, plus any word or sentence heard before).
 *   2. /api/tts (voiceApiUrl) — the on-demand route: it synthesizes a missing
 *      clip with VOICEVOX, caches it into the bucket, and returns it, so the
 *      next play is a tier-1 hit. Only reached when tier 1 404s.
 *   3. The browser's own Japanese voice — when neither is available (offline,
 *      unconfigured, autoplay blocked).
 *
 * Each `<audio>` reports a 404/decode failure via `error` and an autoplay refusal
 * via a rejected `play()`; either advances to the next tier. Tiers run inside the
 * click's sticky activation, so the tier-2 play is still allowed to make sound.
 */
function speakRoster(text: string, voiceId: string): void {
  const tiers = [voiceAudioUrl(voiceId, text), voiceApiUrl(voiceId, text)].filter(
    (u): u is string => !!u,
  );
  if (currentClip) {
    currentClip.pause();
    currentClip = null;
  }
  // speechSynthesis and an <audio> clip are separate outputs; cancel any
  // in-flight utterance so a fallback from the previous card doesn't overlap.
  speechSynthesis.cancel();
  const playFrom = (i: number): void => {
    if (i >= tiers.length) {
      speakBrowser(text, "");
      return;
    }
    const clip = new Audio(tiers[i]);
    currentClip = clip;
    let advanced = false;
    const next = () => {
      if (advanced) return;
      advanced = true;
      if (currentClip === clip) currentClip = null;
      playFrom(i + 1);
    };
    clip.addEventListener("error", next, { once: true });
    clip.play().catch(next);
  };
  playFrom(0);
}

/** Speak Japanese text with the configured voice ("" = auto). A roster voice
 * (see voice.ts) plays a VOICEVOX clip, pitch-corrected where the sentence
 * matches the Kanjium data; everything else goes through speechSynthesis. */
export function speak(text: string, voiceName: string): void {
  if (typeof window === "undefined") return;
  // Automation/e2e browsers set navigator.webdriver (Playwright does). No test
  // asserts speech actually plays — the listening specs only check the speaker
  // button and hidden-glyph behaviour — so silencing it keeps unattended e2e
  // runs quiet without affecting real users (real browsers leave webdriver false).
  if (typeof navigator !== "undefined" && navigator.webdriver) return;
  if (shouldSkipDuplicateSpeak(text, voiceName)) return;
  // Only take the roster path when it's actually configured (bucket set); a
  // roster voice selected without a bucket just uses the browser voice, no
  // dead request.
  if (isVoiceId(voiceName) && voicesEnabled()) {
    speakRoster(text, voiceName);
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
