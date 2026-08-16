"use client";

// The "which particle marks this word?" quiz card's sentence display — a
// complete sentence with the word in question lit and everything else
// dimmed. The exact treatment DrillHalo's PromptGlyph gives a kanji-in-word
// reading card (the asked character lit, the rest of the word dimmed), just
// over a word in a sentence instead of a character in a word. Pure
// presentation — no interactivity here; the answer is the MC board rendered
// alongside it in drill-screen.tsx.
//
// Package 4 follow-on of docs/particle-teaching-workplan.md.

export function ParticleMarkerSentence({
  jp,
  highlightSpan,
}: {
  jp: string;
  highlightSpan: readonly [number, number];
}) {
  const [start, end] = highlightSpan;
  return (
    <p lang="ja" className="max-w-[320px] text-center text-2xl leading-loose wrap-break-word">
      <span style={{ color: "var(--text-muted)", opacity: 0.6 }}>{jp.slice(0, start)}</span>
      <span
        className="font-semibold"
        style={{ color: "var(--text)", textShadow: "0 0 18px color-mix(in srgb, var(--accent) 55%, transparent)" }}
      >
        {jp.slice(start, end)}
      </span>
      <span style={{ color: "var(--text-muted)", opacity: 0.6 }}>{jp.slice(end)}</span>
    </p>
  );
}
