// What a constellation says when you hover it. Tracked as SAK-335.
//
// Naming without labelling: the glyph in its standing's colour, its reading
// and meaning, and the pieces it is built from, each in its own colour. A
// thing not yet discovered shows only its glyph: no reading, no meaning
// (Sam's call, 2026-09-04). The same card serves the home sky, the
// Planetarium preview and the lesson; the lesson passes `brief` to show only
// the English, which is what Sam asked for there ("car", nothing more).

import { Glyph } from "@/sky/components/glyph";
import { Eyebrow, SkyCard } from "@/sky/components/sky-card";
import { japaneseFont } from "@/sky/lib/japanese";
import { STANDING } from "@/sky/lib/standing";
import { KIND_LABEL } from "@/sky/lib/tokens";
import type { SkyItem } from "@/sky/lib/types";

interface SkyTooltipProps {
  item: SkyItem;
  /** The stars under it, in lesson order, each with its standing. */
  pieces?: readonly SkyItem[];
  /** Only the English name. */
  brief?: boolean;
  /** Being learned tonight: not yet in the sky, but named in full, with the
   * glyph in the ink rather than the undiscovered grey. */
  tonight?: boolean;
  className?: string;
}

export function SkyTooltip({ item, pieces = [], brief = false, tonight = false, className = "" }: SkyTooltipProps) {
  if (brief) return <SkyCard className={`rounded-lg px-2.5 py-1.5 ${className}`}>{item.english}</SkyCard>;
  const discovered = tonight || item.standing !== "not-seen";
  return (
    <SkyCard className={`max-w-[260px] ${className}`}>
      <Eyebrow>{KIND_LABEL[item.kind]}</Eyebrow>
      <div className="flex items-baseline gap-2">
        <Glyph glyph={item.glyph} standing={tonight ? undefined : item.standing} size="text-2xl" />
        {discovered && item.reading && <span className={`font-sky-display text-sm text-sky-muted ${japaneseFont(item.reading)}`}>{item.reading}</span>}
      </div>
      {discovered && item.english !== item.glyph && <div className="mt-1.5">{item.english}</div>}
      {pieces.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {pieces.map((p) => (
            <li key={p.id} className="inline-flex items-center gap-1 rounded-md border border-sky-line px-1.5 py-0.5 text-[12px]">
              <span className={`font-sky-display text-[14px] ${STANDING[p.standing].text} ${japaneseFont(p.glyph)}`}>{p.glyph}</span>
              {p.standing !== "not-seen" && <span className="text-sky-muted">{p.english}</span>}
            </li>
          ))}
        </ul>
      )}
    </SkyCard>
  );
}
