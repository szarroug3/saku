"use client";

// Home — the curriculum, top to bottom: what to learn next.
//
//   1. lessons       the next lesson in each track (kana, the curriculum spine
//                    of radicals/kanji/words, counters, grammar, transitivity,
//                    keigo), each card rendered only when it has something to
//                    teach
//
// THE RULE, and every line below serves it: a card is shown only when it has
// real work to offer. A card that would teach or continue nothing is not
// rendered at all.
//
// WHAT HOME IS NOT
// ================
// Home used to also own quiz SETUP (how to drill) and SELECTION (what to
// drill), plus a Start bar. That open-ended "what do I want to drill?" builder
// now lives on the Practice page (/practice); Home is purely the curriculum's
// answer to "what should I learn next?". The two jobs were mixed on one screen
// and are now split: Practice owns drill configuration and launch, Library is
// the door for hand-picking exact items, and Home stays the low-decision
// lesson feed.
//
// There is NO generic "where you left off" card here either. A lesson left
// mid-session is resumed from that lesson's own card: it shows Continue when an
// in-progress session belongs to that TRACK, and runForTrack below says why the
// signal is the track and not the frontier's exact facts. The most recent run
// of any kind is on the Practice card, and the full list of everything in
// progress is the Current sessions page. So a lesson is always resumable where
// it makes sense, and Home does not carry a second, generic door to it.
//
// Home reads history and the curriculum settings (the lesson cost range, the
// Library's kanji order) to decide the next lesson in each track. It does not resolve
// selections, plan sessions, or start a drill of its own; the lesson cards start
// their own sessions from their own facts.

import { startTransition, useMemo } from "react";

import { CurriculumComplete } from "@/components/home/curriculum-complete";
import { ClaimExplainer } from "@/components/lesson/claim-explainer";
import { NextCounterLesson } from "@/components/lesson/next-counter-lesson";
import { NextGrammarLesson } from "@/components/lesson/next-grammar-lesson";
import { NextCurriculumLesson } from "@/components/lesson/next-curriculum-lesson";
import { NextLesson } from "@/components/lesson/next-lesson";
import { NextTransitivityLesson } from "@/components/lesson/next-transitivity-lesson";
import { NextKeigoLesson } from "@/components/lesson/next-keigo-lesson";
import { NextSentenceOrderingLesson } from "@/components/lesson/next-sentence-ordering-lesson";
import { PageTitle } from "@/components/ui";
import {
  lessonWords,
  nextCurriculumLesson,
  nextCurriculumLock,
} from "@/lib/curriculum-lesson";
import {
  GRAMMAR_PER_LESSON_DEFAULT,
  nextGrammarLesson,
} from "@/lib/grammar-lesson";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { nextCounterLesson } from "@/lib/counter-lesson";
import {
  TRANSITIVITY_PER_LESSON_DEFAULT,
  nextTransitivityLesson,
} from "@/lib/transitivity-lesson";
import { KEIGO_PER_LESSON_DEFAULT, nextKeigoLesson } from "@/lib/keigo-lesson";

