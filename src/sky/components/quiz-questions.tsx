"use client";

// The deck, listed: every card with its number, what it asks and how it
// went, the one being asked lit. Tracked as SAK-384.
//
// It replaces the strip of pips that used to sit in the page's header. At
// a couple of dozen cards that strip read as progress; at two hundred it
// was three rows of grey lozenges (Sam, 2026-09-06: "the pips at the top
// look ugly"), and finding one card meant hovering them one at a time for
// a title. A list says what each card IS, so it can be looked through, and
// it folds away for anyone who wants the quiet room the Quiz is meant to
// be.
//
// It never spoils a card: a listening card is asked by ear, so until it is
// answered the row says "Listen" rather than printing the word.

import { useEffect, useRef } from "react";

import { VERDICT } from "@/sky/components/quiz-results";
import { RoundButton } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkySurface } from "@/sky/components/sky-panel";
import { japaneseFont } from "@/sky/lib/japanese";
import { GRADE, type QuizAnswer, type QuizCard } from "@/sky/lib/quiz";

export interface QuizQuestionsProps {
  cards: readonly QuizCard[];
  answers: Readonly<Record<string, QuizAnswer>>;
  /** Which card is being asked. */
  at: number;
  /** Slid in, or parked off the right edge. */
  open: boolean;
  onGo: (n: number) => void;
  onClose: () => void;
}

/** What a row calls its card: the word it is asked inside where there is
 * one, else the prompt, and nothing at all for a card still to be heard. */
function nameOf(card: QuizCard, answered: boolean): string {
  if (card.listen && !answered) return "Listen";
  return card.prompt.within ?? card.prompt.glyph;
}

export function QuizQuestions({ cards, answers, at, open, onGo, onClose }: QuizQuestionsProps) {
  const list = useRef<HTMLOListElement>(null);
  // the card being asked stays in view as the quiz moves through the deck
  useEffect(() => { if (open) list.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: "nearest" }); }, [at, open]);
  return (
    // Pinned to the right edge and slid in, never in the page's flow: the
    // card must not move when this opens (Sam, 2026-09-06). It stays
    // mounted so it can slide both ways, and is inert while parked, so
    // nothing in it can be tabbed to or read out. It keeps the surface's
    // own ground: it sits over the wash, never over the card, so it has no
    // reason to be heavier than any other panel.
    <SkySurface
      as="aside"
      pad="sm"
      aria-label="The cards"
      aria-hidden={!open}
      inert={!open}
      className={`absolute inset-y-0 right-0 flex w-full flex-col transition-transform duration-200 ease-out motion-reduce:transition-none lg:w-60 ${open ? "translate-x-0" : "pointer-events-none translate-x-[calc(100%+1.5rem)]"}`}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <Eyebrow tight>{cards.length} {cards.length === 1 ? "card" : "cards"}</Eyebrow>
        <RoundButton label="Hide the cards" expanded onClick={onClose}>›</RoundButton>
      </div>
      <ol ref={list} className="-mr-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
        {cards.map((card, i) => {
          const answer = answers[card.id];
          const here = i === at;
          const name = nameOf(card, !!answer);
          return (
            <li key={card.id}>
              {/* items-center, not items-baseline (SAK-415): a row of three
                  sizes centres all of them on the row rather than hanging
                  them off the tallest one's baseline */}
              <button
                type="button"
                onClick={() => onGo(i)}
                aria-current={here ? "step" : undefined}
                className={`grid w-full grid-cols-[1.6rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-lg border px-2 py-1.5 text-left ${here ? "border-sky-accent bg-sky-card-strong" : "border-transparent hover:bg-sky-card"}`}
              >
                <span className="text-[11px] tabular-nums text-sky-faint">{i + 1}</span>
                <span className={`truncate text-[13px] ${here ? "text-sky-ink" : answer ? "text-sky-muted" : "text-sky-ink/90"} ${japaneseFont(name)}`}>{name}</span>
                {answer && <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${VERDICT[answer.grade]}`}>{GRADE[answer.grade].label}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </SkySurface>
  );
}
