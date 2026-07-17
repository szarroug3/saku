"use client";

// Up next — the words track's lesson card, and the one place the app teaches a
// word outright.
//
// WHY THIS CARD LEADS WITH THE GATE
// =================================
// Words are taught in beginnerRank order — best first — and most of the top-
// ranked words are kanji-gated: 何 is rank 1 and needs 何, 言う is #3 and needs
// 言. The old card stepped silently over those and taught the best word it COULD,
// which buried the reason the good words weren't showing. The owner wanted the
// opposite lead: name the word the curriculum most wants to teach next AND the
// kanji standing in its way, so the card pushes kanji from day one instead of
// hiding the dependency. See topWordGate in word-lesson.ts.
//
// So the card has two shapes, decided by the top-ranked unlearned word:
//   - GATED (its kanji aren't all known) → LEAD with the gate: the word, and the
//     missing kanji linked to the Library, "learn these to unlock it". The best
//     words you CAN already learn are still offered, but as a clearly-secondary
//     "or practise…" affordance, not the headline.
//   - TEACHABLE (kana-only, or every kanji known) → the normal lesson, whose head
//     IS that top word. Unchanged from before: the words ARE the lesson, shown
//     outright word · reading · meaning, because a word is built from parts you
//     already know.
//
// WHAT IT MAY SAY, AND WHAT IT MAY NOT
// ====================================
// Every line is read off the word's own row: the written form, the reading, the
// first gloss. A kana word (これ, もう) has no reading line — it IS its reading,
// and printing これ · これ reads as a bug. The GATED lead prints no reading at
// all: the word isn't teachable yet, and its reading is exactly what learning it
// later will teach, so showing it would spend the question. No lesson number of
// a TOTAL: the teachable set grows as the kanji track advances, so "lesson 3 of
// 40" would promise a 40 that moves. The card counts up ("lesson 3").

import Link from "next/link";

import { Btn, Card, Lbl } from "@/components/ui";
import { ClaimExplainer } from "@/components/lesson/claim-explainer";
import { WhyDisclosure } from "@/components/lesson/why";
import { kanjiEntry } from "@/data/kanji";
import { WHY_TRACK } from "@/data/why";
import { entryHref } from "@/lib/library/href";
import type { WordGate, WordLesson } from "@/lib/word-lesson";
import type { FactId } from "@/types";

export function NextWordLesson({
  gate,
  lesson,
  onStart,
  onClaim,
}: {
  /** The top-ranked unlearned word and its missing kanji — what the track most
   * wants to teach next, and what (if anything) is gating it. */
  gate: WordGate;
  /** The best words you can already learn, or null when nothing is teachable
   * yet. When the gate is open this is the LESSON; when the gate is closed it is
   * the clearly-secondary "or practise…" offer. */
  lesson: WordLesson | null;
  /** Start a lesson. The facts ARE the session — the count was the unit, so
   * there is no budget and no length to apply. */
  onStart: (facts: FactId[]) => void;
  /** "I already know these", over the lesson's words. */
  onClaim: (facts: FactId[]) => void;
}) {
  const gated = gate.missing.length > 0;

  return (
    <>
      <Card>
        {gated ? (
          <GatedLead gate={gate} lesson={lesson} onStart={onStart} onClaim={onClaim} />
        ) : lesson ? (
          <TeachableLesson lesson={lesson} onStart={onStart} onClaim={onClaim} />
        ) : null}

        {/* Why words vs kanji vs grammar, and how kanji unlock words. Teaching
            content about the language, so it belongs on screen; a pull, so only
            the lede shows until opened — the same affordance kana's "Why?" uses. */}
        <WhyDisclosure why={WHY_TRACK.words} />
      </Card>

      {/* The claim button's meaning — shown only when there IS a claim button,
          i.e. some teachable words are on offer. The gate-only state has nothing
          to claim, so it says nothing. */}
      {lesson ? (
        <ClaimExplainer>
          Learning a word also opens up its kanji: once you know a word 生 is in,
          the app starts asking how 生 is read there. Saying you already know
          these adds them to your knowledge base and skips the drill.
        </ClaimExplainer>
      ) : null}
    </>
  );
}

/** The gated lead: the word the track wants to teach next, the kanji standing in
 * its way (linked to their Library entries), and — secondary — the best words
 * you can already learn. */
