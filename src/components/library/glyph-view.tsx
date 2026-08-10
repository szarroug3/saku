// GlyphView — the Library page for ONE glyph: the cohesive ContentItem, showing
// every role it plays and every pronunciation it teaches with its deduped
// meanings, most-spoken first. The lesson teaches these units one at a time; the
// Library shows them together. Frequency is a scheduling signal, not shown here.
//
// FROSTY, NOT WIREFRAME: a translucent panel (the warm ground bleeds through) with
// a soft diffuse shadow, and NO backdrop-blur — the blur is what cost performance;
// translucency + box-shadow are cheap. Shared look lives in `frostCard`.

import { pronunciationUnitsOf, byFrequencyDesc } from "@/lib/content/teach-unit";
import { frostCard } from "@/components/ui/frost";
import type { ContentItem } from "@/lib/content/item";

export function GlyphView({ item }: { item: ContentItem }) {
  const units = [...pronunciationUnitsOf(item)].sort(byFrequencyDesc);
  return (
    <article className={frostCard}>
      <div className="mb-4 flex items-baseline gap-3.5">
        <span className="font-kana text-[52px] leading-none text-text" lang="ja">
          {item.glyph}
        </span>
        {item.roles.length > 0 ? (
          <span className="text-xs uppercase tracking-[0.08em] text-text-muted">
            {item.roles.join(" · ")}
          </span>
        ) : null}
      </div>
      <table className="w-full text-left text-[14px]">
        <tbody>
          {units.map((u, i) => (
            <tr
              key={u.reading ?? `meaning-${i}`}
              className="border-b border-border/60 last:border-b-0"
            >
              <td
                className="whitespace-nowrap py-2.5 pr-6 align-baseline font-kana text-[17px] text-accent"
                lang="ja"
              >
                {u.reading ?? (
                  <span className="text-[13px] italic text-text-muted">meaning only</span>
                )}
              </td>
              <td className="py-2.5 align-baseline text-text">
                {u.meanings.map((m) => m.label).join("; ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
