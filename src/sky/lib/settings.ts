// Settings' model: what a learner can change about how Saku behaves, in
// the Sky's words. Tracked under Sky: Settings. The route maps this to
// and from the app's own settings store, so what a setting means never
// changes; this file only says what there is and how it reads.
//
// Slimmer than the app's page (Sam, 2026-09-06): no requeue (never), no
// "show the answer" (always), no submit on focus loss (Enter and Check
// only), no script label (never). The break lengths live on the rest
// screen and the retries on the quiz's help bar, where they are changed:
// one home per setting, the place you would reach for it. The theme's light-or-dark rows
// are gone too, the Sky being one night; its accent and the kana fonts
// stay, under Look.

export interface SkySettings {
  /** Listening cards, with the word played and its glyph hidden. */
  audioPrompts: boolean;
  /** A pitch-accent question after an eligible word's meaning card. */
  pitchQuestions: boolean;
  /** The speech voice, by id; the route hands in the choices. */
  voice: string;
  timer: boolean;
  timerSeconds: number;
  /** The Sky's accent, by name: see SKY_ACCENTS. */
  accent: string;
  /** The kana faces in use, by family; the route hands in which are installed. */
  fonts: readonly string[];
  /** Clean runs in a row before a mix-up is considered cleared. */
  cleanRunsToClearMixup: number;
}

export const DEFAULT_SETTINGS: SkySettings = {
  audioPrompts: true,
  pitchQuestions: true,
  voice: "aoyama",
  timer: false,
  timerSeconds: 10,
  accent: "pink",
  fonts: [],
  cleanRunsToClearMixup: 10,
};

export interface VoiceChoice {
  id: string;
  label: string;
}

/** An installed kana face the learner can turn on: the family as CSS wants
 * it, and its name. */
export interface FontChoice {
  family: string;
  label: string;
}

/** The accents the Sky can wear. Every one is light enough for the dark
 * ink the accent's own text uses, so a chip stays readable in any of them. */
export const SKY_ACCENTS: readonly { id: string; label: string; color: string }[] = [
  { id: "pink", label: "Pink", color: "#f472b6" },
  { id: "gold", label: "Gold", color: "#f2c86b" },
  { id: "mint", label: "Mint", color: "#7ee0b8" },
  { id: "lilac", label: "Lilac", color: "#c8acff" },
  { id: "coral", label: "Coral", color: "#ff9a8f" },
  { id: "cyan", label: "Cyan", color: "#67d4f5" },
  { id: "azure", label: "Azure", color: "#8fb4ff" },
];

/** The accent's color, the default's when the name is unknown. */
export function accentColor(id: string | undefined): string {
  return (SKY_ACCENTS.find((a) => a.id === id) ?? SKY_ACCENTS[0]).color;
}

/** One setting as the page shows it: a label, and what it does in a line. */
export interface SettingText {
  label: string;
  info?: string;
}

/** The rows' words, so a test can read them. */
export const SETTING_TEXT: Record<keyof SkySettings, SettingText> = {
  audioPrompts: { label: "Audio prompts", info: "Adds listening cards, using the speech voice below: the word is played with its glyph hidden, so you answer by ear. Text cards still appear too. Turn it off if this machine has no Japanese voice, or if you can't use sound." },
  pitchQuestions: { label: "Pitch questions", info: "Adds a pitch-accent question after an eligible word's meaning card: hear two clips and pick the one with the word's real pitch. Needs audio prompts on, since a pitch question is itself an audio prompt." },
  voice: { label: "Speech voice", info: "The voice that reads words aloud and speaks the pitch clips." },
  timer: { label: "Timer", info: "Every question gets a countdown. Timing out counts as a wrong answer." },
  timerSeconds: { label: "Timer seconds" },
  accent: { label: "Accent", info: "The one color the sky uses for what is yours to press and what is being taught." },
  fonts: { label: "Kana fonts", info: "Cards use a random font from the ones you pick. Keep a few on so you don't just memorize one shape. Only fonts installed on this machine are offered." },
  cleanRunsToClearMixup: { label: "Clean runs to clear a mix-up", info: "How many runs in a row you must get both of a mixed-up pair right before the mix-up is considered cleared." },
};

/** What the page says when a change has not reached the account yet. */
export const SAVE_TEXT = {
  failed: "A change hasn't saved to your account yet. It's kept on this device and will keep trying.",
  retry: "Try again",
} as const;

export interface SettingGroup {
  title: string;
  keys: readonly (keyof SkySettings)[];
}

export const SETTING_GROUPS: readonly SettingGroup[] = [
  { title: "The quiz", keys: ["audioPrompts", "pitchQuestions", "voice", "timer"] },
  { title: "Look", keys: ["accent", "fonts"] },
  { title: "Progress", keys: ["cleanRunsToClearMixup"] },
];
