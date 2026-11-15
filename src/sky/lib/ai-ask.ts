// The order every Gemini feature asks its models in (#BuildHybridAI): the
// first model (Nano on the device when Chrome has it, the cloud when not),
// then the cloud when the first fails, runs out of time, or answers with
// something its check rejects. The mix-up coach and the page questions use
// it; the writing drill's grader has its own order, since a device "close"
// goes to the cloud even when it is well formed.
//
// Nothing here knows about Firebase. The route hands in the models as plain
// functions, so the order and the checks are tested with fakes.

/** Where an answer was worked out. */
export type Source = "on_device" | "in_cloud";

/** One model asked one prompt: its reply text, and where it ran. */
export type AskModel = (prompt: string) => Promise<{ text: string; source: Source } | null>;

export interface Models {
  /** On the device when it can be, the cloud when not. */
  first: AskModel;
  /** The cloud only, for when the first answer can't be used. */
  cloud: AskModel;
  online: () => boolean;
  /** How long each gets, in ms. */
  firstMs?: number;
  cloudMs?: number;
  /** Where a failed, slow or rejected answer is reported. */
  warn?: (message: string, detail: unknown) => void;
}

export interface Answer {
  text: string;
  source: Source;
  /** Nano answered, but its check rejected the answer, so the cloud was
   * asked. */
  replaced?: boolean;
}

/** Nano took 3 to 7.5 s on the writing drill's prompts and can take longer
 * the first time after Chrome starts; the cloud takes about a second. */
const ASK_MS = 20_000;

export function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} took longer than ${ms / 1000} s`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** Kana and kanji. The long vowel mark and the iteration mark count too. */
export const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー々]/gu;

/** The Japanese characters of `text` that `given` doesn't have, each once. */
export function charsOutside(text: string, given: string): string[] {
  const have = new Set(given.match(JAPANESE) ?? []);
  return [...new Set(text.match(JAPANESE) ?? [])].filter((c) => !have.has(c));
}

export interface AskSpec {
  prompt: string;
  /** The reply read back to its text, or null when it has none. */
  parse: (reply: string) => string | null;
  /** What in the text the check rejects. Empty means it can be shown. */
  check: (text: string) => string[];
  /** Names the feature in the console: "Mix-up coach". */
  label: string;
}

/** The first usable answer: the first model's, else the cloud's. Null when
 * neither gave one; the screen then says it couldn't answer. */
export async function askInOrder(spec: AskSpec, models: Models): Promise<Answer | null> {
  const { first, cloud, online, firstMs = ASK_MS, cloudMs = ASK_MS, warn = console.warn } = models;
  let rejected = false;
  const usable = async (ask: AskModel, ms: number, what: string): Promise<Answer | null> => {
    try {
      const reply = await within(ask(spec.prompt), ms, what);
      const text = reply && spec.parse(reply.text);
      if (!reply || !text) return null;
      const off = spec.check(text);
      if (off.length) {
        // only Nano's answer is "replaced"; with no Nano the first answer
        // was the cloud's own
        if (reply.source === "on_device") rejected = true;
        warn(`${spec.label}: ${what} used Japanese it wasn't given.`, { off, text });
        return null;
      }
      return { text, source: reply.source };
    } catch (error) {
      warn(`${spec.label}: ${what} gave no answer.`, error);
      return null;
    }
  };
  const one = await usable(first, firstMs, "the first model");
  // a cloud answer from the first model is as good as the cloud gets
  if (one) return one;
  if (!online()) return null;
  const two = await usable(cloud, cloudMs, "the cloud model");
  return two && (rejected ? { ...two, replaced: true } : two);
}

/** Reads one string field out of a model's JSON reply. */
export function jsonField(reply: string, field: string): string | null {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = (JSON.parse(reply.slice(start, end + 1)) as Record<string, unknown>)[field];
    const out = typeof value === "string" ? value.trim() : "";
    return out || null;
  } catch {
    return null;
  }
}
