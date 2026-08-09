"use client";

// The compact on'yomi / kun'yomi reference shared by kanji Library pages and
// kanji lesson cards. The once-ever intro teaches the concept; this card applies
// it to one character and anchors every reading in a real vocabulary word.

import { HearButton } from "@/components/lesson/hear-button";
import { Card, Lbl } from "@/components/ui";
import { japaneseFontClass } from "@/lib/japanese-text";
import {
  kunReadingsOf,
  onReadingsOf,
  type ReadingHint,
} from "@/lib/kanji-onyomi";
import { useQuizConfig } from "@/lib/quiz-config";

function ReadingFamily({
  label,
  description,
  readings,
  voiceName,
}: {
  label: string;
  description: string;
  readings: readonly ReadingHint[];
  voiceName: string;
}) {
  if (!readings.length) return null;
  return (
    <section className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {readings.map((r) => (
          <span
            key={`${r.reading}/${r.word ?? ""}`}
            className="inline-flex items-baseline gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5"
          >
            <span className="font-kana text-[15px] text-text">{r.reading}</span>
            <HearButton
              glyph={r.reading}
              voiceName={voiceName}
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
    </section>
  );
}

export function KanjiReadingHint({ glyph }: { glyph: string }) {
  const { cfg } = useQuizConfig();
  const kun = kunReadingsOf(glyph);
  const on = onReadingsOf(glyph);
  if (!kun.length && !on.length) return null;

  return (
    <Card>
      <Lbl>Reading types</Lbl>
      <p className="mb-4 text-xs text-text-muted">
        Rule of thumb: a kanji used by itself, or with hiragana attached to its
        tail, usually uses kun&rsquo;yomi. Multiple kanji linked into a compound
        word usually use on&rsquo;yomi. The word itself always wins when there is
        an exception.
      </p>
      <div className="space-y-4">
        <ReadingFamily
          label="Kun’yomi"
          description="The native Japanese reading, often used alone or with a hiragana tail."
          readings={kun}
          voiceName={cfg.voiceName}
        />
        <ReadingFamily
          label="On’yomi"
          description="The reading borrowed from Chinese, often used in multi-kanji compounds."
          readings={on}
          voiceName={cfg.voiceName}
        />
      </div>
    </Card>
  );
}
