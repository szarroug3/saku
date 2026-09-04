"use client";

// Gallery for the night theme tokens. Route: /dev/sky/tokens
//
// Every --sky-* colour as a live swatch with its resolved value and its contrast
// against the grounds it will sit on, read off the computed styles so what is
// shown is what the stylesheet actually says. The floors here are the same ones
// src/sky/lib/night-theme.test.ts enforces; this page exists so a tweak can be
// judged by eye and by number before the test runs.

import { useEffect, useState } from "react";

import { contrastOn, parseColor, type Rgb } from "@/sky/lib/contrast";

import { StressCards } from "../stress-cards";
import { WashSwitch } from "../wash-switch";

const GROUPS: ReadonlyArray<{ label: string; note: string; vars: readonly string[] }> = [
  { label: "Grounds", note: "zenith to horizon; the page is --sky-ground", vars: ["--sky-zenith", "--sky-ground-0", "--sky-ground", "--sky-ground-2", "--sky-ground-3"] },
  { label: "Surfaces", note: "translucent, over a ground; the mesh is the page wash", vars: ["--sky-card", "--sky-card-strong", "--sky-line", "--sky-stardust", "--sky-milky-starfield", "--sky-mesh"] },
  { label: "Text", note: "faint is decorative only", vars: ["--sky-ink", "--sky-muted", "--sky-faint"] },
  { label: "Stars", note: "star-dim is decorative only", vars: ["--sky-star", "--sky-star-mid", "--sky-star-dim", "--sky-link"] },
  { label: "Actions", note: "gold-ink is the text on a gold button", vars: ["--sky-gold", "--sky-gold-ink"] },
  { label: "Standings", note: "solid, getting there, shaky, slipping; lilac is for planets", vars: ["--sky-mint", "--sky-pale", "--sky-amber", "--sky-coral", "--sky-lilac"] },
];

const DECORATIVE = new Set(["--sky-faint", "--sky-star-dim", "--sky-line", "--sky-card", "--sky-card-strong", "--sky-mesh", "--sky-milky-starfield", "--sky-stardust"]);
const IMAGE_TOKENS = new Set(["--sky-mesh", "--sky-milky-starfield", "--sky-stardust"]);
const IMAGE_NOTES: Record<string, string> = {
  "--sky-mesh": "stardust + the layers + the sweep, from sky-wash.css",
  "--sky-milky-starfield": "the Milky Way's own stars, an inline SVG from the star knobs",
  "--sky-stardust": "a tiled PNG from the --sky-stars-* knobs",
};
const GROUNDS = ["--sky-ground", "--sky-ground-2", "--sky-ground-3"] as const;

const ALL_VARS = [...GROUPS.flatMap((g) => g.vars), "--sky-font-display", "--sky-font-ui"];

