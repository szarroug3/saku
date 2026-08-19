"use client";

// GRAMMAR entry — the redesigned Library page for one grammar PATTERN (〜たい,
// 〜てから, 〜なければならない). A pattern is the fourth content kind, and unlike a
// glyph it has no strokes and no single sound; what it has that nothing else does
// is a RECIPE — the rule for turning any word into the pattern. This page shows
// the four things a learner wants from a pattern, and nothing about the exam
// level (which vendors disagree on and a learner cannot act on):
//
//   header            — the pattern, its one-line gloss, "grammar rule"
//   Meaning  (accent) — what each sense of it means
//   Attaches to (accent) — the kinds of word you can hang it on (attachesTo)
//   How it's formed (accent) — the recipe, the SAME build the lesson teaches
//                              (PatternTeach → autoPatternPage)
//   Ways to say this (accent) — its family, when it belongs to a cluster
//
// Reference data only, read off the recipe behind the entry (recipeOf/recipesOf)
// and the formula helpers. Every section is guarded on its own content: a pattern
// in no cluster (52 of 81) shows no family, and it says nothing about the gap — a
// missing section is already legible.
//
// recipeOf/recipesOf/clusterById/membersOf all stay LIVE reads —
// data/grammar/recipes.ts and data/grammar/clusters.ts are self-contained, no
// dictionary dependency — but read off library-index.ts's content-free
// recipeOf/recipesOf twins rather than library/entries.ts's, which would drag
// in that file's whole heavy top-of-file import chain just for this lookup.
// FETCHED BY ID by default (the Library route) are itemHeadline's {text, speak}
// and the exact generated/authored teaching + family-build output. The glyph
// comes from library-index.ts. The latter two would otherwise import grammar's dictionary-backed
// vehicle/lesson graph. The teach walk and /dev/views pass those values through
// a live-only adapter instead.

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Lead, Section } from "@/components/library/entry-section";
import { LinkSlot } from "@/components/grammar/link-slot";
import { PatternFamily } from "@/components/library/pattern-family";
import { PatternTeach, type PatternTeaching } from "@/components/library/pattern-teach";
import { SentenceExampleView } from "@/components/lesson/phase-intro-view";
import { cluster as clusterById, membersOf } from "@/data/grammar/clusters";
import { libEntry, recipeOf, recipesOf } from "@/lib/library/library-index";
import { useContentEntry } from "@/lib/library/content-entries";
import type { Headline } from "@/lib/content/headline";
import type { ContentItem } from "@/lib/content/item";
import type { EntryId } from "@/types";

interface GrammarPayload {
  readonly text: string;
  readonly speak: string | null;
  readonly teachings: Readonly<Record<string, PatternTeaching>>;
  readonly familyBuilds: Readonly<Record<string, string>>;
}

// The kinds of word a pattern hangs on, said the way a learner names them (い- and
// な-adjectives collapse to "adjective" — the recipe below shows the per-kind
// form). Joined "x", "x or y", "x, y, or z".
const HOST_LABEL: Record<string, string> = {
  verb: "verb",
  "adj-i": "adjective",
  "adj-na": "adjective",
  noun: "noun",
};
function hostList(attach: readonly { host: string }[]): string {
  const labels = [...new Set(attach.map((a) => HOST_LABEL[a.host] ?? a.host))];
  if (labels.length <= 1) return labels[0] ?? "word";
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}

export function GrammarEntryView({
  entry,
  item,
  liveHeadline,
  liveTeachings,
  liveFamilyBuilds,
}: {
  entry?: EntryId;
  item?: ContentItem;
  liveHeadline?: Headline;
  liveTeachings?: Readonly<Record<string, PatternTeaching>>;
  liveFamilyBuilds?: Readonly<Record<string, string>>;
}) {
  const fetched = useContentEntry<GrammarPayload>(item ? null : (entry ?? null));
  const headline = item ? liveHeadline : fetched;
  const resolvedEntry = item ? item.entry : entry!;
  const glyph = item ? item.glyph : libEntry(resolvedEntry)?.glyph;
  const teachings = item ? liveTeachings : fetched?.teachings;
  const familyBuilds = item ? liveFamilyBuilds : fetched?.familyBuilds;

  const pattern = recipeOf(resolvedEntry);
  const patterns = recipesOf(resolvedEntry);

  if (headline === undefined || headline === null || !glyph || !pattern) return null;

  // The family, or null. Null covers "not in a cluster" (52 of 81 patterns) and a
  // cluster with only one recipe member — neither renders a "ways to say this"
  // table, which with a single row would be the page repeating its own header.
  const familyCluster = pattern.cluster ? (clusterById(pattern.cluster) ?? null) : null;
  const familyMembers = familyCluster ? membersOf(familyCluster) : [];

  // The pattern's own worked sentence — generated once by autoPatternPage (see
  // sentenceExampleFor there) from the same Tatoeba/authored corpus lookup the
  // teach walk uses, so the two surfaces never show two different sentences for
  // the same pattern. Absent, not empty, for a pattern with no tagged sentence.
  const sentenceExample = teachings?.[pattern.id]?.pages?.[0]?.sentenceExample;

  return (
    <EntrySurface>
      <ContentEntryHeader glyph={glyph} headline={headline} typeLabel="grammar rule" />

      {/* HOW IT'S FORMED — the whole page now. The meaning is the header gloss and
          the kinds of word it attaches to fold into this lead ("Take any verb …"),
          so the page goes straight to the one thing only it can show: the recipe,
          rendered by the SAME PatternTeach the lesson teaches with. One box per
          independently-meaningful sense. */}
      <Section title="How it's formed">
        <Lead>
          Take any {hostList(pattern.attach)}, put it in the right form, and add the right
          ending:
        </Lead>
        <div className="flex flex-col gap-3.5">
          {patterns.map((p) => (
            <PatternTeach
              key={p.id}
              teaching={teachings?.[p.id] ?? { kind: "pattern", pages: [] }}
              hideBuildLabel
            />
          ))}
        </div>
      </Section>

      {sentenceExample ? (
        <Section title="In a sentence">
          <SentenceExampleView example={sentenceExample} />
        </Section>
      ) : null}

      {/* WAYS TO SAY THIS — the pattern's family, when it has one. Japanese often
          has several patterns for one English idea (seven ways to say "must"), and
          this table sets the siblings side by side so the reader learns which to
          reach for. ABSENT, not empty, for a pattern in no cluster (like 〜たい)
          or a one-member cluster; the page says nothing about the gap.
          The standing columns are inert in this gallery draft — no history is
          threaded in — so every sibling reads "not seen". */}
      {familyCluster && familyMembers.length > 1 ? (
        <Section title="Ways to say this">
          <Lead>
            Japanese often has more than one pattern for the same idea. These are its
            near-neighbours, and how each is built:
          </Lead>
          <PatternFamily
            members={familyMembers}
            current={pattern}
            feel={familyCluster.feel}
            builtById={familyBuilds ?? {}}
          />
        </Section>
      ) : null}

      {/* READ ABOUT IT — the family's external reference. It used to live on the
          cluster's own /grammar page; those word-cluster pages are gone, so the
          reference (a verified outside link, when one covers the whole family)
          rides here on each member instead of being lost. Only when the pattern's
          cluster carries a link. */}
      {familyCluster?.link ? (
        <Section title="Read about it">
          <LinkSlot link={familyCluster.link} />
        </Section>
      ) : null}
    </EntrySurface>
  );
}
