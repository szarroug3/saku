"use client";

// One entry, opened up.
//
// This page is the entry/fact split with a face on it. 生 is ONE glyph, ONE
// meaning and EIGHT readings, each keyed on (kanji, word) and each anchored to
// the everyday word that proves it — and this page is the only place in the app
// where you can see that, which makes it the only place the model can be checked
// against reality by the person using it. If this page is ever wrong, the model
// is wrong.
//
// THERE ARE NO PER-ROW DRILL BUTTONS. The rule the design settles: if a screen
// shows you the answer, it doesn't get to ask the question. This page prints
// セイ; a one-card drill of セイ thirty seconds later proves nothing, and the
// app's own arithmetic agrees (review() at p ≈ 1 multiplies by 1.0). The bar at
// the bottom builds a normal session these facts are only part of.
//
// FOUR LAYOUTS, ONE HEADER, ONE LINKS ORDER
// =========================================
// Kana, kanji, words and grammar each get the arrangement their material wants
// — a kana's story beside its strokes, a kanji's readings full width, a word
// taken apart into pieces, a pattern's formula beside its links. What does NOT
// vary is where you look for things: the header is the same shape on all four
// (glyph left, sense middle, standing right, sound beneath), and the Links card
// always runs "you've mixed up with", then "commonly mixed up with", then
// everything else. See entry-links.tsx for why those two lines are different
// questions and must never be one.
//
// GRAMMAR IS THE FOURTH KIND, NOT A FIFTH DESIGN
// ==============================================
// The one thing a pattern has that nothing else does is a RECIPE, and it takes
// the wide half of the paired row exactly where a kanji puts its strokes. The
// family table below it is the same table the kanji readings use. Everything
// else — the header, the chips, the Links order, the attribution — is what the
// other three already do.
//
// THERE IS NO JLPT LEVEL ON THIS PAGE, anywhere, and that is the same decision
// as the missing newspaper-frequency rank on the kanji page. The level orders
// the curriculum internally; a learner cannot act on "N4" and it is not a fact
// about the pattern, it is a fact about an exam three vendors disagree about by
// 3.4x (see the header of data/grammar/recipes.ts). The muted line under the
// gloss says what the pattern ATTACHES TO instead, which is the thing you need
// and cannot get anywhere else.

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useMemo, useState } from "react";

import { AttributionLink } from "@/components/library/attribution-link";
import { ComponentUses } from "@/components/library/component-uses";
import { EntryHeader } from "@/components/library/entry-header";
import { EntryLinks, GlyphLink, LinkRow } from "@/components/library/entry-links";
import { KanjiBuiltFrom } from "@/components/library/kanji-built-from";
import { KanaFamilyView } from "@/components/library/kana-family-view";
import { KanjiReadings } from "@/components/library/kanji-readings";
import { MarkView } from "@/components/library/mark-view";
import { GrammarConceptView } from "@/components/library/grammar-concept-view";
import { TermView } from "@/components/library/term-view";
import { PatternFamily } from "@/components/library/pattern-family";
import { PatternTeach } from "@/components/library/pattern-teach";
import { SliceBar } from "@/components/library/slice-bar";
import { VerbPairView } from "@/components/library/verb-pair-view";
import { KeigoSetView } from "@/components/library/keigo-set-view";
import { StandingChip } from "@/components/library/standing-chip";
import { TermLink } from "@/components/library/term-link";
import { WordBuiltFrom } from "@/components/library/word-built-from";
import { WordExampleView } from "@/components/library/word-example-view";
import { WordsWith } from "@/components/library/words-with";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { Callout } from "@/components/lesson/callout";
import { MnemonicView } from "@/components/lesson/mnemonic-view";
import { WordFormFan } from "@/components/lesson/word-form-fan";
import { WordClassNote } from "@/components/lesson/word-class-note";
import { WordSensePanel } from "@/components/lesson/word-sense-panel";
import { Card, Hint, Lbl, SoundIcon } from "@/components/ui";
import { KANA_SUBJECT, glyphVariantFor } from "@/data/characters";
import {
  SENTENCE_ORDERING_TIERS,
  tierAssemblyFacts,
} from "@/data/assembly";
import { contextPronunciation } from "@/data/kana-context";
import { KanaContextView } from "@/components/lesson/kana-context-view";
import {
  GRAMMAR_SUBJECT,
  conjugatesVerb,
  formEntryFor,
  hostsAdjective,
  patternEntry,
  patternMeaningFactId,
  verbAttachForm,
} from "@/data/grammar";
import {
  GRAMMAR_CONCEPT_SUBJECT,
  grammarConceptEntry,
  grammarConceptFor,
  grammarConceptRow,
} from "@/data/grammar-concepts";
import { cluster as clusterById, membersOf } from "@/data/grammar/clusters";
import { KANJI_SUBJECT, kanjiRow, meaningFactId } from "@/data/kanji";
import { markFor } from "@/data/marks";
import { termFor } from "@/data/terms";
import { RADICAL_SUBJECT, radicalByGlyph } from "@/data/radicals";
import { exampleFor } from "@/data/word-examples";
import { getMnemonic } from "@/data/mnemonics";
import { TRANSITIVITY_SUBJECT, pairForEntry } from "@/data/transitivity-facts";
import { KEIGO_SUBJECT, keigoSetForEntry } from "@/data/keigo";
import {
  VOCAB_SUBJECT,
  readingUnits,
  vocabRow,
  wordMeaningFactId,
  wordReadingFactId,
} from "@/data/vocab";
import { wordPitch } from "@/data/pitch";
import { factsOf } from "@/lib/facts";
import {
  appearsIn,
  COUNTER_KIND,
  entryForGlyph,
  entryName,
  factRows,
  factsColumnHeader,
  factsTitle,
  KIND_LABEL,
  knownFactsOf,
  libEntry,
  readingRowsOf,
  recipeOf,
  recipesOf,
  type LibEntry,
} from "@/lib/library/entries";
import { characterRole } from "@/lib/character-role";
import { attachesTo, FORM_LABEL } from "@/lib/grammar/formula";
import { entryFromParam, entryFromSlug, entryHref } from "@/lib/library/href";
import { kanaFamily } from "@/lib/library/kana-family";
import { mixupsOf } from "@/lib/library/mixups";
import { piecesOf } from "@/lib/library/word-pieces";
import { entryStanding, standingOf } from "@/lib/library/standing";
import { useLiveFacts } from "@/lib/library/use-live-facts";
import { speak } from "@/lib/speech";
import { postClaim } from "@/lib/progress-fetch";
import { sentenceTierMarkerFact } from "@/lib/sentence-ordering-progress";
import { useHistory } from "@/lib/use-history";
import { useLists } from "@/lib/use-lists";
import { useQuizConfig } from "@/lib/quiz-config";
import {
  formsOfWord,
  isIntransitive,
  INTRANSITIVE_NOTE,
  wordFormKind,
} from "@/lib/word-forms";
import { readingAnchors } from "@/lib/word-unlock";
import type { FactId } from "@/types";

