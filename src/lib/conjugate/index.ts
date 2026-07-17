// ===========================================================================
// The conjugation engine.
//
// This file is MECHANISM — it walks the tables in `rules.ts` (how to
// conjugate) and enforces the tables in `policy.ts` (what may be conjugated).
// Adding knowledge here instead of in a table is almost always a mistake.
//
// Standalone by design: imports nothing from the app.
//
// Two callers:
//   1. A drill    — conjugate(word, class, form) -> one form.
//   2. An index   — conjugateAll(word, class)    -> every form, for a
//                   forward-generated form->lemma index. First-class, not an
//                   afterthought: that feature is a loop over this function.
// ===========================================================================

import {
  ADJ_I_POLITE,
  CLASSES,
  DERIVED_FORMS,
  FORM_RULES,
  GODAN_ENDINGS,
  ONBIN,
  VOWEL_ROWS,
  type ClassDef,
  type DerivedFormRule,
} from "./rules";
import {
  ARCHAIC_CLASSES,
  CLASS_PATCHES,
  DEFECTIVE_BY_CLASS,
  DEFECTIVE_WORDS,
  FORMS_BY_CLASS,
  NOT_A_CONJUGATION_CLASS,
} from "./policy";
import type { ConjugateResult, Form, RefusalReason, StemKey, WordClass } from "./types";

/** Every class we can conjugate. 19 verb classes + 3 adjective classes. */
export const SUPPORTED_CLASSES = Object.keys(CLASSES) as WordClass[];

function fail(reason: RefusalReason, detail: string): ConjugateResult {
  return { ok: false, reason, detail };
}

function isSupported(cls: string): cls is WordClass {
  return Object.prototype.hasOwnProperty.call(CLASSES, cls);
}

// ---------------------------------------------------------------------------
// Class resolution — patches, then filters.
// ---------------------------------------------------------------------------

/**
 * Resolve a raw JMdict `<pos>` tag to a class we can drive, applying the
 * upstream-bug patches from policy.ts on the way.
 */
function resolveClass(
  word: string,
  rawClass: string,
): { ok: true; value: WordClass } | { ok: false; reason: RefusalReason; detail: string } {
  for (const patch of CLASS_PATCHES) {
    if (patch.word === word && patch.from === rawClass) {
      return { ok: true, value: patch.to };
    }
  }
  if (NOT_A_CONJUGATION_CLASS[rawClass] !== undefined) {
    return {
      ok: false,
      reason: "not-a-conjugation-class",
      detail: `'${rawClass}' is not a conjugation class: ${NOT_A_CONJUGATION_CLASS[rawClass]}`,
    };
  }
  if (ARCHAIC_CLASSES[rawClass] !== undefined) {
    return {
      ok: false,
      reason: "archaic-class",
      detail: `'${rawClass}' is out of scope: ${ARCHAIC_CLASSES[rawClass]}`,
    };
  }
  if (!isSupported(rawClass)) {
    return { ok: false, reason: "unknown-class", detail: `Unknown class '${rawClass}'.` };
  }
  return { ok: true, value: rawClass };
}

/**
 * Pick the conjugation class out of a JMdict `<pos>` tag list.
 *
 * Returns null when there isn't one — which is the correct answer for all
 * 14,354 `vs` noun entries, every archaic entry, and every plain noun. A null
 * here is not a failure; it's the `vs` filter doing its job.
 */
