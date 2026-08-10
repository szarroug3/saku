// DEV view for SCHEDULING — each track's lesson order, as the shared unit
// scheduler actually produces it (unit-tracks.ts → simulateLessons). Not shipped
// UI. Route: /dev/scheduling
//
// One track at a time (tabs), its lessons numbered and paginated. Each lesson
// shows the units the scheduler chose, in teach order — so a prerequisite pulled
// in from another track (a kanji reading ahead of the verb pair that needs it)
// shows up inline, ahead of the unit that owes it. The same piece can therefore
// appear in more than one track's lessons; that's the cross-track prereq graph,
// not a bug.

"use client";

import { useMemo, useState } from "react";

import { UNIT_TRACKS, simulateLessons } from "@/lib/content/unit-tracks";
import { LESSON_RANGE_DEFAULT } from "@/lib/lesson-sizing";
import { frostCard } from "@/components/ui/frost";
import type { TeachingUnit } from "@/lib/content/teach-unit";

const MAX_LESSONS = 5000; // a runaway guard, not a real cap — vocab is ~480 lessons
const PER_PAGE = 20;

export default function SchedulingDevPage() {
  const [trackId, setTrackId] = useState(UNIT_TRACKS[0].id);
  const [page, setPage] = useState(0);

  const track = UNIT_TRACKS.find((t) => t.id === trackId) ?? UNIT_TRACKS[0];
  const lessons = useMemo(
    () => simulateLessons(track, LESSON_RANGE_DEFAULT, MAX_LESSONS),
    [track],
  );

  const pageCount = Math.max(1, Math.ceil(lessons.length / PER_PAGE));
  const current = Math.min(page, pageCount - 1);
  const shown = lessons.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  const pick = (id: string) => {
    setTrackId(id);
    setPage(0);
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 text-text">
      <h1 className="text-2xl font-semibold">Scheduling</h1>
      <p className="mt-1 text-sm text-text-muted">
        Each track&rsquo;s lesson order, as the shared scheduler builds it — prerequisites
        pulled inline, in teach order.
      </p>

      {/* Track tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {UNIT_TRACKS.map((t) => (
          <button
            key={t.id}
            onClick={() => pick(t.id)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              t.id === trackId
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-text-muted hover:text-text"
            }`}
          >
            {t.title}
          </button>
        ))}
      </div>

      {/* Lesson count + pagination */}
      <div className="mt-5 flex items-center justify-between text-sm text-text-muted">
        <span>
          {lessons.length}
          {lessons.length === MAX_LESSONS ? "+" : ""} lessons
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              className="disabled:opacity-40"
            >
              ← Prev
            </button>
            <span>
              {current + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={current === pageCount - 1}
              className="disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Lessons */}
      <div className="mt-4 flex flex-col gap-3">
        {shown.map((lesson) => (
          <div key={lesson.n} className={`${frostCard} flex gap-4`}>
            <div className="shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-text-muted">
              {lesson.n}
            </div>
            <div className="flex flex-wrap gap-2">
              {lesson.units.map((u, i) => (
                <UnitChip key={`${lesson.n}-${i}`} unit={u} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

/** One teaching unit, rendered by kind — kana show the glyph; a word shows type,
 * pronunciation and definitions; keigo the base word; and so on. */
function UnitChip({ unit }: { unit: TeachingUnit }) {
  return (
    <div className="min-w-[92px] rounded-lg border border-border/70 px-2.5 py-1.5">
      <UnitBody unit={unit} />
    </div>
  );
}

function TypeTag({ label }: { label: string }) {
  return (
    <div className="mt-1 text-[10px] uppercase tracking-[0.06em] text-accent">{label}</div>
  );
}

function UnitBody({ unit }: { unit: TeachingUnit }) {
  switch (unit.kind) {
    case "pronunciation": {
      const isKana = unit.item.kind === "kana";
      if (isKana) {
        return (
          <div className="text-center">
            <div className="font-kana text-2xl leading-none">{unit.glyph}</div>
            <div className="mt-1 text-[11px] text-text-muted">{unit.reading}</div>
          </div>
        );
      }
      return (
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-kana text-lg leading-none">{unit.glyph}</span>
            {unit.reading && (
              <span className="text-[11px] text-text-muted">{unit.reading}</span>
            )}
          </div>
          {unit.meanings.length > 0 && (
            <div className="mt-0.5 max-w-[160px] text-[11px] text-text">
              {unit.meanings.map((m) => m.label).join("; ")}
            </div>
          )}
          <TypeTag label={unit.item.typeLabel} />
        </div>
      );
    }
    case "keigo-form":
      return (
        <div>
          <div className="font-kana text-lg leading-none">{unit.base || unit.form}</div>
          <div className="mt-0.5 text-[11px] text-text-muted">
            {unit.cost} form{unit.cost === 1 ? "" : "s"}
          </div>
          <TypeTag label="keigo" />
        </div>
      );
    case "grammar-production":
      return (
        <div className="max-w-[180px]">
          <div className="font-kana text-base leading-none">{unit.pattern}</div>
          <div className="mt-0.5 text-[11px] text-text-muted">{unit.summary}</div>
          <TypeTag label="grammar" />
        </div>
      );
    case "verb-pair":
      return (
        <div>
          <div className="font-kana text-base leading-none">
            {unit.intransitive} · {unit.transitive}
          </div>
          {unit.base && (
            <div className="mt-0.5 text-[11px] text-text-muted">
              shared <span className="font-kana">{unit.base}</span>
            </div>
          )}
          <TypeTag label="verb pair" />
        </div>
      );
    case "sentence-build":
      return (
        <div className="max-w-[180px]">
          <div className="font-kana text-base leading-none">{unit.rule}</div>
          <TypeTag label="sentence" />
        </div>
      );
    case "generative-rule":
      return (
        <div>
          <div className="font-kana text-lg leading-none">{unit.label}</div>
          <TypeTag label={unit.item.typeLabel} />
        </div>
      );
  }
}