/**
 * ONE CATCH-ALL ROUTE FOR TWO URL SHAPES, and it is a catch-all for a reason
 * that is not "it was easier".
 *
 * An entry has a readable two-segment URL — `/library/kanji/生` — and every link
 * made before that existed says `/library/kanji%3A%E7%94%9F`, one segment, the
 * opaque id. Both have to keep working: the second is what bookmarks and any
 * stored link contain, and a URL is a promise.
 *
 * TWO SIBLING ROUTES CANNOT DO THIS. `[entry]` and `[kind]/[slug]` are two
 * different names for the same first segment, and Next refuses the app at boot:
 * "You cannot use different slug names for the same dynamic path". It is a
 * startup crash, not a bad render, so nothing that stops at `tsc` and a test run
 * ever sees it. `[...entry]` is one name for the position and reads the shape
 * off the length.
 *
 * NEITHER BRANCH VALIDATES ANYTHING, because both end at a Map lookup that
 * answers undefined for a stranger. A URL outlives the data it names: re-cut the
 * dictionaries and yesterday's link points at nothing. 404 rather than an empty
 * page — this is genuinely not a thing, and the router already knows how to say
 * that.
 */
export default function EntryPage({
  params,
}: {
  params: Promise<{ entry: string[] }>;
}) {
  const { entry: path } = use(params);
  const id =
    path.length === 2 ? entryFromSlug(path[0], path[1]) : entryFromParam(path[0] ?? "");
  const entry = id ? libEntry(id) : undefined;
  if (!entry) notFound();
  return <EntryView entry={entry} />;
}

