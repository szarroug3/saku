"use client";

// What a card shows, and the two boards it can be answered on (SAK-420).
//
// The Quiz is a loop and a drawing. The loop is `sky-quiz.tsx`: the tries, the
// grading, the keys, where the pass has got to. The drawing is here, and it is
// the half that has no opinions: the prompt at the top of the card, the pieces
// of a sentence to put in order, the board of choices to pick from. Every one
// of them takes what to draw and where to send a click, and holds nothing.
//
// Not the whole of the card. The typed box stays with the loop, because it is
// one line inside the form the loop submits, and the reveal is its own file
// already (`quiz-verdict.tsx`), as is the deck list (`quiz-questions.tsx`).

import type { RefObject } from "react";

import type { HearComponent, PitchComponent } from "@/sky/components/lesson-card";
import { SkyButton } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
import { japaneseFont, optionSize, promptSize } from "@/sky/lib/japanese";
import type { Open, QuizCard } from "@/sky/lib/quiz";

/** A context line that only names the kind of answer ("meaning") says
 * nothing the instruction does not; a frame or a gloss is worth showing. */
const LABEL_ONLY = /^(meaning|reading|in japanese)$/i;

/** The top of the card: the thing asked about, what it sits in, and what to
 * do with it.
 *
 * Four ways to draw one prompt, and which is a fact about the card rather
 * than a choice made here: a sound, a glyph inside the word it is asked in,
 * Japanese, English. */
export function QuizPrompt({ card, listening, answered, listenRef, hear: Hear }: {
  card: QuizCard;
  /** A listening card with its writing still hidden: the sound stands in for
   * the glyph, and the context goes with it. */
  listening: boolean;
  answered: boolean;
  /** The play button, so the loop can click it when the card appears. */
  listenRef: RefObject<HTMLSpanElement | null>;
  hear?: HearComponent;
}) {
  const context = card.prompt.context && !LABEL_ONLY.test(card.prompt.context) ? card.prompt.context : null;
  return (
    <div className="flex flex-col items-center text-center">
      {listening ? (
        // the sound in place of the glyph: a big hear button, and the
        // reading only once it is shown or answered
        <div className="flex flex-col items-center">
          <Eyebrow>Listen</Eyebrow>
          <span ref={listenRef} className="mt-1 inline-flex [&_button]:h-16 [&_button]:w-16 [&_button]:text-[26px]">{Hear && card.listen && <Hear glyph={card.listen} label="Play it again" />}</span>
        </div>
      ) : card.prompt.within ? (
        // the word, with the glyph asked about in ink and the rest muted
        <p className={`font-sky-display leading-none ${japaneseFont(card.prompt.within)}`} style={{ fontSize: promptSize(card.prompt.within) }}>
          {[...card.prompt.within].map((ch, i) => <span key={i} className={ch === card.prompt.glyph ? "text-sky-ink" : "text-sky-muted/60"}>{ch}</span>)}
        </p>
      ) : card.prompt.jp ? (
        // One size for every Japanese prompt, coming down only when the text
        // is too long to fit at it (SAK-390). It used to step from 64px to
        // 36px at three characters, so 待つ and 食べる were drawn half a size
        // apart.
        <p className={`font-sky-display leading-none text-sky-ink ${japaneseFont(card.prompt.glyph)}`} style={{ fontSize: promptSize(card.prompt.glyph) }}>{card.prompt.glyph}</p>
      ) : (
        // English is a different kind of thing to read, and its letters are
        // not square, so it keeps its own size
        <p className="font-sky-display text-[28px] leading-none text-sky-ink">{card.prompt.glyph}</p>
      )}
      {context && !listening && <p className={`mt-3 text-[15px] text-sky-muted ${japaneseFont(context)}`}>{context}</p>}
      {card.instruction && !answered && <p className="mt-2 text-[13px] text-sky-muted">{card.instruction}</p>}
    </div>
  );
}

/** A sentence to put in order (SAK-346): tap a piece to place it next, tap a
 * placed one to take it back, Check once every piece is down.
 *
 * `built` is the pieces placed so far, by their index in the deal, which is
 * how the loop keeps them; this draws them and says which index was touched. */
