"use client";

// HOW a practice run asks. The source cards are the approved concept-A
// hierarchy: each row is a multi-select, and direction is inferred from the
// complete combinations rather than edited as a separate setting.

import type { ReactNode } from "react";

import { Card, Chip, Row, SmallBtn } from "@/components/ui";
import { useQuizConfig } from "@/lib/quiz-config";
import {
  toggleGridResponse,
  togglePairResponse,
} from "@/lib/ask-config";
import type {
  AnswerStyle,
  AskConfig,
  GridResponse,
  PromptFormat,
  PairResponse,
  ResponseKind,
} from "@/types";

function toggle<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
}

function SourceCard({
  title,
  mark,
  description,
  children,
}: {
  title: string;
  mark: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="mb-3.5 px-5 py-5 sm:px-7">
      <div className="pb-4">
        <h3 className="text-[18px] font-semibold text-text">
          {title}{" "}
          <span className="ml-2 text-[14px] font-medium text-text-muted">
            {mark}
          </span>
        </h3>
        <p className="mt-1 text-[13px] text-text-muted">{description}</p>
      </div>
      <div className="border-t border-border">{children}</div>
    </Card>
  );
}

function AskRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b border-border py-4 last:border-b-0 sm:grid-cols-[180px_1fr] sm:items-center">
      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-text-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function QuizOptionsFields() {
  const { cfg, update } = useQuizConfig();

  const setAsk = (ask: AskConfig) => update({ ask });
  const jpPrompt = (v: PromptFormat) =>
    setAsk({
      ...cfg.ask,
      japanese: {
        ...cfg.ask.japanese,
        prompts: toggle(cfg.ask.japanese.prompts, v),
      },
    });
  const jpResponse = (v: ResponseKind) =>
    setAsk({
      ...cfg.ask,
      japanese: {
        ...cfg.ask.japanese,
        responses: toggle(cfg.ask.japanese.responses, v),
      },
    });
  const jpAnswer = (v: AnswerStyle) =>
    setAsk({
      ...cfg.ask,
      japanese: {
        ...cfg.ask.japanese,
        answers: toggle(cfg.ask.japanese.answers, v),
      },
    });
  const sentencePrompt = (v: PromptFormat) =>
    setAsk({
      ...cfg.ask,
      sentence: {
        ...cfg.ask.sentence,
        prompts: toggle(cfg.ask.sentence.prompts, v),
      },
    });
  const sentenceResponse = (v: ResponseKind) =>
    setAsk({
      ...cfg.ask,
      sentence: {
        ...cfg.ask.sentence,
        responses: toggle(cfg.ask.sentence.responses, v),
      },
    });
  const sentenceAnswer = (v: AnswerStyle) =>
    setAsk({
      ...cfg.ask,
      sentence: {
        ...cfg.ask.sentence,
        answers: toggle(cfg.ask.sentence.answers, v),
      },
    });
  const englishAnswer = (v: AnswerStyle) =>
    setAsk({
      ...cfg.ask,
      english: { answers: toggle(cfg.ask.english.answers, v) },
    });
  const pairResponse = (value: PairResponse) => {
    update({
      pairResponses: togglePairResponse(cfg.pairResponses, value),
    });
  };
  const gridResponse = (value: GridResponse) => {
    update({
      gridResponses: toggleGridResponse(cfg.gridResponses, value),
    });
  };
  return (
    <>
      <Card>
        <Row label="Mode">
          <Chip on={cfg.mode === "drill"} onClick={() => update({ mode: "drill" })}>
            Drill
          </Chip>
          <Chip on={cfg.mode === "pairs"} onClick={() => update({ mode: "pairs" })}>
            Match pairs
          </Chip>
          <Chip on={cfg.mode === "grid"} onClick={() => update({ mode: "grid" })}>
            Grid
          </Chip>
          <Chip
            on={cfg.mode === "substitution"}
            onClick={() => update({ mode: "substitution" })}
          >
            Substitution
          </Chip>
        </Row>
      </Card>

      {cfg.mode === "drill" ? (
        <>
          <SourceCard
            title="Japanese"
            mark="字 / 語 / かな"
            description="A kanji, word, or kana on its own."
          >
            <AskRow label="Prompt Format">
              <Chip
                on={cfg.ask.japanese.prompts.includes("text")}
                onClick={() => jpPrompt("text")}
              >
                Text
              </Chip>
              <Chip
                on={cfg.ask.japanese.prompts.includes("audio")}
                onClick={() => jpPrompt("audio")}
              >
                Audio
              </Chip>
            </AskRow>
            <AskRow label="Expected Response">
              <Chip
                on={cfg.ask.japanese.responses.includes("definition")}
                onClick={() => jpResponse("definition")}
              >
                Definition
              </Chip>
              <Chip
                on={cfg.ask.japanese.responses.includes("romaji")}
                onClick={() => jpResponse("romaji")}
              >
                Romaji/Kana
              </Chip>
            </AskRow>
            <AskRow label="Answer Format">
              <Chip
                on={cfg.ask.japanese.answers.includes("typed")}
                onClick={() => jpAnswer("typed")}
              >
                Type it
              </Chip>
              <Chip
                on={cfg.ask.japanese.answers.includes("mc")}
                onClick={() => jpAnswer("mc")}
              >
                Multiple choice
              </Chip>
            </AskRow>
          </SourceCard>

          <SourceCard
            title="Japanese sentence"
            mark="文"
            description="A whole sentence as the prompt."
          >
            <AskRow label="Prompt Format">
              <Chip
                on={cfg.ask.sentence.prompts.includes("text")}
                onClick={() => sentencePrompt("text")}
              >
                Text
              </Chip>
              <Chip
                on={cfg.ask.sentence.prompts.includes("audio")}
                onClick={() => sentencePrompt("audio")}
              >
                Audio
              </Chip>
            </AskRow>
            <AskRow label="Expected Response">
              <Chip
                on={cfg.ask.sentence.responses.includes("definition")}
                onClick={() => sentenceResponse("definition")}
              >
                Definition
              </Chip>
              <Chip
                on={cfg.ask.sentence.responses.includes("romaji")}
                onClick={() => sentenceResponse("romaji")}
              >
                Kana
              </Chip>
            </AskRow>
            <AskRow label="Answer Format">
              <Chip
                on={cfg.ask.sentence.answers.includes("typed")}
                onClick={() => sentenceAnswer("typed")}
              >
                Type it
              </Chip>
              <Chip
                on={cfg.ask.sentence.answers.includes("mc")}
                onClick={() => sentenceAnswer("mc")}
              >
                Multiple choice
              </Chip>
            </AskRow>
          </SourceCard>

          <SourceCard
            title="English"
            mark="EN"
            description="Shown in text. Response is always Japanese."
          >
            <AskRow label="Answer Format">
              <Chip
                on={cfg.ask.english.answers.includes("typed")}
                onClick={() => englishAnswer("typed")}
              >
                Type it
              </Chip>
              <Chip
                on={cfg.ask.english.answers.includes("mc")}
                onClick={() => englishAnswer("mc")}
              >
                Multiple choice
              </Chip>
            </AskRow>
          </SourceCard>
        </>
      ) : cfg.mode === "pairs" ? (
        <SourceCard
          title="Pairs"
          mark="text only"
          description="Choose at least one relationship to match."
        >
          <AskRow label="Pair Type">
            <Chip
              on={cfg.pairResponses.includes("definition")}
              onClick={() => pairResponse("definition")}
            >
              Japanese + English
            </Chip>
            <Chip
              on={cfg.pairResponses.includes("romaji")}
              onClick={() => pairResponse("romaji")}
            >
              Kanji + romaji
            </Chip>
            <Chip
              on={cfg.pairResponses.includes("sentence")}
              onClick={() => pairResponse("sentence")}
            >
              Sentence + translation
            </Chip>
          </AskRow>
        </SourceCard>
      ) : cfg.mode === "grid" ? (
        <SourceCard
          title="Grid"
          mark="text · typed"
          description="Japanese appears on every card. Choose what you type back."
        >
          <AskRow label="Expected Response">
            <Chip
              on={cfg.gridResponses.includes("definition")}
              onClick={() => gridResponse("definition")}
            >
              English
            </Chip>
            <Chip
              on={cfg.gridResponses.includes("romaji")}
              onClick={() => gridResponse("romaji")}
            >
              Kanji reading / romaji
            </Chip>
          </AskRow>
        </SourceCard>
      ) : null}

      {cfg.mode === "drill" || cfg.mode === "pairs" ? (
        <Card>
          <Row label="Length">
            <Chip
              on={cfg.length === "endless"}
              onClick={() => update({ length: "endless" })}
            >
              Endless
            </Chip>
            <Chip
              on={cfg.length === "limited"}
              onClick={() => update({ length: "limited" })}
            >
              Limited
            </Chip>
            {cfg.length === "limited" ? (
              <>
                <SmallBtn
                  sel={cfg.limType === "cov"}
                  onClick={() => update({ limType: "cov" })}
                >
                  Full coverage
                </SmallBtn>
                <SmallBtn
                  sel={cfg.limType === "count"}
                  onClick={() => update({ limType: "count" })}
                >
                  Count
                </SmallBtn>
                <input
                  type="number"
                  min={1}
                  max={999}
                  disabled={cfg.limType !== "count"}
                  value={cfg.limCount}
                  onChange={(e) =>
                    update({
                      limCount: Math.max(
                        1,
                        Math.min(999, Number(e.target.value) || 1),
                      ),
                    })
                  }
                  aria-label="Question count"
                  className="kq-num w-20 rounded-lg border border-border bg-bg px-2 py-1.5 text-right text-sm text-text disabled:opacity-40"
                />
              </>
            ) : null}
          </Row>
        </Card>
      ) : null}
    </>
  );
}
