"use client";

// The Custom… card's disclosure: the escape hatch for a selection the six
// decks can't say — "hiragana basic plus just the katakana vowels",
// "everything except the combos", "these five I keep failing".
//
// It used to be the home screen, and it still looked like it: 54 rows of
// toggles, three levels of nested cards, no way to act on what you'd just
// built. It isn't the home screen any more. So it is now an OUTLINE (a rule
// and a heading per script, boxes only for rows), it opens closed, and it has
// a search box.
//
// The precision is untouched — that is the feature. What changed is what it
// costs to operate.
//
// IT HAS NO START BUTTON OF ITS OWN, and it used to. It had one because every
// card on Home fired a quiz and the custom selection was the only WHAT on the
// page you couldn't run without scrolling back up. Cards select now, so Home's
// start bar is the only Start there is — and being sticky, it is already
// hovering over these rows while you edit them. A second Start here would be
// the same button, twice, six inches apart, both acting on this same
// selection. This picker is a view of cfg.enabled; Home's bar runs cfg.enabled;
// there is nothing left for a local button to do.
//
// SEARCH IS A SCOPE, NOT JUST A FIND. With a query live, every row shows only
// its matching characters, and All · None · Invert — at the toolbar and at
// both heading levels — act on the matches. So "find ぬ" no longer means
// scrolling, and "just these five" is None then five clicks. A row click
// likewise toggles what the row is SHOWING; toggling five hidden characters
// because they happen to share a row with a match would be a lie about the
// tile you clicked.
//
// The search matches characters, not section labels — "everything except the
// combos" is still Extended set → None, which is two clicks and wants no help.
// Invert earns its place elsewhere: "everything EXCEPT what I just picked" is
// the one shape no All/None pair can reach at any level.

import { useCallback, useMemo, useState } from "react";

import { PickerHead } from "@/components/home/picker-head";
import { PickerRow } from "@/components/home/picker-row";
import { Card, Lbl, SmallBtn } from "@/components/ui";
import { isExtendedSection, SETS } from "@/data/characters";
import { accuracyFor, formatAccuracy } from "@/lib/accuracy";
import { kanaFact } from "@/data/characters";
import { ALL_CHARS } from "@/lib/decks";
import { useQuizConfig } from "@/lib/quiz-config";
import { useHistory } from "@/lib/use-history";
import type { CharSection, KanaChar } from "@/types";

/** A section narrowed to the characters currently matching the search. */
interface Match {
  section: CharSection;
  chars: KanaChar[];
}

