"use client";

// Current sessions — everything you have IN PROGRESS, in one place.
//
// The app can hold many runs at once now (see PARKING in quiz-session). This is
// the list of all of them, and the only screen that can reach every one: the
// Practice card shows just the latest, Home shows a lesson on its own card. Each
// row Continues (swaps that run into focus, parking whatever was focused) or
// Discards (drops it, unscored).
//
// TWO GROUPS, because they answer different questions:
//   • CURRICULUM LESSONS at the top — sessions the Home track started
//     (kind "session", origin "lesson"). These are "where am I in the course".
//   • EVERYTHING ELSE below — one-off quizzes and Library "Teach me" runs. These
//     are "what did I go and drill on my own".
//
// A badge on every row says which KIND it is — "Teaching" for a session (it has
// a teach -> drill -> rest loop), "Quiz" for a one-off - so the two never blur
// even when they sit in the same group.
//
// SELECTION is for clearing several at once. A dot on every row toggles it into
// the selection; the footer then discards all of them in one go. A single row's
// own Discard is one deliberate click and stays dialog-free; the BULK discard is
// easier to fire by accident on the wrong set, so it confirms first — the same
// split the Recent sessions list keeps.

import { useRef, useState } from "react";

import { plural } from "@/lib/words";
import { Btn, Hint, SmallBtn } from "@/components/ui";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useQuizSession, type RunInfo } from "@/lib/quiz-session";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Enter/Space on a div that behaves as a control — the selection dot is
 * clickable-but-not-a-button (the row already contains buttons; a button can't
 * contain buttons). The event is forwarded so a Shift-modified activation can
 * extend a range, the same as a Shift-click. */
function activates(
  e: React.KeyboardEvent,
  run: (e: React.KeyboardEvent) => void,
): void {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  run(e);
}

/** "Teaching" for a session, "Quiz" for a one-off. The one glance that tells
 * the two run kinds apart. */
function KindBadge({ kind }: { kind: RunInfo["kind"] }) {
  const teaching = kind === "session";
  return (
    <span
      className={cx(
        "flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
        teaching
          ? "bg-accent-bg text-accent"
          : "border border-border text-text-muted",
      )}
    >
      {teaching ? "Teaching" : "Quiz"}
    </span>
  );
}

/** How far in you are - "3 of 12 answered", or "3 answered" when the total
 * isn't fixed (an endless run), or nothing at all before the first answer. */
function progressText(run: RunInfo): string | null {
  const p = run.progress;
  if (!p || p.done <= 0) return null;
  return p.total !== null ? `${p.done} of ${p.total} answered` : `${p.done} answered`;
}

