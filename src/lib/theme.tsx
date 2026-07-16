"use client";

// Theme context — which palette (aizome / graphite / momentum / kiri) and
// which mode (system / light / dark). Both live on <html> as data-theme and
// data-appearance; globals.css does the rest.
//
// Persisted to their OWN localStorage keys, deliberately NOT inside
// "kanaquiz-cfg": how the app looks isn't quiz configuration, and keeping it
// separate is what lets the inline no-flash script in layout.tsx read it with
// two cheap getItem calls instead of parsing the whole config blob.
//
// The attributes are already correct before React runs (that script stamps
// them pre-paint). This provider is the source of truth from mount onward:
// it re-reads storage post-mount, then writes the attributes back on change.

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

// `satisfies` rather than `: ThemeName` so these keep their literal types —
// layout.tsx pins its own copies to `typeof DEFAULT_THEME` etc. to make drift
// a compile error. See the comment there for why it can't just import these.
export const DEFAULT_THEME = "kiri" satisfies ThemeName;
export const DEFAULT_APPEARANCE = "system" satisfies Appearance;

export const THEME_KEY = "kanaquiz-theme";
export const APPEARANCE_KEY = "kanaquiz-appearance";

function isTheme(v: unknown): v is ThemeName {
  return THEMES.includes(v as ThemeName);
}

function isAppearance(v: unknown): v is Appearance {
  return APPEARANCES.includes(v as Appearance);
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

interface ThemeContextValue {
  theme: ThemeName;
  appearance: Appearance;
  setTheme(theme: ThemeName): void;
  setAppearance(appearance: Appearance): void;
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
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // One-time localStorage hydration must run post-mount (SSR can't read it)
    // and set state synchronously so the real choice paints in the same pass.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(load(THEME_KEY, isTheme, DEFAULT_THEME));
    setAppearance(load(APPEARANCE_KEY, isAppearance, DEFAULT_APPEARANCE));
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

  const setThemeSafe = useCallback((next: ThemeName) => setTheme(next), []);
  const setAppearanceSafe = useCallback(
    (next: Appearance) => setAppearance(next),
    [],
  );

  const resolved: "light" | "dark" =
    appearance === "system" ? (systemDark ? "dark" : "light") : appearance;

  const value = useMemo(
    () => ({
      theme,
      appearance,
      setTheme: setThemeSafe,
      setAppearance: setAppearanceSafe,
      resolved,
      ready,
    }),
    [theme, appearance, setThemeSafe, setAppearanceSafe, resolved, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}
