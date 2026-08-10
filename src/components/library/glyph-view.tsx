// GlyphView — the Library page for ONE glyph: the cohesive ContentItem, showing
// every role it plays and every pronunciation it teaches (each with its deduped
// meanings), most-spoken first. The lesson teaches these units one at a time; the
// Library shows them all together on one page.

import { teachUnitsOf, byFrequencyDesc, unitFrequency } from "@/lib/content/teach-unit";
import type { ContentItem } from "@/lib/content/item";

export function GlyphView({ item }: { item: ContentItem }) {
  const units = [...teachUnitsOf(item)].sort(byFrequencyDesc);
  return (
    <article className="glyph">
      <header className="glyph__head">
        <div className="glyph__char" lang="ja">
          {item.glyph}
        </div>
        {item.roles.length > 0 && (
          <div className="glyph__roles">{item.roles.join(" · ")}</div>
        )}
      </header>
      <table className="glyph__units">
        <thead>
          <tr>
            <th>Pronunciation</th>
            <th>Meaning</th>
            <th className="glyph__freq">Frequency</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u, i) => (
            <tr key={u.reading ?? `meaning-only-${i}`}>
              <td lang="ja" className="glyph__reading">
                {u.reading ?? "—"}
              </td>
              <td>{u.meanings.map((m) => m.label).join("; ")}</td>
              <td className="glyph__freq">{unitFrequency(u) || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
