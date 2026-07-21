"use client";

// Up next — the grammar track's lesson card, once kana is done and beside kanji.
//
// It is the kanji card's twin in shape (teach-then-drill, "I already know these"
// vs "Start"), and the words card's twin in what it teaches: a pattern is shown
// OUTRIGHT, because unlike a glyph it is not an arbitrary shape to be memorised.
// 〜てから is [V-て] + から and means "after doing X" — the card shows the pattern
// and its function, and then the drill checks that you can build it. There is no
// Tofugu guide for "the pattern てから" to point out to, and inventing one would
// be the busy-work the kana/kanji cards send you off-app to avoid.
//
// WHAT IT MAY SAY
// ===============
// Every line is read off the recipe's own row (src/data/grammar/recipes.ts): how
// the pattern is written, its terse functional gloss, and its JLPT level as a
// quiet tag. It counts PATTERNS, not lessons — "patterns 3–7 of 53". It used to
// say "lesson 3" and withhold the total on the grounds that a total reads as a
// promise; it does, and the fix was to promise something true. 53 drillable
// patterns is the whole of what this track teaches and does not move, while the
// number of lessons is an artifact of how many a sitting happens to hold. The
// argument is at GRAMMAR_CURRICULUM_TOTAL and src/lib/lesson-position.ts.

import { Btn, Card, Lbl } from "@/components/ui";
import { WhyDisclosure } from "@/components/lesson/why";
import type { Why } from "@/data/why";
import { WHY_TRACK } from "@/data/why";
import type { GrammarLesson, GrammarLock } from "@/lib/grammar-lesson";
import { positionLabel } from "@/lib/lesson-position";
import type { Host } from "@/data/grammar/recipes";
import type { FactId } from "@/types";

/** How a host reads in a sentence to a beginner. The grammar track's own words
 * for the four word types a pattern can attach to. */
const HOST_LABEL: Record<Host, string> = {
  verb: "verb",
  "adj-i": "い-adjective",
  "adj-na": "な-adjective",
  noun: "noun",
};

/** "a verb", "an い-adjective" — the indefinite article picked by sound. */
function withArticle(label: string): string {
  return /^[aeiou]/i.test(label) || label.startsWith("い") ? `an ${label}` : `a ${label}`;
}

/** Join host labels into "a verb and a な-adjective". */
function hostList(hosts: Host[]): string {
  const parts = hosts.map((h) => withArticle(HOST_LABEL[h]));
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

const GRAMMAR_LOCK_WHY: Why = {
  lede: {
    strong: "Grammar attaches to words.",
    rest: "Grammar needs words to apply to. Until you know a verb to practise with, you can't learn the verb ending.",
  },
  paras: [
    "Every grammar pattern is built on a word: 〜てから needs a verb, 〜ので leans on a な-adjective. Until you've learned a word of that type, there is nothing to build the pattern on.",
    "Learn a verb on the words track and this grammar lesson opens. Patterns are taught starting with the easiest ones first.",
  ],
};

export function NextGrammarLesson({
  lesson,
  lock,
  onStart,
  onClaim,
  inSession = false,
  onContinue,
}: {
  lesson: GrammarLesson | null;
  lock: GrammarLock | null;
  /**
   * Start the lesson — teach-then-drill. The facts ARE the session: a count was
   * the unit, so there is no budget and no length to apply.
   *
   * `teach: false` is the skip-the-lesson route: drill these patterns now,
   * without the walk. Same handler, same facts, same seen record (page.tsx
   * writes it either way); the flag decides only whether the walk happens.
   */
  onStart: (facts: FactId[], opts?: { teach?: boolean }) => void;
  /** "I already know these", over the lesson's patterns. */
  onClaim: (facts: FactId[]) => void;
  inSession?: boolean;
  onContinue?: () => void;
}) {
  return (
    <Card>
      {lock ? (
        <LockedLead hosts={lock.hosts} />
      ) : lesson ? (
        <TeachableLesson
          lesson={lesson}
          onStart={onStart}
          onClaim={onClaim}
          inSession={inSession}
          onContinue={onContinue}
        />
      ) : null}

      {/* Why grammar, and how it differs from words and kanji — or, when locked,
          why a pattern waits on a word of its type. Teaching content about the
          language; a pull, so only the lede shows until opened. */}
      <WhyDisclosure why={lock ? GRAMMAR_LOCK_WHY : WHY_TRACK.grammar} />
    </Card>
  );
}

/** The locked card: the next patterns need a word type the learner has not met,
 * so the card names the type and points at the words track, showing no pattern.
 * The words-track lock's twin. */
function LockedLead({ hosts }: { hosts: Host[] }) {
  return (
    <>
      <Lbl>Up next · grammar</Lbl>
      <p className="mt-0.5 text-[13px] text-text-muted">
        Learn {hostList(hosts)} and the next grammar lesson opens.
      </p>
    </>
  );
}

/** The normal lesson — every pattern in the next set is teachable, so the
 * patterns ARE the lesson, shown outright. */
function TeachableLesson({
  lesson,
  onStart,
  onClaim,
  inSession = false,
  onContinue,
}: {
  lesson: GrammarLesson;
  onStart: (facts: FactId[], opts?: { teach?: boolean }) => void;
  onClaim: (facts: FactId[]) => void;
  inSession?: boolean;
  onContinue?: () => void;
}) {
  const { cards, position } = lesson;

  return (
    <>
        {/* "grammar" stays as the track name and "patterns" names the items —
            the two are not the same word here the way "kanji" and "words" are
            their own tracks' items. */}
        <Lbl>Up next · grammar · {positionLabel("patterns", position)}</Lbl>

        {/* The patterns ARE the lesson — shown outright, pattern · gloss, because
            a pattern is a form you already conjugate plus a fixed string. The
            level rides along as a quiet tag: a beginner meets N5 before N4, and
            the card says which is which without making a lesson of it. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {cards.map((card) => (
            <div
              key={card.id}
              className="min-w-[132px] flex-1 rounded-lg border border-border px-3 pb-2.5 pt-3 text-center"
            >
              <span className="block font-kana text-[24px] font-extralight leading-[1.2]">
                {card.pattern}
              </span>
              {card.sense && (
                <span className="mt-0.5 block font-kana text-[13px] text-text-muted">
                  ({card.sense})
                </span>
              )}
              <span className="mt-1 block text-[13px] text-text">
                {card.gloss}
              </span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.06em] text-text-muted/80">
                {card.level}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <Btn onClick={() => onClaim(lesson.facts)}>
            I already know{" "}
            {cards.length === 1 ? "this" : `these ${cards.length}`}
          </Btn>
          {/* The same two routes the kanji and words cards offer, in the same
              arrangement, because the claim explainer's promise ("skip just the
              lesson and go straight to the quiz") is made once for the whole
              page and has to be true on every card under it. Start walks the
              patterns and then drills them; "Quiz me" drills them now. Both mark
              them seen. The skip is unaccented and shares Start's group: it is
              Start without the walk, not a third intent, and the claim on the
              left is still the only other decision on the card.

              Plain "Start", matching the kanji and words cards: a bare lesson
              ordinal is a second scale contradicting the one in the label. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Btn onClick={() => onStart(lesson.facts, { teach: false })}>
              Quiz me
            </Btn>
            {inSession && onContinue ? (
              <Btn go onClick={onContinue}>
                Continue session
              </Btn>
            ) : (
              <Btn go onClick={() => onStart(lesson.facts)}>
                Start
              </Btn>
            )}
          </div>
        </div>
    </>
  );
}
