// Verb pairs where the same event has two verbs: one for "it happened", one
// for "someone did it". 開く/開ける, 始まる/始める, 出る/出す.
//
// WHY THIS FILE IS HAND-CURATED, IN AN APP THAT REFUSES TO STORE FLASHCARDS
// ========================================================================
// Everything else here is GENERATED, on purpose: a deck can only hold 待つ→
// 待って as a card, so you learn the card, while the conjugation engine derives
// it from the verb class and there is nothing left to memorise.
//
// This table is the one place that argument does not reach, for two reasons
// that have to hold together:
//
//  - THERE IS NO RULE. The pairing is suppletive. 始まる/始める looks like a
//    tidy -aru/-eru alternation; 出る/出す is not one; 開く/開ける is not the
//    same shape as either. Worse, the shapes RUN BOTH WAYS -- of the pairs
//    proposed for this table, 9 alternate -く(vi)/-ける(vt) (開く/開ける) and 10
//    alternate the other way, -ける(vi)/-く(vt) (焼ける/焼く). Given one member
//    you cannot derive the partner, and given a shape you cannot even derive
//    the direction. A generator has nothing to stand on.
//  - JMDICT CANNOT SUPPLY IT. Its `vt`/`vi` tags say a verb IS transitive or
//    intransitive; no field anywhere says 開く pairs with 開ける. The tags below
//    are carried as VERIFICATION -- every row was checked against them -- and
//    never as the source of the pairing.
//
// So the pairing is memorised knowledge either way. The choice is whether it is
// memorised accurately, once, here, or guessed at nightly by the user.
//
// WHAT MAKES IT WORTH IT ANYWAY
// =============================
// English marks this distinction every single time, with no judgement call:
// "the door opened" and "I opened the door" are never in doubt. That is what
// makes each row CHOOSABLE -- the prompt determines exactly one answer -- and
// it is why a curated table pays for itself here and would not for, say,
// synonyms. The app supplies the inventory; the English supplies the cue.
//
// SCOPE: 69 PAIRS, NOT 413
// ========================
// scripts/ingest/transitivity.py proposes candidates mechanically (shared kanji
// stem, one intransitive member, one transitive member) and found 413 from the
// 1,238 curated verbs JMdict tags for transitivity. 69 survive here. What was
// cut and why is in that script's header and in the report; the short version
// is that the heuristic's job is recall and this file's job is precision, and a
// table of 413 pairs that includes 翻る/翻す is worse than 69 the owner will
// meet in Minna no Nihongo. Candidacy required `ichi1|spec1|spec2` -- the same
// hand-curated union the vocabulary ingest uses, and `news1` is excluded here
// for the same reason it is excluded there.
//
// ABSENCE IS DATA. Plenty of verbs have no partner at all (歩く, 死ぬ, 見る in
// the sense you want). No row was invented to fill a gap, and a verb missing
// from this table is a verb with no partner, not an oversight.

import type { WordClass } from "../lib/conjugate/index.ts";

/**
 * JMdict's own transitivity tag for a member. VERIFICATION, not the pairing.
 *
 * `ambi` and `split` both arrive from JMdict as vi+vt on one entry, and they
 * are not the same thing:
 *
 *   ambi   ONE sense carries vi AND vt. Genuinely both ways round: 開く(ひらく)
 *          is ドアが開く and ドアを開く, and 詰める is both "to pack" and
 *          "to move closer together". Real ambitransitivity, and the reason a
 *          pair table that assumes a clean 1:1 mis-handles these.
 *   split  Different senses carry vi and vt, none carries both. Usually one
 *          rare or figurative sense pulling a tag the learner will never meet.
 *
 * A third case had to be removed before either could be read: a JMdict entry is
 * keyed on a READING, so 開ける/空ける/明ける share one entry and one reading,
 * あける. Union their senses and 開ける comes out vi+vt -- which is not
 * ambitransitivity, it is three verbs sharing a headword. `stagk` says which
 * spelling a sense belongs to, and honouring it is what makes 開ける read as a
 * clean `vt`. See senses_for() in the ingest script.
 */
