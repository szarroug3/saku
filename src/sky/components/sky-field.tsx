"use client";

// A field of constellations: the learner's sky. Tracked as SAK-329, 333, 335.
//
// Takes the items and the ids of the constellations to show, builds the
// graph, lays every constellation out (seeded, so a word keeps its shape),
// sizes each by its stars, scatters them without overlap (seeded, so a word
// keeps its place), and draws them on a SkyCanvas. Each constellation gets a
// generous transparent hit area inside the pan and zoom group, so it follows
// the sky; hovering or focusing it shows the tooltip, which follows the
// cursor and flips to stay inside the field. No labels: hover names things.
//
// The home uses it at full size with pan and zoom; the Planetarium's preview
// and the lesson use the same field smaller or larger, with their own looks
// (tonight's picks faint; the lesson's own clickable stars on top).

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { ConstellationFigure, type StarLook } from "@/sky/components/constellation";
import { SkyCanvas } from "@/sky/components/sky-canvas";
import { SkyTooltip } from "@/sky/components/sky-tooltip";
import { layoutConstellation, roleOf, sizeFor } from "@/sky/lib/constellation";
import { buildGraph, type PrerequisiteGraph } from "@/sky/lib/graph";
import { scatterLayout, type Placed } from "@/sky/lib/scatter";
import { bySizeDesc } from "@/sky/lib/sky-scene";
import type { SkyItem } from "@/sky/lib/types";

export interface SkyFieldProps {
  items: readonly SkyItem[];
  /** The constellations to draw, by root id. */
  roots: readonly string[];
  width?: number;
  height?: number;
  /** Space between constellations and from the edges, in sky units. */
  pad?: number;
  /** A one-star constellation's box; every star adds to it. 48 on the home. */
  baseSize?: number;
  interactive?: boolean;
  /** Roots picked for tonight and not yet learned: their unlearned stars draw faint and dashed. */
  tonight?: ReadonlySet<string>;
  /** Override how a star looks; the default is its standing. */
  lookOf?: (id: string, base: StarLook) => StarLook;
  /** Draw lines only; the caller puts its own stars on the positions. */
  dots?: boolean;
  /** Only the English name in the tooltip. */
  briefTooltip?: boolean;
  /** A graph built by the caller, to share with panels beside the field. */
  graph?: PrerequisiteGraph;
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

interface Hover { root: string; x: number; y: number; flipX: boolean; flipY: boolean }

export function SkyField({ items, roots, width = 1120, height = 460, pad = 26, baseSize = 48, interactive = false, tonight, lookOf, dots = true, briefTooltip = false, graph: given, label, seed = "sky", className = "", children }: SkyFieldProps) {
  const graph = useMemo(() => given ?? buildGraph(items), [given, items]);
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

  // the tooltip: which constellation, and where the pointer is, in the field's own pixels
  const fieldRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  // the flip is decided here, in the event, where reading the rect is allowed
  const place = (root: string, clientX: number, clientY: number) => {
    const r = fieldRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const x = clientX - r.left, y = clientY - r.top;
    setHover({ root, x, y, flipX: x > r.width * 0.6, flipY: y > r.height * 0.6 });
  };

  const hoverItem = hover ? graph.itemOf(hover.root) : undefined;
  const hoverPieces = hover ? graph.closureOf(hover.root).map((id) => graph.itemOf(id)).filter((x): x is SkyItem => !!x) : [];

  return (
    <div ref={fieldRef} className={`relative ${className}`} onPointerLeave={() => setHover(null)}>
      <SkyCanvas width={width} height={height} interactive={interactive} label={label} seed={seed}>
        {placed.map((p) => (
          <ConstellationFigure key={p.root} layout={layouts.get(p.root)!} cx={p.cx} cy={p.cy} r={p.r} unit={p.size / 70} lookOf={(id) => baseLook(p.root, id)} dots={dots} />
        ))}
        {children?.(placed)}
        {/* hit areas last, so they sit above the stars */}
        <g data-hits>
          {placed.map((p) => (
            <rect
              key={p.root}
              x={p.x - 8} y={p.y - 8} width={p.size + 16} height={p.size + 16} rx={10}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={graph.itemOf(p.root)?.english ?? p.root}
              data-hit={p.root}
              onPointerEnter={(e) => place(p.root, e.clientX, e.clientY)}
              onPointerMove={(e) => place(p.root, e.clientX, e.clientY)}
              onPointerLeave={() => setHover(null)}
              onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); place(p.root, r.left + r.width / 2, r.top + r.height / 2); }}
              onBlur={() => setHover(null)}
              className="outline-none focus-visible:stroke-[var(--sky-gold)] focus-visible:[stroke-width:1.5]"
            />
          ))}
        </g>
      </SkyCanvas>
      {hover && hoverItem && (
        <div
          className="pointer-events-none absolute z-10"
          style={{ left: hover.x, top: hover.y, transform: `translate(${hover.flipX ? "calc(-100% - 14px)" : "14px"}, ${hover.flipY ? "calc(-100% - 14px)" : "14px"})` }}
          role="tooltip"
        >
          <SkyTooltip item={hoverItem} pieces={hoverPieces} brief={briefTooltip} />
        </div>
      )}
    </div>
  );
}
