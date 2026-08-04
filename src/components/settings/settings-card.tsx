"use client";

// The Settings page: five cards, and the page's whole job is that there are
// five of them.
//
// THE VERDICT ON THE OLD SCREEN WAS "THE SCREEN IS JUST TOO BUSY"
// ==============================================================
// It was one Card with seventeen Rows in it — a flat wall in which the accent
// colour, the retry count and the speech voice were peers, because a single card
// says they are. Nothing was cut to fix that (near enough nothing here was worth
// cutting); the rows were GROUPED, which costs no functionality and is the
// entire difference between a list you scan and a list you read.
//
// The grouping is by the question each card answers, never by data type:
//
//   Appearance ........ what it looks like.
//   New kanji ......... what arrives next.
//   The drill ......... what a question does.
//   Breaks ............ two numbers. See below.
//   The numbers ....... what the app's figures mean when it prints one.
//
// EVERY NUMBER ON THIS PAGE IS AN INPUT BOX
// =========================================
// There is no sentence with a Change button on the end of it anywhere here, and
// there must never be. The user's rule, on being shown "at least 7 days, and
// longer for common words · Change": "just have the number be an input box you
// can update". A prose summary plus a button is two steps and a translation
// layer over a control that could have been the number itself. The number IS the
// control. The ± steppers that survive (Retries, clean runs) are the exception
// that proves it — they are ranges of nine and seventeen, walkable in a click.
//
// WHAT IS BANNED FROM THIS PAGE
// =============================
// `stability`, `p`, `weakness`, "fact", "godan", and any raw decimal. Those are
// the model's internals, and the user has asked what every one of them meant.
// "stability 106d" is a PREDICTION that reads as a HISTORY — the question it
// actually drew was "does that mean I did it 106 days in a row?" — and no
// caption fixes that. If a number cannot be explained to someone who has never
// read the design doc, it does not ship.
// is seconds on a clock, which is a unit and not a coefficient.

import { useEffect, useRef, useState } from "react";

import {
  AccentPicker,
  AppearancePicker,
  ThemePicker,
} from "@/components/settings/theme-picker";
import { Btn, Card, Chip, Hint, Lbl, Row, SmallBtn } from "@/components/ui";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { askFromAudioPrompts } from "@/lib/ask-config";
import { clearAllDismissedHints } from "@/lib/claim-hint";
import { fontLabel, JP_FONTS } from "@/lib/config";
import { availableFonts } from "@/lib/font-detect";
import { detectPlatform, type Platform } from "@/lib/platform";
import { postDelete } from "@/lib/progress-fetch";
import { useQuizConfig } from "@/lib/quiz-config";
import { useQuizSession } from "@/lib/quiz-session";
import { jaVoices, onVoicesChanged, speak } from "@/lib/speech";
import { PACK_VOICES, VOICE_PREVIEW, isPackVoice, packVoicesEnabled } from "@/lib/voice-audio";

/** Kana shown on every font chip in place of the font's name. あ and き are
 * the two faces diverge on hardest: Mincho gives あ a wedge-tipped brush
 * stroke and breaks き's third stroke off, Maru Gothic rounds every terminal
 * and joins it, Klee keeps the handwritten slant. */
const FONT_SAMPLE = "あき";

/**
 * Every number input on this page, so there is one of them and not eight.
 *
 * UNCONTROLLED, and that is the whole reason it exists. A controlled number box
 * rewrites itself from state on every keystroke, so clearing "10" to type "5"
 * momentarily parses "" as NaN and the app helpfully puts the 10 back while your
 * finger is still on the 5. The rule here is the legacy app's and it is right:
 * sync from cfg only when the box is not focused. You are typing a number; the
 * app has no business editing it under you.
 *
 * `kq-num` strips the OS spinner arrows. They are UA chrome, they take their
 * colour from the platform rather than from --text, and no token reaches them —
 * see globals.css. Typing is the interaction.
 */