export function CharacterPicker() {
  const { cfg, set } = useQuizConfig();
  const { history } = useHistory();

  const [query, setQuery] = useState("");
  // View-only, never persisted: scripts open closed (the picker is an index,
  // not a wall of 54 rows), groups open open (you asked for the script).
  const [openSets, setOpenSets] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const qRaw = query.trim();
  const q = qRaw.toLowerCase();

  // Same match rule as the Kana chart's search: raw for kana (no case to
  // fold), lowercased for romaji, and every accepted spelling counts so "si"
  // finds し the same as "shi" does.
  const scripts = useMemo(
    () =>
      SETS.map((charSet) => ({
        charSet,
        sections: charSet.sections
          .map((section) => ({
            section,
            chars: q
              ? section.chars.filter(
                  (ch) =>
                    ch.c.includes(qRaw) || ch.r.some((r) => r.includes(q)),
                )
              : section.chars,
          }))
          .filter((m) => m.chars.length > 0),
      })).filter((s) => s.sections.length > 0),
    [q, qRaw],
  );

  /** Everything the toolbar's bulk actions apply to: the matches, or all. */
  const scope = useMemo(
    () =>
      scripts.flatMap((s) =>
        s.sections.flatMap((m) => m.chars.map((c) => c.c)),
      ),
    [scripts],
  );

  const allNone = useCallback(
    (chars: string[], on: boolean) =>
      set((prev) => {
        const enabled = { ...prev.enabled };
        for (const c of chars) enabled[c] = on;
        return { ...prev, enabled };
      }),
    [set],
  );

  // The one thing no deck can express and no All/None pair can shortcut:
  // "everything except THAT". Cheap here, tedious by hand.
  const invert = useCallback(
    (chars: string[]) =>
      set((prev) => {
        const enabled = { ...prev.enabled };
        for (const c of chars) enabled[c] = !enabled[c];
        return { ...prev, enabled };
      }),
    [set],
  );

  const toggleChar = useCallback(
    (c: string) =>
      set((prev) => ({
        ...prev,
        enabled: { ...prev.enabled, [c]: !prev.enabled[c] },
      })),
    [set],
  );

  const row = (m: Match) => {
    const chars = m.chars.map((c) => c.c);
    const on = chars.filter((c) => cfg.enabled[c]).length;
    return (
      <PickerRow
        key={m.section.id}
        chars={m.chars}
        enabled={cfg.enabled}
        pct={accuracyFor(history, chars.map(kanaFact), cfg.accuracyMetric)}
        onToggleRow={() => allNone(chars, on < chars.length)}
        onToggleChar={toggleChar}
      />
    );
  };

  const group = (
    id: string,
    label: string,
    desc: string,
    sections: Match[],
  ) => {
    if (!sections.length) return null;
    const chars = sections.flatMap((m) => m.chars.map((c) => c.c));
    const on = chars.filter((c) => cfg.enabled[c]).length;
    // A search forces every level open — a match you can't see isn't a find.
    // Derived, not an effect: nothing to sync, nothing to get stale.
    const open = q ? true : (openGroups[id] ?? true);
    return (
      <div key={id} className="mt-1 pl-[38px]">
        <PickerHead
          level="group"
          open={open}
          onToggle={() => setOpenGroups((prev) => ({ ...prev, [id]: !open }))}
          title={label}
          sub={desc}
          on={on}
          total={chars.length}
          onAllNone={(v) => allNone(chars, v)}
        />
        {open ? (
          <div className="mt-1.5 mb-2 grid grid-cols-[repeat(auto-fill,minmax(212px,1fr))] gap-1.5">
            {sections.map(row)}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <Card>
      <Lbl>Custom selection</Lbl>
      <p className="-mt-1 mb-3 text-xs text-text-muted">
        For the selections the decks above can&rsquo;t say. A row toggles
        together; every character also toggles on its own.
      </p>

      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search kana or romaji: ぬ, nu, kyo…"
          aria-label="Search kana or romaji"
          className="kq-material min-w-[180px] flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] text-text"
        />
        <span className="flex flex-none items-center gap-1.5">
          <SmallBtn onClick={() => allNone(scope, true)}>All</SmallBtn>
          <SmallBtn onClick={() => allNone(scope, false)}>None</SmallBtn>
          <SmallBtn onClick={() => invert(scope)}>Invert</SmallBtn>
        </span>
      </div>

      {q ? (
        <p className="mb-2.5 text-[11px] text-text-muted">
          {scope.length === 0 ? (
            <>Nothing matches &ldquo;{qRaw}&rdquo;.</>
          ) : (
            <>
              <span className="tabular-nums">
                {scope.length} of {ALL_CHARS.length}
              </span>{" "}
              characters match &ldquo;{qRaw}&rdquo;. The rows below, and every
              All · None · Invert, apply to those only.
            </>
          )}
        </p>
      ) : null}

      <div>
        {scripts.map(({ charSet, sections }) => {
          const chars = sections.flatMap((m) => m.chars.map((c) => c.c));
          const on = chars.filter((c) => cfg.enabled[c]).length;
          // Pooled over the section's facts — a group of many entries, so this
          // is a real ratio over showings, not an entry summary.
          const acc = accuracyFor(
            history,
            chars.map(kanaFact),
            cfg.accuracyMetric,
          );
          const open = q ? true : !!openSets[charSet.id];
          return (
            <div
              key={charSet.id}
              className="border-t border-border py-1 first:border-t-0"
            >
              <PickerHead
                level="script"
                open={open}
                onToggle={() =>
                  setOpenSets((prev) => ({ ...prev, [charSet.id]: !open }))
                }
                title={charSet.label}
                sub={
                  <>
                    {charSet.labelJa}
                    {acc === null ? null : (
                      <>
                        {" · "}
                        <b className="text-text">{formatAccuracy(acc)}</b>{" "}
                        accuracy
                      </>
                    )}
                  </>
                }
                on={on}
                total={chars.length}
                onAllNone={(v) => allNone(chars, v)}
              />
              {open ? (
                <>
                  {group(
                    `${charSet.id}-basic`,
                    "Basic set",
                    "The core characters.",
                    sections.filter((m) => !isExtendedSection(m.section.label)),
                  )}
                  {group(
                    `${charSet.id}-ext`,
                    "Extended set",
                    "Voiced sounds (dakuten) and combo sounds.",
                    sections.filter((m) => isExtendedSection(m.section.label)),
                  )}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