import { readingsProvedBy } from "@/lib/word-unlock";
import { nextLesson } from "@/lib/lesson";
import { resumeLesson } from "@/lib/lesson-resume";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession, type RunInfo } from "@/lib/quiz-session";
import { entryOf, factInfo } from "@/lib/facts";
import { COUNTER_ENTRIES } from "@/data/counters";
import { useHistoryWrites } from "@/lib/history-writes";
import { useHistory } from "@/lib/use-history";
import { sentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import {
  nextSentenceOrderingLesson,
  sentenceLessonFacts,
} from "@/lib/sentence-ordering-plan";
import type { FactId, HistoryFile } from "@/types";
import { SENTENCE_ORDERING_TIERS } from "@/data/assembly";

// The eight track keys a run can belong to. For every track but the two vocab
// ones this IS the fact's subject string; counters and words share the `word`
// subject (a counter is vocab with a track label, see counters.ts), so they get
// their own keys and are told apart on COUNTER_ENTRIES in trackOfRun.
type TrackKey =
  | "kana"
  | "kanji"
  | "radical"
  | "word"
  | "counter"
  | "grammar"
  | "transitivity"
  | "keigo"
  | "sentence-ordering";

// Which track an in-progress run belongs to, read from its FACTS rather than
// re-derived from a cursor. A curriculum lesson is single-subject, so the first
// fact's subject names the track; factInfo is the sanctioned resolver (fact ids
// are opaque (see fact-id.ts), so this does not parse the string. Returns null
// for a run whose fact isn't in the registry, which then matches no track and
// falls through to a plain Start, the safe default.
function trackOfRun(run: RunInfo): TrackKey | null {
  if (run.mode === "assembly") return "sentence-ordering";
  // A generative NUMBER unit is a counters-track lesson whose only fact is a
  // marker pseudo-fact (no FactInfo to resolve a subject from), so it is
  // recognised by its mode. Only lesson sessions reach here (see runForTrack), so
  // this never captures a one-off Practice number-reading quiz.
  if (run.mode === "number-reading") return "counter";
  // A prep-only counter unit session teaches only prereq kanji/radicals, so it
  // carries no counter facts. Those sessions are started with an explicit track
  // label in `what`; read it here so Continue stays on the counters card.
  if (/^Counters\b/i.test(run.what)) return "counter";
  // Scan all facts: some lessons (keigo, and now counters) prepend prerequisite
  // kanji/radical facts before their own facts, so the first fact is not always
  // the track identifier. A counter is a `word` fact told apart by COUNTER_ENTRIES
  // (see counters.ts), so it is matched by entry here, ahead of the plain-word
  // fallback below that its prereq kanji would otherwise fall into.
  for (const fact of run.facts) {
    if (COUNTER_ENTRIES.has(entryOf(fact))) return "counter";
    const subject = factInfo(fact)?.subject;
    if (subject === "keigo") return "keigo";
    if (subject === "grammar") return "grammar";
    if (subject === "transitivity") return "transitivity";
    if (subject === "kana") return "kana";
  }
  // Fall back to the first fact for word / kanji / radical / counter tracks.
  const fact = run.facts[0];
  if (!fact) return null;
  const subject = factInfo(fact)?.subject;
  if (subject === undefined) return null;
  if (subject === VOCAB_SUBJECT) {
    return COUNTER_ENTRIES.has(entryOf(fact)) ? "counter" : "word";
  }
  return subject as TrackKey;
}

export function HomeFeed() {
  const { cfg } = useQuizConfig();
  const { startSession, runs, continueRun, discardRun } = useQuizSession();
  const { history, loaded } = useHistory();

  // The next lesson is a view of history, not a cursor — see next-lesson.tsx.
  // Null when there is no new material left, and the card is then not rendered
  // at all, on the same rule as the session card above it: a card offering to
  // teach you nothing is the lie that rule exists to prevent.
  const lesson = useMemo(() => nextLesson(history), [history]);

  // What comes after kana, and ONLY after: kanji's curriculum is a thousand
  // lessons deep and offering it beside あいうえお would be handing a beginner a
  // second front to fight on. `lesson === null` is the whole condition — the
  // same "no new material left" this file already trusts one line up, which
  // means the handover is a function of history like everything else here.
  // Finish or claim the last katakana group and kanji appears; nothing advances
  // a pointer, because there is no pointer.
  //
  // The lesson length is the one curriculum setting the spine reads. It is
  // config, not state, so the lesson is still a pure function of history for a
  // given setup. Change it and the whole curriculum re-cuts, which is why it is
  // a dep here.
  //
  // ONE TRACK, ONE CARD. Radicals, kanji and words are a single ordered spine
  // (curriculum-order.ts), cut into lessons by cost (curriculum-lesson.ts), so
  // this replaces what used to be a kanji card and a words card running separate
  // schedulers over the same climb. There is no radical gate and no word gate:
  // a radical rides in welded to the kanji that first needs it, and a word is
  // ordered after every kanji it is written with, so teaching the sequence in
  // order IS both gates.
  const curriculumLesson = useMemo(
    () =>
      lesson
        ? null
        : nextCurriculumLesson(history, {
            min: cfg.lessonMinCost,
            max: cfg.lessonMaxCost,
          }),
    [lesson, history, cfg.lessonMinCost, cfg.lessonMaxCost],
  );

  // Class-sensitive words can wait for their grammar introduction: adjectives
  // wait for lesson 1 and ambiguous る-ending verbs for lesson 2 (the て-form).
  // The spine skips them until their prerequisite is met, so this legacy lock
  // surface remains null while the rest of the curriculum keeps flowing.
  const curriculumLock = useMemo(
    () =>
      lesson
        ? null
        : nextCurriculumLock(history, {
            min: cfg.lessonMinCost,
            max: cfg.lessonMaxCost,
          }),
    [lesson, history, cfg.lessonMinCost, cfg.lessonMaxCost],
  );

  // The numbers-and-counters track, opened after kana like the other post-kana
  // tracks (`lesson === null`). Its phase 1 is kana-only, so it has ready forms
  // the moment it opens; its phase 2/tail forms interleave in as their number
  // kanji are learned. No lock card — a gated form is skipped, not blocked (see
  // counter-lesson.ts) — so this is a lesson or nothing, like transitivity. Pure
  // of the words track: a counter is a `word` fact but not in VOCAB, so the two
  // schedulers never see each other's material.
  const counterLesson = useMemo(
    () =>
      lesson
        ? null
        : nextCounterLesson(history, {
            min: cfg.lessonMinCost,
            max: cfg.lessonMaxCost,
          }),
    [lesson, history, cfg.lessonMinCost, cfg.lessonMaxCost],
  );

  // The grammar track opens as soon as kana is done and never depends on Words.
  // Every grammar lesson supplies the examples it needs itself.
  const grammarLesson = useMemo(
    () => (lesson ? null : nextGrammarLesson(history, GRAMMAR_PER_LESSON_DEFAULT)),
    [lesson, history],
  );

  // The transitivity track opens after kana is done and teaches verb pairs one
  // at a time, each unlocked only once BOTH of its verbs are learned vocabulary
  // (see nextTransitivityLesson). It interleaves rather than blocking: a pair
  // whose verbs aren't both met is skipped, so the card is either teaching the
  // next ready pairs or absent — no lock card. Gated on `lesson === null` like
  // every post-kana track.
  const transitivityLesson = useMemo(
    () =>
      lesson
        ? null
        : nextTransitivityLesson(history, TRANSITIVITY_PER_LESSON_DEFAULT),
    [lesson, history],
  );

  // The keigo (politeness) track, opened EARLY like grammar: a set unlocks the
  // moment the plain verb it replaces is learned vocabulary, so it starts on a
  // handful of known words rather than waiting on any later track (see
  // nextKeigoLesson). It interleaves rather than blocking — a set whose plain
  // verb is unmet is skipped — so this is a lesson or nothing. Gated on
  // `lesson === null` (kana done) like every post-kana track.
  const keigoLesson = useMemo(
    () =>
      lesson
        ? null
        : nextKeigoLesson(history, KEIGO_PER_LESSON_DEFAULT, {
            min: cfg.lessonMinCost,
            max: cfg.lessonMaxCost,
          }),
    [lesson, history, cfg.lessonMinCost, cfg.lessonMaxCost],
  );

  const sentenceOrderingLesson = useMemo(
    () => nextSentenceOrderingLesson(!lesson, history),
    [lesson, history],
  );

  // "These are in my knowledge base now" — the one seen write, in one place.
  //
  // Every route that puts material into a drill WITHOUT walking it first has to
  // go through here first, and the ordering is the point: the seen record is
  // written BEFORE the drill starts and does not wait on it, so an abandoned
  // drill still leaves the material seen rather than fresh. That is what stops
  // the card re-offering a lesson you already chose to skip, and it is what
  // makes the drill's questions legal — the scoring model reads `seen` as "the
  // app has shown you this", and a drill over facts with no seen record is the
  // app asking about material it believes it never showed. See src/lib/claims.ts
  // for why seen, claimed and a session are three different records.
  //
  // Errors are swallowed on purpose, as they were at each of the call sites this
  // replaced: failing to record the intent must not cost you the drill you asked
  // for.
  // Applied to the copy on screen first and posted in the background, so none of
  // the four handlers below waits on a network round trip to move (see
  // history-writes.ts). This is why they are no longer `async`: there is nothing
  // left in any of them to await.
  const writes = useHistoryWrites();
  const markSeen = (facts: FactId[]) => writes.markSeen(facts);

  // Of the facts a start is about to mark seen, the ones that were NOT already
  // seen — the marks this start actually ADDS. Handed to startSession as the
  // session's seededSeen, so a discard rolls back exactly what its start laid
  // down and never revokes a reading an earlier lesson had already unlocked (see
  // StudySession.seededSeen / discardRun). Read against the pre-write history in
  // this closure, which is the copy markSeen is about to mutate.
  const newlySeen = (facts: FactId[]) =>
    facts.filter((f) => history.seen?.[f] === undefined);

  // The lesson IS the session: its group, all of it new, all of it taught. It
  // does not go through the budget, because the budget's job is deciding how
  // much new material to hand out and the answer is already in your hand.
  //
  // FACTS, not the lesson's characters. This took `chars: string[]` and handed
  // them straight to startSession, which was silent both ways: FactId is a
  // branded string, so a fact array satisfies string[] with no cast, and a
  // character array satisfies nothing the fact-native runtime can drill. The
  // lesson already carries both halves — take the one the session speaks.
  //
  // `teach` is the fork the claim explainer promises: Start walks the material
  // and then drills it (teach = the facts), "Quiz me" drills it now (teach = no
  // facts, so startSession opens in the drilling phase). ONE handler with a
  // flag rather than two, because the two routes differ in exactly one thing —
  // whether the walk happens — and everything before it (which facts, what gets
  // marked seen) must not be able to drift between them.
  const startLesson = (facts: FactId[], { teach = true } = {}) => {
    // Only "Quiz me" (teach false) marks seen at start; Start (teach true) teaches
    // first and marks nothing yet, so it seeds no seen to roll back.
    const seeded = teach ? [] : newlySeen(facts);
    startTransition(() => {
      if (!teach) markSeen(facts);
      startSession(facts, teach ? facts : [], undefined, "lesson", seeded);
    });
  };

  // "Teach me here" for kana: open a session whose TEACH PHASE steps the group
  // one character at a time (session/teach-walk.tsx), then drills — the same
  // teach-then-drill shape the kanji/word/grammar cards use through Start, so
  // kana is no longer the one track taught by a bespoke inline card. `what` names
  // the run for the resume card and the HUD.
  const teachLesson = (facts: FactId[]) =>
    startSession(facts, facts, lesson?.group.label);

  // "Quiz me": the group is seen — in the knowledge base and fair game — and the
  // next thing on screen is a drill on it. Asking to be quizzed is itself the
  // statement that you've seen it, so the seen record goes down first (markSeen
  // above owns that ordering). Then straight into the drill (empty teach — the
  // user has already learned these elsewhere or in the walkthrough, so this is
  // not a teach-then-drill, it is the quiz they asked for).
  //
  // This is the ORIGINAL of the skip route the other three tracks now have. It
  // keeps its own handler rather than folding into startLesson because kana's
  // needs one thing theirs don't: `lesson.group.label` names the run ("Vowels
  // あ") for the HUD and the resume card, where a kanji or grammar lesson has no
  // name to give.
  const quizMe = (facts: FactId[]) => {
    const seeded = newlySeen(facts);
    startTransition(() => {
      markSeen(facts);
      startSession(facts, [], lesson?.group.label, "lesson", seeded);
    });
  };

  const claim = (facts: FactId[]) => {
    // The card is a function of history, so applying the claim to the history IS
    // how the next lesson advances — and applying it locally advances the card
    // on this frame. Re-reading the server is no longer part of that; it happens
    // anyway, behind the click, and agrees.
    writes.claim(facts);
  };

  // Teaching a word is also what UNLOCKS its kanji's readings, the payoff (see
  // word-unlock.ts). So the curriculum card's Start marks seen not only the
  // lesson's own facts (like kana's "Quiz me": pressing Start is the statement
  // that you've met them) but every kanji reading the lesson's WORDS prove. The
  // readings then enter the drill anchored on the word you just learned, via the
  // same seen record everything else uses.
  //
  // Both routes into the drill come through here, Start (walk, then drill) and
  // "Quiz me" (drill now), so the unlock cannot depend on which button you
  // pressed. Teaching a word unlocks its kanji's readings because you met the
  // word, not because you paged through a screen about it.
  //
  // A lesson with no word on it is the ordinary case early on, and then
  // `lessonWords` is empty and this is exactly `startLesson`. One handler covers
  // both, because a mixed card cannot know in advance which it will be.
  const startCurriculumLesson = (facts: FactId[], { teach = true } = {}) => {
    const kebs = lessonWords(curriculumLessonShown?.cards ?? []);
    const seed = [...facts, ...readingsProvedBy(kebs)];
    // Record only the marks this start ADDS as the session's seededSeen, so a
    // discard un-sees exactly them: the lesson's own facts (always fresh here)
    // plus any kanji reading its words newly prove. A discard then leaves the
    // frontier where it was before Start; completing keeps it, because the
    // committed rounds advance the frontier independently of these marks.
    const seeded = newlySeen(seed);
    startTransition(() => {
      markSeen(seed);
      // Drill the whole seeded set: the lesson's own facts plus the kanji
      // readings the taught words now prove.
      startSession(seed, teach ? facts : [], undefined, "lesson", seeded);
    });
  };

  // "I already know these": claim the lesson (skip the drill), but still unlock
  // the kanji readings its words prove. Knowing the word is what makes the
  // reading fair, however you came to know it.
  const claimCurriculumLesson = (facts: FactId[]) => {
    const readings = readingsProvedBy(lessonWords(curriculumLessonShown?.cards ?? []));
    writes.claim(facts);
    if (readings.length) markSeen(readings);
  };

  // Which in-progress run, if any, belongs to each track: the signal that lets
  // a track card offer Continue instead of only a fresh Start.
  //
  // WHY THIS IS THE TRACK AND NOT sameFactSet AGAINST THE NEXT LESSON
  // ================================================================
  // The old match asked "is a run drilling EXACTLY this card's next-lesson
  // facts?". That held only while the run and the frontier named the same set,
  // and they stop naming it the instant you start: the words card marks its
  // lesson SEEN before the teach walk (startWordLesson), and every track commits
  // its facts to history as each round closes, both of which advance the
  // next-lesson computation to the FOLLOWING set. So a lesson you had open in
  // the teaching phase, still parked on the Current sessions page as "Teaching",
  // no longer matched the frontier it came from, and its card fell back to a
  // fresh Start.
  // That was the reported bug: the session was continuable from /current but not
  // from its own track.
  //
  // The run has not moved; the frontier has. So match the run to the TRACK, not
  // to the frontier's shifting facts. This is the same "session, not finished,
  // origin lesson" signal /current groups its Curriculum lessons by (Library
  // runs live in the other group and must not hijack a curriculum card),
  // partitioned per track by trackOfRun. Continue then routes back through
  // continueRun, exactly as the /current row does.
  //
  // Matching on the track is what lights the card; it does not decide WHICH
  // lesson the card prints. That was left reading the frontier, and a frontier
  // that has advanced past the run puts the NEXT set's characters over a
  // Continue that resumes the earlier one — the card contradicting its own
  // button. resumeShown below settles that: while this run is open, the card
  // shows the lesson the run is resting in.
  const lessonRuns = runs.filter(
    (r) =>
      r.kind === "session" &&
      r.phase !== "complete" &&
      (r.origin ?? "lesson") === "lesson",
  );
  const runForTrack = (track: TrackKey) =>
    lessonRuns.find((r) => trackOfRun(r) === track);
  const lessonRun = runForTrack("kana");
  // Radicals, kanji and words are one track now, so a run that opened on any of
  // the three belongs to the curriculum card. A mixed lesson can lead with a
  // radical, a kanji or a word, and which it led with is an accident of where
  // the cut fell — it must not decide which card lights up.
  const curriculumRun = lessonRuns.find((r) => {
    const t = trackOfRun(r);
    return t === "kanji" || t === "radical" || t === "word";
  });
  const grammarRun = runForTrack("grammar");
  const transitivityRun = runForTrack("transitivity");
  const counterRun = runForTrack("counter");
  const keigoRun = runForTrack("keigo");
  const sentenceOrderingRun = runForTrack("sentence-ordering");

  // WHEN THE FRONTIER MOVES PAST A SESSION THAT IS STILL OPEN
  // ========================================================
  // runForTrack above matches a run to its track's CARD, but a card that lights
  // up with Continue still has to print the right material above the button,
  // and the frontier stops being that material the moment the session starts.
  // Starting is a write: the curriculum card marks its lesson seen before the
  // teach walk, and every track commits its facts as each round closes, so the
  // live next-lesson query moves on while the run rests where it was. On a
  // step-ahead track the card then vanishes outright; on the curriculum spine,
  // which always has a next lesson, the card stays and shows the FOLLOWING
  // set's characters over a Continue that resumes the earlier one.
  //
  // resumeLesson (lesson-resume.ts, with the whole failure mode written out)
  // settles both: while a run is open for a track, the card shows the lesson
  // that RUN is resting in, rebuilt against a history with the run's own facts
  // masked back out — the frontier as it stood when the session began. The card
  // body and the Continue button are then computed from the same run and cannot
  // disagree. It falls back to the live frontier if the rebuild names nothing,
  // so this can only change WHICH lesson a card shows, never whether there is
  // one.
  const resumeShown = <T,>(
    frontier: T | null,
    run: RunInfo | undefined,
    rebuild: (h: HistoryFile) => T | null,
  ): T | null => resumeLesson(history, frontier, run, rebuild);
  const range = { min: cfg.lessonMinCost, max: cfg.lessonMaxCost };
  const lessonShown = resumeShown(lesson, lessonRun, (h) => nextLesson(h));
  // One card for the whole spine, so it carries the resume fallback for all
  // three kinds. A resting lesson that happened to be all radicals, or all
  // words, resurfaces here for the same reason a mixed one does: it is a
  // curriculum lesson, and this rebuilds it.
  const curriculumLessonShown = resumeShown(curriculumLesson, curriculumRun, (h) =>
    nextCurriculumLesson(h, range),
  );
  const counterLessonShown = resumeShown(counterLesson, counterRun, (h) =>
    nextCounterLesson(h, range),
  );
  const grammarLessonShown = resumeShown(grammarLesson, grammarRun, (h) =>
    nextGrammarLesson(h, GRAMMAR_PER_LESSON_DEFAULT),
  );
  const transitivityLessonShown = resumeShown(transitivityLesson, transitivityRun, (h) =>
    nextTransitivityLesson(h, TRANSITIVITY_PER_LESSON_DEFAULT),
  );
  const keigoLessonShown = resumeShown(keigoLesson, keigoRun, (h) =>
    nextKeigoLesson(h, KEIGO_PER_LESSON_DEFAULT, range),
  );
  const sentenceOrderingLessonShown = sentenceOrderingLesson ??
    (sentenceOrderingRun
      ? (() => {
          // Resume: find which tier the active run belongs to by matching its
          // first fact against each tier's fact pool, then reconstruct the card.
          for (let i = 0; i < SENTENCE_ORDERING_TIERS.length; i++) {
            const tier = SENTENCE_ORDERING_TIERS[i];
            const facts = sentenceLessonFacts(tier, history);
            if (!facts.includes(sentenceOrderingRun.facts[0])) continue;
            return {
              facts: sentenceOrderingRun.facts,
              lessonNumber: i + 1,
              totalLessons: SENTENCE_ORDERING_TIERS.length,
              tierId: tier.id,
              tierLabel: tier.label,
            };
          }
          // Fallback: can't identify tier, show run with position 1.
          return {
            facts: sentenceOrderingRun.facts,
            lessonNumber: 1,
            totalLessons: SENTENCE_ORDERING_TIERS.length,
            tierId: "unknown",
            tierLabel: "Sentence ordering",
          };
        })()
      : null);

  // "I already know these" is a deliberate statement that the resting material
  // is done, so it supersedes any session parked on exactly that material: close
  // that run, not just advance the card. resumeLesson already releases the card
  // BODY on a claim (lesson-resume.ts), but the Continue button is driven by the
  // run's existence — leaving the run open would print an advanced lesson over a
  // Continue that resumes the claimed-away one, the very body/button disagreement
  // the resume machinery exists to prevent. Closing it drops the button AND, via
  // the ordinary save path, updates the synced in-progress blob — a run that
  // empties pushes a clear, the same completed-clears rule #11 uses, so the
  // claimed-away session cannot teleport back onto another device.
  //
  // Guarded to a run resting ENTIRELY on the claimed facts: a wider run (kana's
  // "all so far") that only overlaps the claimed group is left running, and its
  // card keeps pinning as before. This is the same all-claimed test resumeLesson
  // releases on, so the card and the run agree about when the pin lets go.
  const closeIfClaimedAway = (run: RunInfo | undefined, claimed: FactId[]) => {
    if (!run || !run.facts.length) return;
    const set = new Set(claimed);
    if (run.facts.every((f) => set.has(f))) discardRun(run.id);
  };

  // The curriculum is finished only when EVERY track's card would render
  // nothing — the exact negation of the render conditions below, so this is
  // true precisely when the lesson feed would otherwise be empty. The grammar
  // track renders on a lock (not just a lesson) once started, so a
  // locked-but-started track still counts as unfinished here. Transitivity has
  // no lock card (an unready pair is skipped), so it counts as unfinished
  // exactly while it still has a ready lesson to teach. The spine has no lock at
  // all now: a word waits for its kanji by being ORDERED after them, so there is
  // never a next lesson the learner is blocked from taking.
  // The `...Shown` forms, not the raw frontier: a track resting inside an open
  // session still has a card (resumeLesson rebuilds it), so the feed is not
  // empty and the curriculum is not "complete" until that session is finished
  // or discarded.
  const curriculumComplete =
    !lessonShown &&
    !curriculumLessonShown &&
    // A spine held at 知る behind the て-form is NOT complete — it has a lock
    // card, and the learner is one grammar lesson from continuing.
    !curriculumLock &&
    !grammarLessonShown &&
    !transitivityLessonShown &&
    !counterLessonShown &&
    !keigoLessonShown &&
    !sentenceOrderingLessonShown;

  // Until history has loaded, the lessons above are computed from an EMPTY
  // history — which is the day-one curriculum (Vowels あいうえお). Rendering that
  // for the split second before the fetch lands flashes the wrong lesson at a
  // returning learner. Hold the feed until the real history is in; the title
  // still prints, so the page doesn't collapse to nothing.
  if (!loaded) return <PageTitle title="Saku" />;

  return (
    <>
      <PageTitle title="Saku" />

      {/* What "I already know this" means, said once for the whole page rather
          than under each lesson card in that card's own words. The rule is the
          same on kana, kanji, words and grammar, so it is stated generally, at
          the top, and dismissed for good on the first "Got it". */}
      <ClaimExplainer />

      {/* THE LESSON / TRACK CARDS — two columns on wide screens, one on narrow.
          ONLY the track cards belong in this grid: the page-spanning banners stay
          full-width in their own place — the claim explainer above it, and the
          "curriculum complete" note below it. Column-gap only (no row-gap): each
          Card keeps its own mb-3.5, so a single column reads exactly as before and
          the two columns simply sit side by side once there is room. items-start
          keeps a short card from stretching to its taller neighbour's height. */}
      <div className="grid grid-cols-1 items-start gap-x-3.5 lg:grid-cols-2">
      {lessonShown ? (
        <NextLesson
          lesson={lessonShown}
          onTeach={teachLesson}
          onQuizMe={quizMe}
          onClaim={(facts) => {
            claim(facts);
            closeIfClaimedAway(lessonRun, facts);
          }}
          inSession={!!lessonRun}
          onContinue={() => lessonRun && continueRun(lessonRun.id)}
        />
      ) : null}

      {/* The curriculum spine's next lesson: its facts, all new, all taught,
          taken by the same onStart the kana card takes. ONE card for radicals, kanji and
          words, because they are one ordered climb (curriculum-order.ts). It
          carries the resume fallback for all three, so a resting lesson that
          happened to be all radicals, or all words, still resurfaces here.
          Start and "Quiz me" both go through startCurriculumLesson, which also
          unlocks the kanji readings the lesson's words prove. */}
      {curriculumLessonShown || curriculumLock ? (
        <NextCurriculumLesson
          lesson={curriculumLessonShown}
          // Show the lock only when there is no lesson to teach: an in-progress
          // session rebuilt by resumeLesson always shows over a lock, so the
          // learner finishes the lesson they had open before the wall appears.
          lock={curriculumLessonShown ? null : curriculumLock}
          onStart={startCurriculumLesson}
          onClaim={(facts) => {
            claimCurriculumLesson(facts);
            closeIfClaimedAway(curriculumRun, facts);
          }}
          inSession={!!curriculumRun}
          onContinue={() => curriculumRun && continueRun(curriculumRun.id)}
        />
      ) : null}

      {/* The numbers-and-counters track's next lesson, below the spine. A
          counter is a word, and a learner reaches for it alongside vocabulary.
          Its facts ARE the session, taught teach-then-drill through the same
          generic handlers the grammar card uses: a counter needs no word-unlock
          (it proves no kanji reading), so it wants startLesson, not the spine's
          startCurriculumLesson. No lock card — a form gated on a number kanji is
          skipped, so this is present only when there are ready counters to
          teach. */}
      {counterLessonShown ? (
        <NextCounterLesson
          lesson={counterLessonShown}
          // A generative NUMBER unit launches its number-reading round: the same
          // teach-then-drill handlers, but startSession is handed the unit's mode
          // and range config so the drill leg runs the round rather than a form
          // drill (see counter-lesson.ts / quiz-session.tsx). An ordinary form
          // lesson falls through to the shared startLesson.
          onStart={(facts, { teach = true } = {}) => {
            const unit = counterLessonShown.numberUnit;
            if (!unit) {
              startLesson(facts, { teach });
              return;
            }
            if (unit.prepOnly) {
              // Prep-only slices teach/drill prereq facts only. The generated
              // number-reading round belongs to the marker lesson itself.
              const seeded = teach ? [] : newlySeen(facts);
              startTransition(() => {
                if (!teach) markSeen(facts);
                startSession(facts, teach ? facts : [], "Counters", "lesson", seeded);
              });
              return;
            }
            // A NUMBER unit advances on COMPLETION, not on start: claiming its
            // marker at start let a started-then-discarded session skip the unit
            // entirely. Start teaches the rule and runs the number-reading round;
            // finishSession then claims `session.teach` (quiz-session.tsx), so pass
            // the marker there even for "Quiz me" (teach=false), where `teach`
            // would otherwise be empty and never claim it.
            const teachFacts = unit.prepOnly
              ? facts
              : teach
                ? facts
                : [unit.marker];
            startTransition(() => {
              startSession(
                facts,
                teachFacts,
                undefined,
                "lesson",
                [],
                unit.mode,
                unit.config,
              );
            });
          }}
          onClaim={(facts) => {
            claim(facts);
            closeIfClaimedAway(counterRun, facts);
          }}
          inSession={!!counterRun}
          onContinue={() => counterRun && continueRun(counterRun.id)}
        />
      ) : null}

      {/* The grammar track's next lesson — opened once kana is done and never
          gated by vocabulary. Its own pages carry every example it needs. */}
      {grammarLessonShown ? (
        <NextGrammarLesson
          lesson={grammarLessonShown}
          onStart={startLesson}
          onClaim={(facts) => {
            claim(facts);
            closeIfClaimedAway(grammarRun, facts);
          }}
          inSession={!!grammarRun}
          onContinue={() => grammarRun && continueRun(grammarRun.id)}
        />
      ) : null}

      {/* The transitivity track's next lesson — the fifth card, opened once kana
          is done and a pair's two verbs are both learned. Each pair is taught
          teach-then-drill (its facts ARE the session, like the others). No lock
          card: an unready pair is skipped rather than blocking, so this is
          present only when there are ready pairs to teach. */}
      {transitivityLessonShown ? (
        <NextTransitivityLesson
          lesson={transitivityLessonShown}
          onStart={startLesson}
          onClaim={(facts) => {
            claim(facts);
            closeIfClaimedAway(transitivityRun, facts);
          }}
          inSession={!!transitivityRun}
          onContinue={() => transitivityRun && continueRun(transitivityRun.id)}
        />
      ) : null}

      {/* The keigo track's next lesson — opened early, once kana is done and the
          plain verb behind a set is learned. Each set is taught teach-then-drill
          (its facts ARE the session, like the others). No lock card: an unready
          set is skipped rather than blocking, so this is present only when there
          are ready sets to teach. */}
      {keigoLessonShown ? (
        <NextKeigoLesson
          lesson={keigoLessonShown}
          onStart={startLesson}
          onClaim={(facts) => {
            claim(facts);
            closeIfClaimedAway(keigoRun, facts);
          }}
          inSession={!!keigoRun}
          onContinue={() => keigoRun && continueRun(keigoRun.id)}
        />
      ) : null}

      {sentenceOrderingLessonShown ? (
        <NextSentenceOrderingLesson
          lesson={sentenceOrderingLessonShown}
          onStart={(facts) => {
            const marker = sentenceTierMarkerFact(
              sentenceOrderingLessonShown.tierId,
            );
            startSession(
              [...facts, marker],
              facts,
              `Sentence ordering · tier ${sentenceOrderingLessonShown.tierId}`,
              "lesson",
              undefined,
              "assembly",
            );
          }}
          onQuizMe={(facts) => {
            const marker = sentenceTierMarkerFact(
              sentenceOrderingLessonShown.tierId,
            );
            // “Quiz me” skips the teaching walk, not the lesson session. Keep
            // the same three-round spaced-repetition loop every other lesson
            // uses; only `teach` is empty because the learner asked to go
            // straight to the questions.
            startSession(
              [...facts, marker],
              [],
              `Sentence ordering · tier ${sentenceOrderingLessonShown.tierId}`,
              "lesson",
              undefined,
              "assembly",
            );
          }}
          onClaim={(facts) => {
            const completed = [
              ...facts,
              sentenceTierMarkerFact(sentenceOrderingLessonShown.tierId),
            ];
            claim(completed);
            closeIfClaimedAway(sentenceOrderingRun, completed);
          }}
          inSession={!!sentenceOrderingRun}
          onContinue={() => sentenceOrderingRun && continueRun(sentenceOrderingRun.id)}
        />
      ) : null}
      </div>

      {/* Every track is exhausted: the lesson feed above rendered nothing, so
          Home says so on purpose rather than leaving a title over blank space,
          and points at the two jobs that outlast new material. */}
      {curriculumComplete ? <CurriculumComplete /> : null}
    </>
  );
}
