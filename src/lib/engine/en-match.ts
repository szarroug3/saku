// Forgiving-but-safe matching for TYPED ENGLISH answers.
//
// The base grader (`accepts` in question.ts) compares a typed answer against a
// fact's listed glosses by exact, case- and space-insensitive equality. That is
// right for a Japanese reading and too strict for an English meaning: a JMdict
// gloss carries disambiguating notes the learner cannot know to type, numbers
// are spelled out where a digit is the obvious answer, and a single dropped
// letter should not read as "wrong".
//
// This module adds three deterministic layers, in strict priority of safety.
// The one rule the whole file obeys: it only ever ACCEPTS MORE, and only ever
// against the fact's OWN glosses — it can turn a rejected right answer into a
// pass, and can never turn one fact's wrong answer into another fact's right
// one. There is deliberately no synonym model: a benchmark showed those accept
// antonyms.
//
//   1. Strip parenthetical qualifiers. "line (of text), row, verse" also
//      accepts "line", "row", "verse" — the "(of text)" is JMdict's note and
//      the commas separate independent glosses.
//   2. Digit form of a spelled number. "four (4)" also accepts "4"; "one thing"
//      also accepts "1 thing" and "1". Only digits of number WORDS actually
//      present in the gloss are added, so no wrong answer can pass.
//   3. Length-scaled typo tolerance. An answer within a small Levenshtein
//      distance of a (paren-stripped) gloss passes — tuned so "ting"→"thing"
//      and "teacer"→"teacher" pass but "cat"/"car" and "one"/"two" do not.
//
// EVERYTHING HERE IS ENGLISH-ONLY. The layers run only against glosses that
// contain a Latin letter (`isEnglishGloss`), so a Japanese reading answer — し,
// せんせい — reaches none of them and keeps exact-match grading. That is what
// lets `accepts`, which grades readings too, call this without loosening a kana
// reading into a near-miss. Pure, dependency-free, microseconds.

/** Case- and whitespace-insensitive normalisation, shared by every comparison
 * here. Collapses internal runs of whitespace so "one  thing" === "one thing". */
export function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Whether a gloss is English — carries at least one Latin letter. A Japanese
 * reading (し, せんせい) has none, so the forgiving layers skip it and it stays
 * exact-match. A mixed gloss ("ten long thin objects, also じっぽん") counts as
 * English: its Latin part is exactly what wants the forgiveness. */
export function isEnglishGloss(s: string): boolean {
  return /[a-z]/i.test(s);
}

/**
 * Drop parenthetical "(…)" segments and collapse the leftover whitespace.
 *
 * Deterministic and note-only: it removes bracketed spans and nothing else, so
 * it can never turn a gloss into a substring free-for-all. Handles multiple and
 * nested parentheses defensively by peeling innermost groups until none remain,
 * then tidies stray brackets and doubled spaces/commas the removal can leave.
 */
export function stripParentheticals(s: string): string {
  let prev = s;
  let out = s;
  // Peel innermost "(...)" groups repeatedly so nested notes fully unwind.
  do {
    prev = out;
    out = out.replace(/\([^()]*\)/g, " ");
  } while (out !== prev);
  return out
    .replace(/[()]/g, " ") // any unbalanced bracket left over
    .replace(/\s*,\s*,\s*/g, ", ") // commas orphaned by a removed group
    .replace(/\s+,/g, ",")
    .replace(/,\s*$/g, "")
    .replace(/^\s*,\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Spelled number word → value, for units 0–19 and the round tens. Scales
 * (hundred, thousand) are handled positionally by `runValue`, not here. */
const UNITS: ReadonlyMap<string, number> = new Map([
  ["zero", 0], ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5],
  ["six", 6], ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10],
  ["eleven", 11], ["twelve", 12], ["thirteen", 13], ["fourteen", 14],
  ["fifteen", 15], ["sixteen", 16], ["seventeen", 17], ["eighteen", 18],
  ["nineteen", 19],
]);
const TENS: ReadonlyMap<string, number> = new Map([
  ["twenty", 20], ["thirty", 30], ["forty", 40], ["fifty", 50], ["sixty", 60],
  ["seventy", 70], ["eighty", 80], ["ninety", 90],
]);
const SCALES: ReadonlyMap<string, number> = new Map([
  ["hundred", 100], ["thousand", 1000],
]);

/** Every token that can appear in a spelled number. Only the correct spellings
 * — a misspelling like "fourty" is left for the typo layer to catch, never
 * parsed here (parsing it would risk inventing a number the gloss never named). */
function isNumberToken(t: string): boolean {
  return UNITS.has(t) || TENS.has(t) || SCALES.has(t);
}

/**
 * Fold a maximal run of number tokens into one value — "forty three" → 43,
 * "one hundred twenty" → 120, "one hundred" → 100. Standard tens+units+scale
 * composition. Null if the run somehow used no number word (unreachable: callers
 * only hand it runs of number tokens, but the guard keeps it honest).
 */
