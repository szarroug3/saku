"use client";

// Home — the curriculum, top to bottom: what to learn next.
//
// ON THE CONTENT MODEL. Every track is now one shape: a sequence of TEACHING
// UNITS (unit-tracks.ts) the shared scheduler (unit-scheduler.ts) cuts into
// lessons, uniformly, over dueness/cost/prereqs/budget. So this file no longer
// carries a bespoke card and handler per track (kanji-vs-words word-unlock,
// counter marker/category juggling, grammar's own lesson type). It iterates
// UNIT_TRACKS, asks each for its next lesson against the learner's history, and
// renders the SAME card — NextLessonPreview — for every one of them.
//
// THE RULE, unchanged: a card is shown only when it has real work to offer. A
// track whose scheduler returns null this frame is simply not rendered.
//
// KANA IS THE GATE. Kanji's curriculum is a thousand lessons deep; offering it
// beside あいうえお hands a beginner a second front. So while the kana track still
// has a lesson (or an open kana session resting), ONLY the kana card shows;
// finish or claim the last kana group and the post-kana tracks become eligible.
// Sentences retain their additional gate: enough readable vocabulary, plus a
// relevant learned grammar pattern after the simple tier.
//
// WHAT HOME IS NOT (unchanged). Home does not own quiz SETUP or SELECTION — that
// is the Practice page. There is no generic "where you left off" card: a lesson
// left mid-session is resumed from its own track's card (Continue), which lights
// when an in-progress run belongs to that track (trackKeyForRun below).

import { startTransition, useMemo } from "react";

import { CurriculumComplete } from "@/components/home/curriculum-complete";
import { ClaimExplainer } from "@/components/lesson/claim-explainer";
import { NextLessonPreview } from "@/components/learn/next-lesson-preview";

// /learn schedules over a PRECOMPUTED index, not the live curriculum content: the
// ~8.6 MB dictionary is derived at build time into learn-index.json and this page
// carries only the tiny scheduling shape (glyph, typeLabel, fact-ids, prereqs).
// See docs/perf-learn-bundle.md and src/lib/content/learn-index.ts.
import {
  LEARN_TRACKS,
  nextLearnLesson,
  nextSentenceLearnLesson,
  sentenceLearnLessonForRun,
  sentenceTierIdOfEntry,
  trackIdOfFact,
  CURRICULUM_GLYPHS,
} from "@/lib/content/learn-index";
import type { IndexUnit } from "@/lib/content/learn-index-types";
import type { UnitLessonOf } from "@/lib/content/unit-scheduler-core";
import { positionLabel, type LessonPosition } from "@/lib/lesson-position";
import { resumeLesson } from "@/lib/lesson-resume";

import type { Why } from "@/data/why";
import { useHistoryWrites } from "@/lib/history-writes";
import { useHistory } from "@/lib/use-history";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type RunInfo } from "@/lib/quiz-session";
import type { FactId } from "@/types";

/** A /learn lesson: the units the frontier chose, in teach order. */
type LearnLesson = UnitLessonOf<IndexUnit>;

/** The /learn track id an in-progress run belongs to, read from its FACTS via the
 * precomputed index's fact→track map (`trackIdOfFact`) — no fact registry, no
 * dictionary. The map already folds facts onto the content model's tracks (a
 * counter fact → `numbers`, a word fact → `vocab`, …), so this reproduces the old
 * fact-subject resolver's output content-free.
 *
 * Two runs the index can't classify keep their own shortcut: an ASSEMBLY run
 * drills readable sentence facts (not the tier marker the index carries), so it is
 * the `sentence` track by mode; a Counters run is named as such. Otherwise this
 * mirrors the old priority scan: a prep session may prepend vocab prerequisite
 * facts before, say, a keigo lesson, so the first NON-vocab fact wins (the old
 * scan likewise skipped word facts), falling back to the first fact's track. */
function trackKeyForRun(run: RunInfo): string | null {
  if (run.mode === "assembly") return "sentence";
  if (/^Counters\b/i.test(run.what)) return "numbers";
  for (const fact of run.facts) {
    const t = trackIdOfFact(fact);
    if (t && t !== "vocab") return t;
  }
  const first = run.facts[0];
  if (!first) return null;
  return trackIdOfFact(first) ?? null;
}

