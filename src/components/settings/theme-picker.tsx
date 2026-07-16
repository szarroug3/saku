"use client";

// The two theme controls on the Settings page: a row of swatch cards that
// preview each palette, and the system/light/dark appearance chips.

import { Chip } from "@/components/ui";
import { APPEARANCES, THEMES, useTheme, type ThemeName } from "@/lib/theme";

interface Palette {
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  /** kiri only: the gradient mesh behind everything. */
  mesh?: string;
}

interface Preview {
  label: string;
  /** Japanese name, where the theme has one. */
  ja?: string;
  radius: number;
  kana: string;
  light: Palette;
  dark: Palette;
}

// Hardcoded rather than read back out of the CSS vars: the whole point is to
// show a theme you are NOT currently in, so there's nothing to read. Keep in
// sync with the theme blocks in globals.css.
const PREVIEWS: Record<ThemeName, Preview> = {
  aizome: {
    label: "Aizome",
    ja: "藍染",
    radius: 3,
    kana: '"Hiragino Mincho ProN", "Yu Mincho", serif',
    light: {
      bg: "#efece2",
      card: "#fbfaf6",
      border: "#ddd8c9",
      text: "#1b1a17",
      muted: "#7d7869",
      accent: "#1f3a68",
    },
    dark: {
      bg: "#201d18",
      card: "#2a2620",
      border: "#453f36",
      text: "#ece7db",
      muted: "#a09884",
      accent: "#8fa8d8",
    },
  },
  graphite: {
    label: "Graphite",
    radius: 5,
    kana: '"Hiragino Sans", system-ui, sans-serif',
    light: {
      bg: "#f4f5f8",
      card: "#ffffff",
      border: "#e0e2ea",
      text: "#14161c",
      muted: "#61657a",
      accent: "#4b4ade",
    },
    dark: {
      bg: "#0a0b0d",
      card: "#141519",
      border: "#24262d",
      text: "#edeef2",
      muted: "#7c8090",
      accent: "#7b7fff",
    },
  },
  momentum: {
    label: "Momentum",
    radius: 12,
    kana: '"Hiragino Maru Gothic ProN", "Klee", system-ui, sans-serif',
    light: {
      bg: "#eef3f8",
      card: "#ffffff",
      border: "#d7e2ec",
      text: "#10212e",
      muted: "#6f8496",
      accent: "#15803d",
    },
    dark: {
      bg: "#0d1a26",
      card: "#142534",
      border: "#263c50",
      text: "#e6eef5",
      muted: "#8aa3b8",
      accent: "#34d76d",
    },
  },
  kiri: {
    label: "Kiri",
    ja: "霧",
    radius: 14,
    kana: '"Hiragino Sans", system-ui, sans-serif',
    light: {
      bg: "#eef2fa",
      card: "rgba(255,255,255,0.62)",
      border: "rgba(13,27,42,0.13)",
      text: "#0d1b2a",
      muted: "rgba(13,27,42,0.55)",
      accent: "#096b87",
      mesh:
        "radial-gradient(60% 80% at 12% 8%, rgba(124,92,255,0.28), transparent 60%)," +
        "radial-gradient(55% 75% at 88% 82%, rgba(45,212,191,0.24), transparent 62%)",
    },
    dark: {
      bg: "#070a14",
      card: "rgba(255,255,255,0.055)",
      border: "rgba(255,255,255,0.11)",
      text: "#eef1fb",
      muted: "rgba(238,241,251,0.5)",
      accent: "#67d4f5",
      mesh:
        "radial-gradient(60% 80% at 12% 8%, rgba(120,86,255,0.55), transparent 60%)," +
        "radial-gradient(55% 75% at 88% 82%, rgba(45,212,191,0.4), transparent 62%)",
    },
  },
};

/** One swatch: the theme's real ground, card, accent and kana face, so you
 * can see the look before committing to it. */
function ThemeSwatch({ name }: { name: ThemeName }) {
  const { theme, setTheme, resolved } = useTheme();
  const p = PREVIEWS[name];
  const c = resolved === "dark" ? p.dark : p.light;
  const selected = theme === name;

  return (
    <button
      type="button"
      onClick={() => setTheme(name)}
      aria-pressed={selected}
      aria-label={`${p.label} theme`}
      className={
        "w-[126px] cursor-pointer border p-2 text-left transition-transform " +
        (selected
          ? "outline outline-2 outline-offset-2 outline-accent"
          : "hover:-translate-y-px")
      }
      style={{
        // The swatch previews the theme's own ground and radius; only the
        // selection ring comes from the theme currently in effect.
        background: c.mesh ? `${c.mesh}, ${c.bg}` : c.bg,
        borderColor: c.border,
        borderRadius: p.radius + 4,
      }}
    >
      <span className="flex items-center gap-1.5">
        <span
          className="flex h-9 w-9 flex-none items-center justify-center border text-[19px] leading-none"
          style={{
            background: c.card,
            borderColor: c.border,
            borderRadius: p.radius,
            color: c.text,
            fontFamily: p.kana,
            // kiri's kana is ultralight and luminous — same as the real thing.
            fontWeight: name === "kiri" ? 200 : 400,
          }}
        >
          あ
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className="block h-1.5 w-full rounded-full"
            style={{ background: c.accent }}
          />
          <span
            className="block h-1.5 w-3/5 rounded-full"
            style={{ background: c.muted }}
          />
        </span>
      </span>
      <span
        className="mt-2 block truncate text-[11px] font-semibold"
        style={{ color: c.text }}
      >
        {p.label}
        {p.ja ? (
          <span className="ml-1 font-normal" style={{ color: c.muted }}>
            {p.ja}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function ThemePicker() {
  return (
    <>
      {THEMES.map((t) => (
        <ThemeSwatch key={t} name={t} />
      ))}
    </>
  );
}

const APPEARANCE_LABEL: Record<(typeof APPEARANCES)[number], string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export function AppearancePicker() {
  const { appearance, setAppearance } = useTheme();
  return (
    <>
      {APPEARANCES.map((a) => (
        <Chip
          key={a}
          on={appearance === a}
          onClick={() => setAppearance(a)}
          aria-pressed={appearance === a}
        >
          {APPEARANCE_LABEL[a]}
        </Chip>
      ))}
    </>
  );
}
