"use client";

// DEV gallery for the Library shelf redesign — a few representative shelves, each
// rendered TWO ways stacked with labelled headings: the CURRENT boxed version
// (the shipped <Shelf>, one <Card> per section) and the REDESIGNED de-boxed
// version (sections straight on the mesh, hairline borders + whitespace only).
// The point is to judge the density and look before we touch the live shelf.
// Not shipped UI. Route: /dev/library (gated to non-production by
// src/app/dev/layout.tsx).
//
// THE SHELVES SHOWN, picked for their different section shapes:
//   • Kana    — dense small tile grid.
//   • Kanji   — dense tile grid too, but CAPPED to the first 2 sections (~200
//               tiles) so the page stays light: the real kanji shelf is 2,136
//               tiles / 22 sections, which nobody scrolls and which would make
//               this comparison page heavy. See KANJI_SECTIONS below.
//   • Grammar — renders as ROWS not tiles (a pattern is a phrase, not a glyph),
//               so it shows the de-boxed treatment of a row section.
//
// Data comes from the same source the live page uses — shelfSections(kind,
// "everyday") in components/library/shelves.tsx — so the sections and entries are
// exactly what /library builds. Standings are computed against EMPTY history (see
// DevShelfCompare), so every tile reads "not known"; this is a visual comparison.

import { DevShelfCompare } from "@/components/library/dev-shelf-compare";
import { shelfSections } from "@/components/library/shelves";
import { KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT, KANJI_SUBJECT } from "@/lib/library/library-index";

const KANA_SECTIONS = shelfSections(KANA_SUBJECT, "everyday");
// CAP: the first 2 sections of the 22-section kanji shelf (~200 tiles), so this
// dev page never renders all 2,136 kanji tiles.
const KANJI_SECTIONS = shelfSections(KANJI_SUBJECT, "everyday").slice(0, 2);
const GRAMMAR_SECTIONS = shelfSections(GRAMMAR_SUBJECT, "everyday");

export default function LibraryDevPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-text">
      <h1 className="text-2xl font-semibold">Library — shelf redesign</h1>
      <p className="mt-1 text-sm text-text-muted">
        A few shelves rendered two ways — the current boxed shelf, then the
        de-boxed redesign — so we can judge the density before touching the live
        shelf. Tiles are the shipped EntryTile, unchanged; separation in the
        redesign is hairline borders + whitespace only, no box, no shadow.
        Standings show against empty history (everything reads &ldquo;not
        known&rdquo;) — this is a visual comparison, not a signed-in page. The
        kanji shelf is capped to its first two sections so the page stays light.
      </p>

      <Shelf title="Kana" note="A dense small tile grid.">
        <DevShelfCompare kind={KANA_SUBJECT} sections={KANA_SECTIONS} />
      </Shelf>

      <Shelf
        title="Kanji"
        note="Dense tiles, capped to the first two sections (~200 of 2,136)."
      >
        <DevShelfCompare kind={KANJI_SUBJECT} sections={KANJI_SECTIONS} />
      </Shelf>

      <Shelf title="Grammar" note="Renders as rows, not tiles — a pattern is a phrase.">
        <DevShelfCompare kind={GRAMMAR_SUBJECT} sections={GRAMMAR_SECTIONS} />
      </Shelf>
    </main>
  );
}

function Shelf({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-base font-medium text-text">{title}</h2>
      <p className="mb-5 mt-0.5 text-sm text-text-muted">{note}</p>
      {children}
    </section>
  );
}
