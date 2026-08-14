// DEV swatch board — every theme colour token, as a live swatch + its resolved
// value, with theme / appearance / accent switches so palettes can be compared
// and new colours tried side by side. Not shipped UI. Route: /dev/swatches
//
// The switches set data-theme / data-appearance / data-accent straight on
// <html> (bypassing the persisted theme provider), so a flip here is a throwaway
// preview that reverts on reload and never touches saved settings. A
// MutationObserver re-reads the computed values whenever those attributes change
// — whether from these buttons or the real Settings picker.
"use client";

import { useEffect, useState } from "react";

import { THEMES, APPEARANCES, ACCENTS } from "@/lib/theme";

/** The colour tokens, grouped as globals.css defines them. Non-colour tokens
 * (--shadow-*, --radius) are left off — this board is about colour. */
const GROUPS: ReadonlyArray<{ label: string; vars: readonly string[] }> = [
  { label: "Surfaces", vars: ["--bg", "--card", "--panel", "--border"] },
  { label: "Text", vars: ["--text", "--text-muted"] },
  { label: "Accent", vars: ["--accent", "--accent-bg"] },
  { label: "Danger", vars: ["--danger", "--danger-bg"] },
  { label: "Success", vars: ["--success", "--success-bg"] },
  { label: "Warning", vars: ["--warning", "--warning-bg"] },
  { label: "Sentence", vars: ["--sentence-topic", "--sentence-core", "--sentence-ending"] },
  { label: "Accuracy arc", vars: ["--arc", "--arc-track"] },
];

const ALL_VARS = GROUPS.flatMap((g) => g.vars);

/** Read every token's resolved value off <html>, re-reading whenever the theme
 * attributes change. Empty until mounted (values are client-only). */
function useResolvedTokens(): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const root = document.documentElement;
    const read = () => {
      const cs = getComputedStyle(root);
      const next: Record<string, string> = {};
      for (const v of ALL_VARS) next[v] = cs.getPropertyValue(v).trim();
      setValues(next);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "data-appearance", "data-accent"],
    });
    return () => obs.disconnect();
  }, []);
  return values;
}

function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${
        on
          ? "border-accent bg-accent-bg text-accent"
          : "border-border text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

export default function SwatchesPage() {
  const values = useResolvedTokens();
  const [, force] = useState(0);
  const root = typeof document !== "undefined" ? document.documentElement : null;
  const attr = (name: string) => root?.getAttribute(name) ?? "";

  const set = (name: string, value: string | null) => {
    if (!root) return;
    if (value === null) root.removeAttribute(name);
    else root.setAttribute(name, value);
    force((n) => n + 1); // re-render the switch highlights
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-text">Theme swatches</h1>
      <p className="mt-1 mb-6 max-w-prose text-[13px] text-text-muted">
        Every colour token in the current theme. Flip the switches to preview
        another palette — it&rsquo;s a throwaway preview on <code>&lt;html&gt;</code>{" "}
        and reverts on reload; it never saves.
      </p>

      <div className="mb-8 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Theme
          </span>
          {THEMES.map((t) => (
            <Pill key={t} on={attr("data-theme") === t} onClick={() => set("data-theme", t)}>
              {t}
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Appearance
          </span>
          {APPEARANCES.map((a) => (
            <Pill
              key={a}
              on={attr("data-appearance") === a || (a === "system" && !attr("data-appearance"))}
              onClick={() => set("data-appearance", a === "system" ? null : a)}
            >
              {a}
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Accent
          </span>
          {ACCENTS.map((a) => (
            <Pill
              key={a}
              on={attr("data-accent") === a || (a === "default" && !attr("data-accent"))}
              onClick={() => set("data-accent", a === "default" ? null : a)}
            >
              {a}
            </Pill>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {GROUPS.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              {group.label}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
              {group.vars.map((v) => (
                <div key={v} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <span
                    aria-hidden
                    className="size-9 flex-none rounded-md border border-border"
                    style={{ background: `var(${v})` }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[12px] text-text">{v}</span>
                    <span className="block truncate font-mono text-[11px] text-text-muted">
                      {values[v] || "…"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
