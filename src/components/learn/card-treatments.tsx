// DESIGN EXPLORATION — treatments for the Learn unit card, past the plain box.
// Not shipped: a set of candidate looks rendered side by side in /dev/views so we
// can pick a direction. Each takes a ContentItem and is the compact card size
// (h-104), so they compare like-for-like with ItemPreview.
//
// Every treatment is theme-token based (--card, --text, …) and colours each type
// from one shared hue map, so "what kind is this" reads by colour, not only text.
// No backdrop-filter anywhere (the perf hit) — depth comes from gradients and
// shadows, which are cheap.

import type { CSSProperties } from "react";

import type { ContentItem, ContentKind } from "@/lib/content/item";

/** One hue per content type — a light tint that glows on a dark ground and tints
 * a light one. Grouped by family: script cool, words warm, politeness gold. */
const HUE: Record<ContentKind, string> = {
  character: "#8b93ff", // indigo — kanji / characters
  kana: "#7dd3fc", // sky — kana
  word: "#ff8fab", // rose — words
  counter: "#5eead4", // teal — counters
  "generative-rule": "#5eead4",
  keigo: "#fbbf24", // amber — keigo
  grammar: "#c4b5fd", // violet — grammar
  transitivity: "#6ee7b7", // emerald — verb pairs
  "sentence-ordering": "#93c5fd", // blue — building sentences
};

function hueOf(item: ContentItem): string {
  return HUE[item.kind] ?? "#8b93ff";
}

/** Compact glyph sizing — CJK by char count, a multi-word title by length. */
function glyphSize(glyph: string): string {
  const n = [...glyph].length;
  if (/\s/.test(glyph)) return n <= 12 ? "text-[15px]" : n <= 20 ? "text-[12px]" : "text-[11px]";
  if (n <= 1) return "text-[34px]";
  if (n === 2) return "text-[26px]";
  if (n === 3) return "text-[20px]";
  return "text-[16px]";
}

const SHELL = "relative flex h-[104px] w-[116px] flex-col overflow-hidden rounded-2xl p-3";

function Glyph({ item }: { item: ContentItem }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <span
        className={`font-kana text-balance px-0.5 text-center leading-tight text-text [overflow-wrap:break-word] ${glyphSize(item.glyph)}`}
        lang="ja"
      >
        {item.glyph}
      </span>
    </div>
  );
}

function TypeLine({ item, color }: { item: ContentItem; color?: string }) {
  return (
    <div className="flex h-7 items-start justify-center text-center">
      <span
        className="text-[9px] font-medium uppercase leading-tight tracking-[0.05em]"
        style={color ? { color } : undefined}
      >
        {item.typeLabel}
      </span>
    </div>
  );
}

// ── A · GENKŌ — the writing-practice square ─────────────────────────────────
// The glyph sits in a faint ruled square with centre guides, like Japanese
// manuscript paper (genkō yōshi). On-theme, and the guide box quietly frames
// every glyph the same way.
export function TreatmentGenko({ item }: { item: ContentItem }) {
  return (
    <div className={`${SHELL} border border-border/70 bg-[color-mix(in_srgb,var(--card)_45%,transparent)]`}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[70%] w-[70%] rounded-[3px] border border-dashed border-[var(--text-muted)]/25">
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--text-muted)]/15" />
          <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-[var(--text-muted)]/15" />
        </div>
      </div>
      <Glyph item={item} />
      <TypeLine item={item} color="var(--accent)" />
    </div>
  );
}

// ── B · TINTED — colour-coded by type ───────────────────────────────────────
// A soft diagonal wash of the type's hue into the card, a coloured hairline, and
// the type label + a low glow in the same hue. You learn the palette and read the
// kind before you read the word.
export function TreatmentTinted({ item }: { item: ContentItem }) {
  const h = hueOf(item);
  return (
    <div
      className={`${SHELL} border`}
      style={
        {
          "--h": h,
          borderColor: `color-mix(in srgb, ${h} 32%, var(--border))`,
          backgroundImage: `linear-gradient(155deg, color-mix(in srgb, ${h} 18%, var(--card)), var(--card))`,
          boxShadow: `0 12px 30px -20px color-mix(in srgb, ${h} 70%, transparent)`,
        } as CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(80px 60px at 50% 42%, color-mix(in srgb, ${h} 22%, transparent), transparent)` }}
      />
      <Glyph item={item} />
      <TypeLine item={item} color={h} />
    </div>
  );
}

// ── C · WATERMARK — the glyph as its own texture ────────────────────────────
// An oversized ghost of the glyph bleeds off a corner as decoration; the crisp
// glyph reads on top. Editorial and quiet; the type label anchors the base.
export function TreatmentWatermark({ item }: { item: ContentItem }) {
  const ghost = [...item.glyph][0] ?? item.glyph;
  return (
    <div className={`${SHELL} border border-border/70 bg-[color-mix(in_srgb,var(--card)_55%,transparent)]`}>
      <span
        className="pointer-events-none absolute -bottom-5 -right-3 select-none font-kana text-[104px] leading-none text-[color:color-mix(in_srgb,var(--text)_7%,transparent)]"
        lang="ja"
        aria-hidden
      >
        {ghost}
      </span>
      <Glyph item={item} />
      <TypeLine item={item} color="var(--accent)" />
    </div>
  );
}

// ── D · GLASS — frost that actually reads ───────────────────────────────────
// A more transparent ground so the warm page shows through, a real drop shadow
// for lift, and a top-left sheen (a radial gradient, not a blur) so it reads as a
// pane of glass rather than a flat box.
export function TreatmentGlass({ item }: { item: ContentItem }) {
  return (
    <div
      className={`${SHELL} border border-white/10 bg-[color-mix(in_srgb,var(--card)_40%,transparent)] shadow-[0_22px_44px_-26px_rgba(0,0,0,0.75)]`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(130px 90px at 22% 0%, rgba(255,255,255,0.09), transparent)" }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />
      <Glyph item={item} />
      <TypeLine item={item} color="var(--accent)" />
    </div>
  );
}

/** The treatments, for the gallery to iterate. */
export const CARD_TREATMENTS: { name: string; note: string; Card: (p: { item: ContentItem }) => React.ReactNode }[] = [
  { name: "A · Genkō square", note: "Manuscript-paper guides frame every glyph.", Card: TreatmentGenko },
  { name: "B · Tinted by type", note: "Each content type carries its own hue.", Card: TreatmentTinted },
  { name: "C · Glyph watermark", note: "An oversized ghost glyph as texture.", Card: TreatmentWatermark },
  { name: "D · Glass", note: "Real translucency + sheen, no blur.", Card: TreatmentGlass },
];
