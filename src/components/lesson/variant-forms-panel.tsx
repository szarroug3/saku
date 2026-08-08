// "Also written as" — the panel that tells a learner a character has a second
// shape it takes as a component, and where that shape sits.
//
// SURFACE #1 OF THE VARIANT TEACHING, shared by the lesson and the Library so the
// two never describe the shape differently. On 人's lesson and its Library page it
// shows 亻 sitting on the left; on 心's, 忄 on the left and ⺗ on the bottom. The
// forms come from `variantsOf` (src/data/variant-forms.ts), which derives
// everything but the authored position-name.
//
// A TABLE, ONE ROW PER FORM. Each form is a row of four columns — the form glyph,
// the side it sits on, the Japanese name where one is verified, and a kanji it
// shows up in. A multi-form character (心 → 忄, ⺗; 水 → 氵, 氺) is two rows, so the
// shapes line up column by column instead of running together in a sentence.
//
// POSITIONAL, WITH THE NAME ONLY WHERE IT IS VERIFIED. Most forms have no
// authored name, so the "Called" cell is blank and the form is taught by the side
// it sits on, which is always true. A form with a verified name fills the cell
// (にんべん) and never guesses one. See the NAME table in variant-forms.ts.

import { LessonPanel } from "@/components/lesson/lesson-panel";
import type { VariantForm, VariantPosition } from "@/data/variant-forms";
import { japaneseFontClass } from "@/lib/japanese-text";

/** The side the form sits on, as a single plain word for the "Side" column. `nyo`
 * (the wrap along the bottom and up the left, 辶) and `tare` (hanging from the top
 * down the left, 广) both wrap the host, so both read as "enclosure". */
const POSITION_WORD: Readonly<Record<VariantPosition, string>> = {
  left: "left",
  right: "right",
  top: "top",
  bottom: "bottom",
  nyo: "enclosure",
  tare: "enclosure",
};

/** A glyph set in the Japanese font, a touch larger than the run of text so the
 * shape being taught is legible at body size. */
function Glyph({ children }: { children: string }) {
  return (
    <span className={`text-[17px] leading-none ${japaneseFontClass(children)}`}>
      {children}
    </span>
  );
}

/**
 * The panel, or nothing when the character takes no variant form. Mounted in the
 * radical block of the lesson and beside the Library entry's "Built from".
 */
export function VariantFormsPanel({ forms }: { forms: readonly VariantForm[] }) {
  if (forms.length === 0) return null;
  return (
    <LessonPanel title="Also written as">
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
              <th className="py-1.5 pr-3 font-medium">Appears as</th>
              <th className="py-1.5 pr-3 font-medium">Side</th>
              <th className="py-1.5 pr-3 font-medium">Called</th>
              <th className="py-1.5 font-medium">Example</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => (
              <tr
                key={form.glyph}
                className="border-b border-border last:border-b-0"
              >
                <td className="py-2 pr-3 align-middle">
                  <Glyph>{form.glyph}</Glyph>
                </td>
                <td className="py-2 pr-3 align-middle text-text-muted">
                  {form.position ? POSITION_WORD[form.position] : ""}
                </td>
                <td className="py-2 pr-3 align-middle">
                  {form.name ? (
                    <span className={japaneseFontClass(form.name)}>{form.name}</span>
                  ) : null}
                </td>
                <td className="py-2 align-middle">
                  {form.example ? <Glyph>{form.example}</Glyph> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LessonPanel>
  );
}
