"use client";

// Current sessions — everything you have IN PROGRESS, in one place.
//
// The app can hold many runs at once now (see PARKING in quiz-session). This is
// the list of all of them, and the only screen that can reach every one: the
// Practice card shows just the latest, Home shows a lesson on its own card. Each
// row Continues (swaps that run into focus, parking whatever was focused) or
// Discards (drops it, unscored).
//
// THREE GROUPS, because they answer different questions:
//   • CURRICULUM LESSONS at the top — sessions the Home track started
//     (kind "session", origin "lesson"). These are "where am I in the course".
//   • LIBRARY LESSONS — teach→drill runs started off a Library entry's "Teach
//     me" (kind "session", origin "library"). Still teaching, but a detour you
//     chose, not the course. Kept out of Practice so a Teaching row never sits
//     under a "Practice" heading.
//   • PRACTICE below — the one-off quizzes you drilled on your own (kind "quiz").
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

import { useEffect, useRef, useState } from "react";

import { plural } from "@/lib/words";
import { Btn, Hint, SmallBtn } from "@/components/ui";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  TRACK_NOUN,
  TRACK_TITLE,
  trackKeyForRun,
} from "@/components/home/home-feed";
import { useQuizSession, type RunInfo } from "@/lib/quiz-session";
import { relativeTime } from "@/lib/relative-time";
import { fixedRunList } from "@/lib/session-list";
import { isStaleRun } from "@/lib/session-staleness";
import { useLists } from "@/lib/use-lists";

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

/** A run whose frozen `what` is nothing more than its own item count — the
 * generic fallback `countWhat()` stamps on a run nobody named (quiz-session.tsx).
 * Matched so a row can swap that count out for something that actually says
 * what the run is, the same way `trackKeyForRun` below reads it. */
const GENERIC_WHAT_RE = /^[\d,]+\s+things?$/i;

/** The track a run belongs to, named the way its Home card would name it —
 * "Vocabulary", "Kana", "Counting" — read off its facts via the same
 * `trackKeyForRun` Home uses to find a lesson's own in-progress run. Null
 * when the facts don't resolve to one clean track (a mixed list, or none). */
function trackLabel(run: RunInfo): string | null {
  const key = trackKeyForRun(run);
  if (!key) return null;
  return TRACK_TITLE[key] ?? TRACK_NOUN[key] ?? null;
}

/** The row's headline name. Most runs are already named something real when
 * they start — a lesson's slice label, "Counters", "Sentence ordering · tier
 * N" — so `run.what` is used as-is. The one gap is a curriculum lesson on an
 * ordinary track (Kana, Vocabulary, Keigo, Grammar, Transitivity): Home
 * starts those without a name, so `run.what` freezes to `countWhat()`'s bare
 * "5 things" — a number, not a name (SAK-67 changes requested: the row said
 * nothing about what was actually being taught). Swap that in for the run's
 * track name instead; every other `what` is left alone. */
function runTitle(run: RunInfo): string {
  if (!GENERIC_WHAT_RE.test(run.what)) return run.what;
  return trackLabel(run) ?? run.what;
}

/** "5 items · Started 2 hours ago" — how far along the run is and when it
 * started, the two facts that used to require opening it to find out
 * (SAK-67). `facts` is deduped by fact id already (a run's own list), so its
 * length is the item count without a second pass. `now` is null until mount
 * (see CurrentSessions), so this omits the started clause rather than let a
 * server-seeded "started" line disagree with the client a moment later —
 * same guard PracticeResume uses. */
function whatText(run: RunInfo, now: number | null): string {
  const items = `${plural(run.facts.length, "item")}`;
  if (!run.startedAt || !now) return items;
  return `${items} · Started ${relativeTime(run.startedAt, now)}`;
}

