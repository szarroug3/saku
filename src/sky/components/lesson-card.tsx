// The card under the lesson sky: the selected star, taught. Tracked as
// SAK-310 and SAK-297.
//
// Eyebrow naming what kind of thing this is, the glyph large with its
// reading, the meanings, then what it is made of and what it is part of as
// buttons that select those stars, and the longer material (readings, how
// it is written, an example) as closed disclosures. No standing, no "I
// already know this", no Back or Next: those live in the page header. A
// star already in the sky says so and is here for reference. Sparse items
// stay short: nothing is padded.

import { Eyebrow } from "@/sky/components/sky-card";
import { japaneseFont } from "@/sky/lib/japanese";
import type { LessonTeach } from "@/sky/lib/lesson";
import { KIND_LABEL } from "@/sky/lib/tokens";
import type { SkyItem } from "@/sky/lib/types";

export interface LessonCardProps {
  item: SkyItem;
  teach?: LessonTeach;
  /** The stars this one is built from, and the ones it is part of tonight. */
  madeOf: readonly SkyItem[];
  partOf: readonly SkyItem[];
  /** Already in the sky: shown for reference, not re-taught. */
  known: boolean;
  onSelect: (id: string) => void;
  className?: string;
}

/** What each kind is, in the learner's terms. */
const ROLE: Record<SkyItem["kind"], string> = {
  kana: "a sound, one syllable",
  radical: "a piece characters are built from",
  kanji: "a character words are built with",
  word: "a word",
  counter: "a counting word",
  grammar: "a sentence rule",
  verbPair: "a verb and its partner",
  keigo: "a polite verb",
};

function StarButton({ item, onSelect }: { item: SkyItem; onSelect: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onSelect(item.id)} className="inline-flex items-baseline gap-2 rounded-lg border border-sky-line px-2.5 py-1.5 text-left hover:border-sky-accent">
      <span className={`font-sky-display text-[18px] leading-none text-sky-ink ${japaneseFont(item.glyph)}`}>{item.glyph}</span>
      <span className="text-[12.5px] text-sky-muted">{item.english}</span>
    </button>
  );
}

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="border-t border-sky-line py-2.5 text-[13.5px] text-sky-muted">
      <summary className="cursor-pointer font-semibold text-sky-ink">{title}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

export function LessonCard({ item, teach, madeOf, partOf, known, onSelect, className = "" }: LessonCardProps) {
  const meanings = teach?.meanings?.length ? teach.meanings : [item.english];
  const reading = teach?.reading ?? item.reading;
  return (
    <section className={`rounded-2xl border border-sky-line bg-sky-panel p-5 font-sky-ui text-sky-ink ${className}`}>
      <Eyebrow>{KIND_LABEL[item.kind]} · {ROLE[item.kind]}</Eyebrow>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className={`font-sky-display text-[52px] leading-none ${japaneseFont(item.glyph)}`}>{item.glyph}</span>
        {reading && reading !== item.glyph && <span className={`font-sky-display text-[22px] text-sky-muted ${japaneseFont(reading)}`}>{reading}</span>}
      </div>
      <p className="mt-3 text-[15px] leading-relaxed">
        <span className="font-semibold">{meanings[0]}</span>
        {meanings.length > 1 && <span className="text-sky-muted"> · {meanings.slice(1, 4).join(" · ")}</span>}
      </p>
      {teach?.mnemonic?.map((line, i) => (
        <p key={i} className={`mt-2 text-[14px] leading-relaxed ${i === 0 ? "text-sky-muted" : ""}`}>{line}</p>
      ))}
      {teach?.etymology && <p className="mt-2 text-[14px] leading-relaxed text-sky-muted">{teach.etymology}</p>}

      {madeOf.length > 0 ? (
        <>
          <Eyebrow className="mt-4">Made of</Eyebrow>
          <div className="flex flex-wrap gap-2">{madeOf.map((p) => <StarButton key={p.id} item={p} onSelect={onSelect} />)}</div>
        </>
      ) : item.kind === "kanji" || item.kind === "radical" ? (
        <p className="mt-3 text-[13.5px] text-sky-muted">Nothing under it: this one is a building block itself.</p>
      ) : null}
      {partOf.length > 0 && (
        <>
          <Eyebrow className="mt-4">Part of</Eyebrow>
          <div className="flex flex-wrap gap-2">{partOf.map((p) => <StarButton key={p.id} item={p} onSelect={onSelect} />)}</div>
        </>
      )}

      <div className="mt-4">
        {teach?.readings && teach.readings.length > 0 && (
          <Fold title="Readings">
            <ul className="flex flex-col gap-1">
              {teach.readings.map((r) => (
                <li key={`${r.reading}@${r.inWord}`} className="flex items-baseline gap-3">
                  <span className={`font-sky-display text-[16px] text-sky-ink ${japaneseFont(r.reading)}`}>{r.reading}</span>
                  <span>in <span className={`font-sky-display text-sky-ink ${japaneseFont(r.inWord)}`}>{r.inWord}</span></span>
                </li>
              ))}
            </ul>
          </Fold>
        )}
        {teach?.strokes !== undefined && (
          <Fold title="How it's written">
            <p>{teach.strokes} {teach.strokes === 1 ? "stroke" : "strokes"}. The stroke order plays here, in the order you would write it.</p>
          </Fold>
        )}
        {teach?.example && (
          <Fold title="Example">
            <p className={`font-sky-display text-[17px] text-sky-ink ${japaneseFont(teach.example.jp)}`}>{teach.example.jp}</p>
            <p className="mt-1">{teach.example.en}</p>
          </Fold>
        )}
        {teach?.pitch !== undefined && (
          <Fold title="Pitch">
            <p>{teach.pitch === null ? "No pitch data for this word." : `Pattern ${teach.pitch}.`}</p>
          </Fold>
        )}
      </div>

      {known && <p className="mt-4 text-[13.5px] text-sky-muted">Already in your sky, so tonight doesn&apos;t re-teach it. Here for reference.</p>}
    </section>
  );
}