function NumIn({
  value,
  onCommit,
  label,
  min = 0,
  max = 600,
  step,
}: {
  value: number;
  onCommit: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el) el.value = String(value);
  }, [value]);
  return (
    <input
      ref={ref}
      type="number"
      min={min}
      max={max}
      step={step}
      defaultValue={value}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        // Guard the empty box and the half-typed minus sign — both parse to NaN,
        // and neither is a number the user has finished stating. Nothing is
        // committed until they have; the box keeps whatever they typed.
        if (Number.isFinite(v) && v >= min && v <= max) onCommit(v);
      }}
      aria-label={label}
      className="kq-material kq-num w-16 rounded-lg border border-border bg-card px-2 py-1 text-center text-sm"
    />
  );
}

/** Legacy voice-name reformat: "Kyoko (Enhanced)" → "Kyoko · Enhanced". */
function voiceLabel(name: string): string {
  // Drop the language tag macOS appends ("Eddy (Japanese (Japan))" → "Eddy"),
  // but keep a meaningful build qualifier ("Kyoko (Enhanced)" → "Kyoko · Enhanced").
  return name
    .replace(/\s*\(Japanese \(Japan\)\)\s*$/i, "")
    .replace(/\s*\(([^)]+)\)\s*$/, " · $1")
    .trim();
}

/** The Speech voice tooltip. First and last sentences hold on any OS; the
 * middle one names a path, so it's only added once we know which OS we're on.
 * The Mac path in particular is not something you'd ever find on your own. */
function voiceInfo(platform: Platform): string {
  const where =
    platform === "mac"
      ? "under System Settings → Accessibility → Spoken Content → Manage Voices"
      : platform === "windows"
        ? "under Settings → Time & Language → Speech"
        : "in your system's speech settings";
  const siri = platform === "mac" ? " Siri voices never show up here." : "";
  return `The Japanese voices installed on this computer. You can add more ${where}, but the browser won't see them until you restart it.${siri}`;
}

/** On/Off button with the accent selected state when on. */
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <Btn sel={on} onClick={onClick}>
      {on ? "On" : "Off"}
    </Btn>
  );
}

/**
 * The one demolition on a page of preferences, and set apart as one.
 *
 * NOT a <Card>: Card hard-codes `border border-border`, and `cx` is a plain
 * join with no tailwind-merge (see ui.tsx), so a `border-danger` passed in
 * would land NEXT TO `border-border` and the winner would be decided by
 * stylesheet order, not by intent. This is the same collision the Btn note
 * documents. So the container is written out here with the danger border baked
 * in from the start — one hairline of --danger, not a filled red panel: it must
 * read as dangerous, not garish.
 *
 * The button is <Btn danger>, whose colour lives on its own branch and renders
 * --danger on --card (readable — the Chip `part` bug and the go/sel colour
 * collisions do not touch this path). The confirmation is the app's useConfirm,
 * never window.confirm: its dialog is real DOM a driver can click, and it lands
 * focus on Cancel so the irreversible answer is never the one a stray Enter
 * gives — confirming is a deliberate Tab-then-Enter or an explicit click.
 */
