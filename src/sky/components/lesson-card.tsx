// The card under the lesson sky: the selected star, taught. Tracked as
// SAK-310 and SAK-297.
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

import { Eyebrow } from "@/sky/components/sky-card";
import { StandingChip } from "@/sky/components/standing-legend";
import { japaneseFont } from "@/sky/lib/japanese";
import type { LessonPage, LessonTeach, PartedSentence, SoundLine, TeachExample, TeachFormula, TeachPage, TeachParagraph, TeachTable } from "@/sky/lib/lesson";
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

/** Prose with the runs spoken as the sound in the accent. */
function Sound({ line }: { line: SoundLine }) {
  return <>{line.map((s, i) => (s.accent ? <span key={i} className="font-semibold text-sky-accent">{s.text}</span> : <span key={i}>{s.text}</span>))}</>;
}

/** A sentence with its parts coloured: the part being taught in the accent,
 * everything else in the ink (nothing muted: Sam's call, 2026-09-05, the
 * examples were hard to read). */
function Parted({ line, className = "" }: { line: PartedSentence; className?: string }) {
  return (
    <p className={`text-sky-ink ${className}`}>
      {line.map((run, i) => (
        <span key={i} className={run.active ? "font-semibold text-sky-accent" : run.label ? "font-medium" : ""}>{run.text}</span>
      ))}
    </p>
  );
}

/** The parts of a sentence as labelled boxes, in order: the role over the
 * text, the one being taught in the accent. */
function PartBoxes({ line }: { line: PartedSentence }) {
  const parts = line.filter((run) => run.label);
  if (parts.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {parts.map((run, i) => (
        <div key={i} className={`rounded-md border px-2 py-1 ${run.active ? "border-sky-accent" : "border-sky-line"}`}>
          <span className={`block text-[9.5px] font-semibold uppercase tracking-wide ${run.active ? "text-sky-accent" : "text-sky-muted"}`}>{run.label}</span>
          <span className={`text-[13px] font-medium ${run.active ? "text-sky-accent" : "text-sky-ink"} ${japaneseFont(run.text)}`}>{run.text}</span>
        </div>
      ))}
    </div>
  );
}

/** One worked example: natural English, the Japanese, and the English in
 * Japanese order between them when the example has one. */
function Example({ example, n, count }: { example: TeachExample; n: number; count: number }) {
  const block = (title: string, line: PartedSentence, big = false) => (
    <div className="mt-3 first:mt-1.5">
      <Eyebrow className="!mb-0.5 text-sky-accent">{title}</Eyebrow>
      <Parted line={line} className={big ? `font-sky-display text-[20px] leading-snug ${japaneseFont(line.map((r) => r.text).join(""))}` : "text-[14px] leading-relaxed"} />
      <PartBoxes line={line} />
    </div>
  );
  return (
    <div className="rounded-xl border border-sky-line px-3.5 py-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sky-accent">{count > 1 ? `Example ${n}` : "In a sentence"}</p>
      {block("Natural English", example.natural)}
      {example.ordered && block("English in Japanese order", example.ordered)}
      {block("Japanese", example.japanese, true)}
    </div>
  );
}

/** A paragraph of the teaching: a heading over it, a bold lead, the text
 * with a phrase picked out in the accent. */
function Paragraph({ para }: { para: TeachParagraph }) {
  const at = para.accent ? para.text.indexOf(para.accent) : -1;
  const text = at >= 0 && para.accent
    ? <>{para.text.slice(0, at)}<span className={`font-semibold text-sky-accent ${japaneseFont(para.accent)}`}>{para.accent}</span>{para.text.slice(at + para.accent.length)}</>
    : para.text;
  return (
    <div>
      {para.heading && <p className="mb-1 mt-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-sky-muted">{para.heading}</p>}
      <p>{para.lead && <span className="font-semibold">{para.lead} </span>}<span className={`text-sky-ink/90 ${japaneseFont(para.text)}`}>{text}</span></p>
    </div>
  );
}

/** A build formula as pills: the form in a dashed box, what is trimmed, what is added. */
function Formula({ formula }: { formula: TeachFormula }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[14px]">
      {formula.label && <span className="mr-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-sky-muted">{formula.label}</span>}
      <span className={`rounded-md border border-dashed border-sky-muted px-2 py-0.5 ${japaneseFont(formula.base)}`}>{formula.base}</span>
      {formula.trim && <><span className="text-sky-muted">−</span><span className={`font-sky-display ${japaneseFont(formula.trim)}`}>{formula.trim}</span></>}
      {formula.add && <><span className="text-sky-muted">+</span><span className={`font-sky-display font-semibold text-sky-accent ${japaneseFont(formula.add)}`}>{formula.add}</span></>}
    </span>
  );
}

