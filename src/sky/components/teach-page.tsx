// The teaching, rendered: a page of it with its pager, and the pieces a
// page is made of. Tracked as SAK-295. The lesson's card shows a star's
// pages; an intro or a term in the order is one page on its own; the
// Atlas shows the same pages as reference. One renderer, so the two can
// never drift.

import { SkyChip } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkyBox } from "@/sky/components/sky-panel";
import { japaneseFont } from "@/sky/lib/japanese";
import type { PartedSentence, SoundLine, TeachExample, TeachFormula, TeachPage, TeachParagraph, TeachTable } from "@/sky/lib/lesson";

/** Prose with the runs spoken as the sound in the accent. */
export function Sound({ line }: { line: SoundLine }) {
  return <>{line.map((s, i) => (s.accent ? <span key={i} className="font-semibold text-sky-accent">{s.text}</span> : <span key={i}>{s.text}</span>))}</>;
}

/** A sentence with its parts coloured: the part being taught in the accent,
 * everything else in the ink (nothing muted: Sam's call, 2026-09-05, the
 * examples were hard to read). */
export function Parted({ line, className = "" }: { line: PartedSentence; className?: string }) {
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
      <Eyebrow tone="accent" tight className="mb-0.5">{title}</Eyebrow>
      <Parted line={line} className={big ? `font-sky-display text-[20px] leading-snug ${japaneseFont(line.map((r) => r.text).join(""))}` : "text-[14px] leading-relaxed"} />
      <PartBoxes line={line} />
    </div>
  );
  return (
    <SkyBox>
      <Eyebrow tone="accent" tight>{count > 1 ? `Example ${n}` : "In a sentence"}</Eyebrow>
      {block("Natural English", example.natural)}
      {example.ordered && block("English in Japanese order", example.ordered)}
      {block("Japanese", example.japanese, true)}
    </SkyBox>
  );
}

/** A paragraph of the teaching: a heading over it, a bold lead, the text
 * with a phrase picked out in the accent. */
export function Paragraph({ para }: { para: TeachParagraph }) {
  const at = para.accent ? para.text.indexOf(para.accent) : -1;
  const text = para.runs ? <Sound line={para.runs} /> : at >= 0 && para.accent
    ? <>{para.text.slice(0, at)}<span className={`font-semibold text-sky-accent ${japaneseFont(para.accent)}`}>{para.accent}</span>{para.text.slice(at + para.accent.length)}</>
    : para.text;
  return (
    <div>
      {para.heading && <Eyebrow size="md" className="mt-1">{para.heading}</Eyebrow>}
      <p>{para.lead && <span className="font-semibold">{para.lead} </span>}<span className={`text-sky-ink/90 ${japaneseFont(para.text)}`}>{text}</span></p>
    </div>
  );
}

/** A build formula as pills: the form in a dashed box, what is trimmed, what is added. */
function Formula({ formula }: { formula: TeachFormula }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[14px]">
      {formula.label && <Eyebrow tight className="mr-1">{formula.label}</Eyebrow>}
      <span className={`rounded-md border border-dashed border-sky-muted px-2 py-0.5 ${japaneseFont(formula.base)}`}>{formula.base}</span>
      {formula.trim && <><span className="text-sky-muted">−</span><span className={`font-sky-display ${japaneseFont(formula.trim)}`}>{formula.trim}</span></>}
      {formula.add && <><span className="text-sky-muted">+</span><span className={`font-sky-display font-semibold text-sky-accent ${japaneseFont(formula.add)}`}>{formula.add}</span></>}
    </span>
  );
}

/** One table of the teaching, with its heading, instruction and formula. */
export function Table({ table }: { table: TeachTable }) {
  const formulas = table.formula ? (Array.isArray(table.formula) ? table.formula : [table.formula]) as readonly TeachFormula[] : [];
  return (
    <SkyBox>
      {table.title && <Eyebrow tone="accent" tight>{table.title}</Eyebrow>}
      {table.instruction && <p className="mt-1.5 text-[13.5px] leading-relaxed text-sky-ink/90">{typeof table.instruction === "string" ? table.instruction : <Sound line={table.instruction} />}</p>}
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
    </SkyBox>
  );
}

/** One page of a star taught over several: the eyebrow, the title, the hook
 * to keep in mind, the prose, the formula and tables, the worked examples. */
export function TeachPageView({ page, alone = false }: { page: TeachPage; alone?: boolean }) {
  return (
    <div className={alone ? "" : "mt-4 border-t border-sky-line pt-4"}>
      {page.eyebrow && <Eyebrow>{page.eyebrow}</Eyebrow>}
      {page.title && <h3 className={`max-w-[30ch] font-sky-display text-[20px] leading-tight ${japaneseFont(page.title)}`}>{page.title}</h3>}
      {page.lead && <p className="mt-2 max-w-[64ch] text-[15.5px] font-semibold leading-relaxed">{page.lead}</p>}
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
export function Pager({ pages, page, onPage }: { pages: readonly TeachPage[]; page: number; onPage?: (page: number) => void }) {
  return (
    <nav aria-label="Pages" className="mt-3 flex flex-wrap items-center gap-1.5">
      {pages.map((p, i) => (
        <SkyChip key={i} on={i === page} current="page" onClick={() => onPage?.(i)} title={p.title} className={`max-w-[22ch] truncate ${japaneseFont(p.eyebrow ?? "")}`}>
          {p.eyebrow ?? `Page ${i + 1}`}
        </SkyChip>
      ))}
      <span className="ml-auto text-[12px] tabular-nums text-sky-muted">{page + 1} of {pages.length}</span>
    </nav>
  );
}