export type JmdictTransitivity = "vi" | "vt" | "ambi" | "split";

/** One member of a pair. */
export interface PairMember {
  /** The written form. 開ける */
  readonly word: string;
  /** Its reading. あける */
  readonly reading: string;
  /**
   * Conjugation class, for the engine.
   *
   * Pinned per member because the written form is not enough: 開く is あく
   * (this table's member) and also ひらく (a different verb), 入る is はいる and
   * also いる, 止める is とめる and also やめる. A lookup on the written form
   * alone picks one at random.
   */
  readonly cls: WordClass;
  /**
   * The English cue. "I opened the door."
   *
   * Authored to a rule: the pair's two sentences describe the SAME event with
   * the SAME nouns, and differ in nothing except who does it. Any other
   * difference and the item tests that difference instead.
   */
  readonly en: string;
  /** JMdict's tag. Checked against, never derived from. */
  readonly jmdict: JmdictTransitivity;
}

/**
 * One pair.
 *
 * The fields are named for what the learner has to decide, not for the
 * grammatical terms. "Transitive" and "intransitive" are real words and the
 * owner's textbook teaches them, but they are the same kind of word as "godan":
 * the app does not lead with them, and nothing here renders them.
 */
export interface VerbPair {
  /** It happened. The door opened. 開く */
  readonly happens: PairMember;
  /** Someone did it. I opened the door. 開ける */
  readonly doIt: PairMember;
}

