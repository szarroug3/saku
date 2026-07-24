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

import { useMemo } from "react";

import { CurriculumComplete } from "@/components/home/curriculum-complete";
import { ClaimExplainer } from "@/components/lesson/claim-explainer";
import { NextCounterLesson } from "@/components/lesson/next-counter-lesson";
import { NextGrammarLesson } from "@/components/lesson/next-grammar-lesson";
import { NextCurriculumLesson } from "@/components/lesson/next-curriculum-lesson";
import { NextLesson } from "@/components/lesson/next-lesson";
import { NextTransitivityLesson } from "@/components/lesson/next-transitivity-lesson";
import { NextKeigoLesson } from "@/components/lesson/next-keigo-lesson";
import { PageTitle } from "@/components/ui";
import { lessonWords, nextCurriculumLesson } from "@/lib/curriculum-lesson";
import {
  GRAMMAR_PER_LESSON_DEFAULT,
  hasStartedGrammarTrack,
  nextGrammarLesson,
  nextGrammarLock,
} from "@/lib/grammar-lesson";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { COUNTERS_PER_LESSON_DEFAULT, nextCounterLesson } from "@/lib/counter-lesson";
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
import { postClaim, postSeen } from "@/lib/progress-fetch";
import { useHistory } from "@/lib/use-history";
import type { FactId, HistoryFile } from "@/types";

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
  | "keigo";

// Which track an in-progress run belongs to, read from its FACTS rather than
// re-derived from a cursor. A curriculum lesson is single-subject, so the first
// fact's subject names the track; factInfo is the sanctioned resolver (fact ids
// are opaque (see fact-id.ts), so this does not parse the string. Returns null
// for a run whose fact isn't in the registry, which then matches no track and
// falls through to a plain Start, the safe default.
function trackOfRun(run: RunInfo): TrackKey | null {
  const fact = run.facts[0];
  if (!fact) return null;
  const subject = factInfo(fact)?.subject;
  if (subject === undefined) return null;
  if (subject === VOCAB_SUBJECT) {
    // The entry set is the only thing that separates the two vocab tracks: both
    // mint `word:…` facts, and a counter run must light up the counters card,
    // not the words card, and vice versa.
    return COUNTER_ENTRIES.has(entryOf(fact)) ? "counter" : "word";
  }
  // kana · kanji · radical · grammar · transitivity · keigo all key on their
  // own subject, which is exactly the track key.
  return subject as TrackKey;
}

