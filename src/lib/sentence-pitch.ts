// Sentence-level pitch-accent matching (SAK-100) — the engine behind giving a
// FULL utterance (a quiz sentence, a listening prompt, any Hear button) the
// same per-word pitch correction that used to exist only for a single word on
// the Library page (SAK-98/99).
//
// THE IDEA
// ========
// VOICEVOX's /audio_query already segments any input text — one word or a
// whole sentence — into `accent_phrases[]`, each carrying its own `moras[]`
// (kana `text` + a `pitch` float). For a sentence this is the SAME structure
// pitch-tts-synth.ts (now folded into tts-synth.ts) already hand-edits for a
// single word; a sentence just yields several phrases instead of one.
//
// For each accent phrase, this module reconstructs its kana reading and looks
// it up against the Kanjium pitch data (src/data/pitch.ts, ingested from the
// same source SAK-98 used). A phrase's reading will not always match exactly —
// VOICEVOX often bundles a content word with a trailing particle or auxiliary
// the dictionary doesn't cover — so the match tries the full phrase reading
// first, then progressively SHORTER prefixes (trimming from the end, one
// VOICEVOX mora at a time), on the theory that the content word sits at the
// front of the phrase and whatever trails it is grammatical glue. The FIRST
// prefix that hits the dictionary wins, and only THAT many leading morae get
// their pitch overwritten — whatever trails stays exactly as VOICEVOX computed
// it. No match at any length ⇒ the whole phrase is left untouched.
//
// This is a best-effort heuristic, not a parser: a phrase spanning more than
// one dictionary word (rare) or a reading genuinely absent from Kanjium simply
// gets no correction. That is the same "absent is a normal answer, don't
// guess-fill" discipline src/data/pitch.ts and src/data/word-examples.ts
// already apply to the rest of this app's data — never force a match.
//
// Server-only (imports the full vocabulary to build its index). Never import
// from client code.

import { pitchPatternForLength } from "@/lib/pitch";
import { legacyUnqualifiedReading, VOCAB } from "@/data/vocab";
import { wordPitch } from "@/data/pitch";

/** Katakana → hiragana, code-point shift over the katakana block (U+30A1
 * "ァ" … U+30F6 "ヶ", -0x60 lands on the matching hiragana). VOICEVOX's mora
 * `text` is katakana; the pitch dataset's readings are hiragana (vocab.json's
 * `reb`), so every lookup goes through this first. Characters outside the
 * block (ー, っ already-hiragana, punctuation) pass through unchanged — ー in
 * particular is shared by both scripts as the same code point. */
export function toHiragana(kana: string): string {
  let out = "";
  for (const ch of kana) {
    const code = ch.codePointAt(0)!;
    out += code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : ch;
  }
  return out;
}

/** reading (hiragana) → downstep, built once from the SAME per-word data
 * SAK-98's word-page pitch button already reads (src/data/pitch.ts, keyed by
 * written form). Collapsed to reading here because a VOICEVOX accent phrase
 * gives us kana, not a specific written form — so a reading that more than one
 * written form claims with DIFFERING downsteps (a genuine homograph, e.g.
 * 箸/橋 both はし) is dropped as ambiguous, the same way the ingest itself
 * drops an ambiguous Kanjium row. A reading is kept only when every vocab
 * entry that resolves to it agrees. */
let readingIndex: ReadonlyMap<string, number> | null = null;

function buildReadingIndex(): ReadonlyMap<string, number> {
  const seen = new Map<string, number | "ambiguous">();
  for (const row of VOCAB) {
    const downstep = wordPitch(row.keb);
    if (downstep === null) continue;
    const reading = legacyUnqualifiedReading(row.keb) ?? row.reb;
    const prior = seen.get(reading);
    if (prior === undefined) seen.set(reading, downstep);
    else if (prior !== "ambiguous" && prior !== downstep) seen.set(reading, "ambiguous");
  }
  const clean = new Map<string, number>();
  for (const [reading, value] of seen) {
    if (value !== "ambiguous") clean.set(reading, value);
  }
  return clean;
}

function index(): ReadonlyMap<string, number> {
  if (!readingIndex) readingIndex = buildReadingIndex();
  return readingIndex;
}

export interface PhraseMatch {
  /** How many of the phrase's LEADING morae the match covers — apply the
   * pitch pattern to exactly this many, leave the rest untouched. */
  readonly matchedLength: number;
  readonly downstep: number;
}

/**
 * Try to match an accent phrase's kana reading (its moras' `text`,
 * concatenated, katakana as VOICEVOX gives it) against the pitch dataset: the
 * full reading first, then progressively shorter mora-aligned prefixes. The
 * first hit wins; no hit at any length returns null.
 *
 * A minimum of 1 mora is tried (some real dictionary words, e.g. 手, 目, are a
 * single mora) — a coincidental hit on a single mora that is actually just a
 * particle is an accepted, rare false positive of a best-effort heuristic, not
 * a bug: see the module header.
 */
export function matchPhraseReading(moraTexts: readonly string[]): PhraseMatch | null {
  if (moraTexts.length === 0) return null;
  const idx = index();
  for (let len = moraTexts.length; len >= 1; len--) {
    const reading = toHiragana(moraTexts.slice(0, len).join(""));
    const downstep = idx.get(reading);
    if (downstep !== undefined) return { matchedLength: len, downstep };
  }
  return null;
}

/** One VOICEVOX mora, the minimal shape this module needs — matches the
 * shape tts-synth.ts already reads off a live /audio_query response. */
export interface CorrectableMora {
  pitch: number;
  text: string;
}

export interface AccentPhraseLike {
  moras: CorrectableMora[];
}

export interface PitchTarget {
  readonly low: number;
  readonly high: number;
}

/**
 * Apply pitch correction to every accent phrase, mutating `moras[].pitch` IN
 * PLACE — the same "map the pattern onto points inside the voice's own
 * measured natural range" technique tts-synth.ts already uses for a single
 * known word, just driven per-phrase by `matchPhraseReading` instead of a
 * caller-supplied exact downstep.
 *
 * Returns coverage stats (phrases matched / total) so a caller can report a
 * real match rate, mirroring how SAK-98's ingest reported its Kanjium word
 * coverage.
 */
export function correctSentencePitch(
  accentPhrases: readonly AccentPhraseLike[],
  target: PitchTarget,
): { totalPhrases: number; matchedPhrases: number } {
  let matchedPhrases = 0;
  for (const phrase of accentPhrases) {
    const match = matchPhraseReading(phrase.moras.map((m) => m.text));
    if (!match) continue;
    matchedPhrases++;
    const pattern = pitchPatternForLength(match.matchedLength, match.downstep);
    for (let i = 0; i < match.matchedLength; i++) {
      const mora = phrase.moras[i];
      // Leave an already-silent/devoiced mora alone — editing those is exactly
      // what produced scratchy audio in the SAK-6 research spike.
      if (mora.pitch <= 0) continue;
      mora.pitch = pattern[i].high ? target.high : target.low;
    }
  }
  return { totalPhrases: accentPhrases.length, matchedPhrases };
}
