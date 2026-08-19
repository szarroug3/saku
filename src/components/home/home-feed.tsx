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

import { startTransition, useMemo, useState } from "react";

import { CurriculumComplete } from "@/components/home/curriculum-complete";
import { sentenceSessionTeach } from "@/components/home/home-feed-helpers";
import { SrsIntro } from "@/components/lesson/srs-intro";
import { NextLessonPreview } from "@/components/learn/next-lesson-preview";
import { TrackIntroCard } from "@/components/learn/track-intro-card";

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
  startedLearnTracks,
  trackIdOfFact,
} from "@/lib/content/learn-index";
import type { IndexUnit } from "@/lib/content/learn-index-types";
import type { UnitLessonOf } from "@/lib/content/unit-scheduler-core";
import { resumeLesson } from "@/lib/lesson-resume";
import { lessonSpan, trackCompletion } from "@/lib/content/track-completion";
import { positionLabel } from "@/lib/lesson-position";

import type { Why } from "@/data/why";
import { useHistoryWrites } from "@/lib/history-writes";
import { useHistory } from "@/lib/use-history";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type RunInfo } from "@/lib/quiz-session";
import type { FactId, HistoryFile } from "@/types";

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
export function trackKeyForRun(run: RunInfo): string | null {
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

/** Each card's counting noun — "Hiragana 5 of 46", "Set 2 of 19". Kana is split
 * into Hiragana / Katakana at render (see kanaPositionLabel); the rest read
 * straight off this map and go through trackPositionLabel. */
export const TRACK_NOUN: Record<string, string> = {
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
export const TRACK_TITLE: Record<string, string> = {
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
/**
 * SAK-28 "track intro" card 0. Sam's approved copy (sign-off 2026-08-19), used
 * VERBATIM. Shown once, in place of a track's NextLessonPreview, for as long as
 * `startedLearnTracks` (src/lib/content/learn-index.ts) says the track is
 * untouched. See TrackIntroCard for the gate mechanism and how it differs from
 * src/data/track-intros.ts's TRACK_INTROS (the longer in-lesson explainer).
 *
 * Keyed by the SAME ids TRACK_TITLE/TRACK_WHY use above (kana/vocab/numbers/
 * keigo/grammar), not track-open.ts's older per-role TrackId; see
 * startedLearnTracks's own comment for why.
 *
 * TRANSITIVITY AND SENTENCE ARE DELIBERATELY ABSENT. Sam's approved copy in the
 * ticket names all seven tracks, including these two, but neither behaves like
 * a track a learner "starts": both open automatically once their own
 * prerequisites are met (transitivity already gets an inline intro card the
 * moment its first pair is taught, TRANSITIVITY_INTRO, gated in
 * lesson-steps.ts; sentence's card names the specific tier it opens, e.g.
 * "Simple sentences", which a generic "why this track" teaser would obscure).
 * Card 0 for either would also collide with e2e specs that assert those cards'
 * OWN content the instant they're admitted (see e2e/sentence-gates.spec.ts).
 * Flagged in the SAK-28 tracking comment for a human call rather than guessed
 * silently; the copy is ready to wire in the moment that call is made.
 */
const TRACK_INTRO_COPY: Record<string, string> = {
  kana: "Kana comes first because Japanese isn't written with the letters you already know. Learning it is what unlocks everything else, so there's no reason to wait.",
  vocab:
    "This is the main track. Kanji and words keep unlocking as you go, so there's no reason to wait.",
  grammar:
    "Start once single words feel limiting, when you want to say 'I ate' or 'please eat,' not just 'eat.'",
  numbers:
    "Start anytime. You'll want these the first time you order two of something or count people.",
  keigo:
    "Start once plain verbs feel comfortable. This is the polite, formal version of what you already know.",
};

const TRACK_WHY: Record<string, Why> = {
  kana: lede(
    "Kana teaches you how to read and pronounce words. It’s the fastest way to get started.",
  ),
  vocab: lede(
    "Vocabulary teaches you the glyphs and words you’ll actually read and speak.",
  ),
  numbers: lede(
    "Counters teach you how to count anything: days, people, drinks, etc.",
  ),
  keigo: lede(
    "Speak politely to people you don’t know well, or want to show respect.",
  ),
  grammar: lede("Turn the words you know into real sentences."),
  transitivity: lede(
    "Say whether something happened on its own or someone did it.",
  ),
  sentence: lede(
    "Arrange words and grammar into sentences that come out in the right order.",
  ),
};

/** Hiragana vs katakana by Unicode block. The kana track teaches all hiragana
 * then all katakana, so a lesson's script is read straight off its glyphs. */
const KATAKANA_RE = /[゠-ヿ]/;
function kanaScript(glyph: string): "Hiragana" | "Katakana" {
  return KATAKANA_RE.test(glyph) ? "Katakana" : "Hiragana";
}

/** A track's "N of M" line for THIS LESSON: the TIGHT sequential span
 * (`lessonSpan`, track-completion.ts) — `known + 1` through `known + (items
 * this lesson teaches)`, off `trackCompletion`'s own safe running `known`
 * count just below. This is a deliberate, informed choice over the wider but
 * unconditionally-safe static-order-rank span this briefly computed instead
 * (`lessonSpanInTrack`, since removed) — see `lessonSpan`'s own comment in
 * track-completion.ts for exactly what that trade gives up and why it was
 * made anyway (SAK-13, decided). `total` is unchanged from before — still the
 * track's own frozen distinct-item count, `trackCompletion`'s `total`. */
function trackPositionLabel(
  noun: string,
  units: readonly IndexUnit[],
  lesson: LearnLesson,
  history: HistoryFile,
): string {
  const { known, total } = trackCompletion(units, history);
  const span = lessonSpan(known, lesson.units);
  return positionLabel(noun, { ...span, total });
}

/** The kana card's label, SPLIT BY SCRIPT: "Hiragana 1–6 of 46" while in
 * hiragana, then "Katakana 1–6 of 46" once katakana opens — not a running "Kana"
 * spanning both (see trackPositionLabel). Kana has no prerequisite structure
 * (see build-item.ts's `directPrereqs`), so its lessons walk their script's
 * slice of `order` strictly front-to-back and the sequential span is not just
 * tight but exactly correct in normal use; its total is exactly its script's
 * own item count, counted off the WHOLE track order — never a live recount of
 * what's left. */
function kanaPositionLabel(
  lesson: LearnLesson,
  order: readonly IndexUnit[],
  history: HistoryFile,
): string {
  const script = kanaScript(String(lesson.units[0]?.item.glyph ?? ""));
  const scriptUnits = order.filter((u) => kanaScript(u.item.glyph) === script);
  return trackPositionLabel(script, scriptUnits, lesson, history);
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

/** The vocab card's label: the TIGHT sequential span (see trackPositionLabel /
 * lessonSpan) — e.g. "Vocab 11–16 of 14,084" for a lesson that teaches 6 words
 * with 10 already known — not the wide static-order-rank span this briefly
 * printed instead.
 *
 * THE CAVEAT THIS RESURRECTS, KEPT BECAUSE IT STILL MATTERS: the vocab track
 * schedules by SPOKEN FREQUENCY, not curriculum (Built-from) order, so a
 * lesson's due word can need a kanji-component prerequisite that sits FAR AWAY
 * in that SAME frequency-ranked `order` — two items can sit next to each other
 * in frequency and thousands of positions apart in the curriculum. The
 * static-order-rank span this used to print (`lessonSpanInTrack`, since
 * removed — see track-completion.ts) reported that gap honestly and
 * unconditionally-safely: "11–3,301 of 14,084" for a 6-item lesson, wide but
 * never wrong under an out-of-order Library claim. Shipped, seen live on
 * exactly this shape, and rejected: a learner cannot use "11–3,301" as a
 * position, however truthfully it was computed. `lessonSpan`'s tight "11–16"
 * is the number that was chosen instead, on purpose — see `lessonSpan`'s own
 * comment in track-completion.ts for precisely what this gives up (a static
 * out-of-order claim elsewhere in vocab can, in theory, leave this span
 * describing material other than what is literally on the card again) to get
 * a number a learner can actually read. */
function vocabPositionLabel(
  lesson: LearnLesson,
  order: readonly IndexUnit[],
  history: HistoryFile,
): string {
  return trackPositionLabel("Vocab", order, lesson, history);
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

  // The SAK-28 card-0 gate: every /learn track the learner has already touched.
  // A track absent from this set is opening right now, and gets the one-time
  // intro card in place of its NextLessonPreview below. `exclude` is empty,
  // since this is asked before any lesson of THIS frame has started, so there is no
  // just-taught teach set to exclude yet (see startedLearnTracks's own comment).
  const openedTracks = useMemo(
    () => startedLearnTracks(history, new Set<FactId>()),
    [history],
  );

  // "Start track" on the card-0 teaser must NOT launch a lesson (Sam, Changes
  // Requested on SAK-28's first pass): it only reveals the track's normal
  // NextLessonPreview, the same card any already-started track shows, so the
  // learner still makes the real "start a lesson" decision from there (Start /
  // Quiz me / I already know). This is deliberately NOT history-backed: it is a
  // per-page-load dismissal, not the "started" fact. `openedTracks` above is
  // the one gate that is allowed to persist; it flips once a real lesson/quiz
  // interaction lands in history. Conflating the two would make dismissing the
  // teaser (without ever starting a lesson) count as having started the track.
  const [dismissedIntros, setDismissedIntros] = useState<Set<string>>(
    new Set(),
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
  // assembly mode. The tier marker rides in both the full facts pool and the teach
  // set on a real Start (teach: true), so it is part of the end-of-session claim
  // target (sessionKnownClaimTarget reads teach when non-empty) and the tier can
  // actually be marked known. On a Quiz-me the marker must NOT ride in the teach
  // set — a non-empty teach set always opens the lesson (initialSessionPhase),
  // which is exactly SAK-85 (Quiz-me opening the teach screen). So on Quiz-me the
  // marker is recorded the same way startTrack's own Quiz-me branch records its
  // facts: markSeen immediately, with only the newly-seen part handed to
  // startSession as seededSeen so a discard rolls back exactly what this start
  // added. The drill facts and marker come from the dictionary-backed sentence
  // helpers, DYNAMICALLY IMPORTED here so they stay off the initial /learn bundle —
  // the launch only produces fact-ids, and /session loads the content anyway.
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
    const seeded = teach ? [] : newlySeen([marker]);
    if (!teach) markSeen([marker]);
    startSession(
      [...drillFacts, marker],
      sentenceSessionTeach(teach, drillFacts, marker),
      `Sentence ordering · tier ${tierId}`,
      "lesson",
      seeded,
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
      {/* What SRS is and how the 3-round loop works, said once for the whole
          app. See src/components/lesson/srs-intro.tsx. */}
      <SrsIntro />

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
        {visible.map(({ track, order, run, lesson }) => {
          // SAK-28 card 0: a track absent from openedTracks is opening right
          // now, and gets the one-time intro card in this slot INSTEAD of
          // NextLessonPreview (same slot, same grid, so the two must never
          // both render for one track). Falls through to the ordinary card for
          // any track with no approved copy yet (transitivity, sentence; see
          // TRACK_INTRO_COPY's own comment for why), or once its "Start track"
          // button has been pressed on this page load (dismissedIntros above).
          const introCopy = TRACK_INTRO_COPY[track.id];
          if (
            introCopy &&
            !openedTracks.has(track.id) &&
            !dismissedIntros.has(track.id)
          ) {
            return (
              <TrackIntroCard
                key={track.id}
                title={
                  TRACK_TITLE[track.id] ?? TRACK_NOUN[track.id] ?? "Up next"
                }
                description={introCopy}
                onStart={() =>
                  setDismissedIntros(
                    (prev) => new Set(prev).add(track.id),
                  )
                }
              />
            );
          }
          return (
            <NextLessonPreview
              key={track.id}
              lesson={lesson!}
              separated={false}
              title={TRACK_TITLE[track.id] ?? TRACK_NOUN[track.id] ?? "Up next"}
              positionLabel={
                track.id === "kana"
                  ? kanaPositionLabel(lesson!, order, history)
                  : track.id === "vocab"
                    ? vocabPositionLabel(lesson!, order, history)
                    : trackPositionLabel(
                        TRACK_NOUN[track.id] ?? "Item",
                        order,
                        lesson!,
                        history,
                      )
              }
              why={TRACK_WHY[track.id] ?? TRACK_WHY.vocab}
              onStart={(_facts, opts) => startTrack(track.id, lesson!, opts)}
              onClaim={() => claimTrack(track.id, lesson!, run)}
              claimAll={
                track.id === "kana"
                  ? (() => {
                      const script = kanaScript(
                        String(lesson!.units[0]?.item.glyph ?? ""),
                      );
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
          );
        })}
      </div>

      {curriculumComplete ? <CurriculumComplete /> : null}
    </>
  );
}
