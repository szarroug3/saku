"use client";

// The sky canvas: the surface every constellation is drawn on. Tracked as
// SAK-329.
//
// One SVG with a seeded scatter of faint dust stars (a few twinkle; reduced
// motion turns that off) and a viewport group the children draw into, so
// the whole sky transforms as one. The sky is a WORLD of a fixed size, and
// the svg is a window onto it: `width` by `height` is what the window shows
// at 100%, `worldWidth` by `worldHeight` is the sky itself. When the window
// is smaller than the world, panning reaches the rest; when it is larger,
// the world sits centred. So nothing on the sky moves when the window
// changes shape. When `interactive`, the home's controls: drag to pan,
// scroll to zoom toward the cursor, plus, minus and reset, 100% to 600%,
// clamped so the world's edges never leave the frame. The maths is guarded
// for an element with no size (a hidden tab), so no NaN ever reaches a
// transform.
//
// The wash behind it is the page's, not the canvas's: this is transparent.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { hashUnit } from "@/sky/lib/constellation";

export interface SkyCanvasProps {
  /** The window, in sky units: what shows at 100%. */
  width: number;
  height: number;
  /** The world, in sky units: where the children are. Defaults to the window. */
  worldWidth?: number;
  worldHeight?: number;
  /** Pan and zoom, with the buttons. Off for previews and tiles. */
  interactive?: boolean;
  /** How many dust stars to scatter. */
  dust?: number;
  /** Seeds the dust, so two skies on one page do not share a pattern. */
  seed?: string;
  /** Fill the box: the svg takes the box's height rather than its own aspect. */
  fill?: boolean;
  label: string;
  className?: string;
  children?: ReactNode;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const STEP = 1.3;
const WHEEL_STEP = 1.15;

export function SkyCanvas({ width, height, worldWidth = width, worldHeight = height, interactive = false, dust = 90, seed = "sky", fill = false, label, className = "", children }: SkyCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);

  // The world's edges never leave the window; a world smaller than the
  // window sits centred. Applied to the stored view on every render, so a
  // window that changes shape re-centres without moving anything.
  const clamp = useCallback((v: { k: number; x: number; y: number }) => {
    const axis = (win: number, world: number, at: number) => (world * v.k <= win ? (win - world * v.k) / 2 : Math.min(0, Math.max(win - world * v.k, at)));
    return { k: v.k, x: axis(width, worldWidth, v.x), y: axis(height, worldHeight, v.y) };
  }, [width, height, worldWidth, worldHeight]);
  const shown = clamp(view);

  /** Pointer position in sky units, or null when the element has no size. */
  const toSky = useCallback((clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return null;
    return { x: ((clientX - r.left) / r.width) * width, y: ((clientY - r.top) / r.height) * height, sx: width / r.width, sy: height / r.height };
  }, [width, height]);

  const zoom = useCallback((factor: number, at?: { x: number; y: number }) => {
    setView((v) => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k * factor));
      const ratio = k / v.k;
      const px = at?.x ?? width / 2, py = at?.y ?? height / 2;
      return clamp({ k, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio });
    });
  }, [clamp, width, height]);

  // wheel must be a non-passive listener to stop the page scrolling under the sky
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const at = toSky(e.clientX, e.clientY);
      zoom(e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP, at ?? undefined);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [interactive, toSky, zoom]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || e.button !== 0) return;
    drag.current = { px: e.clientX, py: e.clientY, vx: shown.x, vy: shown.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const u = toSky(e.clientX, e.clientY);
    if (!u) return;
    setView((v) => clamp({ k: v.k, x: d.vx + (e.clientX - d.px) * u.sx, y: d.vy + (e.clientY - d.py) * u.sy }));
  };
  const onPointerUp = () => { drag.current = null; };

  const dustStars = useMemo(() => Array.from({ length: dust }, (_, i) => ({
    x: hashUnit(`${seed}:x${i}`) * worldWidth,
    y: hashUnit(`${seed}:y${i}`) * worldHeight,
    r: 0.4 + hashUnit(`${seed}:r${i}`) * 0.9,
    o: 0.2 + hashUnit(`${seed}:o${i}`) * 0.4,
    twinkle: i % 6 === 0,
    delay: hashUnit(`${seed}:t${i}`) * 3,
  })), [dust, seed, worldWidth, worldHeight]);

  return (
    <div className={`relative ${fill ? "h-full w-full" : ""} ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={label}
        className={`block w-full select-none ${fill ? "h-full" : "h-auto"} ${interactive ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <g data-view transform={`translate(${shown.x} ${shown.y}) scale(${shown.k})`}>
          <g data-dust>
            {dustStars.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="var(--sky-star)" opacity={d.o} className={d.twinkle ? "sky-twinkle" : undefined} style={d.twinkle ? { animationDelay: `${d.delay}s` } : undefined} />
            ))}
          </g>
          {children}
        </g>
      </svg>
      {interactive && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border border-sky-line bg-sky-card-strong p-1 font-sky-ui text-[12px] text-sky-ink">
          <button type="button" aria-label="Zoom out" onClick={() => zoom(1 / STEP)} className="h-7 w-7 rounded-full hover:bg-sky-card">−</button>
          <button type="button" aria-label="Reset the view" onClick={() => setView({ k: 1, x: 0, y: 0 })} className="h-7 min-w-[3.5rem] rounded-full px-2 tabular-nums hover:bg-sky-card">{Math.round(shown.k * 100)}%</button>
          <button type="button" aria-label="Zoom in" onClick={() => zoom(STEP)} className="h-7 w-7 rounded-full hover:bg-sky-card">+</button>
        </div>
      )}
    </div>
  );
}
