"use client";

// Gallery for ItemCard — the ghost-glyph-plus-English treatment, in every state
// and both lead directions. Route: /dev/grove/item-card
//
// Real content, not lorem: these are actual items the redesign has to render,
// including the awkward ones (a three-character word, a long English meaning, a
// counter whose glyph is one kana).

import { useState } from "react";

import { ItemCard } from "@/grove/components/item-card";
import { STATUS, STATUS_ORDER } from "@/grove/lib/tokens";
import type { GroveItem } from "@/grove/lib/types";

const ITEMS: GroveItem[] = [
  { id: "k-moku", kind: "kanji", glyph: "木", english: "tree", reading: "き", status: "mastered" },
  { id: "k-sui", kind: "kanji", glyph: "水", english: "water", reading: "みず", status: "learned" },
  { id: "k-you", kind: "kanji", glyph: "曜", english: "day of the week", reading: "よう", status: "planted" },
  { id: "k-shin", kind: "kanji", glyph: "森", english: "forest", reading: "もり", status: "wild" },
  { id: "r-hane", kind: "radical", glyph: "羽", english: "feathers", status: "planted" },
  { id: "kana-ki", kind: "kana", glyph: "き", english: "ki", status: "learned" },
  { id: "w-wed", kind: "word", glyph: "水曜日", english: "Wednesday", reading: "すいようび", status: "planted" },
  { id: "w-water", kind: "word", glyph: "お水", english: "water", reading: "おみず", status: "learned" },
  { id: "c-thing", kind: "counter", glyph: "つ", english: "general things", status: "learned" },
  { id: "g-desu", kind: "grammar", glyph: "です", english: "polite statement", status: "wild" },
];

export default function ItemCardGalleryPage() {
  const [selected, setSelected] = useState<string | null>("k-sui");

  return (
    <div>
      <Intro />

      <Case
        title="Nursery — leads with English"
        note="What the picker shows. The meaning is the foreground because you choose what to learn before you can read it; the glyph is present only as texture behind. Click to select."
      >
        <Grid>
          {ITEMS.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              lead="english"
              selected={selected === item.id}
              onClick={() => setSelected(selected === item.id ? null : item.id)}
            />
          ))}
        </Grid>
      </Case>

      <Case
        title="Library — leads with the glyph"
        note="Same component, same ghost, one prop flipped. The character is the foreground and the meaning drops to a caption, because here you arrive having met something in the wild."
      >
        <Grid>
          {ITEMS.map((item) => (
            <ItemCard key={item.id} item={item} lead="glyph" />
          ))}
        </Grid>
      </Case>

      <Case
        title="Compact density"
        note="For the Library grid at scale, where the job is fitting a couple of hundred glyphs on screen at once."
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1.5">
          {ITEMS.map((item) => (
            <ItemCard key={item.id} item={item} lead="glyph" density="compact" />
          ))}
        </div>
      </Case>

      <Case
        title="The four statuses"
        note="One vocabulary shared by every Grove surface, so a colour means the same thing in the Garden, the Library and Practice. The dot also carries a title attribute, since colour alone should never be the only signal."
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
        note="The corner slot carries whatever the host needs: a piece cost in the Nursery, a miss count in Practice, a pair flag. Disabled is for a locked pick, which stays visible with its reason rather than being hidden."
      >
        <Grid>
          <ItemCard item={ITEMS[6]} badge="7 pieces" />
          <ItemCard item={ITEMS[0]} badge="3x" />
          <ItemCard item={ITEMS[3]} badge="pair" />
          <ItemCard item={ITEMS[9]} disabled badge="locked" />
        </Grid>
      </Case>

      <Case
        title="Ghost off"
        note="Mid-quiz the character IS the answer, so the ghost would give it away. One prop turns it off; everything else about the card is unchanged."
      >
        <Grid>
          <ItemCard item={ITEMS[1]} ghost={false} />
          <ItemCard item={ITEMS[6]} ghost={false} />
          <ItemCard item={ITEMS[1]} />
          <ItemCard item={ITEMS[6]} />
        </Grid>
      </Case>
    </div>
  );
}

function Intro() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm leading-relaxed text-text-muted">
        The big Japanese glyph stays as a{" "}
        <strong className="text-text">ghost in the background</strong> and the
        English sits <strong className="text-text">in front of it</strong>. Both,
        layered, not one or the other. That is what lets the Nursery be
        English-only while still looking like Saku: a ghosted glyph reads as
        texture rather than as information, so it gives the card its identity
        without leaking the answer.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        Every colour below is an existing Saku token, so switching theme or
        appearance in settings should carry all of this with it.
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
      <p className="mb-3 mt-1 max-w-[76ch] text-[13px] leading-relaxed text-text-muted">
        {note}
      </p>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2">
      {children}
    </div>
  );
}
