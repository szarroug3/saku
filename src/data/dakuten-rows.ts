// The dakuten phase, as CONVERSIONS rather than characters.
//
// WHAT CHANGED, AND WHY
// =====================
// が used to be taught the way あ is: its own card, its own story, its own
// stroke diagram — twenty-five of them. That is twenty-five lessons for zero new
// shapes, and it teaches the wrong thing. A learner who has done the base rows
// already knows か・き・く・け・こ as pictures. What they do not know is the one
// rule that turns all five at once: voice the k and it becomes g.
//
// So the unit here is the ROW, not the kana. Five cards for hiragana — K→G,
// S→Z, T→D, H→B, H→P — each teaching one transformation and showing the five
// results together. The characters are still drilled individually (they are
// still twenty-five separate things to recognise); it is the TEACHING that
// collapses.
//
// PACING LIVES IN lesson.ts
// =========================
// Two rows are read before a drill — K→G, S→Z, then all ten. This file says
// what a row IS; src/lib/lesson.ts pairs them into the groups the budget hands
// out. Kept apart because the pairing is a pacing decision and the rows are
// data.
//
// THE HOOK IS AUTHORED ELSEWHERE
// ==============================
// One line per conversion, with the changing consonant in [brackets] — the
// notation the source document uses, parsed by the card and rendered as
// emphasis, never as literal brackets. Only K→G is written here; the other four
// are being authored and land as a straight string swap into HOOKS below. A row
// with no hook yet renders without one rather than with a placeholder, so a
// half-authored table ships as a quieter card and not a broken one.
//
// NOT MNEMONICS. src/data/mnemonics.ts is the one source for a CHARACTER's
// story — one glyph, one picture, one hook — and nothing here is a character.
// These are word hooks for a transformation; there is no drawing and there
// never will be.

/** One consonant conversion — the whole subject of one card. */
export interface DakutenRow {
  /** Stable id — React key, lesson group id, and what a test names. */
  id: string;
  setId: string;
  /** Which conversion this is, shared across the two scripts: g, z, d, b, p. */
  conv: string;
  /** The section of src/data/characters.ts the converted kana live in. */
  sectionId: string;
  /** The mark itself — ゛ or ゜. The card's hero. */
  mark: string;
  /** What it's called, said out loud on the card. */
  markName: string;
  /** The rule, bare: "k" → "g". */
  from: string;
  to: string;
  /** [base, converted] — か→が, five of them. The card's strip. */
  pairs: [string, string][];
  /** One line, consonant in [brackets]. Empty until authored. */
  hook: string;
  /** The row's irregularity, when it has one. Rendered apart from the hook. */
  callout?: string;
  /** A note about the row itself, not about one character. Only ゜ has one. */
  aside?: string;
}

/** The shared half of a conversion: everything that is about the SOUND and so
 * is the same in both scripts. */
interface ConvSpec {
  conv: string;
  mark: string;
  markName: string;
  from: string;
  to: string;
  callout?: string;
  aside?: string;
}

/**
 * The hooks, keyed by conversion.
 *
 * The changing consonant is bracketed: "[k]arate" / "[g]arden". The card parses
 * the brackets; the UI never shows them.
 *
 * SWAP POINT: four of these are empty and are being authored. Replacing a "" with
 * the authored line is the entire change — nothing else here or in the card
 * needs to move.
 */
export const HOOKS: Record<string, string> = {
  g: "The [k]arate kick smashes the [g]arden gate.",
  z: "",
  d: "",
  b: "",
  p: "",
};

const DAKUTEN = "゛";
const HANDAKUTEN = "゜";