/** One table of the teaching, with its heading, instruction and formula. */
function Table({ table }: { table: TeachTable }) {
  const formulas = table.formula ? (Array.isArray(table.formula) ? table.formula : [table.formula]) as readonly TeachFormula[] : [];
  return (
    <div className="rounded-xl border border-sky-line px-3.5 py-3">
      {table.title && <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sky-accent">{table.title}</p>}
      {table.instruction && <p className="mt-1.5 text-[13.5px] leading-relaxed text-sky-ink/90">{table.instruction}</p>}
      {formulas.length > 0 && <div className="mt-2 flex flex-col gap-1">{formulas.map((f, i) => <Formula key={i} formula={f} />)}</div>}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>{table.heads.map((h, i) => <th key={i} className="border-b border-sky-line pb-1 pr-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sky-muted">{h}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => {
                  const plain = cell.map((x) => x.text).join("");
                  // short cells hold their line and the table scrolls sideways in
                  // a narrow panel; a long note wraps at a readable measure
                  return <td key={c} className={`py-1 pr-3 align-top ${plain.length > 18 ? "min-w-[18ch]" : "whitespace-nowrap"} ${japaneseFont(plain)}`}><Sound line={cell} /></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.footer && <p className={`mt-2 text-[13.5px] ${japaneseFont(table.footer)}`}>{table.footer}</p>}
      {table.note && <p className="mt-2 text-[12.5px] leading-relaxed text-sky-muted">{table.note}</p>}
    </div>
  );
}

/** One page of a star taught over several: the eyebrow, the title, the hook
 * to keep in mind, the prose, the formula and tables, the worked examples. */
function TeachPageView({ page }: { page: TeachPage }) {
  return (
    <div className="mt-4 border-t border-sky-line pt-4">
      {page.eyebrow && <Eyebrow>{page.eyebrow}</Eyebrow>}
      <h3 className={`max-w-[30ch] font-sky-display text-[24px] leading-tight ${japaneseFont(page.title)}`}>{page.title}</h3>
      {page.hook && <p className="mt-2 text-[13px] font-semibold text-sky-accent">{page.hook}</p>}
      <div className="mt-3 flex max-w-[64ch] flex-col gap-2 text-[14.5px] leading-relaxed">
        {page.paragraphs.map((para, i) => <Paragraph key={i} para={para} />)}
      </div>
      {page.formula && <div className="mt-3"><Formula formula={page.formula} /></div>}
      {page.tables && page.tables.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {page.tables.map((t, i) => <Table key={i} table={t} />)}
        </div>
      )}
      {page.after && page.after.length > 0 && (
        <div className="mt-3 flex max-w-[64ch] flex-col gap-2 text-[14.5px] leading-relaxed">
          {page.after.map((para, i) => <Paragraph key={i} para={para} />)}
        </div>
      )}
      {page.examples && page.examples.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {page.examples.map((ex, i) => <Example key={i} example={ex} n={i + 1} count={page.examples!.length} />)}
        </div>
      )}
      {page.link && <p className="mt-3 text-[13px]"><a href={page.link.href} target="_blank" rel="noopener" className="text-sky-accent underline">{page.link.label}</a></p>}
    </div>
  );
}

/** The pager for a star with several pages: one pill per page, the one
 * showing in the accent. */
function Pager({ pages, page, onPage }: { pages: readonly TeachPage[]; page: number; onPage?: (page: number) => void }) {
  return (
    <nav aria-label="Pages" className="mt-3 flex flex-wrap items-center gap-1.5">
      {pages.map((p, i) => (
        <button
          key={i}
          type="button"
          aria-current={i === page ? "page" : undefined}
          onClick={() => onPage?.(i)}
          title={p.title}
          className={`max-w-[22ch] truncate rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${japaneseFont(p.eyebrow ?? "")} ${i === page ? "border-sky-accent bg-sky-accent text-sky-accent-ink" : "border-sky-line text-sky-muted hover:border-sky-accent hover:text-sky-ink"}`}
        >
          {p.eyebrow ?? `Page ${i + 1}`}
        </button>
      ))}
      <span className="ml-auto text-[12px] tabular-nums text-sky-muted">{page + 1} of {pages.length}</span>
    </nav>
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
    <section className={`flex flex-col rounded-2xl border border-sky-line bg-sky-panel p-5 font-sky-ui text-sky-ink ${scroll ? "h-full overflow-hidden" : ""} ${className}`}>
      {toolbar && <div className="mb-3 flex shrink-0 items-center justify-between gap-2">{toolbar}</div>}
      <div className={`flex items-start justify-between gap-3 ${scroll ? "shrink-0" : ""}`}>
        <Eyebrow>{KIND_LABEL[item.kind]}{ROLE[item.kind] ? ` · ${ROLE[item.kind]}` : ""}</Eyebrow>
        {standing && <StandingChip standing={item.standing} />}
      </div>
      <div className={scroll ? "-mr-2 min-h-0 flex-1 overflow-y-auto pr-2" : "contents"}>
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
      </div>
      {footer && <div className={`mt-auto flex flex-wrap items-center gap-2 border-t border-sky-line pt-4 ${scroll ? "shrink-0" : "[&:not(:first-child)]:mt-5"}`}>{footer}</div>}
    </section>
  );
}

/** A page in the order rather than a star: an intro, a term, a sound shift.
 * The kind as the eyebrow, the title, the paragraphs. */
export function LessonPageCard({ page, className = "" }: { page: LessonPage; className?: string }) {
  return (
    <section className={`rounded-2xl border border-sky-line bg-sky-panel p-5 font-sky-ui text-sky-ink ${className}`}>
      <Eyebrow>{page.kind}</Eyebrow>
      <h2 className="font-sky-display text-[26px] leading-tight">{page.title}</h2>
      {page.lead && <p className="mt-2 max-w-[64ch] text-[15.5px] font-semibold leading-relaxed">{page.lead}</p>}
      <div className="mt-3 flex max-w-[64ch] flex-col gap-2.5">
        {page.body.map((para, i) => <p key={i} className="text-[14.5px] leading-relaxed text-sky-ink/90">{para}</p>)}
      </div>
    </section>
  );
}
