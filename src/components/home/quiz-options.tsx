"use client";

// HOW you drill: mode, direction, per-direction answer styles, and length.
// Home's setup panel, and it is ALWAYS OPEN. It used to live behind the hero's
// "Edit setup" disclosure, which is how you could press Start without being
// able to see the settings Start would use — half the reported confusion about
// that screen. Four rows is not a wall; hiding them cost more than it saved.
//
// The Length row is where "Full coverage" lives, and where it always belonged.
// A deck card used to set it as an invisible side-effect of picking 214
// characters; that card is now plain "Everything" and this chip is the only
// thing that touches your length. Rows that don't apply to the chosen mode
// gray out via Row's `dim`, mirroring the legacy renderSetup() logic exactly.

import { Chip, Row, SmallBtn } from "@/components/ui";
import { useQuizConfig } from "@/lib/quiz-config";
import type { Direction } from "@/types";

export function QuizOptionsFields() {
  const { cfg, update } = useQuizConfig();
  const grid = cfg.mode === "grid";

  // "At least one" enforcement: clicking the only enabled direction is a no-op.
  const toggleDir = (dir: Direction) => {
    const other: Direction = dir === "jp2en" ? "en2jp" : "jp2en";
    if (cfg.dirs[dir] && !cfg.dirs[other]) return;
    update({ dirs: { ...cfg.dirs, [dir]: !cfg.dirs[dir] } });
  };

  return (
    <>
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
            {/* The count field never MOUNTS or unmounts — it only enables.
                Row lays its controls out right-aligned, so a field appended at
                the end pushed all four chips left the instant you picked
                "Count": the controls moved out from under the cursor that had
                just clicked one of them.
                The obvious fix is to reserve the width with an empty box, but
                that leaves the row's right edge 76px short of every other row's
                for as long as "Full coverage" is selected — trading a shift for
                a permanent hole. Keeping the real field there and disabling it
                reserves exactly the same space with something true in it: this
                is the number Count would use, and `disabled` is already how
                this app says "not applicable" (Row's `dim`, SmallBtn's
                `disabled:opacity-45`). Now Full coverage ⇄ Count changes only
                whether the field is live. Verified the way the pairs shift was:
                the Count chip's offsetLeft is identical either way.

                That fixed ONE axis and shipped the other. Keeping the field
                mounted stops the chips sliding sideways, but the field was
                still 11px TALLER than a chip, so the row grew the instant you
                left Endless — 47px → 58px — and every row below it moved. The
                horizontal proof (offsetLeft) could not see this, which is why
                it read as fixed.

                Both numbers that made up those 11px were the field quietly
                declining the chip's box:

                  py-2 vs the chip's py-1 ......... 8px
                  text-[15px] vs text-[13px] ...... 3px, because line-height
                    inherits as a RATIO (1.5), so the font size silently sets
                    the line box too: 22.5px against the chip's 19.5px.

                So the field is now built from the chip's own ingredients
                rather than from padding arithmetic that happens to total the
                same: same border, same py-1, same 13px — therefore the same
                19.5px line box, and 29.5px on the nose. Equal BY
                CONSTRUCTION, so a future change to the body's line-height or
                font size moves the chip and this field together instead of
                reopening the gap. 13px also puts the digits in family with
                the 12px SmallBtns beside them; 15px was the outlier. The row
                is 46.5px in every Length state, Endless included. */}
            <input
              type="number"
              min={1}
              max={600}
              disabled={cfg.limType !== "count"}
              value={cfg.limCount}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                update({ limCount: Math.max(1, Number.isNaN(v) ? 1 : v) });
              }}
              aria-label="Question count"
              className="kq-material kq-num w-[62px] rounded-lg border border-border bg-card px-2.5 py-1 text-[13px] text-text disabled:cursor-default disabled:opacity-45"
            />
          </>
        ) : null}
      </Row>
    </>
  );
}
