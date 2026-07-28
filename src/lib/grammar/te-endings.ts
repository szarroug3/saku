// The て/で-form's PER-ENDING skills — the grouping the te-form drill splits on.
//
// WHY THE て-FORM IS SPLIT INTO ENDINGS
// ====================================
// A textbook teaches "the て-form" once, and the drill used to score it once — a
// single production fact, `grammar:te-sequence/production`, baked on 行く → 行って.
// So a full-coverage te-form round asked the learner to build the て-form of ONE
// verb (one ending) and called the whole form covered. But the て-form is really
// several separate sound-change rules (音便): a godan ending in く becomes いて
// (書く → 書いて); む/ぶ/ぬ become んで; す becomes して; and so on. Knowing one is
// not knowing another. Sam wants each ending drilled as its OWN question, so the
// production side of the te-form splits into one fact per ending (see
// `teEndingProductionFactId` in data/grammar/index.ts), keyed on the ENDING the
// way `productionAspect` keys the split patterns on the HOST.
//
// WHY る-ENDING VERBS ARE NOT AN ENDING
// ====================================
// A verb ending in る could be ichidan (食べる → 食べて) or godan (帰る → 帰って),
// and NOTHING in the spelling says which — so a learner cannot produce the て-form
// of a る-verb she has not already been taught the class of. "Ask about any ending
// except words that end in る" (Sam). So there is no `ru` ending here: neither the
// ichidan る→て case nor the godan る→って case gets a per-ending fact, and a
// godan-る verb (帰る, v5r) maps to NO bucket — it can never roll as a vehicle for
// any ending. The class ambiguity is exactly what `endingBucketOf` refuses to
// paper over by keying on the CLASS and returning null for る.
//
// する / 来る / 行く ARE NOT ENDINGS EITHER. して / きて are lexical irregulars, not
// one of the 音便 endings; 行く → 行って is the いく exception (a く verb that does
// NOT take いて). All three return null from `endingBucketOf`, so none of them ever
// rolls as a per-ending vehicle. They are left to the teach page.

import type { WordClass } from "../conjugate/index.ts";

/**
 * The te-form endings that get their own production fact, in teaching order.
 * The tag is also the fact-id qualifier: `grammar:te-sequence/production@te-utsu`.
 *
 *   te-utsu   godan う・つ:   drop the kana, add って   買う → 買って, 待つ → 待って
 *   te-ku     godan く:       drop く, add いて          書く → 書いて
 *   te-gu     godan ぐ:       drop ぐ, add いで          泳ぐ → 泳いで
 *   te-mbn    godan む・ぶ・ぬ: drop the kana, add んで   飲む → 飲んで, 遊ぶ → 遊んで
 *   te-su     godan す:       drop す, add して          話す → 話して
 *
 * Note う・つ but NOT る: a godan る is spelling-ambiguous (see the header), so it
 * is deliberately absent from the te-utsu bucket even though it shares って.
 */
export type TeEnding = "te-utsu" | "te-ku" | "te-gu" | "te-mbn" | "te-su";

/** The endings in teaching order — the order the intro lays them out. */
export const TE_ENDINGS: readonly TeEnding[] = [
  "te-utsu",
  "te-ku",
  "te-gu",
  "te-mbn",
  "te-su",
];

/**
 * Which per-ending bucket a verb's conjugation class falls under, or null when
 * the class is not one of the drillable endings.
 *
 * KEYED ON THE CLASS, not the last kana, because the last kana lies: 帰る (v5r)
 * and 食べる (v1) both end in る but are godan and ichidan respectively. Only the
 * five godan classes below are drillable endings; everything else is null:
 *
 *   - v5r (帰る), v1 (食べる): る-ending — spelling-ambiguous, no per-ending fact.
 *   - v5k-s (行く): the いく exception (行って, not 行いて), not the plain く rule.
 *   - v5u-s (問う): 問うて, a different 音便 from 買う's って, and rare.
 *   - vs-i/vs-s (する), vk (来る): lexical irregulars (して, きて), not 音便.
 *
 * A null-class vehicle never rolls for any ending (see vehiclesFor / pickVehicle),
 * which is exactly the guard that keeps an unknown る-verb off the board.
 */
export function endingBucketOf(cls: WordClass | null): TeEnding | null {
  switch (cls) {
    case "v5u":
    case "v5t":
      return "te-utsu";
    case "v5k":
      return "te-ku";
    case "v5g":
      return "te-gu";
    case "v5m":
    case "v5b":
    case "v5n":
      return "te-mbn";
    case "v5s":
      return "te-su";
    default:
      // v5r / v1 (る-ambiguous), v5k-s (行く), v5u-s (問う), する/来る, non-verbs.
      return null;
  }
}

/** A representative verb for baking an ending's production fact — surface, kana,
 * class. Each is a common N5 verb of exactly that ending and lives in the vehicle
 * pool (lib/grammar/vehicles.ts), so a learner who knows it is drilled on the
 * real word rather than the anchor. This is the te-form's analogue of the fixed
 * 行く every other pattern bakes its fact on. */
export interface EndingVehicle {
  readonly surface: string;
  readonly kana: string;
  readonly cls: WordClass;
}

/** The verb each ending's production fact is baked on. Every one is in
 * VERB_VEHICLES and maps to its own bucket under `endingBucketOf`. */
export const ENDING_ANCHOR: Record<TeEnding, EndingVehicle> = {
  "te-utsu": { surface: "買う", kana: "かう", cls: "v5u" },
  "te-ku": { surface: "書く", kana: "かく", cls: "v5k" },
  "te-gu": { surface: "泳ぐ", kana: "およぐ", cls: "v5g" },
  "te-mbn": { surface: "飲む", kana: "のむ", cls: "v5m" },
  "te-su": { surface: "話す", kana: "はなす", cls: "v5s" },
};

/** How an ending reads as a short label — the verbs it covers, in a beginner's
 * vocabulary. Used by the Library entry page's per-ending "Build it" rows. */
export const ENDING_LABEL: Record<TeEnding, string> = {
  "te-utsu": "う・つ",
  "te-ku": "く",
  "te-gu": "ぐ",
  "te-mbn": "む・ぶ・ぬ",
  "te-su": "す",
};
