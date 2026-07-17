"use client";

// Recent sessions — newest first, one row per finished quiz.
//
// The row IS the record: click it to reopen those results (viewStoredSession
// rebuilds the screen from the stored detail, or from the aggregates for
// sessions saved before detail existed). The two controls that must NOT do
// that — the selection dot and the × — stop the click before it reaches the
// row, which is the whole interaction model of this screen.
//
// Deletion posts to /api/delete and refetches rather than patching state
// locally: the server rebuilds the per-character aggregates from the surviving
// sessions, so the history it returns is the only trustworthy copy.
//
// Styled as deck-card rows (the same border/bg-card/12px tiles Home's shelves
// are built from) so this reads as a screen of the same app, not a table.

import { useState } from "react";

import { plural } from "@/components/home/deck-card";
import { Hint, SmallBtn } from "@/components/ui";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { formatAccuracy } from "@/lib/accuracy";
import { useQuizSession } from "@/lib/quiz-session";
import { useHistory } from "@/lib/use-history";
import type { QuizSessionRecord } from "@/types";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Enter/Space on a div that behaves as a control — the row and the dot are
 * both clickable-but-not-buttons (a row contains buttons; a button can't). */
function activates(
  e: React.KeyboardEvent,
  run: () => void,
  stop = false,
): void {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  if (stop) e.stopPropagation();
  run();
}

function SessionRow({
  record,
  selected,
  onToggle,
  onOpen,
  onDelete,
}: {
  record: QuizSessionRecord;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const d = new Date(record.ts);
  const when = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;

  return (
    <div
      role="button"
      tabIndex={0}
      title="Open this session's results"
      onClick={onOpen}
      onKeyDown={(e) => activates(e, onOpen)}
      className={cx(
        "flex cursor-pointer flex-wrap items-center justify-between gap-x-3 gap-y-1",
        "kq-material rounded-[12px] border p-3 text-[13px]",
        selected
          ? "border-accent/40 bg-accent-bg"
          : "border-border bg-card hover:border-accent/40",
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {/* 10px dot, 20px hit target — small enough to stay a detail, big
         * enough to hit without landing on the row underneath it. */}
        <span
          role="checkbox"
          aria-checked={selected}
          aria-label="Select this session for deletion"
          tabIndex={0}
          title="Select for deletion"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          onKeyDown={(e) => activates(e, onToggle, true)}
          className="flex h-5 w-5 flex-none cursor-pointer items-center justify-center"
        >
          <span
            className={cx(
              "h-2.5 w-2.5 rounded-full border-[1.5px] transition-colors",
              selected ? "border-accent bg-accent" : "border-text-muted",
            )}
          />
        </span>
        <span className="truncate tabular-nums">
          <span className="font-semibold">{when}</span>
          <span className="text-text-muted">
            {" · "}
            {record.mode}
            {record.redrill ? " (redrill)" : ""}
            {" · "}
            {plural(record.total, "char")}
          </span>
        </span>
      </span>

      <span className="flex items-center gap-2">
        <span className="tabular-nums text-text-muted">
          Forgiving{" "}
          <span className="text-text">
            {formatAccuracy(record.forgivingPct)}
          </span>{" "}
          · Strict{" "}
          <span className="text-text">{formatAccuracy(record.strictPct)}</span>
        </span>
        <button
          type="button"
          title="Delete this session"
          aria-label={`Delete the session from ${when}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="cursor-pointer rounded-lg border-none bg-transparent px-2 py-0.5 text-xs text-text-muted hover:bg-panel hover:text-danger"
        >
          ×
        </button>
      </span>
    </div>
  );
}

/** Day one. Designed, so an empty history reads as "nothing yet" rather than
 * as a screen that failed to load. */
function NoSessions() {
  return (
    <div className="kq-material flex min-h-[140px] flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-border bg-card p-6 text-center">
      <span
        aria-hidden="true"
        className="mb-0.5 font-kana text-[26px] font-extralight opacity-70"
      >
        ↺
      </span>
      <p className="text-[13px] font-semibold">No sessions yet</p>
      <Hint>
        Finish a quiz and it lands here. Every run is kept until you delete it.
      </Hint>
    </div>
  );
}

export function SessionsList() {
  const confirm = useConfirm();
  const { history, loaded, refresh } = useHistory();
  const { viewStoredSession } = useQuizSession();
  const [picked, setPicked] = useState<Set<number>>(new Set());

  // Newest first: the run you just did is the one you want to reopen.
  const sessions = history.sessions.slice().sort((a, b) => b.ts - a.ts);

  const togglePicked = (ts: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(ts)) next.delete(ts);
      else next.add(ts);
      return next;
    });
  };

  const deleteSessions = async (ids: number[], all: boolean) => {
    try {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(all ? { all: true } : { ids }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
      setPicked(new Set());
    } catch {
      alert("Couldn't delete. Try again.");
    }
  };

  if (!loaded) return null;
  if (!sessions.length) return <NoSessions />;

  return (
    <>
      <div className="mb-3.5 flex flex-col gap-2">
        {sessions.map((s) => (
          <SessionRow
            key={s.ts}
            record={s}
            selected={picked.has(s.ts)}
            onToggle={() => togglePicked(s.ts)}
            onOpen={() => viewStoredSession(s)}
            onDelete={() => void deleteSessions([s.ts], false)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SmallBtn
          disabled={!picked.size}
          onClick={() => {
            void (async () => {
              if (!picked.size) return;
              const ok = await confirm({
                title: `Delete ${plural(picked.size, "session")}?`,
                body: "This also rebuilds your per-character stats.",
                confirmLabel: "Delete",
              });
              if (ok) await deleteSessions([...picked], false);
            })();
          }}
        >
          {picked.size ? `Delete selected (${picked.size})` : "Delete selected"}
        </SmallBtn>
        <SmallBtn
          onClick={() => {
            void (async () => {
              const ok = await confirm({
                title: "Delete all session history?",
                body: "This also resets your per-character stats. It cannot be undone.",
                confirmLabel: "Delete all",
              });
              if (ok) await deleteSessions([], true);
            })();
          }}
        >
          Delete all
        </SmallBtn>
        <Hint>
          {plural(sessions.length, "session")} kept · deleting also rebuilds
          your per-character stats
        </Hint>
      </div>
    </>
  );
}