function EntryView({ entry }: { entry: LibEntry }) {
  const { history, loaded: historyLoaded, refresh } = useHistory();
  const { cfg } = useQuizConfig();
  const { lists } = useLists();
  const [now] = useState(() => Date.now());

  const claims = history.claims ?? {};
  // Committed aggregate + the in-progress run, folded at read time: a reading
  // missed mid-drill reads shaky on this page NOW, not on End session. Same
  // reference as history.facts when nothing is in progress. `facts` below is the
  // entry's FactId LIST, a different thing — this is the aggregate MAP every
  // standing read on this page uses in place of history.facts.
  const liveFacts = useLiveFacts(history.facts, now);
  const facts = factsOf(entry.id);
  const isTransitivity = entry.kind === TRANSITIVITY_SUBJECT;
  const isKeigo = entry.kind === KEIGO_SUBJECT;
  const isCounter = entry.kind === COUNTER_KIND;
  const standingFacts = isTransitivity ? knownFactsOf(entry) : facts;
  const standing = entryStanding(standingFacts, liveFacts, claims, cfg.accuracyMetric, now);
  const words = appearsIn(entry);
  const mine = lists.filter((l) => l.kind === "fixed" && l.entries.includes(entry.id));
  const mark = markFor(entry.id);
  const sentenceRuleTier =
    mark?.shelf === "sentence"
      ? SENTENCE_ORDERING_TIERS.find(
          (tier) => tier.id === mark.id.replace("sentence-rule-", ""),
        )
      : undefined;
  const sentenceRuleClaimFacts = sentenceRuleTier
    ? [
        ...tierAssemblyFacts(sentenceRuleTier, history),
        sentenceTierMarkerFact(sentenceRuleTier.id),
      ]
    : undefined;
  const term = termFor(entry.id);
  // The grammar-concept reference behind this entry's id, if it names one (the
  // て-form). Its content renders in place of the recipe card, like a
  // mark or a term.
  const concept = grammarConceptFor(entry.id);
  const mnemonic = getMnemonic(entry.glyph);

  // The two confusion lines. Both come out of here, and the history one is built
  // from history ALONE rather than by filtering the shape list — see mixups.ts,
  // which is entirely about why that distinction is load-bearing.
  const mixups = mixupsOf(entry, facts, history);

  const say = (text: string) => speak(text, cfg.voiceName);

  const claim = async (ids: FactId[]) => {
    // postClaim routes a signed-out claim (401) into this browser's local
    // history; refresh() then re-reads whichever store answered.
    await postClaim(ids, true);
    await refresh();
  };

  const isKana = entry.kind === KANA_SUBJECT;
  const isKanji = entry.kind === KANJI_SUBJECT;
  const isWord = entry.kind === VOCAB_SUBJECT;
  // The print vs handwriting aside — き's connected loop vs its detached lower
  // stroke — read from the same source the lesson reads, so a learner looking a
  // kana up sees the identical sentence they met while learning it. Absent for
  // the majority whose forms match.
  const glyphVariant = isKana ? glyphVariantFor(entry.glyph) : null;
  // The following-sound rules for ん and っ — the same source, and the same
  // component, the lesson renders, so a kana looked up here reads what it was
  // taught. Null for every kana that sounds the same wherever it sits.
  const contextRules = isKana ? contextPronunciation(entry.glyph) : null;
  const isRadical = entry.kind === RADICAL_SUBJECT;
  // A verb pair is neither a glyph nor a single fact — its own layout, shared
  // with the teach walk (VerbPairView), draws it. `pair` is the two verbs and
  // the one event behind this entry's id; null only if the id names no pair the
  // build knows, which the branches below treat as "render nothing".
  const pair = isTransitivity ? pairForEntry(entry.id) : null;
  // A keigo set is neither a glyph nor a single fact either — its own layout,
  // shared with the teach walk (KeigoSetView), draws it. Null only if the id
  // names no set the build knows.
  const keigoSet = isKeigo ? keigoSetForEntry(entry.id) : null;

  // ---- grammar-only material ----

  // The recipe, not just its id. Everything a pattern page shows that no other
  // page shows — the formula, the hosts, which production facts exist — hangs
  // off this one object, and a null here is simply "not a grammar entry".
  // Memoized on the entry so the recipe is a stable, compiler-tracked reference:
  // familyCluster below keys its memo on this, and the compiler can only preserve
  // that if the value it depends on is one it tracks rather than a bare call.
  const pattern = useMemo(() => recipeOf(entry), [entry]);
  const patterns = useMemo(() => recipesOf(entry), [entry]);
  const isGrammar = pattern !== null;
  // WHICH HOSTS ARE SCORED IS NOT DECIDED HERE ANY MORE. It used to be, to
  // build a chip per production host in the header. Those scores are now a
  // column in PatternRecipe, which already lays out one row per host, so the
  // join between "hosts with a fact" and "hosts with a formula" happens once,
  // in the one component that has both.
  /** The pattern's family, or null. Null covers all three of: not grammar, a
   * pattern in no cluster (52 of the 81), and a cluster with no recipe members
   * at all (は/が, に/で, transitivity — map-only, and a pattern cannot be in one
   * of those since they name no members). */
  // clusterById is a Map lookup, so the cluster it returns is a stable reference
  // the memo below can track. Keying on the bare lookup result instead left the
  // compiler unable to prove the value held still, so it declined to preserve
  // familyMembers' memoization.
  const familyCluster = useMemo(
    () => (pattern?.cluster ? (clusterById(pattern.cluster) ?? null) : null),
    [pattern],
  );
  const familyMembers = useMemo(
    () => (familyCluster ? membersOf(familyCluster) : []),
    [familyCluster],
  );

  // ---- the header's three variable parts, decided per kind ----

  const meaningStanding = isKanji
    ? standingOf(
        liveFacts[meaningFactId(entry.glyph)],
        claims[meaningFactId(entry.glyph)],
        cfg.accuracyMetric,
        now,
      ).standing
    : null;

  // THE ROLE TAG — every role the character plays, radical and/or kanji and/or
  // word — shown at the top of its page so the reader knows whether to expect it
  // only as a building block, inside words as a kanji, or already as a word they
  // can say. The same label the combined lesson card prints
  // (src/lib/character-role.ts), read off the glyph. It stands in for the strokes
  // line the header used to show alone: "radical · kanji · word · 3 strokes" for
  // 山, "kanji · word · 7 strokes" for 何, "kanji · 3 strokes" for 乞 (a kanji you
  // only meet inside words), "radical · 6 strokes" for 气 — the Kangxi NUMBER a
  // radical page used to carry ("Radical 84") is dropped, being catalogue trivia
  // rather than the role. Only kanji and radical entries have a role; every other
  // kind keeps its own sub line.
  const role = isKanji || isRadical ? characterRole(entry.glyph) : null;
  const roleStrokes = isKanji
    ? kanjiRow(entry.glyph)?.strokes
    : isRadical
      ? radicalByGlyph(entry.glyph)?.strokes
      : undefined;
  const roleSub =
    role && roleStrokes != null
      ? `${role} · ${roleStrokes} stroke${roleStrokes === 1 ? "" : "s"}`
      : null;

  // A keigo set's header wears WORD FORMAT: the plain verb(s) it replaces stand
  // as the hero glyph (食べる / 飲む — 知る — 行く / 来る / いる), and the shared
  // meaning sits to their right as the title, the same glyph-left/meaning-right
  // shape a word entry uses. A SET PHRASE with no plain verb (いらっしゃいませ)
  // shows the phrase itself as the hero instead. Empty for every non-keigo entry,
  // where the header keeps `entry.glyph`.
  const keigoGlyph = keigoSet
    ? keigoSet.plain.length
      ? keigoSet.plain.map((p) => p.keb).join(" / ")
      : (keigoSet.words[0]?.word ?? "")
    : "";

  // vocabRow is a single Map lookup, so the reference it returns is already
  // stable across renders, but the compiler cannot prove that of a bare call.
  // Memoizing on the glyph (a primitive) makes wordRow a value the compiler can
  // track, so the pieces/forms memos below may key on it without the compiler
  // giving up on preserving their memoization.
  const wordRow = useMemo(
    () => (isWord ? vocabRow(entry.glyph) : undefined),
    [isWord, entry.glyph],
  );
  // null for four words in five, and the word branch renders nothing at all in
  // that case. A single Map lookup: the choosing happened at build time, in
  // scripts/build-word-examples.ts.
  const example = isWord ? exampleFor(entry.glyph) : null;

  const chips = (
    <>
      {/* KANJI: the meaning's own chip, then COUNTS. An entry with many facts
          gets no adjective — standing.ts refuses to average nine readings into
          one word, and "N need work" is a count over a real population, which
          says something an average cannot. "need work" is an AGGREGATE phrase
          for this header only; it is never a per-fact chip, because it is not
          one of the standings. */}
      {meaningStanding ? (
        <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
          Meaning <StandingChip standing={meaningStanding} />
        </span>
      ) : null}
      {isKanji && standing.total > 1 ? (
        <>
          {/* THE TWO COUNTS MUST NOT OVERLAP. `entryStanding.needWork` counts
              every fact that is not solid and not claimed — which INCLUDES the
              ones you have never been asked. Printed raw beside "not seen", a
              freshly-met 生 read "9 need work · 9 not seen": the same nine facts,
              counted twice, in two chips that look like two populations.
              Subtracting the unseen leaves the count that means what the chip
              says — facts you HAVE been asked and are not on top of — and it
              correctly disappears on a character you have never studied, where
              "9 not seen" is the whole story. */}
          {standing.needWork - (standing.total - standing.seen) > 0 ? (
            <span className="rounded-full border border-warning px-2 py-0.5 text-[11px] text-warning">
              {standing.needWork - (standing.total - standing.seen)} need work
            </span>
          ) : null}
          {standing.total - standing.seen > 0 ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
              {standing.total - standing.seen} not seen
            </span>
          ) : null}
        </>
      ) : null}
      {(isTransitivity || isKeigo) && standing.total > 1 ? (
        <>
          {standing.needWork - (standing.total - standing.seen) > 0 ? (
            <span className="rounded-full border border-warning px-2 py-0.5 text-[11px] text-warning">
              {standing.needWork - (standing.total - standing.seen)} need work
            </span>
          ) : null}
          {standing.total - standing.seen > 0 ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
              {standing.total - standing.seen} not seen
            </span>
          ) : null}
        </>
      ) : null}

      {/* WORD: a row of chips, one per thing the app actually asks. A kana word
          has no reading fact (これ's reading is これ — not a question), so that
          chip is simply absent rather than showing a score for a fact that does
          not exist.

          A MULTI-READING word (日 = ひ day, か day-counter) summarizes like the
          kanji header instead: one Meaning chip on the primary unit, then the
          COUNTS. The same refusal standing.ts makes for a kanji's readings holds
          here. Averaging several separately-scored readings into one adjective
          says less than "N need work", which is a count over a real population.
          A per-unit Reading/Meaning chip apiece would also rebuild the header
          row so wide the title has nowhere to go. The sense table below still
          lists every unit's own standing. */}
      {isWord && wordRow && readingUnits(wordRow).length > 1 ? (
        <>
          {/* PRIMARY meaning, computed exactly like the single-unit Meaning chip
              below (the primary unit mints the unqualified meaning fact id). */}
          <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
            Meaning{" "}
            <StandingChip
              standing={
                standingOf(
                  liveFacts[wordMeaningFactId(entry.glyph)],
                  claims[wordMeaningFactId(entry.glyph)],
                  cfg.accuracyMetric,
                  now,
                ).standing
              }
            />
          </span>
          {/* The SAME two counts as the kanji block, over ALL the word's facts
              (standing aggregates every reading-unit's reading and meaning fact).
              See the kanji comment above for why the unseen are subtracted out. */}
          {standing.needWork - (standing.total - standing.seen) > 0 ? (
            <span className="rounded-full border border-warning px-2 py-0.5 text-[11px] text-warning">
              {standing.needWork - (standing.total - standing.seen)} need work
            </span>
          ) : null}
          {standing.total - standing.seen > 0 ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
              {standing.total - standing.seen} not seen
            </span>
          ) : null}
        </>
      ) : isWord ? (
        <>
          {liveFacts[wordReadingFactId(entry.glyph)] !== undefined ||
          factsOf(entry.id).includes(wordReadingFactId(entry.glyph)) ? (
            <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
              Reading{" "}
              <StandingChip
                standing={
                  standingOf(
                    liveFacts[wordReadingFactId(entry.glyph)],
                    claims[wordReadingFactId(entry.glyph)],
                    cfg.accuracyMetric,
                    now,
                  ).standing
                }
              />
            </span>
          ) : null}
          <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
            Meaning{" "}
            <StandingChip
              standing={
                standingOf(
                  liveFacts[wordMeaningFactId(entry.glyph)],
                  claims[wordMeaningFactId(entry.glyph)],
                  cfg.accuracyMetric,
                  now,
                ).standing
              }
            />
          </span>
        </>
      ) : null}

      {/* GRAMMAR: what it MEANS, and what it takes to BUILD it. Two questions
          the app scores separately, so two chips — a single pooled adjective
          would average "I know what 〜てから means" with "I can produce
          行ってから", which are not the same knowledge and go wrong at different
          times.

          ONLY THE SIX REAL STANDINGS appear here (not seen · you know this ·
          solid · getting there · shaky · slipping), because StandingChip can
          only paint those and standing.ts is the only thing allowed to pick
          one. "needs work" is the kanji header's AGGREGATE phrase over a count
          of facts; it is not a standing and has no business on a pattern, which
          has at most four facts and names each of them. */}
      {isGrammar && pattern ? (
        <>
          {patterns.map((sensePattern) => (
            <span
              key={sensePattern.id}
              className="flex items-center gap-1.5 text-[11px] text-text-muted"
            >
              {sensePattern.sense ? `Meaning · ${sensePattern.sense}` : "Meaning"}{" "}
              <StandingChip
                standing={
                  standingOf(
                    liveFacts[patternMeaningFactId(sensePattern.id)],
                    claims[patternMeaningFactId(sensePattern.id)],
                    cfg.accuracyMetric,
                    now,
                  ).standing
                }
              />
            </span>
          ))}
          {/* AND NOTHING ELSE. The production standings used to sit here too,
              one chip per host, which gave 〜すぎる four chips and a header row
              so wide the title had nowhere to go — the min-w floor on the gloss
              in entry-header.tsx is the scar. They are now a column in the
              recipe card, exactly where a kanji's eight readings are: one row
              per host already existed there, so the score joins the thing it is
              about instead of being summarised beside the title. */}
        </>
      ) : null}

      {/* KANA and everything else with exactly one fact: the entry's standing IS
          that fact's standing — no pooling happened, because there was nothing
          to pool. An entry with NO facts (a mark) says nothing at all: it has
          never been asked and never will be, and "all 0 solid" was the old bug. */}
      {!isKanji && !isWord && !isGrammar && standing.total > 0 && standing.standing ? (
        <StandingChip standing={standing.standing} />
      ) : null}
    </>
  );

  // The say-line under the chips. Null wherever there is nothing to say: a
  // pattern is a shape rather than a sound, and a diacritic has no pronunciation
  // at all.
  const sound =
    entry.kind === GRAMMAR_SUBJECT ||
    entry.kind === GRAMMAR_CONCEPT_SUBJECT ||
    mark ||
    !entry.glyph
      ? null
      : isWord && wordRow
        ? { text: wordRow.reb, speak: wordRow.reb, pitch: wordPitch(wordRow.keb) }
        : isKana
          ? { text: entry.readings.join(" · "), speak: entry.glyph }
          : // A kanji has no ONE pronunciation — that is the entire thesis of the
            // readings table below — so the header offers none. Each reading has
            // its own speaker in the row that names it.
            null;

  // ---- word-only material ----

  const pieces = useMemo(() => (wordRow ? piecesOf(wordRow) : null), [wordRow]);
  const forms = useMemo(() => (wordRow ? formsOfWord(wordRow) : null), [wordRow]);
  const formKind = useMemo(() => (wordRow ? wordFormKind(wordRow) : null), [wordRow]);
  /** The word's kanji that have pages of their own — the "Shares" row below. */
  const kanjiPieces = useMemo(
    () =>
      (pieces ?? []).flatMap((p) =>
        p.kind === "kanji" && p.entry ? [{ char: p.char, entry: p.entry }] : [],
      ),
    [pieces],
  );

  // ---- kanji-only material ----

  const readingRows = readingRowsOf(entry);
  // Which readings are OPEN, and on which known word. Recomputed from history
  // rather than stored: the unlock is a consequence of what you know, so it can
  // only ever be derived. See word-unlock.ts.
  const anchors = useMemo(() => readingAnchors(history), [history]);

  const family = isKana ? kanaFamily(entry.glyph) : [];

  // The generic facts table is now the fallback for ANYTHING NEW and nothing
  // else: kanji has its own richer table, a word's two facts are chips in the
  // header, a kana had a one-row table that said nothing its header chip does
  // not, and grammar's facts are now chips too.
  //
  // Grammar left it for the reason words did. Its rows were "Meaning — after
  // doing X" and "Build it — 行く → 行ってから", both of which the header and the
  // recipe card now say better and in the place the reader is already looking.
  // A two-row table restating them under the heading "Meaning and form" is the
  // page saying the same thing twice, which is the one thing a reference page
  // cannot afford. `factRows`/`factsTitle` keep their grammar arms — they are
  // the enumeration of what is scored, other callers use them, and the arms
  // stay correct — this page just no longer prints them.
  //
  // A RADICAL leaves for the same reason a kana did. Its one fact is its
  // meaning, and that meaning is already the hero title while its score is
  // already the header's standing chip; a one-row "Meaning" table under them
  // would be the page saying the same thing a third time. `factRows` keeps its
  // radical arm for the same reason it keeps grammar's — other callers still
  // enumerate what is scored — this page just no longer prints it.
  const genericRows =
    isKana || isKanji || isWord || isGrammar || isRadical || isTransitivity || isKeigo
      ? []
      : factRows(entry);

  const linkRows = (
    <>
      {/* NO "Made of" ROW HERE ANY MORE. The kanji page's shape decomposition is
          now the rich "Built from" card below its strokes (KanjiBuiltFrom) — the
          full immediate pieces, radicals included, each a link — so the compact
          Links-card row that used to list the same components would be the page
          saying "made of" twice. The card is the one place it is said. This block
          only ever rendered for kanji, so nothing else loses a row. */}

      {/* A WORD's kanji, as links. The "Built from" card already shows them
          with their readings; this row is the one in the FIXED Links order, so a
          word's outgoing links are found in the same place as a kanji's. */}
      {kanjiPieces.length > 0 ? (
        <LinkRow label="Shares">
          {kanjiPieces.map((p, i) => (
            <GlyphLink key={`${p.char}-${i}`} id={p.entry} />
          ))}
        </LinkRow>
      ) : null}

      {words.length > 0 ? (
        <LinkRow label="Appears in">
          {words.slice(0, 8).map((w) => (
            <WordLink key={w} word={w} />
          ))}
          {words.length > 8 ? <Hint>· {words.length - 8} more</Hint> : null}
        </LinkRow>
      ) : null}

      {/* GRAMMAR'S OUTGOING LINKS. They sit in "everything else", after the two
          confusion lines, exactly like a kanji's "Made of" — and a grammar page
          simply STARTS here, because `confusableWith` returns [] for anything
          that is not kana or kanji and a pattern accumulates no shape
          neighbours. Nothing below tests for the kind; the rows are absent
          because there is nothing in them. */}
      {familyCluster && familyMembers.length > 1 ? (
        <LinkRow label="Family">
          <Link
            href={`/grammar/${familyCluster.id}`}
            className="text-[13px] text-accent no-underline"
          >
            all {familyMembers.length} side by side →
          </Link>
        </LinkRow>
      ) : null}

      {/* CONCEPT REFERENCES — the foundational idea pages behind this pattern,
          grouped under ONE "Read about it" heading (not one heading per link).
          The form this pattern builds on (the て-form's own entry, etc.) leads,
          then the verb classes on every pattern that CONJUGATES a verb
          (conjugatesVerb, so a plain-dictionary pattern is left out), then the two
          adjective kinds on every pattern that HOSTS an adjective (hostsAdjective).
          formEntryFor is null for a form recipe itself, so a form never links to
          itself. See data/grammar for each predicate. */}
      {isGrammar &&
      pattern &&
      (formEntryFor(pattern) || conjugatesVerb(pattern) || hostsAdjective(pattern)) ? (
        <LinkRow label="Read about it">
          <div className="flex flex-col items-start gap-1">
            {formEntryFor(pattern) && verbAttachForm(pattern) ? (
              <Link
                href={entryHref(patternEntry(formEntryFor(pattern)!))}
                className="text-[13px] text-accent no-underline"
              >
                {formEntryFor(pattern) === "prenominal-form"
                  ? "Describe a noun"
                  : `The ${FORM_LABEL[verbAttachForm(pattern)!]}`} →
              </Link>
            ) : null}
            {conjugatesVerb(pattern) ? (
              <Link
                href={entryHref(grammarConceptEntry("verb-classes"))}
                className="text-[13px] text-accent no-underline"
              >
                {grammarConceptRow("verb-classes")?.name} →
              </Link>
            ) : null}
            {hostsAdjective(pattern) ? (
              <Link
                href={entryHref(grammarConceptEntry("adjective-types"))}
                className="text-[13px] text-accent no-underline"
              >
                {grammarConceptRow("adjective-types")?.name} →
              </Link>
            ) : null}
          </div>
        </LinkRow>
      ) : null}

      {/* CONCEPT-TO-CONCEPT CROSS-LINKS. A concept page sends the reader on to its
          siblings — the て-form idea and the verb-class idea each point at the
          other — so the two most foundational pages are reachable from one
          another. Grouped under ONE "Read about it" heading (not one per link),
          the same as the pattern block above. Every non-concept entry has
          `concept` null and renders nothing. */}
      {concept?.related && concept.related.length > 0 ? (
        <LinkRow label="Read about it">
          <div className="flex flex-col items-start gap-1">
            {concept.related.map((rel) => {
              const other = grammarConceptRow(rel);
              if (!other) return null;
              return (
                <Link
                  key={rel}
                  href={entryHref(grammarConceptEntry(other.id))}
                  className="text-[13px] text-accent no-underline"
                >
                  {other.name} →
                </Link>
              );
            })}
          </div>
        </LinkRow>
      ) : null}

      {/* KEIGO's concept reference — the politeness-levels idea behind the
          specific honorific/humble verbs above. It rides in the SAME Links box
          as every other kind's "Read about it" (it used to be a bespoke card of
          its own), so a keigo page's outgoing link is found where the reader
          already looks. */}
      {isKeigo && keigoSet ? (
        <LinkRow label="Read about it">
          <Link
            href={entryHref(grammarConceptEntry("keigo-registers"))}
            className="text-[13px] text-accent no-underline"
          >
            {grammarConceptRow("keigo-registers")?.name} →
          </Link>
        </LinkRow>
      ) : null}

      {/* NO FAMILY EXTERNAL LINK HERE. A cluster's outside reference (Tae Kim on
          conditionals, Tofugu on ので) is family-level material: it is about all
          four ways to say "if", not about ば alone. It lives on the cluster page,
          which is ABOUT the whole family, and the "Family → all N side by side"
          row above routes there in one hop — so surfacing it again on every
          member page only duplicates a link the reader is one click from. Same
          reasoning keeps `noLinkReason`'s "we have nothing" argument on the
          cluster page too: 7 of 12 clusters have `link: null` and 52 of 81
          patterns are in no cluster at all, so an "outside reading" slot is empty
          almost everywhere and belongs where its absence is genuinely a finding.
          Both stay in clusters.ts as data; neither renders a member row here. */}

      <LinkRow label="Your lists">
        {mine.length ? (
          mine.map((l) => (
            <span
              key={l.id}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted"
            >
              {l.name}
            </span>
          ))
        ) : (
          <Hint>None</Hint>
        )}
      </LinkRow>
    </>
  );

  return (
    <>
      <p className="mb-3 text-[11.5px] text-text-muted">
        <Link href="/library" className="text-text-muted no-underline">
          Library
        </Link>
        {" › "}
        <Link
          href={`/library?kind=${entry.kind}`}
          className="text-text-muted no-underline"
        >
          {KIND_LABEL[entry.kind]}
        </Link>
        {" › "}
        {/* `entryName`, not the glyph. The last crumb is a NAME — it says which
            page you are on — and the long-vowel mark has no glyph, so this
            rendered as a "›" followed by nothing. */}
        {entryName(entry)}
      </p>

      <Card>
        <EntryHeader
          // A keigo set has no single glyph; its hero is the plain verb(s) it
          // replaces (or, for the set phrase, the phrase itself) — see keigoGlyph.
          glyph={isKeigo && keigoSet ? keigoGlyph : entry.glyph}
          // A pattern is up to nine characters long. At the default 76px
          // 〜なければならない wraps three times and buries the gloss; 34px keeps
          // it the biggest thing on the card without it becoming the whole
          // card. SIZE ONLY — the Japanese face is EntryHeader's call now, made
          // from the glyph itself, so every kind gets it and not just this one.
          // A keigo set's plain verbs (行く / 来る / いる) run just as long, so
          // they take the same size.
          glyphClass={
            isGrammar || isKeigo ? "flex-none text-[34px] leading-tight" : undefined
          }
          title={
            // A keigo set leads with the SHARED MEANING to the right of its
            // plain-verb hero — the word-header shape — not the per-form
            // recognition glosses ("eat / drink (honorific) · …"), which the
            // set panel below already spells out register by register.
            isKeigo && keigoSet
              ? keigoSet.meaning
              : entry.meanings.slice(0, 3).join(" · ") || entry.readings.join(" · ")
          }
          // NOT `entry.sub` for grammar. That string is "N4 pattern · must",
          // and the level is the one thing this page has decided not to print
          // (see the header). What replaces it is the more useful fact and the
          // one nothing else on the page carries: knowing 〜すぎる means "too
          // much" and not knowing it takes adjectives means never writing
          // 高すぎる.
          // A counter page's sub is the bare word "Counter" — the one place the
          // term is named on the page, so it is the term itself made the link.
          // "Number" forms are left plain: a page titled "Counter" is a poor
          // destination for the word "Number".
          sub={
            // A keigo set drops the sub-line entirely: the gray "Keigo · eat /
            // drink" restated the meaning now in the title and the shelf named
            // in the breadcrumb, so it was the header saying its own name back.
            isWord && formKind
              ? (
                  <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
                    {formKind}
                  </span>
                )
              : isKeigo
              ? null
              : isGrammar && pattern
              ? attachesTo(pattern)
              : // A kanji or radical leads with its ROLE (radical · kanji · N
                // strokes), replacing the bare strokes line and the radical's
                // Kangxi number — see roleSub.
                roleSub
                ? roleSub
                : isCounter && entry.sub === "Counter"
                  ? <TermLink id="counter">Counter</TermLink>
                  : entry.sub
          }
          chips={chips}
          sound={sound}
          onSpeak={say}
        />
        {/* "It happens, rather than being done to something" — JMdict's `vi`,
            said without the word "object". Both "object" and "intransitive" are
            grammar jargon; what the learner is actually choosing between is 開く
            and 開ける, which is what transitivity.ts names its own fields for.
            GATED ON `forms`: this is a claim about a VERB, and JMdict tags ~300
            NOUNS (電話, which is a noun that also takes する) with a bare `vi`.
            `forms` is null for anything that does not conjugate, so the note
            only shows on words that are actually verbs. */}
        {wordRow && forms && isIntransitive(wordRow) ? (
          <p className="mt-2 text-xs text-text-muted">{INTRANSITIVE_NOTE}</p>
        ) : null}
      </Card>

      {/* ================= KANA ================= */}
      {isKana ? (
        <>
          {/* REMEMBER IT RUNS FULL WIDTH, and this is a deliberate departure
              from the plate, which put it in a left column beside the strokes.
              `MnemonicView` — the ONE mnemonic implementation, the very
              component the stepped lesson renders — lays itself out as a 440px
              picture beside its text (`md:grid-cols-[minmax(0,440px)_1fr]`).
              Dropped into half a page it keeps the 440px and squeezes the story
              into a ~90px ribbon, one word per line.
              The alternative was to give this view its own narrower mnemonic
              layout, which is exactly the mistake the shared-component rule
              exists to prevent: the Library would drift from the lesson again,
              and a learner would re-read a differently-shaped version of what
              they were just taught. So the component keeps its width and the
              page gives it a row. The pairing #65 wanted survives underneath. */}
          {mnemonic ? (
            <Card>
              <MnemonicView
                m={mnemonic}
                glyph={entry.glyph}
                voiceName={cfg.voiceName}
                descriptor={descriptorOf(entry.sub)}
              />
            </Card>
          ) : null}
          {/* The written-form aside, in its own card so it reads as a standalone
              fact about the shape rather than a footnote to the mnemonic. Same
              sentence, same source as the lesson. The opener "Note:" is the
              Callout label so it renders bold; the note string carries no
              prefix, so nothing repeats. */}
          {glyphVariant ? (
            <Card>
              <Callout label="Note:">{glyphVariant}</Callout>
            </Card>
          ) : null}
          {/* "How it's said in context" — the following-sound rules for ん and
              っ, in their own card, same component and source as the lesson. */}
          {contextRules ? (
            <Card>
              <KanaContextView ctx={contextRules} />
            </Card>
          ) : null}
          {/* Only the 46 base glyphs in each script have stroke assets. Links
              now has one fixed home at the bottom of every entry page, so the
              writing card takes this row on its own. */}
          <div className="mb-3.5 [&>*]:mb-0">
            <HowItsWritten
              item={{ entry: entry.id, glyph: entry.glyph, kind: "kana", facts: [] }}
              alwaysOpen
            />
          </div>
          {/* FULL WIDTH AT THE FOOT — は needs five cells, and inside a column it
              would reflow everything above it. */}
          {family.length > 0 ? (
            <KanaFamilyView
              cells={family}
              facts={liveFacts}
              claims={claims}
              metric={cfg.accuracyMetric}
              now={now}
            />
          ) : null}
        </>
      ) : null}

      {/* ================= KANJI ================= */}
      {isKanji ? (
        <>
          {/* BUILT FROM leads — the SHAPE decomposition (何 → 亻 person + 可
              possible, 可 → 丁 street + 口 mouth): the kanji page's own breakdown,
              the full immediate decomposition including radicals (not the
              lesson's kanji-only teachableParts), de-framed so a split enclosure
              shows once, each piece linked. This IS the page's "made of" now —
              the compact Links-card row it used to duplicate is gone. Absent,
              not empty, for an atomic kanji. Distinct from the word page's
              "Built from", which splits a word into its READING pieces. */}
          <KanjiBuiltFrom entry={entry} />
          {/* Readings: what the page is for — 生 is one glyph, eight readings
              keyed on the word each is read in, the only place in the app that
              table can be checked. ABSENT, not empty, for the 114 jōyō kanji
              with no reading rows — the guard renders nothing, not an empty
              box. */}
          {readingRows.length > 0 ? (
            <KanjiReadings
              rows={readingRows}
              anchors={anchors}
              facts={liveFacts}
              claims={claims}
              metric={cfg.accuracyMetric}
              now={now}
              onSpeak={say}
            />
          ) : null}
          {/* Links now sits at the page foot, so the stroke reference uses the
              full row instead of leaving a former Links column empty. */}
          <div className="mb-3.5 [&>*]:mb-0">
            <HowItsWritten
              item={{ entry: entry.id, glyph: entry.glyph, kind: "kanji", facts: [] }}
              alwaysOpen
            />
          </div>
          {words.length > 0 ? (
            <WordsWith
              words={words}
              facts={liveFacts}
              claims={claims}
              metric={cfg.accuracyMetric}
              now={now}
            />
          ) : null}
          {/* THIS KANJI SEEN AS A PART OF OTHERS — 口 is inside 381 of them.
              155 of the 237 KRADFILE components are themselves jōyō kanji, and
              they get this section HERE rather than a second page at
              /radical/口: one character, one page. The other 82 are primitives
              with no entry at all and mount the identical component on their
              own route. Absent — not empty — for the 74 kanji nothing is built
              from; ComponentUses returns null and says so in its header. */}
          <ComponentUses
            component={entry.glyph}
            history={history}
            claims={claims}
            metric={cfg.accuracyMetric}
            now={now}
          />
        </>
      ) : null}

      {/* ================= RADICAL ================= */}
      {/* A radical's whole reason for being is the kanji built on it, so the
          entry page ends where the lesson pointed: the kanji written with this
          shape (and any of them the reader already knows). The same
          ComponentUses the kanji page and the primitive route mount, so a
          radical looked up here reads like the component it is. Absent, not
          empty, for a radical no jōyō kanji is written with. */}
      {isRadical ? (
        <ComponentUses
          component={entry.glyph}
          history={history}
          claims={claims}
          metric={cfg.accuracyMetric}
          now={now}
          asTable
          tableCap={30}
        />
      ) : null}

      {/* ================= WORD ================= */}
      {isWord ? (
        <>
          {/* EVERY READING WITH ITS MEANING, when a word is read more than one
              way. 大 is だい AND おお, 日 is ひ AND にち, and each reading-unit is
              a fact the quiz mints and scores on its own (readingUnits /
              wordUnitFacts). The header carries only the primary (だい, its sound
              and its gloss), so without this the secondary readings were drilled
              but never shown here — the same gap the lesson had. The shared panel
              the teach walk uses draws them, bound ones marked "in compounds", so
              the reference and the lesson cannot disagree about a word's readings.
              A single-reading word (先生) has nothing this adds over the header,
              so it is gated on there being more than one unit. */}
          {wordRow && readingUnits(wordRow).length > 1 ? (
            <div className="mb-3.5">
              <WordSensePanel word={wordRow} voiceName={cfg.voiceName} />
            </div>
          ) : null}
          {/* Absent, not empty, for a jukujikun (大人/おとな) and an all-kana
              word. Links has moved to the common footer, so Built from no
              longer shares a row with navigation. */}
          {pieces ? <WordBuiltFrom pieces={pieces} /> : null}
          {wordRow ? <WordClassNote word={wordRow} className="mb-3.5" /> : null}
          {wordRow && forms ? (
            <WordFormFan
              dictionary={wordRow.keb}
              groups={forms}
              onSpeak={say}
              className="mb-3.5"
            />
          ) : null}
          {/* THE SENTENCE FOLLOWS THE FORMS, and is full width
              because a sentence in a half-column wraps to four ribboned lines.
              The order is the word getting steadily more useful: what it is made
              of, what class it belongs to, the forms it takes, then a real use.
              The forms panel owns its bottom margin so the two cards never touch.

              ABSENT, not empty, for the four words in five with no corpus
              sentence. No card, no heading, no line about the gap. */}
          {example ? <WordExampleView example={example} /> : null}
        </>
      ) : null}

      {/* ================= GRAMMAR ================= */}
      {isGrammar && pattern ? (
        <>
          {/* ONE FORMAT for every form and pattern: PatternTeach returns two boxes
              — an intro and a build box. The build tables (a form's conjugation, or
              a pattern's whole conjugation grouped the same way) are wide, so the
              boxes stack and take the full width rather than sharing a half-row.
              PatternTeach renders the SAME PhaseIntro the lesson teaches with, so
              the two cannot drift. See pattern-teach.tsx. */}
          <div className="mb-3.5 flex flex-col gap-3.5 [&>*]:mb-0">
            {patterns.map((sensePattern) => (
              <PatternTeach key={sensePattern.id} pattern={sensePattern} />
            ))}
          </div>

          {/* FULL WIDTH, like the kana family and the kanji readings, and for the
              same reason: the obligation seven is four columns of Japanese and
              inside a half it would reflow everything above it. It sits ABOVE the
              Links box, so the teaching (this pattern, then the ways it competes
              with its siblings) is the body and Links is the footer beneath it.

              ABSENT, not empty, in two cases. A pattern in no cluster (52 of
              the 81) has no family, and a cluster with a single member would
              render a one-row "ways to say this" table, which is the page
              repeating its own header under a heading that promises
              alternatives. Neither prints a sentence about the absence: a
              missing section is already legible, and 52 pages carrying "this
              one has no family" would be the app narrating itself on the
              majority of its own grammar shelf. (No singleton exists today —
              the smallest populated cluster has two members — so the `> 1` is a
              guard against the data changing, not a case you can reach.) */}
          {familyCluster && familyMembers.length > 1 ? (
            <PatternFamily
              members={familyMembers}
              current={pattern}
              feel={familyCluster.feel}
              facts={liveFacts}
              claims={claims}
              metric={cfg.accuracyMetric}
              now={now}
            />
          ) : null}

        </>
      ) : null}

      {/* The rule itself — a mark's page has its content here, in place of the
          mnemonic and stroke diagram (a rule has no drawing) and of the facts
          table (a rule has no gradeable question). */}
      {mark ? <MarkView mark={mark} /> : null}
      {term ? <TermView term={term} /> : null}
      {concept ? <GrammarConceptView concept={concept} /> : null}

      {/* The pair itself — the shared card the teach walk draws, so the Library
          and the lesson cannot show a pair two different ways. It stands in for
          the mnemonic, the stroke diagram and the facts table all three: a pair
          has no drawing and its "facts" are the two English cues the card
          already prints, so the generic table below is suppressed for it (see
          genericRows) the way it is for a mark. */}
      {isTransitivity && pair ? (
        <Card>
          <VerbPairView pair={pair} voiceName={cfg.voiceName} />
        </Card>
      ) : null}

      {/* The keigo set itself — the shared view the teach walk draws, so the
          Library and the lesson cannot show a set two different ways. It stands
          in for the facts table (keigo is excluded from genericRows) the way the
          verb pair does.

          NO OUTER CARD, unlike the verb pair. The set's honorific/humble FORMS
          are already framed boxes (KeigoSide), so wrapping the view in a Card
          put a box inside a box; the forms read directly on the page instead,
          one level of boxing not two. `showLead={false}` drops the view's own
          plain-verb / meaning lead line too: the header above now carries the
          plain verb and the meaning, so repeating them here would be the page
          saying the same thing twice. The lesson keeps the lead (showLead
          defaults true) — there the view stands alone with no header. */}
      {isKeigo && keigoSet ? (
        keigoSet.formulaic ? (
          // Formulaic sets need an outer Card; verb sets already have bordered form boxes.
          <Card className="mb-3.5">
            <KeigoSetView set={keigoSet} voiceName={cfg.voiceName} showLead={false} />
          </Card>
        ) : (
          <div className="mb-3.5">
            <KeigoSetView set={keigoSet} voiceName={cfg.voiceName} showLead={false} />
          </div>
        )
      ) : null}

      {/* The generic table, now serving grammar and anything new. No rows, no
          section: a headed box containing a header row and nothing else reads as
          broken. */}
      {genericRows.length > 0 ? (
        <Card>
          <Lbl>{factsTitle(entry, genericRows)}</Lbl>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-xs font-medium text-text-muted">
                <th className="py-1.5 pr-2 font-medium">{factsColumnHeader(entry)}</th>
                <th className="py-1.5 font-medium">How it&rsquo;s going</th>
              </tr>
            </thead>
            <tbody>
              {genericRows.map((row) => {
                const s = standingOf(
                  liveFacts[row.id],
                  claims[row.id],
                  cfg.accuracyMetric,
                  now,
                );
                return (
                  <tr key={row.id} className="border-b border-border last:border-b-0">
                    <td className="py-2 pr-2 align-middle">
                      <span className="text-[15px]">{row.label}</span>
                      {row.label !== row.answer ? (
                        <span className="ml-1.5 text-text-muted">— {row.answer}</span>
                      ) : null}
                      {row.speak ? (
                        <button
                          type="button"
                          aria-label={`Hear ${row.speak}`}
                          onClick={() => say(row.speak as string)}
                          className="ml-1.5 cursor-pointer border-none bg-transparent p-0 align-[-0.15em] text-text-muted"
                        >
                          <SoundIcon />
                        </button>
                      ) : null}
                    </td>
                    <td className="py-2 align-middle">
                      <StandingChip standing={s.standing} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : null}

      {/* ONE LINKS FOOTER FOR EVERY LIBRARY KIND. Navigation now has one stable
          position: after all reference/teaching content and immediately before
          the page actions. This also prevents a kind-specific layout from
          accidentally rendering it twice. */}
      <EntryLinks mixups={mixups}>{linkRows}</EntryLinks>

      {/* THE "Compare similar patterns" CARD IS GONE. It was a whole card
          holding one sentence whose only content was a link to the cluster
          page, sitting BELOW the facts table on a page that had nothing else to
          say about the family. The family is now on the page — the actual table,
          with each sibling's standing beside it — and the link to the side-by-
          side view is a row in Links, where every other outgoing link on every
          other kind already lives. A card that exists to link somewhere is a
          link. */}

      <SliceBar
        // NOT SHOWN, but still required. The bar's label is the page's own
        // name here, printed a few inches above in the header and again in the
        // breadcrumb, so `showLabel={false}` keeps the bar to its sentence
        // alone. The label is still passed because it is not only decoration:
        // it names the add-to-list panel and the session the Drill button
        // starts. `entryName`, not the glyph, because the long-vowel mark has
        // no glyph and would name those nothing.
        slice={{ label: entryName(entry), entries: [entry.id] }}
        showLabel={false}
        // The committed aggregate on PURPOSE: this bar plans a drill, and the
        // drill plan is a query over what you durably know, not over the run
        // you are in the middle of. The live fold feeds the STANDING surfaces
        // above (chips, tables) so a miss shows at once; it deliberately does
        // not reach the drill selection, which would let a session rewrite its
        // own deck from its own in-flight answers. Standing display: live.
        // Drill planning: committed.
        facts={history.facts}
        claims={claims}
        history={history}
        now={now}
        onClaim={claim}
        claimFacts={sentenceRuleClaimFacts}
        progressReady={historyLoaded}
      />

      <AttributionLink />
    </>
  );
}

/** `entry.sub` ("Hiragana · Vowels あ") minus the section label's trailing
 * representative kana. That kana names the ROW in a list where no character is
 * otherwise shown; on this card the glyph is now printed beside the title, so
 * repeating it in the corner label is a stutter — "Hiragana · Vowels" says it.
 *
 * Only a LONE trailing kana goes. A label whose remainder still carries kana is
 * left whole, because there the kana are the content, not a decorative tag:
 * "W わ + ん" would otherwise be truncated to the nonsense "W わ +". */
function descriptorOf(sub: string): string {
  const kana = /[぀-ヿ]/u;
  const trimmed = sub.replace(/\s+[぀-ヿ]+$/u, "");
  return trimmed !== sub && !kana.test(trimmed) ? trimmed : sub;
}

/** A word, linked to its own entry when it has one. The `?? null` case is the
 * join being honest: not every word attesting a reading survived the all-jōyō
 * cut that built the vocabulary shelf, and a word that proves a reading is still
 * worth PRINTING — it is the evidence — so it degrades to text. */
function WordLink({ word }: { word: string }) {
  const id = entryForGlyph(VOCAB_SUBJECT, word);
  if (!id) return <span className="text-[13px]">{word}</span>;
  return (
    <Link href={entryHref(id)} className="text-[13px] text-accent no-underline">
      {word}
    </Link>
  );
}
