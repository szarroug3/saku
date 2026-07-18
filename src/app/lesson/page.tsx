"use client";

// The lesson page: a routed, stepped walk-through of the next lesson on a track.
//
// WHY A PAGE, AND NOT THE SESSION'S TEACH PHASE
// =============================================
// There were two "teach" surfaces before this. One is the session's pre-round
// glance (session/teach-screen.tsx, phase "teaching") — a quick look at what
// you're about to be drilled on, also reached mid-round by "Look again". The
// other was the inline "Teach me here" card on Home (teach-me.tsx): a PRE-commit
// pull, "learn these first", with no session yet. This replaces the SECOND one.
//
// A dedicated route fits it and leaves the drill loop alone. The walk-through is
// pre-commit — you haven't started a session, so there is nothing to resume and
// nothing this page can regress; the session machinery, its save-as-you-answer
// and its "Current quiz" sidebar entry are all untouched. Pressing "Quiz me"
// here starts a session exactly the way the Home card did, and from that point
// on the existing loop owns everything. Folding a rich stepped page into the
// session's quick-glance teach screen would have done the opposite — made the
// mid-round "Look again" heavy, and put the drill loop's resume at risk — for no
// gain, since the walk-through's job is done before a session exists.
//
// WHICH LESSON — A VIEW OF HISTORY, PICKED BY ?track
// ==================================================
// The lesson itself is a function of history (src/lib/lesson-items.ts), the same
// as the Home cards. `?track=kana|kanji|word|grammar` only picks WHICH curriculum
// to read; the content is whatever that track's next lesson is right now. The
// param is plain ASCII and read through URLSearchParams, so the Next 16
// "params aren't decoded" trap (which is about DYNAMIC route params) doesn't
// apply here — but `asTrack` validates it regardless, because a URL outlives the
// code that built it.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import { LessonStepper } from "@/components/lesson/lesson-stepper";
import { Card, PageTitle } from "@/components/ui";
import { GRAMMAR_PER_LESSON_DEFAULT } from "@/lib/grammar-lesson";
import {
  asTrack,
  lessonPlan,
  type LessonItem,
  type LessonSettings,
} from "@/lib/lesson-items";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import { useHistory } from "@/lib/use-history";
import { readingsProvedBy } from "@/lib/word-unlock";
import type { FactId } from "@/types";

function LessonContent() {
  const params = useSearchParams();
  const track = asTrack(params.get("track"));

  const { cfg } = useQuizConfig();
  const { history, loaded, refresh } = useHistory();
  const { startSession } = useQuizSession();

  const settings: LessonSettings = useMemo(
    () => ({
      kanjiOrder: cfg.newKanjiOrder,
      lessonRange: { min: cfg.lessonMinCost, max: cfg.lessonMaxCost },
      wordsPerLesson: cfg.wordsPerLesson,
      grammarPerLesson: GRAMMAR_PER_LESSON_DEFAULT,
    }),
    [cfg.newKanjiOrder, cfg.lessonMinCost, cfg.lessonMaxCost, cfg.wordsPerLesson],
  );

  // A pure view of history, recomputed when either moves. Gated on `loaded`
  // below so we never flash the day-one lesson before the real history arrives.
  const plan = useMemo(
    () => (loaded ? lessonPlan(track, history, settings) : null),
    [loaded, track, history, settings],
  );

  // The kanji-word readings a set of facts would prove, when this is the words
  // track. Learning (or claiming) a word unlocks its kanji's readings — the same
  // payoff the Home words card wires (see word-unlock.ts). Empty for every other
  // track, so the intents below carry it without a per-track branch of their own.
  const provedReadings = (facts: FactId[]): FactId[] => {
    if (track !== "word" || !plan) return [];
    const set = new Set(facts);
    const kebs = plan.items
      .filter((it) => it.facts.some((f) => set.has(f)))
      .map((it) => it.glyph);
    return kebs.length ? readingsProvedBy(kebs) : [];
  };

  // "Quiz me": mark the lesson SEEN — the statement that you've met it, written
  // first and not waiting on the drill — then straight into the drill (empty
  // teach: this page WAS the teaching). Identical to the Home card's quizMe.
  const quizMe = async (facts: FactId[]) => {
    if (!plan) return;
    const seen = [...facts, ...provedReadings(facts)];
    await fetch("/api/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts: seen }),
    }).catch(() => {});
    startSession(facts, [], plan.label);
  };

  // A claim (group or per-item): mark KNOWN and skip the drill; for words, still
  // unlock the readings the word proves. Then refresh — the plan is a view of
  // history, so re-reading it IS how the walk advances past what you claimed.
  const claim = async (facts: FactId[]) => {
    await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts, known: true }),
    }).catch(() => {});
    const readings = provedReadings(facts);
    if (readings.length) {
      await fetch("/api/seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facts: readings }),
      }).catch(() => {});
    }
    await refresh();
  };

  if (!loaded) {
    return (
      <Card>
        <p className="text-[13px] text-text-muted">Loading your lesson…</p>
      </Card>
    );
  }

  if (!plan) {
    // Nothing new to teach on this track — the same "no new material" state the
    // Home cards render nothing for. Here it's a page, so it says so and points
    // home rather than going blank.
    return (
      <>
        <PageTitle title="All caught up" />
        <Card>
          <p className="text-[13px] text-text-muted">
            There&rsquo;s nothing new to learn here right now.{" "}
            <Link href="/" className="text-accent no-underline">
              Back to home →
            </Link>
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <p className="mb-3 text-[11.5px] text-text-muted">
        <Link href="/" className="text-text-muted no-underline">
          Home
        </Link>
        {" › Lesson"}
      </p>
      <LessonStepper
        plan={plan}
        onQuizMe={quizMe}
        onClaimGroup={claim}
        onClaimItem={(item: LessonItem) => claim(item.facts)}
      />
    </>
  );
}

export default function LessonPage() {
  // useSearchParams needs a Suspense boundary to render during prerender.
  return (
    <Suspense
      fallback={
        <Card>
          <p className="text-[13px] text-text-muted">Loading your lesson…</p>
        </Card>
      }
    >
      <LessonContent />
    </Suspense>
  );
}
