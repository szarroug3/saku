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
// THREE LAYOUTS, ONE HEADER, ONE LINKS ORDER
// ==========================================
// Kana, kanji and words each get the arrangement their material wants — a kana's
// story beside its strokes, a kanji's readings full width, a word taken apart
// into pieces. What does NOT vary is where you look for things: the header is
// the same shape on all three (glyph left, sense middle, standing right, sound
// beneath), and the Links card always runs "you've mixed up with", then
// "commonly mixed up with", then everything else. See entry-links.tsx for why
// those two lines are different questions and must never be one.

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useMemo, useState } from "react";

import { AttributionLink } from "@/components/library/attribution-link";
import { EntryHeader } from "@/components/library/entry-header";
import { EntryLinks, GlyphLink, LinkRow } from "@/components/library/entry-links";
import { KanaFamilyView } from "@/components/library/kana-family-view";
import { KanjiReadings } from "@/components/library/kanji-readings";
import { MarkView } from "@/components/library/mark-view";
import { SliceBar } from "@/components/library/slice-bar";
import { StandingChip } from "@/components/library/standing-chip";
import { WordBuiltFrom } from "@/components/library/word-built-from";
import { WordFormsView } from "@/components/library/word-forms-view";
import { WordsWith } from "@/components/library/words-with";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { MnemonicView } from "@/components/lesson/mnemonic-view";
import { Card, Hint, Lbl, SoundIcon } from "@/components/ui";
import { KANA_SUBJECT } from "@/data/characters";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { KANJI_SUBJECT, meaningFactId } from "@/data/kanji";
import { markFor } from "@/data/marks";
import { getMnemonic } from "@/data/mnemonics";
import {
  VOCAB_SUBJECT,
  vocabRow,
  wordMeaningFactId,
  wordReadingFactId,
} from "@/data/vocab";
import { factsOf } from "@/lib/facts";
import {
  appearsIn,
  clusterOf,
  entryForGlyph,
  entryName,
  factRows,
  factsColumnHeader,
  factsTitle,
  KIND_LABEL,
  libEntry,
  madeOf,
  readingRowsOf,
  type LibEntry,
} from "@/lib/library/entries";
import { entryFromParam, entryHref } from "@/lib/library/href";
import { kanaFamily } from "@/lib/library/kana-family";
import { mixupsOf } from "@/lib/library/mixups";
import { piecesOf } from "@/lib/library/word-pieces";
import { entryStanding, standingOf } from "@/lib/library/standing";
import { speak } from "@/lib/speech";
import { useHistory } from "@/lib/use-history";
import { useLists } from "@/lib/use-lists";
import { useQuizConfig } from "@/lib/quiz-config";
import { formsOfWord, isIntransitive, INTRANSITIVE_NOTE } from "@/lib/word-forms";
import { readingAnchors } from "@/lib/word-unlock";
import type { FactId } from "@/types";

export default function EntryPage({
  params,
}: {
  params: Promise<{ entry: string }>;
}) {
  const { entry: param } = use(params);
  const entry = libEntry(entryFromParam(param));
  // A URL outlives the data it names: re-cut the dictionaries and yesterday's
  // link points at nothing. 404 rather than an empty page — this is genuinely
  // not a thing, and the router already knows how to say that.
  if (!entry) notFound();
  return <EntryView entry={entry} />;
}

