// A cluster's header, in the Library entry page's shape.
//
// WHY THIS IS NOT `EntryHeader` ITSELF.
// ====================================
// It is the same shape on purpose — glyph slot left, title and sub line in the
// middle, same flex row, same gap, same title component, same muted sub — and a
// reader who has learned where to look on a kanji page does not have to learn it
// again here. What it is NOT is the same component, for two reasons that are
// both about this page rather than about taste:
//
//   1. `EntryHeader.glyph` IS ONE STRING. A cluster's slot is up to TWO patterns
//      stacked — 〜てから over 〜たあとで — and widening a prop that four other
//      pages depend on, so that this page can stack two lines, is the tail
//      wagging the dog.
//   2. THE OTHER HALF OF IT IS EMPTY HERE. `EntryHeader` exists as much for the
//      right-hand stack as for the left: standing chips, a sound line, an
//      onSpeak callback, and the "use client" that the speaker's onClick forces.
//      A cluster has no standing (it is a MAP — it never touches the scheduler),
//      no reading (it is a family, not a word) and nothing to pronounce. Passing
//      four undefineds to reach the flex row is not reuse.
//
// So: the same arrangement, spelled out, with the interactive half absent
// because a cluster has none of it. If the entry header's layout moves, this
// moves with it.

// WHEN THE SLOT IS THE TITLE, IT IS PRINTED ONCE.
// ==============================================
// The three map-only clusters have no members and so no patterns to stack; their
// slot is filled with their own title, which is already Japanese — は vs が. Laid
// out literally that gives a 34px "は vs が" beside a 22px "は vs が", the same
// six characters twice, two inches apart. So on those three the big line IS the
// heading: it takes the slot's position and the slot's size and carries the h1,
// and the middle column is the gloss alone. One title, in the place the eye
// already goes on every other entry page.

import { PageTitle } from "@/components/ui";

export function ClusterHeader({
  lines,
  title,
  sub,
}: {
  /** The glyph slot's lines, top to bottom. EMPTY MEANS NO SLOT, which is the
   * common case and a real answer rather than missing data: obligation, seems
   * and conditionals have no one shape shared by all their members, and there is
   * nothing honest to draw. See glyphLines in lib/grammar/cluster-view.ts. */
  lines: readonly string[];
  title: string;
  sub?: string;
}) {
  // The slot is the whole title, rather than a glyph standing beside one.
  const slotIsTitle = lines.length === 1 && lines[0] === title;

  return (
    <div className="flex flex-wrap items-start gap-5">
      {lines.length > 0 ? (
        // 34px is the entry page's size for a grammar pattern, and it is right
        // for ONE line. Two of them stacked at 34px make the slot taller than
        // the title block beside it, so the pair steps down — the slot is still
        // the biggest thing on the card without becoming the whole card.
        <div
          className={`flex-none font-kana leading-tight ${
            lines.length > 1 ? "text-[26px]" : "text-[34px]"
          }`}
        >
          {lines.map((line) =>
            slotIsTitle ? (
              <h1 key={line} className="m-0 text-[34px] font-semibold leading-tight">
                {line}
              </h1>
            ) : (
              <div key={line}>{line}</div>
            ),
          )}
        </div>
      ) : null}

      {/* The same floor the entry header carries, and for the same reason: the
          row wraps, and without a minimum the TITLE is what collapses. */}
      <div className="min-w-[16rem] flex-1">
        {slotIsTitle ? null : <PageTitle title={title} />}
        {sub ? (
          <p className={`text-[13px] text-text-muted ${slotIsTitle ? "mt-2.5" : "mb-3"}`}>
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  );
}
