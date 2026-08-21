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
  type ReactNode,
} from "react";

import { PitchReading } from "@/components/library/pitch-mark";
import { HintBody } from "@/components/quiz/hint-content";
import { Btn, ScrollCue, SmallBtn, SoundIcon } from "@/components/ui";
import { wordPitch } from "@/data/pitch";
import { entryId, factId } from "@/lib/fact-id";
import { VOCAB_KIND } from "@/lib/library/kinds";
import {
  getWordReadingFactSet,
  resolveFactInfos,
  resolveLegacyUnqualifiedReadings,
  resolveSpeechForFacts,
  resolveVocabRows,
} from "@/lib/library/server-lookups";
import { formatAccuracy } from "@/lib/accuracy";
import { BEHAVIOR, pickFont } from "@/lib/config";
import { answerGuide, confusionNote, mismatchWarning } from "@/lib/drill-guidance";
import {
  effectiveListen,
  isRevealPause,
  resolveAnsweredText,
  revealTemplate,
  type RevealFeedbackKind,
} from "@/lib/drill-reveal";
import { resolveShowing, statForShowing } from "@/lib/drill-stats";
import { sessionAccuracy } from "@/lib/session-accuracy";
import {
  answerIsJapanese,
  buildDeck,
  buildMcOptions,
  grammarSelectionFor,
  checkTyped,
  confusedWith,
  effectiveRetries,
  firstTryCredit,
  grammarVehicleFor,
  questionsFor,
  requeueGap,
  revealFor,
  variantPromptFor,
  wordReadingCredit,
  spread,
  type GrammarSelection,
  type GrammarVehicle,
  type PromptContext,
  type VariantPrompt,
} from "@/lib/engine";
import { hintFor } from "@/lib/engine/hint";
import {
  gradeParticleDrillTap,
  gradeParticleMarkerChoice,
  particleDrillFor,
  particleMarkerFor,
  type ParticleDrillQuestion,
  type ParticleMarkerQuestion,
} from "@/lib/engine/particle-drill";
import {
  rollConstructionItem,
  type NumberQuizItem,
} from "@/lib/engine/number-quiz";
import {
  constructionConfigForFact,
  isConstructionFact,
} from "@/data/counter-categories";
import { fitGlyphSize } from "@/lib/glyph-fit";
import { confusionKnownFacts } from "@/lib/confusion-search";
import { meaningMustShowGlyph } from "@/lib/homophone";
import {
  pickRecognitionForFact,
  type RecognitionItem,
} from "@/lib/listen-sentence";
import {
  buildPitchShowing,
  gradePitchPick,
  rollPitchQuestion,
  type PitchShowing,
} from "@/lib/pitch-quiz";
import {
  buildCoverageDeck,
  enabledFormsFor,
  formIsMc,
  jp2enResponse,
  type CardForm,
} from "@/lib/ask-forms";
import { isKatakana, toKana } from "@/lib/romaji";
import { answerIsMeaning, isSound, quizInstruction } from "@/lib/quiz-instruction";
import { presentationPhrase } from "@/lib/question-presentation";
import { prefetchClips, speak } from "@/lib/speech";
import { DEFAULT_VOICE_ID } from "@/lib/voice";
import { useHistory } from "@/lib/use-history";
import { anchorForFact, isReadingFact, quizzableFacts } from "@/lib/word-unlock";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import type {
  Direction,
  EntryId,
  FactId,
  FactInfo,
  SessionStats,
  ShowingPresentation,
} from "@/types";
import type { VocabRow } from "@/data/vocab";

import { DrillDrawer } from "./drill-drawer";
import { DrillHalo, GLYPH_PX, type HaloState } from "./drill-halo";
import { ParticleTapCard } from "./particle-tap-card";
import { ParticleMarkerSentence } from "./particle-marker-card";

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
  /** Guard against duplicate autoplay for the same listening card under
   * remount/effect replay paths. */
  listenPlayed?: boolean;
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
  /**
   * The generated count a construction CATEGORY card (〜本, the tens) is asking
   * THIS showing — rolled once at ask time exactly like `grammarVehicle`, so a
   * remount neither re-rolls it nor re-plays its audio. It drives the whole
   * showing: the prompt (digits or reading), the direction, the audio flag, the
   * grading and the reveal all run off it (see engine/question.ts,
   * constructionQuestions). null for every non-category card. Plain data, so it
   * rides the serialized runtime. */
  numberItem: NumberQuizItem | null;
  /**
   * The VARIANT form this kanji recognition card is testing THIS showing — the
   * component shape (亻) shown in place of the English gloss on an en2jp meaning
   * card, still graded against the base character (人). Rolled once at ask time
   * exactly like `numberItem` and `grammarVehicle`, so a remount neither re-rolls
   * it nor swaps which form is shown. null for every card that is not a variant
   * showing — every reading card, every jp2en card, and every character with no
   * variant form. Plain data, so it rides the serialized runtime. */
  variant: VariantPrompt | null;
  /** Japanese-sentence → English-meaning board (text or audio). Its options are strings rather
   * than FactIds, so it carries its own correct index. */
  recognition: RecognitionItem | null;
  /**
   * SAK-128: a pitch-accent question rolled for THIS showing — hear two real
   * clips, tap the one that answers the prompt. Rolled once at ask time
   * exactly like `recognition` and `numberItem`, so a remount cannot reroll
   * it or reshuffle which clip is which. null for every card that is not a
   * pitch showing — see presentCard's eligibility gate. Plain data (audio
   * URLs are strings), so it rides the serialized runtime.
   */
  pitch: PitchShowing | null;
  /** Whether the card's typed answer is KATAKANA — frozen at ask time so the
   * live romaji→kana input converts to katakana (チャ) not hiragana. */
  katakana: boolean;
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
   * Whether the learner pressed "Show choices" on this showing, converting the
   * text box into the multiple-choice board for the same fact.
   *
   * Per SHOWING, exactly like `hinted` — set flat at construction so nextQuestion
   * rebuilds it clean and a remount cannot carry a stale true. It COSTS the same
   * as a hint and nothing more: the first-try "nailed it" credit (see submit),
   * never a retry pip, never anything persisted. It is deliberately NOT `hinted`:
   * `hinted` also disables the Hint button and opens the mnemonic drawer, and
   * seeing the choices should do neither.
   */
  choicesShown: boolean;
  /**
   * The board "Show choices" would convert this text card into — precomputed
   * ONCE here at ask time, not rebuilt in render (a typed card re-renders on
   * every keystroke, and rebuilding would both waste work and reshuffle the
   * options under the cursor). null when this card is already a board
   * (mc/recognition) or when the fact yields ≤1 option, which is not a question;
   * the button is hidden in both cases. Plain FactId[], so it rides the
   * serialized runtime. */
  choicesBoard: FactId[] | null;
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
  /**
   * The MC option the learner most recently picked WRONG on this showing, so
   * the reveal can keep it lit red (border-danger/bg-danger-bg/text-danger)
   * alongside the correct option's green — Sam's SAK-50 changes-requested
   * follow-up: the fixed-bottom reveal rework (see revealPause below) still
   * needs to show the wrong pick as selected, not just the right answer.
   * Overwritten on every attempt, not just the last one, same rule as the
   * `answered` field this sits beside used to follow before SAK-50 dropped
   * it — this is always "what I picked LAST", the one relevant to the board
   * on screen right now. Null whenever this showing's board isn't `mc`
   * (including every non-mc miss), and null again for every fresh showing.
   */
  mcWrongPick: FactId | null;
  /**
   * Same idea as `mcWrongPick`, for the `recognition` board — the option
   * INDEX picked wrong, since two recognition options can share display text.
   */
  recognitionWrongPick: number | null;
  /**
   * Same idea as `mcWrongPick`, for the `particleMarker` board — the
   * recipeId of the option picked wrong.
   */
  particleMarkerWrongPick: string | null;
  /** Same idea as `mcWrongPick`, for the `pitch` board — the wrong clip
   * INDEX picked. */
  pitchWrongPick: 0 | 1 | null;
  /**
   * Whether the learner has pressed "Show text" on an audio-prompt showing —
   * SAK-51's fallback for a card that would otherwise be a blank box with a
   * speaker icon and no way through it if the audio never plays (muted
   * device, no TTS voice, hard of hearing). Per SHOWING, exactly like
   * `hinted` and `choicesShown`: set flat at construction, so a remount
   * cannot carry a stale true into the next card. Unlike those two, it costs
   * NOTHING — turning the audio-prompts SETTING off already redraws the
   * current card as free text (see onAudioOff), so a self-service version of
   * the same thing on ONE card can't cost more than the setting does. It only
   * changes how THIS card renders (see `effectiveListen` in
   * lib/drill-reveal.ts); `listen` itself, and everything graded or spoken
   * off it, is untouched.
   */
  textRevealed: boolean;
  /**
   * A "tap the marked word" showing for a は/が/を MEANING fact — rolled once
   * at ask time exactly like `grammarSelection`, so a remount cannot swap the
   * sentence or the board under the user. null for every other card, and for
   * a fact outside PARTICLE_TAP_DRILL_IDS (lib/grammar/questions.ts). Plain
   * data, so it rides the serialized runtime. See lib/engine/particle-drill.ts.
   */
  particleDrill: ParticleDrillQuestion | null;
  /**
   * The tap-drill's second FORM for the same は/が/を scope: highlight the
   * marked word and ask which particle marks it, instead of tapping the word
   * given the particle. Rolled once at ask time exactly like `particleDrill`;
   * the two are mutually exclusive on one showing (see presentCard) — never
   * both, since they are one fact asked two ways, not two facts.
   */
  particleMarker: ParticleMarkerQuestion | null;
}

/** The presentation a resolving showing writes into its stat, so the results
 * and retry screens can say how it was asked. `mc` present means a board was
 * offered; its absence is a typed box. See ShowingPresentation. */
function showingOf(q: DrillQuestion): ShowingPresentation {
  return {
    dir: q.dir,
    mode:
      q.mc || q.recognition || q.particleDrill || q.particleMarker || q.pitch
        ? "mc"
        : "typed",
    listen: q.listen,
  };
}

/** How many buttons this showing's option board has — `mc`, `recognition`,
 * `particleMarker` and `pitch` are the four board shapes (see DrillQuestion),
 * always mutually exclusive on one showing. null for a typed card and for
 * `particleDrill` (a tap-the-sentence board, not an option grid): neither has
 * a retry-pip/second-guess mechanic this count is meant to gate. Fed to
 * `effectiveRetries` (lib/engine) to scope the SAK-54 binary-board retry
 * skip to exactly this showing's board, not the run's cfg — a `pitch` board
 * is always 2, so it already skips retries the same way any other binary
 * board (a transitivity pair) does. */
function mcOptionCount(q: DrillQuestion): number | null {
  if (q.mc) return q.mc.length;
  if (q.recognition) return q.recognition.options.length;
  if (q.particleMarker) return q.particleMarker.options.length;
  if (q.pitch) return q.pitch.clips.length;
  return null;
}

/** The per-showing presentation context for a card: the anchor word for a kanji
 * reading, the vehicle verb for a grammar production, the blanked sentence for a
 * grammar selection. Rebuilt from the frozen runtime so prompt, check, options
 * and reveal all agree on one showing. */
function ctxFor(q: DrillQuestion, anchor?: string): PromptContext {
  return {
    anchor,
    listen: q.listen,
    grammarVehicle: q.grammarVehicle ?? undefined,
    grammarSelection: q.grammarSelection ?? undefined,
    numberItem: q.numberItem ?? undefined,
    variant: q.variant ?? undefined,
  };
}

/**
 * An MC option's visible text.
 *
 * jp2en offers ANSWERS to pick between (romaji, meanings, readings); en2jp
 * offers GLYPHS. Which is the same asymmetry the prompt has, in reverse — the
 * option side always shows whatever the prompt side is not.
 */
