// The teach walk's step list: the lesson's items, plus the teaching cards that
// introduce a new PHASE of the curriculum.
//
// WHY A LAYER ABOVE itemsFromFacts
// ================================
// `itemsFromFacts` answers "what glyphs does this teach set cover", and that is
// all it should ever answer — it is subject-generic and knows nothing about
// kana's curriculum. A phase intro is not a glyph and has no fact, so folding it
// in there would put "kana has a dakuten phase" inside the generic grouper.
//
// So the walk steps over LessonSteps instead: an item step wraps exactly the
// LessonItem it always did, and an intro step carries a card. Anything with no
// intro produces a step list that is the item list one-for-one, which is why a
// phase without a card behaves exactly as it did before this file existed.
//
// ONE HELPER, TWO CALLERS, ONE COUNT
// ==================================
// The walk renders the steps and the session HUD counts them ("1 of 6"). Both
// call this, so the count and the content cannot disagree — the same reason the
// HUD already derived its items from `itemsFromFacts` rather than keeping its
// own copy.
//
// ANCHORED ON THE EDGES OF THE TEACH SET
// ======================================
// A "before" card shows when the teach set OPENS on a section that has one; an
// "after" card shows when it CLOSES on one. Local, deterministic, and a
// function of the teach set alone — no cursor, nothing on disk, nothing to get
// out of step with history. A group re-taught later shows its card again, which
// is the right answer for a card whose whole job is to explain the material.
//
// Kana only, by the item's own `kind` — with EXCEPTIONS. A kanji/word rule with
// no kana section to hang on rides the WORD that first puts it in play: the
// iteration mark 々 surfaces the moment the first 々 word (時々) is taught, and
// rendaku the moment the first word that voices at a compound seam (仕事) is —
// each ahead of the word that first makes its rule visible. Okurigana is
// word-gated the same way, over three cards: the idea rides the first word that
// carries a kana tail, and the moving and fixed cards ride the first word whose
// tail moves and the first whose tail does not, so each contrast is real rather
// than hypothetical. See phase-intros.ts for why these are word-gated rather than
// anchored to a section.

import { CHAR_INDEX, kanaFact } from "@/data/characters";
import { dakutenRowFor, type DakutenRow } from "@/data/dakuten-rows";
import { YOON_ROWS, yoonRowFor } from "@/data/yoon-rows";
import { effectiveState } from "@/lib/claims";
import {
  BUILT_FROM_INTRO,
  COMBO_H,
  COMBO_K,
  INTRO_AFTER,
  INTRO_BEFORE,
  ITERATION_MARK,
  OKURIGANA_INTRO,
  OKURIGANA_MOVING,
  ONYOMI_INTRO,
  PITCH_INTRO,
  TRANSITIVITY_INTRO,
  type PhaseIntro,
} from "@/data/phase-intros";
import { wordPitch } from "@/data/pitch";
import { builtPieces } from "@/data/kanji-etymology";
import { meaningFactId } from "@/data/kanji";
import { isNumberKanji } from "@/data/number-kanji";
import { hasOnyomi } from "@/lib/kanji-onyomi";
import {
  constructionIntroForMarker,
  isConstructionMarker,
} from "@/data/counter-categories";
import { COUNTER_ENTRIES } from "@/data/counters";
import { termEntry } from "@/data/terms";
import { TRACK_INTROS, type TrackId } from "@/data/track-intros";
import { vocabRow, wordReadingFactId } from "@/data/vocab";
import { grammarLessonsForFacts } from "@/data/grammar/lessons";
import { itemsFromFacts, type LessonItem } from "@/lib/lesson-items";
import { spineIntroPlan } from "@/lib/spine-intros";
import { startedTracks, trackOfItem } from "@/lib/track-open";
import type { EntryId, FactId, HistoryFile } from "@/types";

/** The tracks whose cards are anchored to a curriculum item instead of opened by
 * a subject. They are the three roles of the one spine, and spine-intros.ts owns
 * when each fires. */
const SPINE_TRACKS: ReadonlySet<TrackId> = new Set<TrackId>(["radical", "kanji", "word"]);

/** One step of the walk — a character to learn, a conversion to learn, or a
 * concept to read. */
