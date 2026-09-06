"use client";

// Recent sessions: what you have done, newest first, and one opened as
// the cards it asked with how each went (SAK-347). The list on the left,
// the session on the right, in the quiz's own grades and colors.

import { useState } from "react";

import { SkyButton } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";
import { VERDICT } from "@/sky/components/quiz-results";
import { japaneseFont } from "@/sky/lib/japanese";
import { GRADE, type Grade } from "@/sky/lib/quiz";
import { formatWhen, SESSION_KIND, tally, type SkySession } from "@/sky/lib/sessions";
import { STANDING } from "@/sky/lib/standing";

export interface SkySessionsProps {
  sessions: readonly SkySession[];
  /** Runs the same cards again. */
  onRerun?: (cardIds: readonly string[]) => void;
  /** Forgets a session: its evidence leaves the schedule. */
  onDelete?: (id: string) => Promise<void>;
  height?: string;
}

const GRADES: readonly Grade[] = ["clean", "help", "missed"];

export function SkySessions({ sessions, onRerun, onDelete, height }: SkySessionsProps) {
  const [openId, setOpenId] = useState<string | null>(sessions[0]?.id ?? null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = sessions.find((s) => s.id === openId) ?? sessions[0];
  const counts = open ? tally(open) : null;
  const remove = async () => {
    if (!open || !onDelete) return;
    setBusy(true);
    try { await onDelete(open.id); setOpenId(null); } finally { setBusy(false); setAsking(false); }
  };

  return (
    <SkyPageShell eyebrow="Sessions" title="What have you done lately?" height={height}>
      {sessions.length === 0 ? (
        <SkyPanel title="Nothing yet"><p className="mt-2 text-[14px] text-sky-ink/90">Every quiz you finish is kept here. There are none so far.</p></SkyPanel>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 font-sky-ui lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <SkyPanel title="Newest first" className="flex min-h-0 flex-col">
            <ul className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {sessions.map((s) => {
                const t = tally(s);
                const on = open?.id === s.id;
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => { setOpenId(s.id); setAsking(false); }} aria-current={on ? "true" : undefined} className={`grid w-full grid-cols-[1fr_auto] items-baseline gap-x-3 rounded-lg border px-3 py-2 text-left ${on ? "border-sky-accent bg-sky-card-strong" : "border-transparent hover:bg-sky-card"}`}>
                      <span className="text-[13.5px] text-sky-ink">{formatWhen(s.when)}<span className="text-sky-muted"> · {SESSION_KIND[s.kind]} · {s.cards.length} {s.cards.length === 1 ? "card" : "cards"}</span></span>
                      <span className="flex gap-2 text-[12px] tabular-nums">
                        {GRADES.map((g) => <span key={g} className={VERDICT[g]}>{t[g]}</span>)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </SkyPanel>
          {open && counts && (
            <SkyPanel title={`${formatWhen(open.when)} · ${SESSION_KIND[open.kind]}`} className="flex min-h-0 flex-col">
              <dl className="mt-2 grid shrink-0 grid-cols-3 gap-x-6 text-center">
                {GRADES.map((g) => (
                  <div key={g}>
                    <dd className="font-sky-display text-[26px] leading-none text-sky-ink">{counts[g]}</dd>
                    <dt className="mt-1"><Eyebrow tone="inherit" className={`mb-0 ${VERDICT[g]}`}>{GRADE[g].label}</Eyebrow></dt>
                  </div>
                ))}
              </dl>
              <ul className="mt-4 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                {open.cards.map((c) => (
                  <li key={c.id} className="grid grid-cols-[5rem_1fr_auto] items-center gap-x-3 rounded-lg px-2 py-1.5 sm:grid-cols-[7rem_1fr_auto] sm:gap-x-4">
                    <span className={`truncate text-[17px] font-medium leading-tight ${STANDING[c.item.standing].text} ${japaneseFont(c.item.glyph)}`} title={c.item.glyph}>{c.item.glyph}</span>
                    <span className="truncate text-[13.5px] text-sky-ink/90">{c.item.english !== c.item.glyph ? c.item.english : ""}</span>
                    <Eyebrow tone="inherit" className={`mb-0 ${VERDICT[c.grade]}`}>{GRADE[c.grade].label}</Eyebrow>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2">
                {onRerun && open.kind === "quiz" && <SkyButton onClick={() => onRerun(open.cards.map((c) => c.id))}>Run it again</SkyButton>}
                {onDelete && !asking && <SkyButton variant="outline" onClick={() => setAsking(true)}>Forget this session</SkyButton>}
                {onDelete && asking && (
                  <>
                    <span className="text-[13px] text-sky-ink/90">Its answers leave your schedule.</span>
                    <SkyButton variant="coral" disabled={busy} onClick={remove}>{busy ? "Forgetting…" : "Forget it"}</SkyButton>
                    <SkyButton variant="outline" disabled={busy} onClick={() => setAsking(false)}>Keep it</SkyButton>
                  </>
                )}
              </div>
            </SkyPanel>
          )}
        </div>
      )}
    </SkyPageShell>
  );
}
