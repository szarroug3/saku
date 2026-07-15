// speechSynthesis helpers — Japanese voice discovery + speaking.
// Note: browsers only refresh the installed-voice list on a full restart,
// and Siri voices are never exposed to the web speech API.

export function jaVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return speechSynthesis
    .getVoices()
    .filter((v) => v.lang?.replace("_", "-").toLowerCase().startsWith("ja"));
}

/** Speak Japanese text with the configured voice ("" = auto). */
export function speak(text: string, voiceName: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  const voices = jaVoices();
  const chosen =
    (voiceName && voices.find((v) => v.name === voiceName)) || voices[0];
  if (chosen) u.voice = chosen;
  u.rate = 0.8;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/** Subscribe to voice-list changes; returns an unsubscribe. */
export function onVoicesChanged(fn: () => void): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return () => {};
  }
  speechSynthesis.addEventListener("voiceschanged", fn);
  return () => speechSynthesis.removeEventListener("voiceschanged", fn);
}
