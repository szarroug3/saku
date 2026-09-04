"use client";

// Gallery for ItemSection. Route: /dev/sky/item-section
//
// Shown as a whole Planetarium rather than as isolated headers, because the point of
// this component is what a page of them reads like end to end: five sections,
// one per type, each stating how much it is showing and what it is waiting for.

import { useState } from "react";

import { ItemCard } from "@/sky/components/item-card";
import { ItemSection } from "@/sky/components/item-section";
import type { SkyItem } from "@/sky/lib/types";

type Pick = SkyItem & { pieces: number };

const WORDS: Pick[] = [
  { id: "w-wed", kind: "word", glyph: "水曜日", english: "Wednesday", standing: "not-seen", pieces: 8 },
  { id: "w-water", kind: "word", glyph: "お水", english: "water", standing: "not-seen", pieces: 3 },
  { id: "w-forest", kind: "word", glyph: "森", english: "forest", standing: "not-seen", pieces: 3 },
  { id: "w-open", kind: "word", glyph: "開ける", english: "to open something", standing: "not-seen", pieces: 4 },
  { id: "w-uni", kind: "word", glyph: "大学", english: "university", standing: "not-seen", pieces: 5 },
  { id: "w-time", kind: "word", glyph: "時間", english: "time", standing: "not-seen", pieces: 6 },
];

const KANA: Pick[] = [
  { id: "kana-s", kind: "kana", glyph: "さ", english: "S row", standing: "not-seen", pieces: 5 },
  { id: "kana-t", kind: "kana", glyph: "た", english: "T row", standing: "not-seen", pieces: 5 },
  { id: "kana-n", kind: "kana", glyph: "な", english: "N row", standing: "not-seen", pieces: 5 },
];

const COUNTING: Pick[] = [
  { id: "c-num", kind: "counter", glyph: "一", english: "1 through 10", standing: "not-seen", pieces: 10 },
  { id: "c-thing", kind: "counter", glyph: "つ", english: "general things", standing: "not-seen", pieces: 1 },
  { id: "c-flat", kind: "counter", glyph: "枚", english: "flat objects", standing: "not-seen", pieces: 4 },
];

const VERB_PAIRS: Pick[] = [
  { id: "vp-open", kind: "verbPair", glyph: "開ける", english: "to open", standing: "not-seen", pieces: 5 },
  { id: "vp-start", kind: "verbPair", glyph: "始める", english: "to start", standing: "not-seen", pieces: 5 },
];

export default function ItemSectionGalleryPage() {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const cards = (rows: Pick[]) => (
    <Grid>
      {rows.map((it) => (
        <ItemCard
          key={it.id}
          item={it}
          pieces={it.pieces}
          selected={picked.includes(it.id)}
          onClick={() => toggle(it.id)}
        />
      ))}
    </Grid>
  );

  return (
    <div>
      <Intro />

      <Case
        title="A Planetarium, end to end"
        note="What the component is really for. Five sections, one per type, each saying how much it is showing and what it is waiting for. The headers are the only thing naming a type, since the cards deliberately do not."
      >
        <div className="rounded-xl border border-border bg-card p-5">
          <ItemSection
            title="Words"
            hint="The next few you can take. Adding one plants its whole prerequisite tree, which is what each count is counting."
            shown={WORDS.length}
            total={12500}
          >
            {cards(WORDS)}
          </ItemSection>

          <ItemSection
            title="Kana sounds"
            hint="One card per row, named as a row rather than as a string of romaji."
            shown={KANA.length}
            total={40}
          >
            {cards(KANA)}
          </ItemSection>

          <ItemSection title="Counting" shown={COUNTING.length} total={42}>
            {cards(COUNTING)}
          </ItemSection>

          <ItemSection
            title="Verb pairs"
            hint="Its own section rather than something bundled into a word, so each pick carries its own honest cost."
            shown={VERB_PAIRS.length}
            total={310}
          >
            {cards(VERB_PAIRS)}
          </ItemSection>

          <ItemSection
            title="Keigo"
            gate={{
              requirement:
                "Polite forms lean on words you already know, so this opens once you have learned 40.",
              progress: { have: 27, need: 40, unit: "words learned" },
            }}
          />

          <ItemSection
            title="Grammar"
            gate={{
              requirement:
                "Grammar needs a bank of words to sit on. Picking words does not open it early, because the example sentences are meaningless if you only bought them.",
              progress: { have: 27, need: 40, unit: "words learned" },
            }}
          />
        </div>
      </Case>

      <Case
        title="The count is a claim, so it says what it is counting"
        note="Left: capped, where far more exists than is shown. Right: complete, where the number really is all of them. Without the distinction, six words reads as though six words exist."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Panel>
            <ItemSection title="Words" shown={6} total={12500}>
              {cards(WORDS)}
            </ItemSection>
          </Panel>
          <Panel>
            <ItemSection title="Counting" shown={3} total={3}>
              {cards(COUNTING)}
            </ItemSection>
          </Panel>
        </div>
      </Case>

      <Case
        title="Gated, and empty"
        note="A gate words its requirement and draws how close you are, rather than leaving you to infer it from an absence. Empty is a real state too: a filter that matched nothing should say so instead of rendering a heading over a void."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Panel>
            <ItemSection
              title="Grammar"
              gate={{
                requirement:
                  "Grammar needs a bank of words to sit on, so it opens once you have learned 40.",
                progress: { have: 27, need: 40, unit: "words learned" },
              }}
            />
          </Panel>
          <Panel>
            <ItemSection
              title="Keigo"
              gate={{ requirement: "Opens once you have learned some everyday verbs." }}
            />
          </Panel>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Panel>
            <ItemSection title="Words" shown={0} total={12500}>
              <Empty>Nothing matches that. Try widening the filter.</Empty>
            </ItemSection>
          </Panel>
          <Panel>
            <ItemSection title="Counting" hint="A section with no hint, count or gate still works.">
              {cards(COUNTING.slice(0, 2))}
            </ItemSection>
          </Panel>
        </div>
      </Case>
    </div>
  );
}

function Intro() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm leading-relaxed text-text-muted">
        The group an ItemCard sits inside. It ended up carrying more than a
        heading, because three card decisions pushed work down into it: the card
        has <strong className="text-text">no type label</strong>, so this header
        is the only thing naming a type;{" "}
        <strong className="text-text">no locked state</strong>, so a section
        answers why something is not here yet; and{" "}
        <strong className="text-text">no status</strong>, so in the Atlas that
        lives in the furniture beside it.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        Which puts the honesty of the Planetarium mostly here. A section that quietly
        shows six of twelve thousand words, or hides a gate without saying what it
        waits for, is the failure this component exists to prevent.
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
    <section className="mt-9">
      <h2 className="text-[15px] font-semibold text-text">{title}</h2>
      <p className="mb-3 mt-1 max-w-[78ch] text-[13px] leading-relaxed text-text-muted">
        {note}
      </p>
      {children}
    </section>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-4">{children}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-text-muted">
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