export const VERB_PAIRS: readonly VerbPair[] = [
  {
    happens: { word: "開く", reading: "あく", cls: "v5k", en: "The door opened.", jmdict: "split" },
    doIt: { word: "開ける", reading: "あける", cls: "v1", en: "I opened the door.", jmdict: "vt" },
  },
  {
    happens: { word: "閉まる", reading: "しまる", cls: "v5r", en: "The door closed.", jmdict: "vi" },
    doIt: { word: "閉める", reading: "しめる", cls: "v1", en: "I closed the door.", jmdict: "vt" },
  },
  {
    happens: { word: "始まる", reading: "はじまる", cls: "v5r", en: "The class started.", jmdict: "vi" },
    doIt: { word: "始める", reading: "はじめる", cls: "v1", en: "I started the class.", jmdict: "vt" },
  },
  {
    happens: { word: "終わる", reading: "おわる", cls: "v5r", en: "The meeting ended.", jmdict: "split" },
    doIt: { word: "終える", reading: "おえる", cls: "v1", en: "I ended the meeting.", jmdict: "split" },
  },
  {
    happens: { word: "出る", reading: "でる", cls: "v1", en: "The money came out.", jmdict: "vi" },
    doIt: { word: "出す", reading: "だす", cls: "v5s", en: "I took the money out.", jmdict: "vt" },
  },
  {
    happens: { word: "入る", reading: "はいる", cls: "v5r", en: "The money went in.", jmdict: "vi" },
    doIt: { word: "入れる", reading: "いれる", cls: "v1", en: "I put the money in.", jmdict: "vt" },
  },
  {
    happens: { word: "止まる", reading: "とまる", cls: "v5r", en: "The car stopped.", jmdict: "vi" },
    doIt: { word: "止める", reading: "とめる", cls: "v1", en: "I stopped the car.", jmdict: "vt" },
  },
  {
    happens: { word: "付く", reading: "つく", cls: "v5k", en: "The light came on.", jmdict: "vi" },
    doIt: { word: "付ける", reading: "つける", cls: "v1", en: "I turned the light on.", jmdict: "vt" },
  },
  {
    happens: { word: "消える", reading: "きえる", cls: "v1", en: "The light went out.", jmdict: "vi" },
    doIt: { word: "消す", reading: "けす", cls: "v5s", en: "I turned the light off.", jmdict: "vt" },
  },
  {
    happens: { word: "落ちる", reading: "おちる", cls: "v1", en: "The cup fell.", jmdict: "vi" },
    doIt: { word: "落とす", reading: "おとす", cls: "v5s", en: "I dropped the cup.", jmdict: "vt" },
  },
  {
    happens: { word: "上がる", reading: "あがる", cls: "v5r", en: "The price went up.", jmdict: "split" },
    doIt: { word: "上げる", reading: "あげる", cls: "v1", en: "I raised the price.", jmdict: "ambi" },
  },
  {
    happens: { word: "下がる", reading: "さがる", cls: "v5r", en: "The price went down.", jmdict: "vi" },
    doIt: { word: "下げる", reading: "さげる", cls: "v1", en: "I lowered the price.", jmdict: "vt" },
  },
  {
    happens: { word: "集まる", reading: "あつまる", cls: "v5r", en: "The students gathered.", jmdict: "vi" },
    doIt: { word: "集める", reading: "あつめる", cls: "v1", en: "I gathered the students.", jmdict: "vt" },
  },
  {
    happens: { word: "決まる", reading: "きまる", cls: "v5r", en: "The date was decided.", jmdict: "vi" },
    doIt: { word: "決める", reading: "きめる", cls: "v1", en: "I decided the date.", jmdict: "vt" },
  },
  {
    happens: { word: "続く", reading: "つづく", cls: "v5k", en: "The meeting continued.", jmdict: "vi" },
    doIt: { word: "続ける", reading: "つづける", cls: "v1", en: "I continued the meeting.", jmdict: "vt" },
  },
  {
    happens: { word: "変わる", reading: "かわる", cls: "v5r", en: "The plan changed.", jmdict: "vi" },
    doIt: { word: "変える", reading: "かえる", cls: "v1", en: "I changed the plan.", jmdict: "vt" },
  },
  {
    happens: { word: "壊れる", reading: "こわれる", cls: "v1", en: "The radio broke.", jmdict: "vi" },
    doIt: { word: "壊す", reading: "こわす", cls: "v5s", en: "I broke the radio.", jmdict: "vt" },
  },
  {
    happens: { word: "割れる", reading: "われる", cls: "v1", en: "The glass broke.", jmdict: "vi" },
    doIt: { word: "割る", reading: "わる", cls: "v5r", en: "I broke the glass.", jmdict: "vt" },
  },
  {
    happens: { word: "切れる", reading: "きれる", cls: "v1", en: "The rope snapped.", jmdict: "vi" },
    doIt: { word: "切る", reading: "きる", cls: "v5r", en: "I cut the rope.", jmdict: "vt" },
  },
  {
    happens: { word: "折れる", reading: "おれる", cls: "v1", en: "The branch snapped.", jmdict: "vi" },
    doIt: { word: "折る", reading: "おる", cls: "v5r", en: "I snapped the branch.", jmdict: "vt" },
  },
  {
    happens: { word: "破れる", reading: "やぶれる", cls: "v1", en: "The paper tore.", jmdict: "vi" },
    doIt: { word: "破る", reading: "やぶる", cls: "v5r", en: "I tore the paper.", jmdict: "vt" },
  },
  {
    happens: { word: "汚れる", reading: "よごれる", cls: "v1", en: "The shirt got dirty.", jmdict: "vi" },
    doIt: { word: "汚す", reading: "よごす", cls: "v5s", en: "I got the shirt dirty.", jmdict: "vt" },
  },
  {
    happens: { word: "直る", reading: "なおる", cls: "v5r", en: "The bike got fixed.", jmdict: "vi" },
    doIt: { word: "直す", reading: "なおす", cls: "v5s", en: "I fixed the bike.", jmdict: "vt" },
  },
  {
    happens: { word: "治る", reading: "なおる", cls: "v5r", en: "The cold got better.", jmdict: "vi" },
    doIt: { word: "治す", reading: "なおす", cls: "v5s", en: "I cured the cold.", jmdict: "vt" },
  },
  {
    happens: { word: "建つ", reading: "たつ", cls: "v5t", en: "A house went up.", jmdict: "vi" },
    doIt: { word: "建てる", reading: "たてる", cls: "v1", en: "I built a house.", jmdict: "vt" },
  },
  {
    happens: { word: "立つ", reading: "たつ", cls: "v5t", en: "The pole stood up.", jmdict: "vi" },
    doIt: { word: "立てる", reading: "たてる", cls: "v1", en: "I stood the pole up.", jmdict: "vt" },
  },
  {
    happens: { word: "起きる", reading: "おきる", cls: "v1", en: "I woke up.", jmdict: "vi" },
    doIt: { word: "起こす", reading: "おこす", cls: "v5s", en: "I woke the child up.", jmdict: "vt" },
  },
  {
    happens: { word: "起こる", reading: "おこる", cls: "v5r", en: "An accident happened.", jmdict: "vi" },
    doIt: { word: "起こす", reading: "おこす", cls: "v5s", en: "I caused an accident.", jmdict: "vt" },
  },
  {
    happens: { word: "並ぶ", reading: "ならぶ", cls: "v5b", en: "The chairs lined up.", jmdict: "vi" },
    doIt: { word: "並べる", reading: "ならべる", cls: "v1", en: "I lined the chairs up.", jmdict: "vt" },
  },
  {
    happens: { word: "増える", reading: "ふえる", cls: "v1", en: "The staff increased.", jmdict: "vi" },
    doIt: { word: "増やす", reading: "ふやす", cls: "v5s", en: "I increased the staff.", jmdict: "vt" },
  },
  {
    happens: { word: "減る", reading: "へる", cls: "v5r", en: "The staff decreased.", jmdict: "vi" },
    doIt: { word: "減らす", reading: "へらす", cls: "v5s", en: "I reduced the staff.", jmdict: "vt" },
  },
  {
    happens: { word: "見える", reading: "みえる", cls: "v1", en: "The mountain is visible.", jmdict: "vi" },
    doIt: { word: "見せる", reading: "みせる", cls: "v1", en: "I showed him the mountain.", jmdict: "vt" },
  },
  {
    happens: { word: "届く", reading: "とどく", cls: "v5k", en: "The parcel arrived.", jmdict: "vi" },
    doIt: { word: "届ける", reading: "とどける", cls: "v1", en: "I delivered the parcel.", jmdict: "vt" },
  },
  {
    happens: { word: "残る", reading: "のこる", cls: "v5r", en: "The food was left over.", jmdict: "vi" },
    doIt: { word: "残す", reading: "のこす", cls: "v5s", en: "I left the food.", jmdict: "vt" },
  },
  {
    happens: { word: "戻る", reading: "もどる", cls: "v5r", en: "The book came back.", jmdict: "vi" },
    doIt: { word: "戻す", reading: "もどす", cls: "v5s", en: "I put the book back.", jmdict: "split" },
  },
  {
    happens: { word: "帰る", reading: "かえる", cls: "v5r", en: "The child went home.", jmdict: "vi" },
    doIt: { word: "帰す", reading: "かえす", cls: "v5s", en: "I sent the child home.", jmdict: "vt" },
  },
  {
    happens: { word: "回る", reading: "まわる", cls: "v5r", en: "The wheel turned.", jmdict: "vi" },
    doIt: { word: "回す", reading: "まわす", cls: "v5s", en: "I turned the wheel.", jmdict: "vt" },
  },
  {
    happens: { word: "曲がる", reading: "まがる", cls: "v5r", en: "The wire bent.", jmdict: "vi" },
    doIt: { word: "曲げる", reading: "まげる", cls: "v1", en: "I bent the wire.", jmdict: "vt" },
  },
  {
    happens: { word: "混ざる", reading: "まざる", cls: "v5r", en: "The paint mixed.", jmdict: "vi" },
    doIt: { word: "混ぜる", reading: "まぜる", cls: "v1", en: "I mixed the paint.", jmdict: "vt" },
  },
  {
    happens: { word: "焼ける", reading: "やける", cls: "v1", en: "The bread baked.", jmdict: "vi" },
    doIt: { word: "焼く", reading: "やく", cls: "v5k", en: "I baked the bread.", jmdict: "vt" },
  },
  {
    happens: { word: "燃える", reading: "もえる", cls: "v1", en: "The paper burned.", jmdict: "vi" },
    doIt: { word: "燃やす", reading: "もやす", cls: "v5s", en: "I burned the paper.", jmdict: "vt" },
  },
  {
    happens: { word: "沸く", reading: "わく", cls: "v5k", en: "The water boiled.", jmdict: "vi" },
    doIt: { word: "沸かす", reading: "わかす", cls: "v5s", en: "I boiled the water.", jmdict: "vt" },
  },
  {
    happens: { word: "冷える", reading: "ひえる", cls: "v1", en: "The beer got cold.", jmdict: "vi" },
    doIt: { word: "冷やす", reading: "ひやす", cls: "v5s", en: "I chilled the beer.", jmdict: "vt" },
  },
  {
    happens: { word: "冷める", reading: "さめる", cls: "v1", en: "The soup cooled down.", jmdict: "vi" },
    doIt: { word: "冷ます", reading: "さます", cls: "v5s", en: "I cooled the soup down.", jmdict: "vt" },
  },
  {
    happens: { word: "温まる", reading: "あたたまる", cls: "v5r", en: "The soup warmed up.", jmdict: "vi" },
    doIt: { word: "温める", reading: "あたためる", cls: "v1", en: "I warmed the soup up.", jmdict: "vt" },
  },
  {
    happens: { word: "乾く", reading: "かわく", cls: "v5k", en: "The towel dried.", jmdict: "vi" },
    doIt: { word: "乾かす", reading: "かわかす", cls: "v5s", en: "I dried the towel.", jmdict: "vt" },
  },
  {
    happens: { word: "濡れる", reading: "ぬれる", cls: "v1", en: "The towel got wet.", jmdict: "vi" },
    doIt: { word: "濡らす", reading: "ぬらす", cls: "v5s", en: "I got the towel wet.", jmdict: "vt" },
  },
  {
    happens: { word: "動く", reading: "うごく", cls: "v5k", en: "The desk moved.", jmdict: "vi" },
    doIt: { word: "動かす", reading: "うごかす", cls: "v5s", en: "I moved the desk.", jmdict: "vt" },
  },
  {
    happens: { word: "進む", reading: "すすむ", cls: "v5m", en: "The work progressed.", jmdict: "vi" },
    doIt: { word: "進める", reading: "すすめる", cls: "v1", en: "I moved the work along.", jmdict: "vt" },
  },
  {
    happens: { word: "通る", reading: "とおる", cls: "v5r", en: "The car went through.", jmdict: "vi" },
    doIt: { word: "通す", reading: "とおす", cls: "v5s", en: "I let the car through.", jmdict: "vt" },
  },
  {
    happens: { word: "移る", reading: "うつる", cls: "v5r", en: "The office moved.", jmdict: "vi" },
    doIt: { word: "移す", reading: "うつす", cls: "v5s", en: "I moved the office.", jmdict: "vt" },
  },
  {
    happens: { word: "育つ", reading: "そだつ", cls: "v5t", en: "The child grew up.", jmdict: "vi" },
    doIt: { word: "育てる", reading: "そだてる", cls: "v1", en: "I raised the child.", jmdict: "vt" },
  },
  {
    happens: { word: "生まれる", reading: "うまれる", cls: "v1", en: "A baby was born.", jmdict: "vi" },
    doIt: { word: "生む", reading: "うむ", cls: "v5m", en: "She had a baby.", jmdict: "vt" },
  },
  {
    happens: { word: "助かる", reading: "たすかる", cls: "v5r", en: "The cat was saved.", jmdict: "vi" },
    doIt: { word: "助ける", reading: "たすける", cls: "v1", en: "I saved the cat.", jmdict: "vt" },
  },
  {
    happens: { word: "捕まる", reading: "つかまる", cls: "v5r", en: "The thief was caught.", jmdict: "vi" },
    doIt: { word: "捕まえる", reading: "つかまえる", cls: "v1", en: "I caught the thief.", jmdict: "vt" },
  },
  {
    happens: { word: "隠れる", reading: "かくれる", cls: "v1", en: "The cat hid.", jmdict: "vi" },
    doIt: { word: "隠す", reading: "かくす", cls: "v5s", en: "I hid the cat.", jmdict: "vt" },
  },
  {
    happens: { word: "見つかる", reading: "みつかる", cls: "v5r", en: "The key was found.", jmdict: "vi" },
    doIt: { word: "見つける", reading: "みつける", cls: "v1", en: "I found the key.", jmdict: "vt" },
  },
  {
    happens: { word: "伝わる", reading: "つたわる", cls: "v5r", en: "The news spread.", jmdict: "vi" },
    doIt: { word: "伝える", reading: "つたえる", cls: "v1", en: "I passed the news on.", jmdict: "vt" },
  },
  {
    happens: { word: "広がる", reading: "ひろがる", cls: "v5r", en: "The blanket spread out.", jmdict: "vi" },
    doIt: { word: "広げる", reading: "ひろげる", cls: "v1", en: "I spread the blanket out.", jmdict: "vt" },
  },
  {
    happens: { word: "片付く", reading: "かたづく", cls: "v5k", en: "The room got tidy.", jmdict: "vi" },
    doIt: { word: "片付ける", reading: "かたづける", cls: "v1", en: "I tidied the room.", jmdict: "vt" },
  },
  {
    happens: { word: "掛かる", reading: "かかる", cls: "v5r", en: "The picture is hanging.", jmdict: "vi" },
    doIt: { word: "掛ける", reading: "かける", cls: "v1", en: "I hung the picture.", jmdict: "vt" },
  },
  {
    happens: { word: "詰まる", reading: "つまる", cls: "v5r", en: "The box filled up.", jmdict: "vi" },
    doIt: { word: "詰める", reading: "つめる", cls: "v1", en: "I filled the box.", jmdict: "ambi" },
  },
  {
    happens: { word: "飛ぶ", reading: "とぶ", cls: "v5b", en: "The hat flew off.", jmdict: "vi" },
    doIt: { word: "飛ばす", reading: "とばす", cls: "v5s", en: "I sent the hat flying.", jmdict: "vt" },
  },
  {
    happens: { word: "鳴る", reading: "なる", cls: "v5r", en: "The bell rang.", jmdict: "vi" },
    doIt: { word: "鳴らす", reading: "ならす", cls: "v5s", en: "I rang the bell.", jmdict: "vt" },
  },
  {
    happens: { word: "離れる", reading: "はなれる", cls: "v1", en: "The boat moved away from the dock.", jmdict: "vi" },
    doIt: { word: "離す", reading: "はなす", cls: "v5s", en: "I moved the boat away from the dock.", jmdict: "vt" },
  },
  {
    happens: { word: "過ぎる", reading: "すぎる", cls: "v1", en: "The summer passed.", jmdict: "vi" },
    doIt: { word: "過ごす", reading: "すごす", cls: "v5s", en: "I spent the summer here.", jmdict: "vt" },
  },
  {
    happens: { word: "逃げる", reading: "にげる", cls: "v1", en: "The bird escaped.", jmdict: "vi" },
    doIt: { word: "逃がす", reading: "にがす", cls: "v5s", en: "I let the bird go.", jmdict: "vt" },
  },
  {
    happens: { word: "倒れる", reading: "たおれる", cls: "v1", en: "The tree fell over.", jmdict: "vi" },
    doIt: { word: "倒す", reading: "たおす", cls: "v5s", en: "I knocked the tree over.", jmdict: "vt" },
  },
  {
    happens: { word: "乗る", reading: "のる", cls: "v5r", en: "The child got in the car.", jmdict: "vi" },
    doIt: { word: "乗せる", reading: "のせる", cls: "v1", en: "I put the child in the car.", jmdict: "vt" },
  },
];
