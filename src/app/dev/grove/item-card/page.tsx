"use client";

// Gallery for ItemCard, in both arrangements and every state.
// Route: /dev/grove/item-card
//
// Real content, not lorem: these are actual items the redesign has to render,
// including the awkward ones (a three-character word, a long English meaning, a
// counter whose glyph is a single kana).
//
// The cards are shown UNDER section headers here rather than in one flat grid,
// because that is how they appear in the real pages and it is what makes the
// missing type label on each card the right call.

import { useState } from "react";

import { ItemCard } from "@/grove/components/item-card";
import { STATUS, STATUS_ORDER } from "@/grove/lib/tokens";
import type { GroveItem, GroveKind } from "@/grove/lib/types";

const ITEMS: GroveItem[] = [
  { id: "k-moku", kind: "kanji", glyph: "木", english: "tree", reading: "き", status: "mastered" },
  { id: "k-sui", kind: "kanji", glyph: "水", english: "water", reading: "みず", status: "learned" },
  { id: "k-you", kind: "kanji", glyph: "曜", english: "day of the week", reading: "よう", status: "planted" },
  { id: "k-shin", kind: "kanji", glyph: "森", english: "forest", reading: "もり", status: "wild" },
  { id: "r-hane", kind: "radical", glyph: "羽", english: "feathers", status: "planted" },
  { id: "r-moku", kind: "radical", glyph: "木", english: "tree", status: "mastered" },
  { id: "kana-ki", kind: "kana", glyph: "き", english: "ki", status: "learned" },
  { id: "kana-shu", kind: "kana", glyph: "しゅ", english: "shu", status: "wild" },
  { id: "w-wed", kind: "word", glyph: "水曜日", english: "Wednesday", reading: "すいようび", status: "planted" },
  { id: "w-water", kind: "word", glyph: "お水", english: "water", reading: "おみず", status: "learned" },
  { id: "w-open", kind: "word", glyph: "開ける", english: "to open something", status: "wild" },
  { id: "c-thing", kind: "counter", glyph: "つ", english: "general things", status: "learned" },
  { id: "c-flat", kind: "counter", glyph: "枚", english: "flat objects", status: "planted" },
  { id: "g-desu", kind: "grammar", glyph: "です", english: "polite statement", status: "wild" },
];

const byKind = (k: GroveKind) => ITEMS.filter((i) => i.kind === k);

/**
 * What each pick really costs, in pieces, already deduplicated against the rest
 * of the cart. Stands in for the prerequisite graph until that lands (SAK-299).
 *
 * These are the real numbers from the cost model: "Wednesday" is the word plus
 * three kanji plus their radicals, and the two kanji that share a radical are
 * only charged once, so it is 7 rather than 9. "Forest" is cheap here because
 * the 木 radical is already covered by "tree".
 */
const COST: Record<string, { pieces: number; shared?: number }> = {
  "w-wed": { pieces: 7 },
  "w-water": { pieces: 3 },
  "w-open": { pieces: 4 },
  "k-shin": { pieces: 2, shared: 1 },
  "c-thing": { pieces: 1 },
  "c-flat": { pieces: 3 },
  "kana-ki": { pieces: 1 },
  "kana-shu": { pieces: 3 },
  "g-desu": { pieces: 1 },
};