export type LessonStep =
  | { type: "intro"; key: string; intro: PhaseIntro }
  // `conceptId` carries the stable id of the concept card this term page stands
  // in for, when the term step REPLACES a once-ever concept intro (on'yomi,
  // pitch, the kanji/radical spine cards). The walk gates re-showing on that id
  // (`shownIntros.has(...)`), and session/page.tsx records it as shown on the way
  // out — so a concept moved onto a term page is still shown exactly once. Absent
  // for term steps that are not once-ever (the kana openers, counter/keigo track
  // pages, rendaku, okurigana): those are gated by track history or per-lesson
  // and record nothing. See src/lib/intro-shown.ts.
  | { type: "term"; key: string; entry: EntryId; conceptId?: string }
  | { type: "conversion"; key: string; row: DakutenRow }
  | { type: "item"; key: string; item: LessonItem };

/** A term-page step, optionally standing in for a once-ever concept card
 * (`conceptId`). The one place a term step is built, so its key shape stays
 * uniform. */
function termStep(termId: string, conceptId?: string): LessonStep {
  return { type: "term", key: `term:${termId}`, entry: termEntry(termId), conceptId };
}

/**
 * Tracks whose opening intro is one or more TERM PAGES rather than the single
 * track-intro card — the "intros are the term pages" model the redesign settled.
 * Hiragana opens on the kana umbrella then hiragana itself; katakana opens on
 * katakana alone (kana was already met). A track absent here keeps its
 * TRACK_INTROS card. Term ids, resolved to entries at emit time.
 */
const TRACK_TERM_INTROS: Partial<Record<TrackId, readonly string[]>> = {
  // Kana umbrella, then hiragana, then romaji — the format every answer is typed
  // in, so it is defined before the learner first has to type one.
  hiragana: ["kana", "hiragana", "romaji"],
  katakana: ["katakana"],
  // Counters and keigo open on their term page too: the same page the Library
  // shows, rendered where the word is first used. Their once-per-track gate is
  // still track history (`started`), so no `conceptId` is threaded — meeting the
  // track again would re-show it exactly as the old track-intro card did.
  counters: ["counter"],
  keigo: ["keigo"],
};

/**
 * The two spine concept cards that are now shown as their TERM page — kanji and
 * radical — by the id spine-intros.ts plans them under. (The variant-form concept
 * folds into the radical term page rather than being planned separately.) Both are
 * once-ever, so the term step carries the intro id as its `conceptId`.
 */
const SPINE_TERM: Readonly<Record<string, string>> = {
  [TRACK_INTROS.kanji.id]: "kanji",
  [TRACK_INTROS.radical.id]: "radical",
};

/**
 * The grammar-lesson teach cards shown as a TERM page instead of an intro card.
 * Okurigana is taught over two consecutive cards (the idea, then the moving
 * tail); its term page renders both, so the two collapse into ONE okurigana term
 * step. Not once-ever — gated by the grammar lesson that teaches it — so no
 * `conceptId`.
 */
const GRAMMAR_CARD_TERM: Readonly<Record<string, string>> = {
  [OKURIGANA_INTRO.id]: "okurigana",
  [OKURIGANA_MOVING.id]: "okurigana",
};

/** The kana section a step's glyph belongs to, or null for anything that isn't
 * a kana we ship. A lookup, never a parse. */
function sectionOf(item: LessonItem): string | null {
  if (item.kind !== "kana") return null;
  return CHAR_INDEX[item.glyph]?.sec ?? null;
}

/** Has any yōon combo of this script already been met — answered, claimed, or
 * "quiz me"'d — OUTSIDE this lesson's own facts? The same "history minus the
 * teach set" read `startedTracks` uses (src/lib/track-open.ts). True here means
 * some earlier lesson already taught that script's first combo, which by this
 * same rule running then already showed COMBO_H/COMBO_K — so this lesson, even
 * one that opens on a LATER combo section (h-sha, h-pya, …), must not show it
 * again. */
function yoonScriptMet(
  setId: "hiragana" | "katakana",
  teachSet: ReadonlySet<FactId>,
  history: HistoryFile,
): boolean {
  return YOON_ROWS.some((row) => {
    if (row.setId !== setId) return false;
    const fact = kanaFact(row.glyph);
    if (teachSet.has(fact)) return false;
    const state = effectiveState(
      history.facts[fact],
      history.claims?.[fact],
      history.seen?.[fact],
    );
    return state.lastTested !== 0;
  });
}

