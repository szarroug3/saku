"use client";

// DEV-ONLY, used only by /dev/library. One shelf, rendered TWO ways so the author
// can judge density and look before we touch the live shelf: the CURRENT boxed
// version (the shipped <Shelf>, each section wrapped in a <Card>), then the
// REDESIGNED de-boxed version (DeboxedShelf, sections straight on the mesh).
//
// A client wrapper is needed because both sides take live toggle handlers, and a
// server component cannot pass functions to a client child. It also lets the two
// sides SHARE one selection, so toggling a tile on the boxed side lights the same
// tile on the de-boxed side — handy for eyeballing that they render the same set.
//
// STANDINGS ARE COMPUTED AGAINST EMPTY HISTORY. This is a visual comparison, not
// a signed-in page: facts = {} and claims = {}, so every entry reads "not known".
// The standing math is the real entryStanding path the live shelf uses (see
// DeboxedShelf and shelves.tsx); only its input history is stubbed empty.

import { useState } from "react";

import { DeboxedShelf } from "@/components/library/dev-deboxed-shelf";
import { Shelf } from "@/components/library/shelves";
import type { Kind } from "@/lib/library/entries";
import {
  EMPTY_SELECTION,
  toggleEntry as toggleEntryIn,
  toggleSection as toggleSectionIn,
  type Selection,
} from "@/lib/library/selection";
import type { ShelfSection } from "@/lib/library/shelf-view";
import type { EntryId, FactAggregate } from "@/types";

// Empty history — see the file header. Module scope so identity is stable.
const NO_FACTS: Record<string, FactAggregate> = {};
const NO_CLAIMS: Record<string, number> = {};

export function DevShelfCompare({
  kind,
  sections,
}: {
  kind: Kind;
  sections: readonly ShelfSection[];
}) {
  const [selected, setSelected] = useState<Selection>(EMPTY_SELECTION);
  const [now] = useState(() => Date.now());

  const onToggleEntry = (id: EntryId) =>
    setSelected((s) => toggleEntryIn(s, id));
  const onToggleSection = (ids: readonly EntryId[]) =>
    setSelected((s) => toggleSectionIn(s, ids));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <VariantLabel>Current — boxed (shipped)</VariantLabel>
        <Shelf
          kind={kind}
          sections={sections}
          selected={selected}
          onToggleEntry={onToggleEntry}
          onToggleSection={onToggleSection}
          facts={NO_FACTS}
          claims={NO_CLAIMS}
          metric="firstTry"
          now={now}
          voice=""
        />
      </div>
      <div>
        <VariantLabel>Redesigned — de-boxed</VariantLabel>
        <DeboxedShelf
          kind={kind}
          sections={sections}
          selected={selected}
          onToggleEntry={onToggleEntry}
          onToggleSection={onToggleSection}
          facts={NO_FACTS}
          claims={NO_CLAIMS}
          metric="firstTry"
          now={now}
          voice=""
        />
      </div>
    </div>
  );
}

function VariantLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-accent/80">
      {children}
    </div>
  );
}
