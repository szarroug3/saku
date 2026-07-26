"use client";

import { Card, Lbl } from "@/components/ui";

export function SentenceOrderingTrackIntro() {
  return (
    <Card>
      <Lbl>Track intro · sentence ordering</Lbl>

      <p className="mt-2 text-[13px] text-text-muted">
        Japanese sentence order is not English word order. This track teaches how
        to place chunks so a sentence sounds natural.
      </p>

      <div className="mt-4 space-y-2 rounded-lg border border-border bg-panel px-3 py-3 text-[13px] text-text-muted">
        <p>
          English is usually Subject-Verb-Object: &quot;Sam eats sushi.&quot; Japanese is
          usually Topic/Subject-Object-Verb, so the main action tends to come
          near the end.
        </p>
        <p>
          It is not always &quot;nouns first.&quot; Time, topic, and place chunks can come
          early, and particles mark each chunk&apos;s role.
        </p>
        <p>
          This basic order does not usually change because of the specific verb.
          Verb form changes, but the sentence-final action pattern stays a strong
          default.
        </p>
        <p>
          You will also see subjects omitted when context is clear, which is
          common in Japanese.
        </p>
      </div>
    </Card>
  );
}
