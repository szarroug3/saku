"use client";

// The shelves — what the Library is when you haven't typed anything.
//
// A shelf is a Kind, cut into sections that the DATA already has. That
// qualifier is the whole design of this file: the kana shelf's sections are the
// gojūon rows because kana genuinely comes in rows, and the kanji shelf's are
// jōyō grades because that is what KANJIDIC2 records. The words shelf has no
// sections, because JMdict does not give it any and inventing some ("common
// words"?) would be the newspaper band pretending to be a curriculum. So the
// words shelf says what it is — 8,045 of them, find one by searching — instead
// of pretending to be browsable. A shelf you cannot honestly cut is a search
// box, and saying so is cheaper than a fake hierarchy.
//
// SECTIONS ARE SELECTABLE, and that is what makes "mark as known" hierarchical
// without a hierarchy feature. The user's own words: "i know all hiragana, i
// know all hiragana vowels, i know all hiragana k-rows, etc." Those are three
// slices of the same shelf at three depths. Clicking a section header points the
// bar at that section; clicking it again points it back at the shelf. There is
// no third concept — the bar was always going to take a Slice, and a section
// header is just another way of naming one.

import { KANJI, KANJI_SUBJECT } from "@/data/kanji";
import { KANA_SUBJECT, mnemonicFor, SETS } from "@/data/characters";
import { VOCAB_SUBJECT } from "@/data/vocab";
import { EntryTile } from "@/components/library/entry-tile";
import { Card, Hint, Lbl } from "@/components/ui";
import type { Claims } from "@/lib/claims";
import { entryForGlyph, libEntry, type Kind, type LibEntry } from "@/lib/library/entries";
import { entryStanding } from "@/lib/library/standing";
import { factsOf } from "@/lib/facts";
import type { AccuracyMetric, EntryId, FactAggregate } from "@/types";

/** One cut of a shelf: a name and the entries under it. */
export interface ShelfSection {
  readonly id: string;
  readonly label: string;
  readonly entries: readonly LibEntry[];
}

/** How many word tiles the words shelf shows before it tells you to search.
 *
 * 120 is a display cap, not a filter: `Shelf` still puts all 8,045 in the slice,
 * so "I know these" and Drill act on the shelf and not on the first screenful.
 * The number the bar shows and the number of tiles on the page are ALLOWED to
 * differ, and this is the one place they do — which is why the shelf says so. */
const WORD_TILES = 120;

/** The sections of a shelf, cut the way the data is already cut. */
export function shelfSections(kind: Kind): ShelfSection[] {
  switch (kind) {
    case KANA_SUBJECT:
      return SETS.flatMap((set) =>
        set.sections.map((section) => ({
          id: `${set.id}-${section.id}`,
          label: `${set.label} · ${section.label}`,
          entries: section.chars
            .map((ch) => entryForGlyph(KANA_SUBJECT, ch.c))
            .flatMap((id) => resolve(id)),
        })),
      );
    case KANJI_SUBJECT: {
      // 1–6 and 8. THERE IS NO GRADE 7 (see KanjiRow.grade) — this reads the
      // grades that are actually present rather than iterating a range, which
      // is how a screen invents one.
      const grades = [...new Set(KANJI.map((k) => k.grade))].sort((a, b) => a - b);
      return grades.map((g) => ({
        id: `grade-${g}`,
        label: `Jōyō grade ${g}`,
        entries: KANJI.filter((k) => k.grade === g).flatMap((k) =>
          resolve(entryForGlyph(KANJI_SUBJECT, k.c)),
        ),
      }));
    }
    case VOCAB_SUBJECT:
      return [];
  }
}

function resolve(id: EntryId | null): LibEntry[] {
  if (!id) return [];
  const e = libEntry(id);
  return e ? [e] : [];
}

