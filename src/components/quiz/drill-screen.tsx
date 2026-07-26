"use client";

// Drill screen — port of the legacy quiz engine (startQuiz/nextQuestion/
// buildMC/submit/timer/bindDrill) from legacy/app.html.
//
// State contract (see src/lib/quiz-session.tsx): ALL mutable quiz state lives
// in `active.runtime` (a stable, JSON-serializable object) so tab switches
// (unmount/remount) resume mid-question and a page refresh survives via the
// provider's sessionStorage snapshot. The countdown syncs its remaining
// seconds into the runtime on every tick, because effect cleanups don't
// reliably run on page unload.
//
// Config split: builder settings (mode, source-based ask forms, length) come from
// active.snapshot, frozen at Start Quiz. Settings-page values (retries,
// timer, showAnswer, scriptLabel, fonts, and the four HUD toggles) are read
// live from useQuizConfig so mid-drill drawer / Settings-tab edits apply
// instantly.
//
// Timer pauses while away: the interval stops on unmount (remainder already
// in runtime) and resumes from the stored remainder on remount.
//
// The view: information stays, interaction fades. The HUD is small, quiet
// pills that are always readable; End quiz and the gear drop to 22% and wake
// on mouse move. Progress, the halo and the glyph are always there; streak,
// live accuracy and retry pips are the user's call — all four toggles are in
// the drawer, so the screen dials from zen (all off) to instrumented (all on)
// without ending the session.

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { MnemonicImage } from "@/components/lesson/mnemonic-image";
import { PitchReading } from "@/components/library/pitch-mark";
import { Btn, SmallBtn } from "@/components/ui";
import { wordPitch } from "@/data/pitch";
import { VOCAB_SUBJECT, vocabRow, wordMeaningFactId } from "@/data/vocab";
import { formatAccuracy } from "@/lib/accuracy";
import { BEHAVIOR, pickFont } from "@/lib/config";
import { answerGuide, confusionNote } from "@/lib/drill-guidance";
import { resolveShowing, statForShowing } from "@/lib/drill-stats";
import { sessionAccuracy } from "@/lib/session-accuracy";
import {
  answerIsJapanese,
  buildDeck,
  buildMcOptions,
  checkTyped,
  confusedWith,
  firstTryCredit,
  grammarVehicleFor,
  questionsFor,
  requeueGap,
  retriesAllowed,
  revealFor,
  shuffle,
  type GrammarSelection,
  type GrammarVehicle,
  type PromptContext,
} from "@/lib/engine";
import { hintFor } from "@/lib/engine/hint";
import { entryOf, factInfo } from "@/lib/facts";
import { speechForFact } from "@/lib/fact-speech";
import { fitGlyphSize } from "@/lib/glyph-fit";
import { confusionKnownFacts } from "@/lib/confusion-search";
import { meaningMustShowGlyph } from "@/lib/homophone";
import {
  pickRecognitionForFact,
  type RecognitionItem,
} from "@/lib/listen-sentence";
import {
  buildCoverageDeck,
  enabledFormsFor,
  formIsMc,
  jp2enResponse,
  type CardForm,
} from "@/lib/ask-forms";
import { toKana } from "@/lib/romaji";
import { quizInstruction } from "@/lib/quiz-instruction";
import { presentationPhrase } from "@/lib/question-presentation";
import { speak } from "@/lib/speech";
import { useHistory } from "@/lib/use-history";
import { anchorForFact, isReadingFact } from "@/lib/word-unlock";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import type {
  AccuracyMetric,
  Direction,
  EntryId,
  FactId,
  SessionStats,
  ShowingPresentation,
} from "@/types";

import { DrillDrawer } from "./drill-drawer";
import { DrillHalo, GLYPH_PX, type HaloState } from "./drill-halo";

// ---------- runtime shape (lives in active.runtime) ----------

interface DrillQuestion {
  /** The FACT being asked. What goes on screen for it is the fact's subject's
   * business (engine/question.ts), not this screen's. */
  f: FactId;
  /** The settings combination pinned to this showing. Coverage supplies it
   * from the deck; Count/Endless choose one when the card is drawn. */
  form: CardForm;
  dir: Direction;
  /** Wrong attempts so far on this card. */
  tries: number;
  /** JP font picked when the question was asked — stable across remounts. */
  font: string;
  /** Multiple-choice option FACTS, frozen at ask time; null in typed mode, and
   * null too when the subject had no plausible distractors to offer — see
   * buildMcOptions. A one-option question is not a question. */
  mc: FactId[] | null;
  /** Per-option fonts for en2jp MC labels. */
  mcFonts: string[] | null;
  /**
   * An AUDIO-PROMPT (listening) showing: the word is played, its glyph is NOT
   * shown, and the learner answers the romaji reading or the meaning on the
   * same jp2en path as the visual card. Rolled once at ask time (like `font`
   * and `mc`) so a remount neither re-decides it nor re-plays it. false for
   * every card until the learner opts in — see src/lib/listen.ts. Plain data,
   * so it rides the serialized runtime.
   */
  listen: boolean;
  /**
   * The verb this grammar PRODUCTION showing is built on — rolled once at ask
   * time so a remount doesn't re-pick it, exactly like `font` and `mc`. null
   * for every non-grammar card and for a grammar card with no varied vehicle
   * (it then runs on the fixed 行く baked in the fact). Plain data, so it rides
   * the serialized runtime. */
  grammarVehicle: GrammarVehicle | null;
  /**
   * The corpus sentence a grammar MEANING card is asking as a fill-the-blank
   * SELECTION item — rolled once at ask time exactly like `font`, `mc` and
   * `grammarVehicle`, so a remount cannot swap the sentence or the board under
   * the user. null for every other card, and for a pattern the corpus can make
   * no safe item out of; that one is asked the old way (the pattern, "meaning",
   * glosses to choose between), unchanged. Plain data, so it rides the
   * serialized runtime. */
  grammarSelection: GrammarSelection | null;
  /** Japanese-sentence → English-meaning board (text or audio). Its options are strings rather
   * than FactIds, so it carries its own correct index. */
  recognition: RecognitionItem | null;
  /**
   * Whether the HINT was taken on this showing.
   *
   * Per SHOWING, not per card and not per attempt. It is set here — beside
   * `font`, `mc`, `grammarVehicle` and `grammarSelection` — for exactly the
   * reason they are: everything frozen at ask time lives on `q`, and `q` is
   * rebuilt from scratch by nextQuestion, so the flag resets when the next card
   * is asked and cannot survive a remount as a stale true. (The `??=` hazard the
   * same reason this is written flat at construction rather than defaulted
   * later.)
   *
   * It stays true across RETRIES of the same showing, which is the point: the
   * hint you read on try one is still on screen on try two.
   *
   * WHAT IT COSTS: the first-try credit, and nothing else. See submit — the
   * showing still counts as seen, still counts as correct, still ends the card;
   * it just cannot be `firstTryCorrect`. Nothing is persisted about hints: a
   * hinted-correct answer is recorded exactly as a "right on the second try" one
   * is, which is already what "did not nail it" means everywhere in this app.
   */
  hinted: boolean;
  /**
   * The ENTRY a wrong answer on this showing named — what they said INSTEAD.
   * Null until a miss resolves one, and null for most misses (see
   * `confusedWith`: it claims an entry only when exactly one in the deck
   * answers to what was typed).
   *
   * Held per SHOWING, not per attempt, and deliberately not cleared by a later
   * attempt that resolves nothing. Answering あ on try one and gibberish on try
   * two still mixed あ up with お, and the reveal is the only moment left to say
   * so. Written flat at construction like `hinted`, so the next card starts
   * clean and a remount cannot carry a stale one across.
   *
   * Scored nowhere. `st.confused` is the record; this is only what the reveal
   * reads to decide whether it has a mix-up to name.
   */
  confused: EntryId | null;
}

/** The presentation a resolving showing writes into its stat, so the results
 * and retry screens can say how it was asked. `mc` present means a board was
 * offered; its absence is a typed box. See ShowingPresentation. */
function showingOf(q: DrillQuestion): ShowingPresentation {
  return {
    dir: q.dir,
    mode: q.mc || q.recognition ? "mc" : "typed",
    listen: q.listen,
  };
}

/** The per-showing presentation context for a card: the anchor word for a kanji
 * reading, the vehicle verb for a grammar production, the blanked sentence for a
 * grammar selection. Rebuilt from the frozen runtime so prompt, check, options
 * and reveal all agree on one showing. */
function ctxFor(q: DrillQuestion, anchor?: string): PromptContext {
  return {
    anchor,
    grammarVehicle: q.grammarVehicle ?? undefined,
    grammarSelection: q.grammarSelection ?? undefined,
  };
}

/**
 * An MC option's visible text.
 *
 * jp2en offers ANSWERS to pick between (romaji, meanings, readings); en2jp
 * offers GLYPHS. Which is the same asymmetry the prompt has, in reverse — the
 * option side always shows whatever the prompt side is not.
 */
