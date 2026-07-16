"use client";

// Theme context — which palette (aizome / graphite / momentum / kiri), which
// mode (system / light / dark), and which accent. All three live on <html> as
// data-theme, data-appearance and data-accent; globals.css does the rest.
//
// Persisted to their OWN localStorage keys, deliberately NOT inside
// "kanaquiz-cfg": how the app looks isn't quiz configuration, and keeping it
// separate is what lets the inline no-flash script in layout.tsx read it with
// a few cheap getItem calls instead of parsing the whole config blob.
//
// The attributes are already correct before React runs (that script stamps
// them pre-paint). This provider is the source of truth from mount onward:
// it re-reads storage post-mount, then writes the attributes back on change.
//
// THE ACCENT IS PER THEME, and that is a design decision, not a storage one.
// It is stored as a MAP keyed by theme id — { kiri: "magenta" } — because in
// half these themes the accent isn't decoration, it's the idea:
//
//   aizome (藍染) literally means "indigo dyeing". Its accent is its name; a
//     magenta aizome is not aizome.
//   momentum sets --accent === --success on purpose, so one green carries both
//     progress and correctness. Swapping the accent silently un-pairs them.
//
// A single global accent would quietly break both, so "the accent belongs to
// the theme you picked it in" is the only version of this feature that can
// exist. The picker always shows/edits the CURRENT theme's choice; switching
// themes shows that theme's. Default is {} — every theme starts on its own
// accent, so none of this is visible until someone opts in.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const THEMES = ["aizome", "graphite", "momentum", "kiri"] as const;
export type ThemeName = (typeof THEMES)[number];

export const APPEARANCES = ["system", "light", "dark"] as const;
export type Appearance = (typeof APPEARANCES)[number];

// "default" is first because it IS the default: the theme's own accent, the
// one it was designed with. It has no CSS block — it's the ABSENCE of
// data-accent — which is why the picker removes the attribute rather than
// stamping it.
export const ACCENTS = [
  "default",
  "cyan",
  "azure",
  "violet",
  "orchid",
  "magenta",
  "pearl",
] as const;
export type AccentName = (typeof ACCENTS)[number];

/** Which accent each theme is wearing. Absent = that theme's own. */
export type AccentMap = Partial<Record<ThemeName, AccentName>>;

// `satisfies` rather than `: ThemeName` so these keep their literal types —
// layout.tsx pins its own copies to `typeof DEFAULT_THEME` etc. to make drift
// a compile error. See the comment there for why it can't just import these.
export const DEFAULT_THEME = "kiri" satisfies ThemeName;
export const DEFAULT_APPEARANCE = "system" satisfies Appearance;
export const DEFAULT_ACCENT = "default" satisfies AccentName;

export const THEME_KEY = "kanaquiz-theme";
export const APPEARANCE_KEY = "kanaquiz-appearance";
export const ACCENTS_KEY = "kanaquiz-accents";

function isTheme(v: unknown): v is ThemeName {
  return THEMES.includes(v as ThemeName);
}

function isAppearance(v: unknown): v is Appearance {
  return APPEARANCES.includes(v as Appearance);
}

function isAccent(v: unknown): v is AccentName {
  return ACCENTS.includes(v as AccentName);
}

/** Read a stored value, falling back to the default. Anything unrecognized
 * (or unreadable storage) is just the default — the app is new, there's no
 * legacy shape worth migrating. */
function load<T>(key: string, guard: (v: unknown) => v is T, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (guard(saved)) return saved;
  } catch {
    // storage blocked (private mode / disabled cookies) — use the default
  }
  return fallback;
}

/** The accent map, validated key by key rather than trusted wholesale — it's
 * the only one of the three that's structured, so it's the only one where a
 * hand-edited or half-written entry can be partly good. An unknown theme id or
 * accent name is dropped and the rest is kept. */