/** The iteration mark, whose presence in a word's spelling is the gate for the
 * card that teaches it. A word that contains it is by definition the first place
 * 々 is in play. */
const ITERATION_GLYPH = "々";

/** A kanji, roughly: the CJK unified ideographs plus extension A. Deliberately
 * not 々 (U+3005), which is punctuation the iteration-mark gate owns. */
const KANJI = /[\u4e00-\u9faf\u3400-\u4dbf]/;
/** A hiragana. Okurigana is always hiragana — the katakana range is not it. */
const HIRAGANA = /[\u3040-\u309f]/;

/**
 * Does this written form end a kanji with a kana tail — okurigana?
 *
 * True when a hiragana appears somewhere AFTER a kanji: a kanji stem followed by
 * a hiragana tail (生きる, 高い, 一つ, 言う). Pure kana (これ) has no kanji, pure
 * kanji (先生) has no tail, and 時々 has only 々 after its kanji — none is
 * okurigana. A word with a hiragana in front of a later kanji (お茶) is not
 * caught either, because the tail has to come after the kanji, not before it.
 */
export function hasOkurigana(word: string): boolean {
  let seenKanji = false;
  for (const ch of word) {
    if (KANJI.test(ch)) {
      seenKanji = true;
      continue;
    }
    if (seenKanji && HIRAGANA.test(ch)) return true;
  }
  return false;
}

/** Each kana to its rendaku (voiced/semi-voiced) form: か→が, は→ば/ぱ. Only the
 * initial mora of a compound's second element voices, so only its first kana is
 * ever looked up here. */
const RENDAKU_VOICED: Readonly<Record<string, readonly string[]>> = {
  か: ["が"], き: ["ぎ"], く: ["ぐ"], け: ["げ"], こ: ["ご"],
  さ: ["ざ"], し: ["じ"], す: ["ず"], せ: ["ぜ"], そ: ["ぞ"],
  た: ["だ"], ち: ["ぢ"], つ: ["づ"], て: ["で"], と: ["ど"],
  は: ["ば", "ぱ"], ひ: ["び", "ぴ"], ふ: ["ぶ", "ぷ"], へ: ["べ", "ぺ"], ほ: ["ぼ", "ぽ"],
};

/**
 * Does this word show rendaku — a compound whose second (or later) element's
 * initial consonant has voiced at the seam? 仕事 (し+こと→しごと), 手紙
 * (て+かみ→てがみ), 言葉 (こと+は→ことば).
 *
 * Read off the word's `align` — the per-kanji [kanji, surface-in-word, base]
 * breakdown vocab.ts ships (see VocabRow.align). An element voiced iff its
 * surface is its base with the first kana swapped for the voiced counterpart and
 * the rest unchanged; the FIRST element is skipped, because rendaku is what
 * happens to the element that follows another. A word with no align (the ~2.6%
 * jukujikun) cannot be shown to voice and so counts as not-rendaku, the same
 * conservative default `tailMoves` takes.
 *
 * Note this is BLIND to a word whose align already records the voiced form as the
 * base — 時々's second element is stored as [時, どき, どき], not [時, どき, とき] —
 * which is correct for gating: 時々 (rank 154) is far behind the first genuine
 * rendaku word (仕事, rank 22), so the card has always fired by the time it is
 * reached, and 々 carries its own card regardless. See phase-intros.ts.
 */
export function hasRendaku(word: string): boolean {
  const align = vocabRow(word)?.align;
  if (!align) return false;
  return align.some(([, surface, base], i) => {
    if (i === 0 || !surface || !base) return false;
    const voiced = RENDAKU_VOICED[base[0]];
    return !!voiced && voiced.includes(surface[0]) && surface.slice(1) === base.slice(1);
  });
}

/**
 * The teach set, as the steps the walk pages through.
 *
 * Items in the order `itemsFromFacts` gives them — untouched — with at most one
 * card in front and any number behind (a script's last group closes on both its
 * long-vowel and its sokuon card), plus the two word-gated cards (々 and rendaku)
 * ahead of the first word that carries 々, and the two word-gated cards (rendaku)
 * ahead of the first word with rendaku.
 */
