// What the character means, under "As a kanji".
//
// WHY A PANEL FOR ONE LINE OF TEXT
// ================================
// The kanji block used to open with the table of readings the character takes
// inside longer words: 人 has five rows of it. On a page you looked up that is
// the material. On the step where you first meet the character it is a catalogue
// dropped on someone who has not yet learned a single word it applies to, and
// the owner asked for the definition in its place.
//
// The definition is also on the headword line, and on a single-role kanji this
// panel is therefore suppressed (see `lessonSections` — it is only chosen for a
// step playing several roles). By the time a folded character's reader reaches
// "As a kanji" they have scrolled past the whole word block, and a heading whose
// body is the next heading teaches nothing.
//
// Every meaning, not the header's first four. The kanji rows are short (人 has
// one, 日 has three), so this is the full sense of the character and the cap
// would only be a cap on paper.

import { LessonPanel } from "@/components/lesson/lesson-panel";

export function KanjiMeaningPanel({ meanings }: { meanings: readonly string[] }) {
  if (!meanings.length) return null;
  return (
    <LessonPanel title="What it means">
      <p className="text-[15px] leading-relaxed text-text">{meanings.join(", ")}</p>
    </LessonPanel>
  );
}