export function Shelf({
  kind,
  sections,
  allEntries,
  selected,
  onSelect,
  facts,
  claims,
  metric,
  now,
  voice,
}: {
  kind: Kind;
  sections: readonly ShelfSection[];
  /** Every entry on the shelf, for the words case where sections are empty. */
  allEntries: readonly LibEntry[];
  selected: string | null;
  onSelect(id: string | null): void;
  facts: Record<EntryId | string, FactAggregate>;
  claims: Claims;
  metric: AccuracyMetric;
  now: number;
  voice: string;
}) {
  const tile = (entry: LibEntry) => (
    <EntryTile
      key={entry.id}
      entry={entry}
      voice={voice}
      mnemonic={mnemonicOf(kind, entry)}
      standing={entryStanding(factsOf(entry.id), facts, claims, metric, now)}
    />
  );

  if (kind === VOCAB_SUBJECT) {
    return (
      <Card>
        <Lbl>Everyday words</Lbl>
        <p className="mb-3">
          <Hint>
            {allEntries.length.toLocaleString()} of them, and no honest way to
            shelve them — JMdict doesn&rsquo;t sort words into sections, and the
            one number that looks like it could (the newspaper band) puts 安保
            above 食べる. So: the first {WORD_TILES} are below, and the rest are
            a search away. The bar still points at all{" "}
            {allEntries.length.toLocaleString()}.
          </Hint>
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
          {allEntries.slice(0, WORD_TILES).map(tile)}
        </div>
      </Card>
    );
  }

  return (
    <>
      {kind === KANA_SUBJECT ? <TofuguCard /> : null}
      {sections.map((section) => {
        const on = selected === section.id;
        return (
          <Card key={section.id}>
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelect(on ? null : section.id)}
                className={`cursor-pointer rounded-(--radius) border px-2 py-0.5 text-[13px] font-semibold uppercase tracking-[0.04em] ${
                  on
                    ? "border-accent bg-accent-bg text-accent"
                    : "border-transparent text-text-muted hover:border-border"
                }`}
              >
                {section.label}
              </button>
              <span className="text-xs text-text-muted">
                {section.entries.length}
              </span>
              {on ? (
                <Hint>— the bar is pointing at this row</Hint>
              ) : null}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
              {section.entries.map(tile)}
            </div>
          </Card>
        );
      })}
    </>
  );
}

/** The kana chart's outbound links, carried over from /chart when it became this
 * shelf. They are the one thing on that page that was not a tile, and they are
 * the reason a beginner opened it — the app teaches you to recognise kana and
 * Tofugu teaches you to learn them, which is a different job this app has never
 * claimed to do. */
function TofuguCard() {
  return (
    <Card>
      <p className="mb-1.5 text-[13px]">
        <span className="text-text-muted">Tofugu guides:</span>
        <TofuguLink href="https://www.tofugu.com/japanese/learn-hiragana/">
          Hiragana ↗
        </TofuguLink>{" "}
        ·
        <TofuguLink href="https://www.tofugu.com/japanese/learn-katakana/">
          Katakana ↗
        </TofuguLink>
      </p>
      <p className="text-[13px]">
        <span className="text-text-muted">Charts:</span>
        <TofuguLink href="https://files.tofugu.com/articles/japanese/2014-06-30-learn-hiragana/hiragana-chart-by-tofugu.jpg">
          Hiragana chart ↗
        </TofuguLink>{" "}
        ·
        <TofuguLink href="https://files.tofugu.com/articles/japanese/2016-03-07-hiragana-mnemonics-chart/hiragana-mnemonic-chart-by-tofugu.jpg">
          Hiragana mnemonics ↗
        </TofuguLink>{" "}
        ·
        <TofuguLink href="https://files.tofugu.com/articles/japanese/2014-09-03-learn-katakana/tofugu-katakana-chart.jpg">
          Katakana chart ↗
        </TofuguLink>{" "}
        ·
        <TofuguLink href="https://files.tofugu.com/articles/japanese/2014-09-03-learn-katakana/tofugu-katakana-mnemonic-chart.jpg">
          Katakana mnemonics ↗
        </TofuguLink>
      </p>
    </Card>
  );
}

function TofuguLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="ml-2.5 whitespace-nowrap text-xs text-accent no-underline"
    >
      {children}
    </a>
  );
}

/** char → its chart mnemonic, built once from the same walk that builds
 * CHAR_INDEX.
 *
 * `mnemonicFor` wants a KanaChar and its SECTION LABEL, neither of which
 * survives into a LibEntry — and reconstructing the label by splitting
 * `entry.sub` back apart would be a round trip through a display string, which
 * is precisely the kind of join that rots the first time someone rewords a
 * heading. Walking SETS here costs one pass over 214 characters at module load
 * and cannot be wrong. */
const KANA_MNEMONIC: ReadonlyMap<string, string> = new Map(
  SETS.flatMap((set) =>
    set.sections.flatMap((section) =>
      section.chars.map(
        (ch) => [ch.c, mnemonicFor(ch, section.label)] as const,
      ),
    ),
  ).filter(([, mn]) => !!mn),
);

function mnemonicOf(kind: Kind, entry: LibEntry): string | undefined {
  if (kind !== KANA_SUBJECT) return undefined;
  const mn = KANA_MNEMONIC.get(entry.glyph);
  return mn ? `${mn} · click the reading to hear it` : undefined;
}
