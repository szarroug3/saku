"use client";

// WHAT TO PRACTISE — two axes: which TYPES, within which SCOPE.
//
// The drill is types ∩ scope (see src/lib/practice-types.ts). You pick a SCOPE —
// everything you know, optionally filtered by status, or a pool you name by hand — and any
// number of TYPES — hiragana, katakana, radicals, kanji, words, counters,
// grammar, verb pairs, keigo. Start runs exactly the facts that are BOTH: e.g.
// scope "everything I know" + types hiragana & radicals drills every hiragana
// and radical you already know, and nothing else.
//
// Both axes are stored in the one Selection (scope in states/list/session/text,
// types in `types`), so the same resolve() that the Library and the drill bar
// use turns this into facts — a selection, not a second code path. Empty types
// means ALL types, exactly as an empty scope means the whole known pool: two
// "no filter = everything" fields that a person reads the same way.
//
// The COUNT on each chip is that type's share of the CURRENT scope, resolved the
// same way Start resolves what it runs — so the number on a chip is the number
// that type contributes to the pool right now, and it moves when you change
// scope (fewer hiragana are "shaky" than are "known").

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { Info } from "@/components/ui";
import { japaneseFontClass } from "@/lib/japanese-text";
import { readableAssemblyForTiers } from "@/data/assembly";
import { learnedSentenceTierIds } from "@/lib/sentence-ordering-learned";
import { resolve } from "@/lib/selection";
import { emptySelection } from "@/lib/selection-empty";
import {
  endOfDay,
  matchesPrebuilt,
  parseDateInput,
  rangeLabel,
  startOfDay,
  thisMonthRange,
  thisWeekRange,
  todayRange,
  toDateInputValue,
  type DateRange,
} from "@/lib/date-range";
import {
  availableTypes,
  effectiveScope,
  pruneEmptyTypes,
  toggleType,
  typeLabel,
  withScope,
  withTypes,
  PRACTICE_TYPES,
  type PracticeScope,
} from "@/lib/practice-types";
import type {
  FactBand,
  HistoryFile,
  SavedList,
  Selection,
} from "@/types";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** A minor sub-group heading inside the de-boxed selector — one grain finer than
 * the page's <Lbl>. The scope/status/date/kind groups separate by this label and
 * whitespace now, not by boxes or divider rules. */
function SubLbl({
  children,
  className = "mb-2",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cx(
        className,
        "text-[11px] font-semibold uppercase tracking-[0.12em] text-text",
      )}
    >
      {children}
    </p>
  );
}

const GLYPH_BY_TYPE = new Map(PRACTICE_TYPES.map((t) => [t.id, t.glyph]));

const SCOPES: ReadonlyArray<{ id: PracticeScope; label: string }> = [
  { id: "everything", label: "Everything I know" },
  { id: "lists", label: "Lists" },
  { id: "custom", label: "Pick what I want" },
];

const STATUSES: ReadonlyArray<{ id: FactBand; label: string }> = [
  { id: "solid", label: "Solid" },
  { id: "getting-there", label: "Getting there" },
  { id: "shaky", label: "Shaky" },
  { id: "mixup", label: "Mix-ups" },
  { id: "slipping", label: "Slipping" },
];

// Matches the real crossing computed in src/lib/library/standing.ts
// (`standingOf`) — accuracy is over the up-to-ten most recent runs, not the
// lifetime total, and "solid" additionally requires the app to currently
// expect you'd recall it right now. Mix-ups is a separate axis entirely (see
// selection.ts's `mixedUpEntries`): a fact keeps its own standing regardless
// of whether it's also tangled up with something else.
// STATUSES never includes "new" (the empty/unmet band has no chip here — see
// the map below), so every lookup key this map actually sees is covered.
const STATUS_INFO: Partial<Record<FactBand, string>> = {
  solid:
    "You're currently expected to recall it, and at least 80% of your recent runs got it right.",
  "getting-there":
    "At least 60% of your recent runs got it right, but under 80%.",
  shaky: "Under 60% of your recent runs got it right.",
  slipping:
    "You've seen this before, but enough time has passed that the app now expects you've forgotten it — due to be re-taught, not re-tested.",
  mixup:
    "You've been mixing it up with a specific other entry. A separate question from how well you know it on its own — a fact can be any status here while also being an active mix-up.",
};