const SPECS: ConvSpec[] = [
  { conv: "g", mark: DAKUTEN, markName: "dakuten", from: "k", to: "g" },
  {
    conv: "z",
    mark: DAKUTEN,
    markName: "dakuten",
    from: "s",
    to: "z",
    callout:
      'The odd one carries over. し is "shi", not "si" — so its voiced twin じ is "ji", not "zi".',
  },
  {
    conv: "d",
    mark: DAKUTEN,
    markName: "dakuten",
    from: "t",
    to: "d",
    callout:
      'ぢ and づ sound EXACTLY like じ and ず — same sounds, different characters. They are rare; when you do need them, they are typed "di" and "du".',
  },
  { conv: "b", mark: DAKUTEN, markName: "dakuten", from: "h", to: "b" },
  {
    conv: "p",
    mark: HANDAKUTEN,
    markName: "handakuten",
    from: "h",
    to: "p",
    // No bare ゛ in this sentence on purpose: a lone mark inside a line of body
    // text is a speck, and this is the one call-out that must not be skimmed.
    aside:
      "Same row you just marked with the two dashes — the h row is the only one that takes both. Two dashes make it b, a small circle makes it p, and the circle lands on no other row in the language.",
  },
];

/** [sectionId, base row, converted row] per script, in teaching order. */
const ROWS: Record<string, [string, string, string][]> = {
  hiragana: [
    ["h-g", "かきくけこ", "がぎぐげご"],
    ["h-z", "さしすせそ", "ざじずぜぞ"],
    ["h-d", "たちつてと", "だぢづでど"],
    ["h-bp", "はひふへほ", "ばびぶべぼ"],
    ["h-bp", "はひふへほ", "ぱぴぷぺぽ"],
  ],
  katakana: [
    ["k-g", "カキクケコ", "ガギグゲゴ"],
    ["k-z", "サシスセソ", "ザジズゼゾ"],
    ["k-d", "タチツテト", "ダヂヅデド"],
    ["k-bp", "ハヒフヘホ", "バビブベボ"],
    ["k-bp", "ハヒフヘホ", "パピプペポ"],
  ],
};

/**
 * Every conversion row, hiragana then katakana, in teaching order.
 *
 * Note the two rows that share a sectionId: は takes both marks, so the merged
 * `h-bp` section holds ten characters and two conversions. That is the merge
 * and the per-row teaching agreeing rather than fighting — the section is one
 * BASE ROW wearing two marks (which is how the picker and the Library show it),
 * and each mark is its own lesson.
 */
export const DAKUTEN_ROWS: DakutenRow[] = Object.entries(ROWS).flatMap(
  ([setId, rows]) =>
    rows.map(([sectionId, base, converted], i) => {
      const spec = SPECS[i];
      return {
        id: `${setId === "hiragana" ? "h" : "k"}-conv-${spec.conv}`,
        setId,
        sectionId,
        pairs: [...base].map((b, j) => [b, [...converted][j]] as [string, string]),
        hook: HOOKS[spec.conv] ?? "",
        ...spec,
      };
    }),
);

const BY_GLYPH: Record<string, DakutenRow> = Object.fromEntries(
  DAKUTEN_ROWS.flatMap((row) => row.pairs.map(([, c]) => [c, row])),
);

/** The conversion that produces this character, or null if it isn't a converted
 * kana. A lookup, never a parse. */
export function dakutenRowFor(c: string): DakutenRow | null {
  return BY_GLYPH[c] ?? null;
}

/** The section ids whose characters are taught by a conversion card rather than
 * one card each — what lesson.ts skips when it walks the sections. */
export const DAKUTEN_SECTIONS: ReadonlySet<string> = new Set(
  DAKUTEN_ROWS.map((r) => r.sectionId),
);

/**
 * A hook line, split into its bracketed and plain runs.
 *
 * "The [k]arate kick" → [{text:"The "},{text:"k",hit:true},{text:"arate kick"}].
 * The brackets are source notation for "this is the sound the line is about";
 * the card renders the hits as emphasis and the brackets never reach the page.
 */
export function hookRuns(hook: string): { text: string; hit: boolean }[] {
  const runs: { text: string; hit: boolean }[] = [];
  for (const part of hook.split(/(\[[^\]]*\])/)) {
    if (!part) continue;
    const hit = part.startsWith("[") && part.endsWith("]");
    runs.push({ text: hit ? part.slice(1, -1) : part, hit });
  }
  return runs;
}
