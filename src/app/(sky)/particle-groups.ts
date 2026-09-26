// Two particles a learner mixes up are one item (SAK-491).
//
// Sam, 2026-09-26, on the Observatory's Sentences row showing "marks the
// topic" and "marks the subject" as two tiles: "this should be one item. we
// moved away from separating them, remember." And then: "all particles that
// are merged like that should be one item." The particles that are merged
// like that are the ones that share a page of prose, a note in
// src/data/grammar/particle-notes.ts naming two recipes: は and が, に and で,
// まで and までに, だけ and しか, ね and よ. So the groups are read off those
// notes, one per shared note, and a note added later is a group without a
// line changing here.
//
// A group is a third id over its two patterns, the way a kana row is over its
// kana. The two patterns stay entries and quiz units; the group is what is
// offered, picked, claimed, taught and drawn. It is named by the note's
// eyebrow ("は vs が"), and its meaning line is the family's gloss where the
// two are a family of their own (wa-ga, ni-de in clusters.ts), else each
// particle with its own meaning line, joined with a comma, the way the
// wa-ga gloss reads.
//
// Pure data over the shipped tables: the same for every learner.

import { patternEntry } from "@/data/grammar";
import { CLUSTERS } from "@/data/grammar/clusters";
import { PARTICLE_NOTES } from "@/data/grammar/particle-notes";
import { RECIPES } from "@/data/grammar/recipes";

export interface ParticleGroup {
  /** The group's own id: "particles:" and its recipe ids. */
  id: string;
  /** The recipes it is made of, in the note's order. */
  recipes: readonly string[];
  /** Their entries: the group's parts. */
  parts: readonly string[];
  /** What it is called: the note's eyebrow, "は vs が". */
  glyph: string;
  /** Its meaning line: "は marks the topic, が marks the subject". */
  english: string;
}

/** The meaning line: the family's gloss when the two are a family of exactly
 * these two, else each particle (as the eyebrow writes it) with its own
 * meaning line. */
function meaningOf(recipes: readonly string[], eyebrow: string): string {
  const family = CLUSTERS.find((c) => c.members.length === recipes.length && recipes.every((r) => c.members.includes(r)));
  if (family) return family.gloss;
  const names = eyebrow.split(" vs ");
  return recipes.map((id, i) => {
    const r = RECIPES.find((x) => x.id === id);
    return [names[i] ?? r?.pattern.replace(/^〜/, ""), r?.gloss].filter(Boolean).join(" ");
  }).join(", ");
}

/** Every group, one per shared note, in the Particle page's order. */
export const PARTICLE_GROUPS: readonly ParticleGroup[] = PARTICLE_NOTES.filter((n) => n.recipes.length > 1).map((note) => ({
  id: `particles:${note.recipes.join("-")}`,
  recipes: note.recipes,
  parts: note.recipes.map((r) => patternEntry(r) as string),
  glyph: note.eyebrow,
  english: meaningOf(note.recipes, note.eyebrow),
}));

const BY_ID: ReadonlyMap<string, ParticleGroup> = new Map(PARTICLE_GROUPS.map((g) => [g.id, g]));
const BY_PART: ReadonlyMap<string, ParticleGroup> = new Map(PARTICLE_GROUPS.flatMap((g) => g.parts.map((p) => [p, g] as const)));

/** The group with this id, or nothing. */
export function particleGroup(id: string): ParticleGroup | undefined {
  return BY_ID.get(id);
}

/** The group a pattern's entry is a part of, or nothing. */
export function groupOfPart(entryId: string): ParticleGroup | undefined {
  return BY_PART.get(entryId);
}

/** The id a thing is offered, shown and opened as: a grouped pattern's group,
 * anything else itself. */
export function tileOf(id: string): string {
  return BY_PART.get(id)?.id ?? id;
}
