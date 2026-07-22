"use client";

// A TERM'S PAGE — a definition, and nothing more designed than a definition.
//
// Like MarkView, this arranges existing pieces in the plainest honest order and
// invents no chrome: the entry header above already prints the term's NAME and
// its one-line summary (the entry's `meanings` and `sub`), so all this adds is
// the fuller definition underneath, in one Card, the way every other reference
// surface in this app reads. If the owner later wants a term page with a layout
// of its own it should come from that decision, not from this file quietly
// making one first.
//
// The copy is DRAFT and lives in src/data/terms.ts — see the warning there.

import { Card } from "@/components/ui";
import type { Term } from "@/data/terms";

export function TermView({ term }: { term: Term }) {
  return (
    <Card>
      <div className="space-y-2.5 text-[15px] leading-relaxed">
        {term.body.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </Card>
  );
}