/** The noun each track counts its position in — "Word 3–8 of 6,213". Vocab mixes
 * radicals, kanji and words on one climb, so it counts the neutral "Item". Kana is
 * split into Hiragana / Katakana at render (see kanaPositionLabel). */
const TRACK_NOUN: Record<string, string> = {
  kana: "Kana",
  vocab: "Vocab",
  numbers: "Counter",
  keigo: "Set",
  grammar: "Pattern",
  transitivity: "Pair",
  sentence: "Structure",
};

/** The editorial heading each track's card shows — the track's proper name, larger
 * and plainer than the counting noun in TRACK_NOUN. */
const TRACK_TITLE: Record<string, string> = {
  kana: "Kana",
  vocab: "Vocabulary",
  numbers: "Counting",
  keigo: "Keigo",
  grammar: "Grammar",
  transitivity: "Transitivity",
  sentence: "Sentences",
};

/** The one-line reason on each card. Deliberately a PAYOFF — why you'd want this
 * track — not a definition: the concept itself is taught by the lesson's own intro
 * card, and repeating that teaching here read as saying the same thing twice.
 * These are the whole "why" the card shows (no disclosure), so a Why with no
 * paragraphs. */
function lede(strong: string): Why {
  return { lede: { strong }, paras: [] };
}
const TRACK_WHY: Record<string, Why> = {
  kana: lede("Kana teaches you how to read and pronounce words. It’s the fastest way to get started."),
  vocab: lede("Vocabulary teaches you the glyphs and words you’ll actually read and speak."),
  numbers: lede("Counters teach you how to count anything: days, people, drinks, etc."),
  keigo: lede("Speak politely to people you don’t know well, or want to show respect."),
  grammar: lede("Turn the words you know into real sentences."),
  transitivity: lede("Say whether something happened on its own or someone did it."),
  sentence: lede("Arrange words and grammar into sentences that come out in the right order."),
};

/**
 * Where a lesson sits in its track, in ITEMS: the item positions its units cover
 * against the count of distinct items in the whole track order. Counts by first
 * appearance so a glyph split across two reading units (人 ひと, 人 じん) is one
 * item at its first slot, and a prerequisite pulled in inline still counts where
 * it sits in the order. Same immovable-denominator rule as lesson-position.ts:
 * the total is a property of the material, not the lesson-length slider.
 */
function positionFor(
  order: readonly IndexUnit[],
  lesson: LearnLesson,
): LessonPosition {
  const firstIdx = new Map<string, number>();
  let total = 0;
  for (const u of order) {
    const e = String(u.item.entry);
    if (!firstIdx.has(e)) firstIdx.set(e, total++);
  }
  const idxs = [...new Set(lesson.units.map((u) => String(u.item.entry)))]
    .map((e) => firstIdx.get(e))
    .filter((x): x is number => x !== undefined);
  // A lesson always has at least one due unit, so idxs is non-empty here.
  return { from: Math.min(...idxs) + 1, to: Math.max(...idxs) + 1, total };
}

/** Hiragana vs katakana by Unicode block. The kana track teaches all hiragana
 * then all katakana, so a lesson's script is read straight off its glyphs. */
const KATAKANA_RE = /[゠-ヿ]/;
function kanaScript(glyph: string): "Hiragana" | "Katakana" {
  return KATAKANA_RE.test(glyph) ? "Katakana" : "Hiragana";
}

/** The kana card's position label, SPLIT BY SCRIPT: "Hiragana 6–10 of 46" while in
 * hiragana, then "Katakana 1–5 of 46" once katakana opens — not one running "Kana
 * 6–10 of 214" spanning both. The position and its denominator are scoped to the
 * lesson's own script (hiragana and katakana are contiguous blocks in the order). */
function kanaPositionLabel(order: readonly IndexUnit[], lesson: LearnLesson): string {
  const script = kanaScript(String(lesson.units[0]?.item.glyph ?? ""));
  const firstIdx = new Map<string, number>();
  let total = 0;
  for (const u of order) {
    if (kanaScript(u.item.glyph) !== script) continue;
    const e = String(u.item.entry);
    if (!firstIdx.has(e)) firstIdx.set(e, total++);
  }
  const idxs = [...new Set(lesson.units.map((u) => String(u.item.entry)))]
    .map((e) => firstIdx.get(e))
    .filter((x): x is number => x !== undefined);
  return positionLabel(script, {
    from: Math.min(...idxs) + 1,
    to: Math.max(...idxs) + 1,
    total,
  });
}