export function lessonSteps(
  facts: readonly FactId[],
  history?: HistoryFile,
  // The concept cards this learner has already been shown, by intro id. Absent
  // means none, which is the right default for a caller with no store to read
  // (SSR, a test naming a teach set) and the safe error either way: a card seen
  // twice costs ten seconds, a card never seen costs the learner the word. See
  // src/lib/intro-shown.ts.
  shownIntros: ReadonlySet<string> = new Set(),
): LessonStep[] {
  // GRAMMAR takes a different walk: its pages are AUTHORED, not derived from the
  // teach set the way a kana lesson's steps are. A grammar sitting is one form
  // lesson OR a bundle of up to three pattern lessons (see grammar-lesson.ts), so
  // emit EVERY lesson the teach set names, in teaching order, each lesson's pages
  // in turn — a teach page is a concept card (the same PhaseIntro kana uses), a
  // pattern page is the terse recipe tile the track always showed. Anything that
  // is not a grammar lesson falls through to the kana-native walk below.
  // A GENERATIVE NUMBER unit's teach set is a single marker pseudo-fact (see
  // src/data/counters.ts), which resolves to no glyph and no item — SOMETIMES
  // prepended with the counter kanji's prereq facts (its full component chain),
  // which DO resolve to kanji/radical item cards. So the walk teaches those
  // prereq item cards first, then the unit's one rule card — the tens/big compose
  // rules, or a counter's attach-and-shift card — and the generated round follows
  // in the drill leg (src/lib/counter-lesson.ts). The prereq kanji are context for
  // the rule, not the lesson's own subject, so they get no spine or track cards,
  // the same call a keigo lesson makes for the kanji inside its verbs. Detected
  // ahead of everything else because the marker has no FactInfo for the generic
  // walk below to group.
  const genMarker = facts.find(isConstructionMarker);
  if (genMarker) {
    const intro = constructionIntroForMarker(genMarker);
    const prereqFacts = facts.filter((f) => f !== genMarker);
    const steps: LessonStep[] = itemsFromFacts(prereqFacts).map((item) => ({
      type: "item",
      key: item.entry,
      item,
    }));
    // A marker with no intro cannot happen (every marker maps to a category), but
    // guard rather than crash.
    if (intro) steps.push({ type: "intro", key: intro.id, intro });
    return steps;
  }

  const grammarLessons = grammarLessonsForFacts(facts);
  if (grammarLessons.length > 0) {
    const grammarSteps: LessonStep[] = [];
    for (const grammarLesson of grammarLessons) {
      for (const page of grammarLesson.pages) {
        if (page.kind === "teach") {
          const termId = GRAMMAR_CARD_TERM[page.card.id];
          if (termId) {
            // A teach card whose home is a term page. Okurigana's two cards both
            // map here; the term page shows both, so a second consecutive card
            // for the same term folds into the step already pushed rather than
            // showing the page twice.
            const key = `term:${termId}`;
            const last = grammarSteps[grammarSteps.length - 1];
            if (!(last && last.type === "term" && last.key === key)) {
              grammarSteps.push(termStep(termId));
            }
          } else {
            grammarSteps.push({ type: "intro", key: page.card.id, intro: page.card });
          }
        } else {
          for (const item of itemsFromFacts([...page.facts])) {
            grammarSteps.push({ type: "item", key: item.entry, item });
          }
        }
      }
    }
    return grammarSteps;
  }

  const items = itemsFromFacts(facts);
  const steps: LessonStep[] = [];
  // Which tracks are OPENING here — the ones the learner has no record of
  // outside this very lesson. Each owes its intro card ahead of its first item.
  // Optional, and absent means "no track cards": a caller with no history to
  // read (a test naming a teach set, and nothing else today) gets exactly the
  // walk this function produced before track intros existed.
  const teachSet = new Set(facts);
  const started = history ? startedTracks(history, teachSet) : null;
  // Fired at most once each, so a lesson that opens a track and then teaches
  // twenty of its items shows the card once, at the top.
  const trackCardDone = new Set<TrackId>();
  // The three spine cards (radical, kanji, word) are planned over the whole walk
  // and skipped in the per-item track block below. See spine-intros.ts: on one
  // ordered curriculum a subject is not a track, and where a card goes depends on
  // what else the walk contains.
  // Spine intros belong to the curriculum; don't fire them inside a keigo OR a
  // counters lesson, where the prereq kanji are context for the material, not the
  // lesson's own subject. A counters form lesson now prepends number-kanji prereq
  // items (囗, 四, …) exactly the way a keigo lesson prepends its verbs' kanji.
  const isContextKanjiLesson =
    items.some((it) => it.kind === "keigo") ||
    items.some((it) => COUNTER_ENTRIES.has(it.entry));
  const spinePlan =
    history && !isContextKanjiLesson
      ? spineIntroPlan(items, history, teachSet, shownIntros)
      : new Map<number, PhaseIntro[]>();
  // A converted kana is not taught on its own card. Its whole row is one
  // lesson — "voice the k and it becomes g" — so the first character of a row
  // to come past emits that row's card, at the position it would have had, and
  // its other four fold into the same card rather than adding four steps. See
  // src/data/dakuten-rows.ts.
  const rowsSeen = new Set<string>();
  // Yōon has no per-combo hook the way dakuten has a per-conversion one — one
  // shared rule, authored once per script as COMBO_H/COMBO_K (see
  // src/data/yoon-rows.ts's header) — so its concept card is not folded into a
  // row card the way `rowsSeen` folds dakuten's five. It rides the first yōon
  // combo about to be taught, ONCE PER SCRIPT rather than once per combo.
  //
  // Not `shownIntros`: COMBO_H/COMBO_K are not in CONCEPT_CARD_IDS, the same
  // call INTRO_BEFORE's "h-g"/"k-g" (dakuten) already makes — re-teaching the
  // phase is allowed to show the card again, by design (see this file's header:
  // "a group re-taught later shows its card again"). But "already introduced"
  // still has to mean something truer than "seen earlier in THIS forEach", or
  // teaching a later combo section (h-sha, h-pya, …) on its own — the ordinary
  // shape once h-kya's lesson is behind it — would look like the first combo
  // ever and show the card a second time. So the flag is seeded two ways:
  //
  //   - the teach set OPENS exactly on "h-kya"/"k-kya": INTRO_BEFORE anchors its
  //     own copy of this same card there (added by SAK-72 Part B, ahead of this
  //     fix) and unshifts it at the very end of this function, so the flag is
  //     pre-seeded true to stop the per-item check below from doubling it.
  //
  //   - `history` shows ANY combo of this script already met OUTSIDE this
  //     lesson's own facts — the same "history minus the teach set" read
  //     `startedTracks` uses (src/lib/track-open.ts) — meaning some earlier
  //     lesson already taught that script's first combo and, by this same
  //     logic running then, already showed the card.
  //
  // Absent `history` (SSR, a test naming one section's teach set) there is no
  // record to check, so the flag falls back to the opensOn seed alone — the
  // same "no history, no track/concept cards beyond opensOn" default
  // `markedPitch`/`markedOnyomi` already take.
  const opensOnCombo = items.length ? sectionOf(items[0]) : null;
  let markedComboH =
    opensOnCombo === "h-kya" ||
    !history ||
    yoonScriptMet("hiragana", teachSet, history);
  let markedComboK =
    opensOnCombo === "k-kya" ||
    !history ||
    yoonScriptMet("katakana", teachSet, history);
  // The iteration mark rides the first word whose spelling uses 々, and only the
  // first one, so a teach set full of 々 words teaches it once.
  let markedIteration = false;
  // Rendaku rides the first word that actually voices at a compound seam (仕事,
  // rank 22) — far ahead of 々 — so it is a rule already in hand by the time 々's
  // own voicing turns up. See hasRendaku.
  let markedRendaku = false;
  // Transitivity rides the first pair item of the teach set — the moment the
  // pair contrast is in play — so its intro lands once, ahead of the first pair,
  // the same word-gated shape the rules above use. See phase-intros.ts.
  let markedTransitivity = false;
  // The pitch card rides the first word carrying a verified pitch, so the overline
  // is taught before it is first drawn (on that word's reveal). ONCE EVER, not per
  // lesson: it is a concept card whose id lives in CONCEPT_CARD_IDS, so a learner
  // who has already read it (`shownIntros`) is never shown it again — ~69% of
  // words have pitch, so a per-lesson gate would put it ahead of nearly every word
  // lesson. Gated on `history` for the same reason the spine cards are: a caller
  // with no history (a test naming a teach set) gets the pre-track walk, and only
  // the app, which always passes history and the shown set, ever fires it.
  let markedPitch = shownIntros.has(PITCH_INTRO.id) || !history;
  // The on'yomi card and the "how a kanji is built" card ride the first
  // curriculum kanji that needs each — the first with an on'yomi, and the first
  // whose Built-from box has pieces to show. Once ever (ids in CONCEPT_CARD_IDS),
  // so a learner who has read one is never shown it again. Skipped in a context
  // kanji lesson (keigo/counters), where the kanji are material for the track's
  // own subject rather than the curriculum's — the same call the spine cards make.
  let markedOnyomi =
    shownIntros.has(ONYOMI_INTRO.id) || !history || isContextKanjiLesson;
  let markedBuiltFrom =
    shownIntros.has(BUILT_FROM_INTRO.id) || !history || isContextKanjiLesson;
  items.forEach((item, index) => {
    // THE CONCEPT CARDS GO FIRST, ahead of everything else this item might owe:
    // ahead of its conversion row, ahead of any rule card. A learner meeting
    // words has to be told what a word is before being told what okurigana is,
    // and the rule cards below all assume that vocabulary. Placed at the top of
    // the loop and not after the `continue` a repeated conversion row takes, so
    // a track whose first item happens to be a converted kana still gets its
    // card.
    //
    // The SPINE cards lead, at the positions the plan chose. More than one can
    // land on the same item, and they arrive down the hierarchy (kanji, then
    // radical), so the second reads as one level deeper and not as an unrelated
    // second announcement.
    for (const intro of spinePlan.get(index) ?? []) {
      // The kanji and radical spine cards are shown as their term page now. The
      // term step carries the intro id as `conceptId`, so the once-ever record
      // still fires for it.
      const termId = SPINE_TERM[intro.id];
      if (termId) steps.push(termStep(termId, intro.id));
      else steps.push({ type: "intro", key: intro.id, intro });
    }
    // Then the remaining TRACK cards, still opened by subject: kana's two
    // scripts, grammar, counters and keigo are each their own track with their
    // own first lesson, and nothing about the spine changed that. The three spine
    // tracks are skipped here, because the block above owns them.
    const track = started ? trackOfItem(item) : null;
    if (track && !SPINE_TRACKS.has(track) && !started!.has(track) && !trackCardDone.has(track)) {
      trackCardDone.add(track);
      const termIntros = TRACK_TERM_INTROS[track];
      if (termIntros) {
        // The redesigned intros ARE the term pages: kana then hiragana, katakana
        // on its own. Rendered by TermEntryView in the walk (the same page the
        // Library shows), so a learner meets the term where it is first used.
        for (const id of termIntros) {
          steps.push({ type: "term", key: `term:${id}`, entry: termEntry(id) });
        }
      } else {
        const intro = TRACK_INTROS[track];
        steps.push({ type: "intro", key: intro.id, intro });
      }
    }
    const row = item.kind === "kana" ? dakutenRowFor(item.glyph) : null;
    if (row) {
      // `return` and not `continue`: the walk is planned per index now, so the
      // loop is a forEach. Same skip either way.
      if (rowsSeen.has(row.id)) return;
      rowsSeen.add(row.id);
      steps.push({ type: "conversion", key: row.id, row });
      return;
    }
    // Unlike a dakuten row, a yōon combo still gets its own item step (it is a
    // real new shape to drill, not a rule that replaces five character cards) —
    // this only adds the concept card ahead of the FIRST one per script, the
    // same "concept card leads its material" placement as the checks below.
    const yoonRow = item.kind === "kana" ? yoonRowFor(item.glyph) : null;
    if (yoonRow?.setId === "hiragana" && !markedComboH) {
      markedComboH = true;
      steps.push({ type: "intro", key: COMBO_H.id, intro: COMBO_H });
    } else if (yoonRow?.setId === "katakana" && !markedComboK) {
      markedComboK = true;
      steps.push({ type: "intro", key: COMBO_K.id, intro: COMBO_K });
    }
    if (!markedIteration && item.glyph.includes(ITERATION_GLYPH)) {
      markedIteration = true;
      steps.push({ type: "intro", key: ITERATION_MARK.id, intro: ITERATION_MARK });
    }
    if (!markedRendaku && item.kind === "word" && hasRendaku(item.glyph)) {
      markedRendaku = true;
      // Rendaku is taught on its term page (cards: [RENDAKU]). Per-lesson gated
      // by `markedRendaku`, not once-ever, so no conceptId.
      steps.push(termStep("rendaku"));
    }
    if (!markedTransitivity && item.kind === "transitivity") {
      markedTransitivity = true;
      steps.push({ type: "intro", key: TRANSITIVITY_INTRO.id, intro: TRANSITIVITY_INTRO });
    }
    // The counter sound-change rule is no longer form-gated here: each object
    // counter is a generative CATEGORY that carries its own rule card (attach +
    // sound shift) as its whole teach walk, detected by the marker branch above.
    // The overline is about to appear on this word, so teach it first. Gated on
    // the item TEACHING the word (its reading fact is in the step), NOT on
    // item.kind: a folded character like 何 leads as its kanji (kind "kanji") yet
    // teaches the word 何 in the same step, and its word-reading reveal draws the
    // overline. Keying on kind alone missed exactly that — the first pitch word a
    // learner meets — so key on the fact instead. wordPitch is on the written
    // form; a word with none draws no line and is not what this card waits for.
    if (
      !markedPitch &&
      wordPitch(item.glyph) !== null &&
      item.facts.includes(wordReadingFactId(item.glyph))
    ) {
      markedPitch = true;
      // The word track opens the pitch idea on its term page, then the mora term
      // (a pitch is drawn over a word's morae, so mora is defined right after).
      // Pitch is once-ever (its id is in CONCEPT_CARD_IDS), so its term step
      // carries the conceptId; mora rides the same gate and needs no record.
      steps.push(termStep("pitch-accent", PITCH_INTRO.id));
      steps.push(termStep("mora"));
    }
    // The on'yomi card, ahead of the first kanji taught here that has one. Gated
    // on the step actually TEACHING the kanji (its meaning fact is in the step),
    // so a kanji merely referenced elsewhere does not trip it — the same shape the
    // pitch gate uses. The on'yomi card leads the built-from card when both come
    // due on one kanji, because the built-from copy leans on the on-reading it
    // just named.
    if (!markedOnyomi && item.facts.includes(meaningFactId(item.glyph)) && hasOnyomi(item.glyph)) {
      markedOnyomi = true;
      // On'yomi is taught on the kun'yomi/on'yomi term page (cards: [ONYOMI_INTRO]).
      // Once-ever, so the term step carries the intro id as its conceptId.
      steps.push(termStep("kunyomi-onyomi", ONYOMI_INTRO.id));
    }
    // The "how a kanji is built" card, ahead of the first kanji whose Built-from
    // box has semantic/phonetic pieces to point at, so the distinction lands with
    // a real example on screen.
    if (
      !markedBuiltFrom &&
      item.facts.includes(meaningFactId(item.glyph)) &&
      !isNumberKanji(item.glyph) &&
      builtPieces(item.glyph).length > 0
    ) {
      markedBuiltFrom = true;
      steps.push({ type: "intro", key: BUILT_FROM_INTRO.id, intro: BUILT_FROM_INTRO });
    }
    steps.push({ type: "item", key: item.entry, item });
  });
  if (!items.length) return steps;

  const opensOn = sectionOf(items[0]);
  const before = opensOn ? INTRO_BEFORE[opensOn] : undefined;
  if (before) steps.unshift({ type: "intro", key: before.id, intro: before });

  // Closing a script can owe more than one card — long vowels AND small っ both
  // come due once every shape is known — so this is a list where the opening
  // side is a single card. They are pushed in table order, and each is an
  // ordinary step: the walk pages through them and the HUD counts them like
  // anything else, which is the whole reason both read this function.
  const closesOn = sectionOf(items[items.length - 1]);
  const after = closesOn ? INTRO_AFTER[closesOn] : undefined;
  for (const intro of after ?? []) {
    steps.push({ type: "intro", key: intro.id, intro });
  }

  return steps;
}
