"use client";

// Gallery for ItemCard, in both arrangements and every state.
// Route: /dev/sky/item-card
//
// Real content, not lorem: these are actual items the redesign has to render,
// including the awkward ones (a three-character word, a long meaning, a counter
// whose glyph is a single kana).
//
// Cards are shown UNDER per-type section headers rather than in one flat grid,
// because that is how they appear in the real pages and it is what makes the
// missing type label on each card the right call. Those headers are stubs here;
// ItemSection (SAK-293) replaces them with computed counts and real gating.

import { useState } from "react";

import { ItemCard } from "@/sky/components/item-card";
import type { SkyItem } from "@/sky/lib/types";

/** How many pieces a pick commits you to: every distinct node in its own
 * prerequisite tree, counted once. Stands in for the graph (SAK-299). */
type Pick = SkyItem & { pieces: number };

/**
 * WORDS. Only the next few available ones are listed.
 *
 * Locked words are not shown at all, unlike locked kana rows and counters. With
 * roughly 12,500 of them a locked word carries no information: you would scroll
 * past thousands of greyed cards to reach the handful you can actually take.
 * Rows and counters are small, enumerable sets where seeing the shape of what is
 * coming is worth the space.
 *
 * Adding a word plants its whole prerequisite tree with it, which is exactly
 * what the piece count counts: the word, its kanji, and their radicals.
 */
const WORDS: Pick[] = [
  { id: "w-wed", kind: "word", glyph: "水曜日", english: "Wednesday", status: "wild", pieces: 8 },
  { id: "w-water", kind: "word", glyph: "お水", english: "water", status: "wild", pieces: 3 },
  { id: "w-forest", kind: "word", glyph: "森", english: "forest", status: "wild", pieces: 3 },
  { id: "w-open", kind: "word", glyph: "開ける", english: "to open something", status: "wild", pieces: 4 },
  { id: "w-uni", kind: "word", glyph: "大学", english: "university", status: "wild", pieces: 5 },
  { id: "w-time", kind: "word", glyph: "時間", english: "time", status: "wild", pieces: 6 },
];

/**
 * KANA. One card per row, named as a row.
 *
 * "ka ki ku ke ko" reads as a password. "K row" reads as a thing you could
 * decide to learn, and it is how the rows get referred to once you know any of
 * them. The ghost is the row's representative character.
 */
const KANA: Pick[] = [
  { id: "kana-a", kind: "kana", glyph: "あ", english: "Vowels", status: "mastered", pieces: 5 },
  { id: "kana-k", kind: "kana", glyph: "か", english: "K row", status: "learned", pieces: 5 },
  { id: "kana-s", kind: "kana", glyph: "さ", english: "S row", status: "wild", pieces: 5 },
  { id: "kana-t", kind: "kana", glyph: "た", english: "T row", status: "wild", pieces: 5 },
];

/** COUNTING. Small enough that showing the locked ones is worth the space. */
const COUNTING: Pick[] = [
  { id: "c-num", kind: "counter", glyph: "一", english: "1 through 10", status: "wild", pieces: 10 },
  { id: "c-thing", kind: "counter", glyph: "つ", english: "general things", status: "wild", pieces: 1 },
  { id: "c-flat", kind: "counter", glyph: "枚", english: "flat objects", status: "wild", pieces: 4 },
];

/**
 * VERB PAIRS, their own section now.
 *
 * These used to ride along with a headword, so picking "to open something"
 * silently dragged its partner in and a card's real cost depended on grammar the
 * learner could not see. As a section they get chosen deliberately, and the cost
 * shown is the honest one for taking both halves.
 */
const VERB_PAIRS: Pick[] = [
  { id: "vp-open", kind: "verbPair", glyph: "開ける", english: "to open", status: "wild", pieces: 5 },
  { id: "vp-start", kind: "verbPair", glyph: "始める", english: "to start", status: "wild", pieces: 5 },
  { id: "vp-enter", kind: "verbPair", glyph: "入れる", english: "to put in", status: "wild", pieces: 4 },
];

/** KEIGO, also its own section. A polite form is frequently written with
 * entirely different kanji from the plain one, so it carries its own cost. */
const KEIGO: Pick[] = [
  { id: "kg-eat", kind: "keigo", glyph: "召し上がる", english: "to eat, politely", status: "wild", pieces: 6 },
  { id: "kg-go", kind: "keigo", glyph: "いらっしゃる", english: "to go, politely", status: "wild", pieces: 1 },
  { id: "kg-say", kind: "keigo", glyph: "おっしゃる", english: "to say, politely", status: "wild", pieces: 1 },
];

