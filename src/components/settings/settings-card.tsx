"use client";

// The single Settings card: retries, timer, display toggles, font pool,
// blur-submit, and the speech-voice picker. Every control writes straight
// through useQuizConfig, so changes persist immediately and apply live to a
// running quiz (quiz screens read cfg on every render).

import { useEffect, useRef, useState } from "react";

import {
  AppearancePicker,
  ThemePicker,
} from "@/components/settings/theme-picker";
import { Btn, Card, Chip, Hint, Row, SmallBtn } from "@/components/ui";
import { fontLabel, JP_FONTS } from "@/lib/config";
import { availableFonts } from "@/lib/font-detect";
import { useQuizConfig } from "@/lib/quiz-config";
import { jaVoices, onVoicesChanged, speak } from "@/lib/speech";

/** Kana shown on every font chip in place of the font's name. あ and き are
 * the two faces diverge on hardest: Mincho gives あ a wedge-tipped brush
 * stroke and breaks き's third stroke off, Maru Gothic rounds every terminal
 * and joins it, Klee keeps the handwritten slant. */
const FONT_SAMPLE = "あき";

/** Legacy voice-name reformat: "Kyoko (Enhanced)" → "Kyoko · Enhanced". */
function voiceLabel(name: string): string {
  return name
    .replace(/\s*\(.*?\)\s*$/, (m) => m.replace("(", "· ").replace(")", ""))
    .trim();
}

/** On/Off button with the accent selected state when on. */
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <Btn sel={on} onClick={onClick}>
      {on ? "On" : "Off"}
    </Btn>
  );
}

