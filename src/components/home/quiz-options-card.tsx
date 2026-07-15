"use client";

// The "Quiz" card on the Home builder: mode, direction, per-direction answer
// styles, and length. Rows that don't apply to the chosen mode gray out via
// Row's `dim`, mirroring the legacy renderSetup() logic exactly.

import { Card, Chip, Lbl, Row, SmallBtn } from "@/components/ui";
import { useQuizConfig } from "@/lib/quiz-config";
import type { Direction } from "@/types";

export function QuizOptionsCard() {
  const { cfg, update } = useQuizConfig();
  const grid = cfg.mode === "grid";

  // "At least one" enforcement: clicking the only enabled direction is a no-op.
  const toggleDir = (dir: Direction) => {
    const other: Direction = dir === "jp2en" ? "en2jp" : "jp2en";
    if (cfg.dirs[dir] && !cfg.dirs[other]) return;
    update({ dirs: { ...cfg.dirs, [dir]: !cfg.dirs[dir] } });
  };

  return (
    <Card>
      <Lbl>Quiz</Lbl>
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
      </Row>
      <Row label="Direction" hint="at least one" dim={grid}>
        <Chip on={cfg.dirs.jp2en} onClick={() => toggleDir("jp2en")}>
          Japanese → English
        </Chip>
        <Chip on={cfg.dirs.en2jp} onClick={() => toggleDir("en2jp")}>
          English → Japanese
        </Chip>
      </Row>
      <Row
        label="JP → EN answers"
        dim={grid || !cfg.dirs.jp2en || cfg.mode === "pairs"}
      >
        <Chip
          on={cfg.styleJp2en === "typed"}
          onClick={() => update({ styleJp2en: "typed" })}
        >
          Type romaji
        </Chip>
        <Chip
          on={cfg.styleJp2en === "mc"}
          onClick={() => update({ styleJp2en: "mc" })}
        >
          Multiple choice
        </Chip>
      </Row>
      <Row
        label="EN → JP answers"
        dim={grid || !cfg.dirs.en2jp || cfg.mode === "pairs"}
      >
        <Chip
          on={cfg.styleEn2jp === "mc"}
          onClick={() => update({ styleEn2jp: "mc" })}
        >
          Multiple choice
        </Chip>
        <Chip
          on={cfg.styleEn2jp === "typed"}
          onClick={() => update({ styleEn2jp: "typed" })}
        >
          Type kana (needs IME)
        </Chip>
      </Row>
      <Row label="Length" dim={grid}>
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
            {cfg.limType === "count" ? (
              <input
                type="number"
                min={1}
                value={cfg.limCount}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  update({ limCount: Math.max(1, Number.isNaN(v) ? 1 : v) });
                }}
                aria-label="Question count"
                className="w-[70px] rounded-lg border border-border bg-card px-2.5 py-2 text-[15px] text-text"
              />
            ) : null}
          </>
        ) : null}
      </Row>
    </Card>
  );
}
