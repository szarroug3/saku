"use client";

// The on'yomi hint — a kanji's borrowed-from-Chinese reading(s), the sound it
// takes when it joins other kanji in a compound word.
//
// DISPLAY ONLY, AND BRIEF ON PURPOSE. This names a reading and points at an
// everyday word it surfaces in; it mints no fact and asks nothing. It does NOT
// re-explain what an on'yomi is — that is taught once, in a curriculum intro card
// before the first kanji with an on'yomi (src/data/phase-intros.ts). Here the
// concept is assumed known, so the hint stays a reading and an example.
//
// It is the DISTINCT counterpart to a kanji's standalone/native reading: 校 is
// read こう inside 校門, 学校; that borrowed compound sound is what this surfaces.
// Renders nothing for a kanji with no on'yomi (many kun-only jōyō kanji).

import { HearButton } from "@/components/lesson/hear-button";
import { Card, Lbl } from "@/components/ui";
import { japaneseFontClass } from "@/lib/japanese-text";
import { onReadingsOf } from "@/lib/kanji-onyomi";
import { useQuizConfig } from "@/lib/quiz-config";

export function OnyomiHint({ glyph }: { glyph: string }) {
  const { cfg } = useQuizConfig();
  const readings = onReadingsOf(glyph);
  if (!readings.length) return null;

  return (
    <Card>
      <Lbl>On&rsquo;yomi</Lbl>
      <p className="mb-2 text-xs text-text-muted">
        The reading borrowed from Chinese: the sound this kanji often takes
        inside compound words, alongside its everyday reading. It won&rsquo;t
        always be read this way; which reading applies depends on the word.
      </p>
      <div className="flex flex-wrap gap-2">
        {readings.map((r) => (
          <span
            key={r.reading}
            className="inline-flex items-baseline gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5"
          >
            <span className="font-kana text-[15px] text-text">{r.reading}</span>
            <HearButton
              glyph={r.reading}
              voiceName={cfg.voiceName}
              label={`Hear ${r.reading}`}
              className="self-center"
            />
            {r.word ? (
              <span className="text-[12px] text-text-muted">
                <span className={japaneseFontClass(r.word)}>{r.word}</span>
                {r.wordReading ? (
                  <span className="font-kana"> ({r.wordReading})</span>
                ) : null}
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </Card>
  );
}
