// Run: node --import ./src/lib/conjugate/test-hooks.mjs --test src/lib/speech.test.ts
//
// THE INVARIANT: "Auto" never picks a novelty voice while a real Japanese voice
// is installed. This is the blocker from task 22 — macOS's Eddy sorts first
// among ja-JP names, and "take the first voice" taught pronunciation from a
// joke voice. The moment listening becomes a graded quiz type that is harmful,
// so the rule is pinned here as a property of the selector, not of one machine.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { pickAutoVoice, speak, type VoiceLike } from "./speech.ts";

function v(name: string, extra: Partial<VoiceLike> = {}): VoiceLike {
  return { name, lang: "ja-JP", localService: true, ...extra };
}

describe("pickAutoVoice", () => {
  test("rejects Eddy specifically when a real voice exists", () => {
    // The exact bug: Eddy sorts first, so the old `voices[0]` chose it.
    const chosen = pickAutoVoice([v("Eddy"), v("Kyoko"), v("Otoya")]);
    assert.equal(chosen?.name, "Kyoko");
    assert.notEqual(chosen?.name, "Eddy");
  });

  test("never returns a novelty voice when any real voice is present", () => {
    const novelty = [
      "Eddy",
      "Flo",
      "Grandma",
      "Grandpa",
      "Reed",
      "Rocko",
      "Sandy",
      "Shelley",
    ];
    for (const joke of novelty) {
      // Real voice deliberately placed AFTER the novelty one alphabetically-ish,
      // so a "first wins" selector would fail this.
      const chosen = pickAutoVoice([v(joke), v("Otoya")]);
      assert.equal(chosen?.name, "Otoya", `${joke} was not rejected`);
    }
  });

  test("prefers Kyoko, then Otoya, over other real voices", () => {
    assert.equal(
      pickAutoVoice([v("Otoya"), v("Kyoko"), v("Nanami")])?.name,
      "Kyoko",
    );
    assert.equal(pickAutoVoice([v("Nanami"), v("Otoya")])?.name, "Otoya");
  });

  test("matches a voice named with its language in parentheses", () => {
    // Some engines expose "Eddy (Japanese (Japan))" / "Kyoko (Enhanced)".
    const chosen = pickAutoVoice([
      v("Eddy (Japanese (Japan))"),
      v("Kyoko (Enhanced)"),
    ]);
    assert.equal(chosen?.name, "Kyoko (Enhanced)");
  });

  test("falls back to a novelty voice only when it is the ONLY thing installed", () => {
    // A joke voice still beats no audio at all — but this is the ONLY case a
    // novelty voice may be returned.
    assert.equal(pickAutoVoice([v("Eddy")])?.name, "Eddy");
  });

  test("keeps an unknown, non-novelty voice — the selector is a preference, not a whitelist", () => {
    assert.equal(pickAutoVoice([v("Hina"), v("Eddy")])?.name, "Hina");
  });

  test("prefers a local voice, then the higher-quality build, among the same name", () => {
    const chosen = pickAutoVoice([
      v("Kyoko", { localService: false }),
      v("Kyoko (Enhanced)", { localService: true }),
    ]);
    assert.equal(chosen?.name, "Kyoko (Enhanced)");
  });

  test("returns undefined for an empty list — nothing installed, degrade to silence", () => {
    assert.equal(pickAutoVoice([]), undefined);
  });
});

describe("speak duplicate guard", () => {
  test("drops a rapid duplicate of the same text+voice", () => {
    const calls: string[] = [];
    const fake = {
      getVoices: () => [],
      cancel: () => {},
      speak: (_u: unknown) => calls.push("speak"),
      addEventListener: (_: string, fn: () => void) => fn(),
      removeEventListener: () => {},
    } as unknown as SpeechSynthesis;

    class FakeUtterance {
      lang = "";
      voice: unknown = null;
      rate = 1;
      constructor(_text: string) {}
    }

    const g = globalThis as unknown as {
      window?: Window & typeof globalThis;
      speechSynthesis?: SpeechSynthesis;
      SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
    };
    const prevWindow = g.window;
    const prevSynth = g.speechSynthesis;
    const prevUtter = g.SpeechSynthesisUtterance;

    g.window = { ...(g.window ?? {}), speechSynthesis: fake } as Window & typeof globalThis;
    g.speechSynthesis = fake;
    g.SpeechSynthesisUtterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance;

    try {
      speak("でんわ", "");
      speak("でんわ", "");
      assert.equal(calls.length, 1);
    } finally {
      g.window = prevWindow;
      g.speechSynthesis = prevSynth;
      g.SpeechSynthesisUtterance = prevUtter;
    }
  });
});
