"use client";

// A field of constellations: the learner's sky. Tracked as SAK-329, 333, 335.
//
// Takes the items and the ids of the constellations to show, builds the
// graph, lays every constellation out (seeded, so a word keeps its shape),
// sizes each by its stars, scatters them without overlap (seeded, so a word
// keeps its place) across a WORLD of fixed size, and draws them on a
// SkyCanvas whose window shows as much of that world as fits: a box that
// changes shape shows more or less sky, and never moves a constellation.
//
// Hovering a star names it: the tooltip for THAT star, the radical, the
// kanji or the word, following the cursor and flipping to stay inside the
// field. No labels; hover names things. A sky of a few thousand stars gives
// each one a transparent hit circle inside the pan and zoom group, so it
// follows the sky and can be focused and clicked. A sky of tens of
// thousands does not: it works out the nearest star from the positions it
// has already placed (SAK-411). Zoomed out, a star's dot is a third of a
// pixel wide, so a circle round it was never something anyone could aim at,
// and there were 37,702 of them in the DOM.
//
// The home uses it at full size with pan and zoom; the Planetarium's preview
// and the lesson use the same field smaller or larger, with their own looks
// (tonight's picks faint; the lesson's own clickable stars on top).

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { ConstellationFigure, type StarLook } from "@/sky/components/constellation";
import { SkyCanvas, type SkyView } from "@/sky/components/sky-canvas";
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
  /** Faint lines to undiscovered stars, for a sky about what is coming. */
  fog?: boolean;
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

/** Above this many constellations a field stops drawing what the window
 * cannot show. Below it the whole sky is cheap, and drawing it whole keeps
 * the previews and the lesson simple. */
const CULL_ABOVE = 400;
/** The world is cut into this many columns for that: a pan redraws only
 * when it crosses one, and a cell of slack is kept on every side. */
const CULL_CELLS = 24;
/** Stars stop taking hit circles below this much of their natural size. A
 * dot that small cannot be aimed at, and there can be tens of thousands. */
const HIT_ZOOM = 0.34;
/** Above this many stars nobody gets a hit circle and the sky finds the
 * nearest star itself (SAK-411). One transparent circle per star is one
 * more element to draw, one more thing for the browser to hit-test on every
 * move, and one more tab stop: on the whole sky that was 37,702 of each. A
 * pointer move against the placed positions is a loop over an array the
 * field has already built, and it names the nearest star rather than the
 * one you managed to land on. */
const HIT_CIRCLES_UP_TO = 2000;
/** How near the pointer has to be to name a star, in screen pixels, when
 * the star's own dot is smaller than that. Zoomed out a dot is a third of a
 * pixel wide, so without this there would be nothing to hover at all. */
const HIT_SLOP = 8;

