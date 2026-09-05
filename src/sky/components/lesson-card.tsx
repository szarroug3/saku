// The card under the lesson sky: the selected star, taught. Tracked as
// SAK-310 and SAK-297. The frame is `DetailFrame`; a star's pages are
// rendered by `teach-page.tsx`; this file is the star's own head and the
// blocks a kind has (the story, the readings, what it is made of).
//
// What matters is open: the kind, the glyph large with its reading (and a
// word's pitch), the meaning, the mnemonic with its drawing or the origin,
// what it is made of, what it is part of and, for a word, the kanji it is
// written with and how each is read here, as buttons that select those
// stars. The rest folds closed (Sam's rule, 2026-09-05): readings, how it
// is written (the real stroke order, handed in as a slot), an example. No
// standing, no "I already know this", no Back or Next: those live in the
// page header. A star already in the sky says so and is here for
// reference. Sparse items stay short: nothing is padded.

import type { ComponentType, ReactNode } from "react";

import { DetailFrame } from "@/sky/components/detail-frame";
import { Eyebrow } from "@/sky/components/sky-card";
import { StandingChip } from "@/sky/components/standing-legend";
import { Pager, Sound, TeachPageView } from "@/sky/components/teach-page";
import { japaneseFont } from "@/sky/lib/japanese";
import type { LessonPage, LessonTeach } from "@/sky/lib/lesson";
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
  /** The stroke order and its notes, from whoever has them; goes in the
   * "How it's written" fold. */
  written?: ReactNode;
  /** A button that speaks a reading, from whoever has the voice: beside the
   * glyph's reading, each of a kanji's readings and the example word. */
  hear?: HearComponent;
  /** A word's reading with its pitch drawn over it, from whoever draws it;
   * used in place of the plain reading when the pitch is known. */
  pitch?: PitchComponent;
  /** Which of the star's pages is showing, when it is taught over several,
   * and the pager's way of changing it. */
  page?: number;
  onPage?: (page: number) => void;
  /** The Atlas's additions: the standing chip in the eyebrow row, groups of
   * related stars after the card's own (the words written with a kanji,
   * the kanji built from a piece), and a pinned footer of actions. */
  standing?: boolean;
  related?: readonly RelatedGroup[];
  footer?: ReactNode;
  /** A row of controls across the top of the card, above the eyebrow: a widen, a close. */
  toolbar?: ReactNode;
  /** The card fills its box and scrolls inside it, the footer pinned at the bottom. */
  scroll?: boolean;
  className?: string;
}

/** A group of stars related to this one, with what the group is and, when
 * it is a sample, a note on the whole: "you know 3 of 38". */
export interface RelatedGroup {
  title: string;
  note?: string;
  items: readonly SkyItem[];
}

export type PitchComponent = ComponentType<{ reading: string; downstep: number; className?: string }>;

/** What a hear button takes: the kana to say and, for a word, the mora its
 * pitch falls after. */
export type HearComponent = ComponentType<{ glyph: string; downstep?: number; className?: string; label?: string }>;

/** What each kind is, in the learner's terms. */
const ROLE: Record<SkyItem["kind"], string> = {
  kana: "a sound, one syllable",
  radical: "a piece characters are built from",
  kanji: "a character words are built with",
  word: "",
  counter: "a counting word",
  grammar: "a sentence rule",
  sentence: "",
  verbPair: "a verb and its partner",
  keigo: "a polite verb",
};

function StarButton({ item, note, onSelect }: { item: SkyItem; note?: string; onSelect: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onSelect(item.id)} className="inline-flex items-baseline gap-2 rounded-lg border border-sky-line px-2.5 py-1.5 text-left hover:border-sky-accent">
      <span className={`font-sky-display text-[18px] leading-none text-sky-ink ${japaneseFont(item.glyph)}`}>{item.glyph}</span>
      {note && <span className={`font-sky-display text-[13px] text-sky-muted ${japaneseFont(note)}`}>{note}</span>}
      {item.english !== item.glyph && <span className="text-[12.5px] text-sky-muted">{item.english}</span>}
    </button>
  );
}

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="border-t border-sky-line py-2.5 text-[13.5px] text-sky-muted">
      <summary className="cursor-pointer font-semibold text-sky-ink">{title}</summary>
      <div className="mt-2.5">{children}</div>
    </details>
  );
}

