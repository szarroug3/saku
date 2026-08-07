// "Also written as" — the panel that tells a learner a character has a second
// shape it takes as a component, and where that shape sits.
//
// SURFACE #1 OF THE VARIANT TEACHING, shared by the lesson and the Library so the
// two never describe the shape differently. On 人's lesson and its Library page it
// says 人 also appears as 亻 on the left; on 心's, that it appears as 忄 on the
// left and ⺗ underneath. The forms come from `variantsOf` (src/data/variant
// -forms.ts), which derives everything but the authored position-name.
//
// POSITIONAL, WITH THE NAME ONLY WHERE IT IS VERIFIED. Most forms have no
// authored name, so they are taught by where they sit ("on the left, as in 体"),
// which is always true. A form with a verified name adds it ("called にんべん")
// and never guesses one. See the NAME table in variant-forms.ts.

import { Fragment } from "react";

import { LessonPanel } from "@/components/lesson/lesson-panel";
import type { VariantForm, VariantPosition } from "@/data/variant-forms";
import { japaneseFontClass } from "@/lib/japanese-text";

/** Where the form sits, in plain words. `nyo` is the wrap along the bottom and up
 * the left (辶); `tare` hangs from the top down the left side (广). */
const POSITION_PHRASE: Readonly<Record<VariantPosition, string>> = {
  left: "on the left",
  right: "on the right",
  top: "on top",
  bottom: "on the bottom",
  nyo: "wrapping the bottom and left",
  tare: "hanging from the top down the left",
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

/** One form's line: "人 also appears as 亻, called にんべん, on the left, as in
 * 体." The name clause and the position clause each drop out when absent. */
function FormLine({ form }: { form: VariantForm }) {
  const position = form.position ? POSITION_PHRASE[form.position] : null;
  return (
    <p className="text-[15px] leading-relaxed text-text">
      <Glyph>{form.original}</Glyph> also appears as <Glyph>{form.glyph}</Glyph>
      {form.name ? (
        <>
          , called <span className={japaneseFontClass(form.name)}>{form.name}</span>
        </>
      ) : null}
      {position ? <>{`, ${position}`}</> : null}
      {form.example ? (
        <>
          , as in <Glyph>{form.example}</Glyph>
        </>
      ) : null}
      .
    </p>
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
      <div className="flex flex-col gap-1.5">
        {forms.map((form) => (
          <Fragment key={form.glyph}>
            <FormLine form={form} />
          </Fragment>
        ))}
      </div>
    </LessonPanel>
  );
}
