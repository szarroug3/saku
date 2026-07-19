// The drill's HINT — a nudge toward the answer that costs you the first-try
// credit, and nothing else.
//
// WHAT A HINT IS ALLOWED TO BE
// ============================
// Every hint below is DATA THE APP ALREADY HOLDS AND ALREADY TEACHES: the drawn
// mnemonic picture the lesson shows, the per-kanji reading breakdown the word
// ingest aligned, the component list "How it's written" prints, the attachment
// and form lines the grammar formula card prints. Nothing here is authored for
// the drill, and nothing here is generated. A hint that had to be invented would
// be a claim the rest of the app could contradict.
//
// A CARD WITH NOTHING TRUE TO SAY GETS NO HINT, which is why every builder
// returns null rather than a shrug. The drill hides the button on null: an empty
// frame or an apology ("no hint for this one") is worse than no button, because
// it costs a press to learn nothing.
//
// THE ANSWER IS NEVER IN THE HINT, and the direction is half of that argument.
// A kanji's components are a fine nudge when you are shown 明 and asked what it
// means; they are the ANSWER when you are shown "bright" and asked for the
// glyph. So the meaning hints — kanji meaning, word meaning, word reading and
// the kana picture — are jp2en only, where the Japanese is already on screen and
// the hint is helping you read it. The hints that name something OTHER than the
// asked item (a sibling kanji's reading, a pattern's host and form) are safe
// both ways round and are offered both ways round.

import { CHAR_INDEX, KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT, grammarMeaning, grammarProduction } from "@/data/grammar";
import {
  KANJI_SUBJECT,
  READING_INDEX,
  kanjiRow,
  readingFactId,
} from "@/data/kanji";
import { getMnemonic } from "@/data/mnemonics";
import { VOCAB_SUBJECT, vocabRow, wordReadingFactId } from "@/data/vocab";
import { FORM_LABEL, attachesTo, recipeFormula } from "@/lib/grammar/formula";
import { factInfo } from "@/lib/facts";
import { teachableParts } from "@/lib/kanji-parts";
import type { Direction, FactId } from "@/types";

import type { PromptContext } from "./question";

/**
 * What a taken hint puts on screen.
 *
 * Two shapes, because kana's hint genuinely is a picture and everyone else's
 * genuinely is a sentence. `image` carries a CANDIDATE path exactly as
 * getMnemonic hands one out — the file may not have been drawn yet, and deciding
 * that is the renderer's job (MnemonicImage already 404s gracefully), not this
 * module's. See `hintFor`'s note on why the drill probes it before offering the
 * button.
 */
export type Hint =
  | { kind: "image"; src: string; glyph: string }
  | { kind: "text"; text: string };

/**
 * The hint for one SHOWING of a fact, or null when there is nothing honest to
 * say. `ctx` is the same per-showing context prompt/check/reveal are given, so a
 * kanji reading framed on the word the learner actually knows is hinted on THAT
 * word rather than the ingest's anchor.
 */
export function hintFor(
  fact: FactId,
  dir: Direction,
  ctx?: PromptContext,
): Hint | null {
  const info = factInfo(fact);
  if (!info) return null;
  switch (info.subject) {
    case KANA_SUBJECT:
      return kanaHint(info.glyph, dir);
    case KANJI_SUBJECT:
      return kanjiHint(fact, info.glyph, dir, ctx);
    case VOCAB_SUBJECT:
      return wordHint(fact, info.glyph, dir);
    case GRAMMAR_SUBJECT:
      return grammarHint(fact);
    default:
      return null;
  }
}

// ---------- kana: the picture, and only the picture ----------

/**
 * The drawn mnemonic on its own — no story, no analogy line, no example word.
 *
 * The mnemonic's TEXT carries the answer ("a person saying AH"), so printing it
 * would not be a hint, it would be the answer with extra steps. The picture is
 * the half that makes you remember rather than tells you.
 *
 * jp2en only: shown the romaji and asked for the glyph, a drawing OF that glyph
 * is the answer.
 */
function kanaHint(glyph: string, dir: Direction): Hint | null {
  if (dir !== "jp2en") return null;
  if (!CHAR_INDEX[glyph]) return null;
  const src = getMnemonic(glyph)?.image;
  return src ? { kind: "image", src, glyph } : null;
}

// ---------- kanji ----------

function kanjiHint(
  fact: FactId,
  glyph: string,
  dir: Direction,
  ctx?: PromptContext,
): Hint | null {
  const anchor = READING_INDEX.get(fact)?.anchor;
  if (anchor) {
    // A READING question is keyed on (kanji, word), so the hint that is neither
    // the answer nor a guess is what the word's OTHER kanji read as here. "生 in
    // 人生 → ?" is hinted "人 is じん here", which tells you the word is being
    // read on'yomi without telling you 生's half of it.
    //
    // Framed on the SHOWING's word, not the fact's: word-unlock may have moved
    // the question onto a word the learner has actually met, and hinting the
    // other one would name kanji that are not on screen.
    return siblingReadingHint(glyph, ctx?.anchor ?? anchor);
  }
  // A MEANING question is hinted with the parts, which is the "Built from parts
  // you learn on their own" line the lesson already shows — and only when every
  // component is itself a jōyō kanji with a meaning, which is teachableParts'
  // own all-or-nothing test. Raw KRADFILE primitives are never used: the
  // codebase is explicit that they are unreliable for teaching.
  if (dir !== "jp2en") return null;
  const parts = teachableParts(glyph);
  if (!parts) return null;
  const named = parts.filter((p) => p.meaning);
  if (named.length !== parts.length) return null;
  return {
    kind: "text",
    text: `made of ${named.map((p) => `${p.c} (${p.meaning})`).join(" + ")}`,
  };
}