function RunRow({
  run,
  selected,
  onToggle,
  onContinue,
  onDiscard,
}: {
  run: RunInfo;
  selected: boolean;
  onToggle: (shift: boolean) => void;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const answered = progressText(run);
  return (
    <div
      className={cx(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2",
        "kq-material rounded-[12px] border p-3 text-[13px]",
        selected ? "border-accent/40 bg-accent-bg" : "border-border bg-card",
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {/* 10px dot, 20px hit target — small enough to stay a detail, big
         * enough to hit without landing on the row underneath it. Shift-click
         * (or Shift+Enter/Space) extends the selection to here from the last
         * one you touched. */}
        <span
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select "${run.what}" to discard`}
          tabIndex={0}
          title="Select to discard · Shift-click to extend"
          onClick={(e) => onToggle(e.shiftKey)}
          onKeyDown={(e) => activates(e, (ev) => onToggle(ev.shiftKey))}
          className="flex h-5 w-5 flex-none cursor-pointer items-center justify-center"
        >
          <span
            className={cx(
              "h-2.5 w-2.5 rounded-full border-[1.5px] transition-colors",
              selected ? "border-accent bg-accent" : "border-text-muted",
            )}
          />
        </span>
        <KindBadge kind={run.kind} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{run.what}</span>
          {answered ? (
            <span className="block text-xs text-text-muted">{answered}</span>
          ) : null}
        </span>
      </span>
      <span className="flex flex-none items-center gap-2">
        <Btn sel onClick={onContinue}>
          Continue
        </Btn>
        <SmallBtn onClick={onDiscard}>Discard ✕</SmallBtn>
      </span>
    </div>
  );
}

/** Nothing in progress. Designed, so it reads as "you're all caught up" rather
 * than a screen that failed to load. */
function NoRuns() {
  return (
    <div className="kq-material flex min-h-[140px] flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-border bg-card p-6 text-center">
      <span
        aria-hidden="true"
        className="mb-0.5 font-kana text-[26px] font-extralight opacity-70"
      >
        ✓
      </span>
      <p className="text-[13px] font-semibold">Nothing in progress</p>
      <Hint>
        Start a lesson from Home, or a quiz from Practice or the Library, and it
        lands here until you finish or discard it.
      </Hint>
    </div>
  );
}

export function CurrentSessions() {
  const confirm = useConfirm();
  const { runs, continueRun, discardRun } = useQuizSession();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // The last row you toggled, for Shift-range selection. A ref, not state: it
  // only ever seeds the NEXT click, so changing it should not re-render.
  const anchorRef = useRef<string | null>(null);

  if (!runs.length) return <NoRuns />;

  // Curriculum lessons answer "where am I in the course"; everything else is
  // "what did I go and drill on my own". Splitting them keeps each list about
  // one question. Order within each is already newest-first (runs is).
  const lessons = runs.filter(
    (r) => r.kind === "session" && (r.origin ?? "lesson") === "lesson",
  );
  const others = runs.filter(
    (r) => !(r.kind === "session" && (r.origin ?? "lesson") === "lesson"),
  );

  // The rows as they appear on screen, top to bottom — lessons then others.
  // Shift-range selection reads its indices off THIS order, so a range spans the
  // section break exactly as the eye would draw it.
  const ordered = [...lessons, ...others];

  // Toggle one row, or — with Shift held and a previous row remembered — select
  // every row between that anchor and this one (inclusive). Shift always SELECTS
  // the range rather than toggling each, which is what a range-drag means
  // everywhere else and avoids leaving holes mid-range.
  const selectRow = (id: string, shift: boolean) => {
    const anchor = anchorRef.current;
    if (shift && anchor && anchor !== id) {
      const a = ordered.findIndex((r) => r.id === anchor);
      const b = ordered.findIndex((r) => r.id === id);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setPicked((prev) => {
          const next = new Set(prev);
          for (let i = lo; i <= hi; i++) next.add(ordered[i].id);
          return next;
        });
        anchorRef.current = id;
        return;
      }
    }
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    anchorRef.current = id;
  };

  const selectAll = () => {
    setPicked(new Set(ordered.map((r) => r.id)));
    anchorRef.current = null;
  };

  const clearSelection = () => {
    setPicked(new Set());
    anchorRef.current = null;
  };

  // Discard one and forget it from the selection in the same move, so the
  // footer count never counts a run that is already gone.
  const discardOne = (id: string) => {
    discardRun(id);
    setPicked((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const discardSelected = () => {
    void (async () => {
      if (!picked.size) return;
      const ok = await confirm({
        title: `Discard ${plural(picked.size, "session")}?`,
        body: "They're dropped without scoring. This can't be undone.",
        confirmLabel: "Discard",
      });
      if (!ok) return;
      for (const id of picked) discardRun(id);
      setPicked(new Set());
      anchorRef.current = null;
    })();
  };

  const allSelected = picked.size === ordered.length;

  const renderRow = (r: RunInfo) => (
    <RunRow
      key={r.id}
      run={r}
      selected={picked.has(r.id)}
      onToggle={(shift) => selectRow(r.id, shift)}
      onContinue={() => continueRun(r.id)}
      onDiscard={() => discardOne(r.id)}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      {lessons.length ? (
        <section>
          <h2 className="mb-1.5 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
            Curriculum lessons
          </h2>
          <div className="flex flex-col gap-2">{lessons.map(renderRow)}</div>
        </section>
      ) : null}

      {others.length ? (
        <section>
          <h2 className="mb-1.5 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
            Quizzes and Library sessions
          </h2>
          <div className="flex flex-col gap-2">{others.map(renderRow)}</div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SmallBtn onClick={selectAll} disabled={allSelected}>
          Select all
        </SmallBtn>
        <SmallBtn onClick={clearSelection} disabled={!picked.size}>
          Clear
        </SmallBtn>
        <SmallBtn disabled={!picked.size} onClick={discardSelected}>
          {picked.size
            ? `Discard selected (${picked.size})`
            : "Discard selected"}
        </SmallBtn>
        <Hint>
          {plural(runs.length, "run")} in progress · Shift-click to select a
          range
        </Hint>
      </div>
    </div>
  );
}