function useSkyTokens(): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    // Read in a callback so the update is not a synchronous setState inside
    // the effect. A timeout rather than requestAnimationFrame on purpose: rAF
    // never fires in a hidden tab, and this page is often opened in one.
    const timer = setTimeout(() => {
      const style = getComputedStyle(document.documentElement);
      const next: Record<string, string> = {};
      for (const v of ALL_VARS) next[v] = style.getPropertyValue(v).trim();
      setValues(next);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  return values;
}

/** Lines between stars are held to 3:1; everything else that carries meaning is text at 4.5:1. */
const LINE_FLOOR = new Set(["--sky-link"]);

function ratioLabel(v: string, fg: string, bg: string): { text: string; ok: boolean | null } {
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (!f || !b || b.alpha < 1) return { text: "", ok: null };
  const ratio = contrastOn(f, b.rgb as Rgb);
  return { text: `${ratio.toFixed(1)}:1`, ok: ratio >= (LINE_FLOOR.has(v) ? 3 : 4.5) };
}

export default function SkyTokensPage() {
  const values = useSkyTokens();
  const ground = values["--sky-ground"] ?? "";

  return (
    <div className="space-y-8">
      <WashSwitch />
      <StressCards />
      <section>
        <h2 className="text-base font-semibold text-text">Night theme tokens</h2>
        <p className="mt-1 max-w-[72ch] text-sm text-text-muted">
          The Sky is one night theme by choice. Every colour below lives once, as a{" "}
          <code className="text-text">--sky-*</code> custom property in{" "}
          <code className="text-text">globals.css</code>, and reaches Sky code only as a
          Tailwind class (<code className="text-text">bg-sky-ground</code>,{" "}
          <code className="text-text">text-sky-mint</code>,{" "}
          <code className="text-text">font-sky-display</code>). Text tokens must reach 4.5:1
          on every ground; the ratio shown is against the page ground, and the test in{" "}
          <code className="text-text">night-theme.test.ts</code> checks every ground and card.
        </p>
      </section>

      {/* The tokens, used: a slice of the sky painted entirely with the new classes. */}
      <section className="sky-wash flex min-h-[520px] flex-col rounded-2xl border border-sky-line p-6 font-sky-ui text-sky-ink">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">Tonight</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-4">
          <span className="font-sky-display text-5xl leading-none">電車</span>
          <span className="font-sky-display text-2xl text-sky-muted">でんしゃ</span>
          <span className="text-lg">train</span>
        </div>
        <p className="mt-3 max-w-[60ch] text-sm text-sky-muted">
          Display type is Shippori Mincho, falling back to Hiragino Mincho. UI type is Karla,
          falling back to the system stack. Both are loaded once by the Sky layout.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[12.5px] font-semibold">
          <span className="rounded-full border border-sky-mint/40 px-3 py-1 text-sky-mint">solid</span>
          <span className="rounded-full border border-sky-pale/40 px-3 py-1 text-sky-pale">getting there</span>
          <span className="rounded-full border border-sky-amber/40 px-3 py-1 text-sky-amber">shaky</span>
          <span className="rounded-full border border-sky-coral/40 px-3 py-1 text-sky-coral">slipping</span>
          <span className="rounded-full border border-sky-line px-3 py-1 text-sky-star-mid">claimed</span>
          <span className="rounded-full border border-sky-lilac/40 px-3 py-1 text-sky-lilac">planet</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="rounded-[10px] bg-sky-gold px-3.5 py-2 text-sm font-semibold text-sky-gold-ink">
            Start tonight&apos;s lesson
          </button>
          <button type="button" className="rounded-[10px] border border-sky-line bg-sky-card px-3.5 py-2 text-sm font-semibold text-sky-ink">
            Pick more
          </button>
        </div>
        {/* Down on the horizon: ink may sit on the glow, muted goes inside a panel. */}
        <div className="mt-auto flex flex-wrap items-end gap-3 pt-10">
          <div className="max-w-[46ch] rounded-2xl border border-sky-line bg-sky-card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">How much you&apos;ve covered</div>
            <p className="mt-1 text-sm text-sky-muted">A panel on the horizon: dark glass, so muted text keeps its floor over the pink and the blue.</p>
          </div>
          <p className="max-w-[26ch] font-sky-display text-2xl leading-tight">Only headings sit bare on the horizon.</p>
        </div>
      </section>

      {GROUPS.map((group) => (
        <section key={group.label}>
          <div className="flex items-baseline gap-3 border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-text">{group.label}</h3>
            <span className="text-xs text-text-muted">{group.note}</span>
          </div>
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {group.vars.map((v) => {
              const value = values[v] ?? "";
              const decorative = DECORATIVE.has(v);
              const isGround = v.startsWith("--sky-ground") || v === "--sky-zenith";
              // gold-ink is the text on a gold button, so it is measured against gold, not the ground
              const backdrop = v === "--sky-gold-ink" ? values["--sky-gold"] ?? "" : ground;
              const backdropName = v === "--sky-gold-ink" ? "gold" : "ground";
              const ratio = !isGround && !decorative && backdrop ? ratioLabel(v, value, backdrop) : null;
              return (
                <div key={v} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div
                    className="h-16 bg-sky-ground p-3"
                    style={{
                      backgroundColor: isGround ? `var(${v})` : undefined,
                      backgroundImage: IMAGE_TOKENS.has(v) ? `var(${v})` : undefined,
                    }}
                  >
                    {!isGround && !IMAGE_TOKENS.has(v) && (
                      <div
                        className="h-full w-full rounded-lg"
                        style={{ backgroundColor: `var(${v})`, outline: v === "--sky-gold-ink" ? "6px solid var(--sky-gold)" : undefined, outlineOffset: v === "--sky-gold-ink" ? "-6px" : undefined }}
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-mono text-[12px] text-text">{v}</div>
                    <div className="mt-0.5 break-all font-mono text-[11px] text-text-muted">{IMAGE_NOTES[v] ?? (value || "…")}</div>
                    {ratio && ratio.text && (
                      <div className={`mt-1 text-[11px] font-semibold ${ratio.ok ? "text-success" : "text-danger"}`}>
                        {ratio.text} on {backdropName} {ratio.ok ? "" : `· below ${LINE_FLOOR.has(v) ? "3" : "4.5"}:1`}
                      </div>
                    )}
                    {decorative && <div className="mt-1 text-[11px] text-text-muted">decorative only, never text</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section>
        <div className="border-b border-border pb-2">
          <h3 className="text-sm font-semibold text-text">Against every ground</h3>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="text-[12.5px]">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="pr-4 font-medium">token</th>
                {GROUNDS.map((g) => (
                  <th key={g} className="pr-4 font-mono font-medium">{g.replace("--sky-", "")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {["--sky-ink", "--sky-muted", "--sky-star", "--sky-star-mid", "--sky-link", "--sky-gold", "--sky-mint", "--sky-pale", "--sky-amber", "--sky-coral", "--sky-lilac"].map((v) => (
                <tr key={v} className="border-t border-border">
                  <td className="py-1 pr-4 font-mono text-text">{v.replace("--sky-", "")}</td>
                  {GROUNDS.map((g) => {
                    const r = ratioLabel(v, values[v] ?? "", values[g] ?? "");
                    return (
                      <td key={g} className={`py-1 pr-4 font-semibold ${r.ok === false ? "text-danger" : "text-text"}`}>
                        {r.text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
