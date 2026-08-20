// DEV pitch-accent playground — audition the VOICEVOX roster against any
// reading/downstep or free-text sentence, without leaving a dev tab open on a
// real word page. Not shipped UI. Route: /dev/pitch-accent
//
// Reuses the SAME production routes the app plays from — /api/pitch-tts for
// an exact known (reading, downstep) pair, /api/tts for free text run through
// the fuzzy per-sentence correction (src/lib/sentence-pitch.ts) — so what you
// hear here is exactly what a learner hears, not a separate demo path that
// can drift from the real one. (The original version of this page synthesized
// on its own throwaway route; that route was deleted once SAK-98/99/100
// shipped the real feature. This one has nothing left to drift.)
"use client";

import { useState } from "react";

import { PitchReading } from "@/components/library/pitch-mark";
import { accentName } from "@/lib/pitch";
import { wordPitch } from "@/data/pitch";
import { vocabRow } from "@/data/vocab";
import { DEFAULT_VOICE_ID, VOICES, pitchApiUrl, voiceApiUrl } from "@/lib/voice";

function play(url: string) {
  const audio = new Audio(url);
  void audio.play().catch(() => {});
}

export default function PitchAccentDevPage() {
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);

  // Exact-pitch panel: a reading + a hand-set downstep, played via
  // /api/pitch-tts — no guessing, same as the word page's pitch button.
  const [reading, setReading] = useState("せんせい");
  const [downstep, setDownstep] = useState(3);

  // Lookup panel: type a written form (keb), resolve its VERIFIED downstep
  // from the Kanjium dataset the same way the word page does.
  const [keb, setKeb] = useState("");
  const [lookupResult, setLookupResult] = useState<string | null>(null);

  // Sentence panel: free text through /api/tts's fuzzy per-accent-phrase
  // correction — whatever a quiz prompt or an ordinary Hear button would do.
  const [sentence, setSentence] = useState("今日は天気がいいので、公園に散歩に行きました。");

  const runLookup = () => {
    const row = vocabRow(keb.trim());
    if (!row) {
      setLookupResult(`No word found for "${keb}".`);
      return;
    }
    const d = wordPitch(row.keb);
    if (d === null) {
      setLookupResult(`${row.keb} (${row.reb}) — no verified pitch in Kanjium.`);
      return;
    }
    setReading(row.reb);
    setDownstep(d);
    setLookupResult(`${row.keb} (${row.reb}) — downstep ${d} (${accentName(d)}).`);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-text">Pitch accent playground</h1>
      <p className="mt-1 mb-6 max-w-prose text-[13px] text-text-muted">
        Plays through the app&rsquo;s real routes (<code>/api/pitch-tts</code>,{" "}
        <code>/api/tts</code>) against the local VOICEVOX engine — nothing here
        is a separate demo synthesis path.
      </p>

      <section className="mb-8">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          Voice
        </h2>
        <div className="flex flex-wrap gap-2">
          {VOICES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVoiceId(v.id)}
              aria-pressed={voiceId === v.id}
              className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${
                voiceId === v.id
                  ? "border-accent bg-accent-bg text-accent"
                  : "border-border text-text-muted hover:text-text"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-lg border border-border p-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          Exact pitch — reading + downstep
        </h2>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-[12px] text-text-muted">
            Reading (kana)
            <input
              value={reading}
              onChange={(e) => setReading(e.target.value)}
              className="mt-1 w-40 rounded border border-border bg-transparent px-2 py-1 font-kana text-text"
            />
          </label>
          <label className="flex flex-col text-[12px] text-text-muted">
            Downstep
            <input
              type="number"
              min={0}
              value={downstep}
              onChange={(e) => setDownstep(Number(e.target.value))}
              className="mt-1 w-20 rounded border border-border bg-transparent px-2 py-1 text-text"
            />
          </label>
          <button
            type="button"
            onClick={() => play(pitchApiUrl(reading, downstep, voiceId))}
            className="rounded-full border border-accent bg-accent-bg px-4 py-1.5 text-[13px] text-accent"
          >
            ▶ Play
          </button>
        </div>
        <PitchReading reading={reading} downstep={downstep} className="text-2xl text-text" />
        <p className="mt-1 text-[12px] text-text-muted">{accentName(downstep)}</p>
      </section>

      <section className="mb-8 rounded-lg border border-border p-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          Look up a word&rsquo;s verified pitch
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={keb}
            onChange={(e) => setKeb(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runLookup()}
            placeholder="先生"
            className="w-40 rounded border border-border bg-transparent px-2 py-1 font-kana text-text"
          />
          <button
            type="button"
            onClick={runLookup}
            className="rounded-full border border-border px-4 py-1.5 text-[13px] text-text-muted hover:text-text"
          >
            Look up
          </button>
        </div>
        {lookupResult && <p className="mt-2 text-[13px] text-text">{lookupResult}</p>}
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          Sentence — fuzzy per-phrase correction
        </h2>
        <div className="flex flex-col gap-3">
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            rows={2}
            className="w-full rounded border border-border bg-transparent px-2 py-1 font-kana text-text"
          />
          <button
            type="button"
            onClick={() => play(voiceApiUrl(voiceId, sentence))}
            className="w-fit rounded-full border border-accent bg-accent-bg px-4 py-1.5 text-[13px] text-accent"
          >
            ▶ Play sentence
          </button>
        </div>
      </section>
    </div>
  );
}
