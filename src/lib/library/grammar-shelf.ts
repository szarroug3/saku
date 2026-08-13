// The "Grammar" shelf, cut into the FORM each pattern is built on.
//
// A shelf is cut where the cut MEANS something to the reader (see shelves.tsx).
// Grammar used to cut by JLPT level — one flat "N5 patterns" list of 30-odd — but
// the level is opinion the app otherwise refuses to print (see recipes.ts), and
// it says nothing about how a pattern is made. Now that each verb form is a
// first-class lesson with a page of its own, the cut that means something is the
// FORM: 〜てから, 〜てください and 〜てしまう are all "build the て-form, then add a
// tail", so they belong together, under the て-form that heads them.
//
// EACH FORM'S OWN RECIPE HEADS ITS SECTION, for free: the sections run in
// TEACHING order and the foundational form recipes (prenominal / te / nai / ta /
// stem-form) are each taught before their patterns, so sorting a form's members
// by teaching rank lands the form recipe first. No special heading step.
//
// WHAT COUNTS AS A FORM SECTION. A real conjugation shape — the て-form, the
// ない-form, the potential, 〜ば — is a section, in the order the track reaches it.
// The plain (dictionary) form is NOT: attaching to the bare word builds no new
// shape (it is why the curriculum teaches no form lesson for it, see
// grammar-lesson.ts), so 〜ことができる, 〜ので and the rest of the plain-form
// patterns fall into the trailing "Other patterns" bucket alongside the noun and
// particle patterns that conjugate nothing.
//
// It lives in a .ts, not beside the JSX in shelves.tsx, so the test runner (no
// JSX) can hold the properties that matter: every pattern lands in exactly one
// section, the forms lead in teaching order, and each is headed by its
// recipe.

import { RECIPES, isTrivialAttachment, type Recipe } from "@/data/grammar/recipes";
import { patternEntry, verbAttachForm } from "@/data/grammar";
import { FORM_LABEL } from "@/lib/grammar/formula";
import { grammarRank } from "@/lib/library/grammar-order";
import { libEntry, type LibEntry } from "@/lib/library/entries";
import type { ShelfSection } from "@/lib/library/shelf-view";
import type { Form } from "@/lib/conjugate";

/** The trailing bucket's key — the plain-form patterns (which build no shape) and
 * every pattern with no verb host at all. */
const OTHER = "other";
/** The LEADING section's key — the case/binding particles, hoisted out of the
 * "Other patterns" bucket into a section of their own at the top of the shelf. */
const PARTICLES = "particles";
type SectionKey = Form | typeof OTHER | typeof PARTICLES;

/**
 * The PARTICLES section's membership, by recipe id.
 *
 * These are the case- and binding-particle patterns — a noun plus a bare
 * particle, conjugating nothing — that a beginner meets and selects as a group,
 * before any verb form. They otherwise scatter into "Other patterns" alongside
 * the plain-form clause patterns, which buries them; a named section at the top
 * matches where the shelf used to show は/が and に/で and gives every particle a
 * selectable, quizzable (meaning) row like any other pattern.
 *
 * An explicit set rather than a computed marker: "is this a particle" is a
 * curatorial call (は/が/に/で/を/へ/まで/までに/だけ/しか are in; a plain-form
 * clause pattern like 〜ので is not), so it is listed by hand and read here. If
 * the set drifts from the recipe table a test would not catch it — keep it in
 * sync with the particles ALLOWLIST block in recipes.ts.
 */
const PARTICLE_IDS: ReadonlySet<string> = new Set([
  "wa", // は — topic
  "ga", // が — subject
  "ni", // に — location / destination
  "de", // で — site of an action
  "wo", // を — direct object
  "e", // へ — direction
  "made", // まで — until / as far as
  "made-ni", // までに — by (a deadline)
  "dake", // だけ — only
  "shika-nai", // しか〜ない — only (nothing but)
]);

/**
 * The section a pattern belongs in: the leading "Particles" section for a case/
 * binding particle, else its verb attach form when that form is a real
 * conjugation shape, else the trailing "Other patterns" bucket.
 *
 * The plain (dictionary) form joins the bucket on purpose — it is the one verb
 * form that builds nothing, so it heads no section, the same reason it gets no
 * form lesson. A non-particle pattern with no verb host (a noun/clause pattern)
 * has no form and joins it too.
 */
function sectionKeyOf(r: Recipe): SectionKey {
  if (PARTICLE_IDS.has(r.id)) return PARTICLES;
  const f = verbAttachForm(r);
  if (f && f !== "dictionary") return f;
  const adjectiveForm = r.attach.find(
    (a) => a.host !== "verb" && a.form && a.form !== "dictionary" && !isTrivialAttachment(a),
  )?.form;
  return adjectiveForm ?? OTHER;
}

/** What a form section is called: the form's name, with the て-form spelled
 * "て/で-form" because its 音便 splits で off で-verbs (のむ → のんで). Every other
 * form reads as FORM_LABEL already names it ("ない-form", "potential form",
 * "stem"). */
function sectionLabel(key: Form): string {
  if (key === "prenominal") return "〜な form";
  return key === "te" ? "て/で-form" : FORM_LABEL[key];
}

function resolve(id: LibEntry["id"] | null): LibEntry[] {
  if (!id) return [];
  const e = libEntry(id);
  return e ? [e] : [];
}

/**
 * The grammar shelf's sections: one per verb form built on, in teaching order,
 * then a trailing "Other patterns". Within a section the patterns run in teaching
 * order too, so the form recipe leads and the shelf reads top-to-bottom in the
 * order the track teaches.
 *
 * Every pattern is resolved to its LibEntry by a lookup, never a parse, and
 * skipped if the build has no entry for it — the same degradation every other
 * shelf takes. An empty section drops out.
 */
export function grammarShelfSections(): ShelfSection[] {
  const ordered = [...RECIPES].sort((a, b) => grammarRank(a.id) - grammarRank(b.id));

  // Group preserving first-seen order, which is teaching order — so the form
  // sections come out in the sequence the track reaches each form.
  const groups = new Map<SectionKey, Recipe[]>();
  for (const r of ordered) {
    const key = sectionKeyOf(r);
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const sections: ShelfSection[] = [];

  // PARTICLES lead the shelf — particles are taught before any verb form, and
  // this is where は/が and に/で used to sit as bespoke links. Now they are real
  // selectable rows (through the shared sectionCard/GrammarShelfRow), so the
  // header is a select-all and each row ticks to drill its meaning.
  const particles = groups.get(PARTICLES);
  if (particles?.length) {
    sections.push({
      id: "particles",
      label: "Particles",
      entries: particles.flatMap((r) => resolve(patternEntry(r.id))),
    });
  }

  for (const [key, recipes] of groups) {
    if (key === OTHER || key === PARTICLES) continue; // handled separately
    sections.push({
      id: `form-${key}`,
      label: sectionLabel(key),
      entries: recipes.flatMap((r) => resolve(patternEntry(r.id))),
    });
  }

  const other = groups.get(OTHER);
  if (other?.length) {
    sections.push({
      id: "form-other",
      label: "Other patterns",
      entries: other.flatMap((r) => resolve(patternEntry(r.id))),
    });
  }

  return sections.filter((s) => s.entries.length > 0);
}