export function SettingsCard() {
  const { cfg, update, set } = useQuizConfig();

  // Installed Japanese voices. speechSynthesis is browser-only and its list
  // can arrive asynchronously, so populate post-mount and stay subscribed.
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    // Voice discovery must run post-mount (SSR has no speechSynthesis) and
    // set state synchronously so the pills paint in the same pass.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoices(jaVoices());
    return onVoicesChanged(() => setVoices(jaVoices()));
  }, []);

  // The typeable seconds input is uncontrolled so typing is never fought;
  // like the legacy app, sync it from cfg only while it isn't focused.
  const timerNumRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = timerNumRef.current;
    if (el && document.activeElement !== el) el.value = String(cfg.timerSec);
  }, [cfg.timerSec, cfg.timer]);

  // Only the fonts this machine actually has. A stock Mac has three of the
  // eight, and an uninstalled font doesn't fail — it renders as the fallback,
  // so listing all eight would show five identical chips claiming to be five
  // typefaces. Post-mount because detection needs a canvas (see font-detect).
  const [installedFonts, setInstalledFonts] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstalledFonts(availableFonts(JP_FONTS));
  }, []);

  const toggleFont = (font: string) => {
    set((prev) => {
      const has = prev.fonts.includes(font);
      // At least one font stays selected, like the direction toggles — counted
      // over installed fonts only, since a saved config can carry names this
      // machine can't render and those aren't really "on".
      const onCount = prev.fonts.filter((f) => installedFonts.includes(f)).length;
      if (has && onCount <= 1) return prev;
      return {
        ...prev,
        fonts: has
          ? prev.fonts.filter((f) => f !== font)
          : [...prev.fonts, font],
      };
    });
  };

  const pickVoice = (name: string) => {
    update({ voiceName: name });
    speak("こんにちは", name);
  };

  // Voice pill selection: fall back to Auto if the saved voice is gone.
  const currentVoice =
    cfg.voiceName && voices.some((v) => v.name === cfg.voiceName)
      ? cfg.voiceName
      : "";

  // Nothing here dims. These are YOUR settings, not the current quiz's: the
  // timer and script label do nothing in grid mode, but greying them out
  // whenever grid happens to be selected made a preferences page change shape
  // based on a choice made on another screen — and left you unable to set up
  // the drill you were about to switch to. A setting that doesn't apply to a
  // mode simply has no effect in that mode; it doesn't need to vanish.

  return (
    <Card>
      <Row label="Theme">
        <ThemePicker />
      </Row>

      <Row label="Appearance">
        <AppearancePicker />
      </Row>

      <Row
        label="Accuracy shown as"
        info="First try only counts cards you got without a retry. Eventually right counts them however many goes it took. Applies everywhere the app shows a percentage."
      >
        <Chip
          on={cfg.accuracyMetric === "firstTry"}
          onClick={() => update({ accuracyMetric: "firstTry" })}
        >
          First try
        </Chip>
        <Chip
          on={cfg.accuracyMetric === "attempt"}
          onClick={() => update({ accuracyMetric: "attempt" })}
        >
          Eventually right
        </Chip>
      </Row>

      <Row
        label="Show practice volume"
        info="A 90% from three cards isn't really 90%. This shows how much you've actually drilled each deck."
      >
        <Toggle
          on={cfg.showVolume}
          onClick={() => update({ showVolume: !cfg.showVolume })}
        />
      </Row>

      <Row
        label="Clean runs to clear a confusion"
        info="Get a mix-up right this many times in a row and it stops being flagged. Only runs with those characters in them count. Lower it if you learn fast."
      >
        <SmallBtn
          disabled={cfg.graduateRuns <= 3}
          onClick={() => update({ graduateRuns: cfg.graduateRuns - 1 })}
        >
          −
        </SmallBtn>
        <span className="tabular-nums">{cfg.graduateRuns}</span>
        <SmallBtn
          disabled={cfg.graduateRuns >= 20}
          onClick={() => update({ graduateRuns: cfg.graduateRuns + 1 })}
        >
          +
        </SmallBtn>
      </Row>

      <Row label="Retries">
        <Chip on={cfg.retries === "none"} onClick={() => update({ retries: "none" })}>
          None
        </Chip>
        <Chip on={cfg.retries === "lim"} onClick={() => update({ retries: "lim" })}>
          Limited
        </Chip>
        <Chip on={cfg.retries === "unl"} onClick={() => update({ retries: "unl" })}>
          Unlimited
        </Chip>
        {cfg.retries === "lim" ? (
          <>
            <SmallBtn
              disabled={cfg.retryN <= 1}
              onClick={() => update({ retryN: cfg.retryN - 1 })}
            >
              −
            </SmallBtn>
            <span>{cfg.retryN}</span>
            <SmallBtn
              disabled={cfg.retryN >= 9}
              onClick={() => update({ retryN: cfg.retryN + 1 })}
            >
              +
            </SmallBtn>
          </>
        ) : null}
      </Row>

      <Row
        label="Timer"
        info="Every question gets a countdown. Timing out counts as a wrong answer."
      >
        <Toggle on={cfg.timer} onClick={() => update({ timer: !cfg.timer })} />
        {cfg.timer ? (
          <>
            <input
              type="range"
              min={3}
              max={30}
              step={1}
              value={Math.min(30, cfg.timerSec)}
              onChange={(e) =>
                update({ timerSec: parseInt(e.target.value, 10) })
              }
              className="w-[110px] accent-accent"
              aria-label="Timer seconds"
            />
            <input
              ref={timerNumRef}
              type="number"
              min={1}
              max={600}
              defaultValue={cfg.timerSec}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (v >= 1) update({ timerSec: v });
              }}
              className="w-16 rounded-lg border border-border bg-card px-2 py-1 text-sm"
              aria-label="Timer seconds (typed)"
            />
            s
          </>
        ) : null}
      </Row>

      <Row
        label="Show correct answer"
        info="When a card runs out of retries it shows you the answer and waits for Enter. Off means it just comes back later."
      >
        <Toggle
          on={cfg.showAnswer}
          onClick={() => update({ showAnswer: !cfg.showAnswer })}
        />
      </Row>

      <Row
        label="Script label on the card"
        info="Off means you have to work out whether it's hiragana or katakana yourself."
      >
        <Toggle
          on={cfg.scriptLabel}
          onClick={() => update({ scriptLabel: !cfg.scriptLabel })}
        />
      </Row>

      <Row
        label="Fonts"
        info="Cards use a random font from the ones you pick. Keep a few on so you don't just memorise one shape."
      >
        {installedFonts.map((font) => {
          const name = fontLabel(font);
          const on = cfg.fonts.includes(font);
          return (
            <Chip
              key={font}
              on={on}
              onClick={() => toggleFont(font)}
              // The sample IS the label: a font name tells you nothing about
              // the face. The name stays reachable via title/aria-label, since
              // the glyphs give a screen reader nothing to read out.
              title={name}
              aria-label={name}
              aria-pressed={on}
              style={{ fontFamily: font }}
              className="px-3.5 py-0.5 text-[21px] leading-[1.5]"
            >
              {FONT_SAMPLE}
            </Chip>
          );
        })}
      </Row>

      <Row
        label="Submit on focus loss"
        info="Grid mode only. Tabbing out of a box checks that answer instead of leaving it."
      >
        <Toggle
          on={cfg.blurSubmit}
          onClick={() => update({ blurSubmit: !cfg.blurSubmit })}
        />
      </Row>

      <Row
        label="Speech voice"
        info="The Japanese voices installed on this Mac. You can download better ones under System Settings → Accessibility → Spoken Content → Manage Voices, but the browser won't see them until you restart it. Siri voices never show up here."
      >
        {voices.length ? (
          <>
            <Chip on={currentVoice === ""} onClick={() => pickVoice("")}>
              Auto
            </Chip>
            {voices.map((v) => (
              <Chip
                key={v.name}
                on={currentVoice === v.name}
                onClick={() => pickVoice(v.name)}
              >
                {voiceLabel(v.name)}
              </Chip>
            ))}
          </>
        ) : (
          <Hint>No Japanese voices found</Hint>
        )}
      </Row>
    </Card>
  );
}
