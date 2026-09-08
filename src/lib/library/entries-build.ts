// Building the entries, at build time (SAK-400).
//
// entries.ts used to mint every entry as it loaded: `LIB_ENTRIES = build()`,
// a walk over every subject's tables that every process paid for on its first
// request, and that the generated index already carried the output of. The
// walk lives here now, and only two things run it: scripts/build-library-index
// .mjs, which writes src/data/generated/library-index.json, and library-index
// .equiv.test.ts, which asserts the file still agrees with it. Nothing a page
// serves imports this module.
//
// The constants and the entry shape stay in entries.ts, which is what the app
// reads; this file imports them, never the other way round.
//
// Everything below is the code entries.ts had, moved, with its comments: the
// reading fallback the kanji rows need, the per-kind rule for which facts make
// an entry known, the alias maps the build folds into `searchAlso`, and the
// build itself.

import { CHAR_INDEX, KANA_SUBJECT, kanaEntry } from "@/data/characters";
import { KANJI, KANJI_SUBJECT, kanjiEntry, kanjiRow, meaningFactId, variantTaughtKanji } from "@/data/kanji";
import { VOCAB, VOCAB_SUBJECT, wordEntry } from "@/data/vocab";
import { GRAMMAR_SUBJECT, GRAMMAR_VOCAB_DUPLICATE_KEBS, patternEntry } from "@/data/grammar";
import { MARK_SUBJECT, MARKS, markEntry } from "@/data/marks";
import { sentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import { GRAMMAR_CONCEPT_SUBJECT, GRAMMAR_CONCEPTS, grammarConceptEntry } from "@/data/grammar-concepts";
import { NUMBER_CONSTRUCTIONS, numberConstructionEntry } from "@/data/number-construction";
import { TERM_SUBJECT, TERMS, termEntry } from "@/data/terms";
import {
  COUNTER_CURRICULUM,
  COUNTER_KANJI_GLYPHS,
  COUNTER_TAIL_FORM_ALIASES,
  COUNTER_VOCAB_DUPLICATE_KEBS,
  counterEntry,
  isKanaForm as isKanaCounterForm,
} from "@/data/counters";
import {
  RADICAL_SUBJECT,
  RADICALS,
  isRadicalTaughtAsKanji,
  radicalEntry,
  radicalByGlyph,
  radicalByWrittenForm,
} from "@/data/radicals";
import { primitiveEntry, PRIMITIVE_SUBJECT, PRIMITIVE_STROKES, primitiveStrokes } from "@/data/components";
import { cluster } from "@/data/grammar/clusters";
import { RECIPES, isPrimaryPatternRecipe, patternGroup, patternLabel } from "@/data/grammar/recipes";
import { CURRICULUM_PAIRS } from "@/lib/transitivity-lesson";
import { TRANSITIVITY_SUBJECT, pairEntry, transitivitySide } from "@/data/transitivity-facts";
import { pairPattern, shiftLabel } from "@/lib/transitivity-pattern";
import { KEIGO_SUBJECT, keigoSetEntry, recognitionGloss } from "@/data/keigo";
import { CURRICULUM_KEIGO_SETS } from "@/lib/keigo-lesson";
import { factInfo, factsOf } from "@/lib/facts";
import type { EntryId, FactId } from "@/types";
import { COMPARISON_CLUSTER_IDS, COUNTER_KIND, NUMBER_CONSTRUCTION_KIND, SENTENCE_RULE_KIND, readingsOf, type LibEntry } from "./entries";

/**
 * SAK-265: `readingsOf(c)`'s bases where it has any, else KANJIDIC2's raw
 * on/kun list (on first, matching KANJIDIC2's own order) — never a mix of the
 * two. A kanji either has evidence-backed readings or it doesn't; this exists
 * so a caller that only wants "some real readings to show/search by" (the
 * Library index's search field) never comes back empty for the 114 kanji
 * `readingsOf` has nothing for. See KanjiRow.on/.kun for why those 114 exist
 * and why this is a fallback, not a merge.
 */
export function readingBasesOf(c: string): readonly string[] {
  const aligned = readingsOf(c);
  if (aligned.length > 0) return aligned.map((r) => r.base);
  const row = kanjiRow(c);
  return row ? [...row.on, ...row.kun] : [];
}

/**
 * Which of an entry's facts decide whether it is KNOWN — the input to the
 * Library's knowledge filter, and the one place the choice is made per kind.
 * Build-time: its answer for every entry is serialized into the index, and
 * `knownFactsOf` in entries.ts reads it back (SAK-400).
 *
 * For almost everything it is all of them (`factsOf`): a kana is its one fact,
 * a radical is meaning-only already, a word is known when its reading AND its
 * meaning are, a grammar pattern when its meaning (and any production) is. The
 * "known" bar itself — every one of these solid or claimed — never changes; only
 * WHICH facts have to clear it does.
 *
 * A KANJI is the one exception, and it is not a Library invention: the whole
 * curriculum teaches, claims and displays a kanji by its MEANING (see
 * kanji-known.ts, "A kanji is KNOWN once its MEANING has been learned"; the
 * lesson claims only `meaningFactId`; the entry page's kanji chip is the meaning
 * fact's standing alone). Its readings open one word at a time, through
 * vocabulary, long after the character itself is familiar. So a kanji counts as
 * known on its meaning fact, which is exactly what the entry page already shows —
 * without this, 人 read "you know this" on its own page yet failed the shelf's
 * Known filter, because that filter demanded all eleven facts.
 */
export function knownFactsRule(entry: LibEntry): readonly FactId[] {
  if (entry.kind === KANJI_SUBJECT) return [meaningFactId(entry.glyph)];
  // A MERGED radical is learned on its kanji card, not a radical card, so its
  // own meaning fact is never taught — its knowledge lives on the identical
  // kanji glyph (radical:乙 has no lesson, kanji:乙 does). Read the kanji's
  // meaning fact so the shelf's Known filter matches what the learner actually
  // did, instead of stranding 116 radicals as forever-unknown. The 90
  // radical-only shapes and the 8 that keep a radical card fall through to their
  // own fact below. See isRadicalTaughtAsKanji in src/data/radicals.ts.
  if (entry.kind === RADICAL_SUBJECT) {
    const rad = radicalByGlyph(entry.glyph);
    if (rad && isRadicalTaughtAsKanji(rad.num)) return [meaningFactId(entry.glyph)];
  }
  // A pair mints a fact per side but SCHEDULES only the askable ones — the
  // unaskable side rides along solely as a distractor and is never quizzed, so
  // it can never be "known". Counting it would leave every pair permanently
  // not-known and hold the "I know this" button open forever. See
  // transitivity-facts.ts.
  if (entry.kind === TRANSITIVITY_SUBJECT) {
    return factsOf(entry.id).filter((f) => transitivitySide(f)?.askable);
  }
  // A sentence tier's completion lives on its TRACK-LOCAL marker
  // (sentenceTierMarkerFact) — deliberately not a registered quiz fact (see
  // its own doc comment), so it never shows up via the general factsOf(id)
  // lookup below. Read it directly, or the "I already know this"/completion
  // claim a learner made is invisible here and the tier sits permanently
  // "Not known" no matter what they do.
  if (entry.kind === SENTENCE_RULE_KIND) {
    const tierId = entry.id.replace(`${MARK_SUBJECT}:sentence-rule-`, "");
    return [sentenceTierMarkerFact(tierId)];
  }
  return factsOf(entry.id);
}

// ---------- the search aliases the build folds in ----------

/**
 * SAK-169 (extended by SAK-172): the reverse of COUNTER_VOCAB_DUPLICATE_KEBS
 * and COUNTER_TAIL_FORM_ALIASES together — which extra strings (一つ, 一人,
 * 二十歳, …) a given counting/construction entry duplicates, so buildEntries() below
 * can carry them as searchAlso aliases. Built once, off the two exported maps,
 * so this file and counters.ts cannot disagree about which string maps to
 * which entry (the same "one export, cannot drift" reasoning
 * COUNTER_VOCAB_DUPLICATE_KEBS's own doc comment gives). The two source maps
 * stay separate in counters.ts (see COUNTER_TAIL_FORM_ALIASES's own doc
 * comment for why), but they feed this ONE combined lookup, since buildEntries()'s
 * two consumers (the VOCAB walk and the COUNTER_CURRICULUM walk, below) both
 * just want "what aliases duplicate this entry" regardless of which source
 * map they came from. Defined ahead of LIB_ENTRIES/buildEntries() below, which reads
 * it while building.
 */
const COUNTER_KANJI_DUPLICATE_SEARCH: ReadonlyMap<EntryId, readonly string[]> = (() => {
  const byEntry = new Map<EntryId, string[]>();
  for (const [keb, target] of [...COUNTER_VOCAB_DUPLICATE_KEBS, ...COUNTER_TAIL_FORM_ALIASES]) {
    const kebs = byEntry.get(target) ?? [];
    kebs.push(keb);
    byEntry.set(target, kebs);
  }
  return byEntry;
})();

/**
 * SAK-175: the reverse of GRAMMAR_VOCAB_DUPLICATE_KEBS — which extra VOCAB
 * kebs (まで, だけ, しか, …) a given grammar pattern's entry duplicates, so
 * buildEntries() below can carry them as searchAlso aliases on that pattern's own
 * Library page. Same "one export, cannot drift" shape as
 * COUNTER_KANJI_DUPLICATE_SEARCH above.
 */
const GRAMMAR_KEB_DUPLICATE_SEARCH: ReadonlyMap<EntryId, readonly string[]> = (() => {
  const byEntry = new Map<EntryId, string[]>();
  for (const [keb, target] of GRAMMAR_VOCAB_DUPLICATE_KEBS) {
    const kebs = byEntry.get(target) ?? [];
    kebs.push(keb);
    byEntry.set(target, kebs);
  }
  return byEntry;
})();


export function buildEntries(): LibEntry[] {
  const out: LibEntry[] = [];

  for (const [c, info] of Object.entries(CHAR_INDEX)) {
    out.push({
      id: kanaEntry(c),
      kind: KANA_SUBJECT,
      glyph: c,
      readings: info.r,
      meanings: [],
      sub: `${info.setLabel} · ${info.secLabel}`,
      weight: 0,
      // A kana IS a sound — the one thing this whole shelf teaches.
      speakable: true,
    });
  }

  // Marks — the reading rules, right after the kana they are rules about.
  //
  // `meanings` HOLDS THE NAME, and `sub` holds the one-line rule. That looks
  // back-to-front for one beat and is the arrangement that makes every existing
  // renderer say the right thing without being told about marks: EntryRow prints
  // `meanings` as its main line and `sub` as the note under it, so the row reads
  // "Dakuten / Two dashes that voice the consonant"; the entry page's PageTitle
  // takes `meanings` and prints `sub` beneath, so the page is headed "Dakuten"
  // and sub-headed with the rule. A mark has no gloss competing for `meanings`,
  // so nothing is displaced — and search over meanings then finds a mark by its
  // name, which is what anyone would type.
  //
  // NO READINGS, deliberately and not for want of a plausible string. ゛ is
  // called "dakuten", but that is its NAME, not how it is read: nothing in
  // Japanese pronounces a bare ゛, and `readings` is exact-matched by search and
  // spoken by the tile's 🔊. A romaji-shaped name in that field would make ゛ a
  // hit for someone sounding out a kana and hand a synthesiser something to say.
  for (const m of MARKS) {
    out.push({
      id: markEntry(m.id),
      kind: m.shelf === "sentence" ? SENTENCE_RULE_KIND : MARK_SUBJECT,
      glyph: m.glyph,
      name: m.name,
      readings: [],
      meanings: [m.name],
      searchAlso: m.searchAlso,
      sub: m.summary,
      // Below kana (0) and below grammar (500+), so that when a query hits a
      // mark and something else, the mark leads. There are five of them and they
      // are the answer to a question about a rule; nothing is buried by putting
      // five entries near the front, and typing "dakuten" should not turn up a
      // word first.
      weight: 1,
      // A mark is writing notation, not a sound — see LibEntry.speakable and the
      // NO READINGS note above.
      speakable: false,
    });
  }

  // Terms — the reference definitions. Built exactly like a mark: no glyph (the
  // title IS the name, so `meanings` carries it and `sub` the one-line summary,
  // which is what EntryRow and PageTitle print), no readings (nothing here is a
  // sound to speak or to exact-match), and search finds a term by its name or an
  // alias. No facts, minted below by no one — a term is read, never asked.
  for (const t of TERMS) {
    out.push({
      id: termEntry(t.id),
      kind: TERM_SUBJECT,
      glyph: "",
      name: t.name,
      readings: [],
      meanings: [t.name],
      searchAlso: t.searchAlso,
      sub: t.summary,
      // Beside marks (1), for the same reason: a handful of reference entries
      // that answer "what is this word", worth leading with when a query hits
      // one, and never numerous enough to bury anything.
      weight: 1,
      // A term is an English name for a concept, not a Japanese sound — see
      // LibEntry.speakable.
      speakable: false,
    });
  }

  // Grammar concepts — the ideas behind the grammar patterns, built exactly like
  // a term: no glyph (the title IS the name, so `meanings` carries it and `sub`
  // the one-line summary, which is what EntryRow and PageTitle print), no
  // readings (nothing here is a sound), and search finds a concept by its name or
  // an alias. No facts, minted below by no one — a concept is read, never asked.
  for (const c of GRAMMAR_CONCEPTS) {
    out.push({
      id: grammarConceptEntry(c.id),
      kind: GRAMMAR_CONCEPT_SUBJECT,
      glyph: "",
      name: c.name,
      readings: [],
      meanings: [c.name],
      searchAlso: c.searchAlso,
      sub: c.summary,
      // Beside marks and terms (1): a reference entry worth leading with when a
      // query hits it, and never numerous enough to bury anything.
      weight: 1,
      // A grammar concept is an idea explained in English, not a sound — see
      // LibEntry.speakable.
      speakable: false,
    });
  }

  // Number construction pages — the "how numbers and counts are BUILT" reference,
  // built like a grammar concept (no readings — a rule is read, not spoken; its
  // glyph is the 十〜 / 百〜 / 〜本 plate, shown on the shelf row and the page
  // hero). No facts, minted by no one below: a construction page is read, and its
  // only action is the Quiz me button. Search finds it by its name, its summary,
  // or a searchAlso alias (the counter glyph, "hundreds", "man"…).
  for (const c of NUMBER_CONSTRUCTIONS) {
    const id = numberConstructionEntry(c.id);
    // SAK-169: 一人/二人's kanji VOCAB rows are skipped from the Words shelf
    // above and ride here instead — the 〜人 page ("nin") is where ひとり/ふたり
    // are actually taught (its Irregular table), so typing 一人 or 二人 should
    // find this page. See COUNTER_VOCAB_DUPLICATE_KEBS/COUNTER_KANJI_DUPLICATE_SEARCH.
    const kanjiDuplicates = COUNTER_KANJI_DUPLICATE_SEARCH.get(id);
    out.push({
      id,
      kind: NUMBER_CONSTRUCTION_KIND,
      glyph: c.glyph,
      name: c.name,
      readings: [],
      meanings: [c.name],
      searchAlso: kanjiDuplicates
        ? [...(c.searchAlso ?? []), ...kanjiDuplicates]
        : c.searchAlso,
      sub: c.summary,
      // Beside marks, terms and concepts (1): a reference entry worth leading
      // with when a query hits it, and never numerous enough to bury anything.
      weight: 1,
      // A construction page is a sound-shift RULE, read in prose, not a word —
      // its glyph is a tilde-prefixed plate (〜枚), not something to hand a
      // synthesiser. This is the confirmed SAK-79 bug: these pages shared
      // COUNTER_KIND's shelf and used to fall through `speakable()`'s kind
      // check unnoticed. See LibEntry.speakable.
      speakable: false,
    });
  }

  // Radicals — the shapes kanji are built around and filed under, right before
  // the kanji that gate on them. The glyph is the radical, `meanings` its one
  // sense (so search finds 氵 by "water" and the tile prints it), and `sub`
  // carries the Kangxi number and stroke count. No readings: a radical is a
  // shape and an idea, not a pronunciation.
  for (const r of RADICALS) {
    out.push({
      id: radicalEntry(r.glyph),
      kind: RADICAL_SUBJECT,
      glyph: r.glyph,
      readings: [],
      meanings: [r.meaning],
      sub: `Radical ${r.num} · ${r.strokes} stroke${r.strokes === 1 ? "" : "s"}`,
      // Below kanji and words: someone searching "water" wants 水 the kanji or
      // the word before 氵 the radical, so radicals sort after both on a shared
      // meaning. The Kangxi number keeps them in canonical order among themselves.
      weight: 2000 + r.num,
      // A radical is a shape and an idea, not a pronunciation (see the "no
      // reading fact" note atop src/data/radicals.ts and the null `speak` its
      // own meaning-fact row carries below) — found wrongly speakable during
      // the SAK-79 audit and fixed alongside it. See LibEntry.speakable.
      speakable: false,
    });
  }

  for (const k of KANJI) {
    out.push({
      id: kanjiEntry(k.c),
      kind: KANJI_SUBJECT,
      glyph: k.c,
      readings: readingBasesOf(k.c),
      meanings: k.meanings,
      // Stroke count only. The jōyō grade and the name of the dictionary the
      // row came from were both here and both removed: a grade is a fact about
      // the Japanese school system, not about the character, and a data-source
      // name means nothing to a beginner. Attribution is not lost — the entry
      // page foot credits every source.
      sub: `${k.strokes} stroke${k.strokes === 1 ? "" : "s"}`,
      weight: 1000 + (k.newspaperFreq ?? 3000),
      // FALSE, even though a kanji is a real character with a real reading (or
      // several) — unlike a kana or a word, a bare kanji glyph has NO single
      // pronunciation of its own; on'yomi vs. kun'yomi and which one applies is
      // entirely context-dependent (人 alone could be じん, にん, or ひと). A 🔊
      // next to the tile implies the glyph itself has a canonical sound, which
      // is exactly the wrong thing to teach. The readings live in the entry
      // page's own "As a kanji" section, each with its own speaker on the
      // specific reading, not the glyph. See LibEntry.speakable.
      speakable: false,
    });
  }

  for (const w of VOCAB) {
    // SAK-147: a kanji-written counter glyph (day-of-month, month-of-year,
    // 二十歳 — COUNTER_KANJI_GLYPHS, see its doc comment in src/data/counters.ts)
    // is NOT a plain word here. Day/month's 43 glyphs browse via the single
    // 〜日/〜月 NUMBER_CONSTRUCTION_KIND row every generative counter gets (SAK-
    // 163 round 4 made them generative categories, so they are reference data
    // now, not individual COUNTER_CURRICULUM forms). 二十歳 no longer gets its
    // own COUNTER_KIND row either (SAK-172): its CounterForm is skipped in the
    // COUNTER_CURRICULUM walk a few dozen lines down (COUNTER_TAIL_FORM_ALIASES)
    // and it instead browses via the 〜歳 NUMBER_CONSTRUCTION_KIND row, whose
    // Irregular table now shows はたち as a real row. Either way, skipping the
    // glyph here does not drop it from the Library, only from the Words shelf
    // it does not belong on. This is the same exclusion word-lesson.ts applies
    // to the teaching spine (CURRICULUM_WORDS); both read the one set so
    // neither can drift ahead of the other the way this bug started.
    if (COUNTER_KANJI_GLYPHS.has(w.keb)) continue;
    // SAK-169: 一人/二人 and the native 〜つ counting words (一つ…九つ) are
    // kanji-written VOCAB duplicates of a fact the counters track already
    // teaches, but COUNTER_KANJI_GLYPHS' glyph-equality check cannot catch
    // them — see COUNTER_VOCAB_DUPLICATE_KEBS's doc comment in
    // src/data/counters.ts for why. Skipping here does not drop them from the
    // Library: each keb rides as a searchAlso alias on the counting/
    // construction entry it duplicates (COUNTER_KANJI_DUPLICATE_SEARCH,
    // below), so "一つ" still finds ひとつ's page and "一人" still finds the
    // 〜人 construction page whose Irregular table already shows it.
    if (COUNTER_VOCAB_DUPLICATE_KEBS.has(w.keb)) continue;
    // SAK-175: a kana-only, multi-character VOCAB keb that is an EXACT
    // duplicate of a grammar recipe's own pattern (まで, だけ, しか, …) is not
    // a plain word here either — see GRAMMAR_VOCAB_DUPLICATE_KEBS's doc
    // comment in src/data/grammar/index.ts for how each one was confirmed.
    // Skipping here does not drop it from the Library: it rides as a
    // searchAlso alias on the pattern's own entry (GRAMMAR_KEB_DUPLICATE_
    // SEARCH, below), so "だけ" still finds 〜だけ's page.
    if (GRAMMAR_VOCAB_DUPLICATE_KEBS.has(w.keb)) continue;
    out.push({
      id: wordEntry(w.keb),
      kind: VOCAB_SUBJECT,
      glyph: w.keb,
      readings: [w.reb],
      meanings: w.glosses,
      // No source name here either. See the kanji sub-line above. No sub-label:
      // "everyday word" is not a fact worth a line under every one of 12,553.
      sub: "",
      weight: 10_000 + (w.newspaperBand ?? 60),
      // A word is one glyph with one reading (w.reb) — the clearest speakable
      // case there is. See LibEntry.speakable.
      speakable: true,
    });
  }

  // Grammar patterns are entries too — the pattern is the glyph, the gloss is
  // the meaning, and there is NO reading because a pattern has no single
  // pronunciation (see the tile, which omits 🔊 for these). They sort last in
  // browse order, after every word.
  RECIPES.forEach((r, i) => {
    if (!isPrimaryPatternRecipe(r)) return;
    const id = patternEntry(r.id);
    const senses = patternGroup(r.id);
    const clusterTitles = [
      ...new Set(
        senses.flatMap((sense) => {
          const title = sense.cluster ? cluster(sense.cluster)?.title : undefined;
          return title ? [title] : [];
        }),
      ),
    ];
    // The particle-pair clusters (は vs が, に vs で) are COMPARISONS, not family
    // concepts: the title just names the two glyphs being contrasted, so it is
    // redundant as the sub-line under a member whose own glyph is the lead
    // (は · "marks the topic" needs no "は vs が" beneath it). It stays in
    // searchAlso — findable — but drops out of the shown `sub`. Concept clusters
    // ("must", "after") keep theirs as a genuine family cue.
    const subTitles = [
      ...new Set(
        senses.flatMap((sense) => {
          if (!sense.cluster || COMPARISON_CLUSTER_IDS.has(sense.cluster)) return [];
          const title = cluster(sense.cluster)?.title;
          return title ? [title] : [];
        }),
      ),
    ];
    out.push({
      id,
      kind: GRAMMAR_SUBJECT,
      // The entry's first fact is the display item the detail route builds. Its
      // glyph carries two disambiguating parentheticals that patternLabel omits;
      // keeping that exact value here makes the index authoritative everywhere.
      glyph:
        factInfo(factsOf(id)[0])?.glyph ??
        (senses.length > 1 ? r.pattern : patternLabel(r)),
      readings: [],
      meanings: senses.map((sense) => sense.gloss),
      searchAlso: [
        ...senses.flatMap((sense) => (sense.sense ? [sense.sense] : [])),
        ...clusterTitles,
        // SAK-175: the bare VOCAB kebs this pattern's page now stands in for
        // (だけ, しか, まで, …) — see GRAMMAR_VOCAB_DUPLICATE_KEBS's doc comment.
        ...(GRAMMAR_KEB_DUPLICATE_SEARCH.get(id) ?? []),
      ],
      // JLPT level is internal curriculum metadata, not a useful explanation
      // of what the row is. Keep a meaningful family cue ("after", "must",
      // and so on) where one exists; otherwise the sub-line is simply absent.
      sub: subTitles.join(" · "),
      // A pattern has no single pronunciation (〜てから is a shape, not a
      // sound) — see LibEntry.speakable.
      speakable: false,
      // A LOW weight, below kanji — the one kind that outranks it. This is the
      // owner's "make sure search surfaces grammar properly" as a number: when
      // you type "must", the seven obligation PATTERNS are the answer, and a
      // word like 糾合 ("muster") that merely starts with your letters is not.
      // A high weight would bury the patterns under every incidental match; a
      // low one puts them where "how do I say must" is answered. Only meaning
      // searches pit grammar against other kinds — a pattern's glyph (〜てから)
      // rarely collides with a word or a kanji — so leading there costs the
      // other kinds nothing they were winning.
      weight: 500 + i,
    });
  });

  // Verb pairs — the transitivity subject, taught after grammar (see KINDS), so
  // they browse after it. A pair is TWO verbs and one event; its first fact's
  // glyph is the shared written stem the detail route uses as its hero. `name`
  // still carries the full pair — "出る / 出す" — and both written forms ride in
  // `searchAlso`, so every representation remains findable. CURRICULUM_PAIRS,
  // not the raw VERB_PAIRS: a pair whose verb the app can never teach (産む,
  // 濡れる/濡らす today) gets no entry here either, so search/detail agrees with
  // the shelf (shelves.tsx) and the schedule (verb-pair-unit.ts) about what
  // "the app teaches" means, instead of a third, silently different answer.
  CURRICULUM_PAIRS.forEach((p, i) => {
    const id = pairEntry(p);
    const pattern = pairPattern(p.happens.reading, p.doIt.reading);
    const tailLabel = pattern.isException ? "Exception" : shiftLabel(pattern);
    const tailFrom = pattern.from?.replace(/^-/, "");
    const tailTo = pattern.to?.replace(/^-/, "");
    const tailSearch = pattern.isException
      ? ["exception", "verb pair"]
      : [tailLabel, `${tailFrom} ${tailTo}`, `${tailFrom}${tailTo}`];
    out.push({
      id,
      kind: TRANSITIVITY_SUBJECT,
      glyph: factInfo(factsOf(id)[0])?.glyph ?? p.happens.word,
      name: `${p.happens.word} / ${p.doIt.word}`,
      readings: [p.happens.reading, p.doIt.reading],
      meanings: [p.happens.en, p.doIt.en],
      searchAlso: [p.happens.word, p.doIt.word, ...tailSearch],
      // The tail-shift name is the one line worth carrying — "the -ある/-える swap
      // again" is a real memory aid (see transitivity-pattern.ts). A pair that
      // fits no rule says "Verb pair" rather than "Exception", which would read
      // as a warning on a shelf where the shift name is a help, not a grade.
      sub: tailLabel,
      // Their own band, below kanji (1000+) and above grammar (500+): a pair
      // rarely collides with another kind on a query, because its meanings are
      // whole English sentences, so this only breaks ties among pairs — in data
      // order, which is the order the table was curated in.
      weight: 700 + i,
      // A pair NAMES TWO WORDS, not one — its `glyph` is a representative hero
      // form (see above), not the whole entry's sound. That is exactly why
      // VerbPairRow renders two independent per-verb HearButtons instead of one
      // entry-level speaker. Found wrongly speakable during the SAK-79 audit —
      // a generic search-result row (EntryRow, not VerbPairRow) rendered a
      // single speaker that only ever said HALF the pair — and fixed alongside
      // it, matching KEIGO_SUBJECT's identical call below. See
      // LibEntry.speakable.
      speakable: false,
    });
  });

  // Counting — the track's words, given browse pages of their own.
  //
  // These are `word` facts (COUNTERS_SUBJECT), so they are indistinguishable
  // from vocabulary in the registry and the drill — but here they carry
  // COUNTER_KIND so they shelve as "Counting" rather than vanishing
  // into 12,553 everyday words. The whole point of the page is to VIEW the
  // counted form beside its reading (一本 · いっぽん), which is exactly what a
  // counter's factRows below print.
  //
  // A KANA FORM CARRIES NO READING and a COUNTED FORM CARRIES ONE. A kana form's
  // reading IS its glyph (ひとつ), so listing it under the glyph would print
  // ひとつ twice; its `readings` is empty and the tile falls back to the meaning
  // ("one thing"). A counted form (一本) shows its reading (いっぽん), the sound
  // the shelf exists to teach — findable in search and printed under the glyph.
  COUNTER_CURRICULUM.forEach((f, i) => {
    // SAK-172: 二十歳 (TAIL's one memorised form) no longer mints its own
    // standalone Library page — はたち is now a real Irregular row on 〜歳's
    // construction page instead (number-construction.ts's `sai` CounterSpec),
    // the same treatment day-of-month's page gives 20日's suppletive はつか.
    // Its CounterForm/facts stay exactly as they were (teaching and quizzing
    // read COUNTER_CURRICULUM directly — see TAIL's own doc comment in
    // counters.ts); only this Library entry is skipped, and "二十歳" rides as
    // a searchAlso alias on the 〜歳 entry instead (COUNTER_TAIL_FORM_ALIASES,
    // folded into COUNTER_KANJI_DUPLICATE_SEARCH above), so search/navigation
    // still lands somewhere real.
    if (COUNTER_TAIL_FORM_ALIASES.has(f.glyph)) return;
    const kana = isKanaCounterForm(f);
    const id = counterEntry(f);
    // SAK-169: 一つ…九つ's kanji VOCAB spelling is skipped from the Words shelf
    // above and rides here instead, so typing the kanji still finds this exact
    // kana entry. See COUNTER_VOCAB_DUPLICATE_KEBS/COUNTER_KANJI_DUPLICATE_SEARCH.
    const kanjiDuplicates = COUNTER_KANJI_DUPLICATE_SEARCH.get(id);
    out.push({
      id,
      kind: COUNTER_KIND,
      glyph: f.glyph,
      readings: kana ? [] : [f.reading],
      meanings: [f.meaning],
      // What it is, in one word, for the search-row note. A bare number says so;
      // everything else is a counter (the specific counter is the shelf section).
      sub: f.counter === "" ? "Number" : "Counter",
      ...(kanjiDuplicates ? { searchAlso: kanjiDuplicates } : {}),
      // Below everyday words (10,000+): a bare number like に collides on glyph
      // with the particle に, and the word should lead — a counter is the
      // specialist answer, surfaced but not ahead of the vocabulary. Curriculum
      // order breaks ties among counters.
      weight: 9_000 + i,
      // A REAL counted word, unlike its NUMBER_CONSTRUCTION_KIND shelf-mate
      // above: a kana form's glyph IS its reading (ひとつ) and a counted form
      // carries its own (一本 · いっぽん) — both are one genuine pronunciation.
      // See LibEntry.speakable.
      speakable: true,
    });
  });

  // Keigo sets — the politeness track, browsed after verb pairs (see KINDS). A
  // set is a plain verb and its honorific/humble forms. Its first fact's glyph is
  // the exact form the detail route uses as its hero; `name` still carries the
  // complete set — "召し上がる / いただく". The recognition glosses are the
  // `meanings`, and the plain verbs/register words ride in `searchAlso`.
  // CURRICULUM_KEIGO_SETS, not the raw KEIGO_SETS: a set whose plain verb the
  // app can never teach gets no entry here either, matching the shelf
  // (keigo-shelf.ts) and the schedule (keigo-unit.ts).
  CURRICULUM_KEIGO_SETS.forEach((set, i) => {
    const id = keigoSetEntry(set);
    out.push({
      id,
      kind: KEIGO_SUBJECT,
      glyph: factInfo(factsOf(id)[0])?.glyph ?? set.words[0]?.word ?? "",
      name: set.words.map((w) => w.word).join(" / "),
      readings: set.words.map((w) => w.reading),
      meanings: set.words.map((w) => recognitionGloss(set, w)),
      searchAlso: [
        ...set.plain.map((p) => p.keb),
        ...set.words.map((w) => w.register),
        "keigo",
        set.meaning,
      ],
      sub: `Keigo · ${set.meaning}`,
      weight: 800 + i,
      // A set NAMES MULTIPLE WORDS (honorific and humble forms), not one — same
      // reasoning as the verb-pair case above, and the reason KeigoSetRow gives
      // each word its own HearButton instead of one entry-level speaker. See
      // LibEntry.speakable.
      speakable: false,
    });
  });

  // Kanji parts: shapes that appear in the KanjiVG decomposition but are neither
  // a jōyō kanji, a Kangxi radical, nor a variant form of either. 278 shapes.
  // CDP-coded glyphs (non-Unicode characters referenced by database code) are
  // excluded since they cannot render as characters.
  for (const [glyph] of PRIMITIVE_STROKES) {
    if (glyph.startsWith("CDP-")) continue;
    if (kanjiRow(glyph)) continue;
    if (variantTaughtKanji(glyph)) continue;
    if (radicalByWrittenForm(glyph)) continue;
    const strokes = primitiveStrokes(glyph) ?? 0;
    out.push({
      id: primitiveEntry(glyph),
      kind: PRIMITIVE_SUBJECT,
      glyph,
      readings: [],
      meanings: [],
      sub: strokes === 1 ? "1 stroke" : `${strokes} strokes`,
      weight: 900 + strokes,
      // A primitive is a shape, not a character — no meaning and no reading
      // are tracked for it anywhere in the app (see the empty `meanings` above
      // and `factsTitle`'s "it is a shape, not a character"). Found wrongly
      // speakable during the SAK-79 audit and fixed alongside it. See
      // LibEntry.speakable.
      speakable: false,
    });
  }

  return out;
}