function runValue(tokens: readonly string[]): number | null {
  let result = 0;
  let current = 0;
  let used = false;
  for (const t of tokens) {
    if (UNITS.has(t)) current += UNITS.get(t)!;
    else if (TENS.has(t)) current += TENS.get(t)!;
    else if (t === "hundred") current = (current || 1) * 100;
    else if (t === "thousand") {
      result += (current || 1) * 1000;
      current = 0;
    } else return null;
    used = true;
  }
  return used ? result + current : null;
}

/**
 * Digit-form variants of one English fragment, or none.
 *
 * Finds each maximal run of spelled number words and replaces the WHOLE run
 * with its composed digit — so "one thing" → "1 thing", "forty three" → "43",
 * "one hundred twenty things" → "120 things" — and, when the result starts with
 * a digit, also offers that bare leading number so "one thing" accepts "1".
 *
 * Hyphens inside a compound ("forty-three") are treated as spaces so the run is
 * seen as one number. Adds ONLY digits composed from number words actually
 * present in the fragment; it never invents a number, so it cannot make a
 * genuinely wrong answer pass.
 */
export function digitVariants(fragment: string): string[] {
  const tokens = fragment.replace(/-/g, " ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let found = false;
  let i = 0;
  while (i < tokens.length) {
    if (!isNumberToken(tokens[i])) {
      out.push(tokens[i]);
      i++;
      continue;
    }
    let j = i;
    while (j < tokens.length && isNumberToken(tokens[j])) j++;
    const value = runValue(tokens.slice(i, j));
    if (value === null) {
      for (let k = i; k < j; k++) out.push(tokens[k]);
    } else {
      out.push(String(value));
      found = true;
    }
    i = j;
  }
  if (!found) return [];
  const replaced = norm(out.join(" "));
  const variants = new Set<string>([replaced]);
  const lead = replaced.match(/^(\d+)\b/);
  if (lead) variants.add(lead[1]);
  return [...variants];
}

/**
 * Every normalised candidate one English gloss should accept, exact layer plus
 * layers 1 and 2: the whole gloss, its paren-stripped form, each comma-separated
 * piece of that, and the digit variants of all of those. A Set, deduped.
 */
export function glossCandidates(gloss: string): Set<string> {
  const cands = new Set<string>();
  const add = (s: string) => {
    const n = norm(s);
    if (n) cands.add(n);
  };
  add(gloss);
  const stripped = stripParentheticals(gloss);
  const pieces = [stripped, ...stripped.split(",")];
  for (const piece of pieces) {
    const p = norm(piece);
    if (!p) continue;
    add(p);
    for (const d of digitVariants(p)) add(d);
  }
  return cands;
}

/** Levenshtein edit distance — pure, iterative, two-row. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * The typo budget for comparing two strings, scaled to the longer length:
 *
 *   ≤3 chars → 0 (exact). "cat"/"car" and "one"/"two" are one edit apart; at
 *              this length one edit is a different word, so nothing is forgiven.
 *   4–7      → 1. "ting"→"thing", "teacer"→"teacher".
 *   ≥8       → 2. "expencive"→"expensive".
 *
 * Scaled to the LONGER of the two so a short answer cannot creep up on a long
 * gloss (or vice versa) by borrowing the other's budget.
 */
export function typoBudget(len: number): number {
  if (len <= 3) return 0;
  if (len <= 7) return 1;
  return 2;
}

function withinTypo(given: string, candidate: string): boolean {
  // A DIGIT IS NEVER A TYPO. "2 things" is one-or-two edits from "1 thing", but
  // it is a different NUMBER, not a misspelling — so any candidate or answer
  // carrying a digit is matched by the exact/digit layers only, never fuzzed.
  // This is what keeps the loosest layer from letting a wrong number through.
  if (/\d/.test(given) || /\d/.test(candidate)) return false;
  const budget = typoBudget(Math.max(given.length, candidate.length));
  if (budget === 0) return false; // exact already handled by the caller
  return levenshtein(given, candidate) <= budget;
}

/**
 * Whether `given` matches any of `answers`, forgivingly but safely.
 *
 * Exact (case/space) against EVERY answer first — the unchanged base behaviour,
 * and the only layer a Japanese reading answer ever reaches. Then, for the
 * English answers only, the parenthetical/comma candidates, their digit
 * variants, and finally a length-scaled typo tolerance against each candidate.
 *
 * Order is by safety: a real match wins before any edit-distance guess, and the
 * typo layer is the last resort. Returns as soon as any layer accepts.
 */
export function matchesEnglish(given: string, answers: readonly string[]): boolean {
  const g = norm(given);
  if (!g) return false;

  // Layer 0 — exact against all answers, Japanese readings included.
  for (const a of answers) {
    if (norm(a) === g) return true;
  }

  // Build the English candidate pool once (layers 1 & 2), then the typo pass.
  const candidates = new Set<string>();
  for (const a of answers) {
    if (!isEnglishGloss(a)) continue;
    for (const c of glossCandidates(a)) candidates.add(c);
  }
  if (candidates.has(g)) return true;

  // Layer 3 — length-scaled typo tolerance, last resort.
  for (const c of candidates) {
    if (withinTypo(g, c)) return true;
  }
  return false;
}
