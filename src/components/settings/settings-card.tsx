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
import { useQuizConfig } from "@/lib/quiz-config";
import { jaVoices, onVoicesChanged, speak } from "@/lib/speech";

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

  const toggleFont = (font: string) => {
    set((prev) => {
      const has = prev.fonts.includes(font);
      // At least one font stays selected, like the direction toggles.
      if (has && prev.fonts.length === 1) return prev;
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

  // Grid mode ignores the timer, script label, and typed-answer preview.
  const gridDim = cfg.mode === "grid";

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
        info="Used everywhere the app shows a percentage — the drill HUD, the deck rings on Home, the circles in the character picker — so the number always means one thing. First try asks whether you knew it on sight, which is what the app is training. Eventually right counts a card you got after a retry."
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
        hint="how much a deck has been drilled, next to its accuracy"
        info="88% from four attempts is not 88%. The bar under each deck shows how much you have actually practised it, so a barely-touched deck can't look mastered."
      >
        <Toggle
          on={cfg.showVolume}
          onClick={() => update({ showVolume: !cfg.showVolume })}
        />
      </Row>

      <Row
        label="Clean runs to clear a confusion"
        info="Get a mix-up right this many times in a row and it is considered fixed: it stops appearing in Patterns, in Home's Confusions card, and in Weakest 20 — only Statistics keeps remembering it. Counts only runs that actually contained those characters. Lower it if you learn fast."
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
        hint="timeout costs a retry"
        info="Each question gets a countdown. Running out spends a retry, exactly as if you had answered wrong — so a timeout is a miss, not a free pass."
        dim={gridDim}
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
        hint="when out of retries"
        info="Once a card is out of retries it reveals the answer and waits for Enter, so you read it before moving on. With this off, the card just re-queues and you meet it again later."
      >
        <Toggle
          on={cfg.showAnswer}
          onClick={() => update({ showAnswer: !cfg.showAnswer })}
        />
      </Row>

      <Row
        label="Script label on the card"
        hint="off = identify hiragana vs katakana yourself"
        info="Telling you a card is katakana narrows it to 107 characters before you have read anything. Turning this off makes you place the script yourself, which is closer to reading in the wild."
        dim={gridDim}
      >
        <Toggle
          on={cfg.scriptLabel}
          onClick={() => update({ scriptLabel: !cfg.scriptLabel })}
        />
      </Row>

      <Row
        label="Fonts"
        hint="cards draw a random font from your selection"
        info="Keep several selected: one typeface is easy to memorise as a shape rather than a character, and Japanese print varies more than English does. Pick one font to always use it."
      >
        {JP_FONTS.map((font) => (
          <Chip
            key={font}
            on={cfg.fonts.includes(font)}
            onClick={() => toggleFont(font)}
            style={{ fontFamily: font }}
            className="text-base"
          >
            {fontLabel(font)}
          </Chip>
        ))}
      </Row>

      <Row
        label="Submit on focus loss"
        hint="grid mode: Tab out of a card checks it and moves on"
        info="Only affects the grid sheet, where every character has its own box. With this on, tabbing away checks a card instead of leaving it half-answered."
      >
        <Toggle
          on={cfg.blurSubmit}
          onClick={() => update({ blurSubmit: !cfg.blurSubmit })}
        />
      </Row>

      <Row
        label="Speech voice"
        info={
          <>
            The Japanese voices installed on this Mac. Better ones are a free
            download in System Settings → Accessibility → Spoken Content →
            Manage Voices. Two quirks worth knowing: the browser only picks up
            newly installed voices after a full restart, and Siri voices are
            never offered to web pages at all.
          </>
        }
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
