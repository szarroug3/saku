"use client";

// The wash editor. Route: /dev/sky/wash
//
// Paints the live wash full screen and lets you work it by hand: drag a glow's
// handle to move it, pick colours, slide strengths and sizes, add and remove
// layers and reorder them. The model comes from src/app/sky-wash.css through
// the dev API; every change previews at once by setting --sky-mesh on <html>
// to the resolved layers; Save renders the file back (Save + bake also
// renders the bitmap the other pages paint); Reset returns to what the file
// last held. The panel only shows in the live CSS mode, the one it edits.
// The stars preview too: the stardust tile is drawn on a canvas from the star
// knobs and set as --sky-stardust, the Milky Way's field as --sky-milky-starfield.

import { useCallback, useEffect, useRef, useState } from "react";

import { bandSpan, gradientDirection, gradientLength, MILKY_CENTRE, stardustPixels, TILE_PX } from "@/sky/lib/sky-stars";
import { DEFAULT_MILKY_SOFTNESS, DEFAULT_MILKY_STARS, DEFAULT_TAIL, nextGlowId, resolvedMesh, resolvedStarfield, type GlowLayer, type MilkyLayer, type Rgb, type WashLayer, type WashModel } from "@/sky/lib/sky-wash-file";

import { StressCards } from "../stress-cards";
import { WashSwitch, type WashMode } from "../wash-switch";

/** How long a button wears its "done" face before going back to its label. */
const DONE_FOR_MS = 2200;

const toHex = (c: Rgb) => "#" + c.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
const fromHex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const colourInput = (value: Rgb, onChange: (c: Rgb) => void) => (
  <input type="color" value={toHex(value)} onChange={(e) => onChange(fromHex(e.target.value))} className="h-7 w-10 cursor-pointer rounded border border-sky-line bg-transparent" />
);

