"use client";

// Kana-Pro-style character picker: collapsible script cards (Hiragana /
// Katakana) → Basic/Extended groups → row cards. Clicking a row card toggles
// the whole row; each glyph inside toggles individually; partial rows get a
// dashed accent border; per-row accuracy circles appear once history exists.
// Port of the legacy buildSets()/headRight()/allNone()/accFor() rendering.

import { useState, type MouseEvent, type ReactNode } from "react";

import { Card, Lbl } from "@/components/ui";
import { isExtendedSection, SETS } from "@/data/characters";
import { formatAccuracy } from "@/lib/accuracy";
import { useQuizConfig } from "@/lib/quiz-config";
import { accuracyFor, useHistory } from "@/lib/use-history";
import type { CharSection, CharSet } from "@/types";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className={cx(
        "flex h-7 w-7 flex-none items-center justify-center rounded-lg",
        "bg-panel text-[13px] text-accent transition-transform duration-150",
        open && "rotate-90",
      )}
    >
      ›
    </span>
  );
}

/** "N selected" + All/None links on the right of a script/group header.
 * The links act without toggling the collapsible they sit inside. */
function HeadRight({
  count,
  onAllNone,
}: {
  count: number;
  onAllNone: (on: boolean) => void;
}) {
  const link = (label: string, on: boolean) => (
    <button
      type="button"
      className="cursor-pointer text-accent"
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onAllNone(on);
      }}
    >
      {label}
    </button>
  );
  return (
    <span className="ml-auto flex-none text-right text-xs leading-[1.6] text-text-muted">
      {count} selected
      <br />
      {link("All", true)} · {link("None", false)}
    </span>
  );
}

/** Collapsible header shared by script cards and Basic/Extended groups. */
function CollapseHead({
  open,
  onToggle,
  title,
  sub,
  titleClassName,
  count,
  onAllNone,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  title: ReactNode;
  sub: ReactNode;
  titleClassName: string;
  count: number;
  onAllNone: (on: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex cursor-pointer select-none items-center gap-3",
        className,
      )}
      onClick={onToggle}
    >
      <Chevron open={open} />
      <span>
        <p className={cx("m-0 font-semibold", titleClassName)}>{title}</p>
        <p className="m-0 text-xs text-text-muted">{sub}</p>
      </span>
      <HeadRight count={count} onAllNone={onAllNone} />
    </div>
  );
}

export function CharacterPicker() {
  const { cfg, set } = useQuizConfig();
  const { history } = useHistory();

  // Picker open state is view-only (never persisted): scripts default
  // closed, groups default open.
  const [openSets, setOpenSets] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const allNone = (chars: string[], on: boolean) =>
    set((prev) => {
      const enabled = { ...prev.enabled };
      for (const c of chars) enabled[c] = on;
      return { ...prev, enabled };
    });

  const toggleChar = (c: string) =>
    set((prev) => ({
      ...prev,
      enabled: { ...prev.enabled, [c]: !prev.enabled[c] },
    }));

  const rowCard = (section: CharSection) => {
    const chars = section.chars.map((c) => c.c);
    const on = chars.filter((c) => cfg.enabled[c]).length;
    const acc = accuracyFor(history, chars, cfg.accuracyMetric);
    return (
      <div
        key={section.id}
        className={cx(
          "flex cursor-pointer select-none items-center gap-2.5 rounded-[10px] border px-3.5 py-2.5",
          on === chars.length
            ? "border-accent bg-accent-bg"
            : on > 0
              ? "border-dashed border-accent bg-card"
              : "border-border bg-card",
        )}
        onClick={() => allNone(chars, on < chars.length)}
      >
        <span>
          <p className="m-0 text-[13px] font-semibold">
            {section.chars.map((c) => c.r[0]).join(" ")}
          </p>
          <p className="mt-0.5 mb-0">
            {section.chars.map((c) => (
              <span
                key={c.c}
                title={`${c.r.join(" / ")} — click to toggle just this one`}
                className={cx(
                  "mr-[5px] cursor-pointer text-base",
                  cfg.enabled[c.c]
                    ? "text-text opacity-100"
                    : "text-text-muted opacity-45",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleChar(c.c);
                }}
              >
                {c.c}
              </span>
            ))}
          </p>
        </span>
        {acc !== null ? (
          <span
            title="accuracy from your session history"
            className="ml-auto flex h-10 w-10 flex-none items-center justify-center rounded-full border-2 border-border text-[11px] text-text-muted"
          >
            {formatAccuracy(acc)}
          </span>
        ) : null}
      </div>
    );
  };

  const group = (
    id: string,
    label: string,
    desc: string,
    sections: CharSection[],
  ) => {
    const open = openGroups[id] ?? true;
    const chars = sections.flatMap((s) => s.chars.map((c) => c.c));
    const on = chars.filter((c) => cfg.enabled[c]).length;
    return (
      <div
        key={id}
        className="mb-2 rounded-[10px] border border-border bg-bg px-3 py-2.5 last:mb-0"
      >
        <CollapseHead
          open={open}
          onToggle={() => setOpenGroups((prev) => ({ ...prev, [id]: !open }))}
          title={label}
          sub={desc}
          titleClassName="text-sm"
          count={on}
          onAllNone={(v) => allNone(chars, v)}
          className="py-0.5"
        />
        {open ? (
          <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
            {sections.map(rowCard)}
          </div>
        ) : null}
      </div>
    );
  };

  const scriptCard = (charSet: CharSet) => {
    const open = !!openSets[charSet.id];
    const chars = charSet.sections.flatMap((s) => s.chars.map((c) => c.c));
    const on = chars.filter((c) => cfg.enabled[c]).length;
    const acc = accuracyFor(history, chars, cfg.accuracyMetric);
    return (
      <div
        key={charSet.id}
        className="mb-2.5 rounded-xl border border-border bg-card last:mb-0"
      >
        <CollapseHead
          open={open}
          onToggle={() =>
            setOpenSets((prev) => ({ ...prev, [charSet.id]: !open }))
          }
          title={charSet.label}
          sub={
            <>
              {charSet.labelJa}
              {acc !== null ? (
                <>
                  {" · "}
                  <b>{formatAccuracy(acc)}</b> accuracy
                </>
              ) : null}
            </>
          }
          titleClassName="text-base"
          count={on}
          onAllNone={(v) => allNone(chars, v)}
          className="px-3.5 py-[13px]"
        />
        {open ? (
          <div className="px-3.5 pb-3.5">
            {group(
              `${charSet.id}-basic`,
              "Basic set",
              "The core characters.",
              charSet.sections.filter((s) => !isExtendedSection(s.label)),
            )}
            {group(
              `${charSet.id}-ext`,
              "Extended set",
              "Voiced sounds (dakuten) and combo sounds.",
              charSet.sections.filter((s) => isExtendedSection(s.label)),
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <Card>
      <Lbl>Characters</Lbl>
      {SETS.map(scriptCard)}
    </Card>
  );
}
