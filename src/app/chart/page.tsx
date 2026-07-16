"use client";

// Kana chart — Tofugu reference links, a live kana/romaji search, and a
// speakable grid of every character (mnemonic as a hover tooltip).

import { useState, type ReactNode } from "react";

import { Card, Hint, Lbl, PageTitle } from "@/components/ui";
import { mnemonicFor, SETS } from "@/data/characters";
import { useQuizConfig } from "@/lib/quiz-config";
import { speak } from "@/lib/speech";

function TofuguLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="ml-2.5 whitespace-nowrap text-xs text-accent no-underline"
    >
      {children}
    </a>
  );
}

export default function ChartPage() {
  const { cfg } = useQuizConfig();
  const [query, setQuery] = useState("");

  const qRaw = query.trim();
  const q = qRaw.toLowerCase();

  const scripts = SETS.map((set) => ({
    set,
    sections: set.sections
      .map((section) => ({
        section,
        chars: section.chars.filter(
          (ch) =>
            !q || ch.c.includes(qRaw) || ch.r.some((r) => r.includes(q)),
        ),
      }))
      .filter((s) => s.chars.length > 0),
  })).filter((s) => s.sections.length > 0);

  return (
    <>
      <PageTitle title="Kana chart" sub="Click a character to hear it." />
      <Card>
        <p className="mb-1.5 text-[13px]">
          <span className="text-text-muted">Tofugu guides:</span>
          <TofuguLink href="https://www.tofugu.com/japanese/learn-hiragana/">
            Hiragana ↗
          </TofuguLink>{" "}
          ·
          <TofuguLink href="https://www.tofugu.com/japanese/learn-katakana/">
            Katakana ↗
          </TofuguLink>
        </p>
        <p className="text-[13px]">
          <span className="text-text-muted">Charts:</span>
          <TofuguLink href="https://files.tofugu.com/articles/japanese/2014-06-30-learn-hiragana/hiragana-chart-by-tofugu.jpg">
            Hiragana chart ↗
          </TofuguLink>{" "}
          ·
          <TofuguLink href="https://files.tofugu.com/articles/japanese/2016-03-07-hiragana-mnemonics-chart/hiragana-mnemonic-chart-by-tofugu.jpg">
            Hiragana mnemonics ↗
          </TofuguLink>{" "}
          ·
          <TofuguLink href="https://files.tofugu.com/articles/japanese/2014-09-03-learn-katakana/tofugu-katakana-chart.jpg">
            Katakana chart ↗
          </TofuguLink>{" "}
          ·
          <TofuguLink href="https://files.tofugu.com/articles/japanese/2014-09-03-learn-katakana/tofugu-katakana-mnemonic-chart.jpg">
            Katakana mnemonics ↗
          </TofuguLink>
        </p>
      </Card>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search kana or romaji — し, shi, kyo…"
        className="mb-3 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-[15px] text-text"
      />
      {scripts.length === 0 ? (
        <p>
          <Hint>{`Nothing matches "${qRaw}".`}</Hint>
        </p>
      ) : (
        scripts.map(({ set, sections }) => (
          <Card key={set.id}>
            <Lbl>
              {set.label} {set.labelJa}
            </Lbl>
            {sections.map(({ section, chars }) => (
              <div key={section.id}>
                <p className="mb-0.5 mt-3 text-xs font-semibold text-text-muted">
                  {section.label}
                </p>
                <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                  {chars.map((ch) => {
                    const mn = mnemonicFor(ch, section.label);
                    return (
                      <div
                        key={ch.c}
                        title={mn ? `${mn} · click to hear` : "click to hear"}
                        onClick={() => speak(ch.c, cfg.voiceName)}
                        className="cursor-pointer select-none rounded-[10px] border border-border px-1.5 pb-2 pt-2.5 text-center hover:bg-panel"
                      >
                        <span className="block text-[26px] leading-[1.25]">
                          {ch.c}
                        </span>
                        <span className="block text-xs text-text-muted">
                          {ch.r.join(" / ")} 🔊
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </Card>
        ))
      )}
    </>
  );
}
