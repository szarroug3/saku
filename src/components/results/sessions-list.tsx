"use client";

// Recent-sessions list: newest first, a selection dot per row for bulk
// deletion, a per-row × for single deletion, and click-to-reopen through
// viewStoredSession. Deletion posts to /api/delete and refetches history
// (the server rebuilds the per-character aggregates).

import { useState } from "react";

import { Card, Hint, SmallBtn } from "@/components/ui";
import { useQuizSession } from "@/lib/quiz-session";
import { useHistory } from "@/lib/use-history";
import type { QuizSessionRecord } from "@/types";

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
  return (
    <div
      title="Open this session's results"
      onClick={onOpen}
      className={`mb-0.5 flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-lg px-3.5 py-2 text-[13px] text-text-muted ${
        selected ? "bg-accent-bg" : "hover:bg-panel"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <span
          title="Select for deletion"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex h-5 w-5 flex-none cursor-pointer items-center justify-center"
        >
          <span
            className={`h-2.5 w-2.5 rounded-full border-[1.5px] transition-colors ${
              selected ? "border-accent bg-accent" : "border-text-muted"
            }`}
          />
        </span>
        <span>
          {d.toLocaleDateString()}{" "}
          {d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} ·{" "}
          {record.mode}
          {record.redrill ? " (redrill)" : ""} · {record.total} chars
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span>
          forgiving {record.forgivingPct}% · strict {record.strictPct}%
        </span>
        <button
          title="Delete this session"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="cursor-pointer rounded-lg border-none bg-transparent px-2 py-0.5 text-xs text-text-muted hover:bg-panel"
        >
          ×
        </button>
      </span>
    </div>
  );
}

export function SessionsList() {
  const { history, loaded, refresh } = useHistory();
  const { viewStoredSession } = useQuizSession();
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const sessions = history.sessions.slice().reverse();

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
      alert("Couldn't delete — try again.");
    }
  };

  if (!loaded) return null;
  if (!sessions.length) {
    return <Hint>No sessions yet — finish a quiz and it lands here.</Hint>;
  }

  return (
    <Card>
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
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <SmallBtn
          disabled={!picked.size}
          onClick={() => {
            if (
              picked.size &&
              window.confirm(
                `Delete ${picked.size} session${picked.size === 1 ? "" : "s"}?`,
              )
            ) {
              void deleteSessions([...picked], false);
            }
          }}
        >
          {picked.size ? `Delete selected (${picked.size})` : "Delete selected"}
        </SmallBtn>
        <SmallBtn
          onClick={() => {
            if (
              window.confirm(
                "Delete all session history? This also resets per-character stats.",
              )
            ) {
              void deleteSessions([], true);
            }
          }}
        >
          Delete all
        </SmallBtn>
        <Hint>
          click a row to open its results · use the dot to select for deletion
        </Hint>
      </div>
    </Card>
  );
}