/** SAK-104: factInfo reads lib/facts.ts (server-only), so this reads the
 * caller's own locally-resolved fact map instead of importing it — see
 * DrillScreen's `localFactInfo`/`ensureFactsLoaded`. */
function labelOf(
  fact: FactId,
  dir: Direction,
  ctx: PromptContext | undefined,
  factInfoOf: (id: FactId) => FactInfo | undefined,
): string {
  // A subject may override the visible text per showing — grammar production
  // shows the pattern built on this card's vehicle (食べたい, not the baked
  // 行きたい). Everyone else has no optionLabel and falls to glyph/answer.
  const shown = questionsFor(fact).optionLabel?.(fact, dir, ctx);
  if (shown != null) return shown;
  const info = factInfoOf(fact);
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
  // "warn" (SAK-122) is local to this screen, not part of the shared
  // RevealFeedbackKind: it is neither a resolved right nor a resolved wrong
  // answer — the showing stays open and ungraded, waiting for a retype — so
  // it deliberately does not participate in isRevealPause/haloState's
  // good/bad handling, which is written to react to a RESOLVED showing.
  kind: RevealFeedbackKind | "warn";
  /** Set only for "warn" — the reason shown under the box in place of the
   * ordinary answer-format note. See lib/drill-guidance.ts's mismatchWarning. */
  message?: string;
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
  onAudioOff(): void;
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
function liveAccuracy(stats: SessionStats): number | null {
  return sessionAccuracy(stats);
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
  // SAK-133: which pitch clip is currently selected — tapping a clip PLAYS
  // it and marks it selected, but does not submit; only a subsequent Enter
  // (or the Check button) grades the selection. null until the learner has
  // tapped/pressed one. Reset alongside `typed` in presentCard for every new
  // card, pitch or not.
  const [pitchPick, setPitchPick] = useState<0 | 1 | null>(null);
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

  // ---------- SAK-104: locally-resolved fact registry ----------
  //
  // factInfo/entryOf/vocabRow/isWordReadingFact/legacyUnqualifiedReading all
  // read server-only modules now (the ~9.5MB dictionary they draw from must
  // never reach the client bundle), so this screen — the deepest, hottest
  // per-question render path in the app — keeps its own small, locally
  // resolved slice instead of importing them. THE ZERO-LATENCY CONTRACT IS
  // KEPT by batching, not by skipping: the whole leg's fact pool (rt.pool,
  // frozen at deck-build — see onMount) is fetched ONCE, in one round trip,
  // before the first card is drawn, and every per-question render below reads
  // this map SYNCHRONOUSLY, never awaiting a server action mid-question.
  //
  // The one case the leg's own pool cannot predict is an MC board's
  // DISTRACTORS: a subject's confusable pool often reaches outside today's
  // deck (kana confusables, kanji reading siblings, the ALL_FACTS backstop —
  // see lib/engine's buildMcOptions). Those are fetched incrementally, once
  // per question when a new board is drawn (presentCard, below) rather than
  // once per render — a small, DOCUMENTED gap: an option's label can render
  // blank for a frame on a freshly-drawn card until that fetch resolves,
  // almost always hidden inside the reveal-pause beat between cards.
  // State, not refs: labelOf/promptPitch/revealPitch/wordContext all read
  // this SYNCHRONOUSLY during render (that's the whole zero-latency point —
  // see above), and a ref read during render is unsound under the React
  // Compiler (its memoization assumes render is pure). Kept as flat maps
  // merged via a functional updater, the same shape a ref would have held.
  const [factMap, setFactMap] = useState<Record<string, FactInfo>>({});
  const [vocabRowMap, setVocabRowMap] = useState<Record<string, VocabRow>>({});
  const [legacyReadingMap, setLegacyReadingMap] = useState<Record<string, string | null>>({});
  const [wordReadingFacts, setWordReadingFacts] = useState<ReadonlySet<string>>(new Set());
  const [speechMap, setSpeechMap] = useState<Record<string, string>>({});

  /** Synchronous read of the locally-resolved registry — the hot-path
   * replacement for `factInfo` from lib/facts.ts. */
  function localFactInfo(id: FactId): FactInfo | undefined {
    return factMap[id as unknown as string];
  }
  /** The hot-path replacement for `entryOf`. Null (rather than a guess) when
   * the fact hasn't been resolved locally yet — see the module header above;
   * callers already treat "no confusion claimed" as a normal outcome. */
  function localEntryOf(id: FactId): EntryId | null {
    return localFactInfo(id)?.entry ?? null;
  }
  function localIsWordReadingFact(id: FactId): boolean {
    return wordReadingFacts.has(id as unknown as string);
  }
  /** wordMeaningFactId, minted locally: it is a pure id-build (entryId + factId,
   * both plain unguarded helpers in lib/fact-id.ts, the same ones data/vocab.ts
   * itself calls), never a data lookup, so there is nothing to fetch. */
  function localWordMeaningFactId(keb: string): FactId {
    return factId(entryId(VOCAB_KIND, keb), "meaning");
  }

  /** Batch-fetch factInfo for any of `ids` not already resolved, merging the
   * result into `factMap` and re-rendering once it lands. Safe to call with
   * ids already covered — a no-op past the first call for any given id.
   * Reads `factMap` from the enclosing render's closure (a snapshot, not a
   * ref), so two calls in the same tick before that render's state commits
   * can both miss and both fetch — a harmless duplicate round trip, not a
   * correctness issue, and never on the per-render hot path itself. */
  function ensureFactsLoaded(ids: readonly FactId[]) {
    const missing = ids.filter((id) => !(id as unknown as string in factMap));
    if (!missing.length) return;
    void resolveFactInfos(missing).then((res) => {
      setFactMap((prev) => ({ ...prev, ...res }));
    });
  }

  /** Batch-fetch vocabRow + legacyUnqualifiedReading for `kebs` not already
   * resolved. Called only for word-subject facts, and only for the CURRENT
   * showing's own fact (q.f) — never for MC distractors, which never reach
   * the pitch-display code paths this feeds. */
  function ensureVocabLoaded(kebs: readonly string[]) {
    const missing = [...new Set(kebs)].filter((k) => !(k in vocabRowMap));
    if (!missing.length) return;
    void Promise.all([
      resolveVocabRows(missing),
      resolveLegacyUnqualifiedReadings(missing),
    ]).then(([rows, readings]) => {
      setVocabRowMap((prev) => ({ ...prev, ...rows }));
      setLegacyReadingMap((prev) => ({ ...prev, ...readings }));
    });
  }

  /** The whole leg's fact pool — fetched once at deck-build/resume (onMount)
   * so every q.f the leg can ever draw already has factInfo, and (for word
   * facts) vocabRow/legacyUnqualifiedReading/isWordReadingFact resolved
   * before the first card renders. */
  function ensurePoolLoaded(pool: readonly FactId[]) {
    const missing = pool.filter((id) => !(id as unknown as string in factMap));
    if (missing.length) {
      void resolveFactInfos(missing).then((res) => {
        setFactMap((prev) => ({ ...prev, ...res }));
        const kebs = missing
          .map((id) => res[id as unknown as string])
          .filter((info): info is FactInfo => !!info && info.subject === VOCAB_KIND)
          .map((info) => info.glyph);
        if (kebs.length) ensureVocabLoaded(kebs);
      });
    }
    void getWordReadingFactSet(pool).then((res) => {
      if (!res.length) return;
      setWordReadingFacts((prev) => {
        const next = new Set(prev);
        for (const f of res) next.add(f as unknown as string);
        return next;
      });
    });
    const missingSpeech = pool.filter((id) => !(id as unknown as string in speechMap));
    if (missingSpeech.length) {
      void resolveSpeechForFacts(missingSpeech).then((res) => {
        setSpeechMap((prev) => ({ ...prev, ...res }));
      });
    }
  }

  const reducedMotion = usePrefersReducedMotion();
  const rt = active ? (active.runtime as unknown as DrillRuntime) : null;
  const limited =
    !!active && (active.forceCoverage || active.snapshot.length === "limited");
  // AUDIO PROMPTS, LIVE. The run snapshots its ask-config at start (builder
  // settings are frozen so a card cannot change shape under the learner), but
  // the mid-drill Audio-prompts toggle is the one exception the accessibility
  // escape hatch needs: turning it off must stop listening cards NOW, mid-run.
  // usableForms reads this to strip audio from the effective ask, and onAudioOff
  // redraws the card on screen. Text is always on, so stripping audio never
  // empties a pool.
  const audioOff = !!active && ready && !cfg.audioPrompts;

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

  /** Show the multiple-choice board on a card currently shown as a text box,
   * converting it in place. Mirrors takeHint's guards and, like a hint, FORFEITS
   * the first-try credit and nothing else (see submit) — but through its own
   * `choicesShown` flag, never `hinted`, so it neither disables the Hint button
   * nor opens the mnemonic drawer. Idempotent, and refused once the card is a
   * board or has resolved. Never touches `q.tries`: a pip is a separate cost. */
  function showChoices() {
    if (!rt || !rt.q || rt.waiting || finishedRef.current) return;
    // Already a board (or a card that was drawn as one) — nothing to convert.
    if (rt.q.mc || rt.q.recognition || rt.q.pitch || rt.q.choicesShown) return;
    // The board was precomputed at ask time; the ≤1 guard is defense in depth —
    // a one-option board is not a question, so do nothing (no forfeit either).
    const board = rt.q.choicesBoard;
    if (!board || board.length <= 1) return;
    rt.q.mc = board;
    rt.q.mcFonts =
      rt.q.dir === "en2jp" ? board.map(() => pickFont(cfg.fonts)) : null;
    rt.q.choicesShown = true;
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
    if (!rt || !rt.q || rt.waiting || drawerOpen) return;
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
      rt.deck = rt.deck.concat(
        spread(rt.pool.slice(), (f) => localEntryOf(f) ?? (f as unknown as string)),
      );
      rt.forms = rt.forms.concat(rt.pool.map(() => null));
    }
    const f = rt.deck[rt.pos];
    const pinnedRaw = rt.forms[rt.pos] ?? null;
    // A PINNED listening slot (coverage rounds fix the exact form in the deck)
    // is dropped when audio is off, so it redraws from usableForms as a text
    // form — the toggle reaches even the forms coverage baked into the deck.
    const pinned = pinnedRaw && audioOff && pinnedRaw.listen ? null : pinnedRaw;
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
    presentCard(f, form);
  }

  /** SAK-129: queue ONE additive pitch-accent card for `f` a few slots ahead
   * of the current position — an EXTRA deck entry, never a replacement of
   * the fact's own ordinary showing (that keeps drawing/rendering exactly as
   * it always has; see presentCard's pitch block, which only ever builds a
   * `pitch` board off a slot THIS function pinned). Spliced with the same
   * `requeueGap()` spacing the wrong-answer requeue below uses, so it lands
   * a few cards later rather than clumped against the showing that queued
   * it. A no-op if this fact already has a pending pitch card queued ahead —
   * the deck should never carry more than one at a time per fact. */
  function queuePitchCard(f: FactId) {
    if (!rt) return;
    const alreadyQueued = rt.deck.some(
      (deckFact, i) => i >= rt.pos && deckFact === f && rt.forms[i]?.pitch,
    );
    if (alreadyQueued) return;
    const at = Math.min(rt.deck.length, rt.pos + requeueGap());
    rt.deck.splice(at, 0, f);
    rt.forms.splice(at, 0, {
      source: "japanese",
      response: jp2enResponse(f),
      listen: false,
      dir: "jp2en",
      answer: "typed",
      pitch: true,
    });
  }

  /** Build and show the card for fact `f` in `form` — direction, typed/MC,
   * grammar vehicle, options, the audio flag, then the stat and timer. Split out
   * of nextQuestion so onAudioOff can REDRAW the current fact as a text card
   * without advancing the deck. statForShowing is idempotent, so redrawing the
   * same fact does not double-count it. */
  function presentCard(f: FactId, form: CardForm) {
    if (!rt || !active) return;
    // A construction CATEGORY fact rolls its per-showing count HERE, once, so the
    // whole showing (prompt, direction, audio, grading, reveal) runs on ONE item
    // and a remount can't swap it — the same freeze grammar's vehicle gets. Never
    // in prompt()/check(), which are called separately and per-keystroke. The
    // rolled item's direction drives everything: READ shows the number and wants
    // its reading (typed kana), WRITE shows the reading and wants the number, HEAR
    // plays the reading and wants the number (audio). A category is ALWAYS typed —
    // a board would give the count away, and buildMcOptions refuses one for it.
    const construction = isConstructionFact(f)
      ? constructionConfigForFact(f)
      : null;
    // Deal a category's allowed directions across its repeated coverage slots.
    // Randomly choosing every slot could produce a whole ten-card numbers quiz
    // with no pronunciation question at all. The item value still rolls; only
    // the prompt direction cycles, just as the former round builder balanced it.
    const constructionShowing = construction
      ? rt.deck.slice(0, rt.pos).filter((fact) => fact === f).length - 1
      : 0;
    const dealtConstruction =
      construction && construction.directions.length > 0
        ? {
            ...construction,
            directions: [
              construction.directions[
                ((constructionShowing % construction.directions.length) +
                  construction.directions.length) %
                  construction.directions.length
              ],
            ],
          }
        : construction;
    const numberItem = dealtConstruction
      ? rollConstructionItem(dealtConstruction, Math.random)
      : null;
    const listen = numberItem ? numberItem.direction === "hear" : form.listen;
    const dir: Direction = numberItem
      ? numberItem.direction === "write"
        ? "en2jp"
        : "jp2en"
      : form.dir;
    const styleTyped = numberItem ? true : !formIsMc(f, form);
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
    // Every conjugation class is its own fact, so the fact itself pins the
    // vehicle pool to the class or exceptional word being scored.
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
    const grammarSelection = typedMode ? null : grammarSelectionFor(f, history);
    // A grammar MEANING card for は/が/を may be asked as a TAP-DRILL instead —
    // "which word does this sentence's が mark", never a blank. Same fact, same
    // score, and (unlike selection) never gated on grammarSelection's corpus
    // safety argument — is/ga are always empty there (see PARTICLE_ALLOWLIST),
    // so the two never compete for the same card. Scoped to
    // PARTICLE_TAP_DRILL_IDS; null for every other fact. See
    // lib/engine/particle-drill.ts.
    const particleDrillCandidate =
      typedMode || grammarSelection ? null : particleDrillFor(f);
    // Its second FORM, half the time: highlight the marked word and ask which
    // particle marks it, instead of tapping the word given the particle. Same
    // fact, same score — rolled only when the first form would have rolled at
    // all (so it can never appear where a tap-drill couldn't), and mutually
    // exclusive with it: whichever wins the coin flip is the one this showing
    // asks, never both. See lib/engine/particle-drill.ts.
    const particleMarker =
      particleDrillCandidate && Math.random() < 0.5 ? particleMarkerFor(f) : null;
    const particleDrill = particleMarker ? null : particleDrillCandidate;
    const recognition =
      form.source === "sentence" &&
      form.response === "definition"
        ? pickRecognitionForFact(f, history)
        : null;
    // SAK-128: a pitch-accent question — hear two REAL clips, tap the one
    // that answers the prompt — folded in as ONE MORE THING a word's
    // ordinary japanese-source, jp2en MEANING card can ask, never a track of
    // its own (SAK-98's design note ruled that out). Scoped tightly:
    //   - only a japanese-source, jp2en form. The interaction IS "hear it,
    //     pick it", which only stands in for the meaning card's jp2en
    //     showing — not an en2jp production card (there is nothing to
    //     produce) and not a reading card (the reading is the thing a
    //     verified downstep hangs off, not what is being asked).
    //   - only the word's own MEANING fact (localWordMeaningFactId), never a
    //     reading fact, and never a counter/construction card — those are
    //     also subject `word` (COUNTER_FACTS/CONSTRUCTION_CATEGORY_FACTS)
    //     but `numberItem` already owns their whole showing.
    //   - only when Audio prompts is ON (`!audioOff`) — a pitch question IS
    //     an audio prompt (you cannot ask "which one did you hear" without
    //     playing it), so it obeys the exact gate every other listening form
    //     already obeys (see usableForms), never a separate opt-in.
    //   - ADDITIVE, never a substitute (SAK-129): every eligible showing of
    //     the word's own meaning card queues one extra pitch card a few
    //     slots later (queuePitchCard) rather than replacing anything.
    //   - only for a word that still carries a VERIFIED wordPitch() entry —
    //     rollPitchQuestion itself returns null otherwise (no guessed pitch,
    //     ever — the same rule src/data/pitch.ts documents).
    //
    // SAK-129: ADDITIVE, not a substitute. A pitch question used to REPLACE
    // this showing's ordinary meaning card on the PITCH_QUESTION_CHANCE coin
    // flip — so the word's everyday "what does this mean" practice partially
    // stopped happening. Now the coin flip decides whether to QUEUE a
    // separate, extra card later in the deck (queuePitchCard, above) instead
    // — this showing always renders its own ordinary card. `pitch` below is
    // therefore non-null on ONE showing only: the pinned slot a previous
    // showing's queuePitchCard call spliced in (`form.pitch === true`) —
    // never rolled fresh here.
    const pitchEligibleInfo =
      !construction && !audioOff && form.source === "japanese" && dir === "jp2en"
        ? localFactInfo(f)
        : undefined;
    const pitchEligibleGlyph =
      pitchEligibleInfo &&
      pitchEligibleInfo.subject === VOCAB_KIND &&
      localWordMeaningFactId(pitchEligibleInfo.glyph) === f
        ? pitchEligibleInfo.glyph
        : null;
    const pitchQuestion =
      form.pitch && pitchEligibleGlyph
        ? rollPitchQuestion(pitchEligibleGlyph)
        : null;
    const pitch: PitchShowing | null = pitchQuestion
      ? buildPitchShowing(pitchQuestion, cfg.voiceName || DEFAULT_VOICE_ID)
      : null;
    // Not a pinned pitch slot: this is an ordinary showing of an eligible
    // word's meaning card. Queue an ADDITIONAL pitch card a few slots ahead
    // every time (no coin flip — a word with verified pitch always gets
    // quizzed on it) and let THIS showing render its ordinary card untouched.
    // queuePitchCard's own alreadyQueued guard is what keeps this from
    // stacking more than one pending pitch card per fact at a time.
    if (!form.pitch && pitchEligibleGlyph) {
      queuePitchCard(f);
    }
    // A kanji MEANING card asked en2jp may, this showing, test the character's
    // VARIANT form instead of its English gloss — show 亻, ask which character it
    // is a form of, still grading against 人. Rolled here once (like the vehicle
    // and the count above) so prompt, board and reveal all agree, and a remount
    // can't swap the form. null for every card that is not a variant showing —
    // reading cards, jp2en cards, characters with no variant, and (occasionally)
    // a variant character whose plain recognition this showing keeps. It rides
    // the SAME meaning fact, so nothing about grading or scheduling changes.
    const variant = variantPromptFor(f, dir);
    const ctx: PromptContext = {
      listen,
      grammarVehicle: grammarVehicle ?? undefined,
      grammarSelection: grammarSelection ?? undefined,
      numberItem: numberItem ?? undefined,
      variant: variant ?? undefined,
    };
    // The selection board comes PRE-BUILT and pre-shuffled: its options were
    // chosen per-sentence by the generator, which proved each one wrong for THIS
    // frame (gloss, cluster, prefix and particle tests — see grammar/questions.ts).
    // buildMcOptions cannot reproduce that, because its distractors are a
    // property of the fact and these are a property of the sentence. They are
    // still FactIds, so everything downstream — grading by which option, the
    // reveal, confusion tracking — is the untouched existing path.
    const built = pitch
      ? null
      : recognition
        ? null
        : particleDrill || particleMarker
          ? null
          : grammarSelection
            ? grammarSelection.choices.slice()
            : typedMode
              ? null
              : buildMcOptions(f, dir, ctx, confusionKnownFacts(history));
    const mc = built && built.length > 1 ? built : null;
    // The board "Show choices" would convert this text card into, built ONCE now
    // with the SAME call the MC ask path uses above, so a click swaps the box for
    // a board with no reshuffle and no per-keystroke rebuild. Only a typed card
    // can convert (a card already MC/recognition is one), and a ≤1-option board
    // is not a question, so both cases store null and hide the button.
    // A construction category never gets a "Show choices" board either — strictly
    // typed-input, so the button stays hidden and no count is ever offered. Nor
    // does a pitch showing: it is never a typed card to begin with.
    const choicesBuilt =
      typedMode && !construction && !pitch
        ? buildMcOptions(f, dir, ctx, confusionKnownFacts(history))
        : null;
    const choicesBoard =
      choicesBuilt && choicesBuilt.length > 1 ? choicesBuilt : null;
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
      numberItem,
      variant,
      recognition,
      pitch,
      particleDrill,
      particleMarker,
      katakana: isKatakana(revealFor(f, dir, ctx)),
      listen,
      listenPlayed: false,
      // A new showing has not been hinted. Written here rather than backfilled,
      // so there is exactly one place a showing's hint state begins.
      hinted: false,
      // No choices have been shown on a new showing. Written flat here for the
      // same reason `hinted` is: one place a showing's help state begins.
      choicesShown: false,
      choicesBoard,
      // Nothing has been said instead of this card's answer yet. Same rule.
      confused: null,
      // No wrong pick to keep lit red on a new showing. Same rule.
      mcWrongPick: null,
      recognitionWrongPick: null,
      particleMarkerWrongPick: null,
      pitchWrongPick: null,
      // "Show text" has not been pressed on a new showing. Same rule as
      // `hinted` and `choicesShown` just above.
      textRevealed: false,
    };
    // SAK-104: `f` is already covered (the whole leg's pool was fetched at
    // deck-build — see ensurePoolLoaded), but `mc`/`choicesBoard` are built
    // from each subject's OWN distractor pool, which often reaches beyond
    // that pool (kana confusables, kanji reading siblings, the rare ALL_FACTS
    // backstop). Fetching them here — right as the card is built, before it
    // is shown — gives the round trip the whole reveal-pause beat to resolve
    // before the learner needs to read the board.
    ensureFactsLoaded([...(mc ?? []), ...(choicesBoard ?? [])]);
    // Creates the stat, and deliberately advances NOTHING. `seen` used to tick
    // here, which put it in the same unit as `asked` while every numerator was
    // in the unit of `resolved` — see src/lib/drill-stats.ts for what that cost.
    statForShowing(rt.stats, f);
    if (cfg.timer) startCountdown(cfg.timerSec);
    else rt.timerLeft = null;
    setTyped("");
    setPitchPick(null);
    syncProgress();
    force();
  }

  /** The mid-drill Audio-prompts toggle went OFF. Future cards already come as
   * text (usableForms strips audio below), but the card ON SCREEN was drawn as a
   * listening card — replace it with a fresh text card for the SAME fact so the
   * learner is unblocked without leaving the drill. No-op unless it is still an
   * unanswered listening card. */
  function onAudioOff() {
    if (!rt || !rt.q || rt.waiting || finishedRef.current) return;
    if (!rt.q.listen) return;
    const f = rt.q.f;
    const available = usableForms(f);
    const form = available[Math.floor(Math.random() * available.length)] ?? {
      source: "japanese" as const,
      response: jp2enResponse(f),
      listen: false,
      dir: "jp2en" as const,
      answer: "typed" as const,
    };
    presentCard(f, form);
  }

  function usableForms(f: FactId): CardForm[] {
    if (!active) return [];
    // Strip audio from the effective ask when the live toggle is off, so no
    // further listening card is drawn (base snapshot ask otherwise).
    const baseAsk = active.snapshot.ask;
    const ask = audioOff
      ? {
          ...baseAsk,
          japanese: {
            ...baseAsk.japanese,
            prompts: baseAsk.japanese.prompts.filter((p) => p !== "audio"),
          },
          sentence: {
            ...baseAsk.sentence,
            prompts: baseAsk.sentence.prompts.filter((p) => p !== "audio"),
          },
        }
      : baseAsk;
    return enabledFormsFor(f, ask).filter(
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

  /** Play one pitch-question clip (SAK-128) — a plain URL, not a glyph to
   * resolve through lib/speech.ts's Auto/roster tiering, so this is the same
   * bare `new Audio(url).play()` HearButton's own EXACT PITCH mode uses (see
   * src/components/ui/hear-button.tsx): this clip has exactly one source, so
   * on failure it just stays silent rather than substituting a different
   * voice, which would lose the very pitch contrast the question is testing. */
  function playPitchClip(url: string) {
    const audio = new Audio(url);
    void audio.play().catch(() => {
      // No fallback on purpose — see above.
    });
  }

  /** Legacy submit (plus the streak, which is the same first-try question
   * `firstTryCorrect` already answers). `picked` is the option FACT for MC
   * clicks (both dirs); `particleDrillPick` is the tapped chunk id for a
   * particle tap-drill card; `particleMarkerPick` is the chosen particle's
   * recipe id for its marker-choice sibling; `pitchPick` is the tapped
   * clip's index (0 or 1) for a pitch-question board. */
  function submit(
    given: string,
    picked?: FactId,
    recognitionPick?: number,
    particleDrillPick?: string,
    particleMarkerPick?: string,
    pitchPick?: 0 | 1,
  ) {
    if (!rt || !rt.q || rt.waiting || finishedRef.current) return;
    const q = rt.q;
    // Clicking an MC option is answered by WHICH option, not by its label:
    // two options can carry the same text (two kanji meaning "life") and
    // comparing strings would mark a wrong click right. Typed answers go to the
    // subject's own checker.
    // A TYPED answer on a word READING card can be right via a SIBLING reading
    // that shares the shown meaning — 年+"year" accepts both とし and ねん, and the
    // kanji cannot disambiguate. wordReadingCredit grades against every reading
    // valid for the shown meaning and redirects stat CREDIT to the unit whose
    // reading was actually typed; a miss (or a real reading meaning something
    // else) stays on the intended unit. Only the stat credit moves — the reveal,
    // phrase, streak, confusion and requeue all stay card-level on q.f.
    const typed =
      recognitionPick === undefined &&
      picked === undefined &&
      particleDrillPick === undefined &&
      particleMarkerPick === undefined &&
      pitchPick === undefined;
    const credited =
      typed && q.dir === "jp2en" && localIsWordReadingFact(q.f)
        ? wordReadingCredit(q.f, given)
        : null;
    const ok =
      pitchPick !== undefined && q.pitch
        ? gradePitchPick(q.pitch, pitchPick)
        : particleMarkerPick !== undefined && q.particleMarker
          ? gradeParticleMarkerChoice(q.particleMarker, particleMarkerPick)
          : particleDrillPick !== undefined && q.particleDrill
            ? gradeParticleDrillTap(q.particleDrill, particleDrillPick)
            : recognitionPick !== undefined && q.recognition
              ? recognitionPick === q.recognition.correct
              : picked !== undefined
                ? picked === q.f
                : credited
                  ? credited.ok
                  : checkTyped(q.f, given, q.dir, ctxFor(q));
    // SAK-122: a TYPED miss that looks like the wrong script/format for what
    // this card wants (English on a Japanese-answer card, Japanese on an
    // English-answer card, kana typed where the card wants romaji) is not
    // scored at all — no miss, no streak break, no tries spent, no requeue.
    // The learner gets a short warning and the box stays open on the same
    // showing for a retype, exactly the state a fresh unanswered card is in.
    // Runs strictly AFTER `ok`, and only for a real typed answer (never an
    // MC/recognition/particle pick, which has no script to get wrong) — see
    // scriptMismatch's contract in lib/engine/question.ts.
    if (!ok && typed) {
      const warning = mismatchWarning(q.f, q.dir, given);
      if (warning) {
        rt.feedback = { kind: "warn", message: warning };
        inputRef.current?.select();
        force();
        return;
      }
    }
    const st = statForShowing(rt.stats, credited?.fact ?? q.f);
    const phrase = presentationPhrase(q.f, showingOf(q));
    // A HINT FORFEITS "NAILED IT", and that is the whole of what it costs. Right
    // with a hint is the third outcome: seen, correct, not first-try — which is
    // an existing shape, not a new one (it is what a second-try success already
    // records), so nothing about the persisted file or the standings changes.
    const credit = firstTryCredit(ok, q.tries, q.hinted || q.choicesShown);
    if (ok) {
      // The showing RESOLVED. `seen`, the flag, the first-try count and the
      // forgiving numerator all advance in one call so they cannot drift into
      // different units — which is exactly what they had done. See
      // src/lib/drill-stats.ts.
      //
      // SAK-17/SAK-26: `ok`, not `credit`, is the third argument. `credit`
      // is deliberately false on a hinted/choices-forfeited right answer —
      // that is what withholds the streak-and-nailed-it flag — but a hint
      // "should not take away from scoring" (SAK-26), and `ok` is the real
      // verdict on the showing: it landed. Passing `credit` here for BOTH
      // arguments was the bug: it fed the strict, hint-penalizing verdict
      // into `correct`/`everCorrect` too, so a hinted correct answer never
      // incremented `correct` — undercounting the LIVE ACCURACY numerator
      // (seen still advanced, correct did not) while leaving `everCorrect`
      // false, which is what a fact's real standing/history reads. So this
      // was not only a live-pill bug: a hint-then-correct answer was quietly
      // recorded as not-really-correct in the persisted per-fact record too.
      resolveShowing(st, credit, ok, showingOf(q));
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
      const mcSaid = picked != null ? labelOf(picked, q.dir, ctxFor(q), localFactInfo) : null;
      const typedSaid = given && given !== "(time)" ? given : null;
      const recognitionSaid =
        recognitionPick !== undefined && q.recognition
          ? q.recognition.options[recognitionPick] ?? null
          : null;
      // What was said, once, for the persisted per-phrase record
      // (FactSessionDetail reads st.saidByPhrase) — see resolveAnsweredText.
      // No longer also driving an on-screen "You answered" line (SAK-50
      // changes-requested: the learner's own answer is already visible in the
      // input she typed it into, so repeating it in the reveal was redundant).
      const saidText = resolveAnsweredText({ recognitionSaid, mcSaid, typedSaid });
      recordMissedPhrase(st, phrase, saidText);
      // The wrong pick to keep lit red at the reveal (SAK-50 changes-requested
      // follow-up), overwritten on every attempt like `saidText` above — only
      // one of the four can be non-null on any given miss, since `mc`,
      // `recognition`, `particleMarker` and `pitch` are mutually exclusive
      // board shapes for one showing (see DrillQuestion). A typed miss or a
      // particleDrill tap sets none of them; particleDrill already shows its
      // own wrong tap red via particle-tap-card.tsx's `outcome` state.
      q.mcWrongPick = picked !== undefined ? picked : null;
      q.recognitionWrongPick = recognitionPick !== undefined ? recognitionPick : null;
      q.particleMarkerWrongPick =
        particleMarkerPick !== undefined ? particleMarkerPick : null;
      q.pitchWrongPick = pitchPick !== undefined ? pitchPick : null;
      // `confused` is keyed by ENTRY — the thing you said instead of this fact's
      // answer. See FactSessionDetail: a confusion is a failure to tell two
      // entries apart, so it cannot be keyed by one of their facts.
      if (picked !== undefined && picked !== q.f) {
        // SAK-104: entryOf reads lib/facts.ts (server-only) — `picked` is an
        // MC-option fact, which can reach outside this leg's locally-resolved
        // pool (a subject's distractor pool, or the rare ALL_FACTS backstop —
        // see this component's fact-registry header). `said` is null, and the
        // confusion is silently NOT claimed, on the rare miss where that
        // option's factInfo hasn't resolved locally yet — the same "silence
        // beats invention" the confusion-search itself already practices.
        const said = localEntryOf(picked);
        // Two facts of ONE entry are not a confusion: picking 生's ショウ card
        // when the answer was 生's セイ card is a wrong answer about 生, not
        // mixing 生 up with something. `confused` is keyed by entry precisely
        // so this distinction has somewhere to live.
        if (said && said !== localEntryOf(q.f)) {
          st.confused[said] = (st.confused[said] ?? 0) + 1;
          // Same fact, remembered for the reveal rather than only counted. See
          // DrillQuestion.confused for why it is not cleared by a later try.
          q.confused = said;
        }
      } else if (
        particleDrillPick === undefined &&
        particleMarkerPick === undefined &&
        pitchPick === undefined &&
        given &&
        given !== "(time)"
      ) {
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
        // A particle-drill tap's `given` is the tapped chunk's TEXT, and a
        // marker-choice pick's `given` is the option's label, not a typed
        // answer — running either through the free-text confusion search would
        // try to match a fragment against known facts, which is not what this
        // check means. Skipped here, not upstream, so every other typed
        // path is untouched.
        const said = confusedWith(q.f, given, rt.deck, confusionKnownFacts(history));
        if (said && said !== localEntryOf(q.f)) {
          st.confused[said] = (st.confused[said] ?? 0) + 1;
          q.confused = said;
        }
      }
      q.tries++;
      // A binary (2-option) board skips retries outright — see
      // effectiveRetries in lib/engine — so a wrong first guess always falls
      // to the out-of-retries branch below, whatever cfg.retries says. Every
      // other board shape (typed, 3+ option MC, particle drill) is
      // unaffected: `left` still reads the live configured retries exactly
      // as before.
      const left = effectiveRetries(cfg, mcOptionCount(q)) - q.tries;
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
        // Requeue when wrong (default on): the missed card comes back later in
        // the run. Off means the run moves on — it is scored wrong here and not
        // re-shown. In-place `retries` are unaffected; this only gates the
        // post-retry requeue. See cfg.requeue.
        if (cfg.requeue) {
          const at = Math.min(rt.deck.length, rt.pos + requeueGap());
          rt.deck.splice(at, 0, q.f);
          rt.forms.splice(at, 0, q.form);
          rt.requeued++;
        }
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
   * not the small gap a forced requeue uses).
   *
   * SAK-50: a skip jumps straight to `nextQuestion()` and never reveals the
   * answer. A card that runs out of retries is a resolved miss and gets the
   * reveal pause (see submit and `isRevealPause`); a skip is a deferral, not
   * a resolution — the learner may just want to come back to it later, not
   * be told the answer now. (This app briefly paused skip on a reveal too;
   * that was reverted on feedback that skipping should not show the answer.)
   *
   * Not offered while `waiting`: once a card is out of retries it is already
   * resolved and requeued, and the Continue button is the only thing left to
   * do.
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

  /**
   * SAK-51: reveal the written prompt behind an audio-prompt card's speaker,
   * without touching anything about how the card is graded, spoken, or
   * scored. The one thing an audio card being "unanswerable" ever meant was
   * that no TEXT version of the prompt was reachable except by leaving the
   * drill for the settings drawer and turning Audio prompts off entirely —
   * this is the same escape, offered on the one card that needs it, for free
   * (see `textRevealed` on DrillQuestion for why it costs nothing). Idempotent,
   * and a no-op on a card that was never a listening card to begin with.
   */
  function showListenText() {
    if (!rt || !rt.q || finishedRef.current) return;
    if (!rt.q.listen || rt.q.textRevealed) return;
    rt.q.textRevealed = true;
    force();
  }

  /** Legacy bindDrill document keydown: Enter advances while waiting, Enter
   * in the answer box submits, digits 1–9 click MC options. */
  function onKeyDown(e: KeyboardEvent) {
    if (!rt || !rt.q || finishedRef.current) return;
    if (rt.waiting) {
      if (e.key === "Enter") nextQuestion();
      return;
    }
    // "?" TAKES THE HINT — but, like the digit shortcuts below, it stands off
    // a focused text input rather than firing globally. A learner typing an
    // answer needs every key they press to land in the box, "?" included
    // (SAK-56: ね's own glosses are "right?" / "isn't it?" / "doesn't it?" /
    // "don't you?", but the same is true of any answer in principle — this
    // isn't scoped to which card is on screen, only to whether the box has
    // focus). Outside a focused input — between questions, or on a
    // multiple-choice card with no text box at all — "?" is still the
    // keyboard shortcut for Hint. (1–9 are the MC options and Enter submits,
    // so both were spoken for.)
    if (e.key === "?") {
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA")
      )
        return;
      e.preventDefault();
      takeHint();
      return;
    }
    if (e.key === "Enter" && document.activeElement === inputRef.current) {
      const v = inputRef.current?.value ?? "";
      if (v.trim()) submit(v);
      return;
    }
    // SAK-133: a pitch board needs its OWN Enter path — it has no text input
    // to focus, so the plain "Enter while waiting" case above already
    // handles the reveal pause, but answering it takes a SELECTED clip
    // (pitchPick), not a keystroke into a box. Digits 1/2 only PLAY and
    // select the clip below; Enter is what actually grades it.
    if (e.key === "Enter" && rt.q.pitch && pitchPick !== null) {
      submit(`clip ${pitchPick + 1}`, undefined, undefined, undefined, undefined, pitchPick);
      return;
    }
    if ((rt.q.mc || rt.q.recognition || rt.q.pitch) && /^[1-9]$/.test(e.key)) {
      // Don't hijack digits typed into a field (e.g. the drawer's timer box).
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA")
      )
        return;
      const index = parseInt(e.key, 10) - 1;
      const opt = rt.q.mc?.[index];
      if (opt) submit(labelOf(opt, rt.q.dir, ctxFor(rt.q), localFactInfo), opt);
      else if (rt.q.recognition?.options[index]) {
        submit(rt.q.recognition.options[index], undefined, index);
      } else if (rt.q.pitch && (index === 0 || index === 1)) {
        playPitchClip(rt.q.pitch.clips[index]);
        setPitchPick(index);
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
      //
      // THE ASK GATE, applied to the LESSON path too. A kanji reading is only
      // ever asked inside a MULTI-PART word the learner knows (word-unlock.ts /
      // quizzableFacts) — the same cut `resolve` makes for every review, custom
      // and list drill. But the lesson seed skips `resolve`: startCurriculumLesson
      // drills `readingsProvedBy` DIRECTLY (home-feed.tsx), so a reading whose
      // only word is the single kanji itself (`kanji:一/reading@一`, the "on its
      // own" card task #22 removed) leaked straight onto the board — the owner hit
      // it on 一. Gating here, at the one place active.facts becomes a deck, closes
      // that hole for every entry point with LIVE post-`markSeen` history (the same
      // history `anchorForFact` reads below), so a reading with no known multi-part
      // anchor is dropped while `word:一` still tests its reading. The seed stays
      // broad (the reading is still marked seen and enters the pool the moment a
      // multi-part word proves it); only the ASK is narrowed.
      const facts = quizzableFacts(active.facts, history);
      const coverage =
        active.forceCoverage ||
        (active.snapshot.length === "limited" &&
          active.snapshot.limType === "cov");
      if (coverage) {
        const base = buildCoverageDeck(facts, active.snapshot.ask);
        // A construction category is one fact but represents a generated round,
        // not one memorized answer. Expand its coverage slot by the count owned
        // by that category's config. Every slot still flows through this normal
        // Drill runtime; only the fact repeats, and each showing rolls its own
        // frozen NumberQuizItem in presentCard.
        const built = { deck: [] as FactId[], forms: [] as CardForm[] };
        for (let i = 0; i < base.deck.length; i++) {
          const fact = base.deck[i];
          const repeats = constructionConfigForFact(fact)?.count ?? 1;
          for (let n = 0; n < repeats; n++) {
            built.deck.push(fact);
            built.forms.push(base.forms[i]);
          }
        }
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
        rt.pool = facts.filter((f) => usableForms(f).length > 0);
        rt.deck = buildDeck(rt.pool, { ...cfg, ...active.snapshot });
        rt.forms = rt.deck.map(() => null);
      }
      // SAK-104: the whole leg's fact pool is now resolved from a server
      // action rather than imported (see this component's fact-registry
      // header) — kicked off here, once, before the first card is asked.
      ensurePoolLoaded(rt.pool);
      // Warm every clip this deck can speak, up front and rate-limited, so a
      // listening card's audio is ready before it appears instead of being
      // synthesized on the spot. Only when audio prompts are on (a text-only run
      // speaks nothing), and over the DISTINCT facts (rt.pool), not the shuffled
      // deck's repeats. prefetchClips is a no-op unless a pack voice is in use.
      // SAK-104: speechForFact reads several guarded subject modules, so this
      // is its own round trip (resolveSpeechForFacts) rather than a client-side
      // call over the resolved factInfo map.
      if (cfg.audioPrompts) {
        void resolveSpeechForFacts(rt.pool).then((res) => {
          const texts = rt.pool
            .map((f) => res[f as unknown as string] ?? "")
            .filter((t): t is string => !!t);
          prefetchClips(texts, cfg.voiceName);
        });
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
    // Resuming (tab switch / remount / refresh): the local fact-registry map
    // is in-memory state, so it starts empty on THIS mount even though rt
    // itself survived — re-fetch the pool the same way a fresh quiz does.
    ensurePoolLoaded(rt.pool);
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
    // A showing in flight from before the reveal kept a wrong MC/recognition/
    // particleMarker pick lit red has no record of one either. Same tidiness
    // rule as `confused` just above.
    if (rt.q && rt.q.mcWrongPick === undefined) rt.q.mcWrongPick = null;
    if (rt.q && rt.q.recognitionWrongPick === undefined) rt.q.recognitionWrongPick = null;
    if (rt.q && rt.q.particleMarkerWrongPick === undefined) rt.q.particleMarkerWrongPick = null;
    if (rt.q && rt.q.pitchWrongPick === undefined) rt.q.pitchWrongPick = null;
    // A showing in flight from before SAK-51's fallback existed has not had
    // "Show text" pressed. Same tidiness rule as `confused` above. (The
    // similar `answered` backfill this used to sit beside was removed with
    // the field itself — SAK-50 changes-requested pass dropped the on-screen
    // "You answered" line.)
    if (rt.q && typeof rt.q.textRevealed !== "boolean") rt.q.textRevealed = false;
    if (rt.q && rt.q.recognition === undefined) rt.q.recognition = null;
    // A showing in flight from before the pitch question existed had none.
    // Same tidiness rule as `recognition` just above.
    if (rt.q && rt.q.pitch === undefined) rt.q.pitch = null;
    // A showing in flight from before the variant quiz existed had no variant.
    // Null, not undefined: ctxFor reads it through `?? undefined`, so this is
    // tidiness rather than load-bearing.
    if (rt.q && rt.q.variant === undefined) rt.q.variant = null;
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
      onAudioOff,
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

  // React live to the Audio-prompts toggle going OFF (drawer or Settings tab):
  // replace the listening card on screen with a text card and stop drawing more.
  // Value-diffed so hydration echoes don't fire it, and only on the off edge —
  // turning audio back on simply lets future cards be audio again.
  const prevAudio = useRef<boolean | null>(null);
  useEffect(() => {
    if (!ready) return;
    const prev = prevAudio.current;
    prevAudio.current = cfg.audioPrompts;
    if (prev === null || prev === cfg.audioPrompts) return;
    if (!cfg.audioPrompts) handlersRef.current?.onAudioOff();
  }, [ready, cfg.audioPrompts]);

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
    const live = rt?.q;
    if (!live || !live.listen || live.listenPlayed) return;
    live.listenPlayed = true;
    const current = rt?.q;
    // A construction HEAR card plays the ROLLED reading (さんぼん), not the fact's
    // category glyph — speechForFact(listenPlayFact) would say the bare counter.
    // The reading lives on the frozen item, so the audio matches exactly what is
    // graded. SAK-104: speechForFact reads several guarded subject modules, so
    // this reads the leg's own pre-fetched speech map (ensurePoolLoaded) rather
    // than importing it — listenPlayFact is always a pool fact.
    const text = current?.numberItem
      ? current.numberItem.reading
      : current?.form.source === "sentence" &&
          current.form.response === "definition"
        ? current.recognition?.jp
        : speechMap[listenPlayFact as unknown as string];
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
  // NO HINT ON A CARD BORN MULTIPLE CHOICE, but a TYPED card the learner
  // converted with "Choices" keeps its hint. The exclusion is about the ANSWER
  // being on the board (six printed options usually contain the hint), which is
  // true of a card that was always MC; a Choices conversion is the learner's own
  // move and must not also yank the Hint button (or a hint she had already
  // revealed) out from under her — see FIX 3. So the gate fires only for a card
  // that is MC and was NOT converted (choicesShown marks the conversion; a
  // recognition/grammar-selection card born MC has it false, which is correct —
  // those still get no hint via hintReady below).
  // A pitch showing (SAK-128) gets no hint at all, regardless of the MC gate
  // above: the mnemonic for q.f's own kanji/reading would hand the learner
  // exactly the thing the two-clip board is testing — unlike a recognition
  // board's hint (safe: it is about a grammar pattern, not which sentence is
  // playing), a pitch hint has no safe half to offer.
  const hint =
    active && rt?.q && !rt.q.pitch && !(rt.q.mc && !rt.q.choicesShown)
      ? hintFor(
          rt.q.f,
          rt.q.dir,
          anchorForFact(rt.q.f, history) ?? undefined,
          rt.q.listen && rt.q.form.source === "japanese",
          rt.q.grammarVehicle ?? undefined,
        )
      : null;
  const hintDrawn = useDrawnImage(hint?.kind === "image" ? hint.src : null);
  const hintReady = !!hint && (hint.kind !== "image" || hintDrawn);
  hintReadyRef.current = hintReady;

  // ---------- render ----------

  if (!active || !rt || !rt.q) return null;

  const q = rt.q;
  // SAK-51: the RENDER-ONLY shape of a listening card, distinct from `q.listen`
  // itself (which stays the graded, spoken truth throughout — autoplay,
  // checkTyped/ctxFor, hintFor, all read `q.listen` directly and are untouched
  // by this). Every place below that used to branch on "is this a listening
  // showing" to decide what to PRINT now branches on this instead, so pressing
  // "Show text" (showListenText) makes the card render exactly as its
  // non-listening twin would — the same fallback turning Audio prompts off in
  // the settings drawer already gives, just reachable without leaving the card.
  const listenVisible = effectiveListen(q.listen, q.textRevealed);
  // The word a kanji-reading card is asked IN — the known, multi-part anchor the
  // drill picked (電話 for 話). Set only for that card type, and only jp2en
  // (reading facts are jp2en; the guard is belt-and-braces). It drives two
  // things below: the halo shows the WHOLE WORD with this card's kanji lit rather
  // than the lone glyph, and the "in 電話" sublabel is dropped as redundant with
  // it. undefined for every other card, which then renders exactly as before.
  const readingWord =
    q.dir === "jp2en" && !listenVisible && isReadingFact(q.f)
      ? anchorForFact(q.f, history)
      : undefined;
  // What to put on screen is the fact's subject's answer, not this screen's.
  // The drill knows there is a glyph, maybe a line under it, and some options;
  // it does not know whether it is asking a kana, a kanji reading or a word.
  const ctx = ctxFor(q, anchorForFact(q.f, history));
  // A tap-drill card puts the SENTENCE itself in the halo (as the live,
  // tappable `body` — see the DrillHalo call below) with its English
  // translation beneath it via `context`, exactly where a word card's reading
  // sits. `glyph`/`jp` are set for the reveal branch's sake (unused by the
  // body path) and `note` stays null since the translation no longer lives
  // below the box. The role question ("Which word is the subject?") moves to
  // `instruction`, below the box — see `instruction` further down.
  const prompt = q.particleDrill
    ? {
        glyph: q.particleDrill.jp,
        jp: true,
        context: q.particleDrill.en,
        hint: null,
        note: null,
      }
    : q.particleMarker
      ? {
          glyph: q.particleMarker.jp,
          jp: true,
          context: q.particleMarker.en,
          hint: null,
          note: null,
        }
      : questionsFor(q.f).prompt(q.f, q.dir, ctx);
  const selectionFrame =
    q.grammarSelection?.frame ??
    (!listenVisible ? q.recognition?.jp : null) ??
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
    // A pitch SHOWING (q.pitch) already IS the pitch question — this DISPLAY-
    // only reading line exists for an ordinary meaning card that merely sits
    // beside an ambiguous homophone (SAK-98) and must never appear on a
    // showing that is actually grading which clip the learner picked; it
    // would draw the exact pattern the two clips are testing right on screen.
    if (q.pitch || listenVisible || q.dir !== "jp2en") return null;
    const info = localFactInfo(q.f);
    if (!info || info.subject !== VOCAB_KIND) return null;
    if (localWordMeaningFactId(info.glyph) !== q.f) return null;
    if (!meaningMustShowGlyph(q.f, history)) return null;
    const row = vocabRowMap[info.glyph];
    if (!row) return null;
    const reading = legacyReadingMap[row.keb];
    if (!reading) return null;
    const downstep = wordPitch(row.keb);
    return downstep == null ? null : { reading, downstep };
  })();
  // A WORD card's context — the other half of its reading-unit — goes INSIDE the
  // halo beneath the glyph (or the listening speaker), not on a muted line below
  // the instruction. This is computed HERE, not in question.ts, because what the
  // line says depends on `q.listen` and (for the collision case) `history`, which
  // question.ts is deliberately kept ignorant of:
  //   reading card         → the definition (never redundant with the glyph/audio)
  //   visual meaning card   → the reading kana — except the ambiguous-homophone
  //                           case, which shows it pitch-annotated via `promptPitch`
  //                           (the `reading` slot) and so suppresses this line
  //   audio meaning card    → NOTHING: the voice already IS the reading, so a kana
  //                           context just repeats it. Only a reading shared by a
  //                           word the learner knows (meaningMustShowGlyph) shows
  //                           the WRITTEN word, so she can tell which same-sounding
  //                           word is meant. Those ambiguous audio meaning cards
  //                           are already filtered out of the deck upstream by the
  //                           SAME predicate (usableForms / the coverage keep), so
  //                           in practice this reaches the `null` arm; the glyph
  //                           arm is belt-and-braces should that filter ever lift.
  const wordInfo = localFactInfo(q.f);
  const isWordCard = !!wordInfo && wordInfo.subject === VOCAB_KIND;
  const wordContext: ReactNode = (() => {
    // Same reasoning as promptPitch just above: a pitch showing's whole
    // question is "which clip is which word" — its reading, and (in "pair"
    // mode) which written word it belongs to, are exactly what is being
    // graded, so none of this card's ordinary reading/glyph context may
    // appear until the reveal (which draws its own pitch-marked answer, see
    // revealAnswer's `q.pitch` arm below).
    if (q.pitch) return null;
    if (!isWordCard) return null;
    if (localIsWordReadingFact(q.f)) {
      // An AUDIO reading card is dictation — you HEAR the word and type the
      // kana — so the meaning adds nothing and would wrongly imply "produce the
      // reading from the meaning." Only the VISUAL reading card (or a listening
      // one with its text revealed, SAK-51) shows it.
      if (listenVisible) return null;
      return prompt.context ? (
        <span className="text-[15px] text-text">{prompt.context}</span>
      ) : null;
    }
    // Meaning card.
    if (listenVisible) {
      return meaningMustShowGlyph(q.f, history) ? (
        <span
          className="text-[20px] leading-none text-text"
          style={{ fontFamily: q.font }}
          lang="ja"
        >
          {prompt.glyph}
        </span>
      ) : null;
    }
    // Visual meaning card: the reading kana, unless the pitch line already shows it.
    if (promptPitch) return null;
    return prompt.context ? (
      <span className="text-[15px] text-text">{prompt.context}</span>
    ) : null;
  })();
  // `q.mc` is the truth about how this card is being ANSWERED, which is what the
  // instruction has to describe — "which of these" over a text box would be
  // worse than saying nothing.
  const instruction = q.particleDrill
    ? // The sentence and its translation are in the halo now (see `prompt`
      // above); this line carries the actual question — which role is being
      // asked about, tappably.
      q.particleDrill.prompt
    : q.particleMarker
      ? "Which particle marks this word?"
      : q.recognition
        ? "Pick the sentence's meaning."
        : q.pitch
          ? // SAK-128's two mechanics ask two different questions over the
            // same two-clip board: "pair" names the CURRENT word's meaning
            // ("which one means X" — the other clip is a different word
            // entirely); "wrong" asks the learner to judge the pitch itself.
            q.pitch.mode === "pair"
            ? `Which one means "${q.pitch.promptGloss}"?`
            : "Which one sounds right?"
      : q.numberItem
      ? // A construction card asks for a count, not a word meaning — its generic
        // instruction ("what does this word mean") would be a lie. A READ card
        // wants the reading spelled out, so it mirrors the word track's exact
        // phrasing for a reading card ("Type how this word is said." — see
        // isSound in quiz-instruction.ts) rather than inventing its own line.
        q.numberItem.direction === "read"
        ? "Type how this word is said."
        : q.numberItem.direction === "hear"
          ? "Type the number you hear."
          : "Type the number."
      : q.variant
        ? // A variant showing puts a component form (亻) in the halo over a board
          // of kanji and asks which character it belongs to. The whole question is
          // this ONE line — the grey "which character is this a form of?"
          // sub-label was dropped (see the variant prompt in engine/question.ts),
          // the way the grammar form-name folded into its instruction.
          "Which of these is this a form of?"
        : quizInstruction(q.f, q.dir, q.mc ? "mc" : "typed", q.grammarVehicle ?? undefined);
  const total = limited ? rt.deck.length : null;
  const pct = total ? Math.min(100, Math.round((100 * rt.resolved) / total)) : null;
  // The card already decided its shape at ask time: MC options were built (or
  // not) in nextQuestion, which is also where an un-romaji-able en2jp card was
  // routed to MC. So the presence of options is the single source of truth for
  // which control to show — deriving it from the style again could disagree
  // with what was built (e.g. an MC-style card that fell back for want of
  // distractors).
  const typedMode =
    !q.mc && !q.recognition && !q.particleDrill && !q.particleMarker && !q.pitch;
  // Live romaji→kana exactly when the ANSWER is Japanese, which is not the same
  // question as which direction the card faces. Keyed on direction alone this
  // was wrong both ways: a jp2en kanji reading wants せい and got a latin box,
  // unanswerable without an IME; and turning it on for every typed card would
  // convert "life" on a kanji meaning card into らいふ and mark it wrong. The
  // subject owns the answer, so the subject owns the question — see
  // `answerIsJapanese`, the one place this is decided.
  // A construction card overrides the answer script directly: READ wants the kana
  // reading (romaji→kana box), WRITE and HEAR want the count as digits (a numeric
  // box, no romaji conversion). Every other card asks the subject.
  const romajiInput = q.numberItem
    ? q.numberItem.direction === "read"
    : typedMode && answerIsJapanese(q.f, q.dir);
  // WRITE / HEAR answer with digits, so the box asks for a numeric keyboard.
  const numericInput = !!q.numberItem && q.numberItem.direction !== "read";
  // What the box wants, in words. Same predicate as `romajiInput` above, via
  // one module — see lib/drill-guidance.ts for why it must not be a second
  // list. Null on multiple choice, which has no box to explain.
  // A construction card's box wants a reading (READ) or digits (WRITE / HEAR),
  // never an English meaning — so it names its own guide rather than asking the
  // subject, whose answer for a `word` fact is a gloss.
  const guide = !typedMode
    ? null
    : q.numberItem
      ? q.numberItem.direction === "read"
        ? { placeholder: "Type kana, Enter to submit", note: "Romaji turns into kana as you type." }
        : { placeholder: "Type the number, Enter to submit", note: "Answer with digits." }
      : answerGuide(q.f, q.dir);
  // Two different lines, and only one of them is a preference. `context` is
  // part of the question — "in 人生" is what makes 生 gradeable — so the
  // setting cannot touch it. `hint` is kana's script tag, which is decoration.
  const hintTag = cfg.scriptLabel ? (prompt.hint ?? "") : "";

  // Retries: pips are the only representation. Unlimited shows an ∞ instead,
  // and "none" has nothing to say, so it says nothing. A binary board reads
  // as "none" here too (effectiveRetries returns 0), so the pips never
  // promise a second guess this board isn't going to give.
  const allowed = effectiveRetries(cfg, mcOptionCount(q));
  const retriesLeft = Math.max(0, allowed - q.tries);
  const unlimited = allowed === Infinity;
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
  // A finished miss (out of retries) — leaves the card on screen with nothing
  // left to do but read the reveal and move on. This is the state that needs
  // a way FORWARD. `revealing` (the answer text) is this AND the show-answer
  // setting; the Continue affordance keys on `revealPause` alone, so it is
  // present even with reveal off. A CORRECT answer auto-advances, so its
  // `rt.waiting` is excluded, and a SKIP never reaches this state at all — it
  // advances immediately (see isRevealPause, SAK-50).
  // "warn" (SAK-122) is not a RevealFeedbackKind — it is not a resolved
  // showing at all, so it never counts as a reveal pause — hence the local
  // narrowing rather than widening the shared RevealFeedback type every
  // other screen (grid, assembly) also uses.
  const revealPause = isRevealPause(
    rt.feedback && rt.feedback.kind !== "warn" ? { kind: rt.feedback.kind } : null,
    rt.waiting,
  );
  // Paused on a reveal-eligible stop, with the setting on: show the answer in
  // the answer slot (the reveal that used to be a sentence).
  const revealing = cfg.showAnswer && revealPause;
  // The mix-up, named at the reveal and nowhere else. Not on a miss with goes
  // left — you are still answering, and the app telling you what you nearly
  // confused it with would be handing you the answer mid-question.
  const mixup =
    revealing && q.confused && localEntryOf(q.f)
      ? confusionNote(localEntryOf(q.f)!, q.confused)
      : null;
  // The reveal that shows a word's READING is the moment the app confirms how
  // the word sounds — exactly where a wrong pitch habit would set. So when the
  // revealed answer is a word's reb and that word has a verified pitch, draw the
  // reb in the overline notation instead of plain. Guarded to the reading fact
  // (revealed text === the row's reb) and to words with pitch; everything else,
  // including en2jp where the reveal is the kanji, falls through untouched. See
  // src/data/pitch.ts and pitch-mark.tsx. DISPLAY only — never graded.
  const revealPitch = (() => {
    // A pitch showing draws its OWN reveal (see revealAnswer's `q.pitch` arm
    // below, off q.pitch.reading/correctDownstep) — this generic reading-
    // reveal is for an ORDINARY reading card that happens to have verified
    // pitch, a different case entirely.
    if (q.pitch || !revealing) return null;
    const info = localFactInfo(q.f);
    if (!info || info.subject !== VOCAB_KIND) return null;
    const row = vocabRowMap[info.glyph];
    if (!row) return null;
    const reading = legacyReadingMap[row.keb];
    if (!reading || revealFor(q.f, q.dir, ctx) !== reading) return null;
    const downstep = wordPitch(row.keb);
    return downstep == null ? null : { reading, downstep };
  })();
  // The reveal's answer, as one node plus the two facts revealTemplate needs
  // to pick "This is said …" vs "This means …" vs the plain fallback — SAK-50
  // changes-requested pass. Every branch below used to render its own
  // giant-text answer directly; now they all produce the same shape so ONE
  // sentence (and one fixed-bottom slot) can hold any of them.
  const revealAnswer = !revealing
    ? null
    : q.particleDrill
      ? {
          node: (
            <span lang="ja">
              {
                q.particleDrill.chunks.find((c) => c.id === q.particleDrill?.answerChunkId)
                  ?.text
              }
            </span>
          ),
          isSound: false,
          isMeaning: false,
        }
      : q.particleMarker
        ? {
            node: (
              <span lang="ja">
                {
                  q.particleMarker.options.find(
                    (o) => o.recipeId === q.particleMarker?.recipeId,
                  )?.label
                }
              </span>
            ),
            isSound: false,
            isMeaning: false,
          }
        : q.recognition
          ? { node: q.recognition.answer as ReactNode, isSound: false, isMeaning: true }
          : q.pitch
            ? {
                // The pitch showing's own reveal: the CORRECT clip's reading,
                // drawn with its overline — same DISPLAY convention
                // revealPitch uses for an ordinary reading card, just off
                // this showing's own frozen (reading, correctDownstep)
                // rather than a fresh lookup.
                node: (
                  <PitchReading
                    reading={q.pitch.reading}
                    downstep={q.pitch.correctDownstep}
                  />
                ),
                isSound: true,
                isMeaning: false,
              }
            : {
              node: revealPitch ? (
                // Same answer text, drawn with its pitch-accent overline. See
                // revealPitch above: only ever a word reading that has a
                // verified pitch, DISPLAY only.
                <PitchReading reading={revealPitch.reading} downstep={revealPitch.downstep} />
              ) : (
                // One call, no fallback composed here. The `?? answers[0]`
                // this replaced was the "a = a" bug: in en2jp a fact's first
                // baked answer IS the prompt. See revealFor.
                (revealFor(q.f, q.dir, ctx) as ReactNode)
              ),
              isSound: isSound(q.f, q.dir),
              isMeaning: answerIsMeaning(q.f, q.dir),
            };
  const revealTmpl = revealAnswer
    ? revealTemplate({ isSound: revealAnswer.isSound, isMeaning: revealAnswer.isMeaning })
    : null;

  const accuracy = cfg.showAccuracy
    ? liveAccuracy(rt.stats)
    : null;
  const controlsLit = !fadeControls || controlsAwake || drawerOpen;
  // "Look again" is offered only for a session that has a lesson to return to.
  // A one-off quiz (no session) or a session with nothing new to teach has no
  // teach screen, so the control would go nowhere.
  const hasLesson = !!session && session.teach.length > 0;

  return (
    // .kq-center-frame (globals.css, SAK-10): a floor-height wrapper so the
    // stage below reads as vertically centered on a short quiz instead of
    // pinned to the top with a dead gap under it, while still growing (and
    // scrolling with the page) for a card tall enough to need it — the
    // drawer opening, or a long reveal/hint stack.
    <div className="kq-center-frame">
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
              correct" and "🔥 0" both report an absence as if it were data. */}
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
                {formatAccuracy(accuracy)} correct
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

      {/* flex-1 + justify-center: takes whatever room .kq-center-frame's
          floor leaves below the HUD and centers the stage inside it. When
          the stage itself is taller than that (drawer open, long reveal),
          this simply grows past the floor — no fixed height here to clip
          against.

          pb-28 is a CONSTANT reservation for the fixed reveal bar at the
          bottom of the viewport (see the end of this component), present
          whether or not that bar is actually showing right now — a constant
          never changes, so it cannot be the thing that shifts the stage when
          a miss resolves (SAK-50 changes-requested: that shift was exactly
          Sam's complaint about the old in-flow reveal). */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4 pb-28">
        <DrillHalo
          // Re-mounts on every new card and every attempt, which is what
          // replays the entry sweep, the shake and the glyph cross-fade.
          key={`${rt.asked}-${q.tries}`}
          cardKey={`${rt.asked}-${q.tries}`}
          state={haloState}
          timerLeft={rt.timerLeft ?? 0}
          drainWindow={drainWindow}
          paused={drawerOpen}
          // A kanji-reading card shows the WHOLE WORD (電話) so the reading is
          // asked in context, with this card's kanji lit and the rest dimmed (see
          // `highlight`). Every other card shows its own glyph. The word is
          // context, not a leak: the highlighted glyph's reading is the answer and
          // is never printed.
          glyph={readingWord ?? prompt.glyph}
          highlight={readingWord ? prompt.glyph : undefined}
          jp={prompt.jp}
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
          // The base size a WRAPPING text prompt starts from before the halo
          // shrink-to-fits it (fontSize above is the single-line path, still
          // used by the highlighted reading-word). A lone glyph fits at base and
          // stays big; a long English cue wraps down from here.
          maxFontSize={prompt.jp ? GLYPH_PX : Math.round(GLYPH_PX * 0.6)}
          crossFade={q.tries === 0}
          // A listening card hides the glyph and plays the word instead; the
          // speaker replays it. `glyph` above is still passed (harmless — the
          // halo ignores it while listening) so the reveal slot below can show
          // the written word the learner just heard. `listenVisible`, not
          // `q.listen`, so pressing "Show text" (SAK-51) swaps the speaker for
          // the same glyph a non-listening twin of this card would show.
          // SAK-133 changes-requested: a pitch showing used to also force
          // the halo into listening mode (blank, speaker-only — no glyph),
          // on the theory that showing 箸 while asking "which clip means
          // chopsticks" would answer the question. It doesn't: which clip is
          // correct is purely acoustic (the downstep), and the glyph/gloss
          // never says that — hiding it just left the halo looking broken
          // (an empty box with one faint icon, no sign of what word is even
          // being asked about). So a pitch showing now renders its glyph
          // exactly like any other jp2en meaning card; onListen stays a
          // no-op for it regardless, since the halo's centre icon has no
          // business playing (or leaking) either clip — that's what the
          // pitch board's own two buttons below are for.
          listen={listenVisible}
          onListen={() => {
            if (q.pitch) return;
            const text = q.numberItem
              ? q.numberItem.reading
              : q.form.source === "sentence" && q.form.response === "definition"
                ? q.recognition?.jp
                : speechMap[q.f as unknown as string];
            if (text) speak(text, cfg.voiceName);
          }}
          sentenceFrame={selectionFrame ?? undefined}
          // The tap-drill's live sentence (and its marker-choice sibling's
          // static highlighted one) replace the plain glyph/frame entirely —
          // see DrillHalo's `body` doc. Built here, not passed as a ready
          // component from further up, so it can read `revealing`/`rt.waiting`,
          // which are computed in this scope.
          body={
            q.particleDrill ? (
              <ParticleTapCard
                question={q.particleDrill}
                disabled={rt.waiting}
                revealCorrect={revealing}
                onTap={(chunkId) => {
                  const said =
                    q.particleDrill?.chunks.find((c) => c.id === chunkId)?.text ?? chunkId;
                  submit(said, undefined, undefined, chunkId);
                }}
              />
            ) : q.particleMarker ? (
              <ParticleMarkerSentence jp={q.particleMarker.jp} highlightSpan={q.particleMarker.highlightSpan} />
            ) : undefined
          }
          reading={
            promptPitch ? (
              <PitchReading
                reading={promptPitch.reading}
                downstep={promptPitch.downstep}
                className="text-[13px] text-text-muted"
              />
            ) : undefined
          }
          // A WORD card's context sits INSIDE the box beneath the glyph/speaker;
          // its old muted sub-label below the instruction is suppressed (see the
          // `!isWordCard` guard there). A tap-drill's English translation sits
          // the same way, beneath its sentence.
          context={
            q.particleDrill
              ? q.particleDrill.en
              : q.particleMarker
                ? q.particleMarker.en
                : (wordContext ?? undefined)
          }
        />
        {/* SAK-51: an audio-prompt card used to be a blank box with a speaker
            icon and no text anywhere — unanswerable if the audio never plays
            (muted device, no TTS voice, or a hard-of-hearing learner), with
            the only way out being to find the Audio-prompts toggle in the
            settings drawer. This is that same escape, reachable from the card
            itself: pressing it flips `listenVisible` (see above) so the halo
            swaps its speaker for the glyph a text card would show, same as
            turning the setting off would draw fresh — but for THIS card only,
            with no reset of tries or credit. Gone the instant it's pressed
            (`!q.textRevealed`), and absent entirely on a non-listening card. */}
        {q.listen && !q.textRevealed ? (
          <SmallBtn
            onClick={showListenText}
            title="Show the word as text instead of relying on audio"
          >
            Show text
          </SmallBtn>
        ) : null}
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
            instruction above — the frame that gives a card with several plausible
            answers exactly one: "polite form" over a verb glyph, "Which verb
            fits?" over a transitivity pair, sel.frame's blanked sentence.

            A KANJI READING NEVER SHOWS ONE ANYMORE. Both of its old sublabels are
            gone. "in 電話" is dropped because the WHOLE WORD is in the halo with
            the kanji lit (`readingWord`) — repeating it underneath is noise (Sam,
            task #22). "on its own" is gone at the root: a reading anchored to the
            single kanji itself (`kanji:一/reading@一`) is filtered out of the deck
            (see onMount / quizzableFacts), never asked, because `word:一` already
            tests that exact reading — so the redundant "how is this kanji said in
            this word / on its own" card the owner hit on 一 cannot reach here.

            The bare "meaning" / "reading" / "in japanese" labels are dropped too —
            the full instruction already says which it is (typing the word from an
            English prompt is always Japanese), so they were only noise (Sam).
            Muted, because it supports the white instruction rather than
            competing. */}
        {!selectionFrame &&
        !readingWord &&
        !isWordCard &&
        !q.particleDrill &&
        !q.particleMarker &&
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

        {q.particleDrill ? null : q.particleMarker ? (
          // Same 3-per-row option board every other MC board uses (see the
          // long comment on the recognition/mc board below for why this is a
          // wrapping FLEX row rather than a fixed CSS grid) — options built
          // from the marker-choice board (recipe id + display pattern) rather
          // than FactIds — see lib/engine/particle-drill.ts's header for why
          // this is a bespoke board, not a run through the ordinary
          // FactId-keyed distractor machinery.
          <div className="flex w-[min(92vw,480px)] flex-wrap justify-center gap-2">
            {q.particleMarker.options.map((option, i) => (
              <button
                key={option.recipeId}
                onClick={() => submit(option.label, undefined, undefined, undefined, option.recipeId)}
                className={cx(
                  "flex min-h-15 shrink-0 grow-0 basis-[calc((100%-16px)/3)] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2 text-center text-xl wrap-break-word",
                  revealing && option.recipeId === q.particleMarker?.recipeId
                    ? "border-success bg-success-bg text-success"
                    : // The wrong pick stays selected in red alongside the
                      // correct option's green (SAK-50 changes-requested
                      // follow-up) — see DrillQuestion.particleMarkerWrongPick.
                      revealing && option.recipeId === q.particleMarkerWrongPick
                      ? "border-danger bg-danger-bg text-danger"
                      : "border-border bg-card text-text hover:bg-panel",
                )}
              >
                <span lang="ja">{option.label}</span>
                <span className="text-[10px] text-text-muted">{i + 1}</span>
              </button>
            ))}
          </div>
        ) : q.pitch ? (
          // SAK-133: two audio clips — tap either one to PLAY it and mark it
          // selected (repeatable, no commit), then press Check (or Enter) to
          // grade the currently selected clip. Unlike a text/kanji MC board,
          // where every option is already fully visible before any tap, the
          // two options here ARE audio: comparing them requires being able
          // to play both before deciding, so a tap can no longer also submit.
          <div className="flex flex-col items-center gap-3">
            <div className="flex w-[min(92vw,480px)] flex-wrap justify-center gap-3">
              {q.pitch.clips.map((clip, i) => (
                <button
                  key={clip}
                  onClick={() => {
                    playPitchClip(clip);
                    setPitchPick(i as 0 | 1);
                  }}
                  aria-label={`Play clip ${i + 1}`}
                  aria-pressed={pitchPick === i}
                  className={cx(
                    "flex min-h-20 shrink-0 grow-0 basis-[calc((100%-12px)/2)] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-3 py-3 text-center",
                    revealing && i === q.pitch?.correct
                      ? "border-success bg-success-bg text-success"
                      : // The wrong pick stays selected in red alongside the
                        // correct clip's green (SAK-50 changes-requested
                        // follow-up) — see DrillQuestion.pitchWrongPick.
                        revealing && i === q.pitchWrongPick
                        ? "border-danger bg-danger-bg text-danger"
                        : !revealing && pitchPick === i
                          ? "border-accent bg-panel text-text"
                          : "border-border bg-card text-text hover:bg-panel",
                  )}
                >
                  <SoundIcon className="size-8" />
                  <span className="text-[10px] text-text-muted">{i + 1}</span>
                </button>
              ))}
            </div>
            {!revealing ? (
              <span className="text-[11px] text-text-muted">
                tap either clip to hear it, then Check
              </span>
            ) : null}
          </div>
        ) : typedMode ? (
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
              inputMode={numericInput ? "numeric" : undefined}
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
                    ? toKana(e.target.value, { live: true, katakana: q.katakana })
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
                standing instruction, not part of the question.
                SAK-122: a wrong-script/format retype (rt.feedback.kind ===
                "warn") takes this slot instead — it is a MORE useful thing to
                say right now than the standing note, and the card is not
                resolved (no reveal, no miss), so this is the only place the
                warning has to go. */}
            <span
              className={cx(
                "text-[11px]",
                rt.feedback?.kind === "warn" ? "text-warning" : "text-text-muted",
              )}
            >
              {rt.feedback?.kind === "warn" ? rt.feedback.message : guide?.note}
            </span>
            </span>
          ) : (
          // A UNIFORM OPTION ROW, up to 3 per line. Every option box is the
          // same fixed width (basis-[(100%-gaps)/3]) and wraps onto a new
          // line past 3, so a six-option keigo board is a clean 2×3.
          //
          // This is a wrapping FLEX row, not a CSS grid — deliberately, and
          // that is the SAK-54 fix. A `grid-cols-3` with `1fr` tracks always
          // reserves all three column tracks regardless of how many cells are
          // filled, so a 2-option board (real: transitivity pairs run
          // maxOptions: 2) occupied columns 1–2 and left column 3 empty,
          // reading as pinned to the left instead of centered under the
          // prompt. `justify-content: center` cannot fix that in grid: it
          // centers the TRACK SET, and the track set is still three columns
          // wide whether or not the third one holds anything.
          //
          // Flex has no such reserved-but-empty third slot: each row only
          // exists for as many items as actually flow into it, so
          // `justify-center` centers the row that's really there — one row of
          // two, a clean 2×3, or anything between. Fewer options just fill
          // fewer boxes in a shorter, centered row — a two-option verb-pair
          // board is one centered row of two, not a padded 2×3 with holes.
          // `shrink-0 grow-0` keep every box the same size regardless of row
          // fill (the old grid's "SAME box" guarantee); `basis-[...]` reserves
          // the same three-per-row width the grid's `1fr` tracks gave.
          // Height parity across a wrapped line comes for free — flex-wrap's
          // default `align-items: stretch` sizes every item in a line to that
          // line's tallest, the same job `auto-rows-fr` used to do. Long
          // option text ("eat / drink (honorific)") still wraps inside the
          // fixed box rather than widening it. Selection/answer states, the
          // number labels and the click handlers are exactly as before.
          <div className="flex w-[min(92vw,480px)] flex-wrap justify-center gap-2">
            {q.recognition?.options.map((option, i) => (
              <button
                key={`${i}-${option}`}
                onClick={() => submit(option, undefined, i)}
                className={cx(
                  "flex min-h-[60px] shrink-0 grow-0 basis-[calc((100%-16px)/3)] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2 text-center text-sm wrap-break-word hyphens-auto",
                  revealing && i === q.recognition?.correct
                    ? "border-success bg-success-bg text-success"
                    : // The wrong pick stays selected in red alongside the
                      // correct option's green (SAK-50 changes-requested
                      // follow-up) — see DrillQuestion.recognitionWrongPick.
                      revealing && i === q.recognitionWrongPick
                      ? "border-danger bg-danger-bg text-danger"
                      : "border-border bg-card text-text hover:bg-panel",
                )}
              >
                <span>{option}</span>
                <span className="text-[10px] text-text-muted">{i + 1}</span>
              </button>
            ))}
            {q.mc?.map((opt, i) => (
              <button
                key={opt}
                onClick={() => submit(labelOf(opt, q.dir, ctx, localFactInfo), opt)}
                className={cx(
                  "flex min-h-[60px] shrink-0 grow-0 basis-[calc((100%-16px)/3)] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2 text-center text-xl wrap-break-word",
                  // The option you should have picked, lit alongside the reveal.
                  revealing && opt === q.f
                    ? "border-success bg-success-bg text-success"
                    : // The wrong pick stays selected in red alongside the
                      // correct option's green (SAK-50 changes-requested
                      // follow-up) — see DrillQuestion.mcWrongPick.
                      revealing && opt === q.mcWrongPick
                      ? "border-danger bg-danger-bg text-danger"
                      : "border-border bg-card text-text hover:bg-panel",
                )}
                style={
                  q.dir === "en2jp" && q.mcFonts
                    ? { fontFamily: q.mcFonts[i] }
                    : undefined
                }
              >
                <span>{labelOf(opt, q.dir, ctx, localFactInfo)}</span>
                <span className="text-[10px] text-text-muted">{i + 1}</span>
              </button>
            ))}
          </div>
        )}

        {/* On a short viewport the 3-column option grid can run past the
            fold with nothing on screen to say so — the page scrolls (see
            layout.tsx), but a learner has no reason to try scrolling a quiz
            card unless something tells them there's more. Self-hiding: gone
            the moment the page has nothing left below to scroll to. Not
            shown for typedMode (nothing to overflow — one input box) or
            particleDrill (a tap-the-sentence board, not this grid). See
            SAK-21. */}
        {!typedMode && !q.particleDrill ? <ScrollCue /> : null}

        {/* The reveal used to render here, in-flow — which was exactly the
            layout shift Sam flagged (SAK-50 changes-requested): the answer
            appearing pushed the retries pips, Skip/Hint/Choices row and hint
            drawer down the page. It now renders in a fixed bar pinned to the
            bottom of the viewport instead (see the end of this component),
            so nothing above it ever moves when a miss resolves. */}

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

        {/* Always rendered so the drawer below doesn't shift when waiting starts. */}
        <span
          className={`flex flex-col items-center gap-3${rt.waiting && !q.hinted ? " invisible pointer-events-none" : ""}`}
          aria-hidden={rt.waiting && !q.hinted ? true : undefined}
        >
          <span className="flex flex-col items-center gap-3">
            <span className="flex items-center justify-center gap-3">
              {/* SAK-133: a pitch board's own submit — its two options are
                  audio, tapped to PLAY rather than to answer, so grading
                  needs an explicit action instead of the tap itself. Same
                  Enter shortcut as the typed board (see onKeyDown), disabled
                  until a clip has actually been selected. */}
              {q.pitch ? (
                <Btn
                  go
                  className="w-20"
                  disabled={pitchPick === null}
                  onClick={() => {
                    if (pitchPick === null) return;
                    submit(
                      `clip ${pitchPick + 1}`,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      pitchPick,
                    );
                  }}
                  title="Check (Enter)"
                >
                  Check
                </Btn>
              ) : null}
              <Btn
                className="w-20"
                onClick={skipQuestion}
                title="Skip, ask this again later"
              >
                Skip
              </Btn>
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
              {/* Only on a card still shown as a text box (typedMode) that has a
                  real board to offer (precomputed at ask time; null when ≤1
                  option) and has not already been converted. Separate from Hint:
                  it forfeits the same first-try credit but through choicesShown,
                  not hinted, so it never opens the mnemonic drawer. */}
              {typedMode && q.choicesBoard && !q.choicesShown ? (
                <Btn
                  className="w-20"
                  onClick={showChoices}
                  title="Show choices"
                >
                  Choices
                </Btn>
              ) : null}
            </span>
            {/* Suppressed once revealPause starts: the fixed reveal bar below
                takes over showing hint content at that point (unconditionally,
                not gated on q.hinted — see revealAnswer), so keeping this copy
                visible too would just be the same mnemonic twice on screen. */}
            {q.hinted && hint && !revealPause ? <HintBody hint={hint} font={q.font} /> : null}
          </span>
        </span>
      </div>

      {/* THE REVEAL, now a fixed bar pinned to the bottom of the viewport
          instead of an in-flow element on the card (SAK-50 changes-requested:
          Sam's complaint was specifically that the old reveal pushed the rest
          of the page around when it appeared). `position: fixed` takes it
          completely out of document flow, so nothing above it — halo, input,
          MC board, retries pips, Skip/Hint/Choices row — ever moves when this
          shows or hides; `pb-28` above is the one-time constant reservation
          that keeps it from covering that row while it's up.

          Present for every revealPause, not only cfg.showAnswer ones: Continue
          is the only way off a finished miss (see the comment this replaced),
          so the bar itself must render even with the setting off — it only
          drops the sentence/hint content in that case.

          Sentence + hint content: `revealTmpl` picks "This is said …" /
          "This means …" / the plain fallback (see revealTemplate,
          lib/drill-reveal.ts, chosen off the same isSound/answerIsMeaning
          axes the instruction line already uses), and the hint content below
          it is the exact HintBody the Hint button would have shown for this
          question — reused, not reinvented, and shown unconditionally here
          since the answer is already out. No "You answered" line: the
          learner's own answer is still sitting in the input she typed it
          into. */}
      {revealPause ? (
        <div className="kq-band fixed inset-x-0 bottom-0 z-20 border-t border-border px-4 py-3">
          <div className="mx-auto flex max-h-[45vh] max-w-xl flex-col items-center gap-2 overflow-y-auto text-center">
            {revealAnswer && revealTmpl ? (
              <>
                <p className="min-h-[38px] max-w-[420px] wrap-break-word text-lg font-semibold text-text">
                  {/* Re-states what was actually on screen (the prompt face,
                      not the answer face — they differ in en2jp) ahead of the
                      answer sentence, so the reveal names what was ASKED
                      rather than leaving the learner to infer it from the
                      card above. See revealFor / the module doc up top. */}
                  <span className="text-lg">{prompt.glyph}</span>
                  {" — "}
                  {revealTmpl.prefix}
                  <span className="text-danger">{revealAnswer.node}</span>
                  {revealTmpl.suffix}
                </p>
                {mixup ? (
                  <p className="max-w-[320px] text-center text-[11px] text-text-muted">
                    {mixup}
                  </p>
                ) : null}
                {hintReady && hint ? <HintBody hint={hint} font={q.font} /> : null}
              </>
            ) : null}
            <SmallBtn onClick={nextQuestion} title="Continue (Enter)">
              Continue
            </SmallBtn>
          </div>
        </div>
      ) : null}

      {drawerOpen ? <DrillDrawer onClose={() => setDrawerOpen(false)} /> : null}
    </div>
  );
}