/** Every fact of one script's kana in the track order — what "I already know all
 * hiragana" claims. */
function kanaScriptFacts(
  order: readonly IndexUnit[],
  script: "Hiragana" | "Katakana",
): FactId[] {
  const facts: FactId[] = [];
  for (const u of order) {
    if (kanaScript(u.item.glyph) === script) facts.push(...u.facts);
  }
  return facts;
}

/** Curriculum position of every vocab glyph — the prereq-respecting teaching order
 * (a component sits just before what it builds), NOT the frequency order the vocab
 * track schedules its reading UNITS in. */
const CURRICULUM_INDEX = new Map(CURRICULUM_GLYPHS.map((glyph, i) => [glyph, i]));

/** The vocab card's position, counted in CURRICULUM order. The vocab track is
 * ordered by spoken frequency, so a lesson pulls a due glyph plus its prerequisites
 * from all over that order — counting first-unit appearances there spread a 5-item
 * lesson across "1–459". Curriculum order keeps a lesson's items contiguous (人 口
 * 可 何 一 → a tight span), which is the position a learner actually feels. */
function vocabPositionLabel(lesson: LearnLesson): string {
  const idxs = [...new Set(lesson.units.map((u) => u.item.glyph))]
    .map((g) => CURRICULUM_INDEX.get(g))
    .filter((x): x is number => x !== undefined);
  if (idxs.length === 0) return "Vocab";
  return positionLabel("Vocab", {
    from: Math.min(...idxs) + 1,
    to: Math.max(...idxs) + 1,
    total: CURRICULUM_GLYPHS.length,
  });
}

/** The tier id a sentence-ordering lesson teaches — its single item's entry is
 * `sentence-ordering:<id>` (sentence-track.ts). */
function sentenceTierId(lesson: LearnLesson): string | null {
  const entry = lesson.units[0]?.item.entry;
  return entry ? sentenceTierIdOfEntry(entry) : null;
}