export function QuizOrder({ order, built, onBuilt, onCheck }: {
  order: { pieces: readonly string[]; answer: readonly string[] };
  built: readonly number[];
  onBuilt: (built: readonly number[]) => void;
  onCheck: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className={`flex min-h-[44px] flex-wrap items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 ${built.length ? "border-sky-line" : "border-sky-line/60"}`}>
        {built.length === 0 && <span className="text-[12.5px] text-sky-muted">Tap the pieces in order.</span>}
        {built.map((p, i) => (
          <button key={`${p}-${i}`} type="button" onClick={() => onBuilt(built.filter((_, j) => j !== i))} className={`rounded-lg border border-sky-accent bg-sky-card-strong px-3 py-1.5 text-[17px] text-sky-ink ${japaneseFont(order.pieces[p])}`}>{order.pieces[p]}</button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {order.pieces.map((piece, i) => {
          const placed = built.includes(i);
          return <button key={i} type="button" disabled={placed} onClick={() => onBuilt([...built, i])} className={`rounded-lg border px-3 py-1.5 text-[17px] ${placed ? "border-transparent bg-sky-card/40 text-sky-muted/50" : "border-sky-line bg-sky-card text-sky-ink hover:border-sky-accent"} ${japaneseFont(piece)}`}>{piece}</button>;
        })}
      </div>
      <div className="flex justify-center"><SkyButton onClick={onCheck} disabled={built.length !== order.pieces.length}>Check</SkyButton></div>
    </div>
  );
}

/** The board of choices: the narrowed set, one of them the answer.
 *
 * A pick only selects; Check submits, so a clip can be heard before it is
 * committed to (Sam, 2026-09-05). A choice already tried and found wrong is
 * struck through and cannot be picked again.
 *
 * `hears` is the loop's map of a choice to its hear button, so picking a
 * pitched choice can play it. The board writes into it as the buttons mount. */
export function QuizChoices({ card, state, onPick, hear: Hear, pitch: Pitch, hears }: {
  card: QuizCard;
  state: Open;
  onPick: (id: string) => void;
  hear?: HearComponent;
  pitch?: PitchComponent;
  hears: RefObject<Map<string, HTMLSpanElement>>;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {card.options.map((o, i) => {
        const struck = state.wrong.includes(o.id);
        const on = state.chosen === o.id;
        const frame = struck ? "border-transparent bg-sky-card/40 text-sky-muted" : on ? "border-sky-accent bg-sky-card-strong" : "border-sky-line bg-sky-card hover:border-sky-accent";
        // a pitched choice is a sound to judge: a numbered clip with
        // its hear button, the reading only once a hint is asked for
        if (o.pitch !== undefined) {
          return (
            <div key={o.id} className={`flex w-[calc((100%-1rem)/3)] min-w-[140px] items-center gap-1 rounded-xl border pr-2 ${frame}`}>
              <button type="button" onClick={() => onPick(o.id)} disabled={struck} aria-pressed={on} className={`flex min-h-[52px] min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left ${struck ? "line-through" : ""}`}>
                <span className="text-[12px] text-sky-muted">{i + 1}</span>
                {state.hinted && Pitch && <span className={`font-sky-display text-[18px] ${japaneseFont(o.label)}`}><Pitch reading={o.label} downstep={o.pitch} /></span>}
              </button>
              {Hear && <span ref={(el) => { if (el) hears.current.set(o.id, el); else hears.current.delete(o.id); }}><Hear glyph={o.label} downstep={o.pitch} /></span>}
            </div>
          );
        }
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            disabled={struck}
            aria-pressed={on}
            className={`flex min-h-[52px] w-[calc((100%-1rem)/3)] min-w-[140px] items-center rounded-xl border px-3 py-2.5 text-left ${frame} ${struck ? "line-through" : ""} ${o.jp ? `whitespace-nowrap font-sky-display ${japaneseFont(o.label)}` : "text-[13.5px]"}`}
            style={o.jp ? { fontSize: optionSize(o.label) } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
