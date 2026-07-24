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
// THE ANSWER IS NEVER IN THE HINT, and after the retry-hint redesign that draws
// a hard line: a hint exists ONLY for a card whose answer is a MEANING (or the
// Japanese written form of one) that decomposes into TWO OR MORE component
// kanji, and it shows those components — never the whole gloss, and never any
// reading.
//
//   - NO READING CARD GETS A HINT. The reading IS the answer, so any
//     decomposition of it (家 is か here, 人 is ひと here, a sibling kanji's
//     on'yomi) hands over part or all of it. Kanji reading, word reading and
//     listening-reading all decline.
//   - A MEANING hint needs ≥2 parts to ASSEMBLE. 明 = 日 + 月 and 先生 = 先 +
//     生 are nudges you still have to put together; an atomic kanji (口, 人) or a
//     single-kanji word (口) has nothing left over, so its "breakdown" is the
//     gloss itself — no hint.
//   - DIRECTION still matters: meaning hints are jp2en only, where the Japanese
//     is on screen and the hint helps you read it. Shown the gloss and asked to
//     PRODUCE the Japanese, the components are how you write the answer, so there
//     is no hint in that direction at all.
//   - The kana picture and the grammar host/form hints survive: the kana
//     mnemonic is a drawing, not the romaji it teaches, and a pattern's host
//     ("attaches to a verb") and form ("uses the て-form") name neither its gloss
//     nor its built output.

import { CHAR_INDEX, KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT, grammarMeaning, grammarProduction } from "@/data/grammar";
import { KANJI_SUBJECT, READING_INDEX, kanjiRow } from "@/data/kanji";
import { getMnemonic } from "@/data/mnemonics";
import { VOCAB_SUBJECT, wordReadingFactId } from "@/data/vocab";
import { FORM_LABEL, attachesTo, recipeFormula } from "@/lib/grammar/formula";
import { factInfo } from "@/lib/facts";
import { teachableParts } from "@/lib/kanji-parts";
import type { Direction, FactId } from "@/types";

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
  | { kind: "text"; text: string }
  // The WRITTEN FORM of the word, shown big enough to READ. Only a listening
  // MEANING card produces this: the audio played the word and hid its glyph, so
  // the honest nudge is to reveal WHICH word was heard (電話), not to gloss its
  // parts. It is not a leak — the writing is not the meaning — and it must not
  // render as a caption, because it is a Japanese word the learner is meant to
  // read. Distinct from `text` for exactly that reason: the renderer prints it
  // prominently, in the JP font, the way the prompt glyph would have been.
  | { kind: "written"; text: string };

/**
 * The hint for one SHOWING of a fact, or null when there is nothing honest to
 * say.
 *
 * `listen` is the ONE bit of showing state that survives, because it changes
 * what an honest hint IS rather than which word a fact is framed on: a listening
 * MEANING card played the word and hid its glyph, so the useful nudge is to show
 * WHICH word was heard (the written form), not to gloss its parts. Everything
 * else — kana pictures, kanji-component and (visual) word-meaning structural
 * hints — depends only on the fact. Defaults false, so every non-listening
 * caller is unchanged.
 */
