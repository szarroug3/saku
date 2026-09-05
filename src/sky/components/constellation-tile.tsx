// One item as a small constellation with a caption: the Atlas's tiles, the
// home's mix-ups, the Practice pool. Tracked as SAK-296 and SAK-336.

import { ConstellationFigure, type StarLook } from "@/sky/components/constellation";
import { bodyOf, layoutConstellation, roleOf } from "@/sky/lib/constellation";
import type { PrerequisiteGraph } from "@/sky/lib/graph";
import { japaneseFont } from "@/sky/lib/japanese";
import { STANDING } from "@/sky/lib/standing";

export interface ConstellationTileProps {
  graph: PrerequisiteGraph;
  id: string;
  /** The box's side in pixels. */
  size?: number;
  /** Override how a star looks; the default is its standing. */
  lookOf?: (id: string, base: StarLook) => StarLook;
  /** Caption under the tile: the glyph and its meaning by default. */
  caption?: "glyph" | "none";
  className?: string;
}

export function ConstellationTile({ graph, id, size = 64, lookOf, caption = "glyph", className = "" }: ConstellationTileProps) {
  const item = graph.itemOf(id);
  const layout = layoutConstellation(graph.constellationOf(id));
  const box = size + 16;
  const look = (star: string): StarLook => {
    const it = graph.itemOf(star);
    const base: StarLook = { role: roleOf(it?.kind ?? "word"), body: bodyOf(it?.kind ?? "word"), standing: it?.standing ?? "not-seen" };
    return lookOf ? lookOf(star, base) : base;
  };
  return (
    <figure className={`flex flex-col items-center gap-1 ${className}`}>
      <svg viewBox={`0 0 ${box} ${box}`} width={box} height={box} role="img" aria-label={item ? `${item.glyph}, ${item.english}` : id}>
        <ConstellationFigure layout={layout} cx={box / 2} cy={box / 2} r={size / 2 - 4} unit={size / 70} lookOf={look} />
      </svg>
      {caption === "glyph" && item && (
        <figcaption className="text-center font-sky-ui text-[12px] text-sky-muted">
          <span className={`font-sky-display text-[15px] ${STANDING[item.standing].text} ${japaneseFont(item.glyph)}`}>{item.glyph}</span> {item.english}
        </figcaption>
      )}
    </figure>
  );
}
