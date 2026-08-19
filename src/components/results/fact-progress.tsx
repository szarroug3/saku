"use client";

import { Lbl } from "@/components/ui";
import { glyphOfFact } from "@/components/results/summary";
import { GETTING_THERE_PCT, SOLID_PCT, STANDING_LABEL } from "@/lib/library/standing";
import { nounFor } from "@/lib/quiz-instruction";
import { grammarMeaning, grammarProduction } from "@/data/grammar";
import { patternLabel } from "@/data/grammar/recipes";
import { useHistory } from "@/lib/use-history";
import { wordKnown } from "@/lib/word-unlock";
import { clearActionLabel } from "@/components/results/clear-state";
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

const GODAN_ENDING: Record<string, string> = {
  v5u: "う",
  v5t: "つ",
  v5r: "る",
  v5m: "む",
  v5b: "ぶ",
  v5n: "ぬ",
  v5k: "く",
  v5g: "ぐ",
  v5s: "す",
};

function grammarClassLabel(cls: string): string {
  if (cls in GODAN_ENDING) return `godan · ${GODAN_ENDING[cls]}`;
  if (cls === "v1") return "ichidan";
  if (cls === "adj-i") return "i-adj";
  if (cls === "adj-na") return "na-adj";
  return cls;
}

function irregularVerbLabel(surface: string, known: boolean): string {
  const kanaBySurface: Record<string, string> = {
    行く: "いく",
    来る: "くる",
    する: "する",
    いい: "いい",
  };
  const kana = kanaBySurface[surface] ?? surface;
  return known ? surface : kana;
}

function grammarHostLabel(host: string): string {
  if (host === "adj-i") return "i-adj";
  if (host === "adj-na") return "na-adj";
  return host;
}

function grammarDisplayLabel(fact: FactId, history: ReturnType<typeof useHistory>["history"]): string | null {
  const production = grammarProduction(fact);
  if (production) {
    const base = patternLabel(production.recipe).replace(/^〜/, "~");
    const b = production.bucket;
    if (b?.kind === "class") {
      const cls = b.cls;
      return `${base} · ${grammarClassLabel(cls)}`;
    }
    if (b?.kind === "verb") {
      return `${base} · irregular · ${irregularVerbLabel(b.surface, wordKnown(b.surface, history))}`;
    }
    return `${base} · ${grammarHostLabel(production.host)}`;
  }
  const meaning = grammarMeaning(fact);
  return meaning ? patternLabel(meaning.recipe).replace(/^〜/, "~") : null;
}

export function FactProgressSection({
  rows,
  onClear,
  isCleared,
  showLabel = true,
  showContainer = true,
  isSelected,
  onToggle,
}: {
  rows: Array<{ fact: FactId; runs: boolean[] }>;
  onClear: (fact: FactId) => void;
  isCleared?: (fact: FactId) => boolean;
  showLabel?: boolean;
  showContainer?: boolean;
  isSelected?: (fact: FactId) => boolean;
  onToggle?: (fact: FactId) => void;
}) {
  const { history } = useHistory();
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
    const heading = grammarDisplayLabel(fact, history) ?? glyphOfFact(fact);
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
        // No box: a hairline left rule instead of the old bordered/rounded
        // tile, matching PatternRow — whitespace (the stack's own `gap-1.5`,
        // see FactProgressSection) separates one row from the next.
        "relative flex items-center gap-2.5 border-l-2 py-1.5 pl-2.5 pr-1",
        selected ? "border-accent" : "border-success/45",
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
            <span className="text-[12px] font-medium leading-snug sm:text-[13px] break-words text-center">
              {heading}
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
        {isCleared?.(fact) ? (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.07em] text-success">
            {clearActionLabel(true)}
          </span>
        ) : (
          <button
            type="button"
            className="text-[11px] font-medium text-accent hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onClear(fact);
            }}
          >
            {clearActionLabel(false)}
          </button>
        )}
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
