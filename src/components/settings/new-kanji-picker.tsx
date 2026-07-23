"use client";

// "Introduce new kanji by" — the queue of unseen kanji, and the order it
// arrives in.
//
// THE LABEL IS THE FIX. This control used to be called "New material order",
// and the user's response to it was a question: "what exactly is this the order
// of? kanji?" That is not a copy nit — a preference you cannot name the object
// of is a preference you cannot make. So the scope moved into the label, and the
// three options below are the only thing it orders: kanji you have not met yet.
// Not what you are asked next (the ranking model owns that, and it only ever
// sees facts you HAVE met), not the Library, not a search.
//
// AND THEN THE PREVIEW ANSWERS IT AGAIN, IN KANJI
// ==============================================
// The subtitles are three claims about sequences the reader cannot see, and the
// honest way to settle a claim about an order is to show the order. Switching
// the option moves the row underneath it — 人大日一不 to 日一人年大to 日一国会人 —
// which is the whole setting, demonstrated, in one line and no prose. It is also
// the cheapest guard this file has against the failure mode it was written under:
// a control that writes a value nothing reads looks exactly like a working one,
// unless the screen renders the consequence.
//
// WHY THERE ARE THREE
// ===================
// "Simplest shape first" was measured and dropped: it was not a fourth method,
// it was `everyday` with its stroke ceiling wound to the stop, and it landed
// within three words of a flat ≤4-stroke cap while costing 410. See
// NewKanjiOrder in src/types — the reasoning lives with the type, not here.

import { Hint, Lbl } from "@/components/ui";
import { kanjiTeachOrder } from "@/data/kanji";
import { useQuizConfig } from "@/lib/quiz-config";
import type { NewKanjiOrder } from "@/types";

/** How many glyphs of the chosen order to show. Enough that the three modes
 * visibly disagree (they diverge at item 2), few enough to stay one line on a
 * narrow window. */
const PREVIEW = 12;

interface Option {
  readonly id: NewKanjiOrder;
  readonly label: string;
  readonly sub: string;
}

/**
 * The three, in the order they are offered — best first, and `everyday` is best
 * on the evidence rather than by taste (see NewKanjiOrder).
 *
 * ONE SENTENCE EACH, AND NONE OF THEM ARGUES. An earlier draft of this list
 * spent its subtitles explaining what each option was NOT — that grade order
 * isn't wrong, that newspaper frequency isn't useless — which is a conversation
 * with a critic who is not in the room. Each line below says what the option
 * does and stops.
 */
const OPTIONS: readonly Option[] = [
  {
    id: "everyday",
    label: "Everyday words first",
    sub: "Kanji from the most common everyday words, but never before the parts it's built from.",
  },
  {
    id: "grade",
    label: "School grade order",
    sub: "The order Japanese schools teach. Match this to a textbook or class.",
  },
  {
    // NEVER "most common". The rank is a survey of newspaper corpora and it
    // reads like one: 安保 — the security treaty — is inside its top 500, 食べる
    // comes in around 12,000th, and 人 carries no rank at all. JMdict's editors
    // tagged 日本 `spec1` by hand, which is an editor overriding their own
    // corpus. They knew. The subtitle names 食べる because an abstract caveat is
    // one the reader has to take on trust, and this one has a face.
    id: "newspaper",
    label: "Newspaper frequency",
    sub: "Most common in newspapers first. Reaches news fast; skips everyday words like 食べる.",
  },
];

export function NewKanjiPicker() {
  const { cfg, update } = useQuizConfig();
  const preview = kanjiTeachOrder(cfg.newKanjiOrder).slice(0, PREVIEW);

  return (
    <div>
      <Lbl>Introduce new kanji by</Lbl>
      <div
        className="flex flex-col gap-1.5"
        role="radiogroup"
        aria-label="Introduce new kanji by"
      >
        {OPTIONS.map((o) => {
          const on = cfg.newKanjiOrder === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => update({ newKanjiOrder: o.id })}
              // A bespoke button, not the kit's Btn, and the reason is the box
              // model. Btn's `sel` state widens the border from 1px to 2px and
              // pays for that pixel back out of its own padding — a compensation
              // this control's full-width `px`/`py` override would have to wipe
              // out. So selecting a card changed its border box and the whole
              // stack twitched by a pixel or two.
              //
              // EVERY CARD CARRIES THE SAME 2px BORDER AT ALL TIMES, and only its
              // COLOUR moves between the accent of the chosen one and the neutral
              // of the rest. A same-width border reserves the same space whether
              // or not it is the accent, so nothing shifts on selection. This is
              // the Chip's rule (see ui.tsx), at Btn's size.
              className={
                "kq-material w-full cursor-pointer rounded-lg border-2 px-3 py-2 text-left transition-colors " +
                (on
                  ? "border-accent bg-accent-bg text-accent"
                  : "border-border bg-card text-text hover:bg-panel")
              }
            >
              <span className="block text-sm">{o.label}</span>
              {/* Not text-accent when selected: the subtitle is the same
                  sentence whether or not you picked it, and colouring it would
                  make the unselected two read as disabled. */}
              <span className="mt-0.5 block text-xs font-normal text-text-muted">
                {o.sub}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap items-baseline gap-2 border-t border-border pt-2.5">
        <Hint>Starts with</Hint>
        {/* aria-hidden: the row is a DEMONSTRATION of the buttons above, not a
            second control and not information you'd want spelled out one
            codepoint at a time. A screen reader gets the option's own sentence,
            which is the part that carries the meaning. */}
        <span aria-hidden className="text-lg tracking-[0.12em]">
          {preview.join("")}
        </span>
      </div>
    </div>
  );
}
