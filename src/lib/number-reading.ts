// number-reading.ts — the pure kana-reading engine for the number-reading quiz.
//
// PURE: no React, no DOM, no data-file imports. Given an integer it returns the
// spoken kana; given an integer + counter it returns the counted form. The
// counted-form UNIT table below is cross-checked against src/data/counters.ts
// in number-reading.test.ts, so the algorithm is pinned to the readings the app
// already ships and verifies.

/** The nine ones-digit readings, indexed 1–9 (index 0 unused). */
const ONES: readonly string[] = [
  "", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう",
];

/** Read one 4-digit group (0–9999) as thousands + hundreds + tens + ones. */
function groupReading(value: number): string {
  const t = Math.floor(value / 1000) % 10;
  const h = Math.floor(value / 100) % 10;
  const e = Math.floor(value / 10) % 10;
  const o = value % 10;

  let out = "";

  // Thousands: 1→せん, 3→さんぜん, 8→はっせん, else ones[t]+せん.
  if (t === 1) out += "せん";
  else if (t === 3) out += "さんぜん";
  else if (t === 8) out += "はっせん";
  else if (t !== 0) out += ONES[t] + "せん";

  // Hundreds: 1→ひゃく, 3→さんびゃく, 6→ろっぴゃく, 8→はっぴゃく, else ones[h]+ひゃく.
  if (h === 1) out += "ひゃく";
  else if (h === 3) out += "さんびゃく";
  else if (h === 6) out += "ろっぴゃく";
  else if (h === 8) out += "はっぴゃく";
  else if (h !== 0) out += ONES[h] + "ひゃく";

  // Tens: 1→じゅう, else ones[e]+じゅう.
  if (e === 1) out += "じゅう";
  else if (e !== 0) out += ONES[e] + "じゅう";

  // Ones.
  if (o !== 0) out += ONES[o];

  return out;
}

/**
 * The bare kana reading of an integer 1 ≤ n < 100_000_000 (10^8).
 *
 * Splits into 4-digit groups from the right; group1 (×10000) carries the myriad
 * name まん. 万 does NOT drop the 1 (10000 = いちまん). Zero groups are skipped.
 */
export function numberReading(n: number): string {
  const group0 = n % 10000;
  const group1 = Math.floor(n / 10000) % 10000;

  let out = "";
  if (group1 !== 0) out += groupReading(group1) + "まん";
  if (group0 !== 0) out += groupReading(group0);
  return out;
}

/** The counters this engine can read. */
export type CounterKind =
  | "tsu"
  | "nin"
  | "hon"
  | "hiki"
  | "mai"
  | "ko"
  | "dai"
  | "satsu"
  | "hai"
  | "kai"
  | "sai";

/**
 * UNIT[counter][k] — the reading of the single count k (1–10). These carry the
 * counter's sound changes and are used verbatim; index 0 is unused padding.
 * Cross-checked against src/data/counters.ts in the test.
 */
const UNIT: Record<CounterKind, readonly string[]> = {
  tsu: ["", "ひとつ", "ふたつ", "みっつ", "よっつ", "いつつ", "むっつ", "ななつ", "やっつ", "ここのつ", "とお"],
  nin: ["", "ひとり", "ふたり", "さんにん", "よにん", "ごにん", "ろくにん", "しちにん", "はちにん", "きゅうにん", "じゅうにん"],
  hon: ["", "いっぽん", "にほん", "さんぼん", "よんほん", "ごほん", "ろっぽん", "ななほん", "はっぽん", "きゅうほん", "じゅっぽん"],
  hiki: ["", "いっぴき", "にひき", "さんびき", "よんひき", "ごひき", "ろっぴき", "ななひき", "はっぴき", "きゅうひき", "じゅっぴき"],
  mai: ["", "いちまい", "にまい", "さんまい", "よんまい", "ごまい", "ろくまい", "ななまい", "はちまい", "きゅうまい", "じゅうまい"],
  ko: ["", "いっこ", "にこ", "さんこ", "よんこ", "ごこ", "ろっこ", "ななこ", "はっこ", "きゅうこ", "じゅっこ"],
  dai: ["", "いちだい", "にだい", "さんだい", "よんだい", "ごだい", "ろくだい", "ななだい", "はちだい", "きゅうだい", "じゅうだい"],
  satsu: ["", "いっさつ", "にさつ", "さんさつ", "よんさつ", "ごさつ", "ろくさつ", "ななさつ", "はっさつ", "きゅうさつ", "じゅっさつ"],
  hai: ["", "いっぱい", "にはい", "さんばい", "よんはい", "ごはい", "ろっぱい", "ななはい", "はっぱい", "きゅうはい", "じゅっぱい"],
  kai: ["", "いっかい", "にかい", "さんかい", "よんかい", "ごかい", "ろっかい", "ななかい", "はっかい", "きゅうかい", "じゅっかい"],
  sai: ["", "いっさい", "にさい", "さんさい", "よんさい", "ごさい", "ろくさい", "ななさい", "はっさい", "きゅうさい", "じゅっさい"],
};