/** "人 is じん here", or "人 is じん, 生 is せい here" when the word has more than
 * two kanji. Null when the word's other kanji have no known reading — the
 * jukujikun (大人/おとな) land here, correctly: there is no per-kanji reading in
 * 大人 to name. */
function siblingReadingHint(glyph: string, word: string): Hint | null {
  const others = kanjiOf(word).filter((c) => c !== glyph);
  const said: string[] = [];
  for (const c of others) {
    const r = readingInWord(c, word);
    if (r) said.push(`${c} is ${r}`);
  }
  return said.length ? { kind: "text", text: `${said.join(", ")} here` } : null;
}

/**
 * How `kanji` is read inside `word`, or null.
 *
 * The word's own `align` first: it is the per-kanji breakdown the ingest derived
 * for THIS word, it is null exactly for the jukujikun where no such breakdown
 * exists, and it covers every word rather than only the ones a reading fact
 * happens to be anchored to. READING_INDEX is the fallback for a word the vocab
 * table does not carry as a row (a kanji anchored on itself, 一 in 一).
 */
function readingInWord(kanji: string, word: string): string | null {
  const hit = vocabRow(word)?.align?.find(([k]) => k === kanji);
  if (hit) return hit[1];
  return READING_INDEX.get(readingFactId(kanji, word))?.surface ?? null;
}

/** The distinct kanji in a word, in order. Kana are skipped: 食べる's べる has no
 * reading to name and 食 is the whole of its kanji. */
function kanjiOf(word: string): string[] {
  const out: string[] = [];
  for (const c of word) {
    if (kanjiRow(c) && !out.includes(c)) out.push(c);
  }
  return out;
}

// ---------- words ----------

/**
 * jp2en only, for both aspects, and the two reasons are different.
 *
 * MEANING asked en2jp shows the gloss and wants the written word: a hint naming
 * 先 and 生 hands over 先生 outright. READING asked en2jp shows the gloss and
 * wants せんせい: naming 先's せん hands over half the answer AND a kanji that is
 * not on screen. In jp2en both are the honest nudge — the word is in front of
 * you and the hint helps you take it apart.
 */
function wordHint(fact: FactId, glyph: string, dir: Direction): Hint | null {
  if (dir !== "jp2en") return null;
  const kanji = kanjiOf(glyph);
  // An all-kana word (これ, とても) has nothing to take apart, so it has no hint.
  if (!kanji.length) return null;
  if (wordReadingFactId(glyph) === fact) {
    // A READING question is hinted with the FIRST kanji's reading in this word:
    // enough to start the word, never the whole of it.
    const r = readingInWord(kanji[0], glyph);
    return r ? { kind: "text", text: `${kanji[0]} is ${r} here` } : null;
  }
  // A MEANING question is hinted with the meanings of its kanji: 先生 hints
  // "先 is before, 生 is life". Every kanji or none — a partial breakdown reads
  // as a claim about the whole word.
  const said: string[] = [];
  for (const c of kanji) {
    const m = kanjiRow(c)?.meanings[0];
    if (!m) return null;
    said.push(`${c} is ${m}`);
  }
  return said.length ? { kind: "text", text: said.join(", ") } : null;
}

// ---------- grammar ----------

/**
 * A pattern's MEANING is hinted with what it ATTACHES TO ("attaches to a verb")
 * and its PRODUCTION with the form it uses ("uses the て-form"). Both are lines
 * the pattern's own formula card already prints, and neither is the built
 * answer: knowing 〜てから takes the て-form does not tell you 行ってから.
 *
 * Direction-insensitive. Neither line names the pattern or its gloss, so neither
 * can be the answer whichever half of the pair is the question.
 */
function grammarHint(fact: FactId): Hint | null {
  const prod = grammarProduction(fact);
  if (prod) {
    // The formula for THIS fact's host: 〜そう on a verb uses the stem and on an
    // い-adjective trims the い, and those are separate facts precisely because
    // they are separate rules.
    const f = recipeFormula(prod.recipe).opening.find((o) => o.host === prod.host);
    // No form label is a real answer — 〜ば and 〜たら ARE forms the engine
    // produces, with no step to name. Nothing to say, so nothing is said.
    //
    // "just as it is" is dropped too, and not for grammar: it is the label for
    // the dictionary form, so "uses the just as it is" is not a sentence, and a
    // pattern that asks nothing of the word has told you nothing anyway. No
    // producible recipe is vacuous today (isVacuous refuses them a production
    // fact), so this is a guard rather than a live case.
    const label = f?.formLabel;
    if (!label || label === FORM_LABEL.dictionary) return null;
    return { kind: "text", text: `uses the ${label}` };
  }
  const mean = grammarMeaning(fact);
  if (!mean) return null;
  const text = attachesTo(mean.recipe);
  return text ? { kind: "text", text } : null;
}
