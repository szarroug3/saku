// Settings' model: what a learner can change about how Saku behaves, in
// the Sky's words. Tracked under Sky: Settings. The route maps this to
// and from the app's own settings store, so what a setting means never
// changes; this file only says what there is and how it reads.
//
// The theme rows the app has (light or dark, accent, fonts) are not here:
// the Sky is one night by choice.

export type Retries = "none" | "limited" | "unlimited";

export interface SkySettings {
  /** Listening cards, with the word played and its glyph hidden. */
  audioPrompts: boolean;
  /** A pitch-accent question after an eligible word's meaning card. */
  pitchQuestions: boolean;
  /** A missed card comes back later in the same run. */
  requeue: boolean;
  retries: Retries;
  /** How many, when limited. */
  retryCount: number;
  /** Show the answer when the tries run out, rather than moving on. */
  showAnswer: boolean;
  timer: boolean;
  timerSeconds: number;
  /** Whether the card says hiragana or katakana. */
  scriptLabel: boolean;
  /** Submit a typed answer when the box loses focus. */
  submitOnBlur: boolean;
  /** The speech voice, by id; the route hands in the choices. */
  voice: string;
  /** The rest before round two, in minutes. */
  firstBreakMinutes: number;
  /** Every rest after that. */
  laterBreakMinutes: number;
  /** The count of cards answered, on the sky and in the quiz. */
  showVolume: boolean;
  /** Clean runs in a row before a mix-up is considered cleared. */
  cleanRunsToClearMixup: number;
}

export const DEFAULT_SETTINGS: SkySettings = {
  audioPrompts: true,
  pitchQuestions: true,
  requeue: true,
  retries: "limited",
  retryCount: 2,
  showAnswer: true,
  timer: false,
  timerSeconds: 10,
  scriptLabel: true,
  submitOnBlur: false,
  voice: "aoyama",
  firstBreakMinutes: 5,
  laterBreakMinutes: 10,
  showVolume: true,
  cleanRunsToClearMixup: 10,
};

export interface VoiceChoice {
  id: string;
  label: string;
}

/** One setting as the page shows it: a label, and what it does in a line. */
export interface SettingText {
  label: string;
  info?: string;
}

export const RETRIES: Record<Retries, string> = { none: "None", limited: "Limited", unlimited: "Unlimited" };

/** The rows, in the order the page shows them, by group. The controls are
 * the component's; the words are here so a test can read them. */
export const SETTING_TEXT: Record<keyof SkySettings, SettingText> = {
  audioPrompts: { label: "Audio prompts", info: "Adds listening cards, using the speech voice below: the word is played with its glyph hidden, so you answer by ear. Text cards still appear too. Turn it off if this machine has no Japanese voice, or if you can't use sound." },
  pitchQuestions: { label: "Pitch questions", info: "Adds a pitch-accent question after an eligible word's meaning card: hear two clips and pick the one with the word's real pitch. Needs audio prompts on, since a pitch question is itself an audio prompt." },
  requeue: { label: "Requeue when wrong", info: "A card you get wrong comes back later in the same run. Off means the run moves on and doesn't show it again." },
  retries: { label: "Retries" },
  retryCount: { label: "Retries allowed" },
  showAnswer: { label: "Show the answer when you run out of tries", info: "It shows you the answer and waits. Off means the card just comes back later." },
  timer: { label: "Timer", info: "Every question gets a countdown. Timing out counts as a wrong answer." },
  timerSeconds: { label: "Timer seconds" },
  scriptLabel: { label: "Script label on the card", info: "Off means you have to work out whether it's hiragana or katakana yourself." },
  submitOnBlur: { label: "Submit on focus loss", info: "A typed answer is checked when you click away from the box, not only on Enter." },
  voice: { label: "Speech voice", info: "The voice that reads words aloud and speaks the pitch clips." },
  firstBreakMinutes: { label: "First break", info: "The rest before round two of a lesson's quiz." },
  laterBreakMinutes: { label: "Every break after that" },
  showVolume: { label: "Show how much you've practiced", info: "The count of cards you've answered, on the sky and in the quiz." },
  cleanRunsToClearMixup: { label: "Clean runs to clear a mix-up", info: "How many runs in a row you must get both of a mixed-up pair right before the mix-up is considered cleared." },
};

export interface SettingGroup {
  title: string;
  keys: readonly (keyof SkySettings)[];
}

export const SETTING_GROUPS: readonly SettingGroup[] = [
  { title: "The quiz", keys: ["audioPrompts", "pitchQuestions", "voice", "requeue", "retries", "showAnswer", "timer", "scriptLabel", "submitOnBlur"] },
  { title: "Breaks", keys: ["firstBreakMinutes", "laterBreakMinutes"] },
  { title: "Progress", keys: ["showVolume", "cleanRunsToClearMixup"] },
];