function labelOf(fact: FactId, dir: Direction, ctx?: PromptContext): string {
  // A subject may override the visible text per showing — grammar production
  // shows the pattern built on this card's vehicle (食べたい, not the baked
  // 行きたい). Everyone else has no optionLabel and falls to glyph/answer.
  const shown = questionsFor(fact).optionLabel?.(fact, dir, ctx);
  if (shown != null) return shown;
  const info = factInfo(fact);
  if (!info) return "";
  return dir === "en2jp" ? info.glyph : (info.answers[0] ?? "");
}

function retryBoxKey(fact: FactId, phrase: string): string {
  return JSON.stringify([fact, phrase]);
}

function recordMissedPhrase(
  st: ReturnType<typeof statForShowing>,
  phrase: string,
  said?: string | null,
): void {
  const list = st.missedPhrases ?? (st.missedPhrases = []);
  if (!list.includes(phrase)) list.push(phrase);
  const cleaned = (said ?? "").trim();
  if (!cleaned || cleaned === "--") return;
  const map = st.saidByPhrase ?? (st.saidByPhrase = {});
  map[phrase] = cleaned;
}

/** How the last answer landed. There is no `text`: the halo IS the feedback —
 * green sweep for right, red pulse for wrong — so a sentence would only repeat
 * in prose what the colour already said. The one thing colour can't say is
 * WHICH answer was right, and that surfaces in the answer slot instead (the
 * input, or the correct MC option), the same way grid mode already reveals. */
interface DrillFeedback {
  kind: "good" | "bad";
}

/** Everything here must stay JSON-serializable (numbers/strings/plain
 * objects — no functions, no Infinity) for the sessionStorage snapshot. */
interface DrillRuntime {
  deck: FactId[];
  /** Facts with at least one form supported by this run and its readable
   * sentence pool. Endless replenishes from this filtered set. */
  pool: FactId[];
  /** Form pinned to each deck slot. null means choose one when the slot is
   * drawn (Count/Endless, plus restored pre-task-30 runtimes). */
  forms: Array<CardForm | null>;
  /** Next deck index to draw from. */
  pos: number;
  /** Questions SHOWN so far. Used to key the per-question remount, not to
   * display progress — a card is shown before it's answered. */
  asked: number;
  /** Questions RESOLVED — answered correctly, or re-queued after running out
   * of retries. This is what "N answered" and the progress bar count: a card
   * you're still mid-retry on isn't done, and the count shouldn't tick to 1
   * the instant a card appears. */
  resolved: number;
  /** Cards spliced back into the deck after exhausting retries. */
  requeued: number;
  /** Consecutive cards answered right on the FIRST try; any miss (or a
   * timeout) puts it back to 0. In the runtime, not React state, so it
   * survives a tab switch and a refresh like everything else here. */
  streak: number;
  stats: SessionStats;
  q: DrillQuestion | null;
  /** True between an answer resolving and the next card. */
  waiting: boolean;
  feedback: DrillFeedback | null;
  /** Remaining countdown seconds; null when the timer is off. */
  timerLeft: number | null;
}

interface DrillHandlers {
  tick(): void;
  nextQuestion(): void;
  skipQuestion(): void;
  onKeyDown(e: KeyboardEvent): void;
  onMount(): void;
  onUnmount(): void;
  onTimerCfgChange(): void;
}

/** The ring only wakes for the last few seconds — and if the whole timer is
 * shorter than that, the whole card is the last few seconds. */
const DRAIN_WINDOW_S = 5;
/** How long the controls stay lit after the mouse stops. */
const CONTROLS_IDLE_MS = 2000;
// MC_MISS_ADVANCE_MS (1600) WAS HERE: how long a resolved multiple-choice MISS
// held on screen before advancing itself, so a mouse user was not stranded on
// the reveal with no keystroke to leave it by. It is gone, and no number
// replaces it. The reveal is the only place the app tells you the answer you
// just failed to give, and a deadline on reading it made the app score the
// learner and then withhold the lesson — the beginner audit's worst finding,
// and the one it said would make them quit. A miss now waits for Enter or the
// Continue button, in every mode. Only a CORRECT answer still auto-advances
// (650ms), which is what that mechanism was for.

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---------- reduced motion ----------

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** useSyncExternalStore rather than an effect: no post-mount setState, and
 * the SSR snapshot is simply "no". */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

// ---------- the mnemonic drawing, before it is offered ----------

/**
 * Whether the drawing at `src` actually exists.
 *
 * getMnemonic hands out a CANDIDATE path for every kana whether or not the webp
 * has been drawn (28 of 46 hiragana today, no katakana), and that is deliberate:
 * the owner adds a picture by dropping a file in, with no registry to update. On
 * a lesson card that is free — MnemonicImage loads it and falls back to the
 * glyph on a 404. Here it is not, because the fallback glyph IS the prompt: a
 * Hint button that spends your first-try credit to reprint the character you
 * were just shown is a worse outcome than no button.
 *
 * So the drill asks the only question that respects the no-registry rule: it
 * loads the image and offers the button when it arrives. Browser-cached after
 * the first time a kana comes round, and the button lives in a fixed-height row,
 * so nothing moves when it appears.
 */
function useDrawnImage(src: string | null): boolean {
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (!src) return;
    let live = true;
    const img = new window.Image();
    img.onload = () => {
      if (live) setLoaded(src);
    };
    img.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  return src !== null && loaded === src;
}

// ---------- HUD pieces ----------

/** Small, quiet HUD chip. `tone` is the only colour the HUD ever uses. */
function Pill({
  tone = "quiet",
  children,
}: {
  tone?: "quiet" | "accent" | "warm";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "kq-material rounded-full border px-2.5 py-0.5 text-[11px] tabular-nums",
        tone === "accent"
          ? "border-accent/40 bg-accent-bg text-accent"
          : tone === "warm"
            ? "border-warning/40 bg-warning-bg text-warning"
            : "border-border text-text-muted",
      )}
    >
      {children}
    </span>
  );
}

/** Live session accuracy. The arithmetic is src/lib/session-accuracy.ts — it
 * moved out of this file because it was wrong (a per-fact flag over a
 * per-showing count) and a .tsx cannot be unit-tested here. */
function liveAccuracy(stats: SessionStats, metric: AccuracyMetric): number | null {
  return sessionAccuracy(stats, metric);
}

