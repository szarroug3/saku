"use client";

// Recent sessions: what you have done, newest first, and one opened as
// the cards it asked with how each went (SAK-347). The list on the left,
// the session on the right, in the quiz's own grades and colors.
//
// AND WHAT IS NOT DONE YET, above all of it (SAK-444). A quiz or a lesson
// left part way through is not a session -- nothing about it is recorded, and
// it has no grades to tally -- but this is the page a learner comes to for
// "what have I been doing", and the one Continue button beside a heading can
// only carry the newest of them. So the rest wait here, each as one row that
// says what it is and how far in, with the way back to it and a way to let it
// go. Forgetting one is not undoable, so it asks first (SAK-364).
//
// THE ASK IS THE SAME ASK AS EVERY OTHER DELETE (Sam, 2026-09-17): "Forget it
// forever" and "Keep it", with no sentence beside it, because the verb says
// the whole thing (SAK-443). The sentence used to be the only place the row
// admitted the thing was still running, so the row says that itself now, as a
// small tag that stays put while the ask is open.

import { useState } from "react";

import { GlyphName, GlyphReading } from "@/sky/components/glyph";
import { InlineAsk } from "@/sky/components/inline-ask";
import { SkyButton } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";
import { VERDICT } from "@/sky/components/quiz-results";
import { chipReading } from "@/sky/lib/japanese";
import { PLACE_KIND, placeNote, type PlaceEntry } from "@/sky/lib/place";
import { GRADE, GRADES } from "@/sky/lib/quiz";
import { formatWhen, sessionLabel, tallySession, type SkySession } from "@/sky/lib/sessions";
import { useMounted } from "@/sky/components/use-mounted";
import { useNow } from "@/sky/components/use-now";

/** One thing left part way through, with the route's way back to it. */
export interface UnfinishedRow {
  entry: PlaceEntry;
  /** Where it is continued. The route's, since only it knows what a Sky URL
   * looks like (SAK-367). */
  href: string;
  /** Lets it go. Absent leaves the row with only its way back. */
  onForget?: () => void;
}

/** What is not finished, above the sessions. Each row is its kind, how far
 * in, the tag that says it is still running, and the two things you can do
 * with it. */
function Unfinished({ rows }: { rows: readonly UnfinishedRow[] }) {
  const [asking, setAsking] = useState<string | null>(null);
  // a break counts down, so its row says how much is left only once there is a
  // browser whose clock to read (see `placeNote`)
  const now = useNow(30_000);
  return (
    <SkyPanel title="Unfinished" className="mb-4 shrink-0 !p-4">
      <ul className="mt-3 flex flex-col gap-1.5">
        {rows.map(({ entry, href, onForget }) => (
          <li key={entry.kind} className="flex flex-wrap items-center gap-2 rounded-lg bg-sky-card px-3 py-2">
            <span className="flex flex-1 flex-wrap items-center gap-2 text-[13.5px] text-sky-ink">
              <span>{PLACE_KIND[entry.kind]}<span className="text-sky-muted"> · {placeNote(entry, now)}</span></span>
              <Eyebrow tone="accent" tight>In progress</Eyebrow>
            </span>
            {onForget && asking === entry.kind ? (
              <InlineAsk
                confirm="Forget it forever"
                onConfirm={() => { onForget(); setAsking(null); }}
                onKeep={() => setAsking(null)}
              />
            ) : (
              <>
                <SkyButton href={href}>Continue</SkyButton>
                {onForget && <SkyButton variant="outline" onClick={() => setAsking(entry.kind)}>Forget</SkyButton>}
              </>
            )}
          </li>
        ))}
      </ul>
    </SkyPanel>
  );
}

interface SkySessionsProps {
  sessions: readonly SkySession[];
  /** What is left part way through and is not already on a Continue button
   * (SAK-444), newest first. */
  unfinished?: readonly UnfinishedRow[];
  /** Runs the same cards again. */
  onRerun?: (cardIds: readonly string[]) => void;
  /** Forgets a session: its evidence leaves the schedule. */
  onDelete?: (id: string) => Promise<void>;
  height?: string;
}


/**
 * When a session was, in the reader's own timezone.
 *
 * Only in a browser (SAK-355). Signed in, this page is rendered on the server
 * with the route's data, so formatting during that render printed the
 * SERVER's timezone into the HTML: a hydration mismatch, and the wrong
 * wall-clock time in the list until the client caught up. The instant itself
 * is in `dateTime` from the first byte, so a machine reading the page has it
 * whether or not a browser ever arrives.
 */
