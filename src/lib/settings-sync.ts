// The one-way bridge from a settings WRITER to the settings server, for the
// writers that are plain modules with no React context.
//
// WHY A MODULE-LEVEL SIGNAL (like auth-mode.ts)
// =============================================
// The React providers (theme, quiz-config) can consume the settings context
// directly. But several settings are written by pure helpers called from deep in
// the tree — the claim explainer's dismissal, a lesson section's open state, a
// concept card marking itself shown, the latency baseline after an answer. Those
// helpers take a `Storage` and stay DOM-pure and testable; threading a React
// callback through every one of their call sites would undo that.
//
// So SettingsProvider registers a single pusher here on mount, and every writer
// calls `pushSettings(patch)` after it updates localStorage. When no provider is
// mounted (SSR, a unit test, file mode before hydration) the push is a silent
// no-op — the localStorage write already happened, so nothing is lost; the value
// simply syncs to the server the next time a provider is present (seeded reads
// and the one-time migration cover that gap).

import type { SettingsFile } from "@/types";

/** Set by SettingsProvider; null when no provider is mounted. */
let pusher: ((patch: SettingsFile) => void) | null = null;

/** SettingsProvider installs its server-write function here on mount and clears
 * it on unmount. Idempotent. */
export function registerSettingsPusher(fn: (patch: SettingsFile) => void): void {
  pusher = fn;
}

/** Stop routing pushes (provider unmounting). Only clears if `fn` is still the
 * registered one, so a remount that re-registered first is not clobbered. */
export function unregisterSettingsPusher(fn: (patch: SettingsFile) => void): void {
  if (pusher === fn) pusher = null;
}

/**
 * Send a partial settings change to the server, if a provider is listening.
 *
 * A no-op when nothing is registered — deliberately, so a writer never has to
 * know whether the app shell is mounted. The local write is the durable-enough
 * step on its own (it is the paint cache and the migration source); this is the
 * "and also tell the server" half.
 */
export function pushSettings(patch: SettingsFile): void {
  pusher?.(patch);
}
