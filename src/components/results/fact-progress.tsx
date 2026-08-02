"use client";

import { Lbl } from "@/components/ui";
import { glyphOfFact } from "@/components/results/summary";
import { GETTING_THERE_PCT, SOLID_PCT, STANDING_LABEL } from "@/lib/library/standing";
import { nounFor } from "@/lib/quiz-instruction";
import type { FactId } from "@/types";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function pctOf(runs: boolean[]): number {
  if (!runs.length) return 0;
  const hits = runs.filter(Boolean).length;
  return (100 * hits) / runs.length;
}

function runsToReach(runs: boolean[], targetPct: number): number {
  if (pctOf(runs) >= targetPct) return 0;
  let next = [...runs];
  for (let i = 1; i <= 50; i++) {
    next = [...next, true].slice(-10);
    if (pctOf(next) >= targetPct) return i;
  }
  return 50;
}

export function FactProgressSection({
  rows,
  onClear,
  showLabel = true,
  showContainer = true,
  isSelected,
  onToggle,
}: {
  rows: Array<{ fact: FactId; runs: boolean[] }>;
  onClear: (fact: FactId) => void;
  showLabel?: boolean;
  showContainer?: boolean;
  isSelected?: (fact: FactId) => boolean;
  onToggle?: (fact: FactId) => void;
}) {
  if (!rows.length) return null;
  function progressText(runs: boolean[]): string {
    const toShaky = runsToReach(runs, GETTING_THERE_PCT);
    const toClear = runsToReach(runs, SOLID_PCT);
    if (toClear === 0) {
      return `Currently ${STANDING_LABEL.solid}`;
    }
    if (toShaky > 0) {
      return `Currently ${STANDING_LABEL.shaky}, ${toShaky} to getting there, ${toClear} to clear it`;
    }
    return `Currently ${STANDING_LABEL["getting-there"]}, ${toClear} to clear it`;
  }

  function runPips(runs: boolean[]) {
    const lastTen = runs.slice(-10);
    const padded: Array<boolean | null> = [
      ...Array.from({ length: Math.max(0, 10 - lastTen.length) }, () => null),
      ...lastTen,
    ];
    return padded.map((ok, i) => (
      <span
        key={i}
        style={{
          backgroundColor:
            ok === null
              ? "color-mix(in srgb, var(--text-muted) 24%, transparent)"
              : ok
                ? "var(--success)"
                : "var(--danger)",
        }}
        className={cx(
          "h-[5px] w-[5px] rounded-full",
        )}
      />
    ));
  }

  const items = rows.map(({ fact, runs }) => {
    const clickable = !!onToggle;
    const selected = !!isSelected?.(fact);
    return (
    <div
      key={fact}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onToggle ? () => onToggle(fact) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle?.(fact);
              }
            }
          : undefined
      }
      aria-pressed={clickable ? isSelected?.(fact) : undefined}
      className={cx("w-full text-left", clickable && "cursor-pointer")}
    >
      <div
      className={cx(
        "relative flex items-center gap-2.5 rounded-[10px] border px-2.5 py-2",
        selected
          ? "border-accent bg-accent-bg"
          : "border-success/35 bg-success-bg",
      )}
      >
      {selected ? (
        <span aria-hidden="true" className="absolute right-1 top-0.5 text-[9px] text-accent">
          ✓
        </span>
      ) : null}
      <span className="min-w-[112px] flex-none">
        <span className="flex items-center justify-center gap-2">
          <span className="flex min-w-[42px] flex-col items-center">
            <span className="font-kana text-[17px] font-extralight leading-none tracking-[0.04em]">
              {glyphOfFact(fact)}
            </span>
            <span className="mt-0.5 text-[10px] font-medium leading-none tracking-[0.03em] text-text-muted">
              {nounFor(fact)}
            </span>
          </span>
        </span>
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] leading-snug">No miss this run</span>
        <span className="text-[11px] leading-snug text-text-muted">
          {progressText(runs)}
        </span>
      </span>
      <span className="ml-auto flex flex-none flex-col items-end gap-1">
        <span className="ml-auto flex flex-none gap-[3px]" aria-label="last ten runs">
          {runPips(runs)}
        </span>
        <button
          type="button"
          className="text-[11px] font-medium text-accent hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onClear(fact);
          }}
        >
          Clear now
        </button>
      </span>
      </div>
    </div>
    );
  });
  return (
    <>
      {showLabel ? <Lbl>Progress</Lbl> : null}
      {showContainer ? (
        <div className="mb-3.5 flex flex-col gap-1.5">{items}</div>
      ) : (
        items
      )}
    </>
  );
}