export function HomeFeed() {
  const { cfg } = useQuizConfig();
  const { startSession, runs, continueRun } = useQuizSession();
  const { history, loaded, refresh } = useHistory();

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

  // The numbers-and-counters track, opened after kana like the other post-kana
  // tracks (`lesson === null`). Its phase 1 is kana-only, so it has ready forms
  // the moment it opens; its phase 2/tail forms interleave in as their number
  // kanji are learned. No lock card — a gated form is skipped, not blocked (see
  // counter-lesson.ts) — so this is a lesson or nothing, like transitivity. Pure
  // of the words track: a counter is a `word` fact but not in VOCAB, so the two
  // schedulers never see each other's material.
  const counterLesson = useMemo(
    () => (lesson ? null : nextCounterLesson(history, COUNTERS_PER_LESSON_DEFAULT)),
    [lesson, history],
  );

  // The grammar track opens after kana is done, and each grammar lesson waits
  // on a word of the type its patterns attach to: 〜てから needs a learned verb,
  // 〜ので a な-adjective (see nextGrammarLesson). So the track stays hidden until
  // kana is done AND the first patterns are teachable; once opened, a later
  // lesson whose word type the learner lacks shows a locked card rather than
  // vanishing — the words track's lock model, for grammar.
  const grammarLesson = useMemo(
    () => (lesson ? null : nextGrammarLesson(history, GRAMMAR_PER_LESSON_DEFAULT)),
    [lesson, history],
  );
  const grammarLock = useMemo(
    () => (lesson ? null : nextGrammarLock(history, GRAMMAR_PER_LESSON_DEFAULT)),
    [lesson, history],
  );
  const grammarTrackStarted = useMemo(
    () => hasStartedGrammarTrack(history),
    [history],
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
    () => (lesson ? null : nextKeigoLesson(history, KEIGO_PER_LESSON_DEFAULT)),
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
  const markSeen = (facts: FactId[]) => postSeen(facts);

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
  const startLesson = async (facts: FactId[], { teach = true } = {}) => {
    if (!teach) await markSeen(facts);
    startSession(facts, teach ? facts : []);
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
  const quizMe = async (facts: FactId[]) => {
    await markSeen(facts);
    startSession(facts, [], lesson?.group.label);
  };

  const claim = async (facts: FactId[]) => {
    await postClaim(facts, true);
    // The card is a function of history, so re-reading history IS how the next
    // lesson advances. Nothing tells it which group to show next.
    await refresh();
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
  const startCurriculumLesson = async (facts: FactId[], { teach = true } = {}) => {
    const kebs = lessonWords(curriculumLessonShown?.cards ?? []);
    await markSeen([...facts, ...readingsProvedBy(kebs)]);
    startSession(facts, teach ? facts : []);
  };

  // "I already know these": claim the lesson (skip the drill), but still unlock
  // the kanji readings its words prove. Knowing the word is what makes the
  // reading fair, however you came to know it.
  const claimCurriculumLesson = async (facts: FactId[]) => {
    const readings = readingsProvedBy(lessonWords(curriculumLessonShown?.cards ?? []));
    await postClaim(facts, true);
    if (readings.length) await markSeen(readings);
    await refresh();
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
    nextCounterLesson(h, COUNTERS_PER_LESSON_DEFAULT),
  );
  const grammarLessonShown = resumeShown(grammarLesson, grammarRun, (h) =>
    nextGrammarLesson(h, GRAMMAR_PER_LESSON_DEFAULT),
  );
  const transitivityLessonShown = resumeShown(transitivityLesson, transitivityRun, (h) =>
    nextTransitivityLesson(h, TRANSITIVITY_PER_LESSON_DEFAULT),
  );
  const keigoLessonShown = resumeShown(keigoLesson, keigoRun, (h) =>
    nextKeigoLesson(h, KEIGO_PER_LESSON_DEFAULT),
  );

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
    !grammarLessonShown &&
    !(grammarLock && grammarTrackStarted) &&
    !transitivityLessonShown &&
    !counterLessonShown &&
    !keigoLessonShown;

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

      {lessonShown ? (
        <NextLesson
          lesson={lessonShown}
          onTeach={teachLesson}
          onQuizMe={quizMe}
          onClaim={claim}
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
      {curriculumLessonShown ? (
        <NextCurriculumLesson
          lesson={curriculumLessonShown}
          onStart={startCurriculumLesson}
          onClaim={claimCurriculumLesson}
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
          onStart={startLesson}
          onClaim={claim}
          inSession={!!counterRun}
          onContinue={() => counterRun && continueRun(counterRun.id)}
        />
      ) : null}

      {/* The grammar track's next lesson — the fourth card, opened once kana is
          done. A pattern is taught teach-then-drill (its facts ARE the session,
          like kanji's). When the next patterns need a word type the learner
          hasn't met, the card locks (naming the type) instead of disappearing,
          but only after the track has opened — like the words track. */}
      {grammarLessonShown || (grammarLock && grammarTrackStarted) ? (
        <NextGrammarLesson
          lesson={grammarLessonShown}
          lock={grammarTrackStarted ? grammarLock : null}
          onStart={startLesson}
          onClaim={claim}
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
          onClaim={claim}
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
          onClaim={claim}
          inSession={!!keigoRun}
          onContinue={() => keigoRun && continueRun(keigoRun.id)}
        />
      ) : null}

      {/* Every track is exhausted: the lesson feed above rendered nothing, so
          Home says so on purpose rather than leaving a title over blank space,
          and points at the two jobs that outlast new material. */}
      {curriculumComplete ? <CurriculumComplete /> : null}
    </>
  );
}
