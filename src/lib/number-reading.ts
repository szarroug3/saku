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
 * The bare kana reading of an integer 1 ≤ n < 1_000_000_000_000 (10^12,
 * i.e. up to but not including 兆-scale).
 *
 * Splits into 4-digit groups from the right: group0 is the bare group, group1
 * (×10000) carries the myriad name まん, and group2 (×100_000_000) carries the
 * hundred-million name おく. Neither 万 nor 億 drops the 1 (10000 = いちまん,
 * 100_000_000 = いちおく) — same rule, same reason: the app has no bare "just
 * まん"/"just おく" reading to fall back to, so the leading count is always
 * spoken. Zero groups are skipped. No 兆-scale (10^12) grouping exists because
 * no 兆-scale word ships in vocab.json (SAK-176 confirmed this directly) — a
 * fourth tier would be dead code.
 */
export function numberReading(n: number): string {
  const group0 = n % 10000;
  const group1 = Math.floor(n / 10000) % 10000;
  const group2 = Math.floor(n / 100_000_000) % 10000;

  let out = "";
  if (group2 !== 0) out += groupReading(group2) + "おく";
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

/** Digit → its kanji, indexed 0–10 (0 unused). The SAME table the construction
 * pages spell their Word column with, kept here in the pure engine so the quiz's
 * READ prompt and the reference tables can never draw a number two different ways. */
const KANJI_DIGIT: readonly string[] = [
  "", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
];

/** The counter kanji each CounterKind counts — 〜本 → 本, 〜人 → 人. Matches the
 * counter glyphs the construction pages and the drill's counterKanjiOf use, so a
 * counted READ prompt (三本) and its reference table agree. */
const COUNTER_KANJI: Record<CounterKind, string> = {
  tsu: "つ",
  nin: "人",
  hon: "本",
  hiki: "匹",
  mai: "枚",
  ko: "個",
  dai: "台",
  satsu: "冊",
  hai: "杯",
  kai: "回",
  sai: "歳",
};

/** The counter kanji of a CounterKind (本, 人, …). */
export function counterKanji(counter: CounterKind): string {
  return COUNTER_KANJI[counter];
}

/**
 * The kanji spelling of an integer 1 ≤ n < 10^12 — 17 → 十七, 300 → 三百, 8000 →
 * 八千, 100000 → 十万, 10_000_000_000 → 百億. The written twin of numberReading:
 * same 4-digit-group / 万 / 億 tiers (see numberReading's doc comment for why
 * there is no fourth 兆 tier), the tens/hundreds/thousands "1" dropped (十, not
 * 一十) while 万 and 億 keep their 一 (一万, 一億), so it lines up with the
 * readings the app already ships.
 *
 * Non-recursive by tier (group() only ever encodes one 0–9999 chunk) rather
 * than the old man-only version's `numberToKanji(man)` self-call — that self-
 * call happened to be equivalent to group(man) only because man was always
 * < 10000 in the old < 10^8 range; naively adding an 億 tier on top of that
 * recursion would have produced 百万万 for 10_000_000_000 instead of 百億.
 */
export function numberToKanji(n: number): string {
  const group = (v: number): string => {
    const th = Math.floor(v / 1000) % 10;
    const h = Math.floor(v / 100) % 10;
    const t = Math.floor(v / 10) % 10;
    const o = v % 10;
    let out = "";
    if (th) out += (th === 1 ? "" : KANJI_DIGIT[th]) + "千";
    if (h) out += (h === 1 ? "" : KANJI_DIGIT[h]) + "百";
    if (t) out += (t === 1 ? "" : KANJI_DIGIT[t]) + "十";
    if (o) out += KANJI_DIGIT[o];
    return out;
  };
  const oku = Math.floor(n / 100_000_000) % 10000;
  const man = Math.floor(n / 10000) % 10000;
  const rest = n % 10000;
  let out = "";
  if (oku) out += (oku === 1 ? "一" : group(oku)) + "億";
  if (man) out += (man === 1 ? "一" : group(man)) + "万";
  if (rest) out += group(rest);
  return out;
}

/** The kanji form of a count for the READ prompt: the bare number in kanji (十七),
 * or the number welded to its counter kanji (三本, 十七人). The one place the two
 * READ render paths (the dedicated screen and the fact drill) build the prompt,
 * so they can never diverge. */
export function countToKanji(n: number, counter: CounterKind | null): string {
  return counter ? numberToKanji(n) + counterKanji(counter) : numberToKanji(n);
}

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
 * The ones-digit ALTERNATE reading each of these three numbers also carries —
 * 4 し, 7 しち, 9 く, beside the default よん/なな/きゅう. Exported so a caller
 * outside this file (src/lib/day-month-reading.ts, whose day/month readings
 * are built from these exact alternates, never a second hand-typed table) can
 * share the one branch table instead of re-declaring it and risking drift.
 */
export const ONES_BRANCH: Readonly<Record<number, string>> = { 4: "し", 7: "しち", 9: "く" };

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
  if (o in ONES_BRANCH && n % 100 !== 0) {
    // Only branch when the ones digit is actually pronounced as a bare ones
    // reading — i.e. the reading ends in ONES[o]. (n % 10 !== 0 already, and we
    // guard n%100 so e.g. no false trigger; the tail always ends in ONES[o].)
    const suffix = ONES[o];
    if (primary.endsWith(suffix)) {
      readings.push(primary.slice(0, primary.length - suffix.length) + ONES_BRANCH[o]);
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