function ResetProgress() {
  const confirm = useConfirm();
  const { clearAllRuns } = useQuizSession();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    const ok = await confirm({
      title: "Clear everything?",
      body: (
        <>
          Every quiz you have done, everything you have marked as already known,
          and everything you have asked to be quizzed on will be erased, and the
          app returns to its very first lesson.{" "}
          <strong className="font-semibold text-danger">
            This cannot be undone.
          </strong>
        </>
      ),
      confirmLabel: "Clear everything",
      cancelLabel: "Keep my progress",
    });
    if (!ok) return;
    setBusy(true);
    try {
      // postDelete, not a raw fetch: signed out (401) the wipe happens in this
      // browser's local history instead of erroring, so "Start over" works the
      // same before and after sign-in. ok covers both "server wiped it" and "we
      // wiped the local copy".
      const res = await postDelete({ reset: true });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // The server wiped history; now wipe the CLIENT-side "I dismissed this
      // intro" flags too, so a restarting user gets the day-one introductions
      // back (the claim explainer at the top of home, and any intro added
      // later that registers in DISMISSIBLE_HINT_KEYS). Without this the reset
      // is only half a reset: empty history but the intros still suppressed.
      clearAllDismissedHints(
        typeof window === "undefined" ? null : window.localStorage,
      );
      // AND THE RUNS IN PROGRESS. This card promises the app "starts over from
      // its first lesson, as if you had just installed it", and until now it
      // wiped the knowledge base on the server and left every session, quiz and
      // parked run sitting in localStorage — so a learner whose session had
      // stopped responding pressed the app's own nuclear option and watched the
      // broken session survive it. A fresh install has nothing in progress, so
      // neither does this.
      clearAllRuns();
      setDone(true);
    } catch {
      // Same failure surface the sessions list uses for /api/delete.
      alert("Couldn't clear everything. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kq-material mb-3.5 rounded-xl border border-danger bg-card p-[18px]">
      <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-danger">
        Start over
      </p>
      <p className="mb-2.5 text-[13px] leading-snug text-text-muted">
        Wipes everything the app has learned about you: every quiz you have done,
        everything you have marked as already known, and everything you have
        asked to be quizzed on. The app starts over from its first lesson, as if
        you had just installed it.
      </p>
      <p className="mb-3.5 text-[13px] font-semibold leading-snug text-danger">
        This cannot be undone.
      </p>
      {done ? (
        <Hint>
          Cleared. The app is back to its first lesson. Open the
          home page to start over.
        </Hint>
      ) : (
        <Btn danger onClick={handleReset} disabled={busy}>
          {busy ? "Clearing…" : "Start over"}
        </Btn>
      )}
    </div>
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
  // Whether pack voices are configured. Resolved POST-MOUNT (not during render)
  // even though it only reads a NEXT_PUBLIC env: in dev the client bundle can
  // hold a stale inline of that var while the server sees the current one, so
  // reading it during render would render the picker differently on server vs.
  // client and trip a hydration mismatch. Same post-mount pattern as `voices`.
  const [packEnabled, setPackEnabled] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPackEnabled(packVoicesEnabled());
  }, []);

  // Only the fonts this machine actually has. A given machine tends to have
  // only some of the eight, and an uninstalled font doesn't fail — it renders as
  // the fallback, so listing all eight would show five identical chips claiming
  // to be five typefaces. Post-mount because detection needs a canvas.
  const [installedFonts, setInstalledFonts] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstalledFonts(availableFonts(JP_FONTS));
  }, []);

  // Platform is only knowable in the browser, so start "unknown" (the copy the
  // server renders too) and fill it in post-mount. Same shape as the font
  // detection above; keeps the server and first client paint identical.
  const [platform, setPlatform] = useState<Platform>("unknown");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detectPlatform());
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
    speak(VOICE_PREVIEW, name);
  };

  // Voice pill selection: fall back to Auto if the saved voice is gone. A pack
  // voice (Storage clips, not a browser voice) is valid even though it is not in
  // `voices`, so accept it too rather than snapping the selection back to Auto.
  const currentVoice =
    cfg.voiceName &&
    (voices.some((v) => v.name === cfg.voiceName) ||
      (isPackVoice(cfg.voiceName) && packEnabled))
      ? cfg.voiceName
      : "";

  // Nothing here dims. These are YOUR settings, not the current quiz's: the
  // timer and script label do nothing in grid mode, but greying them out
  // whenever grid happens to be selected made a preferences page change shape
  // based on a choice made on another screen — and left you unable to set up
  // the drill you were about to switch to. A setting that doesn't apply to a
  // mode simply has no effect in that mode; it doesn't need to vanish.

  return (
    <>
      <Card>
        <Lbl>Appearance</Lbl>
        <Row label="Theme">
          <ThemePicker />
        </Row>
        <Row label="Light or dark">
          <AppearancePicker />
        </Row>
        <Row
          label="Accent"
          info="Each theme keeps its own accent, so this only changes the theme you're in right now. Theme default is the colour the theme was designed with: Aizome means indigo dyeing, and Momentum's green is the same green it marks correct answers with."
        >
          <AccentPicker />
        </Row>
      </Card>

      {/* The lesson length, in kanji not minutes. Two steppers, and the ONE
          constraint that matters is enforced in the buttons themselves: the
          shortest can't pass the longest and the longest can't drop below the
          shortest, so the pair the packer receives is always a real range. The
          same guard runs again on config load (clampLessonRange), for the value
          that never came through these buttons. Cost is not shown as a raw
          number — "6" means nothing to the person doing it — so the labels talk
          in kanji, which is what the number roughly buys. */}
      <Card>
        <Lbl>How much new kanji per lesson</Lbl>
        <Row
          label="Shortest lesson"
          info="A new-kanji lesson won't be shorter than this unless there's nothing left to add. Bigger kanji count for more, so this is roughly, not exactly, a number of kanji."
        >
          <SmallBtn
            disabled={cfg.lessonMinCost <= 1}
            onClick={() =>
              update({ lessonMinCost: Math.max(1, cfg.lessonMinCost - 1) })
            }
          >
            −
          </SmallBtn>
          <span className="tabular-nums">{cfg.lessonMinCost}</span>
          {/* Can't climb past the longest — that would make the range
              backwards, which the packer has no answer for. */}
          <SmallBtn
            disabled={cfg.lessonMinCost >= cfg.lessonMaxCost}
            onClick={() => update({ lessonMinCost: cfg.lessonMinCost + 1 })}
          >
            +
          </SmallBtn>
        </Row>
        <Row
          label="Longest lesson"
          info="A lesson fills toward this and stops. One kanji can still be bigger than it all on its own, and 鬱 is 29 strokes and can't be split, so the lesson says so when that happens."
        >
          {/* Can't drop below the shortest — the other half of the same rule. */}
          <SmallBtn
            disabled={cfg.lessonMaxCost <= cfg.lessonMinCost}
            onClick={() => update({ lessonMaxCost: cfg.lessonMaxCost - 1 })}
          >
            −
          </SmallBtn>
          <span className="tabular-nums">{cfg.lessonMaxCost}</span>
          <SmallBtn
            disabled={cfg.lessonMaxCost >= 40}
            onClick={() => update({ lessonMaxCost: cfg.lessonMaxCost + 1 })}
          >
            +
          </SmallBtn>
        </Row>
      </Card>

      {/* THE WORDS-PER-LESSON STEPPER IS GONE. There is one lesson size now,
          because there is one track: radicals, kanji and words come off a single
          ordered spine and a lesson is cut by the cost above (see
          curriculum-lesson.ts). A word is priced into that same budget by its
          reading-unit count, summed across its roles (see costOf and
          src/lib/difficulty.ts), so a second control would have been a second
          answer to a question the first one already answers. */}

      <Card>
        <Lbl>The drill</Lbl>

        <Row
          label="Audio prompts"
          info="Adds listening cards, using the speech voice below: the word is played with its glyph hidden, so you answer by ear. Text cards still appear too. Turn it off if this machine has no Japanese voice, or if you can't use sound."
        >
          <Toggle
            on={cfg.audioPrompts}
            // `ask` is DERIVED from audioPrompts (see askFromAudioPrompts), so
            // regenerate it in the same update — normalizeConfig only rebuilds it
            // on load, not on a live toggle.
            onClick={() =>
              update({
                audioPrompts: !cfg.audioPrompts,
                ask: askFromAudioPrompts(!cfg.audioPrompts),
              })
            }
          />
        </Row>

        <Row
          label="Requeue when wrong"
          info="A card you get wrong comes back later in the same run. Off means the run moves on and doesn't re-show it."
        >
          <Toggle
            on={cfg.requeue}
            onClick={() => update({ requeue: !cfg.requeue })}
          />
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
              <span className="tabular-nums">{cfg.retryN}</span>
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
          label="Show the answer when you run out of goes"
          info="It shows you the answer and waits for Enter. Off means the card just comes back later."
        >
          <Toggle
            on={cfg.showAnswer}
            onClick={() => update({ showAnswer: !cfg.showAnswer })}
          />
        </Row>

        <Row
          label="Timer"
          info="Every question gets a countdown. Timing out counts as a wrong answer."
        >
          <Toggle on={cfg.timer} onClick={() => update({ timer: !cfg.timer })} />
          {cfg.timer ? (
            <>
              <NumIn
                value={cfg.timerSec}
                onCommit={(v) => update({ timerSec: Math.round(v) })}
                label="Timer seconds"
                min={1}
                max={600}
              />
              <Hint>seconds</Hint>
            </>
          ) : null}
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

        <Row label="Speech voice" info={voiceInfo(platform)}>
          {voices.length || packEnabled ? (
            <>
              {/* Auto leads; every other voice — pack (Keita/Nanami, when
                  configured) and the device's own — is folded into ONE list
                  sorted by label, so the picker reads alphabetically. */}
              <Chip on={currentVoice === ""} onClick={() => pickVoice("")}>
                Auto
              </Chip>
              {[
                ...(packEnabled
                  ? PACK_VOICES.map((p) => ({ value: p.id, label: p.label }))
                  : []),
                ...voices.map((v) => ({ value: v.name, label: voiceLabel(v.name) })),
              ]
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((p) => (
                  <Chip
                    key={p.value}
                    on={currentVoice === p.value}
                    onClick={() => pickVoice(p.value)}
                  >
                    {p.label}
                  </Chip>
                ))}
            </>
          ) : (
            <Hint>No Japanese voices found</Hint>
          )}
        </Row>
      </Card>

      {/* TWO NUMBERS, NOT A RULE. Not "first break × 2", not a curve, not a
          spacing strategy with a slider on it — two boxes you type into. The
          user does not want to configure an algorithm; they want to type 5 and
          10. If they'd rather have 5 and 5, they type that, and no part of the
          app has an opinion about it. */}
      <Card>
        <Lbl>Breaks between rounds</Lbl>
        <Row
          label="First break"
          info="The rest after your first round. Nothing runs during it, so close the tab if you like: the clock is just a time it ends at."
        >
          <NumIn
            value={cfg.restFirstMin}
            onCommit={(v) => update({ restFirstMin: Math.round(v) })}
            label="First break, minutes"
          />
          <Hint>minutes</Hint>
        </Row>
        <Row
          label="Every break after that"
          info="The rest after round two and every round beyond it."
        >
          <NumIn
            value={cfg.restThenMin}
            onCommit={(v) => update({ restThenMin: Math.round(v) })}
            label="Every break after the first, minutes"
          />
          <Hint>minutes</Hint>
        </Row>
      </Card>

      <Card>
        <Lbl>What the numbers mean</Lbl>

        <Row
          label="Accuracy shown as"
          info="Accuracy uses first try only. Applies everywhere the app shows a percentage."
        >
          <Chip
            on={cfg.accuracyMetric === "firstTry"}
            onClick={() => update({ accuracyMetric: "firstTry" })}
          >
            First try
          </Chip>
        </Row>

        <Row
          label="Show how much you've practiced"
          info="A 90% from three cards isn't really 90%. This shows the count next to the percentage."
        >
          <Toggle
            on={cfg.showVolume}
            onClick={() => update({ showVolume: !cfg.showVolume })}
          />
        </Row>

        <Row
          label="Clean runs to clear a mix-up"
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

      </Card>

      <ResetProgress />
    </>
  );
}
