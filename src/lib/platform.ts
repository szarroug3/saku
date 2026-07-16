// Which OS the browser is running on. Used only for copy: one tooltip names a
// system settings path, and the path is different on every OS.
//
// `navigator.userAgentData.platform` is the sanctioned read but Chromium-only;
// `navigator.platform` is deprecated and still the only answer in Safari and
// Firefox. Try the first, fall back to the second.
//
// "unknown" is a real answer, not a failure — on the server, on mobile, and on
// anything we can't place. Callers are expected to drop the OS-specific half of
// a sentence rather than guess a path, because a confidently wrong path sends
// you hunting through menus that don't exist.

export type Platform = "mac" | "windows" | "unknown";

let cache: Platform | undefined;

/** The OS this is running on, or "unknown" if we can't tell (including SSR). */
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  if (cache !== undefined) return cache;

  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const raw = (nav.userAgentData?.platform || navigator.platform || "").toLowerCase();
  cache = raw.includes("mac") ? "mac" : raw.includes("win") ? "windows" : "unknown";
  return cache;
}