export function classFromTags(tags: readonly string[]): WordClass | null {
  for (const tag of tags) {
    if (isSupported(tag)) return tag;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Defectiveness — the guard that no data source gives us.
// ---------------------------------------------------------------------------

function defectiveReason(word: string, cls: WordClass, form: Form): string | null {
  const byClass = DEFECTIVE_BY_CLASS[cls];
  if (byClass?.includes(form)) {
    return `${cls} verbs have no ${form}.`;
  }
  for (const rule of DEFECTIVE_WORDS) {
    if (rule.words.includes(word) && rule.forms.includes(form)) {
      return `${word} has no ${form}: ${rule.reason}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Stem construction.
// ---------------------------------------------------------------------------

type Stems = Record<StemKey, string>;

function godanStems(word: string, def: Extract<ClassDef, { kind: "godan" }>): Stems | null {
  const last = word.slice(-1);
  const baseRow = VOWEL_ROWS[last];
  if (!baseRow) return null;
  const row = { ...baseRow, ...def.row };
  const onbin = def.onbin ?? ONBIN[last];
  const base = word.slice(0, -1);
  return {
    a: base + row.a,
    i: base + row.i,
    e: base + row.e,
    o: base + row.o,
    te: base + onbin.te,
    ta: base + onbin.ta,
  };
}

function ichidanStems(word: string): Stems | null {
  if (!word.endsWith("る")) return null;
  const base = word.slice(0, -1);
  return { a: base, i: base, e: base, o: base, te: base + "て", ta: base + "た" };
}

// ---------------------------------------------------------------------------
// Derivation.
// ---------------------------------------------------------------------------

function derivationFor(cls: WordClass, form: Form): DerivedFormRule | undefined {
  // 高い + です. Only the い-adjectives; adj-na lists です directly because its
  // dictionary form is 静かだ, and 静かだです is not a word.
  if (form === "polite" && (cls === "adj-i" || cls === "adj-ix")) return ADJ_I_POLITE;
  return DERIVED_FORMS[form];
}

// ---------------------------------------------------------------------------
// The build step. Returns null to mean "no direct rule — try derivation".
// ---------------------------------------------------------------------------

function buildDirect(word: string, cls: WordClass, form: Form): ConjugateResult | null {
  const def = CLASSES[cls];

  switch (def.kind) {
    case "godan": {
      const expected = GODAN_ENDINGS[cls];
      if (expected && !expected.some((e) => word.endsWith(e))) {
        return fail(
          "malformed",
          `'${word}' is tagged ${cls} but doesn't end with ${expected.join("/")}.`,
        );
      }
      // Suppletive forms (ある -> ない) short-circuit the stem machinery.
      const sup = def.suppletive?.[form];
      if (sup) {
        const hit = sup.find((r) => word.endsWith(r.endsWith));
        if (!hit) {
          return fail(
            "malformed",
            `${cls} ${form} is suppletive and needs '${word}' to end with one of ` +
              `${sup.map((r) => r.endsWith).join("/")}. If this is a real word, add its ` +
              `ending to the ${cls} suppletive table in rules.ts.`,
          );
        }
        return { ok: true, value: word.slice(0, word.length - hit.endsWith.length) + hit.replaceWith };
      }
      const stems = godanStems(word, def);
      if (!stems) {
        return fail("malformed", `'${word}' doesn't end in a kana the godan table knows.`);
      }
      const rule = def.forms?.[form] ?? FORM_RULES[form];
      if (!rule) return null;
      return { ok: true, value: stems[rule.stem] + rule.godan };
    }

    case "ichidan": {
      const stems = ichidanStems(word);
      if (!stems) {
        return fail("malformed", `'${word}' is tagged ${cls} but doesn't end with る.`);
      }
      const rule = def.forms?.[form] ?? FORM_RULES[form];
      if (!rule) return null;
      return { ok: true, value: stems[rule.stem] + rule.ichidan };
    }

    case "paradigm": {
      for (const variant of def.variants) {
        if (!word.endsWith(variant.match)) continue;
        // Keep the prefix. 持って来る -> 持って + 来て, NOT bare 来て — otherwise
        // all 38 くる compounds collapse onto one lemma.
        const prefix = word.slice(0, word.length - variant.match.length);
        const suffix = variant.forms[form];
        if (suffix === undefined) return null;
        return { ok: true, value: prefix + suffix };
      }
      return fail(
        "malformed",
        `'${word}' is tagged ${cls} but doesn't end with ${def.variants
          .map((v) => v.match)
          .join("/")}.`,
      );
    }

    case "adjective": {
      const stemRule = def.stemRules.find((r) => word.endsWith(r.endsWith));
      if (!stemRule) {
        return fail(
          "malformed",
          `'${word}' is tagged ${cls} but doesn't end with ${def.stemRules
            .map((r) => r.endsWith)
            .join("/")}.`,
        );
      }
      const suffix = def.forms[form];
      // い-adjectives cite as-is (高い, 気持ちいい). Only adj-na needs a suffix
      // for its dictionary form, and it lists one.
      if (form === "dictionary" && suffix === undefined) return { ok: true, value: word };
      if (suffix === undefined) return null;
      const stem =
        (stemRule.trim > 0 ? word.slice(0, word.length - stemRule.trim) : word) + stemRule.add;
      return { ok: true, value: stem + suffix };
    }
  }
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

/**
 * Conjugate one word into one form.
 *
 * `rawClass` is a JMdict `<pos>` tag verbatim — 'v5k', 'v1', 'vs-i'. Tags that
 * aren't conjugation classes are REFUSED, not guessed at. In particular
 * conjugate('勉強', 'vs', ...) fails; use `conjugateSuruNoun` instead.
 *
 * Never throws for bad input. Refusals are values, so a caller enumerating
 * 200k forms doesn't need a try/catch, and a drill can ask "is this form
 * legal?" without exception handling.
 */
export function conjugate(word: string, rawClass: string, form: Form): ConjugateResult {
  if (!word) return fail("malformed", "Empty word.");

  const resolved = resolveClass(word, rawClass);
  if (!resolved.ok) return resolved;
  const cls = resolved.value;

  if (!FORMS_BY_CLASS[cls].includes(form)) {
    return fail("form-not-in-class", `${cls} has no ${form} form.`);
  }

  const defect = defectiveReason(word, cls, form);
  if (defect) return fail("defective", defect);

  // Verbs cite as their dictionary form by definition.
  if (form === "dictionary" && CLASSES[cls].kind !== "adjective") {
    return { ok: true, value: word };
  }

  const direct = buildDirect(word, cls, form);
  if (direct) return direct;

  const derivation = derivationFor(cls, form);
  if (!derivation) return fail("form-not-in-class", `No rule builds ${form} for ${cls}.`);

  // Recursing through conjugate() rather than buildDirect() is deliberate: it
  // means defectiveness propagates for free. ある has no causative, so it also
  // has no causative-passive, without that being stated twice.
  const base = conjugate(word, rawClass, derivation.from);
  if (!base.ok) return base;

  if (derivation.trim) {
    if (!base.value.endsWith(derivation.trim)) {
      return fail(
        "malformed",
        `Can't build ${form}: ${derivation.from} of '${word}' is '${base.value}', ` +
          `which doesn't end with '${derivation.trim}'.`,
      );
    }
    return {
      ok: true,
      value: base.value.slice(0, base.value.length - derivation.trim.length) + derivation.add,
    };
  }
  return { ok: true, value: base.value + derivation.add };
}

export interface ConjugateAllResult {
  /** Every form we could generate. */
  forms: Partial<Record<Form, string>>;
  /** Every form we refused, and why. Not an error — often the correct answer. */
  refused: { form: Form; reason: RefusalReason; detail: string }[];
}

/**
 * Enumerate every form of a word.
 *
 * This is the call a forward-generated form->lemma search index is built on
 * (so that searching 読んで finds 読む). It's a first-class entry point, not a
 * convenience wrapper: the index task should be a loop over this, never a
 * reimplementation of the rules.
 */
export function conjugateAll(word: string, rawClass: string): ConjugateAllResult {
  const forms: Partial<Record<Form, string>> = {};
  const refused: ConjugateAllResult["refused"] = [];

  const resolved = resolveClass(word, rawClass);
  if (!resolved.ok) {
    return { forms, refused: [{ form: "dictionary", ...resolved }] };
  }

  for (const form of FORMS_BY_CLASS[resolved.value]) {
    const result = conjugate(word, rawClass, form);
    if (result.ok) forms[form] = result.value;
    else refused.push({ form, reason: result.reason, detail: result.detail });
  }
  return { forms, refused };
}

/**
 * Conjugate a `vs` noun by composing する onto it: 勉強 + て -> 勉強して.
 *
 * This exists because `vs` cuts both ways. Conjugating 勉強 directly emits
 * garbage, so conjugate() refuses it — but 勉強して is real, common, and a
 * beginner meets it immediately. Refusing the tag must not make the word
 * invisible.
 *
 * It's a composition rule, not extra data: a search index gets 勉強して,
 * 電話した, 結婚しよう by stripping a する-form and looking the stem up as a
 * noun — zero index growth, versus ~511k extra forms to enumerate them all.
 */
export function conjugateSuruNoun(noun: string, form: Form): ConjugateResult {
  if (!noun) return fail("malformed", "Empty noun.");
  return conjugate(noun + "する", "vs-i", form);
}

/** Which forms this class has. */
export function formsFor(cls: WordClass): Form[] {
  return FORMS_BY_CLASS[cls];
}

export type { ConjugateResult, Form, RefusalReason, WordClass } from "./types";
