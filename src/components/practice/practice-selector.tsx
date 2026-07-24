"use client";

// WHAT TO PRACTISE — two axes: which TYPES, within which SCOPE.
//
// The drill is types ∩ scope (see src/lib/practice-types.ts). You pick a SCOPE —
// everything you know, just the shaky ones, or a pool you name by hand — and any
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
import { useMemo, useState } from "react";

import { japaneseFontClass } from "@/lib/japanese-text";
import { resolve } from "@/lib/selection";
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
import type { AccuracyMetric, HistoryFile, SavedList, Selection } from "@/types";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const GLYPH_BY_TYPE = new Map(PRACTICE_TYPES.map((t) => [t.id, t.glyph]));

const SCOPES: ReadonlyArray<{ id: PracticeScope; label: string }> = [
  { id: "everything", label: "Everything I know" },
  { id: "shaky", label: "Just the shaky ones" },
  { id: "custom", label: "Pick what I want" },
];

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
        "kq-material flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-[13px]",
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
  metric,
  onChange,
}: {
  sel: Selection;
  lists: SavedList[];
  history: HistoryFile;
  metric: AccuracyMetric;
  onChange: (next: Selection) => void;
}) {
  const types = availableTypes();

  // Which scope the buttons/panel show. `scopeIntent` is the last preset the
  // learner pressed; it only matters for "pick what I want" with an empty pool,
  // which is field-for-field identical to "everything I know" and so cannot be
  // read back off the Selection alone (see effectiveScope). Every other shape
  // describes its own scope and ignores the intent.
  const [scopeIntent, setScopeIntent] = useState<PracticeScope | null>(null);
  const scope = effectiveScope(sel, scopeIntent);

  // The type ids that resolve to at least one fact in a given selection's scope,
  // computed the same way the chip counts are. Used to prune a chosen type that
  // has nothing to drill after a scope change.
  const presentTypesIn = (s: Selection): Set<string> =>
    new Set(
      types.filter(
        (id) => resolve(withTypes(s, [id]), history, lists, metric).length > 0,
      ),
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
        resolve(withTypes(base, [id]), history, lists, metric).length,
      ]),
    );
    // base derives from sel; scopeKey captures the scope fields that matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, types, history, lists, metric]);

  // List tiles, only shown in custom scope. Each count reflects the chosen types
  // too, so it is the exact size that list contributes right now.
  const listCounts = useMemo(
    () =>
      new Map(
        lists.map((l) => [
          l.id,
          resolve(
            withTypes({ ...sel, list: l.id, states: [], session: null, text: "" }, sel.types),
            history,
            lists,
            metric,
          ).length,
        ]),
      ),
    [lists, history, metric, sel],
  );

  return (
    <div className="kq-material mb-3.5 rounded-xl border border-border bg-card p-3.5">
      {/* SCOPE — which slice of what you know. */}
      <div className="mb-3 flex gap-2">
        {SCOPES.map((s) => (
          <ScopeButton
            key={s.id}
            label={s.label}
            on={scope === s.id}
            onClick={() => changeScope(s.id)}
          />
        ))}
      </div>

      {/* TYPES — which kinds of thing, multi-select. None lit = all types. */}
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
          : "No type picked — every type is included."}
      </p>

      {/* CUSTOM — pick the pool by hand: a saved list, or build one in the
          Library. Only shown when the scope is "Pick what I want". */}
      {scope === "custom" ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
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
                    : { ...sel, list: l.id },
                )
              }
            />
          ))}
          <Link
            href="/library"
            className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-card px-3 py-2.5 text-left text-[13px] text-text no-underline hover:bg-panel"
          >
            <span className="jp text-lg">＋</span>
            <span className="min-w-0 flex-1 truncate">
              Build a list in the Library
            </span>
            <span className="flex-none text-[11px] text-accent">Library →</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