const LIBRARY: SkyItem[] = [
  { id: "k-moku", kind: "kanji", glyph: "木", english: "tree", status: "mastered" },
  { id: "k-sui", kind: "kanji", glyph: "水", english: "water", status: "learned" },
  { id: "k-you", kind: "kanji", glyph: "曜", english: "day of the week", status: "planted" },
  { id: "k-shin", kind: "kanji", glyph: "森", english: "forest", status: "wild" },
  { id: "r-hane", kind: "radical", glyph: "羽", english: "feathers", status: "planted" },
  { id: "l-kana-ki", kind: "kana", glyph: "き", english: "ki", status: "learned" },
  { id: "l-wed", kind: "word", glyph: "水曜日", english: "Wednesday", status: "planted" },
  { id: "l-water", kind: "word", glyph: "お水", english: "water", status: "learned" },
  { id: "l-open", kind: "word", glyph: "開ける", english: "to open something", status: "wild" },
  { id: "l-thing", kind: "counter", glyph: "つ", english: "general things", status: "learned" },
  { id: "l-desu", kind: "grammar", glyph: "です", english: "polite statement", status: "wild" },
  { id: "l-keigo", kind: "keigo", glyph: "召し上がる", english: "to eat, politely", status: "wild" },
];

export default function ItemCardGalleryPage() {
  const [picked, setPicked] = useState<string[]>(["w-water"]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const nursery = (rows: Pick[]) => (
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
      <CountingRule />

      <Case
        title="Planetarium"
        note="English centred, nothing legible in Japanese, and the character only as a ghost in the corner. Along the bottom in the accent is what the pick actually commits you to, anchored to the card's edge so every cost in a row lands on one line. Every card here is one you can take right now: nothing locked, nothing greyed, nothing to scroll past. No type label, because the section header already says it. Click to select."
      >
        <Section
          title="Words"
          hint="The next few you can take. Adding one plants its whole prerequisite tree, which is what the count is counting."
        >
          {nursery(WORDS)}
        </Section>

        <Section
          title="Kana sounds"
          hint="One card per row, named as a row rather than as a string of romaji, because ka ki ku ke ko reads as a password rather than as a thing you could decide to learn."
        >
          {nursery(KANA)}
        </Section>

        <Section
          title="Counting"
          hint="Counters you can take now. Anything still waiting on a prerequisite is simply absent."
        >
          {nursery(COUNTING)}
        </Section>

        <Section
          title="Verb pairs"
          hint="Its own section rather than something bundled into a word. Picking a headword used to drag its partner in silently, which made a card's real cost depend on grammar you could not see. To open is 5: both halves, their one shared kanji, and its two radicals."
        >
          {nursery(VERB_PAIRS)}
        </Section>

        <Section
          title="Keigo"
          hint="Also its own section. A polite form is often written with entirely different kanji from the plain one, so it carries its own cost instead of inflating someone else's."
        >
          {nursery(KEIGO)}
        </Section>
      </Case>

      <Case
        title="Atlas"
        note="The character centred in plain text colour, with its meaning directly underneath in the accent. No ghost here: the glyph is already the hero, so a second copy behind it would only muddy the card."
      >
        <Grid>
          {LIBRARY.map((item) => (
            <ItemCard key={item.id} item={item} lead="glyph" />
          ))}
        </Grid>
      </Case>

      <Case
        title="Atlas, compact"
        note="For the grid at real scale, where the job is fitting a couple of hundred glyphs on screen at once."
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
          {LIBRARY.map((item) => (
            <ItemCard key={item.id} item={item} lead="glyph" density="compact" />
          ))}
        </div>
      </Case>



    </div>
  );
}

/** The counting rule, spelled out. It is the one thing on the Planetarium card that
 * is not self-evident, and getting it wrong is what would make the cart lie. */
function CountingRule() {
  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
        How a piece count is worked out
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        Every distinct node in the item&apos;s prerequisite tree, counted once. A
        piece reached by more than one parent is still one piece.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-panel p-3 text-[12px] leading-relaxed text-text-muted">
{`word A
├─ kanji A
│  ├─ radical A
│  └─ radical B
└─ kanji B
   ├─ radical A   ← already counted
   └─ radical C

word + kanji A + radical A + radical B + kanji B + radical C = 6`}
      </pre>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">
        The number is intrinsic to the item, so two cards stay comparable and a
        count never shifts under you as the cart changes. Deduplication{" "}
        <em>across</em> picks belongs to the cart total, where there is room to
        say why it dropped.
      </p>
    </div>
  );
}

function Intro() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm leading-relaxed text-text-muted">
        Two arrangements of one component.{" "}
        <strong className="text-text">Planetarium</strong> centres the English and
        keeps the Japanese only as a corner ghost, because you pick what to learn
        before you can read it.{" "}
        <strong className="text-text">Atlas</strong> centres the character with
        its meaning underneath in the accent, because there you arrive having met
        something in the wild.
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
    <section className="mt-9">
      <h2 className="text-[15px] font-semibold text-text">{title}</h2>
      <p className="mb-3 mt-1 max-w-[78ch] text-[13px] leading-relaxed text-text-muted">
        {note}
      </p>
      {children}
    </section>
  );
}

/** A per-type section header, the thing that makes a type label on each card
 * redundant. A stub for ItemSection (SAK-293). */
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 first:mt-0">
      <h3 className="border-b border-border/60 pb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
        {title}
      </h3>
      {hint ? (
        <p className="mb-2 mt-1.5 max-w-[76ch] text-[11.5px] leading-relaxed text-text-muted/80">
          {hint}
        </p>
      ) : (
        <div className="mb-2" />
      )}
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