function sentenceScopeIsAvailable(sel: Selection): boolean {
  return (
    !sel.list &&
    sel.session === null &&
    !sel.text.trim() &&
    sel.subjects.length === 0
  );
}

function ScopeButton({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex-1 cursor-pointer rounded-lg border px-3 py-2 text-[13px] font-medium",
        on
          ? "border-accent bg-accent-bg text-accent"
          : "border-border bg-card text-text hover:bg-panel",
      )}
    >
      {label}
    </button>
  );
}

function TypeChip({
  id,
  count,
  on,
  onClick,
}: {
  id: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  const glyph = GLYPH_BY_TYPE.get(id) ?? "";
  // A type with nothing in the current scope can't be drilled — dim it and say
  // so, rather than offering a chip that resolves to zero.
  const empty = count === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={empty}
      suppressHydrationWarning
      className={cx(
        "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px]",
        on
          ? "border-accent bg-accent-bg text-accent"
          : "border-border bg-card text-text hover:bg-panel",
        empty && "cursor-default opacity-40 hover:bg-card",
      )}
    >
      <span className={cx(japaneseFontClass(glyph), "text-base")}>{glyph}</span>
      <span>{typeLabel(id)}</span>
      <span className="rounded-full border border-border px-1.5 py-0.5 text-[10.5px] tabular-nums text-text-muted">
        {count}
      </span>
    </button>
  );
}

function StatusChip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count === 0}
      suppressHydrationWarning
      className={cx(
        "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px]",
        on
          ? "border-accent bg-accent-bg text-accent"
          : "border-border bg-card text-text hover:bg-panel",
        count === 0 && "cursor-default opacity-40 hover:bg-card",
      )}
    >
      <span>{label}</span>
      <span className="rounded-full border border-border px-1.5 py-0.5 text-[10.5px] tabular-nums text-text-muted">
        {count}
      </span>
    </button>
  );
}

function ListTile({
  glyph,
  label,
  count,
  on,
  onClick,
}: {
  glyph: string;
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-[13px]",
        on
          ? "border-accent bg-accent-bg text-accent"
          : "border-border bg-card text-text hover:bg-panel",
      )}
    >
      <span className="jp text-lg">{glyph}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="flex-none rounded-full border border-border px-2 py-0.5 text-[10.5px] tabular-nums text-text-muted">
        {count}
      </span>
    </button>
  );
}

