// Splits Japanese text into words for the reader (#BuildHybridAI), with
// kuromoji: each word as written, its dictionary form (見 is 見る, 面白かっ is
// 面白い) and its reading in hiragana.
//
// Server only. The dictionary is 17 MB of files read from node_modules, so
// next.config.ts traces node_modules/kuromoji/dict into every function. It is
// loaded once per server and kept.

import path from "node:path";

import kuromoji, { type IpadicFeatures, type Tokenizer } from "kuromoji";

import { toHiragana } from "@/lib/romaji";

export interface SplitWord {
  /** The word as it is written in the text. */
  text: string;
  /** Its dictionary form, when kuromoji knows the word. */
  base?: string;
  /** Its reading in hiragana, when kuromoji knows the word. */
  reading?: string;
  /** Punctuation, a symbol or a space: nothing to look up. */
  mark?: true;
}

let building: Promise<Tokenizer<IpadicFeatures>> | null = null;

function tokenizer(): Promise<Tokenizer<IpadicFeatures>> {
  building ??= new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: path.join(process.cwd(), "node_modules/kuromoji/dict") }).build((err, tk) => {
      if (err) {
        building = null;
        reject(err);
      } else resolve(tk);
    });
  });
  return building;
}

/** One line of text as words. */
export async function splitLine(line: string): Promise<SplitWord[]> {
  if (!line) return [];
  const tk = await tokenizer();
  return tk.tokenize(line).map((t) => {
    if (t.pos === "記号") return { text: t.surface_form, mark: true as const };
    const base = t.basic_form && t.basic_form !== "*" ? t.basic_form : undefined;
    const reading = t.reading && t.reading !== "*" ? toHiragana(t.reading) : undefined;
    return { text: t.surface_form, ...(base ? { base } : {}), ...(reading ? { reading } : {}) };
  });
}
