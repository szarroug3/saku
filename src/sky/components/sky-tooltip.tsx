// What a constellation says when you hover it. Tracked as SAK-335.
//
// Naming without labelling: the glyph in its standing's colour, its reading
// and meaning, and the pieces it is built from, each in its own colour. A
// thing not yet discovered shows only its glyph: no reading, no meaning
// (Sam's call, 2026-09-04). The same card serves the home sky, the
// Planetarium preview and the lesson; the lesson passes `brief` to show only
// the English, which is what Sam asked for there ("car", nothing more).

import { japaneseFont } from "@/sky/lib/japanese";
import { STANDING } from "@/sky/lib/standing";
import { KIND_LABEL } from "@/sky/lib/tokens";
import type { SkyItem } from "@/sky/lib/types";

export interface SkyTooltipProps {
  item: SkyItem;
  /** The stars under it, in lesson order, each with its standing. */
  pieces?: readonly SkyItem[];
  /** Only the English name. */
  brief?: boolean;
  className?: string;
}

export function SkyTooltip({ item, pieces = [], brief = false, className = "" }: SkyTooltipProps) {
  if (brief) {
    return <div className={`rounded-lg border border-sky-line bg-sky-ground-0 px-2.5 py-1.5 font-sky-ui text-[13px] text-sky-ink shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${className}`}>{item.english}</div>;
  }
  const discovered = item.standing !== "not-seen";
  return (
    <div className={`max-w-[260px] rounded-xl border border-sky-line bg-sky-ground-0 p-3 font-sky-ui text-sky-ink shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${className}`}>
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sky-muted">{KIND_LABEL[item.kind]}</div>
      <div className="flex items-baseline gap-2">
        <span className={`font-sky-display text-2xl leading-none ${STANDING[item.standing].text} ${japaneseFont(item.glyph)}`} title={STANDING[item.standing].label}>{item.glyph}</span>
        {discovered && item.reading && <span className={`font-sky-display text-sm text-sky-muted ${japaneseFont(item.reading)}`}>{item.reading}</span>}
      </div>
      {discovered && <div className="mt-1.5 text-[13px]">{item.english}</div>}
      {pieces.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {pieces.map((p) => (
            <li key={p.id} className="inline-flex items-center gap-1 rounded-md border border-sky-line px-1.5 py-0.5 text-[12px]" title={STANDING[p.standing].label}>
              <span className={`font-sky-display text-[14px] ${STANDING[p.standing].text} ${japaneseFont(p.glyph)}`}>{p.glyph}</span>
              {p.standing !== "not-seen" && <span className="text-sky-muted">{p.english}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
