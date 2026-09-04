"use client";

// A field of constellations: the learner's sky. Tracked as SAK-329, 333, 335.
//
// Takes the items and the ids of the constellations to show, builds the
// graph, lays every constellation out (seeded, so a word keeps its shape),
// sizes each by its stars, scatters them without overlap (seeded, so a word
// keeps its place) across a WORLD of fixed size, and draws them on a
// SkyCanvas whose window shows as much of that world as fits: a box that
// changes shape shows more or less sky, and never moves a constellation. Every star gets a
// transparent hit circle inside the pan and zoom group, so it follows the
// sky; hovering or focusing it shows the tooltip for THAT star, the radical,
// the kanji or the word, which follows the cursor and flips to stay inside
// the field. No labels: hover names things.
//
// The home uses it at full size with pan and zoom; the Planetarium's preview
// and the lesson use the same field smaller or larger, with their own looks
// (tonight's picks faint; the lesson's own clickable stars on top).

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { ConstellationFigure, paintFor, type StarLook } from "@/sky/components/constellation";
import { SkyCanvas } from "@/sky/components/sky-canvas";
import { SkyTooltip } from "@/sky/components/sky-tooltip";
import { hashUnit, layoutConstellation, placeConstellation, roleOf, sizeFor, STAR_RADIUS } from "@/sky/lib/constellation";
import { buildGraph, type PrerequisiteGraph } from "@/sky/lib/graph";
import { scatterLayout, type Placed } from "@/sky/lib/scatter";
import { bySizeDesc } from "@/sky/lib/sky-scene";
import type { SkyItem } from "@/sky/lib/types";

export interface SkyFieldProps {
  items: readonly SkyItem[];
  /** The constellations to draw, by root id. */
  roots: readonly string[];
  /** The world the constellations are scattered across, in sky units.
   * Fixed, so nothing moves when the box changes; with `fill` the box is a
   * window onto it and pan reaches what it does not show. */
  width?: number;
  height?: number;
  /** Space between constellations and from the edges, in sky units. */
  pad?: number;
  /** A one-star constellation's box; every star adds to it. 48 on the home. */
  baseSize?: number;
  interactive?: boolean;
  /** Roots picked for tonight and not yet learned: their unlearned stars draw faint and dashed. */
  tonight?: ReadonlySet<string>;
  /** The firmament: single stars at seeded points across the whole world,
   * under the constellations, each hoverable. The sky that is already there
   * before anything is discovered: every kana, piece and kanji. */
  firmament?: readonly string[];
  /** Override how a star looks; the default is its standing. */
  lookOf?: (id: string, base: StarLook) => StarLook;
  /** Draw lines only; the caller puts its own stars on the positions. */
  dots?: boolean;
  /** Only the English name in the tooltip. */
  briefTooltip?: boolean;
  /** A graph built by the caller, to share with panels beside the field. */
  graph?: PrerequisiteGraph;
  /** Fill the box the field sits in (which must be positioned): the field
   * pins to the box's edges and the box becomes a window onto the world,
   * cropped, so the sky can be most of the page. */
  fill?: boolean;
  label: string;
  seed?: string;
  className?: string;
  /** Anything to draw over the field, in sky units, inside the pan and zoom group. */
  children?: (placed: readonly PlacedConstellation[]) => ReactNode;
}

export interface PlacedConstellation extends Placed<{ key: string; size: number }> {
  root: string;
  cx: number;
  cy: number;
  r: number;
}

interface Hover { id: string; x: number; y: number; flipX: boolean; flipY: boolean; w: number; h: number }

