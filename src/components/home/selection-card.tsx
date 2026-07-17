"use client";

// WHAT TO DRILL — the query, as a screen.
//
// This replaced a 214-cell grid and a shelf of nine cards. Both were correct
// for 214 things and both are impossible for 21,449: nobody ticks 21,449
// checkboxes, and no shelf holds a card per useful subset of a dictionary.
//
// So the gesture changed. You do not point at the things you want any more —
// you DESCRIBE them, and the count tells you how many you just described. The
// controls are the fields of Selection, one row each, and every one of them
// NARROWS: leave them all alone and you get everything you KNOW — the things
// you've seen or claimed, not the untaught rest of the dictionary (see
// selection.ts's knownFacts). Day one that pool is empty, and the sentence says
// "Nothing selected" rather than inventing a special empty state.
//
// The count is a RANDOM sample, not "hardest first": this is a review screen,
// and drilling the same worst N in the same order every time is the autopilot
// this avoids. The weakness ranking still runs — but on the learning loop (see
// budget.ts), which never comes through here.
//
// Nothing here says "fact", "weakness", "stability" or "p". The words are
// Kana / Kanji / Words, New / Shaky / Slipping / Solid / Mix-ups, and "things".
// Those are the only words this app has for any of it.

import { Btn, Chip, Hint, Lbl, Row } from "@/components/ui";
import { allSubjects, stateWord, subjectWord } from "@/lib/selection";
import type { FactBand, SavedList, Selection } from "@/types";

/** The bands, in the order they read — worst first, because that is the order
 * you care about them in. `solid` is last and is genuinely useful: "drill the
 * stuff I already know" is how you find out you don't. */
const BANDS: FactBand[] = ["shaky", "slipping", "mixup", "new", "solid"];

/** The count chips. `null` is "all of them" — an honest option rather than a
 * number pretending to be one, and the default. */
const LIMITS: Array<number | null> = [10, 20, 50, 100, null];

export function SelectionCard({
  sel,
  lists,
  onChange,
}: {
  sel: Selection;
  lists: SavedList[];
  onChange: (next: Selection) => void;
}) {
  const patch = (p: Partial<Selection>) => onChange({ ...sel, ...p });

  /** Toggle membership of a set-valued field. Empty means "all", so turning the
   * last one off widens back to everything rather than selecting nothing —
   * which is the same rule the count chips' "All" follows, and it is what makes
   * these read as filters rather than as checkboxes wearing a pill. */
  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  return (
    <>
      <Lbl>What to drill</Lbl>
      <div className="kq-material rounded-xl border border-border bg-card p-3.5">
        {/* Search first: it is the one control that can name a single thing,
            and typing 生 is faster than any number of chips. */}
        <Row label="Search">
          <input
            value={sel.text}
            onChange={(e) => patch({ text: e.target.value })}
            placeholder="し · shi · 生 · teacher · 先生"
            spellCheck={false}
            autoComplete="off"
            className="kq-material w-[260px] rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] text-text outline-none focus:border-accent"
          />
        </Row>

        <Row label="Kind" hint="everything, unless you say otherwise">
          {allSubjects().map((s) => (
            <Chip
              key={s}
              on={sel.subjects.includes(s)}
              onClick={() => patch({ subjects: toggle(sel.subjects, s) })}
            >
              {subjectWord(s)}
            </Chip>
          ))}
        </Row>

        <Row
          label="How well you know it"
          hint="switch one on and it sits this one out"
        >
          {BANDS.map((b) => (
            <Chip
              key={b}
              on={sel.states.includes(b)}
              onClick={() => patch({ states: toggle(sel.states, b) })}
            >
              {stateWord(b)}
            </Chip>
          ))}
        </Row>

        {/* Lists only appear once you have one. A row offering a choice between
            nothing and nothing is a row that teaches you the feature is broken;
            the import screen is where you learn lists exist. */}
        {lists.length ? (
          <Row label="List">
            <Chip on={!sel.list} onClick={() => patch({ list: null })}>
              Any
            </Chip>
            {lists.map((l) => (
              <Chip
                key={l.id}
                on={sel.list === l.id}
                onClick={() => patch({ list: l.id })}
              >
                {l.name}
              </Chip>
            ))}
          </Row>
        ) : null}

        <Row label="How many">
          {LIMITS.map((n) => (
            <Chip
              key={n ?? "all"}
              on={sel.limit === n}
              onClick={() => patch({ limit: n })}
            >
              {n ?? "All"}
            </Chip>
          ))}
        </Row>

        {/* A session filter can only be arrived at from Recent, never set here
            — there is no chip for "which session". So the row exists only when
            one is on, and its only job is to be visibly removable: a filter you
            cannot see is a filter you cannot undo. */}
        {sel.session !== null ? (
          <Row label="From one session">
            <Hint>Only the things that session asked</Hint>
            <Btn onClick={() => patch({ session: null })}>Clear</Btn>
          </Row>
        ) : null}
      </div>
    </>
  );
}
