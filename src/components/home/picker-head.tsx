"use client";

// The picker's two heading levels — script (Hiragana / Katakana) and group
// (Basic / Extended) — as one component, because they do the same job: name a
// scope, say how much of it is on, collapse it, and offer All · None.
//
// Deliberately NOT a card. The legacy picker nested card-in-card-in-card
// (script → group → row), which drew three levels of chrome around what is
// really an outline. Here a script is a rule and a heading and only the rows
// are boxes — which also keeps aizome ("a card is two hairlines") honest,
// since a rule is the same object in all four themes.
//
// Interaction is the legacy one on purpose: the head is a click target and the
// All · None links stop propagation so they don't collapse what they just
// edited.

import type { MouseEvent, ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function Chevron({ open, small }: { open: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex flex-none items-center justify-center rounded-lg bg-panel",
        "text-accent transition-transform duration-150",
        small ? "h-5 w-5 text-[11px]" : "h-7 w-7 text-[13px]",
        open && "rotate-90",
      )}
    >
      ›
    </span>
  );
}

/**
 * `on / total` rather than the legacy "N selected": a bare count can't tell you
 * whether you have most of a scope or a sliver of it, and the denominator is
 * the whole question when the scope is a search result.
 */
export function PickerHead({
  open,
  onToggle,
  title,
  sub,
  level,
  on,
  total,
  onAllNone,
}: {
  open: boolean;
  onToggle: () => void;
  title: ReactNode;
  sub: ReactNode;
  level: "script" | "group";
  on: number;
  total: number;
  onAllNone: (on: boolean) => void;
}) {
  const script = level === "script";
  const link = (label: string, value: boolean) => (
    <button
      type="button"
      className="cursor-pointer text-accent"
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onAllNone(value);
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className={cx(
        "flex cursor-pointer select-none items-center gap-2.5",
        script ? "py-1.5" : "py-1",
      )}
      onClick={onToggle}
    >
      <Chevron open={open} small={!script} />
      <span className="min-w-0">
        <p
          className={cx(
            "m-0 font-semibold",
            script ? "text-[15px]" : "text-[13px]",
          )}
        >
          {title}
        </p>
        <p className="m-0 text-[11px] leading-snug text-text-muted">{sub}</p>
      </span>
      <span className="ml-auto flex-none text-right text-[11px] leading-[1.5] text-text-muted">
        <span className="tabular-nums">
          {on} / {total}
        </span>
        <br />
        {link("All", true)} · {link("None", false)}
      </span>
    </div>
  );
}
