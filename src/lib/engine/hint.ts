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
// THE ANSWER IS NEVER IN THE HINT. A meaning hint shows a card's TWO-OR-MORE
// component kanji — never the whole gloss. A kanji-reading hint (task #22) shows
// the OTHER pieces of the word with their readings and leaves the asked piece
// blank — never the reading that was asked. Neither holds the answer.
//
//   - A KANJI READING CARD gets the FORMULA hint: it is asked inside a known,
//     multi-part word ("病 in 病院 → ?"), and the nudge is [病] + [院 / いん] =
//     病院 — the rest of the word filled in, the asked piece blank. See
//     kanjiHint and src/lib/reading-formula.ts. The asked reading (びょう) never
//     appears, so this obeys the rule above rather than breaking it.
//   - WORD reading and listening-reading cards still get NO hint. There the
//     whole answer is one word's reading, and naming its kanji ("家 is か here")
//     hands over part or all of that one answer — see wordHint. Only the kanji
//     card, which asks ONE piece of a word and can show the rest, has an honest
//     formula to give.
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
import { readingFormula, type ReadingFormula } from "@/lib/reading-formula";
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
  | { kind: "formula"; formula: ReadingFormula }
  // The WRITTEN FORM of the word, shown big enough to READ. Only a listening
  // MEANING card produces this: the audio played the word and hid its glyph, so
  // the honest nudge is to reveal WHICH word was heard (電話), not to gloss its
  // parts. It is not a leak — the writing is not the meaning — and it must not
  // render as a caption, because it is a Japanese word the learner is meant to
  // read. Distinct from `text` for exactly that reason: the renderer prints it
  // prominently, in the JP font, the way the prompt glyph would have been.
  //
  // `parts` rides along ONLY for a MULTI-KANJI word — the same per-kanji meaning
  // breakdown a visual meaning card gets ("電 is electricity, 話 is tale"),
  // rendered small beneath the written word. Sam ruled the piece meanings an
  // acceptable extra nudge on a listening card: they name the kanji, never the
  // English gloss ("telephone"), so the answer stays withheld. Absent for a
  // single-kanji or all-kana word, which has nothing to break down — those stay
  // written-form-only.
  | { kind: "written"; text: string; parts?: string };

/**
 * The hint for one SHOWING of a fact, or null when there is nothing honest to
 * say.
 *
 * Two bits of showing context are taken, each because it changes what an honest
 * hint IS. `inWord` is the word a kanji-reading card is being FRAMED on (the
 * known, multi-part anchor the drill picked — see word-unlock.ts): a reading
 * card's formula hint lays out that exact word with its other pieces' readings
 * filled in, so it must build on the word on screen, not the fact's ingest
 * anchor. `listen` marks a listening MEANING card, which played the word and hid
 * its glyph — so the useful nudge is to show WHICH word was heard (the written
 * form), not to gloss its parts. Every other hint — kana pictures, kanji-
 * component and (visual) word-meaning structural hints — ignores both and
 * depends only on the fact. Both default off, so every prior caller is unchanged.
 */
export function hintFor(
  fact: FactId,
  dir: Direction,
  inWord?: string,
  listen = false,
): Hint | null {
  const info = factInfo(fact);
  if (!info) return null;
  switch (info.subject) {
    case KANA_SUBJECT:
      return kanaHint(info.glyph, dir);
    case KANJI_SUBJECT:
      return kanjiHint(fact, info.glyph, dir, inWord);
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

function kanjiHint(
  fact: FactId,
  glyph: string,
  dir: Direction,
  inWord?: string,
): Hint | null {
  // A READING QUESTION IS HINTED WITH THE FORMULA (task #22). The reading is
  // asked inside a known, multi-part word — "病 in 病院 → ?" — and the honest
  // nudge is the REST of that word with its readings filled in and the asked
  // piece left blank: [病] + [院 / いん] = 病院. The answer (病 = びょう) is never
  // shown; only the other pieces are, so the learner backs it out of the whole
  // rather than being handed it. Frames on the word the card is being shown on
  // (`inWord`), falling back to the fact's own ingest anchor. readingFormula
  // returns null for a one-piece word — the "on its own" card task #22 removed —
  // so a reading with nothing beside it still gets no hint.
  const anchor = READING_INDEX.get(fact)?.anchor;
  if (anchor) {
    const formula = readingFormula(glyph, inWord ?? anchor);
    return formula ? { kind: "formula", formula } : null;
  }
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
  // The component breakdown, built once and used by both showings — "電 is
  // electricity, 話 is tale" for a multi-kanji word, null otherwise (see
  // componentMeanings for the ≥2-kanji / every-kanji-or-none rules).
  const parts = componentMeanings(glyph);
  // A LISTENING MEANING card is the reason this function takes `listen`. The
  // audio played the word and the glyph is off screen, so the honest nudge is
  // the WRITTEN FORM itself — 電話 — which lets the learner SEE which word they
  // heard. It cannot leak: the writing is not the meaning, so a card asking for
  // the English answer keeps its answer withheld. Every word qualifies, single-
  // kanji and all-kana included — the written form names the heard word without
  // naming its gloss.
  //
  // For a MULTI-KANJI word it ALSO carries the piece meanings (`parts`), the same
  // breakdown the visual card gets, rendered beneath the word. Sam ruled that an
  // acceptable bigger nudge on a listening card: it names the kanji, never the
  // English gloss. Single-kanji / all-kana words have no `parts`, so they stay
  // written-form-only.
  if (listen) {
    return parts
      ? { kind: "written", text: glyph, parts }
      : { kind: "written", text: glyph };
  }
  // A visual meaning card (the glyph is already on screen) shows the breakdown
  // alone — null becomes no hint at all, exactly as before.
  return parts ? { kind: "text", text: parts } : null;
}

/**
 * The per-kanji meaning breakdown of a word — "先 is before, 生 is life" — or
 * null when there is nothing honest to break down.
 *
 * FEWER THAN TWO KANJI HAS NOTHING TO TAKE APART. An all-kana word (これ, とても)
 * has no kanji at all; a SINGLE-kanji word (口) has nothing left over once you
 * name its one kanji, so the "breakdown" ("口 is mouth") is the whole gloss the
 * card asked for rather than a nudge toward it. A real decomposition needs two
 * parts to hold apart, which you still have to assemble into the meaning.
 *
 * EVERY KANJI OR NONE — a partial breakdown reads as a claim about the whole
 * word, so a word with an unnamed kanji declines rather than half-explaining.
 */
function componentMeanings(glyph: string): string | null {
  const kanji = kanjiOf(glyph);
  if (kanji.length < 2) return null;
  const said: string[] = [];
  for (const c of kanji) {
    const m = kanjiRow(c)?.meanings[0];
    if (!m) return null;
    said.push(`${c} is ${m}`);
  }
  return said.length ? said.join(", ") : null;
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