export default function ItemCardGalleryPage() {
  const [picked, setPicked] = useState<string[]>(["k-sui"]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div>
      <Intro />

      <Case
        title="Nursery"
        note="English centred, nothing legible in Japanese. The character appears only as a ghost in the bottom-right corner, so the card carries Saku's texture without leaking the answer. Bottom-left is what the pick actually commits you to: Wednesday is the word plus three kanji plus their radicals, so it is 7 and not 1. No type label, because the section header above already says it. Click to select."
      >
        <Section title="Words">
          <Grid>
            {byKind("word").map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                pieces={COST[item.id]?.pieces ?? 1}
                shared={COST[item.id]?.shared}
                selected={picked.includes(item.id)}
                onClick={() => toggle(item.id)}
              />
            ))}
          </Grid>
        </Section>
        <Section title="Counting">
          <Grid>
            {byKind("counter").map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                pieces={COST[item.id]?.pieces ?? 1}
                shared={COST[item.id]?.shared}
                selected={picked.includes(item.id)}
                onClick={() => toggle(item.id)}
              />
            ))}
          </Grid>
        </Section>
        <Section title="Kana sounds">
          <Grid>
            {byKind("kana").map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                pieces={COST[item.id]?.pieces ?? 1}
                shared={COST[item.id]?.shared}
                selected={picked.includes(item.id)}
                onClick={() => toggle(item.id)}
              />
            ))}
          </Grid>
        </Section>
      </Case>

      <Case
        title="Library"
        note="The character centred with the English directly underneath. No ghost here: the glyph is already the hero, so a second copy behind it would only muddy the card. Status is carried by the glyph's own colour rather than a dot, so the grid scans by what you know without needing a key."
      >
        <Section title="Kanji">
          <Grid>
            {byKind("kanji").map((item) => (
              <ItemCard key={item.id} item={item} lead="glyph" />
            ))}
          </Grid>
        </Section>
        <Section title="Words">
          <Grid>
            {byKind("word").map((item) => (
              <ItemCard key={item.id} item={item} lead="glyph" />
            ))}
          </Grid>
        </Section>
      </Case>

      <Case
        title="Library, compact"
        note="For the grid at real scale, where the job is fitting a couple of hundred glyphs on screen at once."
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
          {ITEMS.map((item) => (
            <ItemCard key={item.id} item={item} lead="glyph" density="compact" />
          ))}
        </div>
      </Case>

      <Case
        title="The four statuses"
        note="Only visible in the Library arrangement, where knowing what you have met matters. Muted means you have never planted it; the strongest tone means mastered. Nothing needs a legend to read, which is why the coloured dot is gone."
      >
        <Grid>
          {STATUS_ORDER.map((status) => (
            <ItemCard
              key={status}
              item={{ ...ITEMS[1], id: status, status }}
              lead="glyph"
              badge={STATUS[status].label.split(",")[0]}
            />
          ))}
        </Grid>
      </Case>

      <Case
        title="Badges and disabled"
        note="The piece count is its own thing, bottom-left, because the Nursery always needs it. The top-right badge is left for whatever else a host wants: a miss count in Practice, a pair flag, a lock reason. The second card shows a pick made cheaper by parts already in the cart."
      >
        <Grid>
          <ItemCard item={ITEMS[10]} pieces={4} badge="pair" />
          <ItemCard item={ITEMS[3]} pieces={2} shared={1} badge="3x" />
          <ItemCard item={ITEMS[13]} pieces={1} disabled badge="locked" />
          <ItemCard item={ITEMS[8]} pieces={7} />
        </Grid>
      </Case>

      <Case
        title="Ghost off"
        note="Mid-quiz the character IS the answer, so the ghost would give it away. One prop turns it off and the card is otherwise unchanged."
      >
        <Grid>
          <ItemCard item={ITEMS[1]} ghost={false} pieces={3} />
          <ItemCard item={ITEMS[8]} ghost={false} pieces={7} />
          <ItemCard item={ITEMS[1]} pieces={3} />
          <ItemCard item={ITEMS[8]} pieces={7} />
        </Grid>
      </Case>
    </div>
  );
}

function Intro() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm leading-relaxed text-text-muted">
        Two arrangements of one component.{" "}
        <strong className="text-text">Nursery</strong> centres the English and
        keeps the Japanese only as a corner ghost, because you pick what to learn
        before you can read it.{" "}
        <strong className="text-text">Library</strong> centres the character with
        the English underneath, because there you arrive having met something in
        the wild.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        Neither shows the content type: the section a card sits in is already per
        type, so printing it again on every tile is the same word twenty times.
        Every colour is an existing Saku token, so switching theme or appearance
        carries all of this with it.
      </p>
    </div>
  );
}

function Case({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-semibold text-text">{title}</h2>
      <p className="mb-3 mt-1 max-w-[78ch] text-[13px] leading-relaxed text-text-muted">
        {note}
      </p>
      {children}
    </section>
  );
}

/** A per-type section header, the thing that makes a type label on each card
 * redundant. Mirrors what ItemSection will render for real. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <h3 className="mb-2 border-b border-border/60 pb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(126px,1fr))] gap-2">
      {children}
    </div>
  );
}
