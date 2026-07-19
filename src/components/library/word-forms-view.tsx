"use client";

// "Forms" — every shape a verb or い-adjective takes, grouped by what the change
// is FOR.
//
// NO STANDING CHIPS HERE, EVER, AND THIS IS NOT AN OVERSIGHT
// =========================================================
// There is no conjugated-form fact aspect in the model and there must not be.
// 1,837 verbs x 19 forms is ~35,000 cards, every one of them re-testing the same
// handful of rules — and a learner who can build 食べて can build 見て, so the
// 35,000th card teaches nothing the first hundred didn't. Conjugation is scored
// on the GRAMMAR side, where ONE pattern fact covers every verb at once.
//
// So this section is a reference, not a scoreboard. It shows you the forms; the
// grammar track asks you to make them. Putting a chip on each row would both
// invent a score the app does not keep and imply a drill it will never run.
//
// NO SECTION AT ALL WHEN THERE ARE NO FORMS. Two thirds of the vocabulary is
// nouns, so the common case is absence — and absence has to look FINISHED rather
// than truncated. An empty "Forms" heading on 先生 would read as data that failed
// to load.

import { Card, Lbl, SoundIcon } from "@/components/ui";
import type { BuiltGroup } from "@/lib/word-forms";

export function WordFormsView({
  groups,
  onSpeak,
}: {
  groups: readonly BuiltGroup[];
  onSpeak: (text: string) => void;
}) {
  return (
    <Card>
      <Lbl>Forms</Lbl>
      {/* NO COUNT PRINTED. The maximum is 19 for every verb class and 11 for
          every adjective class, so nothing is ever cut — and a "19 forms"
          caption would be counting rows the reader can see. */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-[700px]:grid-cols-1">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-1 text-[11px] text-text-muted">{g.title}</p>
            {/* `table-fixed` WITH an explicit label width. Without it each table
                sizes to its own longest label — "make or let them do it" in one
                group, "if" in another — and the speakers stagger from block to
                block, so the eye cannot run down a column. Fixed, every group's
                forms start at the same x. */}
            <table className="w-full table-fixed text-left text-[13px]">
              <colgroup>
                <col className="w-[132px]" />
                <col />
              </colgroup>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.form} className="border-b border-border last:border-b-0">
                    <td className="py-1.5 pr-2 align-middle text-text-muted">{r.label}</td>
                    <td className="py-1.5 align-middle">
                      {/* Speaker on EVERY row, and to the LEFT of the form —
                          the same rule the header follows: the button sits with
                          the thing it speaks. */}
                      <button
                        type="button"
                        aria-label={`Hear ${r.value}`}
                        onClick={() => onSpeak(r.value)}
                        className="mr-1.5 cursor-pointer border-none bg-transparent p-0 align-[-0.15em] text-text-muted"
                      >
                        <SoundIcon />
                      </button>
                      <span className="text-[15px]">{r.value}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Card>
  );
}
