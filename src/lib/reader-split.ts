// Splits Japanese text into words for the reader (#BuildHybridAI), with
// kuromoji: each word as written, its dictionary form (見 is 見る, 面白かっ is
// 面白い) and its reading in hiragana.
//
// Server only. The dictionary is 17 MB of files read from node_modules. It is
// loaded once per server and kept.
//
// pnpm makes node_modules/kuromoji a symlink into node_modules/.pnpm, and
// Vercel won't deploy a function with files under a symlinked directory. So
// next.config.ts traces the dictionary at its real path in .pnpm, and this
// reads it there.

import fs from "node:fs";
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

/** The dictionary's real directory, past pnpm's symlink. */
function dictDir(): string {
  const modules = path.join(process.cwd(), "node_modules");
  const store = path.join(modules, ".pnpm");
  const real = fs.existsSync(store)
    ? fs.readdirSync(store).filter((d) => d.startsWith("kuromoji@")).map((d) => path.join(store, d, "node_modules/kuromoji/dict"))
    : [];
  return [...real, path.join(modules, "kuromoji/dict")].find((d) => fs.existsSync(d)) ?? path.join(modules, "kuromoji/dict");
}

let building: Promise<Tokenizer<IpadicFeatures>> | null = null;

function tokenizer(): Promise<Tokenizer<IpadicFeatures>> {
  building ??= new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: dictDir() }).build((err, tk) => {
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