export function SkyField({ items, roots, width = 1120, height = 900, pad = 26, baseSize = 48, interactive = false, tonight, firmament = [], firmamentBase = 14, focus, openOn, lookOf, dots = true, fog = false, briefTooltip = false, onStarClick, starDisabled, graph: given, fill = false, label, seed = "sky", className = "", children }: SkyFieldProps) {
  const graph = useMemo(() => given ?? buildGraph(items), [given, items]);
  const fieldRef = useRef<HTMLDivElement>(null);
  const rootSet = useMemo(() => new Set(roots), [roots]);
  const all = useMemo(() => [...roots, ...firmament.filter((id) => !rootSet.has(id))].filter((id) => graph.has(id)), [roots, firmament, rootSet, graph]);
  const baseLook = useCallback((root: string, id: string): StarLook => {
    const it = graph.itemOf(id);
    const standing = it?.standing ?? "not-seen";
    const look: StarLook = { role: roleOf(it?.kind ?? "word"), body: bodyOf(it?.kind ?? "word"), standing, tonight: tonight?.has(root) && standing === "not-seen" };
    return lookOf ? lookOf(id, look) : look;
  }, [graph, tonight, lookOf]);

  const layouts = useMemo(() => new Map(all.map((r) => [r, layoutConstellation(graph.constellationOf(r))] as const)), [graph, all]);
  // What is laid out at all, so the sky packs around what is shown rather
  // than scattering it across a world sized for everything (Sam,
  // 2026-09-06). A constellation IS its root: it is drawn when the ROOT is,
  // and `lookOf` is the whole filter, star by star. Asking instead whether
  // ANY star showed drew every undiscovered word that happened to hold a
  // kanji the learner knows, and a kanji sits in dozens of words, so
  // filtering to Words alone put thousands of stray pieces in the sky.
  const drawn = useMemo(() => all.filter((r) => {
    const l = layouts.get(r);
    if (!l) return false;
    // a grouping (a kana row) is never a star of its own, so it shows for
    // as long as anything under it does
    const root = l.stars.find((st) => st.id === r);
    return root && !root.group ? !baseLook(r, r).hidden : l.stars.some((st) => !st.group && !baseLook(r, st.id).hidden);
  }), [all, layouts, baseLook]);
  const { placed, world } = useMemo(() => {
    // a box by star count, and never smaller than the root's body: a planet's
    // ring must fit inside it (the body scales with the box, so settle twice)
    const unit = (size: number) => Math.max(0.7, Math.min(1.8, size / 70));
    const boxes = drawn.map((root) => {
      const l = layouts.get(root)!;
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
  }, [drawn, layouts, graph, baseSize, firmamentBase, rootSet, firmament.length, width, height, pad]);

  const opening = useMemo(() => {
    const on = openOn ? placed.find((p) => p.root === openOn) : undefined;
    return on ? { x: on.cx, y: on.cy } : undefined;
  }, [openOn, placed]);

  // ---- what the window can show ----
  //
  // A sky of everything is fifteen thousand constellations across a world a
  // hundred windows wide, so all but a hundredth of it is off screen at any
  // moment. The band is the cells the window covers, so a pan redraws only
  // when it crosses one; the band the sky OPENS on is worked out from
  // `focus` alone, since the server has no window to measure and must
  // render what the client first draws.
  const cell = Math.max(1, world.width / CULL_CELLS);
  const culling = placed.length > CULL_ABOVE;
  const opened = useMemo(() => {
    const span = focus ?? world.width;
    const cx = opening?.x ?? span / 2, cy = opening?.y ?? span / 2;
    return `${Math.floor((cx - span) / cell)} ${Math.floor((cy - span) / cell)} ${Math.floor((cx + span) / cell)} ${Math.floor((cy + span) / cell)} 1`;
  }, [focus, opening, world.width, cell]);
  const [band, setBand] = useState<string | null>(null);
  const onView = useCallback((v: SkyView) => {
    const key = `${Math.floor(v.x / cell)} ${Math.floor(v.y / cell)} ${Math.floor((v.x + v.w) / cell)} ${Math.floor((v.y + v.h) / cell)} ${v.k >= HIT_ZOOM ? 1 : 0}`;
    setBand((prev) => (prev === key ? prev : key));
  }, [cell]);
  const { seen, hittable } = useMemo(() => {
    if (!culling) return { seen: placed, hittable: true };
    const [x0, y0, x1, y1, h] = (band ?? opened).split(" ").map(Number);
    // a cell of slack on every side, so the next small pan draws nothing new
    const left = (x0 - 1) * cell, right = (x1 + 2) * cell, top = (y0 - 1) * cell, bottom = (y1 + 2) * cell;
    return { seen: placed.filter((p) => p.x < right && p.x + p.size > left && p.y < bottom && p.y + p.size > top), hittable: h === 1 };
  }, [culling, placed, band, opened, cell]);

  // the tooltip: which star, and where it hangs, decided in the event
  const [hover, setHover] = useState<Hover | null>(null);
  const place = useCallback((id: string, root: string, clientX: number, clientY: number) => setHover({ id, root, at: pointerAnchor(clientX, clientY) }), []);

  const hoverItem = hover ? graph.itemOf(hover.id) : undefined;
  // a star picked for tonight, or opened in the lesson, is named in full
  const hoverLook = hover ? baseLook(hover.root, hover.id) : undefined;
  const hoverTonight = !!hoverLook && !!(hoverLook.tonight || hoverLook.lit || hoverLook.emphasis);
  const hoverPieces = hover ? graph.closureOf(hover.id).map((id) => graph.itemOf(id)).filter((x): x is SkyItem => !!x) : [];
  // Where every star on screen IS, and how near counts as hitting it.
  // Memoised because it is the same walk over every drawn constellation
  // that the drawing itself does, and hovering a star must not set that
  // walk going again (SAK-411).
  const hits = useMemo(() => seen.flatMap((p) => placeConstellation(layouts.get(p.root)!, p.cx, p.cy, p.r).filter((s) => !s.group && !baseLook(p.root, s.id).hidden).map((s) => ({ key: `${p.root}/${s.id}`, id: s.id, root: p.root, x: s.px, y: s.py, r: bodyRadius(bodyOf(graph.itemOf(s.id)?.kind ?? "word"), roleOf(graph.itemOf(s.id)?.kind ?? "word")) * Math.max(0.7, Math.min(1.8, p.size / 70)) + 5 }))), [seen, layouts, baseLook, graph]);
  // one hit circle per star, up to the point where that is absurd
  const circles = hittable && hits.length <= HIT_CIRCLES_UP_TO ? hits : [];

  // ---- naming a star without a circle round it ----
  //
  // The pointer's place in the world comes from the browser's own matrix
  // for the pan and zoom group, so this stays right through a gesture that
  // the field never hears about.
  const viewGroup = useRef<SVGGraphicsElement | null>(null);
  const nearest = useCallback((clientX: number, clientY: number) => {
    const g = viewGroup.current ?? (viewGroup.current = fieldRef.current?.querySelector<SVGGraphicsElement>("[data-view]") ?? null);
    const svg = fieldRef.current?.querySelector("svg");
    const ctm = g?.getScreenCTM();
    if (!g || !svg || !ctm) return null;
    const at = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    // a world unit is this many pixels, so the slop is honest at every zoom
    const perPixel = 1 / Math.max(1e-6, Math.abs(ctm.a));
    const slop = HIT_SLOP * perPixel;
    let best: (typeof hits)[number] | null = null;
    let bestD = Infinity;
    for (const h of hits) {
      const dx = h.x - at.x, dy = h.y - at.y;
      const d = dx * dx + dy * dy;
      const reach = Math.max(h.r, slop);
      if (d < bestD && d <= reach * reach) { best = h; bestD = d; }
    }
    return best;
  }, [hits]);
  const useNearest = circles.length === 0 && hits.length > 0;
  const onFieldMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!useNearest) return;
    // a pan owns the pointer, and a sky sliding under the cursor should not
    // be naming whatever it slides past
    const svg = fieldRef.current?.querySelector("svg");
    if (svg?.hasPointerCapture(e.pointerId)) { setHover(null); return; }
    const near = nearest(e.clientX, e.clientY);
    if (near) place(near.id, near.root, e.clientX, e.clientY);
    else setHover(null);
  };
  // where the press started, so the click that ends a pan is not a pick
  const pressed = useRef<{ x: number; y: number } | null>(null);
  const onFieldDown = (e: React.PointerEvent<HTMLDivElement>) => { pressed.current = { x: e.clientX, y: e.clientY }; };
  const onFieldClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!useNearest || !onStarClick) return;
    const from = pressed.current;
    pressed.current = null;
    if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > 4) return;
    const near = nearest(e.clientX, e.clientY);
    if (near && !(starDisabled?.(near.id) ?? false)) { setHover(null); onStarClick(near.id); }
  };

  // The drawing, held still while the tooltip comes and goes. `setHover`
  // renders this component, and without this it would rebuild every
  // constellation to produce exactly what was already on screen: on the
  // whole sky that was 175,000 elements reconciled for one tooltip, and
  // measured at 217ms with not a single DOM change to show for it.
  const drawing = useMemo(() => seen.map((p) => (
    <ConstellationFigure key={p.root} layout={layouts.get(p.root)!} cx={p.cx} cy={p.cy} r={p.r} unit={p.size / 70} lookOf={(id) => baseLook(p.root, id)} dots={dots} fog={fog} />
  )), [seen, layouts, baseLook, dots, fog]);

  return (
    <div ref={fieldRef} className={`${fill ? "absolute inset-0" : "relative"} ${className}`} onPointerLeave={() => setHover(null)} onPointerDown={onFieldDown} onPointerMove={onFieldMove} onClick={onFieldClick}>
      <SkyCanvas width={world.width} height={world.height} interactive={interactive} label={label} seed={seed} fill={fill} focus={focus} center={opening} onView={culling ? onView : undefined} dust={firmament.length ? 0 : Math.round((90 * world.height) / 460)}>
        {drawing}
        {children?.(placed)}
        {/* hit areas last, so they sit above the stars: one per star */}
        <g data-hits>
          {circles.map((h) => {
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