function When({ ts }: { ts: number }) {
  const mounted = useMounted();
  return <time dateTime={new Date(ts).toISOString()}>{mounted ? formatWhen(ts) : ""}</time>;
}

export function SkySessions({ sessions, unfinished = [], onRerun, onDelete, height }: SkySessionsProps) {
  const [openId, setOpenId] = useState<string | null>(sessions[0]?.id ?? null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = sessions.find((s) => s.id === openId) ?? sessions[0];
  const counts = open ? tallySession(open) : null;
  const remove = async () => {
    if (!open || !onDelete) return;
    setBusy(true);
    try { await onDelete(open.id); setOpenId(null); } finally { setBusy(false); setAsking(false); }
  };

  return (
    <SkyPageShell eyebrow="Sessions" title="What have you done lately?" height={height}>
      {unfinished.length > 0 && <Unfinished rows={unfinished} />}
      {sessions.length === 0 ? (
        <SkyPanel title="Nothing yet"><p className="mt-2 text-[14px] text-sky-ink/90">Every run you finish is kept here, a quiz or a practice deck. Take one from the Observatory, or drill something in Practice.</p></SkyPanel>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 font-sky-ui lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <SkyPanel title="Newest first" fit>
            <ul className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {sessions.map((s) => {
                const t = tallySession(s);
                const on = open?.id === s.id;
                return (
                  <li key={s.id}>
                    {/* items-center, not items-baseline (SAK-415): a row of two
                        sizes centers both on the row rather than hanging them
                        off the taller one's baseline */}
                    <button type="button" onClick={() => { setOpenId(s.id); setAsking(false); }} aria-current={on ? "true" : undefined} className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 rounded-lg border px-3 py-2 text-left ${on ? "border-sky-accent bg-sky-card-strong" : "border-transparent hover:bg-sky-card"}`}>
                      <span className="text-[13.5px] text-sky-ink"><When ts={s.when} /><span className="text-sky-muted"> · {sessionLabel(s)} · {s.cards.length} {s.cards.length === 1 ? "card" : "cards"}</span></span>
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
            <SkyPanel title={<><When ts={open.when} /> · {sessionLabel(open)}</>} fit>
              <dl className="mt-2 grid shrink-0 grid-cols-3 gap-x-6 text-center">
                {GRADES.map((g) => (
                  <div key={g}>
                    <dd className="font-sky-display text-[26px] leading-none text-sky-ink">{counts[g]}</dd>
                    <dt className="mt-1"><Eyebrow tone="inherit" tight className={VERDICT[g]}>{GRADE[g].label}</Eyebrow></dt>
                  </div>
                ))}
              </dl>
              <ul className="mt-4 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                {/* a word's reading beside it, the way its chip prints it
                    (SAK-485); the column is wider for the pair, 今日 きょう,
                    申し込み もうしこみ, and a row keeps its one line */}
                {open.cards.map((c) => {
                  const reading = chipReading(c.item);
                  return (
                  <li key={c.id} className="grid grid-cols-[9rem_1fr_auto] items-center gap-x-3 rounded-lg px-2 py-1.5 sm:grid-cols-[10rem_1fr_auto] sm:gap-x-4">
                    <span className="flex min-w-0 items-center gap-2">
                      <GlyphName glyph={c.item.glyph} standing={c.item.standing} className="max-w-full shrink-0" />
                      {reading && <GlyphReading reading={reading} />}
                    </span>
                    <span className="truncate text-[13.5px] text-sky-ink/90">{c.item.english !== c.item.glyph ? c.item.english : ""}</span>
                    <Eyebrow tone="inherit" tight className={VERDICT[c.grade]}>{GRADE[c.grade].label}</Eyebrow>
                  </li>
                  );
                })}
              </ul>
              {onDelete && asking ? (
                <InlineAsk
                  className="mt-3 shrink-0"
                  confirm="Forget it forever"
                  busyLabel="Forgetting…"
                  busy={busy}
                  onConfirm={remove}
                  onKeep={() => setAsking(false)}
                />
              ) : (
                <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2">
                  {/* a practice run deals cards like any quiz, so it runs again like
                      any quiz (SAK-441) */}
                  {onRerun && (open.kind === "quiz" || open.kind === "practice") && <SkyButton onClick={() => onRerun(open.cards.map((c) => c.id))}>Run it again</SkyButton>}
                  {onDelete && <SkyButton variant="outline" onClick={() => setAsking(true)}>Forget this session</SkyButton>}
                </div>
              )}
            </SkyPanel>
          )}
        </div>
      )}
    </SkyPageShell>
  );
}