function RunRow({
  run,
  selected,
  onToggle,
  onContinue,
  onDiscard,
  onMakeList,
  madeList,
  now,
}: {
  run: RunInfo;
  selected: boolean;
  onToggle: (shift: boolean) => void;
  onContinue: () => void;
  onDiscard: () => void;
  onMakeList: () => void;
  madeList: boolean;
  /** The clock to read `run.lastActiveAt`/`run.startedAt` against — null until
   * mount (see CurrentSessions), so a first paint never claims a staleness or
   * a "started …" line the server couldn't have known. */
  now: number | null;
}) {
  const answered = progressText(run);
  const title = runTitle(run);
  // See session-staleness.ts for the threshold and why it's a hint, never an
  // auto-discard.
  const stale = now !== null && isStaleRun(run.lastActiveAt, now);
  return (
    <div
      className={cx(
        // De-boxed to the editorial language: no card, no border, no fill on the
        // mesh — rows sit apart by whitespace and the selected one takes a flat
        // accent wash (no shadow/blur, so scrolling stays a cached layer).
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2",
        "rounded-lg px-2.5 py-2.5 text-[13px] transition-colors",
        selected ? "bg-accent-bg" : "",
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
          aria-label={`Select "${title}" to discard`}
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
        {stale ? (
          <span
            title="No activity for over a day — still here if you want it, or Discard to clear it out"
            className="flex-none rounded-full border border-warning/40 bg-warning-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-warning"
          >
            Inactive
          </span>
        ) : null}
        <span className="min-w-0">
          <span className="block truncate font-semibold">{title}</span>
          <span className="block text-xs text-text-muted">
            {whatText(run, now)}
            {answered ? ` · ${answered}` : ""}
          </span>
        </span>
      </span>
      <span className="flex flex-none items-center gap-2">
        {/* Save this run's material as a list you can drill again. Idempotent by
         * run id, so a second click re-saves the same list; once saved, the
         * button relaxes to "Saved" so the row confirms it took. */}
        <SmallBtn onClick={onMakeList} disabled={madeList}>
          {madeList ? "Saved" : "Make a list"}
        </SmallBtn>
        <SmallBtn onClick={onDiscard}>Discard ✕</SmallBtn>
        {/* Continue sits to the right of Discard, the primary action last. */}
        <Btn sel onClick={onContinue}>
          Continue
        </Btn>
      </span>
    </div>
  );
}

/** Nothing in progress. Designed, so it reads as "you're all caught up" rather
 * than a screen that failed to load. */
function NoRuns() {
  return (
    <div className="flex min-h-[140px] flex-col items-center justify-center gap-1 p-6 text-center">
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
  const { save } = useLists();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Which rows have been turned into a saved list this visit, keyed by the same
  // run id every other per-row bit of state keys on, so only the clicked row
  // flips to "Saved".
  const [madeLists, setMadeLists] = useState<Set<string>>(new Set());
  // The last row you toggled, for Shift-range selection. A ref, not state: it
  // only ever seeds the NEXT click, so changing it should not re-render.
  const anchorRef = useRef<string | null>(null);

  // The clock every row's "Started …" line and staleness hint read against.
  // Set strictly after mount, not in a useState initialiser, so a server-seeded
  // "started 4 minutes ago" can't disagree with the client on hydration — same
  // pattern PracticeResume/PracticePage use for the same reason.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, []);

  if (!runs.length) return <NoRuns />;

  // Three groups, each answering a different question. Curriculum lessons are
  // "where am I in the course"; Library lessons are a teach→drill run you started
  // off a Library entry ("Teach me"), which is still teaching but not the course;
  // Practice is the one-off quizzes you drilled on your own. A Library teach run
  // is a session (origin "library"), so it used to fall in with the quizzes and
  // read as "Practice" even though its badge said Teaching — the split fixes that.
  // Order within each is already newest-first (runs is).
  const lessons = runs.filter(
    (r) => r.kind === "session" && (r.origin ?? "lesson") === "lesson",
  );
  const libraryLessons = runs.filter(
    (r) => r.kind === "session" && r.origin === "library",
  );
  const others = runs.filter((r) => r.kind !== "session");

  // The rows as they appear on screen, top to bottom. Shift-range selection reads
  // its indices off THIS order, so a range spans the section breaks exactly as
  // the eye would draw it.
  const ordered = [...lessons, ...libraryLessons, ...others];

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

  // Turn one run into a saved FIXED list of its material. A run in progress is
  // NOT a committed session record, so a derived `{ session: ts }` rule would
  // resolve to nothing (resolve reads history.sessions, which this run is not in
  // yet). So we snapshot the run's facts, fold them to the ENTRIES a list names,
  // and store that set. Keyed by run id so a second click re-saves the same list
  // rather than piling up duplicates.
  const makeList = (run: RunInfo) => {
    void (async () => {
      const list = fixedRunList(run.id, run.what, run.facts);
      if (!list) return;
      await save(list);
      setMadeLists((prev) => new Set(prev).add(run.id));
    })();
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
      onMakeList={() => makeList(r)}
      madeList={madeLists.has(r.id)}
      now={now}
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

      {libraryLessons.length ? (
        <section>
          <h2 className="mb-1.5 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
            Library lessons
          </h2>
          <div className="flex flex-col gap-2">{libraryLessons.map(renderRow)}</div>
        </section>
      ) : null}

      {others.length ? (
        <section>
          <h2 className="mb-1.5 text-[9.5px] uppercase tracking-[0.13em] text-text-muted">
            Practice
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