export function PracticeSelector({
  sel,
  lists,
  history,
  now,
  graduateRuns,
  onChange,
}: {
  sel: Selection;
  lists: SavedList[];
  history: HistoryFile;
  now: number;
  graduateRuns: number;
  onChange: (next: Selection) => void;
}) {
  const types = availableTypes();
  const context = useMemo(
    () => ({ now, graduateRuns }),
    [now, graduateRuns],
  );

  // Which scope the buttons/panel show. `scopeIntent` is the last preset the
  // learner pressed; it only matters for "pick what I want" with an empty pool,
  // which is field-for-field identical to "everything I know" and so cannot be
  // read back off the Selection alone (see effectiveScope). Every other shape
  // describes its own scope and ignores the intent.
  const [scopeIntent, setScopeIntent] = useState<PracticeScope | null>(null);
  const scope = effectiveScope(sel, scopeIntent);
  const learnedSentenceIds = useMemo(
    () => learnedSentenceTierIds(history),
    [history],
  );
  const sentenceCount = useMemo(
    () => readableAssemblyForTiers(learnedSentenceIds, history).length,
    [learnedSentenceIds, history],
  );

  const countForType = useCallback(
    (s: Selection, id: string): number =>
      id === "sentence"
        ? sentenceScopeIsAvailable(s)
          ? sentenceCount
          : 0
        : resolve(withTypes(s, [id]), history, lists,  0, context).length,
    [sentenceCount, history, lists, context],
  );

  // The type ids that resolve to at least one fact in a given selection's scope,
  // computed the same way the chip counts are. Used to prune a chosen type that
  // has nothing to drill after a scope change.
  const presentTypesIn = useCallback(
    (s: Selection): Set<string> =>
      new Set(types.filter((id) => countForType(s, id) > 0)),
    [types, countForType],
  );

  // Switch scope, then drop any chosen type with 0 items in the new scope — a
  // greyed-out "0" chip must not stay selected (the footer and drill would still
  // claim it). The intent is remembered so "pick what I want" can open with an
  // empty pool.
  const changeScope = (next: PracticeScope) => {
    setScopeIntent(next);
    const moved = withScope(sel, next);
    onChange(pruneEmptyTypes(moved, presentTypesIn(moved)));
  };

  // Each type's count within the CURRENT scope, resolved exactly as Start would.
  // Keyed on the scope shape (not the type set) so toggling a chip doesn't churn
  // the counts — a chip's count is "how many of this type the scope holds",
  // independent of which OTHER chips are lit.
  const scopeKey = JSON.stringify({
    states: sel.states,
    list: sel.list,
    session: sel.session,
    text: sel.text,
  });
  const typeCounts = useMemo(() => {
    const base = { ...sel };
    return new Map(
      types.map((id) => [
        id,
        countForType(base, id),
      ]),
    );
    // base derives from sel; scopeKey captures the scope fields that matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, types, countForType]);

  const statusCounts = useMemo(() => {
    const base = {
      ...sel,
      states: [] as FactBand[],
    };
    return new Map(
      STATUSES.map(({ id }) => [
        id,
        resolve(
          { ...base, states: [id] },
          history,
          lists,
        
          0,
          context,
        ).length,
      ]),
    );
  }, [sel, history, lists,  context]);

  // ---- WHEN YOU LEARNED IT (date window) ----
  // The active window, or null when the filter is off (both bounds null counts
  // as off, mirroring resolve()). Which prebuilt it equals decides which chip
  // lights; a window matching none of them is a "Custom…" window.
  const activeLearned: DateRange | null =
    sel.learned && (sel.learned.from != null || sel.learned.to != null)
      ? sel.learned
      : null;
  const isToday = !!activeLearned && matchesPrebuilt(activeLearned, now, "today");
  const isWeek = !!activeLearned && matchesPrebuilt(activeLearned, now, "week");
  const isMonth = !!activeLearned && matchesPrebuilt(activeLearned, now, "month");
  const isCustom = !!activeLearned && !isToday && !isWeek && !isMonth;

  // A backwards custom window (From after To) is left INVALID, not silently
  // swapped: while the learner edits one input the other is stale, so swapping
  // would apply a range they never asked for. Invalid resolves to zero facts
  // (see resolve — no date can be both ≥ from and ≤ to), and the footer says why
  // instead of printing a nonsensical "Aug 6 – Aug 4".
  const invalidRange =
    !!activeLearned &&
    activeLearned.from != null &&
    activeLearned.to != null &&
    activeLearned.from > activeLearned.to;
  // No first-learn can be in the future, so neither input may exceed today.
  const todayInput = toDateInputValue(now);

  // Counts per prebuilt, resolved exactly like statusCounts: the CURRENT
  // selection with only `learned` overridden, so each number is how much of the
  // scope-and-status pool was first learned in that window.
  const learnedCounts = useMemo(() => {
    const base = { ...sel };
    const countIn = (r: DateRange) =>
      resolve({ ...base, learned: r }, history, lists,  0, context).length;
    return {
      today: countIn(todayRange(now)),
      week: countIn(thisWeekRange(now)),
      month: countIn(thisMonthRange(now)),
    };
  }, [sel, history, lists,  context, now]);

  // The custom panel is open when the learner opened it, or when a custom window
  // is already active (so a persisted custom range shows its inputs on load).
  const [customOpen, setCustomOpen] = useState<boolean>(() => isCustom);
  const [customFrom, setCustomFrom] = useState<string>(() =>
    isCustom && activeLearned?.from != null
      ? toDateInputValue(activeLearned.from)
      : "",
  );
  const [customTo, setCustomTo] = useState<string>(() =>
    isCustom && activeLearned?.to != null ? toDateInputValue(activeLearned.to) : "",
  );

  // Set (or clear) the date window, pruning any now-empty type on the everything
  // scope exactly as the Status chips do, so a Kind chip that drops to 0 under
  // the new window doesn't stay lit.
  const setLearned = useCallback(
    (window: DateRange | null) => {
      const next: Selection = { ...sel, learned: window };
      onChange(
        scope === "everything"
          ? pruneEmptyTypes(next, presentTypesIn(next))
          : next,
      );
    },
    [sel, onChange, scope, presentTypesIn],
  );

  const applyCustom = (fromStr: string, toStr: string) => {
    const fromMs = parseDateInput(fromStr);
    const toMs = parseDateInput(toStr);
    const window: DateRange | null =
      fromMs == null && toMs == null
        ? null
        : {
            from: fromMs != null ? startOfDay(fromMs) : null,
            to: toMs != null ? endOfDay(toMs) : null,
          };
    setLearned(window);
  };

  // A status chip with 0 should not remain selected after counts change.
  useEffect(() => {
    if (!sel.states.length) return;
    const kept = sel.states.filter((s) => (statusCounts.get(s) ?? 0) > 0);
    if (kept.length === sel.states.length) return;
    const next: Selection = { ...sel, states: kept };
    onChange(scope === "everything" ? pruneEmptyTypes(next, presentTypesIn(next)) : next);
  }, [sel, statusCounts, scope, onChange, presentTypesIn]);

  // List tiles, only shown in custom scope. Each count reflects the chosen types
  // too, so it is the exact size that list contributes right now.
  const listCounts = useMemo(
    () =>
      new Map(
        lists.map((l) => [
          l.id,
          resolve(
            withTypes(
              {
                ...emptySelection(),
                list: l.id,
                states: sel.states,
              },
              [],
            ),
            history,
            lists,
          
            0,
            context,
          ).length,
        ]),
      ),
    [lists, history,  sel, context],
  );

  return (
    <div className="mb-6">
      {/* SCOPE — which slice of what you know. */}
      <div>
        <SubLbl>Scope</SubLbl>
        <div className="flex flex-wrap gap-2">
          {SCOPES.map((s) => (
            <ScopeButton
              key={s.id}
              label={s.label}
              on={scope === s.id}
              onClick={() => changeScope(s.id)}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center gap-0.5">
          <SubLbl className="mb-0">Status</SubLbl>
          <Info>
            <dl className="space-y-1.5">
              {STATUSES.map(({ id, label }) => (
                <div key={id}>
                  <dt className="font-semibold">{label}</dt>
                  <dd>{STATUS_INFO[id]}</dd>
                </div>
              ))}
            </dl>
          </Info>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(({ id, label }) => (
            <StatusChip
              key={id}
              label={label}
              count={statusCounts.get(id) ?? 0}
              on={sel.states.includes(id)}
              onClick={() => {
                const next: Selection = {
                  ...sel,
                  states: sel.states.includes(id)
                    ? sel.states.filter((state) => state !== id)
                    : [...sel.states, id],
                };
                onChange(
                  scope === "everything"
                    ? pruneEmptyTypes(next, presentTypesIn(next))
                    : next,
                );
              }}
            />
          ))}
        </div>
        <p className="mt-2 text-[12px] text-text-muted">
          {sel.states.length
            ? "Showing anything with one of the selected statuses."
            : "No status picked — every status is included."}
        </p>
      </div>

      <div className="mt-6">
        <SubLbl>When you learned it</SubLbl>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setCustomOpen(false);
              setLearned(null);
            }}
            className={cx(
              "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px]",
              !activeLearned
                ? "border-accent bg-accent-bg text-accent"
                : "border-border bg-card text-text hover:bg-panel",
            )}
          >
            <span>Any time</span>
          </button>
          <StatusChip
            label="Today"
            count={learnedCounts.today}
            on={isToday}
            onClick={() => {
              setCustomOpen(false);
              setLearned(todayRange(now));
            }}
          />
          <StatusChip
            label="This week"
            count={learnedCounts.week}
            on={isWeek}
            onClick={() => {
              setCustomOpen(false);
              setLearned(thisWeekRange(now));
            }}
          />
          <StatusChip
            label="This month"
            count={learnedCounts.month}
            on={isMonth}
            onClick={() => {
              setCustomOpen(false);
              setLearned(thisMonthRange(now));
            }}
          />
          <button
            type="button"
            onClick={() => {
              // Opening seeds the inputs from an active custom window; closing
              // just hides the panel and leaves the window as it is.
              if (customOpen) {
                setCustomOpen(false);
                return;
              }
              setCustomOpen(true);
              if (isCustom && activeLearned) {
                setCustomFrom(
                  activeLearned.from != null
                    ? toDateInputValue(activeLearned.from)
                    : "",
                );
                setCustomTo(
                  activeLearned.to != null
                    ? toDateInputValue(activeLearned.to)
                    : "",
                );
              }
            }}
            className={cx(
              "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px]",
              isCustom
                ? "border-accent bg-accent-bg text-accent"
                : "border-border bg-card text-text hover:bg-panel",
            )}
          >
            <span>Custom…</span>
          </button>
        </div>
        {customOpen ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12px] text-text-muted">
              From
              <input
                type="date"
                value={customFrom}
                max={todayInput}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  applyCustom(e.target.value, customTo);
                }}
                className="rounded border border-border bg-card px-2 py-1 text-[13px] text-text"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-text-muted">
              To
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                max={todayInput}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  applyCustom(customFrom, e.target.value);
                }}
                className={cx(
                  "rounded border bg-card px-2 py-1 text-[13px] text-text",
                  invalidRange ? "border-danger" : "border-border",
                )}
              />
            </label>
          </div>
        ) : null}
        <p className={cx("mt-2 text-[12px]", invalidRange ? "text-danger" : "text-text-muted")}>
          {invalidRange
            ? "From is after To — set From on or before To to pick a range."
            : activeLearned
              ? `Showing things you first learned ${rangeLabel(activeLearned, now)}.`
              : "No date picked — anything you've learned counts."}
        </p>
      </div>

      {scope === "everything" ? (
        <div className="mt-6">
          <SubLbl>Kind</SubLbl>
          <div className="mb-1.5 flex flex-wrap gap-2">
            {types.map((id) => (
              <TypeChip
                key={id}
                id={id}
                count={typeCounts.get(id) ?? 0}
                on={sel.types.includes(id)}
                onClick={() => onChange(toggleType(sel, id))}
              />
            ))}
          </div>
          <p className="text-[12px] text-text-muted">
            {sel.types.length
              ? `Drilling ${sel.types.map(typeLabel).join(", ")}.`
              : "No kind picked — every kind is included."}
          </p>
        </div>
      ) : null}

      {scope === "lists" ? (
        <div className="mt-6 flex flex-col gap-2">
          <SubLbl>List</SubLbl>
          {lists.map((l) => (
            <ListTile
              key={l.id}
              glyph="✎"
              label={l.name}
              count={listCounts.get(l.id) ?? 0}
              on={sel.list === l.id}
              onClick={() =>
                onChange(
                  sel.list === l.id
                    ? { ...sel, list: null }
                    : {
                        ...emptySelection(),
                        states: sel.states,
                        list: l.id,
                      },
                )
              }
            />
          ))}
          {!lists.length ? (
            <p className="text-[12px] text-text-muted">
              You haven&apos;t made any lists yet.
            </p>
          ) : null}
        </div>
      ) : null}

      {scope === "custom" ? (
        <div className="mt-6">
          <Link
            href="/library"
            className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-card px-3 py-2.5 text-left text-[13px] text-text no-underline hover:bg-panel"
          >
            <span className="jp text-lg">＋</span>
            <span className="min-w-0 flex-1 truncate">
              Pick things in the Library
            </span>
            <span className="flex-none text-[11px] text-accent">Library →</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
