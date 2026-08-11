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

import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { EntrySurface, Lead, Section, SubLabel } from "@/components/library/entry-section";
import { PatternFamily } from "@/components/library/pattern-family";
import { PatternTeach } from "@/components/library/pattern-teach";
import { cluster as clusterById, membersOf } from "@/data/grammar/clusters";
import { libEntry, recipeOf, recipesOf } from "@/lib/library/entries";
import { attachesTo } from "@/lib/grammar/formula";
import type { ContentItem } from "@/lib/content/item";

export function GrammarEntryView({ item }: { item: ContentItem }) {
  // recipeOf/recipesOf key off a LibEntry, so resolve the item's id to one. A
  // non-grammar id (or a stale one) answers undefined here and the page is empty
  // rather than wrong.
  const entry = libEntry(item.entry);
  const pattern = entry ? recipeOf(entry) : null;
  const patterns = entry ? recipesOf(entry) : [];
  if (!pattern) return null;

  // The family, or null. Null covers "not in a cluster" (52 of 81 patterns) and a
  // cluster with only one recipe member — neither renders a "ways to say this"
  // table, which with a single row would be the page repeating its own header.
  const familyCluster = pattern.cluster ? (clusterById(pattern.cluster) ?? null) : null;
  const familyMembers = familyCluster ? membersOf(familyCluster) : [];

  const attaches = attachesTo(pattern);

  return (
    <EntrySurface>
      <ContentEntryHeader item={item} />

      {/* WHAT IT MEANS — one line per independently-meaningful sense. A pattern
          with a single sense (〜たい → "want to X") shows one; 〜から carries two
          (a reason and a starting point), each its own row. The gloss is the
          plain-English "this is what it does", not a comparison to a sibling —
          that belongs to the family table below. */}
      <Section title="Meaning" tone="accent">
        <Lead>
          A pattern is a fixed ending you attach to a word. Adding this one makes the
          whole phrase say:
        </Lead>
        <div className="flex flex-col gap-2.5">
          {patterns.map((p) => (
            <div key={p.id}>
              {p.sense ? <SubLabel>{p.sense}</SubLabel> : null}
              <p className="text-[14px] text-text">{p.gloss}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* WHAT IT ATTACHES TO — the one fact about a pattern that is neither its
          meaning nor its build, and the thing you cannot guess: knowing 〜すぎる
          means "too much" but not that it takes adjectives means never writing
          高すぎる. attachesTo already phrases it in the reader's words ("a verb",
          "an い-adjective"), including a wrap's two ends. Absent only if the
          recipe somehow names no host. */}
      {attaches ? (
        <Section title="What it attaches to" tone="accent">
          <Lead>A pattern only works on certain kinds of word. This one:</Lead>
          <p className="font-kana text-[14px] text-text">{attaches}</p>
        </Section>
      ) : null}

      {/* HOW IT'S FORMED — the recipe, rendered by the SAME PatternTeach the entry
          router mounts, which is the SAME autoPatternPage the lesson teaches with,
          so the reference and the walk cannot describe the build two ways. One box
          per independently-meaningful sense. PatternTeach's own "How to build it"
          label sits inside its card; a fuller redesign would take a variant of
          PatternTeach without that inner label so this section's eyebrow carries
          the title alone. */}
      <Section title="How it's formed" tone="accent">
        <Lead>Take any word it attaches to, put it in the right form, and add the ending:</Lead>
        <div className="flex flex-col gap-3.5">
          {patterns.map((p) => (
            <PatternTeach key={p.id} pattern={p} />
          ))}
        </div>
      </Section>

      {/* WAYS TO SAY THIS — the pattern's family, when it has one. Japanese often
          has several patterns for one English idea (seven ways to say "must"), and
          this table sets the siblings side by side so the reader learns which to
          reach for. ABSENT, not empty, for a pattern in no cluster (like 〜たい)
          or a one-member cluster; the page says nothing about the gap.
          The standing columns are inert in this gallery draft — no history is
          threaded in — so every sibling reads "not seen". */}
      {familyCluster && familyMembers.length > 1 ? (
        <Section title="Ways to say this" tone="accent">
          <Lead>
            Japanese often has more than one pattern for the same idea. These are its
            near-neighbours, and how each is built:
          </Lead>
          <PatternFamily
            members={familyMembers}
            current={pattern}
            feel={familyCluster.feel}
            facts={{}}
            claims={{}}
            metric="attempt"
            now={Date.now()}
          />
        </Section>
      ) : null}
    </EntrySurface>
  );
}