export function LessonCard({ item, teach, madeOf, partOf, known, onSelect, written, hear: Hear, pitch: Pitch, page = 0, onPage, standing = false, related = [], footer, toolbar, scroll = false, className = "" }: LessonCardProps) {
  const meanings = teach?.meanings?.length ? teach.meanings : [item.english];
  const pages = teach?.pages ?? [];
  const at = Math.max(0, Math.min(page, pages.length - 1));
  const reading = teach?.reading ?? item.reading;
  const byId = new Map(madeOf.map((m) => [m.glyph, m]));
  const on = teach?.readings?.filter((r) => r.kind === "on") ?? [];
  const kun = teach?.readings?.filter((r) => r.kind === "kun") ?? [];
  const readingList = (rows: typeof on) => (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => (
        <li key={r.reading} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className={`font-sky-display text-[16px] text-sky-ink ${japaneseFont(r.reading)}`}>{r.reading}</span>
          {Hear && <span className="self-center"><Hear glyph={r.reading} /></span>}
          {r.words.length > 0 && <span className={`font-sky-display ${japaneseFont(r.words[0])}`}>{r.words.join("  ")}</span>}
        </li>
      ))}
    </ul>
  );

  return (
    <DetailFrame toolbar={toolbar} footer={footer} scroll={scroll} className={className}>
      <div className="flex shrink-0 items-start justify-between gap-3">
        <Eyebrow>{KIND_LABEL[item.kind]}{ROLE[item.kind] ? ` · ${ROLE[item.kind]}` : ""}</Eyebrow>
        {standing && <StandingChip standing={item.standing} />}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className={`font-sky-display text-[52px] leading-none ${japaneseFont(item.glyph)}`}>{item.glyph}</span>
        {/* the reading and its hear button as one group, so the button
            centres on the reading rather than on the glyph beside it */}
        <span className="inline-flex items-center gap-2">
          {reading && reading !== item.glyph && (
            Pitch && typeof teach?.pitch === "number"
              ? <Pitch reading={reading} downstep={teach.pitch} className={`font-sky-display text-[22px] text-sky-muted ${japaneseFont(reading)}`} />
              : <span className={`font-sky-display text-[22px] text-sky-muted ${japaneseFont(reading)}`}>{reading}</span>
          )}
          {Hear && (item.kind === "kana" || item.kind === "word" || item.kind === "counter" || item.kind === "keigo") && (
            <Hear glyph={item.kind === "kana" ? item.glyph : (reading ?? item.glyph)} downstep={teach?.pitch ?? undefined} />
          )}
        </span>
      </div>
      {/* a kana's name is its sound, already beside the glyph; a rule's name is its glyph */}
      {item.kind !== "kana" && meanings[0] !== item.glyph && (
        <p className="mt-3 text-[15px] leading-relaxed">
          <span className="font-semibold">{meanings[0]}</span>
          {meanings.length > 1 && <span className="text-sky-muted"> · {meanings.slice(1, 4).join(" · ")}</span>}
        </p>
      )}

      {pages.length > 0 && (
        <>
          <Pager pages={pages} page={at} onPage={onPage} />
          <TeachPageView page={pages[at]} />
        </>
      )}

      {(teach?.story || teach?.hook) && (
        <div className="mt-3 flex items-start gap-4">
          {teach.mnemonicImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teach.mnemonicImage} alt="" className="size-[160px] flex-none rounded-lg object-contain" />
          )}
          <div className="flex flex-col gap-2">
            {teach.story && <p className="text-[15px] leading-relaxed"><Sound line={teach.story} /></p>}
            {teach.hook && <p className="text-[14px] leading-relaxed text-sky-muted"><Sound line={teach.hook} /></p>}
            {teach.headsUp && (
              <div className="mt-1 border-l-2 border-sky-accent pl-3 text-[13.5px] leading-relaxed">
                <p><span className="font-semibold">Heads up.</span> <span className="text-sky-muted">{teach.headsUp.summary}</span></p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {teach.headsUp.rules.map((r) => (
                    <li key={r.when} className="flex flex-wrap items-baseline gap-x-2">
                      <span>{r.when}</span>
                      <span className="text-sky-muted">said</span>
                      <span className="font-semibold text-sky-accent">{r.sounds}</span>
                      <span className={`text-sky-muted ${japaneseFont(r.example)}`}>{r.example}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {teach.exampleWord && (
              <p className="mt-1 flex items-center gap-3 border-t border-sky-line pt-2">
                <span className={`font-sky-display text-[24px] leading-none text-sky-ink ${japaneseFont(teach.exampleWord.word)}`}>{teach.exampleWord.word}</span>
                <span className="text-[13.5px] text-sky-muted">{teach.exampleWord.reading} · {teach.exampleWord.gloss}</span>
                {Hear && <span className="self-center"><Hear glyph={teach.exampleWord.word} /></span>}
              </p>
            )}
          </div>
        </div>
      )}
      {teach?.etymology && <p className="mt-2 text-[14px] leading-relaxed text-sky-muted">{teach.etymology}</p>}
      {teach?.notes?.map((note, i) => <p key={i} className={`text-[14px] leading-relaxed text-sky-ink/90 ${i === 0 ? "mt-3" : "mt-1.5"} ${japaneseFont(note)}`}>{note}</p>)}

      {teach?.writtenWith && teach.writtenWith.length > 0 ? (
        <>
          <Eyebrow className="mt-4">Written with</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {teach.writtenWith.map((w, i) => {
              const star = byId.get(w.kanji);
              return star
                ? <StarButton key={`${w.kanji}${i}`} item={star} note={w.reading} onSelect={onSelect} />
                : <span key={`${w.kanji}${i}`} className={`inline-flex items-baseline gap-2 rounded-lg border border-transparent px-2.5 py-1.5 font-sky-display text-[18px] ${japaneseFont(w.kanji)}`}>{w.kanji}<span className="text-[13px] text-sky-muted">{w.reading}</span></span>;
            })}
          </div>
        </>
      ) : madeOf.length > 0 ? (
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
      {related.map((group) => (
        <div key={group.title}>
          <Eyebrow className="mt-4">{group.title}{group.note ? <span className="normal-case tracking-normal text-sky-muted"> · {group.note}</span> : null}</Eyebrow>
          <div className="flex flex-wrap gap-2">{group.items.map((p) => <StarButton key={p.id} item={p} onSelect={onSelect} />)}</div>
        </div>
      ))}

      <div className="mt-4">
        {(on.length > 0 || kun.length > 0) && (
          <Fold title="Readings">
            <div className="flex flex-col gap-3">
              {on.length > 0 && <div><Eyebrow>On&apos;yomi · the reading that came with the character</Eyebrow>{readingList(on)}</div>}
              {kun.length > 0 && <div><Eyebrow>Kun&apos;yomi · the native reading</Eyebrow>{readingList(kun)}</div>}
            </div>
          </Fold>
        )}
        {(written || teach?.strokes !== undefined) && (
          <Fold title="How it's written">
            {written ?? <p>{teach!.strokes} {teach!.strokes === 1 ? "stroke" : "strokes"}.</p>}
          </Fold>
        )}
        {teach?.example && (
          <Fold title="In a sentence">
            <p className={`font-sky-display text-[17px] text-sky-ink ${japaneseFont(teach.example.jp)}`}>{teach.example.jp}</p>
            <p className="mt-1">{teach.example.en}</p>
          </Fold>
        )}
      </div>

      {known && <p className="mt-4 text-[13.5px] text-sky-muted">Already in your sky, so tonight doesn&apos;t re-teach it. Here for reference.</p>}
    </DetailFrame>
  );
}

/** A page in the order rather than a star: an intro, a term, a sound shift,
 * the same page a star's teaching is made of, on its own. The kind is the
 * eyebrow. */
export function LessonPageCard({ page, className = "" }: { page: LessonPage; className?: string }) {
  return (
    <DetailFrame className={className}>
      <TeachPageView page={{ ...page.page, eyebrow: page.kind }} alone />
    </DetailFrame>
  );
}
