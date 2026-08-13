// DEV gallery for the Learn "Up next" card redesign — the four design directions
// stacked one over another so the author can compare them live on the real mesh and
// pick one. Not shipped UI. Route: /dev/learn (gated to non-production by
// src/app/dev/layout.tsx).
//
// Each option is rendered against the SAME sample lessons: a multi-tile vocab lesson
// (mixed radical/kanji/word tiles), the single-tile keigo phrase いらっしゃいませ
// (the layout with ONE tile and lots of empty space — where the shipped card's
// right-side void is worst), and a counters lesson. The samples are built the same
// way the /dev/views gallery builds its UP_NEXT: `simulateLessons` drives a track
// forward from EMPTY history, so these are exactly the lessons a day-one learner
// would meet. The position/why strings are hardcoded samples (see home-feed's
// TRACK_WHY / positionLabel for the real ones).

import type { ReactNode } from "react";

import {
  OptionA,
  OptionB,
  OptionC,
  OptionD,
  type VariantProps,
} from "@/components/learn/dev-learn-variants";
import { UNIT_TRACKS, simulateLessons } from "@/lib/content/unit-tracks";
import { teachUnitsOf } from "@/lib/content/teach-unit";
import { keigoItems } from "@/lib/content/keigo-unit";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
import type { UnitLesson } from "@/lib/content/teach-unit";
import type { Why } from "@/data/why";

/** A one-line "why" with no folded paragraphs — the shape every track card shows.
 * Same helper as home-feed's `lede`. */
function lede(strong: string): Why {
  return { lede: { strong }, paras: [] };
}

// The sample lessons, built from empty history exactly as /dev/views does.
const VOCAB_TRACK = UNIT_TRACKS.find((t) => t.id === "vocab")!;
const NUMBERS_TRACK = UNIT_TRACKS.find((t) => t.id === "numbers")!;

// Multi-tile vocab lesson (人 口 可 何 一 — mixed radical/kanji/word tiles).
const VOCAB_LESSON = simulateLessons(VOCAB_TRACK, LESSON_RANGE_DEFAULT, 1)[0] ?? null;
// A counters lesson (the numbers track's first lesson).
const NUMBERS_LESSON = simulateLessons(NUMBERS_TRACK, LESSON_RANGE_DEFAULT, 1)[0] ?? null;
// The single-tile keigo phrase いらっしゃいませ — one tile, the worst-case empty
// layout. Built straight from its item (welcome is always the first keigo set).
const KEIGO_WELCOME = keigoItems().find((i) => String(i.entry) === "keigo:welcome");
const KEIGO_LESSON: UnitLesson | null = KEIGO_WELCOME
  ? { units: teachUnitsOf(KEIGO_WELCOME) }
  : null;

// Each sample's card content — the same fields the real card is fed.
type Sample = Omit<VariantProps, "lesson"> & { key: string; lesson: UnitLesson };

const SAMPLES: Sample[] = (
  [
    {
      key: "vocab",
      title: "Vocabulary",
      positionLabel: "Vocab 7–13 of 9,140",
      why: lede("Vocabulary teaches you the glyphs and words you’ll actually read and speak."),
      lesson: VOCAB_LESSON,
    },
    {
      key: "keigo",
      title: "Keigo",
      positionLabel: "Set 1 of 12",
      why: lede("Speak politely to people you don’t know well, or want to show respect."),
      lesson: KEIGO_LESSON,
    },
    {
      key: "numbers",
      title: "Counters",
      positionLabel: "Counter 1–5 of 210",
      why: lede("Counters teach you how to count anything: days, people, drinks, etc."),
      lesson: NUMBERS_LESSON,
    },
  ] as { key: string; title: string; positionLabel: string; why: Why; lesson: UnitLesson | null }[]
).filter((s): s is Sample => s.lesson !== null);

/** One option: a labelled heading + note, then every sample rendered through that
 * option's component, stacked in a column (the `first:` rules on each variant drop
 * the top separator). */
function Option({
  label,
  note,
  Variant,
}: {
  label: string;
  note: string;
  Variant: (props: VariantProps) => ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-base font-medium text-text">{label}</h2>
      <p className="mb-5 mt-0.5 text-sm text-text-muted">{note}</p>
      <div className="flex flex-col">
        {SAMPLES.map((s) => (
          <Variant
            key={s.key}
            lesson={s.lesson}
            positionLabel={s.positionLabel}
            why={s.why}
            title={s.title}
          />
        ))}
      </div>
    </section>
  );
}

export default function LearnDevPage() {
  return (
    <main className="mx-auto max-w-[980px] px-5 py-10 text-text">
      <h1 className="text-2xl font-semibold">Learn — “Up next” card options</h1>
      <p className="mt-1 text-sm text-text-muted">
        Four directions for the next-lesson card, on the real mesh, so we can compare
        and pick one. None uses a box-shadow (the scroll-jank rule); edges come only
        from flat fills and real borders. The tiles are the shipped ItemPreview,
        unchanged. Buttons are inert here — this is a visual gallery.
      </p>

      {SAMPLES.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border p-5 text-center text-sm text-text-muted">
          No sample lessons could be built.
        </p>
      ) : (
        <>
          <Option
            label="Option A — Boxless"
            note="No panel at all. Eyebrow, tiles, actions and the why sit straight on the mesh; a hairline border-top separates each track. The why is pulled back to the left, under the actions."
            Variant={OptionA}
          />
          <Option
            label="Option B — Editorial headings"
            note="No box. A small accent eyebrow (the position) over a larger track title, the why as a subhead, then the tiles and actions — hierarchy from typography, like a magazine section."
            Variant={OptionB}
          />
          <Option
            label="Option C — Two-column, boxless"
            note="Roughly today's left(tiles+actions)/right(why) split, but with no box and the why pulled UP to align with the eyebrow rather than centring in the empty space. Goes two-column only when the block is wide enough."
            Variant={OptionC}
          />
          <Option
            label="Option D — Accent rail"
            note="No full box. A left vertical accent rail beside the content, over a very subtle flat translucent fill, content indented from the rail. Reads as a marked section without being a rounded rectangle."
            Variant={OptionD}
          />
        </>
      )}
    </main>
  );
}