function EntryView({ entry }: { entry: LibEntry }) {
  const { history, refresh } = useHistory();
  const { cfg } = useQuizConfig();
  const { lists } = useLists();
  const [now] = useState(() => Date.now());

  const claims = history.claims ?? {};
  const facts = factsOf(entry.id);
  const standing = entryStanding(facts, history.facts, claims, cfg.accuracyMetric, now);
  const words = appearsIn(entry);
  const parts = madeOf(entry);
  const grammarCluster = clusterOf(entry);
  const mine = lists.filter((l) => l.kind === "fixed" && l.entries.includes(entry.id));
  const mark = markFor(entry.id);
  const mnemonic = getMnemonic(entry.glyph);

  // The two confusion lines. Both come out of here, and the history one is built
  // from history ALONE rather than by filtering the shape list — see mixups.ts,
  // which is entirely about why that distinction is load-bearing.
  const mixups = mixupsOf(entry, facts, history);

  const say = (text: string) => speak(text, cfg.voiceName);

  const claim = async (ids: FactId[]) => {
    await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts: ids, known: true }),
    }).catch(() => {});
    await refresh();
  };

  const isKana = entry.kind === KANA_SUBJECT;
  const isKanji = entry.kind === KANJI_SUBJECT;
  const isWord = entry.kind === VOCAB_SUBJECT;

  // ---- the header's three variable parts, decided per kind ----

  const meaningStanding = isKanji
    ? standingOf(
        history.facts[meaningFactId(entry.glyph)],
        claims[meaningFactId(entry.glyph)],
        cfg.accuracyMetric,
        now,
      ).standing
    : null;

  const wordRow = isWord ? vocabRow(entry.glyph) : undefined;

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

      {/* WORD: a row of chips, one per thing the app actually asks. A kana word
          has no reading fact (これ's reading is これ — not a question), so that
          chip is simply absent rather than showing a score for a fact that does
          not exist. */}
      {isWord ? (
        <>
          {history.facts[wordReadingFactId(entry.glyph)] !== undefined ||
          factsOf(entry.id).includes(wordReadingFactId(entry.glyph)) ? (
            <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
              Reading{" "}
              <StandingChip
                standing={
                  standingOf(
                    history.facts[wordReadingFactId(entry.glyph)],
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
                  history.facts[wordMeaningFactId(entry.glyph)],
                  claims[wordMeaningFactId(entry.glyph)],
                  cfg.accuracyMetric,
                  now,
                ).standing
              }
            />
          </span>
        </>
      ) : null}

      {/* KANA and everything else with exactly one fact: the entry's standing IS
          that fact's standing — no pooling happened, because there was nothing
          to pool. An entry with NO facts (a mark) says nothing at all: it has
          never been asked and never will be, and "all 0 solid" was the old bug. */}
      {!isKanji && !isWord && standing.total > 0 && standing.standing ? (
        <StandingChip standing={standing.standing} />
      ) : null}
    </>
  );

  // The say-line under the chips. Null wherever there is nothing to say: a
  // pattern is a shape rather than a sound, and a diacritic has no pronunciation
  // at all.
  const sound =
    entry.kind === GRAMMAR_SUBJECT || mark || !entry.glyph
      ? null
      : isWord && wordRow
        ? { text: wordRow.reb, speak: wordRow.reb }
        : isKana
          ? { text: entry.readings.join(" · "), speak: entry.glyph }
          : // A kanji has no ONE pronunciation — that is the entire thesis of the
            // readings table below — so the header offers none. Each reading has
            // its own speaker in the row that names it.
            null;

  // ---- word-only material ----

  const pieces = useMemo(() => (wordRow ? piecesOf(wordRow) : null), [wordRow]);
  const forms = useMemo(() => (wordRow ? formsOfWord(wordRow) : null), [wordRow]);
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

  // The generic facts table still serves grammar (and anything new): kanji has
  // its own richer table, a word's two facts are chips in the header, and a kana
  // had a one-row table that said nothing its header chip does not.
  const genericRows = isKana || isKanji || isWord ? [] : factRows(entry);

  const linkRows = (
    <>
      {parts.length > 0 ? (
        <LinkRow label="Made of">
          {parts.map((p, i) => (
            <span key={`${p.c}-${i}`} className="flex items-center gap-2">
              {i > 0 ? <span className="text-text-muted">+</span> : null}
              {p.id ? (
                <GlyphLink id={p.id} />
              ) : (
                // A radical primitive with no KANJIDIC2 entry — ｜, ノ, マ. Plain
                // text, because there is no page to send you to and a dead link
                // is worse than none.
                <span className="text-text-muted" title="a radical, not a kanji">
                  {p.c}
                </span>
              )}
            </span>
          ))}
        </LinkRow>
      ) : isKanji ? (
        // 74 of the 2,136 jōyō kanji are atomic to KRADFILE — 生 is one, despite
        // the design mocking it as 丿 + 土. Said in words rather than rendered as
        // an empty row, which would read as missing data.
        <LinkRow label="Made of">
          <Hint>nothing smaller — this one is its own shape</Hint>
        </LinkRow>
      ) : null}

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
          <Hint>not on any — the bar below can file it</Hint>
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
          glyph={entry.glyph}
          title={
            entry.meanings.slice(0, 3).join(" · ") || entry.readings.join(" · ")
          }
          sub={entry.sub}
          chips={chips}
          sound={sound}
          onSpeak={say}
        />
        {/* "It happens, rather than being done to something" — JMdict's `vi`,
            said without the word "object". Both "object" and "intransitive" are
            grammar jargon; what the learner is actually choosing between is 開く
            and 開ける, which is what transitivity.ts names its own fields for. */}
        {wordRow && isIntransitive(wordRow) ? (
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
          <div className="mb-3.5 grid grid-cols-[1.45fr_1fr] items-start gap-3.5 max-[860px]:grid-cols-1">
            <HowItsWritten
              item={{ entry: entry.id, glyph: entry.glyph, kind: "kana", facts: [] }}
              alwaysOpen
            />
            <EntryLinks mixups={mixups}>{linkRows}</EntryLinks>
          </div>
          {/* FULL WIDTH AT THE FOOT — は needs five cells, and inside a column it
              would reflow everything above it. */}
          {family.length > 0 ? (
            <KanaFamilyView
              cells={family}
              facts={history.facts}
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
          {/* Strokes take the wider half: five frames plus the animation do not
              fit an even split. The pairing is what stops the page being a stack
              of full-width boxes. */}
          <div className="mb-3.5 grid grid-cols-[1.45fr_1fr] items-start gap-3.5 max-[860px]:grid-cols-1">
            <HowItsWritten
              item={{ entry: entry.id, glyph: entry.glyph, kind: "kanji", facts: [] }}
              alwaysOpen
            />
            <EntryLinks mixups={mixups}>{linkRows}</EntryLinks>
          </div>
          {readingRows.length > 0 ? (
            <KanjiReadings
              glyph={entry.glyph}
              rows={readingRows}
              anchors={anchors}
              facts={history.facts}
              claims={claims}
              metric={cfg.accuracyMetric}
              now={now}
              onSpeak={say}
            />
          ) : null}
          {words.length > 0 ? (
            <WordsWith
              words={words}
              facts={history.facts}
              claims={claims}
              metric={cfg.accuracyMetric}
              now={now}
            />
          ) : null}
        </>
      ) : null}

      {/* ================= WORD ================= */}
      {isWord ? (
        <>
          <div className="mb-3.5 grid grid-cols-2 items-start gap-3.5 max-[860px]:grid-cols-1">
            {/* Absent, not empty, for a jukujikun (大人/おとな) and an all-kana
                word: there is no per-kanji reading to show, and inventing one
                would be a fact that cannot be graded. */}
            {pieces ? <WordBuiltFrom pieces={pieces} /> : <div />}
            <EntryLinks mixups={mixups}>{linkRows}</EntryLinks>
          </div>
          {/* NO FORMS SECTION AT ALL when there are none — which is two thirds of
              the vocabulary, so absence has to look finished rather than
              truncated. */}
          {forms ? <WordFormsView groups={forms} onSpeak={say} /> : null}
        </>
      ) : null}

      {/* The rule itself — a mark's page has its content here, in place of the
          mnemonic and stroke diagram (a rule has no drawing) and of the facts
          table (a rule has no gradeable question). */}
      {mark ? <MarkView mark={mark} /> : null}

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
                  history.facts[row.id],
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

      {/* Links for the kinds whose layout above did not already place it. */}
      {!isKana && !isKanji && !isWord ? (
        <EntryLinks mixups={mixups}>{linkRows}</EntryLinks>
      ) : null}

      {/* The way BACK to the cluster map — the "seven ways to say must"
          comparison a pattern belongs to. */}
      {grammarCluster ? (
        <Card>
          <Lbl>Compare similar patterns</Lbl>
          <p className="text-[13px] text-text-muted">
            {entry.glyph} is one of a family that comes out as the same English.{" "}
            <Link
              href={`/grammar/${grammarCluster}`}
              className="text-accent no-underline"
            >
              See them side by side →
            </Link>
          </p>
        </Card>
      ) : null}

      <SliceBar
        // `entryName`, not the glyph: the bar prints this label in bold ahead of
        // its sentence, so on the long-vowel mark it read "— nothing here to
        // drill" with nothing in front of the dash.
        slice={{ label: entryName(entry), entries: [entry.id] }}
        facts={history.facts}
        claims={claims}
        now={now}
        onClaim={claim}
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