export function HomeFeed() {
  const { cfg } = useQuizConfig();
  const { startSession, runs, continueRun, discardRun } = useQuizSession();
  const { history, loaded } = useHistory();
  const writes = useHistoryWrites();

  const range = useMemo(
    () => ({ min: cfg.lessonMinCost, max: cfg.lessonMaxCost }),
    [cfg.lessonMinCost, cfg.lessonMaxCost],
  );

  // Each track's precomputed order (units are history-independent) and its live
  // next lesson, computed over the index by the content-free scheduler.
  const frontiers = useMemo(
    () =>
      LEARN_TRACKS.map((track) => {
        const order = track.units;
        const frontier =
          track.id === "sentence"
            ? nextSentenceLearnLesson(order, history)
            : nextLearnLesson(order, history, range);
        return { track, order, frontier };
      }),
    [history, range],
  );

  // The lesson runs that can pin a track's card to Continue: an in-progress
  // curriculum session (not a Library drill).
  const lessonRuns = runs.filter(
    (r) =>
      r.kind === "session" &&
      r.phase !== "complete" &&
      (r.origin ?? "lesson") === "lesson",
  );

  // Per track: the run resting in it (if any) and the lesson its card SHOULD show
  // — the run's resting lesson while a session is open, else the live frontier
  // (resumeLesson, reused verbatim from the old feed; generic over the lesson type).
  const shown = frontiers.map(({ track, order, frontier }) => {
    const run = lessonRuns.find((r) => trackKeyForRun(r) === track.id);
    const restingSentence =
      track.id === "sentence" && run
        ? sentenceLearnLessonForRun(order, run.facts)
        : null;
    const restingSentenceClaimed =
      restingSentence !== null &&
      restingSentence.units.every((unit) =>
        unit.facts.every((fact) => history.claims?.[fact] !== undefined),
      );
    const lesson =
      restingSentence && !restingSentenceClaimed
        ? restingSentence
        : restingSentenceClaimed
          ? frontier
          : resumeLesson(history, frontier, run, (h) =>
              track.id === "sentence"
                ? nextSentenceLearnLesson(track.units, h)
                : nextLearnLesson(track.units, h, range),
            );
    return { track, order, run, lesson };
  });

  // Kana is the gate: while it has a lesson (or a kana session resting), only the
  // kana card shows; once exhausted, every other track opens.
  const kana = shown.find((s) => s.track.id === "kana");
  const kanaActive = !!kana?.lesson;
  const visible = kanaActive
    ? shown.filter((s) => s.track.id === "kana" && s.lesson)
    : shown.filter((s) => s.track.id !== "kana" && s.lesson);

  // "These are in my knowledge base now" — the seen write, applied to the copy on
  // screen first and posted in the background (history-writes.ts). Errors swallowed
  // on purpose: failing to record intent must not cost the drill you asked for.
  const markSeen = (facts: FactId[]) => writes.markSeen(facts);
  // Of the facts a start marks seen, the ones NOT already seen — the marks this
  // start ADDS, handed to startSession as seededSeen so a discard rolls back
  // exactly them and never revokes an earlier lesson's unlock.
  const newlySeen = (facts: FactId[]) =>
    facts.filter((f) => history.seen?.[f] === undefined);

  const factsOfLesson = (lesson: LearnLesson): FactId[] =>
    lesson.units.flatMap((u) => u.facts);

  // Start a track's lesson — teach-then-drill (Start) or drill-now (Quiz me). The
  // lesson's facts ARE the session; no budget, the material already decided the
  // unit. Only "Quiz me" (teach false) marks seen at start; Start teaches first
  // and marks nothing yet.
  //
  // Two tracks need a non-default session:
  //   NUMBERS — a generative-rule unit drills a procedurally-generated number set
  //     (its fact is the category fact, resolved in build-item), so the session
  //     runs in "drill" mode and carries the "Counters" name the resume detector
  //     reads. The number kanji in the same lesson drill fine in that mode too.
  //   SENTENCE — the unit only carries the tier's PROGRESS marker; the ordering
  //     quiz drills the tier's readable sentence facts (sentenceLessonFacts) in
  //     "assembly" mode. Handled entirely by startSentence below.
  const startTrack = (
    trackId: string,
    lesson: LearnLesson,
    { teach = true } = {},
  ) => {
    if (trackId === "sentence") {
      void startSentence(lesson, { teach });
      return;
    }
    const facts = factsOfLesson(lesson);
    const isNumbers = trackId === "numbers";
    const seeded = teach ? [] : newlySeen(facts);
    startTransition(() => {
      if (!teach) markSeen(facts);
      startSession(
        facts,
        teach ? facts : [],
        isNumbers ? "Counters" : undefined,
        "lesson",
        seeded,
        isNumbers ? "drill" : undefined,
      );
    });
  };

  // Sentence ordering: teach the structure, then drill its readable sentences in
  // assembly mode. The tier marker rides in the drill set (retained so completion
  // advances the scheduler) and in the teach set on a Quiz-me too, where it would
  // otherwise never be claimed. The drill facts and marker come from the
  // dictionary-backed sentence helpers, DYNAMICALLY IMPORTED here so they stay off
  // the initial /learn bundle — the launch only produces fact-ids, and /session
  // loads the content anyway.
  const startSentence = async (lesson: LearnLesson, { teach = true } = {}) => {
    const tierId = sentenceTierId(lesson);
    if (!tierId) return;
    const [plan, { sentenceTierMarkerFact }, { SENTENCE_ORDERING_TIERS }] =
      await Promise.all([
        import("@/lib/sentence-ordering-plan"),
        import("@/lib/sentence-ordering-progress"),
        import("@/data/assembly"),
      ]);
    const marker = sentenceTierMarkerFact(tierId);
    const drillFacts = plan.sentenceLessonFacts(
      SENTENCE_ORDERING_TIERS.find((t) => t.id === tierId)!,
      history,
    );
    startSession(
      [...drillFacts, marker],
      teach ? drillFacts : [marker],
      `Sentence ordering · tier ${tierId}`,
      "lesson",
      undefined,
      "assembly",
    );
  };

  // "I already know these": claim the lesson (skip the drill). The card is a
  // function of history, so claiming advances it on this frame. A claim also
  // supersedes a session parked on exactly this material — close that run so its
  // Continue button doesn't outlive the body it belonged to (closeIfClaimedAway).
  const claimTrack = (trackId: string, lesson: LearnLesson, run?: RunInfo) => {
    const facts = factsOfLesson(lesson);
    writes.claim(facts);
    // A sentence run drills a wide readable-fact set but its one tier marker is
    // the card's lesson. Claiming that marker supersedes the whole resting run.
    if (
      trackId === "sentence" &&
      run &&
      facts.some((fact) => run.facts.includes(fact))
    ) {
      discardRun(run.id);
      return;
    }
    closeIfClaimedAway(run, facts);
  };

  // Close a run resting ENTIRELY on the just-claimed facts, so a claimed-away
  // session doesn't leave a Continue over an advanced card (and, via the save
  // path, pushes a clear so it can't teleport back on another device). A wider run
  // that only overlaps the claim is left running.
  const closeIfClaimedAway = (run: RunInfo | undefined, claimed: FactId[]) => {
    if (!run || !run.facts.length) return;
    const set = new Set(claimed);
    if (run.facts.every((f) => set.has(f))) discardRun(run.id);
  };

  // Every track exhausted: the content-free frontier has already applied the
  // sentence readability/grammar gate, so an empty visible set is definitive.
  const curriculumComplete = !kanaActive && visible.length === 0;

  // Until history has loaded, the frontiers are computed from EMPTY history — the
  // day-one lesson. Rendering that for a returning learner flashes the wrong card,
  // so hold the feed until the real history lands.
  if (!loaded) return null;

  return (
    <>
      {/* What "I already know this" means, said once for the whole page. */}
      <ClaimExplainer />

      {/* THE TRACK CARDS — one card per track with a lesson, laid out in a
          RESPONSIVE TWO-COLUMN GRID: one column on narrow screens, two once the
          main column is wide enough for two comfortable card widths (xl — see
          below). Every visible track (kana included, when it's the sole card the
          gate allows) flows through the SAME grid in render order, so a single
          `visible.map` keeps them ordered top-to-bottom / left-to-right.

          Two columns kick in at `xl` (viewport ≥ 1280px), NOT `lg`. The main
          column is `max-w-[1400px]` beside a flush-left sidebar, so its content is
          well under viewport width: at `lg` (1024px) two columns would each be
          ~350px and squash the 5-tile row; `xl` gives each column enough room that
          only a full 5-tile card wraps its tiles (fine — the tiles flex-wrap and
          are never shrunk). `gap-x-10 gap-y-8` supplies the separation the cards
          used to get from a top-hairline (they're passed `separated={false}`); no
          shadow anywhere, which would reintroduce scroll jank on the fixed mesh.

          Each card carries its own position header ("Item 3–8 of …"), its own
          "why", and Start / Quiz me / Continue / I-already-know, all off the one
          NextLessonPreview. */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-2">
        {visible.map(({ track, order, run, lesson }) => (
          <NextLessonPreview
            key={track.id}
            lesson={lesson!}
            separated={false}
            title={TRACK_TITLE[track.id] ?? TRACK_NOUN[track.id] ?? "Up next"}
            positionLabel={
              track.id === "kana"
                ? kanaPositionLabel(order, lesson!)
                : track.id === "vocab"
                  ? vocabPositionLabel(lesson!)
                  : positionLabel(TRACK_NOUN[track.id] ?? "Item", positionFor(order, lesson!))
            }
            why={TRACK_WHY[track.id] ?? TRACK_WHY.vocab}
            onStart={(_facts, opts) => startTrack(track.id, lesson!, opts)}
            onClaim={() => claimTrack(track.id, lesson!, run)}
            claimAll={
              track.id === "kana"
                ? (() => {
                    const script = kanaScript(String(lesson!.units[0]?.item.glyph ?? ""));
                    return {
                      label: `all ${script.toLowerCase()}`,
                      onClaim: () => {
                        const all = kanaScriptFacts(order, script);
                        writes.claim(all);
                        closeIfClaimedAway(run, all);
                      },
                    };
                  })()
                : undefined
            }
            onContinue={run ? () => continueRun(run.id) : undefined}
          />
        ))}
      </div>

      {curriculumComplete ? <CurriculumComplete /> : null}
    </>
  );
}
