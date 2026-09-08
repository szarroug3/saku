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

import { useId, useState, type ComponentType, type ReactNode } from "react";

import { DetailFrame } from "@/sky/components/detail-frame";
import { Glyph } from "@/sky/components/glyph";
import { RoundButton } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
import { StandingChip } from "@/sky/components/standing-legend";
import { Pager, Parted, Sound, Table, TeachPageView } from "@/sky/components/teach-page";
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
  /** A line under an item, by its id: how to tell a look-alike apart. */
  tips?: Readonly<Record<string, string>>;
  /** Folds before "How it's written" rather than after the card's own folds. */
  early?: boolean;
}

export type PitchComponent = ComponentType<{ reading: string; downstep: number; className?: string }>;

/** What a hear button takes: the kana to say and, for a word, the mora its
 * pitch falls after. */
export type HearComponent = ComponentType<{ glyph: string; downstep?: number; className?: string; label?: string }>;

/** What each kind is, in the learner's terms.
 *
 * items-center, not items-baseline (SAK-415): an 18px glyph beside a 12.5px
 * gloss centres on the pill rather than hanging the gloss off the glyph's
 * baseline, which left the pair sitting high. */
function StarButton({ item, note, onSelect }: { item: SkyItem; note?: string; onSelect: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onSelect(item.id)} className="inline-flex items-center gap-2 rounded-lg border border-sky-line px-2.5 py-1.5 text-left hover:border-sky-accent">
      <Glyph glyph={item.glyph} size="text-[18px]" />
      {note && <span className={`font-sky-display text-[13px] text-sky-muted ${japaneseFont(note)}`}>{note}</span>}
      {item.english !== item.glyph && <span className="text-[12.5px] text-sky-muted">{item.english}</span>}
    </button>
  );
}

/** A section of the card that folds. The round button is the Sky's one way to
 * open and close things (SAK-412), so this is no longer a `<details>` with the
 * browser's own triangle; the title stays beside the button, because the words
 * are what the section is called. */
