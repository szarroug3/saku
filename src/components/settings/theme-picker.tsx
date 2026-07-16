"use client";

// The theme controls on the Settings page: a row of swatch cards that preview
// each palette, the system/light/dark appearance chips, and the accent dots.

import { Chip } from "@/components/ui";
import {
  ACCENTS,
  APPEARANCES,
  DEFAULT_ACCENT,
  THEMES,
  useTheme,
  type AccentName,
  type ThemeName,
} from "@/lib/theme";

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

const ACCENT_LABEL: Record<Exclude<AccentName, "default">, string> = {
  cyan: "Cyan",
  azure: "Azure",
  violet: "Violet",
  orchid: "Orchid",
  magenta: "Magenta",
  pearl: "Pearl",
};

/** The accent swatches' literal colours — the same exception PREVIEWS above
 * is, and for the same reason: a swatch's whole job is to show you a colour
 * you are NOT currently wearing, so there is no CSS var to read back. Keep in
 * sync with the [data-accent] blocks in globals.css.
 *
 * `kiriDark` mirrors the four kiri-only overrides there. It's here rather than
 * ignored because the colour IS the label on these — a dot that previews
 * #f472b6 and then paints #ff95d9 is the one lie this control can tell. */
const ACCENT_SWATCH: Record<
  Exclude<AccentName, "default">,
  { light: string; dark: string; kiriDark?: string }
> = {
  cyan: { light: "#00607d", dark: "#67d4f5" },
  azure: { light: "#0d58a7", dark: "#60a5fa", kiriDark: "#7cc2ff" },
  violet: { light: "#6444ad", dark: "#a78bfa", kiriDark: "#c8acff" },
  orchid: { light: "#7739ac", dark: "#c084fc", kiriDark: "#dea2ff" },
  magenta: { light: "#a0216c", dark: "#f472b6", kiriDark: "#ff95d9" },
  pearl: { light: "#535965", dark: "#dbe2f0" },
};

/** The one theme whose own accent IS one of the six: kiri's #67d4f5 is cyan,
 * exactly — OKLab distance 0.000 in dark, 0.035 in light. Drawn as both, kiri
 * would show two identical dots that do the same thing on click.
 *
 * Nothing else collides. The nearest miss is graphite's own #7b7fff against
 * violet's #a78bfa at 0.074, which is two neighbours apart rather than a
 * duplicate (0.05 is roughly where two dots stop being tellable apart), so
 * graphite keeps both and momentum's green is nowhere near anything — mint,
 * which would have collided with it, is deliberately not in the six. */
const OWN_IS: Partial<Record<ThemeName, Exclude<AccentName, "default">>> = {
  kiri: "cyan",
};

/** The accessible name for the theme's own accent, since its dot is the same
 * kind of thing as the other six — a colour — and needs the same kind of name. */
const OWN_LABEL: Record<ThemeName, string> = {
  aizome: "Aizome's indigo",
  graphite: "Graphite's violet",
  momentum: "Momentum's green",
  kiri: "Kiri's cyan",
};

/** The accent dots. Colour rather than names, same reasoning as the font
 * chips: the colour IS the label, and "Orchid" tells you nothing about the
 * hue. The names stay reachable through title/aria-label, since a coloured
 * circle gives a screen reader nothing to read out.
 *
 * THE THEME'S OWN ACCENT IS JUST THE FIRST DOT, and that is the whole design.
 * It is not labelled, badged, or marked "default", because it was never a
 * choice you make — it is the colour this theme already has, and it happens to
 * be the one selected until you pick another. Being selected is what says so.
 *
 * Two earlier passes got this wrong in the same way, and the mistake is worth
 * naming: both rendered "Theme default" as a distinct CONCEPT — first a
 * two-tone dot (which drew "what is the half/half circle?", because in a row
 * of solid circles a gradient circle just reads as one more colour), then a
 * "Default" text chip. Both invented an idea the user has to learn in order to
 * use a colour picker. There is no idea. There are seven colours and one of
 * them is already on. Where the per-theme rule genuinely needs explaining, it
 * is explained in the row's info tooltip, which is what that is for.
 *
 * Selection is the outline the theme swatches above use, NOT the comp's tick:
 * the comp ticks in a fixed near-black (#05101a), fine on its dark dots and
 * failing on all six LIGHT siblings (1.9:1 on magenta's #a0216c). An outline
 * carries "this one" at every swatch colour in both modes. */
export function AccentPicker() {
  const { theme, accent, setAccent, resolved } = useTheme();
  const mode = resolved === "dark" ? "dark" : "light";
  const dupe = OWN_IS[theme];

  const dot = (
    value: AccentName,
    color: string,
    label: string,
    selected: boolean,
  ) => (
    <button
      key={value}
      type="button"
      onClick={() => setAccent(value)}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={
        "kq-material size-[26px] cursor-pointer rounded-full border border-border " +
        "transition-transform " +
        (selected
          ? "outline outline-2 outline-offset-2 outline-accent"
          : "hover:-translate-y-px")
      }
      style={{ background: color }}
    />
  );

  return (
    <>
      {dot(
        DEFAULT_ACCENT,
        // The theme's own accent, from PREVIEWS rather than from --accent:
        // --accent is whatever is CURRENTLY picked, and this dot has to keep
        // showing what the THEME wants however far you've wandered from it.
        PREVIEWS[theme][mode].accent,
        OWN_LABEL[theme],
        // `|| accent === dupe`: a stored "cyan" on kiri is the same colour as
        // kiri's own, and its dot is no longer drawn — without this the row
        // would show nothing selected at all.
        accent === DEFAULT_ACCENT || accent === dupe,
      )}
      {ACCENTS.filter((a) => a !== DEFAULT_ACCENT && a !== dupe).map((a) => {
        const key = a as Exclude<AccentName, "default">;
        const sw = ACCENT_SWATCH[key];
        return dot(
          a,
          mode === "dark"
            ? theme === "kiri"
              ? (sw.kiriDark ?? sw.dark)
              : sw.dark
            : sw.light,
          ACCENT_LABEL[key],
          accent === a,
        );
      })}
    </>
  );
}
