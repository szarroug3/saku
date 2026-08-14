"use client";

// DEV-ONLY, used only by /dev/library. One shelf, rendered TWO ways so the author
// can judge density and look side by side: the shipped <Shelf>, then the
// DeboxedShelf prototype it was ported from. The de-box has since landed on the
// live <Shelf>, so the two now read the same; this page stays as the reference
// the port was judged against.
//
// A client wrapper is needed because both sides take live toggle handlers, and a
// server component cannot pass functions to a client child. It also lets the two
// sides SHARE one selection, so toggling a tile on one side lights the same tile
// on the other — handy for eyeballing that they render the same set.

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
import type { EntryId } from "@/types";

export function DevShelfCompare({
  kind,
  sections,
}: {
  kind: Kind;
  sections: readonly ShelfSection[];
}) {
  const [selected, setSelected] = useState<Selection>(EMPTY_SELECTION);

  const onToggleEntry = (id: EntryId) =>
    setSelected((s) => toggleEntryIn(s, id));
  const onToggleSection = (ids: readonly EntryId[]) =>
    setSelected((s) => toggleSectionIn(s, ids));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <VariantLabel>Current — shipped &lt;Shelf&gt;</VariantLabel>
        <Shelf
          kind={kind}
          sections={sections}
          selected={selected}
          onToggleEntry={onToggleEntry}
          onToggleSection={onToggleSection}
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
