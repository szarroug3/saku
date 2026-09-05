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

import { ConstellationFigure, type StarLook } from "@/sky/components/constellation";
import { SkyCanvas } from "@/sky/components/sky-canvas";
import { Floating, pointerAnchor, type Anchor } from "@/sky/components/sky-card";
import { SkyTooltip } from "@/sky/components/sky-tooltip";
import { bodyOf, bodyRadius, layoutConstellation, placeConstellation, roleOf, sizeFor } from "@/sky/lib/constellation";
import { buildGraph, type PrerequisiteGraph } from "@/sky/lib/graph";
import { scatterInWorld, type Placed } from "@/sky/lib/scatter";
import type { SkyItem } from "@/sky/lib/types";

export interface SkyFieldProps {
  items: readonly SkyItem[];
  /** The constellations to draw, by root id. */
  roots: readonly string[];
  /** The smallest world the constellations are scattered across, in sky
   * units; it grows to fit what there is, keeping this shape. Fixed for a
   * given sky, so nothing moves when the box changes; with `fill` the box is
   * a window onto it and pan reaches what it does not show. */
  width?: number;
  height?: number;
  /** Space between constellations and from the edges, in sky units. */
  pad?: number;
  /** A one-star constellation's box; every star adds to it. 48 on the home. */
  baseSize?: number;
  interactive?: boolean;
  /** Roots picked for tonight and not yet learned: their unlearned stars draw faint and dashed. */
  tonight?: ReadonlySet<string>;
  /** The firmament: the sky that is already there before anything is
   * discovered. Every id here is drawn as the constellation it would become
   * (a kanji with its pieces, a kana alone), small and in its standing's
   * colour, scattered with the rest. Discovery only changes colours. */
  firmament?: readonly string[];
  /** A one-star firmament constellation's box; every star adds to it. */
  firmamentBase?: number;
  /** How many world units span the box at 100%; the whole world by default. */
  focus?: number;
  /** The constellation the sky opens on, in the middle of the window; the
   * top left otherwise. */
  openOn?: string;
  /** Override how a star looks; the default is its standing. */
  lookOf?: (id: string, base: StarLook) => StarLook;
  /** Draw lines only; the caller puts its own stars on the positions. */
  dots?: boolean;
  /** Only the English name in the tooltip, for every star or per star (the
   * lesson names a locked star and nothing more). */
  briefTooltip?: boolean | ((id: string) => boolean);
  /** Stars are the navigation: click, Enter or Space picks one. */
  onStarClick?: (id: string) => void;
  /** A star that ignores input, and says so to assistive tech. */
  starDisabled?: (id: string) => boolean;
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

interface Hover { id: string; /** the constellation it was hovered in, for its look */ root: string; at: Anchor }

export function SkyField({ items, roots, width = 1120, height = 900, pad = 26, baseSize = 48, interactive = false, tonight, firmament = [], firmamentBase = 14, focus, openOn, lookOf, dots = true, briefTooltip = false, onStarClick, starDisabled, graph: given, fill = false, label, seed = "sky", className = "", children }: SkyFieldProps) {
  const graph = useMemo(() => given ?? buildGraph(items), [given, items]);
  const fieldRef = useRef<HTMLDivElement>(null);
  const rootSet = useMemo(() => new Set(roots), [roots]);
  const all = useMemo(() => [...roots, ...firmament.filter((id) => !rootSet.has(id))].filter((id) => graph.has(id)), [roots, firmament, rootSet, graph]);
  const layouts = useMemo(() => new Map(all.map((r) => [r, layoutConstellation(graph.constellationOf(r))] as const)), [graph, all]);
  const { placed, world } = useMemo(() => {
    // a box by star count, and never smaller than the root's body: a planet's
    // ring must fit inside it (the body scales with the box, so settle twice)
    const unit = (size: number) => Math.max(0.7, Math.min(1.8, size / 70));
    const boxes = [...layouts].map(([root, l]) => {
      const kind = graph.itemOf(root)?.kind ?? "word";
      const reach = bodyRadius(bodyOf(kind), roleOf(kind));
      let size = sizeFor(l.stars.length, rootSet.has(root) ? baseSize : firmamentBase);
      for (let i = 0; i < 2; i++) size = Math.max(size, Math.ceil(2 * reach * unit(size) + 10));
      return { key: root, size };
    });
    const gap = firmament.length ? Math.min(pad, 18) : pad;
    const { placed: laid, world } = scatterInWorld(boxes, { width, height }, gap);
    const placed: PlacedConstellation[] = laid.map((p) => ({ ...p, root: p.item.key, cx: p.x + p.size / 2, cy: p.y + p.size / 2, r: p.size / 2 - 3 }));
    return { placed, world };
  }, [layouts, graph, baseSize, firmamentBase, rootSet, firmament.length, width, height, pad]);

  const baseLook = useCallback((root: string, id: string): StarLook => {
    const it = graph.itemOf(id);
    const standing = it?.standing ?? "not-seen";
    const look: StarLook = { role: roleOf(it?.kind ?? "word"), body: bodyOf(it?.kind ?? "word"), standing, tonight: tonight?.has(root) && standing === "not-seen" };
    return lookOf ? lookOf(id, look) : look;
  }, [graph, tonight, lookOf]);

  const opening = useMemo(() => {
    const on = openOn ? placed.find((p) => p.root === openOn) : undefined;
    return on ? { x: on.cx, y: on.cy } : undefined;
  }, [openOn, placed]);

  // the tooltip: which star, and where it hangs, decided in the event
  const [hover, setHover] = useState<Hover | null>(null);
  const place = (id: string, root: string, clientX: number, clientY: number) => setHover({ id, root, at: pointerAnchor(clientX, clientY) });

  const hoverItem = hover ? graph.itemOf(hover.id) : undefined;
  // a star picked for tonight, or opened in the lesson, is named in full
  const hoverLook = hover ? baseLook(hover.root, hover.id) : undefined;
  const hoverTonight = !!hoverLook && !!(hoverLook.tonight || hoverLook.lit || hoverLook.emphasis);
  const hoverPieces = hover ? graph.closureOf(hover.id).map((id) => graph.itemOf(id)).filter((x): x is SkyItem => !!x) : [];
  // one hit circle per star, sized to its dot plus some slack
  const hits = placed.flatMap((p) => placeConstellation(layouts.get(p.root)!, p.cx, p.cy, p.r).filter((s) => !s.group && !baseLook(p.root, s.id).hidden).map((s) => ({ key: `${p.root}/${s.id}`, id: s.id, root: p.root, x: s.px, y: s.py, r: bodyRadius(bodyOf(graph.itemOf(s.id)?.kind ?? "word"), roleOf(graph.itemOf(s.id)?.kind ?? "word")) * Math.max(0.7, Math.min(1.8, p.size / 70)) + 5 })));

  return (
    <div ref={fieldRef} className={`${fill ? "absolute inset-0" : "relative"} ${className}`} onPointerLeave={() => setHover(null)}>
      <SkyCanvas width={world.width} height={world.height} interactive={interactive} label={label} seed={seed} fill={fill} focus={focus} center={opening} dust={firmament.length ? 0 : Math.round((90 * world.height) / 460)}>
        {placed.map((p) => (
          <ConstellationFigure key={p.root} layout={layouts.get(p.root)!} cx={p.cx} cy={p.cy} r={p.r} unit={p.size / 70} lookOf={(id) => baseLook(p.root, id)} dots={dots} />
        ))}
        {children?.(placed)}
        {/* hit areas last, so they sit above the stars: one per star */}
        <g data-hits>
          {hits.map((h) => {
            const disabled = starDisabled?.(h.id) ?? false;
            const pick = () => { if (!disabled) { setHover(null); onStarClick?.(h.id); } };
            return (
              <circle
                key={h.key}
                cx={h.x} cy={h.y} r={h.r}
                fill="transparent"
                tabIndex={disabled ? -1 : 0}
                role="button"
                aria-label={graph.itemOf(h.id)?.english ?? h.id}
                aria-disabled={disabled || undefined}
                data-hit={h.id}
                onPointerEnter={(e) => place(h.id, h.root, e.clientX, e.clientY)}
                onPointerMove={(e) => place(h.id, h.root, e.clientX, e.clientY)}
                onPointerLeave={() => setHover(null)}
                onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); place(h.id, h.root, r.left + r.width / 2, r.top + r.height / 2); }}
                onBlur={() => setHover(null)}
                onClick={onStarClick ? pick : undefined}
                onKeyDown={onStarClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } } : undefined}
                className={`outline-none focus-visible:stroke-[var(--sky-accent)] focus-visible:[stroke-width:1.5] ${onStarClick && !disabled ? "cursor-pointer" : ""}`}
              />
            );
          })}
        </g>
      </SkyCanvas>
      {hover && hoverItem && (
        <Floating at={hover.at}>
          <SkyTooltip item={hoverItem} pieces={hoverPieces} tonight={hoverTonight} brief={typeof briefTooltip === "function" ? briefTooltip(hover.id) : briefTooltip} />
        </Floating>
      )}
    </div>
  );
}