/**
 * The counted-form reading of n with the given counter, or null when out of
 * range. Mechanism is PREFIX + LAST UNIT:
 *   - n ≤ 10 → UNIT[counter][n] directly.
 *   - 11 ≤ n ≤ 99, d = n % 10:
 *       d ≠ 0 → numberReading(n − d) + composingUnit(counter, d)
 *       d = 0 → ONES[n/10] + UNIT[counter][10]
 * "tsu" is valid only for 1 ≤ n ≤ 10; other counters for 1 ≤ n ≤ 99.
 */
/**
 * The tail a count d (1–9) contributes as the ONES place of a compound counted
 * form (11本, 21人, …). For nearly every counter this is just UNIT[counter][d] —
 * the shift a low digit carries (いっ, ろっ, さんび…) is identical at 1 and at 11.
 *
 * 〜人 is the exception: its 1 and 2 are SUPPLETIVE native words (一人 ひとり,
 * 二人 ふたり), and those do NOT compose. 11 people is じゅういちにん, never
 * じゅうひとり; 22 people is にじゅうににん, never にじゅうふたり. In a compound the
 * ones place reverts to the Sino いち/に + にん. (四人 よにん genuinely holds at
 * every scale — 14 = じゅうよにん — so d = 4 is left untouched.)
 */
function composingUnit(counter: CounterKind, d: number): string {
  if (counter === "nin" && (d === 1 || d === 2)) return ONES[d] + "にん";
  return UNIT[counter][d];
}

export function counterReading(n: number, counter: CounterKind): string | null {
  if (n < 1) return null;
  if (counter === "tsu") {
    return n <= 10 ? UNIT.tsu[n] : null;
  }
  if (n > 99) return null;
  if (n <= 10) return UNIT[counter][n];

  const d = n % 10;
  if (d !== 0) return numberReading(n - d) + composingUnit(counter, d);
  return ONES[n / 10] + UNIT[counter][10];
}

/**
 * Every reading a learner may legitimately type for a bare number.
 *
 * Beyond numberReading(n), the isolated/ones-position branch alternates are
 * accepted: 4 し, 7 しち, 9 く — but ONLY on the final ones digit (tens use よん,
 * so 40 is よんじゅう only, never しじゅう). Deduped.
 */
export function acceptableNumberReadings(n: number): string[] {
  const primary = numberReading(n);
  const readings = [primary];

  const o = n % 10;
  const branch: Record<number, string> = { 4: "し", 7: "しち", 9: "く" };
  if (o in branch && n % 100 !== 0) {
    // Only branch when the ones digit is actually pronounced as a bare ones
    // reading — i.e. the reading ends in ONES[o]. (n % 10 !== 0 already, and we
    // guard n%100 so e.g. no false trigger; the tail always ends in ONES[o].)
    const suffix = ONES[o];
    if (primary.endsWith(suffix)) {
      readings.push(primary.slice(0, primary.length - suffix.length) + branch[o]);
    }
  }

  return dedupe(readings);
}

/**
 * counterReading(n, counter) plus its standard spelling alternates:
 *   - じゅっ ↔ じっ anywhere じゅっ appears (じゅっぽん↔じっぽん, …).
 *   - for "nin", しちにん ↔ ななにん on 7-based forms.
 * Deduped. Returns [] when counterReading is null.
 */
export function acceptableCounterReadings(n: number, counter: CounterKind): string[] {
  const primary = counterReading(n, counter);
  if (primary === null) return [];

  const readings = [primary];

  // じゅっ → じっ variant, anywhere it occurs.
  for (const r of [...readings]) {
    if (r.includes("じゅっ")) readings.push(r.replaceAll("じゅっ", "じっ"));
  }

  // 〜人: しちにん ↔ ななにん for 7-based forms.
  if (counter === "nin") {
    for (const r of [...readings]) {
      if (r.includes("しちにん")) readings.push(r.replaceAll("しちにん", "ななにん"));
    }
  }

  return dedupe(readings);
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}
