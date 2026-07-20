"use client";

// Home — the curriculum, top to bottom: what to learn next.
//
//   1. lessons       the next lesson in each track (kana, radicals, kanji,
//                    words, grammar), each card rendered only when it has
//                    something to teach
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
// mid-session is resumed from that lesson's own card (it shows Continue when a
// run in progress matches its facts); the most recent run of any kind is on the
// Practice card, and the full list of everything in progress is the Current
// sessions page. So a lesson is always resumable where it makes sense, and Home
// does not carry a second, generic door to it.
//
// Home reads history and the curriculum settings (kanji order, lesson cost,
// words per lesson) to decide the next lesson in each track. It does not resolve
// selections, plan sessions, or start a drill of its own; the lesson cards start
// their own sessions from their own facts.

import { useMemo } from "react";

import { CurriculumComplete } from "@/components/home/curriculum-complete";
import { ClaimExplainer } from "@/components/lesson/claim-explainer";
import { NextGrammarLesson } from "@/components/lesson/next-grammar-lesson";
import { NextKanjiLesson } from "@/components/lesson/next-kanji-lesson";
import { NextLesson } from "@/components/lesson/next-lesson";
import { NextRadicalLesson } from "@/components/lesson/next-radical-lesson";
import { NextWordLesson } from "@/components/lesson/next-word-lesson";
import { PageTitle } from "@/components/ui";
import { kanjiTeachOrder } from "@/data/kanji";
import { nextKanjiLesson } from "@/lib/kanji-lesson";
import {
  GRAMMAR_PER_LESSON_DEFAULT,
  hasStartedGrammarTrack,
  nextGrammarLesson,
  nextGrammarLock,
} from "@/lib/grammar-lesson";
import {
  RADICALS_PER_LESSON_DEFAULT,
  nextRadicalLesson,
} from "@/lib/radical-lesson";
import { hasStartedWordTrack, nextWordLesson, nextWordLock } from "@/lib/word-lesson";
import { readingsProvedBy } from "@/lib/word-unlock";
import { nextLesson } from "@/lib/lesson";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import { useHistory } from "@/lib/use-history";
import type { FactId } from "@/types";