export function hintFor(
  fact: FactId,
  dir: Direction,
  listen = false,
): Hint | null {
  const info = factInfo(fact);
  if (!info) return null;
  switch (info.subject) {
    case KANA_SUBJECT:
      return kanaHint(info.glyph, dir);
    case KANJI_SUBJECT:
      return kanjiHint(fact, info.glyph, dir);
    case VOCAB_SUBJECT:
      return wordHint(fact, info.glyph, dir, listen);
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

function kanjiHint(fact: FactId, glyph: string, dir: Direction): Hint | null {
  // A READING QUESTION GETS NO HINT. The reading IS the answer, so there is no
  // honest nudge: naming the word's other kanji ("人 is じん here") tells you the
  // word is read on'yomi, which is a decomposition of the very reading you were
  // asked for. Every reading fact of every subject declines the same way — see
  // wordHint and the module header. A reading fact is the (kanji, word) pair
  // READING_INDEX carries an anchor for; a meaning fact has none and falls
  // through to the parts hint below.
  if (READING_INDEX.get(fact)?.anchor) return null;
  // A MEANING question is hinted with the parts, which is the "Built from parts
  // you learn on their own" line the lesson already shows — and only when every
  // component is itself a jōyō kanji with a meaning, which is teachableParts'
  // own all-or-nothing test. Raw KRADFILE primitives are never used: the
  // codebase is explicit that they are unreliable for teaching.
  //
  // jp2en only, and NEVER for en2jp: shown "bright" and asked to produce 明, the
  // components 日+月 are how you WRITE it, so they are the answer, not a nudge.
  if (dir !== "jp2en") return null;
  const parts = teachableParts(glyph);
  if (!parts) return null;
  const named = parts.filter((p) => p.meaning);
  if (named.length !== parts.length) return null;
  // TWO PARTS OR NONE. A hint that names a single component is the answer with
  // one extra word: an atomic/pictograph kanji (口, 人) has no teachable parts at
  // all and lands above, but a kanji whose only jōyō component is one other kanji
  // would be "made of X" — and if that lone X carries the glyph's meaning, the
  // hint IS the gloss. The structural nudge only works when there are ≥2
  // components to ASSEMBLE (明 = 日 + 月), which is the same "you still have to
  // put it together" argument the multi-kanji word hint rests on.
  if (named.length < 2) return null;
  return {
    kind: "text",
    text: `made of ${named.map((p) => `${p.c} (${p.meaning})`).join(" + ")}`,
  };
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
 * MEANING cards only, and jp2en only.
 *
 * A READING QUESTION GETS NO HINT — decomposing a reading is a giveaway by
 * design: 家族 asked for its reading hinted "家 is か here" hands over half of
 * かぞく, and a single-kanji word hands over all of it. The reading IS the answer,
 * so there is no honest nudge, and the branch that used to build one is gone.
 *
 * MEANING asked jp2en shows the word and wants the gloss: naming its kanji ("先
 * is before, 生 is life") is a structural nudge you still have to assemble into
 * "teacher". Asked en2jp it shows the gloss and wants the written word, where
 * naming 先 and 生 IS 先生 — so meaning hints are jp2en only.
 */
function wordHint(
  fact: FactId,
  glyph: string,
  dir: Direction,
  listen: boolean,
): Hint | null {
  if (dir !== "jp2en") return null;
  // Reading facts decline outright, before any decomposition is attempted.
  if (wordReadingFactId(glyph) === fact) return null;
  // A LISTENING MEANING card is the reason this function takes `listen`. The
  // audio played the word and the glyph is off screen, so the honest nudge is
  // the WRITTEN FORM itself — 電話 — which lets the learner SEE which word they
  // heard. It cannot leak: the writing is not the meaning, so a card asking for
  // the English answer keeps its answer withheld. This REPLACES the component
  // breakdown on the listening showing only; a visual meaning card (the glyph is
  // already on screen) falls through to the parts hint below, unchanged. Every
  // word qualifies, including single-kanji and all-kana words a component hint
  // had nothing to say about — the written form is a legitimate hint for any of
  // them, because it names the heard word without naming its gloss.
  if (listen) return { kind: "written", text: glyph };
  const kanji = kanjiOf(glyph);
  // FEWER THAN TWO KANJI HAS NOTHING TO TAKE APART, so no meaning hint either.
  // An all-kana word (これ, とても) has no kanji at all; a SINGLE-kanji word (口)
  // has nothing left over once you name its one kanji, so the "breakdown" ("口 is
  // mouth") is the whole gloss the card asked for rather than a nudge toward it.
  // A real decomposition needs two parts to hold apart — "先 is before, 生 is
  // life", which you still have to read as "teacher".
  if (kanji.length < 2) return null;
  // Every kanji or none — a partial breakdown reads as a claim about the whole
  // word.
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
    // pattern that asks nothing of the word has told you nothing anyway.
    //
    // LIVE, on the な-adjective half of 〜すぎる and 〜そう. A な-adjective's stem
    // IS the adjective (静か → 静か), so its label is the dictionary form's own
    // words — see FORM_LABEL_BY_HOST — and there is no step to name. The fact is
    // still producible and still scored: 静かすぎる is a real thing to build. It
    // is the HINT that has nothing to add, which is what this branch is for.
    const label = f?.formLabel;
    if (!label || label === FORM_LABEL.dictionary) return null;
    return { kind: "text", text: `uses the ${label}` };
  }
  const mean = grammarMeaning(fact);
  if (!mean) return null;
  const text = attachesTo(mean.recipe);
  return text ? { kind: "text", text } : null;
}
