"use client";

// One entry, opened up.
//
// This page is the entry/fact split with a face on it. 生 is ONE glyph, ONE
// meaning and NINE readings, each keyed on (kanji, word) and each anchored to
// the everyday word that proves it — and the facts table is the only place in
// the app where you can see that, which makes it the only place the model can be
// checked against reality by the person using it. If this table is ever wrong,
// the model is wrong.
//
// THERE ARE NO PER-ROW DRILL BUTTONS. The rule the design settles: if a screen
// shows you the answer, it doesn't get to ask the question. This page prints
// セイ; a one-card drill of セイ thirty seconds later proves nothing, and the
// app's own arithmetic agrees (review() at p ≈ 1 multiplies by 1.0). The bar at
// the bottom builds a normal session these facts are only part of.

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useState } from "react";

import { AttributionLink } from "@/components/library/attribution-link";
import { MnemonicCard } from "@/components/lesson/mnemonic-card";
import { SliceBar } from "@/components/library/slice-bar";
import { StandingChip } from "@/components/library/standing-chip";
import { Card, Hint, Lbl, PageTitle, SmallBtn, SoundIcon } from "@/components/ui";
import { GRAMMAR_SUBJECT } from "@/data/grammar";
import { factsOf } from "@/lib/facts";
import {
  appearsIn,
  clusterOf,
  confusableWith,
  entryForGlyph,
  factRows,
  KIND_LABEL,
  libEntry,
  madeOf,
  type LibEntry,
} from "@/lib/library/entries";
import { getMnemonic } from "@/data/mnemonics";
import { entryFromParam, entryHref } from "@/lib/library/href";
import { entryStanding, standingOf } from "@/lib/library/standing";
import { useLists } from "@/lib/use-lists";
import { useQuizConfig } from "@/lib/quiz-config";
import { speak } from "@/lib/speech";
import { useHistory } from "@/lib/use-history";
import type { EntryId, FactId } from "@/types";

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
  const [showAll, setShowAll] = useState(false);

  const claims = history.claims ?? {};
  const rows = factRows(entry);
  const facts = factsOf(entry.id);
  const standing = entryStanding(facts, history.facts, claims, cfg.accuracyMetric, now);
  const words = appearsIn(entry);
  const parts = madeOf(entry);
  const confusable = confusableWith(entry);
  const grammarCluster = clusterOf(entry);
  const mine = lists.filter((l) => l.kind === "fixed" && l.entries.includes(entry.id));

  // Have you ACTUALLY mixed this up with anything? A different question from
  // `confusableWith`, with a different source — history, not shape. The entry
  // page must not let a guess read as a report, and the only way to know which
  // it is showing is to ask.
  const everConfused = history.sessions.some((s) =>
    Object.values(s.detail ?? {}).some((d) =>
      confusable.some((c) => (d.confused?.[c] ?? 0) > 0),
    ),
  );

  const claim = async (ids: FactId[]) => {
    await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts: ids, known: true }),
    }).catch(() => {});
    await refresh();
  };

  // The app's own hook for this glyph, when there is one. Every base hiragana
  // resolves; katakana, word and kanji glyphs return null and their pages are
  // untouched. Same hide-when-absent gate as the teach flow — the section below
  // is mounted only when this is non-null.
  const mnemonic = getMnemonic(entry.glyph);

  const VISIBLE = 8;
  const shown = showAll ? rows : rows.slice(0, VISIBLE);

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
        {entry.glyph}
      </p>

      <Card>
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex-none text-[76px] leading-none">{entry.glyph}</div>
          <div className="min-w-0 flex-1">
            <PageTitle
              title={entry.meanings.slice(0, 3).join(" · ") || entry.readings.join(" · ")}
            />
            <p className="mb-3 text-[13px] text-text-muted">
              {entry.readings.length > 0 ? `${entry.readings.join(" · ")} — ` : ""}
              {entry.sub}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {standing.standing ? (
                <StandingChip standing={standing.standing} />
              ) : standing.needWork > 0 ? (
                <span className="rounded-full border border-warning px-2 py-0.5 text-[11px] text-warning">
                  {standing.needWork} need work
                </span>
              ) : (
                <span className="rounded-full border border-success px-2 py-0.5 text-[11px] text-success">
                  all {standing.total} solid
                </span>
              )}
              {/* A pattern has no single pronunciation — 〜てから is a shape, not
                  a sound — so grammar omits Hear rather than speak a placeholder. */}
              {entry.kind !== GRAMMAR_SUBJECT ? (
                <SmallBtn onClick={() => speak(entry.glyph, cfg.voiceName)}>
                  <SoundIcon className="mr-1 align-[-0.15em]" /> Hear it
                </SmallBtn>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {/* Our own mnemonic for this kana, when we have one. Kana without an
          entry — and every word/kanji entry — render nothing here. */}
      {mnemonic ? (
        <Card>
          <Lbl>Remember it</Lbl>
          <MnemonicCard m={mnemonic} />
        </Card>
      ) : null}

      <Card>
        {/* The sentence is the thesis. It is generated from the count rather
            than written, so it cannot drift from the table under it — and for a
            kana it correctly reads "one character and one thing to know", which
            is the degenerate case saying out loud that it is one. */}
        <Lbl>
          {entry.glyph} is one{" "}
          {entry.kind === GRAMMAR_SUBJECT
            ? "pattern"
            : entry.kind === "word"
              ? "word"
              : "character"}{" "}
          and {rows.length === 1 ? "one thing" : `${rows.length} things`} to know
        </Lbl>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-xs font-medium text-text-muted">
              <th className="py-1.5 pr-2 font-medium">Reading</th>
              <th className="py-1.5 pr-2 font-medium">Tested in</th>
              <th className="py-1.5 font-medium">How it&rsquo;s going</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
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
                  </td>
                  <td className="py-2 pr-2 align-middle">
                    {row.askedIn.length ? (
                      <span className="flex flex-wrap gap-1.5">
                        {row.askedIn.map((w) => <WordLink key={w} word={w} />)}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2 align-middle">
                    <StandingChip standing={s.standing} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > VISIBLE && !showAll ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-2.5 cursor-pointer border-none bg-transparent p-0 text-xs text-text-muted underline"
          >
            ＋ {rows.length - VISIBLE} more{" "}
            {rows.length - VISIBLE === 1 ? "reading" : "readings"}
          </button>
        ) : null}
      </Card>

      <Card>
        <Lbl>Links</Lbl>
        <dl className="grid grid-cols-[116px_1fr] gap-x-3 gap-y-1.5 text-[13px] max-[700px]:grid-cols-1">
          {confusable.length > 0 ? (
            <>
              <dt className="text-text-muted">Might get mixed up with</dt>
              <dd className="m-0 flex flex-wrap items-center gap-2">
                {confusable.slice(0, 6).map((id) => (
                  <GlyphLink key={id} id={id} />
                ))}
                <span className="rounded-full border border-warning px-1.5 py-0.5 text-[10px] text-warning">
                  a guess
                </span>
              </dd>
            </>
          ) : null}
          {/* Omitted, not empty, when KRADFILE gives no components. 74 of the
              2,136 jōyō kanji are atomic to it — 生 is one of them, despite the
              design mocking it as 丿 + 土. An empty "Made of" row would look
              like missing data rather than like a kanji that isn't made of
              anything. */}
          {parts.length > 0 ? (
            <>
              <dt className="text-text-muted">Made of</dt>
              <dd className="m-0 flex flex-wrap items-center gap-2">
                {parts.map((p, i) => (
                  <span key={`${p.c}-${i}`} className="flex items-center gap-2">
                    {i > 0 ? <span className="text-text-muted">+</span> : null}
                    {p.id ? (
                      <GlyphLink id={p.id} />
                    ) : (
                      // A radical primitive with no KANJIDIC2 entry — ｜, ノ,
                      // マ. Plain text, because there is no page to send you to
                      // and a dead link is worse than none.
                      <span className="text-text-muted" title="a radical, not a kanji">
                        {p.c}
                      </span>
                    )}
                  </span>
                ))}
              </dd>
            </>
          ) : null}
          {words.length > 0 ? (
            <>
              <dt className="text-text-muted">Appears in</dt>
              <dd className="m-0 flex flex-wrap items-center gap-2">
                {words.slice(0, 8).map((w) => (
                  <WordLink key={w} word={w} />
                ))}
                {words.length > 8 ? (
                  <Hint>· {words.length - 8} more</Hint>
                ) : null}
              </dd>
            </>
          ) : null}
          <dt className="text-text-muted">Your lists</dt>
          <dd className="m-0 flex flex-wrap items-center gap-2">
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
          </dd>
        </dl>
        {confusable.length > 0 && !everConfused ? (
          <p className="mt-2.5 border-t border-border pt-2.5 text-xs text-text-muted">
            <b className="text-text">
              You&rsquo;ve never actually mixed {entry.glyph} up with anything.
            </b>{" "}
            Those just have a similar shape, and the app is guessing. A guess
            never counts against you.
          </p>
        ) : null}
      </Card>

      {/* The way BACK to the cluster map — the "seven ways to say must"
          comparison a pattern belongs to. This is how the map is reached now
          that Grammar is not a top-level tab: from the pattern, into its family. */}
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
        slice={{ label: entry.glyph, entries: [entry.id] }}
        facts={history.facts}
        claims={claims}
        now={now}
        onClaim={claim}
      />

      <AttributionLink />
    </>
  );
}

/** A word, linked to its own entry when it has one.
 *
 * The `?? null` case is real and is the join being honest: a kanji's reading is
 * attested by words from the ingest's own alignment, and not every one of them
 * survived the all-jōyō cut that built the vocabulary shelf. A word that proves
 * a reading but has no page is still worth PRINTING — it is the evidence — so it
 * degrades to text rather than vanishing. */
function WordLink({ word }: { word: string }) {
  const id = entryForGlyph("word", word);
  if (!id) return <span className="text-[13px]">{word}</span>;
  return (
    <Link href={entryHref(id)} className="text-[13px] text-accent no-underline">
      {word}
    </Link>
  );
}

function GlyphLink({ id }: { id: EntryId }) {
  const e = libEntry(id);
  if (!e) return null;
  return (
    <Link href={entryHref(e.id)} className="text-[17px] text-text no-underline">
      {e.glyph}
    </Link>
  );
}
