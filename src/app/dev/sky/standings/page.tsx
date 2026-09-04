// Gallery for the standings: the six words, their colours, the legend and the
// chip, and the decision that turns evidence into a word. Route: /dev/sky/standings
//
// This is the page to check when a standing colour is tuned: every surface
// that paints by standing (star fills, the coverage bar, filter chips) reads
// from the same map this page renders.

import { StandingChip, StandingLegend } from "@/sky/components/standing-legend";
import { STANDING, STANDING_ORDER, standingOf, type Standing, type StandingEvidence } from "@/sky/lib/standing";

const NOW = Date.UTC(2026, 8, 4);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Real shapes of evidence, and the word each earns. */
const CASES: Array<{ story: string; evidence: StandingEvidence }> = [
  { story: "never asked", evidence: { seen: 0, recall: "teach", recentAccuracy: null } },
  { story: "claimed yesterday, never tested", evidence: { seen: 0, recall: "quiet", recentAccuracy: null, claimedAt: NOW - DAY } },
  { story: "claimed a year ago, belief long decayed", evidence: { seen: 0, recall: "teach", recentAccuracy: null, claimedAt: NOW - 365 * DAY } },
  { story: "9 of the last 10 landed, drilled an hour ago", evidence: { seen: 24, recall: "quiet", recentAccuracy: 90, lastTested: NOW - HOUR } },
  { story: "7 of the last 10 landed, drilled an hour ago", evidence: { seen: 24, recall: "quiet", recentAccuracy: 70, lastTested: NOW - HOUR } },
  { story: "3 of the last 10 landed, drilled an hour ago", evidence: { seen: 24, recall: "quiet", recentAccuracy: 30, lastTested: NOW - HOUR } },
  { story: "10 of 10 once, but last tested two months ago", evidence: { seen: 10, recall: "teach", recentAccuracy: 100, lastTested: NOW - 60 * DAY } },
  { story: "tested badly, then marked known just now", evidence: { seen: 5, recall: "quiet", recentAccuracy: 20, lastTested: NOW - DAY, claimedAt: NOW - HOUR } },
];

const SAMPLE_COUNTS: Partial<Record<Standing, number>> = { solid: 27, "getting-there": 1, shaky: 1, slipping: 1, claimed: 2 };

export default function SkyStandingsPage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-semibold text-text">Standings</h2>
        <p className="mt-1 max-w-[72ch] text-sm text-text-muted">
          One status vocabulary for every Sky surface, in the app&apos;s own words. Each
          standing has its own token (<code className="text-text">bg-sky-solid</code>,{" "}
          <code className="text-text">text-sky-slipping</code>) that aliases the night
          palette, so a screen paints the word and never remembers that solid is mint. The
          decision table is the Sky&apos;s copy of the app&apos;s{" "}
          <code className="text-text">standing.ts</code>; a test proves the copy agrees
          with the original on every scenario.
        </p>
      </section>

      {/* on the wash: how the legend and the chips actually sit on the sky */}
      <section className="sky-wash flex flex-col gap-6 rounded-2xl border border-sky-line p-6 font-sky-ui text-sky-ink">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">The legend, with a tally</div>
          <StandingLegend counts={SAMPLE_COUNTS} className="mt-2" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">The legend the lesson shows</div>
          <p className="mt-1 max-w-[60ch] text-[12.5px] text-sky-muted">
            Inside the lesson a star is locked, open, lit or selected, and standings do not
            appear. Its legend carries the two lesson states instead, which are never chips.
          </p>
          <StandingLegend
            standings={[]}
            className="mt-2"
            extra={[
              { label: "tonight", swatch: <span className="h-2.5 w-2.5 rounded-full border border-dashed border-sky-star-mid" /> },
              { label: "lit", swatch: <span className="h-2.5 w-2.5 rounded-full bg-sky-star shadow-[0_0_6px_var(--sky-star)]" /> },
            ]}
          />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">Chips</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {STANDING_ORDER.map((s) => <StandingChip key={s} standing={s} count={SAMPLE_COUNTS[s]} />)}
          </div>
        </div>
        <div className="max-w-[46ch] rounded-2xl border border-sky-line bg-sky-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-muted">In a panel</div>
          <StandingLegend className="mt-2" standings={["solid", "shaky", "slipping"]} />
          <p className="mt-2 text-[12.5px] text-sky-muted">
            A legend can list only the standings on screen, in the same order.
          </p>
        </div>
      </section>

      <section>
        <div className="border-b border-border pb-2">
          <h3 className="text-sm font-semibold text-text">What each word means</h3>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="pr-4 font-medium">standing</th>
                <th className="pr-4 font-medium">token</th>
                <th className="font-medium">meaning</th>
              </tr>
            </thead>
            <tbody>
              {STANDING_ORDER.map((s) => (
                <tr key={s} className="border-t border-border">
                  <td className="py-1.5 pr-4"><StandingChip standing={s} /></td>
                  <td className="py-1.5 pr-4 font-mono text-[12px] text-text">--sky-{s}</td>
                  <td className="py-1.5 text-text-muted">{STANDING[s].meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="border-b border-border pb-2">
          <h3 className="text-sm font-semibold text-text">The decision, on evidence</h3>
          <p className="mt-1 max-w-[72ch] text-xs text-text-muted">
            The caller runs the app&apos;s model and hands over three things: showings, the
            model&apos;s verdict now (teach, probe or quiet) and the share of the last ten
            runs that landed. Solid needs both the verdict and the record.
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="pr-4 font-medium">the record</th>
                <th className="pr-4 font-medium">seen</th>
                <th className="pr-4 font-medium">verdict</th>
                <th className="pr-4 font-medium">last 10</th>
                <th className="font-medium">standing</th>
              </tr>
            </thead>
            <tbody>
              {CASES.map(({ story, evidence }) => (
                <tr key={story} className="border-t border-border">
                  <td className="py-1.5 pr-4 text-text">{story}</td>
                  <td className="py-1.5 pr-4 tabular-nums text-text-muted">{evidence.seen}</td>
                  <td className="py-1.5 pr-4 text-text-muted">{evidence.recall}</td>
                  <td className="py-1.5 pr-4 tabular-nums text-text-muted">{evidence.recentAccuracy === null ? "none" : `${evidence.recentAccuracy}%`}</td>
                  <td className="py-1.5"><StandingChip standing={standingOf(evidence)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="max-w-[72ch] text-sm text-text-muted">
        <div className="border-b border-border pb-2">
          <h3 className="text-sm font-semibold text-text">The rule</h3>
        </div>
        <p className="mt-2">
          A bare coloured dot never appears without its word. The dot is not exported:
          a chip is a dot with its label, a legend is every dot with its label, and a star
          fill or a coverage bar segment sits beside one of those.
        </p>
      </section>
    </div>
  );
}