function sameFactSet(a: readonly FactId[], b: readonly FactId[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  for (const f of b) if (!set.has(f)) return false;
  return true;
}

export default function HomePage() {
  const { cfg } = useQuizConfig();
  const { startSession, runs, continueRun } = useQuizSession();
  const { history, refresh } = useHistory();

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
  // The order and the lesson length are the two curriculum settings the lesson
  // reads. They are config, not state, so the lesson is still a pure function of
  // history for a given setup — change either and the whole curriculum re-cuts,
  // which is why they are deps here.
  const kanjiLesson = useMemo(
    () =>
      lesson
        ? null
        : nextKanjiLesson(history, kanjiTeachOrder(cfg.newKanjiOrder), {
            min: cfg.lessonMinCost,
            max: cfg.lessonMaxCost,
          }),
    [lesson, history, cfg.newKanjiOrder, cfg.lessonMinCost, cfg.lessonMaxCost],
  );

  // The radical track runs a step AHEAD of kanji: a kanji is gated on its
  // radical (kanji-lesson.ts), so when the next kanji group is blocked by an
  // unlearned radical, nextKanjiLesson returns null and this card supplies the
  // radicals to learn first. It reads the SAME kanji order and range, because
  // the radical order is derived from the kanji order — teach the radical of the
  // next kanji group, that group unlocks, the next group's radicals become due.
  // Orphans (no kanji needs them) surface only after the whole kanji track is
  // done. A pure function of history and the kanji-curriculum settings, gated on
  // `lesson === null` like every post-kana track.
  const radicalLesson = useMemo(
    () =>
      lesson
        ? null
        : nextRadicalLesson(
            history,
            kanjiTeachOrder(cfg.newKanjiOrder),
            { min: cfg.lessonMinCost, max: cfg.lessonMaxCost },
            RADICALS_PER_LESSON_DEFAULT,
          ),
    [lesson, history, cfg.newKanjiOrder, cfg.lessonMinCost, cfg.lessonMaxCost],
  );

  // reinforce each other: learning a word opens up its kanji's readings (see
  // word-unlock.ts). Gated the same way kanji is on kana — `lesson === null` —
  // so a beginner is never handed a third front before finishing the first. A
  // pure function of history and one setting (how many words a lesson teaches),
  // like every other card here; null when nothing is teachable yet, and then it
  // renders nothing.
  const wordLesson = useMemo(
    () => (lesson ? null : nextWordLesson(history, cfg.wordsPerLesson)),
    [lesson, history, cfg.wordsPerLesson],
  );

  // The words card LEADS with the top-ranked unlearned word and its gate: if the
  // best word to teach next is locked behind kanji you don't know, the card names
  // the word and those kanji rather than silently teaching a lesser available one
  // (which is what wordLesson, above, still supplies as the secondary offer). A
  // pure function of history — null only when the whole curriculum is finished,
  // the same finished state wordLesson returns null for.
  const wordLock = useMemo(
    () =>
      lesson
        ? null
        : nextWordLock(
            history,
            cfg.wordsPerLesson,
            kanjiTeachOrder(cfg.newKanjiOrder),
          ),
    [lesson, history, cfg.wordsPerLesson, cfg.newKanjiOrder],
  );
  const wordsTrackStarted = useMemo(() => hasStartedWordTrack(history), [history]);

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
  const markSeen = (facts: FactId[]) =>
    fetch("/api/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts }),
    }).catch(() => {});

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
    await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts, known: true }),
    }).catch(() => {});
    // The card is a function of history, so re-reading history IS how the next
    // lesson advances. Nothing tells it which group to show next.
    await refresh();
  };

  // Teaching a word is also what UNLOCKS its kanji's readings — the payoff (see
  // word-unlock.ts). So the words track's Start marks seen not only the word's
  // own facts (like kana's "Quiz me": pressing Start is the statement that
  // you've met them) but every kanji reading those words prove. The readings
  // then enter the drill anchored on the word you just learned, via the same
  // seen record everything else uses. Then straight into the drill of the words.
  //
  // Both routes into the words drill come through here — Start (walk, then
  // drill) and "Quiz me" (drill now) — so the unlock cannot depend on which
  // button you pressed. Teaching a word unlocks its kanji's readings because you
  // met the word, not because you paged through a screen about it.
  const startWordLesson = async (facts: FactId[], { teach = true } = {}) => {
    const kebs = wordLesson?.cards.map((c) => c.keb) ?? [];
    await markSeen([...facts, ...readingsProvedBy(kebs)]);
    startSession(facts, teach ? facts : []);
  };

  // "I already know these words" — claim the words (skip the drill), but still
  // unlock the kanji readings they prove: knowing the word is what makes the
  // reading fair, however you came to know it.
  const claimWordLesson = async (facts: FactId[]) => {
    const kebs = wordLesson?.cards.map((c) => c.keb) ?? [];
    const readings = readingsProvedBy(kebs);
    await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts, known: true }),
    }).catch(() => {});
    if (readings.length) await markSeen(readings);
    await refresh();
  };

  // Which run, if any, IS this lesson — matched across EVERY run in progress,
  // not just the focused one. Several sessions can be parked at once now (see
  // PARKING), so a lesson you left to start something else still has to light up
  // its own card. A run counts as "this lesson" when it's a session (not a
  // one-off quiz), not finished, and drills exactly this lesson's facts. Its id
  // is what Continue routes back to.
  const runForFacts = (facts: readonly FactId[] | undefined) =>
    facts
      ? runs.find(
          (r) =>
            r.kind === "session" &&
            r.phase !== "complete" &&
            sameFactSet(r.facts, facts),
        )
      : undefined;
  const lessonRun = runForFacts(lesson?.facts);
  const kanjiRun = runForFacts(kanjiLesson?.facts);
  const radicalRun = runForFacts(radicalLesson?.facts);
  const wordRun = runForFacts(wordLesson?.facts);
  const grammarRun = runForFacts(grammarLesson?.facts);

  // The curriculum is finished only when EVERY track's card would render
  // nothing — the exact negation of the render conditions below, so this is
  // true precisely when the lesson feed would otherwise be empty. The word and
  // grammar tracks each render on a lock (not just a lesson) once started, so a
  // locked-but-started track still counts as unfinished here.
  const curriculumComplete =
    !lesson &&
    !radicalLesson &&
    !kanjiLesson &&
    !wordLesson &&
    !(wordLock && wordsTrackStarted) &&
    !grammarLesson &&
    !(grammarLock && grammarTrackStarted);

  return (
    <>
      <PageTitle title="Kana quiz" />

      {/* What "I already know this" means, said once for the whole page rather
          than under each lesson card in that card's own words. The rule is the
          same on kana, kanji, words and grammar, so it is stated generally, at
          the top, and dismissed for good on the first "Got it". */}
      <ClaimExplainer />

      {lesson ? (
        <NextLesson
          lesson={lesson}
          onTeach={teachLesson}
          onQuizMe={quizMe}
          onClaim={claim}
          inSession={!!lessonRun}
          onContinue={() => lessonRun && continueRun(lessonRun.id)}
        />
      ) : null}

      {/* The radical track's next lesson, ABOVE kanji's — it runs a step ahead,
          because a kanji is gated on its radical. When the next kanji group is
          blocked by an unlearned radical, the kanji card below falls silent and
          this one names the radicals to learn first. Same onStart as kanji: the
          lesson IS its facts, all new, all taught. */}
      {radicalLesson ? (
        <NextRadicalLesson
          lesson={radicalLesson}
          onStart={startLesson}
          onClaim={claim}
          inSession={!!radicalRun}
          onContinue={() => radicalRun && continueRun(radicalRun.id)}
        />
      ) : null}

      {/* The lesson IS the session: its facts, all new, all taught — the same
          onStart the kana card takes, now that the runtime speaks facts. A kanji
          lesson's meaning facts are drillable the moment it's learned; the
          reading facts a word later proves are the words track's business, not
          this card's. */}
      {kanjiLesson ? (
        <NextKanjiLesson
          lesson={kanjiLesson}
          onStart={startLesson}
          onClaim={claim}
          inSession={!!kanjiRun}
          onContinue={() => kanjiRun && continueRun(kanjiRun.id)}
        />
      ) : null}

      {/* The words track's next lesson, below kanji's — two tracks running in
          parallel once kana is done. The word lesson IS its facts (meaning, and
          reading for a kanji word), all new, all taught: the same onStart the
          kanji card takes. Learning them is what unlocks the kanji readings. */}
      {wordLesson || (wordLock && wordsTrackStarted) ? (
        <NextWordLesson
          lesson={wordLesson}
          lock={wordLock}
          onStart={startWordLesson}
          onClaim={claimWordLesson}
          inSession={!!wordRun}
          onContinue={() => wordRun && continueRun(wordRun.id)}
        />
      ) : null}

      {/* The grammar track's next lesson — the fourth card, opened once kana is
          done. A pattern is taught teach-then-drill (its facts ARE the session,
          like kanji's). When the next patterns need a word type the learner
          hasn't met, the card locks (naming the type) instead of disappearing,
          but only after the track has opened — like the words track. */}
      {grammarLesson || (grammarLock && grammarTrackStarted) ? (
        <NextGrammarLesson
          lesson={grammarLesson}
          lock={grammarTrackStarted ? grammarLock : null}
          onStart={startLesson}
          onClaim={claim}
          inSession={!!grammarRun}
          onContinue={() => grammarRun && continueRun(grammarRun.id)}
        />
      ) : null}

      {/* Every track is exhausted: the lesson feed above rendered nothing, so
          Home says so on purpose rather than leaving a title over blank space,
          and points at the two jobs that outlast new material. */}
      {curriculumComplete ? <CurriculumComplete /> : null}
    </>
  );
}
