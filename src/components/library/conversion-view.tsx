"use client";

// The redesigned dakuten / handakuten view — the conversion mark reorganised by
// the CHANGE it makes rather than by script. For each consonant change (k → g)
// it shows the mnemonic once, then the same か→が strip per script, labelled "in
// hiragana" / "in katakana". A `set` filter narrows to one script and drops the
// labels — the lesson teaches one script at a time, so the hiragana lesson shows
// only the hiragana strips and the katakana lesson only the katakana ones.
//
// The pair strip is the SAME `Pair` the lesson's ConversionCard renders, so the
// two describe a voicing identically; only the grouping and the labels differ.

import { Callout } from "@/components/lesson/callout";
import { Pair } from "@/components/lesson/conversion-card";
import { Lead, SubLabel } from "@/components/library/entry-section";
import { hookRuns, type DakutenRow } from "@/data/dakuten-rows";
import type { Mark } from "@/data/marks";
import { useQuizConfig } from "@/lib/quiz-config";

type SetId = "hiragana" | "katakana";

const SET_LABEL: Record<SetId, string> = { hiragana: "in hiragana", katakana: "in katakana" };

interface Conversion {
  from: string;
  to: string;
  hook: string;
  rows: Partial<Record<SetId, DakutenRow>>;
  callouts: string[];
}

/** True for a mark whose content is consonant CONVERSIONS (dakuten, handakuten) —
 * the ones this view is for. Long-vowel and punctuation marks have no such rows
 * and stay on MarkView. */
export function isConversionMark(mark: Mark): boolean {
  return mark.rows.length > 0;
}

export function DakutenConversionView({ mark, set }: { mark: Mark; set?: SetId }) {
  const { cfg } = useQuizConfig();

  // Group the per-script rows by their consonant change, in first-seen order; the
  // mnemonic and any irregularity note are shared across the two scripts, so they
  // sit on the conversion, deduped.
  const conversions: Conversion[] = [];
  for (const row of mark.rows) {
    let c = conversions.find((x) => x.from === row.from && x.to === row.to);
    if (!c) {
      c = { from: row.from, to: row.to, hook: "", rows: {}, callouts: [] };
      conversions.push(c);
    }
    c.rows[row.setId as SetId] = row;
    if (row.hook) c.hook = row.hook;
    if (row.callout && !c.callouts.includes(row.callout)) c.callouts.push(row.callout);
  }

  const sets: SetId[] = set ? [set] : ["hiragana", "katakana"];

  return (
    <div className="flex flex-col gap-8">
      <Lead>
        A {mark.name.toLowerCase()} changes the sound of the consonant while the vowel stays the
        same.
      </Lead>

      {conversions.map((c) => (
        <div key={`${c.from}-${c.to}`}>
          <p className="flex items-center gap-2.5 text-[22px] font-light leading-none text-text">
            <span>{c.from}</span>
            <span aria-hidden className="text-[15px] text-text-muted">
              &rarr;
            </span>
            <span className="text-accent">{c.to}</span>
          </p>

          {c.hook ? (
            <p className="mt-2.5 max-w-[52ch] text-[15px] leading-relaxed text-text-muted">
              {hookRuns(c.hook).map((r, i) =>
                r.hit ? (
                  <span key={i} className="font-medium text-accent">
                    {r.text}
                  </span>
                ) : (
                  <span key={i}>{r.text}</span>
                ),
              )}
            </p>
          ) : null}

          <div className="mt-4 flex flex-col gap-5">
            {sets.map((s) => {
              const row = c.rows[s];
              if (!row) return null;
              return (
                <div key={s}>
                  {set ? null : <SubLabel>{SET_LABEL[s]}</SubLabel>}
                  <div className="flex flex-wrap gap-x-6 gap-y-6">
                    {row.pairs.map(([base, converted]) => (
                      <Pair
                        key={converted}
                        base={base}
                        converted={converted}
                        voiceName={cfg.voiceName}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {c.callouts.length ? (
            <div className="mt-5 space-y-3">
              {c.callouts.map((co, i) => (
                <Callout key={i} label="Heads up.">
                  {co}
                </Callout>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