function GatedLead({
  gate,
  lesson,
  onStart,
  onClaim,
}: {
  gate: WordGate;
  lesson: WordLesson | null;
  onStart: (facts: FactId[]) => void;
  onClaim: (facts: FactId[]) => void;
}) {
  const { word, missing } = gate;

  return (
    <>
      <Lbl>Up next · words</Lbl>

      {/* The word, by its meaning — the same headline the teachable lesson uses,
          so the two shapes read as one card. The written form and the gate come
          just below; the reading is withheld (the word isn't teachable yet). */}
      <h1 className="text-[22px] font-light tracking-[-0.3px]">{word.meaning}</h1>
      <p className="mt-0.5 text-[13px] text-text-muted">
        Your next word is{" "}
        <span className="font-kana text-text">{word.keb}</span> — learn the
        kanji <MissingList missing={missing} /> to unlock it.
      </p>

      {/* The kanji ARE the links — to the same Library entry the kanji track
          points at, which prints the meaning, the readings and the word each
          reading is proved by. Internal, so a plain Next <Link>, no new tab. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {missing.map((m) => (
          <Link
            key={m.c}
            href={entryHref(kanjiEntry(m.c))}
            className="min-w-[92px] flex-1 rounded-lg border border-border px-2 pb-2.5 pt-3 text-center text-text no-underline hover:bg-panel"
          >
            <span className="block text-[34px] font-extralight leading-[1.15]">
              {m.c}
            </span>
            <span className="mt-1 block text-[13px] text-text-muted">
              {m.meaning}
            </span>
            <span className="mt-1 block text-[10px] leading-tight text-accent">
              Learn this kanji
            </span>
          </Link>
        ))}
      </div>

      {/* Secondary — the owner's word. Still offered, never the lead: the best
          words you can already learn, behind a divider and a quieter heading, so
          the track is never a dead end while the gate does its pushing. */}
      {lesson ? (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-[13px] font-medium text-text-muted">
            Or practise words you can already learn
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {lesson.cards.map((card) => (
              <WordTile key={card.keb} card={card} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <Btn onClick={() => onClaim(lesson.facts)}>
              I already know{" "}
              {lesson.cards.length === 1
                ? "this"
                : `these ${lesson.cards.length}`}
            </Btn>
            <Btn go onClick={() => onStart(lesson.facts)}>
              Practise{" "}
              {lesson.cards.length === 1
                ? "this word"
                : `these ${lesson.cards.length}`}
            </Btn>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** The normal lesson — the top word is teachable, so the words ARE the lesson,
 * shown outright. Unchanged behaviour from before the gate. */
function TeachableLesson({
  lesson,
  onStart,
  onClaim,
}: {
  lesson: WordLesson;
  onStart: (facts: FactId[]) => void;
  onClaim: (facts: FactId[]) => void;
}) {
  const { cards, index } = lesson;

  return (
    <>
      <Lbl>Up next · words · lesson {index}</Lbl>

      <h1 className="text-[22px] font-light tracking-[-0.3px]">
        {cards.map((c) => c.meaning).join(" · ")}
      </h1>
      <p className="mt-0.5 text-[13px] text-text-muted">
        Learn these {cards.length === 1 ? "word" : "words"}, then a quick drill.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {cards.map((card) => (
          <WordTile key={card.keb} card={card} />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Btn onClick={() => onClaim(lesson.facts)}>
          I already know {cards.length === 1 ? "this" : `these ${cards.length}`}
        </Btn>
        <Btn go onClick={() => onStart(lesson.facts)}>
          Start · lesson {index}
        </Btn>
      </div>
    </>
  );
}

/** One word, shown word · reading · meaning. A kana word has no reading line: it
 * is its own reading, so printing これ · これ reads as a bug. */
function WordTile({ card }: { card: WordLesson["cards"][number] }) {
  return (
    <div className="min-w-[112px] flex-1 rounded-lg border border-border px-3 pb-2.5 pt-3 text-center">
      <span className="block font-kana text-[26px] font-extralight leading-[1.2]">
        {card.keb}
      </span>
      {card.reb ? (
        <span className="mt-0.5 block font-kana text-[13px] text-text-muted">
          {card.reb}
        </span>
      ) : (
        <span className="mt-0.5 block min-h-[16px]" />
      )}
      <span className="mt-1 block text-[13px] text-text">{card.meaning}</span>
    </div>
  );
}

/** The missing kanji, named inline in the gate sentence — "先 and 生", "言, 行 and
 * 何". Just the glyphs; the linked tiles below carry the meaning and the tap
 * target. */
function MissingList({ missing }: { missing: WordGate["missing"] }) {
  const glyphs = missing.map((m) => m.c);
  return (
    <>
      {glyphs.map((c, i) => (
        <span key={c}>
          {i > 0 ? (i === glyphs.length - 1 ? " and " : ", ") : null}
          <span className="font-kana text-text">{c}</span>
        </span>
      ))}
    </>
  );
}
