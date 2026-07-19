"use client";

// "The part that changes" — every form of a word, drawn as a FAN off the
// dictionary form.
//
// THIS IS A CORRECTION, AND IT IS THE POINT OF THE CARD
// ====================================================
// The obvious way to draw conjugation is a chain: 間違える → 間違えます →
// 間違えました, each arrow feeding the next. It is compact, it looks like a
// derivation, and it is FALSE. `formsOfWord` returns GROUPS, and every form in
// every group is built from the dictionary form INDEPENDENTLY — 間違えました is
// not made out of 間違えます, it is made out of 間違える. A chain tells the reader
// that to reach the polite past they must first pass through the polite, which
// is a rule they will then try to apply, and it will not work.
//
// So the dictionary form is drawn ONCE, on the left, as the thing everything
// comes out of, and every other form hangs off a single vertical spine attached
// to it. Structurally there is no edge between any two branches: nothing points
// from one form to another, each row's only connector runs back to the spine,
// and the spine's only anchor is the root. There is no order to read down the
// column because no two rows are joined. The group headings are ANSWERS TO
// QUESTIONS ("plain and polite", "past and negative"), not stages.
//
// WHAT THE COLOUR MEANS, AND ALL IT MEANS
// =======================================
// In every branch the leading run shared with the dictionary form is set in the
// normal ink and the rest is accented — the same accent the recipe card uses for
// the fixed part of a pattern, and the same claim the Library's "built from"
// makes about okurigana in words. It says: the word stayed, this is what moved.
// The split is a prefix scan against the dictionary form (lib/word-fan.ts), not
// a re-derivation of the conjugation rules.
//
// WHAT THIS CARD DOES NOT DO
// ==========================
// It does not teach WHEN to reach for which form. That is grammar's job — one
// pattern fact covers every verb at once, which is why there is no conjugated-
// form fact in the model at all (see word-forms-view.tsx) — and a lesson meeting
// 間違える for the first time saying "use ば for a general condition" would be
// teaching the grammar track's material on the vocabulary track's screen. The
// card says this is the part that changes, and stops.
//
// NO SPEAKERS ON THE BRANCHES either, though the Library's forms table has them.
// The word's own speaker is in the header two inches above, and nineteen more
// would make a card whose subject is a SHAPE look like a card about sound.
//
// ABSENT for two thirds of the vocabulary, which is nouns. The caller drops the
// component; an empty "the part that changes" over a noun would read as data
// that failed to load.

import { LessonPanel } from "@/components/lesson/lesson-panel";
import { stemSplit } from "@/lib/word-fan";
import type { BuiltGroup } from "@/lib/word-forms";

/** One branch: the form, with the changed part accented. */
function Branch({ dictionary, value }: { dictionary: string; value: string }) {
  const { stem, tail } = stemSplit(dictionary, value);
  return (
    <span className="font-kana text-[15px]">
      <span className="text-text">{stem}</span>
      <span className="text-accent">{tail}</span>
    </span>
  );
}

export function WordFormFan({
  dictionary,
  groups,
}: {
  /** The root — the form every branch is built from, printed once. */
  dictionary: string;
  groups: readonly BuiltGroup[];
}) {
  // The dictionary form IS the root, so it does not also hang off the spine as
  // a branch of itself. Dropping it here rather than in `formsOfWord` keeps the
  // engine's grouping intact for the Library, which prints it as a row like any
  // other because it has no root to print it as.
  const branches = groups
    .map((g) => ({ ...g, rows: g.rows.filter((r) => r.form !== "dictionary") }))
    .filter((g) => g.rows.length > 0);
  if (!branches.length) return null;

  return (
    <LessonPanel title="The part that changes">
      {/* THE ROOT AND THE SPINE. `items-stretch` so the spine's border runs the
          full height of the branch column whatever it holds; the root is
          vertically centred against it, which is what makes the arrangement
          read as one thing radiating rather than as a heading above a list.
          Below 640px the row stacks and the spine becomes a top border, which
          still attaches every branch to the root above it and to nothing else. */}
      <div className="flex items-stretch gap-4 max-[640px]:flex-col max-[640px]:gap-2">
        <div className="flex flex-none items-center max-[640px]:justify-start">
          <div>
            <p className="font-kana text-[26px] leading-none text-text">
              {dictionary}
            </p>
            <p className="mt-1.5 text-[11px] text-text-muted">the word itself</p>
          </div>
        </div>

        {/* THE SPINE. One border, shared by every branch, so the eye can see
            that they all come off the same place. It is on the CONTAINER, not
            between the rows: a border between two rows would be an edge joining
            them, which is the exact reading this card exists to prevent. */}
        <div className="min-w-0 flex-1 border-l border-border pl-4 max-[640px]:border-l-0 max-[640px]:border-t max-[640px]:pl-0 max-[640px]:pt-2.5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 max-[700px]:grid-cols-1">
            {branches.map((g) => (
              <div key={g.title}>
                <p className="mb-1 text-[11px] text-text-muted">{g.title}</p>
                <div className="flex flex-col gap-0.5">
                  {g.rows.map((r) => (
                    <div key={r.form} className="flex items-baseline gap-2">
                      {/* The tick is this branch's OWN connector back to the
                          spine, drawn per row and pointing left. Nothing in this
                          card points from one form to the next. */}
                      <span
                        aria-hidden
                        className="select-none text-[11px] leading-none text-text-muted/60"
                      >
                        &ndash;
                      </span>
                      <span className="w-[104px] flex-none text-[11px] text-text-muted">
                        {r.label}
                      </span>
                      <Branch dictionary={dictionary} value={r.value} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-auto pt-3 text-[11px] leading-relaxed text-text-muted/80">
        Every one of these is built from{" "}
        <span className="font-kana text-text">{dictionary}</span> directly, not
        from the form above it. The coloured part is the part that changes.
      </p>
    </LessonPanel>
  );
}