export function DrillScreen() {
  const { cfg, ready } = useQuizConfig();
  const { active, session, finishQuiz, setProgress, saveNow, reviewLesson } =
    useQuizSession();
  // History, for two things, and NEITHER of them is grading. Framing an
  // unlocked kanji reading on a word the user actually learned (word-unlock.ts),
  // and deciding whether a grammar pattern has a selection sentence she can read
  // (grammar/readable.ts). Both move what is SHOWN; the fact asked and the score
  // recorded are untouched by either.
  const { history } = useHistory();

  // Runtime mutations don't go through setState — bump this to re-render.
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [typed, setTyped] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [controlsAwake, setControlsAwake] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Whether THIS render has a hint to give — including, for kana, whether the
   * drawing actually exists (see useDrawnImage). Mirrored into a ref because the
   * document keydown handler has to answer the same question the button does,
   * and the button's answer is computed down in the render. */
  const hintReadyRef = useRef(false);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  /** Async entry points (interval, timeout, document keydown) call through
   * here so they always see the closures from the latest render. */
  const handlersRef = useRef<DrillHandlers | null>(null);

  const reducedMotion = usePrefersReducedMotion();
  const rt = active ? (active.runtime as unknown as DrillRuntime) : null;
  const limited =
    !!active && (active.forceCoverage || active.snapshot.length === "limited");

  // ---------- engine (fresh closures each render; legacy port) ----------

  /** Take the hint on this showing. Idempotent, and refused once the card has
   * resolved: a hint after the answer is in would be a scoring change with
   * nothing to show for it. It deliberately does NOT touch `q.tries` — a retry
   * pip is a separate affordance and a hint must never spend one. */
  function takeHint() {
    if (!rt || !rt.q || rt.waiting || rt.q.hinted || finishedRef.current) return;
    // A card with no hint must not be able to spend the first-try credit on
    // nothing. The button is already absent there; this guards the key, which
    // has no button to be absent.
    if (!hintReadyRef.current) return;
    rt.q.hinted = true;
    force();
  }

  function stopCountdown() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function clearAdvance() {
    if (advanceRef.current) {
      clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
  }

  function syncProgress() {
    if (!rt) return;
    setProgress({ done: rt.resolved, total: limited ? rt.deck.length : null });
  }

  /** Legacy startTimer: countdown from `from`, ticking once a second. Each
   * tick writes the remainder into the runtime (refresh survival). */
  function startCountdown(from: number) {
    if (!rt) return;
    stopCountdown();
    rt.timerLeft = from;
    intervalRef.current = setInterval(() => handlersRef.current?.tick(), 1000);
  }

  function tick() {
    if (!rt || !rt.q || rt.waiting) return;
    rt.timerLeft = Math.max(0, (rt.timerLeft ?? 0) - 1);
    if (rt.timerLeft <= 0) {
      submit("(time)");
      return;
    }
    force();
  }

  function endQuiz() {
    if (!rt || finishedRef.current) return;
    finishedRef.current = true;
    stopCountdown();
    clearAdvance();
    finishQuiz(rt.stats);
  }

  /** Legacy nextQuestion: advance the deck (replenishing from the SNAPSHOT
   * chars when endless, finishing when limited runs out) and ask a card. */
  function nextQuestion() {
    if (!active || !rt || finishedRef.current) return;
    clearAdvance();
    stopCountdown();
    rt.waiting = false;
    rt.feedback = null;
    if (rt.pos >= rt.deck.length) {
      if (limited || rt.pool.length === 0) {
        endQuiz();
        return;
      }
      rt.deck = rt.deck.concat(shuffle(rt.pool.slice()));
      rt.forms = rt.forms.concat(rt.pool.map(() => null));
    }
    const f = rt.deck[rt.pos];
    const pinned = rt.forms[rt.pos] ?? null;
    rt.pos++;
    rt.asked++;
    // A subject may pin the direction (transitivity is only askable en2jp) and
    // force multiple choice — in both directions (transitivity: its answer is a
    // pick, never a typed verb) or in one (kana en2jp: the prompt is the romaji,
    // so a typed box grades the prompt retyped as correct). Read both off the
    // question type before choosing a direction or a typed mode, so those
    // choices honor the subject rather than override it.
    // Coverage pins the exact form in the deck. Count and Endless choose one
    // supported form now, once, and put it on q so remounts and retries cannot
    // reroll it.
    // A MEANING question for a word whose reading collides with another word the
    // learner knows must show the written form — 箸 and 橋 are both はし, so an
    // audio-only "what does it mean" has two right answers. So the listening
    // (glyph-hidden) showing is refused for that word's meaning card; the visual
    // jp2en meaning card (箸 → ?) still shows the glyph and is unambiguous. Only
    // the meaning card is blocked: a READING listening card is fair, since every
    // homophone shares the reading the learner is asked to produce. See
    // src/lib/homophone.ts. Non-colliding words are untouched.
    const available = usableForms(f);
    const form =
      pinned ??
      available[Math.floor(Math.random() * available.length)] ?? {
        source: "japanese",
        response: jp2enResponse(f),
        listen: false,
        dir: "jp2en",
        answer: "typed",
      };
    const listen = form.listen;
    const dir = form.dir;
    const styleTyped = !formIsMc(f, form);
    // Romaji only ever produces KANA. An en2jp typed card whose answer contains
    // a kanji (a kanji glyph, a kanji word like 先生) can't be answered by
    // typing romaji, so it is asked as multiple choice instead — never left as
    // an un-typeable box that grades every answer wrong. jp2en typed always
    // stays typed: there the answer is the READING, which romaji spells for any
    // glyph. `en2jpTypeable` owns the "is the answer all kana" test, because for
    // a WORD asked by its meaning the en2jp answer is the kana reading — typeable
    // even though the written word carries kanji — and only the subject knows it.
    // `mcOnlyIn` and not `qt.mcOnly`: the flag is a boolean OR a single
    // Direction, and a bare truthiness test on the Direction form would force MC
    // in the direction it was meant to leave typed.
    const typedMode = styleTyped;
    // Font and MC options are rolled when the question is asked and stored in
    // the runtime so a remount doesn't reroll them.
    //
    // A subject with no distractors (words, today) yields a single option, and
    // a one-option multiple choice is a free point rather than a question. Fall
    // back to typed instead of showing it — see engine.buildMcOptions, which
    // returns short rather than padding with randoms.
    // A grammar production card picks its vehicle verb here, once, so the whole
    // showing (prompt, options, grading, reveal) runs on ONE verb and a remount
    // can't swap it. null for every other card and for a grammar card the pool
    // can't host — that one runs on the fixed baked vehicle, unchanged.
    //
    // History gates the pool to words the learner knows, exactly as it gates the
    // selection item below: a production is never drilled on a word she has not
    // met. Null (she knows none of the pool yet) falls back to the baked vehicle.
    const grammarVehicle = grammarVehicleFor(f, history);
    // A grammar MEANING card may be asked as a SELECTION item instead — "which
    // pattern fills this blank in a real sentence", rather than "what does this
    // pattern mean". Same fact, same score, a harder and more honest showing.
    //
    // Only on a card that was already going to be multiple choice: selection IS
    // multiple choice (its whole safety argument is about which distractors may
    // share a board), so offering it on a typed card would override a setting
    // the user chose. Null for every non-grammar fact, for a production fact,
    // and for a pattern with no safe corpus item.
    //
    // History gates it: an item is offered only when every content word in its
    // sentence is one the learner knows (lib/grammar/readable.ts). Null is the
    // ORDINARY answer early on — the card then falls back to the fixed meaning
    // question, which asks the pattern in one direction and its English in the
    // other, so grammar meaning is always askable.
    const grammarSelection = null;
    const recognition =
      form.source === "sentence" &&
      form.response === "definition"
        ? pickRecognitionForFact(f, history)
        : null;
    const ctx: PromptContext = {
      grammarVehicle: grammarVehicle ?? undefined,
      grammarSelection: grammarSelection ?? undefined,
    };
    // The selection board comes PRE-BUILT and pre-shuffled: its options were
    // chosen per-sentence by the generator, which proved each one wrong for THIS
    // frame (gloss, cluster, prefix and particle tests — see grammar/questions.ts).
    // buildMcOptions cannot reproduce that, because its distractors are a
    // property of the fact and these are a property of the sentence. They are
    // still FactIds, so everything downstream — grading by which option, the
    // reveal, confusion tracking — is the untouched existing path.
    const built = recognition
      ? null
      : grammarSelection
        ? grammarSelection.choices.slice()
        : typedMode
          ? null
          : buildMcOptions(f, dir, ctx, confusionKnownFacts(history));
    const mc = built && built.length > 1 ? built : null;
    rt.q = {
      f,
      form,
      dir,
      tries: 0,
      font: pickFont(cfg.fonts),
      mc,
      mcFonts: mc && dir === "en2jp" ? mc.map(() => pickFont(cfg.fonts)) : null,
      grammarVehicle,
      grammarSelection,
      recognition,
      listen,
      // A new showing has not been hinted. Written here rather than backfilled,
      // so there is exactly one place a showing's hint state begins.
      hinted: false,
      // Nothing has been said instead of this card's answer yet. Same rule.
      confused: null,
    };
    // Creates the stat, and deliberately advances NOTHING. `seen` used to tick
    // here, which put it in the same unit as `asked` while every numerator was
    // in the unit of `resolved` — see src/lib/drill-stats.ts for what that cost.
    statForShowing(rt.stats, f);
    if (cfg.timer) startCountdown(cfg.timerSec);
    else rt.timerLeft = null;
    setTyped("");
    syncProgress();
    force();
  }

  function usableForms(f: FactId): CardForm[] {
    if (!active) return [];
    return enabledFormsFor(f, active.snapshot.ask).filter(
      (candidate) =>
        !(
          candidate.source === "japanese" &&
          candidate.listen &&
          meaningMustShowGlyph(f, history)
        ) &&
        !(
          candidate.source === "sentence" &&
          candidate.response === "definition" &&
          pickRecognitionForFact(f, history, () => 0) === null
        ),
    );
  }

  /** Legacy submit (plus the streak, which is the same first-try question
   * `firstTryCorrect` already answers). `picked` is the option FACT for MC
   * clicks (both dirs). */
  function submit(given: string, picked?: FactId, recognitionPick?: number) {
    if (!rt || !rt.q || rt.waiting || finishedRef.current) return;
    const q = rt.q;
    // Clicking an MC option is answered by WHICH option, not by its label:
    // two options can carry the same text (two kanji meaning "life") and
    // comparing strings would mark a wrong click right. Typed answers go to the
    // subject's own checker.
    const ok =
      recognitionPick !== undefined && q.recognition
        ? recognitionPick === q.recognition.correct
        : picked !== undefined
          ? picked === q.f
          : checkTyped(q.f, given, q.dir, ctxFor(q));
    const st = statForShowing(rt.stats, q.f);
    const phrase = presentationPhrase(q.f, showingOf(q));
    // A HINT FORFEITS "NAILED IT", and that is the whole of what it costs. Right
    // with a hint is the third outcome: seen, correct, not first-try — which is
    // an existing shape, not a new one (it is what a second-try success already
    // records), so nothing about the persisted file or the standings changes.
    const credit = firstTryCredit(ok, q.tries, q.hinted);
    if (ok) {
      // The showing RESOLVED. `seen`, the flag, the first-try count and the
      // forgiving numerator all advance in one call so they cannot drift into
      // different units — which is exactly what they had done. See
      // src/lib/drill-stats.ts.
      resolveShowing(st, credit, true, showingOf(q));
      // Only a clean first try extends the streak — a miss below has already
      // zeroed it, so getting there on the retry doesn't restore it.
      if (q.tries === 0) rt.streak = (rt.streak ?? 0) + 1;
      rt.resolved++; // answered correctly — this card is done
      rt.feedback = { kind: "good" };
      rt.waiting = true;
      stopCountdown();
      clearAdvance();
      advanceRef.current = setTimeout(
        () => handlersRef.current?.nextQuestion(),
        650,
      );
    } else {
      rt.streak = 0; // any miss, including a timeout
      st.misses++;
      const mcSaid = picked != null ? labelOf(picked, q.dir, ctxFor(q)) : null;
      const typedSaid = given && given !== "(time)" ? given : null;
      const recognitionSaid =
        recognitionPick !== undefined && q.recognition
          ? q.recognition.options[recognitionPick] ?? null
          : null;
      recordMissedPhrase(st, phrase, recognitionSaid ?? mcSaid ?? typedSaid);
      // `confused` is keyed by ENTRY — the thing you said instead of this fact's
      // answer. See FactSessionDetail: a confusion is a failure to tell two
      // entries apart, so it cannot be keyed by one of their facts.
      if (picked !== undefined && picked !== q.f) {
        const said = entryOf(picked);
        // Two facts of ONE entry are not a confusion: picking 生's ショウ card
        // when the answer was 生's セイ card is a wrong answer about 生, not
        // mixing 生 up with something. `confused` is keyed by entry precisely
        // so this distinction has somewhere to live.
        if (said !== entryOf(q.f)) {
          st.confused[said] = (st.confused[said] ?? 0) + 1;
          // Same fact, remembered for the reveal rather than only counted. See
          // DrillQuestion.confused for why it is not cleared by a later try.
          q.confused = said;
        }
      } else if (given && given !== "(time)") {
        // The search space is the deck PLUS every fact of every entry the learner
        // has met — so a typed answer that names a KNOWN entry (its meaning OR its
        // reading) is caught even when that entry is not in today's deck, and even
        // when only the entry's OTHER fact carries a record. This is task 20's
        // 何↔可: Sam typed か (可's reading) on a reading card, but her known set
        // held only word:可/meaning, so the deck-plus-known-FACTS space had no fact
        // reading か and the confusion silently dropped. `confusionKnownFacts`
        // makes the space entry-complete — knowing 可's meaning makes its reading a
        // candidate — and `confusedWith` still claims a pair only when exactly one
        // entry answers, so the wider space stays honest. See confusion-search.ts.
        const said = confusedWith(q.f, given, rt.deck, confusionKnownFacts(history));
        if (said && said !== entryOf(q.f)) {
          st.confused[said] = (st.confused[said] ?? 0) + 1;
          q.confused = said;
        }
      }
      q.tries++;
      const left = retriesAllowed(cfg) - q.tries;
      if (left > 0) {
        // Red pulse + one fewer pip says "wrong, go again" without a sentence.
        // A timeout needs no words either: the ring visibly ran out.
        rt.feedback = { kind: "bad" };
        inputRef.current?.select();
        if (cfg.timer) startCountdown(cfg.timerSec);
      } else {
        // Out of retries: the card is done with (re-queued for later), so it
        // counts as resolved even though you didn't get it. `credit` is
        // necessarily false here; passing it keeps the one rule in one place.
        resolveShowing(st, credit, false, showingOf(q));
        rt.resolved++;
        rt.feedback = { kind: "bad" };
        const at = Math.min(rt.deck.length, rt.pos + requeueGap());
        rt.deck.splice(at, 0, q.f);
        rt.forms.splice(at, 0, q.form);
        rt.requeued++;
        rt.waiting = true;
        stopCountdown();
        // NOTHING IS ARMED HERE, and that is the fix for the audit's worst
        // finding. Multiple choice used to auto-advance after MC_MISS_ADVANCE_MS
        // (1600ms) because it is answered entirely by clicking, so a mouse user
        // had nothing to press Enter with. But the reveal — the one screen that
        // tells you the answer you just failed to give — renders exactly here,
        // and a timer that takes it away 1.6s later means the app scores you and
        // hides the answer. A beginner reported never once learning that `u` is
        // う, twice, and named it the thing that would make them quit.
        //
        // The auto-advance exists to keep a CORRECT answer flowing. It has no
        // business skipping a lesson. So a miss now waits for the user exactly
        // as a typed card does, and the mouse user gets a Continue button in the
        // reveal instead of a deadline. See the reveal block below.
        clearAdvance();
        syncProgress(); // requeue grew the limited total
      }
    }
    // The answer is on disk before the next card is drawn — right or wrong,
    // and whether or not anything React can see moved. The drill was less
    // exposed than the grid (`resolved` ticks on a requeue, so a run of misses
    // did get saved eventually) but a miss WITH retries left moves nothing
    // either, and there is no reason for two screens to have two different
    // answers to "is my answer saved yet".
    saveNow();
    force();
  }

  /**
   * Set the current card aside and ask it again later — the "not now, come back
   * to it" the user asked for, available at any point in answering a card.
   *
   * A card you HAVEN'T tried yet (`q.tries === 0`) is re-queued clean: nothing is
   * scored, so it costs no points, exactly as if you had never seen it — you just
   * meet it again in turn. A card you HAVE tried (a wrong attempt with retries
   * still left) keeps that attempt: the submission already happened, so it
   * resolves as the miss it was — the same `resolveShowing(…, false, false)` the
   * out-of-retries path makes — and then goes back for another showing. Either
   * way the card lands at the END of the deck (a new question to reach in turn,
   * not the small gap a forced requeue uses), and we advance to the next card.
   *
   * Not offered while `waiting`: once a card is out of retries it is already
   * resolved and requeued, and the Continue button is the only thing left to do.
   */
  function skipQuestion() {
    if (!active || !rt || !rt.q || rt.waiting || finishedRef.current) return;
    const q = rt.q;
    if (q.tries > 0) {
      // The attempt stands. `credit` is necessarily false after a wrong try, so
      // this records a first-try miss and marks the showing resolved, same as
      // running out of retries — see submit's out-of-retries branch.
      const st = statForShowing(rt.stats, q.f);
      resolveShowing(st, false, false, showingOf(q));
      rt.resolved++;
    }
    // The back of the deck, not `pos + requeueGap()`: a skip is a deferral to the
    // end, not the near-future nudge a missed card gets.
    rt.deck.push(q.f);
    rt.forms.push(q.form);
    rt.requeued++;
    stopCountdown();
    clearAdvance();
    syncProgress(); // the requeue grew a limited run's total
    saveNow();
    nextQuestion();
  }

  /** Legacy bindDrill document keydown: Enter advances while waiting, Enter
   * in the answer box submits, digits 1–9 click MC options. */
  function onKeyDown(e: KeyboardEvent) {
    if (!rt || !rt.q || finishedRef.current) return;
    if (rt.waiting) {
      if (e.key === "Enter") nextQuestion();
      return;
    }
    // "?" TAKES THE HINT, and it is the one key that works with the answer box
    // focused. The digits below deliberately stand off a focused field, but a
    // typed card is exactly where the box IS focused — a binding that only
    // worked on multiple choice would be no binding at all. "?" is safe to
    // swallow there: no romaji, no reading and no English gloss contains one, so
    // preventDefault cannot eat a character anybody was answering with. (1–9 are
    // the MC options and Enter submits, so both were spoken for.)
    if (e.key === "?") {
      e.preventDefault();
      takeHint();
      return;
    }
    if (e.key === "Enter" && document.activeElement === inputRef.current) {
      const v = inputRef.current?.value ?? "";
      if (v.trim()) submit(v);
      return;
    }
    if ((rt.q.mc || rt.q.recognition) && /^[1-9]$/.test(e.key)) {
      // Don't hijack digits typed into a field (e.g. the drawer's timer box).
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA")
      )
        return;
      const index = parseInt(e.key, 10) - 1;
      const opt = rt.q.mc?.[index];
      if (opt) submit(labelOf(opt, rt.q.dir, ctxFor(rt.q)), opt);
      else if (rt.q.recognition?.options[index]) {
        submit(rt.q.recognition.options[index], undefined, index);
      }
    }
  }

  function onMount() {
    if (!active || !rt) return;
    startedRef.current = true;
    finishedRef.current = false;
    if (!Array.isArray(rt.deck)) {
      // Fresh quiz — build the deck. Redrill forces one full-coverage pass
      // over exactly the given facts; otherwise honor the builder snapshot.
      const coverage =
        active.forceCoverage ||
        (active.snapshot.length === "limited" &&
          active.snapshot.limType === "cov");
      if (coverage) {
        const built = buildCoverageDeck(active.facts, active.snapshot.ask);
        const selectedBoxes = new Set(active.retryBoxes ?? []);
        const isBoxSelected = (f: FactId, form: CardForm): boolean => {
          if (!selectedBoxes.size) return true;
          const shown: ShowingPresentation = {
            dir: form.dir,
            mode: formIsMc(f, form) ? "mc" : "typed",
            listen: form.listen,
          };
          const phrase = presentationPhrase(f, shown);
          return selectedBoxes.has(retryBoxKey(f, phrase));
        };

        const keep = built.deck.map((f, i) => {
          const form = built.forms[i];
          return !(
            (form.source === "japanese" &&
              form.listen &&
              meaningMustShowGlyph(f, history)) ||
            (form.source === "sentence" &&
              form.response === "definition" &&
              pickRecognitionForFact(f, history, () => 0) === null) ||
            !isBoxSelected(f, form)
          );
        });
        rt.deck = built.deck.filter((_, i) => keep[i]);
        rt.forms = built.forms.filter((_, i) => keep[i]);
        rt.pool = [...new Set(rt.deck)];
      } else {
        rt.pool = active.facts.filter((f) => usableForms(f).length > 0);
        rt.deck = buildDeck(rt.pool, { ...cfg, ...active.snapshot });
        rt.forms = rt.deck.map(() => null);
      }
      rt.pos = 0;
      rt.asked = 0;
      rt.resolved = 0;
      rt.requeued = 0;
      rt.streak = 0;
      rt.stats = {};
      rt.q = null;
      rt.waiting = false;
      rt.feedback = null;
      rt.timerLeft = null;
      nextQuestion();
      return;
    }
    if (!Array.isArray(rt.forms)) rt.forms = rt.deck.map(() => null);
    if (!Array.isArray(rt.pool)) {
      rt.pool = active.facts.filter((f) => usableForms(f).length > 0);
    }
    // Resuming a runtime written before these fields existed.
    if (typeof rt.streak !== "number") rt.streak = 0;
    // A showing in flight from before the hint existed was not hinted. Reading
    // `undefined` as "not hinted" is also what the flat `!q.hinted` test in
    // submit does, so this is belt and braces rather than the load-bearing part.
    if (rt.q && typeof rt.q.hinted !== "boolean") rt.q.hinted = false;
    if (rt.q && !rt.q.form) {
      rt.q.form = {
        source: rt.q.dir === "en2jp" ? "english" : "japanese",
        response:
          rt.q.dir === "en2jp" ? "japanese" : jp2enResponse(rt.q.f),
        listen: !!rt.q.listen,
        dir: rt.q.dir,
        answer: rt.q.mc || rt.q.recognition ? "mc" : "typed",
      };
    }
    // A showing in flight from before the reveal named mix-ups has no record of
    // what was said. Null, not undefined: `confusionNote` is only reached
    // through a truthiness test, so this is tidiness rather than load-bearing.
    if (rt.q && rt.q.confused === undefined) rt.q.confused = null;
    if (rt.q && rt.q.recognition === undefined) rt.q.recognition = null;
    // A quiz mid-flight before this field existed: best-effort backfill so the
    // count doesn't jump. asked minus the card currently on screen (unresolved).
    if (typeof rt.resolved !== "number") {
      rt.resolved = Math.max(0, rt.asked - (rt.q && !rt.waiting ? 1 : 0));
    }
    if (!rt.q) {
      nextQuestion();
      return;
    }
    // Resume mid-question after a tab switch / remount / refresh.
    if (rt.waiting) {
      // A correct answer was mid auto-advance when we unmounted — re-arm it.
      // Only a correct one: a MISS now waits for Enter or the Continue button
      // in every mode, so there is no timer to restore and re-arming one would
      // put the 1.6s reveal-eater back through the remount path. See submit.
      if (rt.feedback?.kind === "good") {
        advanceRef.current = setTimeout(
          () => handlersRef.current?.nextQuestion(),
          650,
        );
      }
    } else if (cfg.timer) {
      startCountdown(
        rt.timerLeft != null && rt.timerLeft > 0 ? rt.timerLeft : cfg.timerSec,
      );
    } else {
      rt.timerLeft = null;
    }
    syncProgress();
    force();
  }

  function onUnmount() {
    if (!startedRef.current) return;
    startedRef.current = false;
    stopCountdown();
    clearAdvance();
  }

  function onTimerCfgChange() {
    if (!rt) return;
    if (!cfg.timer) {
      // Turning the timer off kills the running countdown and stills the ring.
      stopCountdown();
      rt.timerLeft = null;
      force();
      return;
    }
    // Turned on / timerSec changed: restart the countdown on the live card.
    if (rt.q && !rt.waiting) {
      startCountdown(cfg.timerSec);
      force();
    }
  }

  // ---------- effects ----------

  // Keep the async entry points pointed at this render's closures. Declared
  // first so it runs before the mount effect below.
  useEffect(() => {
    handlersRef.current = {
      tick,
      nextQuestion,
      skipQuestion,
      onKeyDown,
      onMount,
      onUnmount,
      onTimerCfgChange,
    };
  });

  // Mount / unmount lifecycle. Waits for cfg hydration (`ready`) so a fresh
  // deck and a resumed countdown see the real settings, not the defaults.
  //
  // KEYED ON THE LEG, NOT ON THE OBJECT, and that distinction is the session
  // brick. `active` is replaced with a freshly parsed object every time another
  // open tab writes the snapshot and this one adopts it — same quiz, same card,
  // new object. Keyed on `active`, this effect therefore ran its teardown and
  // its setup on every adoption, and onMount ends in syncProgress() →
  // setProgress({…}), a state change that published the snapshot straight back
  // to the tab we adopted it from. Two tabs pumped each other at ~14,000 writes
  // in 3 seconds and neither could finish a click.
  //
  // `legId` is what actually decides whether this is a different quiz. A new
  // round, a retry leg or a new one-off mints one (beginLeg); adopting the leg
  // you are already drilling does not. So a real change still re-initialises,
  // and an echo is ignored. Falls back to `startedAt` for a leg snapshotted
  // before legId existed, and to "" for no leg at all — the body early-returns
  // there anyway.
  const legKey = active ? (active.legId ?? `t${active.startedAt ?? 0}`) : "";
  useEffect(() => {
    if (!active || !ready) return;
    handlersRef.current?.onMount();
    return () => handlersRef.current?.onUnmount();
    // `active` is read through handlersRef, which every render refreshes, so
    // the effect never runs against a stale leg despite not depending on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legKey, ready]);

  // React live to timer settings edits (drawer or Settings tab). Value-diffed
  // so mount/hydration echoes don't clobber a resumed remainder.
  const prevTimerCfg = useRef<{ timer: boolean; sec: number } | null>(null);
  useEffect(() => {
    if (!ready) return;
    const prev = prevTimerCfg.current;
    prevTimerCfg.current = { timer: cfg.timer, sec: cfg.timerSec };
    if (!prev || (prev.timer === cfg.timer && prev.sec === cfg.timerSec)) return;
    handlersRef.current?.onTimerCfgChange();
  }, [ready, cfg.timer, cfg.timerSec]);

  // Document-level keys (Enter to advance/submit, 1–9 for MC), legacy style.
  useEffect(() => {
    const h = (e: KeyboardEvent) => handlersRef.current?.onKeyDown(e);
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // Play a listening card's word when it appears. Keyed on `asked`, which ticks
  // once per card and NOT per retry (see nextQuestion / the halo cardKey), so
  // the word is spoken as the card arrives and is not re-played on every
  // wrong-answer remount. `speechForFact` is the same "what does this sound
  // like" the teach screens use — a word speaks its own glyph — and the voice is
  // the learner's configured one, which "Auto" now resolves away from Eddy. The
  // halo's speaker is the only other way to hear it again.
  const listenPlayKey = rt?.q?.listen ? rt.asked : null;
  const listenPlayFact = rt?.q?.listen ? rt.q.f : null;
  useEffect(() => {
    if (listenPlayKey == null || !listenPlayFact) return;
    const current = rt?.q;
    const info = factInfo(listenPlayFact);
    const text =
      current?.form.source === "sentence" &&
      current.form.response === "definition"
        ? current.recognition?.jp
        : info && speechForFact(info);
    if (text) speak(text, cfg.voiceName);
    // Fires only when a NEW listening card appears. The fact and voice are
    // stable for one `asked`, so keying on the card is the whole intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenPlayKey]);

  // Interaction fades: End quiz and the gear sit at 22% and wake on any mouse
  // movement, then go back to sleep once the mouse settles. `awake` is
  // mirrored in a local so a moving mouse doesn't re-render 60 times a second.
  const fadeControls = cfg.fadeControls && !reducedMotion;
  useEffect(() => {
    if (!fadeControls) return;
    let awake = false;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const sleep = () => {
      awake = false;
      setControlsAwake(false);
    };
    const wake = () => {
      if (!awake) {
        awake = true;
        setControlsAwake(true);
      }
      clearTimeout(idle);
      idle = setTimeout(sleep, CONTROLS_IDLE_MS);
    };
    // Arm the idle timer up front so turning the toggle on fades them out
    // even if the mouse never moves again.
    idle = setTimeout(sleep, CONTROLS_IDLE_MS);
    window.addEventListener("mousemove", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      clearTimeout(idle);
    };
  }, [fadeControls]);

  // ---------- the hint, decided before the early return ----------
  //
  // Up here because useDrawnImage is a hook and the early return below is
  // conditional; everything else about the hint is ordinary render work.
  //
  // `hintReady` is the single answer to "is there a hint on this card": null
  // from the builder means the fact has nothing honest to say (a katakana glyph
  // with no drawing, an all-kana word, a kanji whose parts aren't teachable),
  // and an image that never loads means the same thing. The button renders from
  // it, the "?" key reads it off the ref, and neither can offer a hint the other
  // would refuse.
  //
  // NO HINT ON MULTIPLE CHOICE. A hint is calibrated against a blank box, where
  // narrowing the answer still leaves you to produce it. Against six printed
  // options it usually IS the answer: 先生 asked for its reading is hinted "先 is
  // せん here", and exactly one option starts せん. So an mc showing is treated
  // the same way a card with nothing honest to say is treated — no button at
  // all, not a disabled one, and the "?" key inert, both of which fall out of
  // hintReady being false. Typed cards are untouched.
  // A LISTENING card is NOT excluded, and the earlier blanket "no hint on a
  // listening card" was wrong. Listening is word-only (see lib/listen.ts), so
  // the only hint hintFor can build on one is a word hint. On a listening MEANING
  // card the glyph is off screen, so hintFor is told `listen` and returns the
  // WRITTEN FORM of the word (電話) — plus its per-kanji meanings when the word is
  // multi-kanji — rather than nothing: the point is to reveal WHICH word was
  // heard, and the writing is not the meaning, so the English answer the audio
  // withholds stays withheld. (A listening READING card asks for the reading,
  // which wordHint declines, so hintFor still returns null there; there is no
  // kana listening card to leak a picture.)
  // A kanji-reading card's formula hint is framed on the SAME word the prompt
  // shows it in (anchorForFact), so the hint is handed that word. Every other
  // hint ignores both extras.
  const hint =
    active && rt?.q && !rt.q.mc
      ? hintFor(
          rt.q.f,
          rt.q.dir,
          anchorForFact(rt.q.f, history) ?? undefined,
          rt.q.listen && rt.q.form.source === "japanese",
        )
      : null;
  const hintDrawn = useDrawnImage(hint?.kind === "image" ? hint.src : null);
  const hintReady = !!hint && (hint.kind !== "image" || hintDrawn);
  hintReadyRef.current = hintReady;

  // ---------- render ----------

  if (!active || !rt || !rt.q) return null;

  const q = rt.q;
  // The word a kanji-reading card is asked IN — the known, multi-part anchor the
  // drill picked (電話 for 話). Set only for that card type, and only jp2en
  // (reading facts are jp2en; the guard is belt-and-braces). It drives two
  // things below: the halo shows the WHOLE WORD with this card's kanji lit rather
  // than the lone glyph, and the "in 電話" sublabel is dropped as redundant with
  // it. undefined for every other card, which then renders exactly as before.
  const readingWord =
    q.dir === "jp2en" && !q.listen && isReadingFact(q.f)
      ? anchorForFact(q.f, history)
      : undefined;
  // What to put on screen is the fact's subject's answer, not this screen's.
  // The drill knows there is a glyph, maybe a line under it, and some options;
  // it does not know whether it is asking a kana, a kanji reading or a word.
  const ctx = ctxFor(q, anchorForFact(q.f, history));
  const prompt = questionsFor(q.f).prompt(q.f, q.dir, ctx);
  const selectionFrame =
    q.grammarSelection?.frame ??
    (!q.listen ? q.recognition?.jp : null) ??
    null;
  // A MEANING question for a word whose reading collides with another word the
  // learner knows shows the kanji (the glyph) AND the pronunciation together, so
  // the pitch mark is what says which same-sounding word is meant — 箸[はし↓] vs
  // 橋[は↑し]. Only here: it is scoped to the same colliding case that
  // meaningMustShowGlyph blocks the audio card for, on the jp2en meaning showing
  // (the one that shows the kanji and asks for the English), where a reading line
  // aids without leaking the English answer. Display only; a word with no verified
  // pitch shows nothing extra.
  const promptPitch = (() => {
    if (q.listen || q.dir !== "jp2en") return null;
    const info = factInfo(q.f);
    if (!info || info.subject !== VOCAB_SUBJECT) return null;
    if (wordMeaningFactId(info.glyph) !== q.f) return null;
    if (!meaningMustShowGlyph(q.f, history)) return null;
    const row = vocabRow(info.glyph);
    if (!row) return null;
    const downstep = wordPitch(row.keb);
    return downstep == null ? null : { reading: row.reb, downstep };
  })();
  // `q.mc` is the truth about how this card is being ANSWERED, which is what the
  // instruction has to describe — "which of these" over a text box would be
  // worse than saying nothing.
  const instruction = q.recognition
    ? "Pick the sentence's meaning."
    : quizInstruction(q.f, q.dir, q.mc ? "mc" : "typed");
  const total = limited ? rt.deck.length : null;
  const pct = total ? Math.min(100, Math.round((100 * rt.resolved) / total)) : null;
  // The card already decided its shape at ask time: MC options were built (or
  // not) in nextQuestion, which is also where an un-romaji-able en2jp card was
  // routed to MC. So the presence of options is the single source of truth for
  // which control to show — deriving it from the style again could disagree
  // with what was built (e.g. an MC-style card that fell back for want of
  // distractors).
  const typedMode = !q.mc && !q.recognition;
  // Live romaji→kana exactly when the ANSWER is Japanese, which is not the same
  // question as which direction the card faces. Keyed on direction alone this
  // was wrong both ways: a jp2en kanji reading wants せい and got a latin box,
  // unanswerable without an IME; and turning it on for every typed card would
  // convert "life" on a kanji meaning card into らいふ and mark it wrong. The
  // subject owns the answer, so the subject owns the question — see
  // `answerIsJapanese`, the one place this is decided.
  const romajiInput = typedMode && answerIsJapanese(q.f, q.dir);
  // What the box wants, in words. Same predicate as `romajiInput` above, via
  // one module — see lib/drill-guidance.ts for why it must not be a second
  // list. Null on multiple choice, which has no box to explain.
  const guide = typedMode ? answerGuide(q.f, q.dir) : null;
  // Two different lines, and only one of them is a preference. `context` is
  // part of the question — "in 人生" is what makes 生 gradeable — so the
  // setting cannot touch it. `hint` is kana's script tag, which is decoration.
  const hintTag = cfg.scriptLabel ? (prompt.hint ?? "") : "";

  // Retries: pips are the only representation. Unlimited shows an ∞ instead,
  // and "none" has nothing to say, so it says nothing.
  const allowed = retriesAllowed(cfg);
  const retriesLeft = Math.max(0, allowed - q.tries);
  const unlimited = cfg.retries === "unl";
  const showPips = cfg.showRetryPips && (unlimited || allowed > 0);

  // The ring: still, unless it has something to say. Draining only in the
  // final seconds; a wrong answer with retries left pulses out and hands the
  // ring back, where a re-queue holds it until the next card.
  const drainWindow = Math.min(DRAIN_WINDOW_S, Math.max(1, cfg.timerSec));
  const draining =
    cfg.timer && !rt.waiting && rt.timerLeft != null && rt.timerLeft <= drainWindow;
  const haloState: HaloState =
    rt.feedback?.kind === "good"
      ? "right"
      : rt.feedback?.kind === "bad" && rt.waiting
        ? "wrong"
        : draining
          ? "draining"
          : rt.feedback?.kind === "bad"
            ? "wrong-flash"
            : "resting";
  // A finished miss — out of retries, waiting for the learner to move on. This is
  // the state that needs a way FORWARD. `revealing` (the answer text) is this AND
  // the show-answer setting; the Continue affordance keys on `missWaiting` alone,
  // so it is present even with reveal off. A CORRECT answer auto-advances, so its
  // `rt.waiting` is excluded here by the `bad` check.
  const missWaiting = rt.waiting && rt.feedback?.kind === "bad";
  // Out of retries and waiting for the next card, with the setting on: show the
  // answer in the answer slot (the reveal that used to be a sentence).
  const revealing = cfg.showAnswer && missWaiting;
  // The mix-up, named at the reveal and nowhere else. Not on a miss with goes
  // left — you are still answering, and the app telling you what you nearly
  // confused it with would be handing you the answer mid-question.
  const mixup =
    revealing && q.confused ? confusionNote(entryOf(q.f), q.confused) : null;
  // The reveal that shows a word's READING is the moment the app confirms how
  // the word sounds — exactly where a wrong pitch habit would set. So when the
  // revealed answer is a word's reb and that word has a verified pitch, draw the
  // reb in the overline notation instead of plain. Guarded to the reading fact
  // (revealed text === the row's reb) and to words with pitch; everything else,
  // including en2jp where the reveal is the kanji, falls through untouched. See
  // src/data/pitch.ts and pitch-mark.tsx. DISPLAY only — never graded.
  const revealPitch = (() => {
    if (!revealing) return null;
    const info = factInfo(q.f);
    if (!info || info.subject !== VOCAB_SUBJECT) return null;
    const row = vocabRow(info.glyph);
    if (!row) return null;
    if (revealFor(q.f, q.dir, ctx) !== row.reb) return null;
    const downstep = wordPitch(row.keb);
    return downstep == null ? null : { reading: row.reb, downstep };
  })();

  const accuracy = cfg.showAccuracy
    ? liveAccuracy(rt.stats, cfg.accuracyMetric)
    : null;
  const controlsLit = !fadeControls || controlsAwake || drawerOpen;
  // "Look again" is offered only for a session that has a lesson to return to.
  // A one-off quiz (no session) or a session with nothing new to teach has no
  // teach screen, so the control would go nowhere.
  const hasLesson = !!session && session.teach.length > 0;

  return (
    <div>
      {/* px-3 to inset the HUD's contents off both edges — the same value
          pairs and grid use, so the three screens agree.

          AND IT OCCLUDES. This carried no material for a long time, on the
          grounds that a drill card is one glyph and one input and the stage
          therefore fits the viewport, so nothing ever passes beneath the pills.
          That was true of the card and false of the SCREEN: open the drawer
          (four toggles, retries, timer) and the page runs past the bottom of
          the scroller, at which point the settings scroll straight under the
          HUD. In kiri that is total, because --card is transparent and
          --material-frost is none, so an unmaterialed HUD is a few outlines
          over live text. kq-band is the app's word for a sticky band that must
          occlude: --bg in the three opaque themes, blur(18px) saturate(150%) in
          kiri, one filter for the screen and not one per card. The hairline is
          where the band stops. Same treatment the session's lesson bar wears
          (session/session-hud.tsx), for the same reason and by the same name. */}
      <div className="kq-band sticky top-0 z-10 border-b border-border px-3 py-1.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {/* Information — always quiet, and only ever present when it has
              something true to say. An empty pill is worse than no pill: "—
              first try" and "🔥 0" both report an absence as if it were data. */}
          <span className="flex flex-wrap items-center gap-1.5">
            {/* HOW LONG THIS IS, and it is the one HUD chip that is not quiet.
                A limited quiz has an end and the learner is entitled to see how
                far off it is without opening the sidebar, so the count is
                bigger and carries the accent — louder than everything beside
                it, and louder than the sidebar chip that used to be the only
                place it appeared.

                An endless quiz says so in words. `total` is null there, which
                used to print a bare "18 answered": a number with no second half
                reads like a total that went missing rather than a quiz that
                does not have one. */}
            {total ? (
              <span className="kq-material rounded-full border border-accent/40 bg-accent-bg px-3 py-1 text-[13px] font-semibold tabular-nums text-accent">
                {rt.resolved} / {total}
              </span>
            ) : (
              <Pill>{rt.resolved} answered · endless</Pill>
            )}
            {rt.requeued ? <Pill>{rt.requeued} re-queued</Pill> : null}
            {cfg.showAccuracy && accuracy !== null ? (
              <Pill tone="accent">
                {formatAccuracy(accuracy)} first try
              </Pill>
            ) : null}
            {/* A streak isn't a streak until it's a streak. */}
            {cfg.showStreak && (rt.streak ?? 0) >= BEHAVIOR.streakMin ? (
              <Pill tone="warm">🔥 {rt.streak}</Pill>
            ) : null}
          </span>
          {/* Interaction — you never click while drilling, so it gets out of
              the way until you reach for it. */}
          <span
            className="flex items-center gap-1.5"
            style={{
              opacity: controlsLit ? 1 : 0.22,
              transition: fadeControls ? "opacity 250ms ease" : undefined,
            }}
          >
            {/* Only when this session HAS a lesson — a plain custom drill has
                nothing to look again AT. Returns to the teach screen and resumes
                the round exactly where it was (progress is already on disk). */}
            {hasLesson ? (
              <SmallBtn onClick={reviewLesson}>Look again</SmallBtn>
            ) : null}
            <SmallBtn onClick={endQuiz}>End quiz</SmallBtn>
            <SmallBtn
              aria-label="Mid-drill settings"
              onClick={() => setDrawerOpen((o) => !o)}
            >
              ⚙
            </SmallBtn>
          </span>
        </div>
        {/* 2px hairline: the progress bar reduced to the one thing it says.
            EMPTY WHEN THERE IS NO END. It used to run to 100% on an endless
            quiz — `pct === null ? 100` — so the one graphic that means "how far
            through" sat permanently full while the chip beside it said the quiz
            never finishes. The track stays (nothing moves) and the fill is
            simply absent, because absent is what "no fraction of this is done"
            actually looks like. */}
        <div className="h-(--bar-h) overflow-hidden rounded-full bg-panel">
          {pct === null ? null : (
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{
                width: `${Math.min(100, pct)}%`,
                boxShadow:
                  "0 0 8px color-mix(in srgb, var(--accent) 55%, transparent)",
              }}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 pt-10 pb-4">
        <DrillHalo
          // Re-mounts on every new card and every attempt, which is what
          // replays the entry sweep, the shake and the glyph cross-fade.
          key={`${rt.asked}-${q.tries}`}
          cardKey={`${rt.asked}-${q.tries}`}
          state={haloState}
          timerLeft={rt.timerLeft ?? 0}
          drainWindow={drainWindow}
          // A kanji-reading card shows the WHOLE WORD (電話) so the reading is
          // asked in context, with this card's kanji lit and the rest dimmed (see
          // `highlight`). Every other card shows its own glyph. The word is
          // context, not a leak: the highlighted glyph's reading is the answer and
          // is never printed.
          glyph={readingWord ?? prompt.glyph}
          highlight={readingWord ? prompt.glyph : undefined}
          font={q.font}
          // A single glyph keeps its base size (GLYPH_PX for the Japanese side,
          // 0.6× for latin answer text — the old distinction). A multi-char
          // WORD scales down to sit on ONE line inside the halo instead of
          // overflowing and wrapping. See fitGlyphSize.
          fontSize={fitGlyphSize(
            readingWord ?? prompt.glyph,
            prompt.jp,
            prompt.jp ? GLYPH_PX : Math.round(GLYPH_PX * 0.6),
          )}
          crossFade={q.tries === 0}
          // A listening card hides the glyph and plays the word instead; the
          // speaker replays it. `glyph` above is still passed (harmless — the
          // halo ignores it while listening) so the reveal slot below can show
          // the written word the learner just heard.
          listen={q.listen}
          onListen={() => {
            const info = factInfo(q.f);
            const text =
              q.form.source === "sentence" && q.form.response === "definition"
                ? q.recognition?.jp
                : info && speechForFact(info);
            if (text) speak(text, cfg.voiceName);
          }}
          sentenceFrame={selectionFrame ?? undefined}
          reading={
            promptPitch ? (
              <PitchReading
                reading={promptPitch.reading}
                downstep={promptPitch.downstep}
                className="text-[13px] text-text-muted"
              />
            ) : undefined
          }
        />
        {/* WHAT THIS CARD IS ASKING FOR — below the halo now, and WHITE, so it
            reads as the question rather than a muted hint above it. Every card
            has one (see quiz-instruction.ts). Outside the halo's key so it does
            not re-animate on a retry: the question hasn't changed, the attempt
            has. */}
        {instruction ? (
          <p className="mt-1 text-center text-[15px] font-medium text-text">
            {instruction}
          </p>
        ) : null}
        {/* The context that is PART of the question and NOT redundant with the
            instruction above: an anchor like "in 人生" / "on its own", without
            which a kanji reading has nine right answers. The bare "meaning" /
            "reading" / "in japanese" labels are dropped — the full instruction
            already says which it is (typing the word from an English prompt is
            always Japanese), so they were only noise (Sam). And when the WHOLE
            WORD is shown in the halo (a kanji-reading card, `readingWord`), the
            "in 電話" sublabel is dropped too: the word is right there with the
            kanji lit, so repeating it underneath is the same noise (Sam, task
            #22). Muted, because it supports the white instruction rather than
            competing. */}
        {!selectionFrame &&
        !readingWord &&
        prompt.context &&
        prompt.context !== "meaning" &&
        prompt.context !== "reading" &&
        prompt.context !== "in japanese" ? (
          <p className="-mt-1 text-center text-[13px] text-text-muted">{prompt.context}</p>
        ) : null}
        {/* The second line of the question, when a subject has one — today the
            English translation under a selection card's blanked sentence.
            Quieter than `context` because it is the support, not the frame, but
            never hidden: without it the blank has no way of telling you which
            pattern it wants. */}
        {prompt.note ? (
          <p className="max-w-[320px] text-center text-[12px] text-text-muted">
            {prompt.note}
          </p>
        ) : null}
        {/* min-h-4 + text-center is the script label's theme hook. */}
        <p className="min-h-4 text-center text-[10px] uppercase tracking-[0.18em] text-text-muted">
          {hintTag}
        </p>

        {typedMode ? (
          // Box and the line that says what goes in it, as one unit: a tight
          // gap between them rather than the stage's gap-4, so the sentence
          // reads as belonging to the field and not as another piece of the
          // question.
            <span className="flex flex-col items-center gap-1.5">
            <input
              key={rt.asked}
              ref={inputRef}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder={guide?.placeholder}
              value={typed}
              readOnly={revealing}
              // Convert-as-you-type for the Japanese side: the user sees これ /
              // せんせい form in the box (live mode leaves an incomplete trailing
              // run — "sens" → せんs — as latin). The value stays kana, so the
              // grader receives kana and an IME user who typed it directly is
              // unaffected. Idempotent on kana, so re-running on the field's own
              // value only reconverts the latin tail.
              onChange={(e) =>
                setTyped(
                  romajiInput
                    ? toKana(e.target.value, { live: true })
                    : e.target.value,
                )
              }
              // Wide enough for the placeholder to read in full — the old card
              // clipped it at 230px.
              className="kq-material w-[270px] rounded-lg border border-border bg-card px-3 py-2 text-center text-lg text-text outline-none focus:border-accent"
            />
            {/* Says what kind of answer this card wants, and keeps saying it —
                the placeholder above is gone from the first keystroke, which is
                exactly when the romaji line starts mattering. Quiet: it is
                standing instruction, not part of the question. */}
            <span className="text-[11px] text-text-muted">{guide?.note}</span>
            </span>
          ) : (
          // Capped so the six options sit as two rows of three under the
          // halo, rather than a five-plus-one straggle as wide as the stage.
          <div className="flex max-w-[250px] flex-wrap justify-center gap-2">
            {q.recognition?.options.map((option, i) => (
              <button
                key={`${i}-${option}`}
                onClick={() => submit(option, undefined, i)}
                className={cx(
                  "min-w-[110px] cursor-pointer rounded-lg border px-3.5 py-2.5 text-sm",
                  revealing && i === q.recognition?.correct
                    ? "border-success bg-success-bg text-success"
                    : "border-border bg-card text-text hover:bg-panel",
                )}
              >
                {option}
                <span className="block text-[10px] text-text-muted">{i + 1}</span>
              </button>
            ))}
            {q.mc?.map((opt, i) => (
              <button
                key={opt}
                onClick={() => submit(labelOf(opt, q.dir, ctx), opt)}
                className={cx(
                  "min-w-[74px] cursor-pointer rounded-lg border px-3.5 py-2.5 text-xl",
                  // The option you should have picked, lit alongside the reveal.
                  revealing && opt === q.f
                    ? "border-success bg-success-bg text-success"
                    : "border-border bg-card text-text hover:bg-panel",
                )}
                style={
                  q.dir === "en2jp" && q.mcFonts
                    ? { fontFamily: q.mcFonts[i] }
                    : undefined
                }
              >
                {labelOf(opt, q.dir, ctx)}
                <span className="block text-[10px] text-text-muted">{i + 1}</span>
              </button>
            ))}
          </div>
        )}

        {/* The reveal: the one thing colour can't say is WHICH answer was
            right. Held until you press Enter, so it's read rather than
            glimpsed. Fixed height whether or not it's showing — otherwise the
            stage jumps every time a card resolves. */}
        <p
          className={cx(
            "flex flex-col items-center justify-center gap-0.5",
            revealing || missWaiting ? "min-h-[38px]" : "hidden",
          )}
        >
          {revealing ? (
            <>
              <span className="text-sm">
                {q.recognition ? (
                  <span className="font-semibold text-danger">
                    {q.recognition.answer}
                  </span>
                ) : (
                  <>
                <span className="text-lg text-text">{prompt.glyph}</span>
                {prompt.context ? (
                  <span className="text-text-muted"> {prompt.context}</span>
                ) : null}{" "}
                <span className="text-text-muted">=</span>{" "}
                {revealPitch ? (
                  // Same answer text, drawn with its pitch-accent overline. See
                  // revealPitch above: only ever a word reading that has a
                  // verified pitch, DISPLAY only.
                  <PitchReading
                    reading={revealPitch.reading}
                    downstep={revealPitch.downstep}
                    className="font-semibold text-danger"
                  />
                ) : (
                  <span className="font-semibold text-danger">
                    {/* One call, no fallback composed here. The `?? answers[0]`
                        this replaced was the "a = a" bug: in en2jp a fact's first
                        baked answer IS the prompt. See revealFor. */}
                    {revealFor(q.f, q.dir, ctx)}
                  </span>
                )}
                  </>
                )}
              </span>
              {/* THE MIX-UP, when the app already knows this pair is one. A
                  third line in the column, not a change to `revealFor` — that
                  function returns the ANSWER, and folding pedagogy into it
                  would re-tangle the seam task 01 untangled. Rendered only when
                  `confusionNote` claims the pair, so most reveals are the two
                  lines they were before. */}
              {mixup ? (
                <span className="max-w-[320px] text-center text-[11px] text-text-muted">
                  {mixup}
                </span>
              ) : null}
            </>
          ) : null}
          {/* The way on, for EVERY finished miss — typed or multiple choice,
              reveal on or off. It used to be a real button for MC only, with a
              "press Enter" hint for typed cards, on the reasoning that a typed
              card has hands on the keyboard. That breaks on mobile: the input
              goes readOnly at the reveal, so the on-screen keyboard closes, and a
              typed card was then left with no keyboard to press Enter AND no
              button to tap — genuinely stuck, no way to the next card. So a real,
              tappable Continue shows on any finished miss; a desktop user can
              still just press Enter (the title says so, and the document keydown
              handler advances on it). */}
          {missWaiting ? (
            <SmallBtn onClick={nextQuestion} title="Continue (Enter)">
              Continue
            </SmallBtn>
          ) : null}
        </p>

        {/* Reserved whether or not pips are on, so toggling them mid-drill
            doesn't shove the drawer up and down. */}
        <span className="flex min-h-2 items-center gap-1.5">
          {showPips ? (
            <>
              {unlimited ? (
                <span className="text-sm leading-none text-accent">∞</span>
              ) : (
                Array.from({ length: allowed }, (_, i) => (
                  <span
                    key={i}
                    className={cx(
                      "block size-1.5 rounded-full",
                      i < retriesLeft ? "bg-accent" : "bg-border",
                    )}
                  />
                ))
              )}
              <span className="ml-1 text-[9px] uppercase tracking-[0.08em] text-text-muted/70">
                retries
              </span>
            </>
          ) : null}
        </span>

        {!rt.waiting || q.hinted ? (
          <span className="flex flex-col items-center gap-3">
            <span className="flex items-center justify-center gap-3">
              {!rt.waiting ? (
                <Btn
                  className="w-20"
                  onClick={skipQuestion}
                  title="Skip — ask this again later"
                >
                  Skip
                </Btn>
              ) : null}
              {hintReady ? (
                <Btn
                  className="w-20"
                  onClick={takeHint}
                  disabled={q.hinted}
                  title="Hint (?)"
                >
                  Hint
                </Btn>
              ) : null}
            </span>
            {q.hinted && hint ? (
              hint.kind === "image" ? (
                <MnemonicImage
                  src={hint.src}
                  glyph={hint.glyph}
                  imgClassName="h-[104px] w-[104px] rounded-lg object-contain"
                  glyphClassName="text-4xl text-text-muted"
                />
              ) : hint.kind === "formula" ? (
                <span className="flex flex-wrap items-end justify-center gap-x-1.5 gap-y-1 text-text-muted">
                  {hint.formula.pieces.map((p, i) => (
                    <span key={i} className="flex items-end gap-x-1.5">
                      {i > 0 ? <span className="pb-0.5 text-[14px]">+</span> : null}
                      <span className="flex flex-col items-center leading-none">
                        <span className="min-h-[13px] text-[11px] text-accent">
                          {p.reading ?? " "}
                        </span>
                        <span className="text-xl text-text">{p.text}</span>
                      </span>
                    </span>
                  ))}
                  <span className="pb-0.5 text-[14px]">=</span>
                  <span className="pb-0.5 text-xl text-text">
                    {hint.formula.result}
                  </span>
                </span>
              ) : hint.kind === "written" ? (
                <span className="flex flex-col items-center gap-0.5">
                  <span
                    className="text-3xl leading-none text-text"
                    style={{ fontFamily: q.font }}
                    lang="ja"
                  >
                    {hint.text}
                  </span>
                  {hint.parts ? (
                    <span className="max-w-[320px] text-center text-[12px] text-text-muted">
                      {hint.parts}
                    </span>
                  ) : null}
                </span>
              ) : (
                <p className="max-w-[320px] text-center text-[12px] text-text-muted">
                  {hint.text}
                </p>
              )
            ) : null}
          </span>
        ) : null}
      </div>

      {drawerOpen ? <DrillDrawer /> : null}
    </div>
  );
}