function Fold({ title, open: from = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(from);
  const id = useId();
  return (
    <div className="border-t border-sky-line py-2.5 text-[13.5px] text-sky-muted">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-sky-ink">{title}</span>
        <RoundButton label={open ? `Close ${title}` : `Open ${title}`} expanded={open} controls={id} onClick={() => setOpen(!open)}>⌃</RoundButton>
      </div>
      {open && <div id={id} className="mt-2.5">{children}</div>}
    </div>
  );
}

export function LessonCard({ item, teach, madeOf, partOf, known, onSelect, written, hear: Hear, pitch: Pitch, page = 0, onPage, standing = false, related = [], footer, toolbar, scroll = false, className = "" }: LessonCardProps) {
  const meanings = teach?.meanings?.length ? teach.meanings : [item.english];
  const pages = teach?.pages ?? [];
  const at = Math.max(0, Math.min(page, pages.length - 1));
  const reading = teach?.reading ?? item.reading;
  const byId = new Map(madeOf.map((m) => [m.glyph, m]));
  // what each piece does in the character: "lends セイ", "water"
  const partSense = new Map((teach?.parts ?? []).filter((p) => p.sense).map((p) => [p.glyph, p.sense]));
  const on = teach?.readings?.filter((r) => r.kind === "on") ?? [];
  const kun = teach?.readings?.filter((r) => r.kind === "kun") ?? [];
  // The readings are a table, so they are laid out as one (SAK-413). Three
  // columns: the hear button, then the reading, then the words it is read that
  // way in. The button leads because it is the one cell the same width on every
  // row; with the reading first, か and にち and じつ each pushed the button and
  // the word list to a different x and nothing lined up.
  //
  // ONE grid holds both On'yomi and Kun'yomi, with the eyebrows spanning it, so
  // the two lists share their columns instead of each measuring its own. The ul
  // and li are `contents`: the rows are cells of that one grid, and the list is
  // still a list to a screen reader. A long list of words wraps inside column
  // three, never back under the reading.
  const readingGrid = Hear ? "grid grid-cols-[auto_auto_minmax(0,1fr)]" : "grid grid-cols-[auto_minmax(0,1fr)]";
  const readingRows = (rows: typeof on) => (
    <ul className="contents">
      {rows.map((r) => (
        <li key={r.reading} className="contents">
          {Hear && <Hear glyph={r.reading} />}
          <span className={`font-sky-display text-[16px] text-sky-ink ${japaneseFont(r.reading)}`}>{r.reading}</span>
          <span className={r.words.length > 0 ? `font-sky-display ${japaneseFont(r.words[0])}` : ""}>{r.words.join("  ")}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <DetailFrame toolbar={toolbar} footer={footer} scroll={scroll} className={className}>
      <div className="flex shrink-0 items-start justify-between gap-3">
        <Eyebrow>{KIND_LABEL[item.kind]}</Eyebrow>
        {standing && <StandingChip standing={item.standing} />}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className={`font-sky-display leading-none ${item.glyph === item.english ? "text-[28px] leading-tight" : "text-[52px]"} ${japaneseFont(item.glyph)}`}>{item.glyph}</span>
        {/* the reading and its hear button as one group, so the button
            centres on the reading rather than on the glyph beside it */}
        <span className="inline-flex items-center gap-2">
          {reading && reading !== item.glyph && (
            Pitch && typeof teach?.pitch === "number"
              ? <Pitch reading={reading} downstep={teach.pitch} className={`font-sky-display text-[22px] text-sky-muted ${japaneseFont(reading)}`} />
              : <span className={`font-sky-display text-[22px] text-sky-muted ${japaneseFont(reading)}`}>{reading}</span>
          )}
          {Hear && (item.kind === "kana" || item.kind === "word" || item.kind === "counter" || item.kind === "keigo") && !item.glyph.includes("〜") && (
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

      {/* the notes are about the thing itself (a term's definition, a
          counter's role); they read before its pages, not after them */}
      {teach?.notes?.map((note, i) => <p key={i} className={`text-[14px] leading-relaxed text-sky-ink/90 ${i === 0 ? "mt-3" : "mt-1.5"} ${japaneseFont(note)}`}>{note}</p>)}
      {pages.length > 0 && (
        <>
          {pages.length > 1 && <Pager pages={pages} page={at} onPage={onPage} />}
          {/* a lone page named after the thing itself carries no eyebrow: the
              name is right above it */}
          <TeachPageView page={pages.length === 1 && pages[at].eyebrow?.toLowerCase() === item.english.toLowerCase() ? { ...pages[at], eyebrow: undefined } : pages[at]} />
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
      {teach?.forms && teach.forms.length > 0 && (
        <div className="mt-4 flex flex-col gap-4 border-t border-sky-line pt-4">
          {teach.forms.map((f) => (
            <div key={`${f.role}:${f.word}`}>
              <Eyebrow tone="accent" className="mb-0">{f.role}</Eyebrow>
              {f.note && <p className="mt-0.5 text-[13px] leading-relaxed text-sky-muted">{f.note}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                <span className={`font-sky-display text-[22px] leading-none text-sky-ink ${japaneseFont(f.word)}`}>{f.word}</span>
                {f.reading && f.reading !== f.word && (
                  Pitch && typeof f.pitch === "number"
                    ? <Pitch reading={f.reading} downstep={f.pitch} className={`font-sky-display text-[14px] text-sky-muted ${japaneseFont(f.reading)}`} />
                    : <span className={`font-sky-display text-[14px] text-sky-muted ${japaneseFont(f.reading)}`}>{f.reading}</span>
                )}
                {Hear && <Hear glyph={f.reading ?? f.word} downstep={f.pitch ?? undefined} />}
              </div>
              {f.sentence && <p className="mt-1 text-[13.5px] leading-relaxed text-sky-muted">{f.sentence}</p>}
              {f.example && <Parted line={f.example} className={`mt-1 font-sky-display text-[16px] leading-relaxed ${japaneseFont(f.example.map((r) => r.text).join(""))}`} />}
            </div>
          ))}
        </div>
      )}
      {teach?.etymology && <p className="mt-2 text-[14px] leading-relaxed text-sky-muted">{teach.etymology}</p>}

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
      ) : madeOf.length > 0 && !item.listsParts ? (
        <>
          <Eyebrow className="mt-4">Made of</Eyebrow>
          <div className="flex flex-wrap gap-2">{madeOf.map((p) => <StarButton key={p.id} item={p} note={partSense.get(p.glyph)?.toLowerCase() === p.english.toLowerCase() ? undefined : partSense.get(p.glyph)} onSelect={onSelect} />)}</div>
        </>
      ) : null}
      {teach?.variants && teach.variants.length > 0 && (
        <>
          <Eyebrow className="mt-4">Also written as</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {teach.variants.map((v) => (
              <span key={v.glyph} className="inline-flex items-baseline gap-2 rounded-lg border border-sky-line px-2.5 py-1.5">
                <span className={`font-sky-display text-[18px] leading-none text-sky-ink ${japaneseFont(v.glyph)}`}>{v.glyph}</span>
                <span className="text-[12.5px] text-sky-muted">{v.position}{v.example ? ` · as in ${v.example}` : ""}</span>
              </span>
            ))}
          </div>
        </>
      )}
      {partOf.length > 0 && (
        <>
          <Eyebrow className="mt-4">Part of</Eyebrow>
          <div className="flex flex-wrap gap-2">{partOf.map((p) => <StarButton key={p.id} item={p} onSelect={onSelect} />)}</div>
        </>
      )}

      <div className="mt-4">
        {(on.length > 0 || kun.length > 0) && (
          <Fold title="Readings">
            <div className={`${readingGrid} items-baseline gap-x-3 gap-y-1.5`}>
              {on.length > 0 && <><Eyebrow className="col-span-full">On&apos;yomi · the reading that came with the character</Eyebrow>{readingRows(on)}</>}
              {kun.length > 0 && <><Eyebrow className={`col-span-full${on.length > 0 ? " mt-2.5" : ""}`}>Kun&apos;yomi · the native reading</Eyebrow>{readingRows(kun)}</>}
            </div>
          </Fold>
        )}
        {related.filter((g) => g.early).map((group) => <RelatedFold key={group.title} group={group} onSelect={onSelect} />)}
        {teach?.pronunciations && teach.pronunciations.length > 1 && (
          <Fold title="Readings">
            {/* A word's readings are the same table in the same three columns:
                hear, the reading, what it means read that way. */}
            <ul className={`${readingGrid} items-baseline gap-x-3 gap-y-1.5`}>
              {teach.pronunciations.map((r) => (
                <li key={r.reading} className="contents">
                  {Hear && <Hear glyph={r.reading} downstep={r.pitch ?? undefined} />}
                  {Pitch && typeof r.pitch === "number"
                    ? <Pitch reading={r.reading} downstep={r.pitch} className={`font-sky-display text-[16px] text-sky-ink ${japaneseFont(r.reading)}`} />
                    : <span className={`font-sky-display text-[16px] text-sky-ink ${japaneseFont(r.reading)}`}>{r.reading}</span>}
                  <span>{r.glosses.join(", ")}</span>
                </li>
              ))}
            </ul>
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
        {teach?.tables?.map((table) => (
          <Fold key={table.title ?? "table"} title={table.title ?? "Table"}>
            <Table table={{ ...table, title: undefined }} />
          </Fold>
        ))}
        {/* the related groups last, closed (Sam's order, 2026-09-05): what it
            is a part of, then the words written with it */}
        {related.filter((g) => !g.early).map((group) => <RelatedFold key={group.title} group={group} onSelect={onSelect} />)}
      </div>

      {known && <p className="mt-4 text-[13.5px] text-sky-muted">Already in your sky, so tonight doesn&apos;t re-teach it. Here for reference.</p>}
    </DetailFrame>
  );
}

function RelatedFold({ group, onSelect }: { group: RelatedGroup; onSelect: (id: string) => void }) {
  return (
          <Fold key={group.title} title={group.note ? `${group.title} · ${group.note}` : group.title}>
            {group.tips ? (
              <div className="flex flex-col gap-2.5">
                {group.items.map((p) => (
                  <div key={p.id}>
                    <StarButton item={p} onSelect={onSelect} />
                    {group.tips?.[p.id] && <p className="mt-1.5 text-[13px] leading-relaxed">{group.tips[p.id]}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">{group.items.map((p) => <StarButton key={p.id} item={p} onSelect={onSelect} />)}</div>
            )}
          </Fold>
  );
}