export function SkyField({ items, roots, width = 1120, height = 900, pad = 26, baseSize = 48, interactive = false, tonight, firmament = [], lookOf, dots = true, briefTooltip = false, graph: given, fill = false, label, seed = "sky", className = "", children }: SkyFieldProps) {
  const graph = useMemo(() => given ?? buildGraph(items), [given, items]);
  const fieldRef = useRef<HTMLDivElement>(null);
  const layouts = useMemo(() => new Map(roots.filter((r) => graph.has(r)).map((r) => [r, layoutConstellation(graph.constellationOf(r))] as const)), [graph, roots]);
  const placed = useMemo<PlacedConstellation[]>(() => {
    const boxes = bySizeDesc([...layouts].map(([root, l]) => ({ key: root, size: sizeFor(l.stars.length, baseSize) })), (b) => b.size);
    return scatterLayout(boxes, width, height, pad).map((p) => ({ ...p, root: p.item.key, cx: p.x + p.size / 2, cy: p.y + p.size / 2, r: p.size / 2 - 4 }));
  }, [layouts, baseSize, width, height, pad]);

  const baseLook = useCallback((root: string, id: string): StarLook => {
    const it = graph.itemOf(id);
    const standing = it?.standing ?? "not-seen";
    const look: StarLook = { role: roleOf(it?.kind ?? "word"), standing, tonight: tonight?.has(root) && standing === "not-seen" };
    return lookOf ? lookOf(id, look) : look;
  }, [graph, tonight, lookOf]);

  // the tooltip: which star, and where the pointer is, in the field's own pixels
  const [hover, setHover] = useState<Hover | null>(null);
  // the flip is decided here, in the event, where reading the rect is allowed
  const place = (id: string, clientX: number, clientY: number) => {
    const r = fieldRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const x = clientX - r.left, y = clientY - r.top;
    setHover({ id, x, y, flipX: x > r.width * 0.6, flipY: y > r.height * 0.6, w: r.width, h: r.height });
  };

  const hoverItem = hover ? graph.itemOf(hover.id) : undefined;
  const hoverPieces = hover ? graph.closureOf(hover.id).map((id) => graph.itemOf(id)).filter((x): x is SkyItem => !!x) : [];
  // the firmament's points: seeded by id, anywhere in the world but its edges
  const points = useMemo(() => firmament.filter((id) => graph.has(id)).map((id) => ({ id, x: 12 + hashUnit(`${id}#fx`) * (width - 24), y: 12 + hashUnit(`${id}#fy`) * (height - 24) })), [firmament, graph, width, height]);
  // one hit circle per star, sized to its dot plus some slack
  const hits = [
    ...points.map((p) => ({ key: `firmament/${p.id}`, id: p.id, x: p.x, y: p.y, r: 6 })),
    ...placed.flatMap((p) => placeConstellation(layouts.get(p.root)!, p.cx, p.cy, p.r).map((s) => ({ key: `${p.root}/${s.id}`, id: s.id, x: s.px, y: s.py, r: STAR_RADIUS[roleOf(graph.itemOf(s.id)?.kind ?? "word")] * Math.max(0.7, Math.min(1.8, p.size / 70)) + 7 }))),
  ];

  return (
    <div ref={fieldRef} className={`${fill ? "absolute inset-0" : "relative"} ${className}`} onPointerLeave={() => setHover(null)}>
      <SkyCanvas width={width} height={height} interactive={interactive} label={label} seed={seed} fill={fill} dust={points.length ? 0 : Math.round((90 * height) / 460)}>
        {points.length > 0 && (
          <g data-firmament>
            {points.map((p) => {
              const look = baseLook(p.id, p.id);
              const paint = paintFor(look);
              return <circle key={p.id} data-firmament-star={p.id} cx={p.x} cy={p.y} r={1.3} fill={paint.fill} opacity={look.muted ? 0.12 : paint.opacity} />;
            })}
          </g>
        )}
        {placed.map((p) => (
          <ConstellationFigure key={p.root} layout={layouts.get(p.root)!} cx={p.cx} cy={p.cy} r={p.r} unit={p.size / 70} lookOf={(id) => baseLook(p.root, id)} dots={dots} />
        ))}
        {children?.(placed)}
        {/* hit areas last, so they sit above the stars: one per star */}
        <g data-hits>
          {hits.map((h) => (
            <circle
              key={h.key}
              cx={h.x} cy={h.y} r={h.r}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={graph.itemOf(h.id)?.english ?? h.id}
              data-hit={h.id}
              onPointerEnter={(e) => place(h.id, e.clientX, e.clientY)}
              onPointerMove={(e) => place(h.id, e.clientX, e.clientY)}
              onPointerLeave={() => setHover(null)}
              onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); place(h.id, r.left + r.width / 2, r.top + r.height / 2); }}
              onBlur={() => setHover(null)}
              className="outline-none focus-visible:stroke-[var(--sky-gold)] focus-visible:[stroke-width:1.5]"
            />
          ))}
        </g>
      </SkyCanvas>
      {hover && hoverItem && (
        <div
          className="pointer-events-none absolute z-10"
          // anchored by whichever edge faces the pointer, so the card always has the
          // room on its far side to lay out at its natural width
          style={{
            ...(hover.flipX ? { right: hover.w - hover.x + 14 } : { left: hover.x + 14 }),
            ...(hover.flipY ? { bottom: hover.h - hover.y + 14 } : { top: hover.y + 14 }),
          }}
          role="tooltip"
        >
          <SkyTooltip item={hoverItem} pieces={hoverPieces} brief={briefTooltip} />
        </div>
      )}
    </div>
  );
}