function loadAccents(): AccentMap {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(ACCENTS_KEY) ?? "null");
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const out: AccentMap = {};
      for (const [k, v] of Object.entries(raw)) {
        if (isTheme(k) && isAccent(v)) out[k] = v;
      }
      return out;
    }
  } catch {
    // storage blocked or corrupt JSON — no accents, i.e. every theme's own
  }
  return {};
}

interface ThemeContextValue {
  theme: ThemeName;
  appearance: Appearance;
  setTheme(theme: ThemeName): void;
  setAppearance(appearance: Appearance): void;
  /** The CURRENT theme's accent — "default" means the theme's own. */
  accent: AccentName;
  /** Set the accent for the theme currently in effect, and only that one. */
  setAccent(accent: AccentName): void;
  /** The mode actually in effect — `appearance`, with "system" resolved
   * against the OS. Tracks the OS live. */
  resolved: "light" | "dark";
  /** False during SSR/first paint, true once localStorage has been read. */
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start from the same defaults the server rendered, then hydrate from
  // localStorage after mount to avoid SSR/client markup mismatches.
  const [theme, setTheme] = useState<ThemeName>(DEFAULT_THEME);
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [accents, setAccents] = useState<AccentMap>({});
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // One-time localStorage hydration must run post-mount (SSR can't read it)
    // and set state synchronously so the real choice paints in the same pass.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(load(THEME_KEY, isTheme, DEFAULT_THEME));
    setAppearance(load(APPEARANCE_KEY, isAppearance, DEFAULT_APPEARANCE));
    setAccents(loadAccents());
    setReady(true);
  }, []);

  // Track the OS preference so `resolved` stays honest under "system".
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    // matchMedia is browser-only, so the initial read has to happen here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Write-back is gated on `ready` in both directions: before hydration the
  // state is still the default, and stamping/persisting that would clobber
  // whatever the no-flash script correctly put on <html>.
  useEffect(() => {
    if (!ready) return;
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // storage blocked — the choice still applies for this session
    }
  }, [theme, ready]);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.setAttribute("data-appearance", appearance);
    try {
      localStorage.setItem(APPEARANCE_KEY, appearance);
    } catch {
      // storage blocked — the choice still applies for this session
    }
  }, [appearance, ready]);

  // The accent in effect: whatever the CURRENT theme is wearing. Derived, not
  // stored — switching themes changes it with no write, which is exactly the
  // per-theme behaviour.
  const accent: AccentName = accents[theme] ?? DEFAULT_ACCENT;

  // Same `ready` gate and the same two jobs as the effects above, with one
  // extra rule: "default" is the ABSENCE of the attribute, not a value for it.
  // There is no [data-accent="default"] block — the theme's own accent is what
  // the theme block already said — so stamping it would be a selector that
  // matches nothing while claiming the user chose something.
  useEffect(() => {
    if (!ready) return;
    const el = document.documentElement;
    if (accent === DEFAULT_ACCENT) el.removeAttribute("data-accent");
    else el.setAttribute("data-accent", accent);
  }, [accent, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(ACCENTS_KEY, JSON.stringify(accents));
    } catch {
      // storage blocked — the choice still applies for this session
    }
  }, [accents, ready]);

  const setThemeSafe = useCallback((next: ThemeName) => setTheme(next), []);
  const setAppearanceSafe = useCallback(
    (next: Appearance) => setAppearance(next),
    [],
  );

  // Writes one key of the map — the theme in effect — and leaves every other
  // theme's choice alone. That single line is the whole per-theme feature.
  const setAccent = useCallback(
    (next: AccentName) => setAccents((prev) => ({ ...prev, [theme]: next })),
    [theme],
  );

  const resolved: "light" | "dark" =
    appearance === "system" ? (systemDark ? "dark" : "light") : appearance;

  const value = useMemo(
    () => ({
      theme,
      appearance,
      setTheme: setThemeSafe,
      setAppearance: setAppearanceSafe,
      accent,
      setAccent,
      resolved,
      ready,
    }),
    [
      theme,
      appearance,
      setThemeSafe,
      setAppearanceSafe,
      accent,
      setAccent,
      resolved,
      ready,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}