export function WashEditor() {
  const [model, setModel] = useState<WashModel | null>(null);
  // What sky-wash.css last held: set on load and after a save. Reset returns
  // to it, and "unsaved" is the model having drifted from it.
  const [saved, setSaved] = useState<WashModel | null>(null);
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<WashMode>("live");
  const [status, setStatus] = useState<{ text: string; tone: "" | "ok" | "err" }>({ text: "", tone: "" });
  // Button feedback: which save is running, and which one just finished.
  const [busy, setBusy] = useState<"save" | "bake" | null>(null);
  const [done, setDone] = useState<"save" | "bake" | "copy" | "reset" | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (what: NonNullable<typeof done>) => {
    if (doneTimer.current) clearTimeout(doneTimer.current);
    setDone(what);
    doneTimer.current = setTimeout(() => setDone(null), DONE_FOR_MS);
  };
  useEffect(() => () => { if (doneTimer.current) clearTimeout(doneTimer.current); }, []);
  const washRef = useRef<HTMLDivElement>(null);
  // Where the panel sits. Null is the default corner; dragging its header
  // moves it anywhere, since it covers part of the wash.
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const panelDrag = useRef<{ dx: number; dy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onPanelGrab = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const r = panelRef.current?.getBoundingClientRect(); if (!r) return;
    panelDrag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPanelMove = (e: React.PointerEvent) => {
    const d = panelDrag.current; const r = panelRef.current?.getBoundingClientRect(); if (!d || !r) return;
    const x = Math.max(0, Math.min(window.innerWidth - r.width, e.clientX - d.dx));
    const y = Math.max(0, Math.min(window.innerHeight - 80, e.clientY - d.dy));
    setPanelPos({ x, y });
  };
  const onPanelRelease = () => { panelDrag.current = null; };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dev/sky-wash");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.status);
      setModel(body.model);
      setSaved(body.model);
      setStatus({ text: "", tone: "" });
    } catch (err) {
      setStatus({ text: `Could not read sky-wash.css: ${String(err)}`, tone: "err" });
    }
  }, []);
  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);

  // Preview: the resolved layers replace --sky-mesh on <html>, where the live
  // mode reads it. Cleared when the page is left.
  useEffect(() => {
    if (model) document.documentElement.style.setProperty("--sky-mesh", resolvedMesh(model));
  }, [model]);
  // The stardust tile, redrawn only when the star knobs change (the spec keeps
  // its identity across other edits), as a canvas PNG.
  const stars = model?.stars;
  useEffect(() => {
    if (!stars) return;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = TILE_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(TILE_PX, TILE_PX);
    img.data.set(stardustPixels(stars));
    ctx.putImageData(img, 0, 0);
    document.documentElement.style.setProperty("--sky-stardust", `url("${canvas.toDataURL("image/png")}")`);
  }, [stars]);
  const milky = model?.layers.find((l): l is MilkyLayer => l.kind === "milky");
  useEffect(() => {
    if (model) document.documentElement.style.setProperty("--sky-milky-starfield", resolvedStarfield(model));
  }, [model, milky]);
  useEffect(() => () => {
    for (const v of ["--sky-mesh", "--sky-stardust", "--sky-milky-starfield"]) document.documentElement.style.removeProperty(v);
  }, []);

  // The wash's size, for placing the Milky Way handle on its line. The wash
  // fills the window, so the window is measured: a ResizeObserver would only
  // report once the tab renders, and this page is often open in a hidden one.
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const read = () => setBox({ w: window.innerWidth, h: window.innerHeight });
    const t = setTimeout(read, 0);
    window.addEventListener("resize", read);
    return () => { clearTimeout(t); window.removeEventListener("resize", read); };
  }, []);

  const update = useCallback((fn: (m: WashModel) => WashModel) => setModel((m) => (m ? fn(m) : m)), []);
  const setLayer = (i: number, patch: Partial<WashLayer>) => update((m) => ({ ...m, layers: m.layers.map((l, k) => (k === i ? ({ ...l, ...patch } as WashLayer) : l)) }));
  const move = (i: number, dir: -1 | 1) => update((m) => { const l = [...m.layers]; const j = i + dir; if (j < 0 || j >= l.length) return m; [l[i], l[j]] = [l[j], l[i]]; return { ...m, layers: l }; });
  const remove = (i: number) => update((m) => ({ ...m, layers: m.layers.filter((_, k) => k !== i) }));
  const toggle = (i: number) => update((m) => ({ ...m, layers: m.layers.map((l, k) => (k === i ? ({ ...l, visible: !l.visible } as WashLayer) : l)) }));
  const addGlow = () => update((m) => ({ ...m, layers: [{ kind: "glow", visible: true, id: nextGlowId(m), label: `Glow ${nextGlowId(m)}`, colour: [200, 120, 255], strength: 0.4, at: [50, 50], size: [50, 45], tail: [...DEFAULT_TAIL] as GlowLayer["tail"] }, ...m.layers] }));
  const addMilky = () => update((m) => ({ ...m, layers: [{ kind: "milky", visible: true, lilac: [200, 160, 255], pink: [255, 190, 230], strength: 0.18, angle: 112, softness: DEFAULT_MILKY_SOFTNESS, ...DEFAULT_MILKY_STARS, starSize: [...DEFAULT_MILKY_STARS.starSize], starBright: [...DEFAULT_MILKY_STARS.starBright] }, ...m.layers] }));
  const setStars = (patch: Partial<WashModel["stars"]>) => update((m) => ({ ...m, stars: { ...m.stars, ...patch } }));
  const addBand = () => update((m) => ({ ...m, layers: [...m.layers, { kind: "band", visible: true, upper: [96, 46, 168], lower: [110, 60, 190], strength: 0.5, from: 52 }] }));

  // Dragging a handle moves that glow. Ignored while the box has no size (a
  // hidden tab), which would otherwise divide by zero.
  type Grip = "glow" | "band" | "stars";
  const dragging = useRef<{ i: number; grip: Grip } | null>(null);
  const grab = (e: React.PointerEvent, i: number, grip: Grip) => {
    dragging.current = { i, grip };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragging.current; const rect = washRef.current?.getBoundingClientRect();
    if (!d || !rect || rect.width === 0 || rect.height === 0) return;
    if (d.grip === "band" && milky) {
      // project the pointer onto the band's gradient line; the shift is how far the centre moved
      const [dx, dy] = gradientDirection(milky.angle);
      const along = (e.clientX - rect.left - rect.width / 2) * dx + (e.clientY - rect.top - rect.height / 2) * dy;
      const t = along / gradientLength(milky.angle, rect.width, rect.height) + 0.5;
      setLayer(d.i, { shift: Math.max(-60, Math.min(60, Math.round((t - MILKY_CENTRE) * 1000) / 10)) });
      return;
    }
    if (d.grip === "stars" && milky) {
      // the slide is horizontal: how far the pointer is from the band's centre, as % of the width
      const span = bandSpan(milky, rect.width, rect.height);
      const x = ((e.clientX - rect.left - span.cx) / rect.width) * 100;
      setLayer(d.i, { starX: Math.max(-100, Math.min(100, Math.round(x * 10) / 10)) });
      return;
    }
    const x = Math.max(-30, Math.min(130, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(-30, Math.min(130, ((e.clientY - rect.top) / rect.height) * 100));
    setLayer(d.i, { at: [Math.round(x * 10) / 10, Math.round(y * 10) / 10] });
  };
  // where the Milky Way handles sit: MW at the band's centre, on its line
  // through the middle of the wash; the star handle along the band from there
  const milkyHandle = (() => {
    if (!milky || !milky.visible || box.w === 0) return null;
    const span = bandSpan(milky, box.w, box.h);
    // the star handle sits level with the band's centre, slid by the stars' offset
    return { x: span.cx, y: span.cy, starX: span.cx + (milky.starX / 100) * box.w, starY: span.cy, i: model!.layers.indexOf(milky) };
  })();
  const clampX = (x: number) => Math.max(24, Math.min(box.w - 24, x));
  const clampY = (y: number) => Math.max(24, Math.min(box.h - 24, y));
  const onPointerUp = () => { dragging.current = null; };

  const dirty = !!model && !!saved && JSON.stringify(model) !== JSON.stringify(saved);

  const save = async (bake: boolean) => {
    if (!model || busy) return;
    const sending = model;
    setBusy(bake ? "bake" : "save");
    setStatus({ text: bake ? "Saving, then baking the bitmap (a few seconds)…" : "Saving…", tone: "" });
    try {
      const res = await fetch("/api/dev/sky-wash", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: sending, bake }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? String(res.status));
      setSaved(sending);
      setStatus({ text: bake ? `Saved and baked at ${clock()}. The other pages have the new bitmap.` : `Saved to sky-wash.css at ${clock()}. Bake when you're done tuning.`, tone: "ok" });
      flash(bake ? "bake" : "save");
    } catch (err) {
      setStatus({ text: `Failed: ${String(err)}`, tone: "err" });
    } finally {
      setBusy(null);
    }
  };
  const copy = async () => {
    if (!model) return;
    await navigator.clipboard.writeText(`background-image: ${resolvedMesh(model, "/* stardust */")};`);
    setStatus({ text: "Copied the layers as a background-image value", tone: "ok" });
    flash("copy");
  };
  const reset = () => {
    if (!saved || !dirty) return;
    setModel(saved);
    setStatus({ text: "Back to the last saved state", tone: "" });
    flash("reset");
  };

  const hasMilky = model?.layers.some((l) => l.kind === "milky");
  const hasBand = model?.layers.some((l) => l.kind === "band");

  const editing = mode === "live";

  return (
    <div ref={washRef} className="sky-wash fixed inset-0 z-50 font-sky-ui text-sky-ink" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <WashSwitch initial="live" onChange={setMode} />

      <StressCards />

      {/* The editor works on the live CSS, so it steps aside in the other modes. */}
      {!editing && (
        <div className="fixed bottom-16 left-4 z-[60] rounded-full border border-sky-line bg-sky-card-strong px-3 py-1.5 text-[12px] text-sky-muted">
          Editor hidden. Switch the wash to <span className="text-sky-ink">live CSS</span> to edit.
        </div>
      )}

      {/* the Milky Way handle: drag along the band's line to shift it */}
      {editing && milkyHandle && (
        <button
          type="button"
          aria-label="Shift the Milky Way band"
          title="Milky Way: drag to slide the band along its line"
          onPointerDown={(e) => grab(e, milkyHandle.i, "band")}
          className="absolute z-10 flex h-9 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full border-2 border-sky-lilac bg-sky-ground-0/70 px-2.5 text-[11px] font-bold text-sky-ink shadow-[0_0_0_4px_rgba(0,0,0,0.25)] active:cursor-grabbing"
          style={{ left: clampX(milkyHandle.x), top: clampY(milkyHandle.y) }}
        >
          MW
        </button>
      )}
      {/* the star handle: drag along the band to move where its stars gather */}
      {editing && milkyHandle && milky && milky.stars > 0 && (
        <button
          type="button"
          aria-label="Slide the Milky Way's stars left or right"
          title="Milky Way stars: drag left or right to slide them (the band stays)"
          onPointerDown={(e) => grab(e, milkyHandle.i, "stars")}
          className="absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full border-2 border-dashed border-sky-lilac bg-sky-ground-0/70 text-[13px] text-sky-ink shadow-[0_0_0_4px_rgba(0,0,0,0.25)] active:cursor-grabbing"
          style={{ left: clampX(milkyHandle.starX), top: clampY(milkyHandle.starY) }}
        >
          ★
        </button>
      )}

      {/* handles: one per glow, at the glow's position */}
      {editing && model?.layers.map((l, i) => l.kind === "glow" && l.visible && (
        <button
          key={l.id}
          type="button"
          aria-label={`Move ${l.label}`}
          title={`${l.label}: drag to move`}
          onPointerDown={(e) => grab(e, i, "glow")}
          className="absolute z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full border-2 bg-sky-ground-0/70 text-[11px] font-bold text-sky-ink shadow-[0_0_0_4px_rgba(0,0,0,0.25)] active:cursor-grabbing"
          style={{ left: `${Math.max(2, Math.min(98, l.at[0]))}%`, top: `${Math.max(3, Math.min(97, l.at[1]))}%`, borderColor: toHex(l.colour) }}
        >
          {i + 1}
        </button>
      ))}

      {editing && <div
        ref={panelRef}
        className="absolute z-10 flex max-h-[calc(100vh-5rem)] w-[340px] flex-col rounded-2xl border border-sky-line bg-sky-card-strong text-[13px] shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        style={panelPos ? { left: panelPos.x, top: panelPos.y } : { right: 16, top: 16 }}
      >
        <div
          className="flex cursor-grab select-none items-center justify-between border-b border-sky-line px-4 py-3 active:cursor-grabbing"
          onPointerDown={onPanelGrab}
          onPointerMove={onPanelMove}
          onPointerUp={onPanelRelease}
          onPointerCancel={onPanelRelease}
          title="Drag to move the panel"
        >
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">
              Wash editor <span className="ml-1 font-normal normal-case tracking-normal">· drag me</span>
              {dirty && <span className="ml-2 rounded-full bg-sky-gold/20 px-1.5 py-0.5 font-normal normal-case tracking-normal text-sky-gold">unsaved</span>}
            </div>
            <div className="text-[12px] text-sky-muted">Layers paint top first. Drag the numbered handles.</div>
          </div>
          <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-md border border-sky-line px-2 py-1 text-[12px] text-sky-muted">{open ? "Hide" : "Show"}</button>
        </div>

        {open && model && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={addGlow} className="rounded-[10px] border border-sky-line px-2.5 py-1 text-[12px] font-semibold text-sky-ink">+ Glow</button>
              {!hasMilky && <button type="button" onClick={addMilky} className="rounded-[10px] border border-sky-line px-2.5 py-1 text-[12px] font-semibold text-sky-ink">+ Milky Way band</button>}
              {!hasBand && <button type="button" onClick={addBand} className="rounded-[10px] border border-sky-line px-2.5 py-1 text-[12px] font-semibold text-sky-ink">+ Bottom band</button>}
            </div>

            {model.layers.map((l, i) => (
              <section key={l.kind === "glow" ? `glow-${l.id}` : l.kind} className={`rounded-xl border border-sky-line p-3 ${l.visible ? "" : "opacity-55"}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-sky-line text-[10px] font-bold text-sky-muted">{i + 1}</span>
                  {l.kind === "glow" ? (
                    <input value={l.label} onChange={(e) => setLayer(i, { label: e.target.value })} className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-sky-ink hover:border-sky-line" aria-label="Glow name" />
                  ) : (
                    <span className="flex-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-sky-ink">{l.kind === "milky" ? "Milky Way band" : "Bottom band"}</span>
                  )}
                  <button type="button" onClick={() => toggle(i)} aria-pressed={!l.visible} title={l.visible ? "Hide this layer (its settings are kept)" : "Show this layer"} className={`rounded border px-1.5 text-[11px] ${l.visible ? "border-sky-line text-sky-muted" : "border-sky-gold text-sky-gold"}`}>{l.visible ? "hide" : "show"}</button>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded border border-sky-line px-1.5 text-[11px] text-sky-muted disabled:opacity-30" aria-label="Move up">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === model.layers.length - 1} className="rounded border border-sky-line px-1.5 text-[11px] text-sky-muted disabled:opacity-30" aria-label="Move down">↓</button>
                  <button type="button" onClick={() => remove(i)} className="rounded border border-sky-line px-1.5 text-[11px] text-sky-coral" aria-label="Remove layer">×</button>
                </div>
                <div className="space-y-2">
                  {l.kind === "glow" && (<>
                    <Row label="colour">{colourInput(l.colour, (c) => setLayer(i, { colour: c }))}<span className="font-mono text-[11px] text-sky-muted">{l.colour.join(", ")}</span></Row>
                    <Slider label="strength" value={l.strength} min={0} max={1} step={0.01} onChange={(v) => setLayer(i, { strength: v })} />
                    <Slider label="width" value={l.size[0]} min={10} max={160} step={1} unit="%" onChange={(v) => setLayer(i, { size: [v, l.size[1]] })} />
                    <Slider label="height" value={l.size[1]} min={10} max={160} step={1} unit="%" onChange={(v) => setLayer(i, { size: [l.size[0], v] })} />
                    <Slider label="softness" value={l.tail[1]} min={0.05} max={0.95} step={0.01} onChange={(v) => setLayer(i, { tail: [Math.min(0.98, v + 0.34), v, Math.max(0.02, v * 0.4), Math.max(0.01, v * 0.1)] })} />
                    <Row label="position"><span className="font-mono text-[11px] text-sky-muted">{l.at[0]}% {l.at[1]}%</span><span className="text-[11px] text-sky-muted">(drag handle {i + 1})</span></Row>
                  </>)}
                  {l.kind === "milky" && (<>
                    <Row label="lilac">{colourInput(l.lilac, (c) => setLayer(i, { lilac: c }))}</Row>
                    <Row label="pink edge">{colourInput(l.pink, (c) => setLayer(i, { pink: c }))}</Row>
                    <Slider label="strength" value={l.strength} min={0} max={1} step={0.01} onChange={(v) => setLayer(i, { strength: v })} />
                    <Slider label="angle" value={l.angle} min={0} max={360} step={1} unit="°" onChange={(v) => setLayer(i, { angle: v })} />
                    <Slider label="shift" value={l.shift} min={-60} max={60} step={0.5} unit="%" onChange={(v) => setLayer(i, { shift: v })} />
                    <Slider label="softness" value={l.softness} min={0} max={1} step={0.01} onChange={(v) => setLayer(i, { softness: v })} />
                    <Row label=""><span className="text-[11px] text-sky-muted">or drag the MW handle along the band</span></Row>
                    <Slider label="stars" value={l.stars} min={0} max={1} step={0.01} onChange={(v) => setLayer(i, { stars: v })} />
                    <Range label="star size" value={l.starSize} min={0.1} max={3} step={0.05} unit="px" onChange={(v) => setLayer(i, { starSize: v })} />
                    <Range label="star glow" value={l.starBright} min={0} max={1} step={0.01} onChange={(v) => setLayer(i, { starBright: v })} />
                    <Slider label="star width" value={l.starWidth} min={0.01} max={0.4} step={0.005} onChange={(v) => setLayer(i, { starWidth: v })} />
                    <Slider label="star slide" value={l.starX} min={-60} max={60} step={0.5} unit="%" onChange={(v) => setLayer(i, { starX: v })} />
                    <Row label=""><span className="text-[11px] text-sky-muted">width is how tightly the stars hug the band; slide moves them left or right while the band stays (or drag the ★ handle)</span></Row>
                  </>)}
                  {l.kind === "band" && (<>
                    <Row label="upper">{colourInput(l.upper, (c) => setLayer(i, { upper: c }))}</Row>
                    <Row label="lower">{colourInput(l.lower, (c) => setLayer(i, { lower: c }))}</Row>
                    <Slider label="strength" value={l.strength} min={0} max={1} step={0.01} onChange={(v) => setLayer(i, { strength: v })} />
                    <Slider label="starts at" value={l.from} min={0} max={100} step={1} unit="%" onChange={(v) => setLayer(i, { from: v })} />
                  </>)}
                </div>
              </section>
            ))}

            <section className="rounded-xl border border-sky-line p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-sky-ink">Stardust (everywhere)</span>
                <button type="button" onClick={() => setStars({ seed: (model.stars.seed % 9973) + 1 })} className="rounded border border-sky-line px-1.5 text-[11px] text-sky-muted" title="Scatter the same number of stars differently">reshuffle</button>
              </div>
              <div className="space-y-2">
                <Slider label="density" value={model.stars.density} min={0} max={400} step={1} onChange={(v) => setStars({ density: v })} />
                <Range label="size" value={model.stars.size} min={0.1} max={4} step={0.05} unit="px" onChange={(v) => setStars({ size: v })} />
                <Range label="brightness" value={model.stars.brightness} min={0} max={1} step={0.01} onChange={(v) => setStars({ brightness: v })} />
                <Row label=""><span className="text-[11px] text-sky-muted">dots per 480px tile; sizes lean small, so the max is the rare bright one</span></Row>
              </div>
            </section>

            <section className="rounded-xl border border-sky-line p-3">
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-sky-ink">Sweep (under everything)</div>
              <div className="space-y-2">
                <Row label="zenith"><input type="color" value={model.zenith} onChange={(e) => update((m) => ({ ...m, zenith: e.target.value }))} className="h-7 w-10 cursor-pointer rounded border border-sky-line bg-transparent" /><span className="text-[11px] text-sky-muted">top</span></Row>
                <Row label="ground"><input type="color" value={model.ground} onChange={(e) => update((m) => ({ ...m, ground: e.target.value }))} className="h-7 w-10 cursor-pointer rounded border border-sky-line bg-transparent" /><span className="text-[11px] text-sky-muted">the page colour</span></Row>
                <Row label="bottom"><input type="color" value={model.ground2} onChange={(e) => update((m) => ({ ...m, ground2: e.target.value }))} className="h-7 w-10 cursor-pointer rounded border border-sky-line bg-transparent" /></Row>
                <Slider label="ground at" value={model.sweepMid} min={0} max={100} step={1} unit="%" onChange={(v) => update((m) => ({ ...m, sweepMid: v }))} />
              </div>
            </section>
          </div>
        )}

        <div className="space-y-2 border-t border-sky-line px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <ActionButton primary busy={busy === "save"} done={done === "save"} disabled={!!busy || !dirty} onClick={() => save(false)} labels={["Save", "Saving…", "Saved"]} title={dirty ? "Write sky-wash.css" : "Nothing to save"} />
            <ActionButton primary busy={busy === "bake"} done={done === "bake"} disabled={!!busy} onClick={() => save(true)} labels={["Save + bake", "Baking…", "Baked"]} title="Write sky-wash.css and render the bitmap" />
            <ActionButton done={done === "reset"} disabled={!!busy || !dirty} onClick={reset} labels={["Reset", "", "Reset"]} title={dirty ? "Throw away the unsaved changes" : "Nothing to reset"} />
            <ActionButton done={done === "copy"} disabled={!model} onClick={() => void copy()} labels={["Copy CSS", "", "Copied"]} title="Copy the layers as a background-image value" />
            <ActionButton disabled={!!busy} onClick={() => void load()} labels={["Reload", "", ""]} muted title="Re-read sky-wash.css (after editing it by hand)" />
          </div>
          <div className={`text-[12px] ${status.tone === "ok" ? "text-sky-mint" : status.tone === "err" ? "text-sky-coral" : "text-sky-muted"}`} role="status" aria-live="polite">
            {status.text || (dirty ? "Unsaved changes. Save rewrites src/app/sky-wash.css; Reset goes back to the file." : "Matches sky-wash.css. Bake renders the bitmap the other pages use.")}
          </div>
        </div>
      </div>}
    </div>
  );
}

const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** A button that shows what it is doing: its label, then a busy label while
 * the request runs, then a done label for a moment, in mint. */
function ActionButton({ labels, busy = false, done = false, disabled = false, primary = false, muted = false, onClick, title }: {
  labels: [idle: string, busy: string, done: string];
  busy?: boolean; done?: boolean; disabled?: boolean; primary?: boolean; muted?: boolean;
  onClick: () => void; title?: string;
}) {
  const label = busy ? labels[1] : done ? `${labels[2]} ✓` : labels[0];
  const face = done
    ? "bg-sky-mint text-sky-ground-0"
    : primary
      ? "bg-sky-gold text-sky-gold-ink"
      : `border border-sky-line ${muted ? "text-sky-muted" : "text-sky-ink"}`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      title={title}
      className={`rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-200 ${done ? "" : "disabled:cursor-not-allowed disabled:opacity-45"} ${busy ? "animate-pulse" : ""} ${face}`}
    >
      {label}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_1fr] items-center gap-2">
      <span className="text-sky-muted">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

/** A min and a max on one row pair: the min can never pass the max. */
function Range({ label, value, min, max, step, unit = "", onChange }: { label: string; value: [number, number]; min: number; max: number; step: number; unit?: string; onChange: (v: [number, number]) => void }) {
  return (
    <>
      <Slider label={`${label} min`} value={value[0]} min={min} max={max} step={step} unit={unit} onChange={(v) => onChange([Math.min(v, value[1]), value[1]])} />
      <Slider label={`${label} max`} value={value[1]} min={min} max={max} step={step} unit={unit} onChange={(v) => onChange([value[0], Math.max(v, value[0])])} />
    </>
  );
}

function Slider({ label, value, min, max, step, unit = "", onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-[84px_1fr_48px] items-center gap-2">
      <span className="text-sky-muted">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--sky-gold)]" />
      <span className="text-right font-mono text-[11px] text-sky-muted">{Number.isInteger(step) ? value : value.toFixed(2)}{unit}</span>
    </div>
  );
}
