"use client";

// Up next — the one card that stands between a new user and 214 characters.
//
// WHAT IT IS FOR
// ==============
// Day one used to be: pick a length, press Start, read 214 characters off one
// screen. Nothing there was false, and all of it was useless. This card is the
// same information cut at the joint the material already has — one group, five
// characters, and the two things you actually want on that screen: where to
// learn them, and a way to say you already have.
//
// IT HOLDS NO STATE, AND THAT IS THE DESIGN
// =========================================
// There is no "current lesson" here, in cfg, or on disk. `nextLesson(history)`
// is a function of what you know, so the card is a view of history and nothing
// else. Finish the vowels and the k-row appears because the vowels stopped being
// new — not because anything advanced a pointer. Claim all of hiragana and ア
// appears the same way. A cursor would be a second copy of the truth, and the
// first copy is already on disk.
//
// WHAT IT MAY SAY
// ===============
// Every word on it is read off `src/data/characters.ts` or counted from it: the
// label, the characters, their readings, which group of how many. "Group 1 of
// 26" is COUNTED, never written down — a card that promised ten would be caught
// out at the eleventh by the user who kept going, and the count really does
// move: merging the は row's two marks into one group took hiragana from
// twenty-seven sections to twenty-six without a line changing here.

import { WhyDisclosure } from "@/components/lesson/why";
import { ClaimExplainer } from "@/components/lesson/claim-explainer";
import { Btn, Card, Lbl } from "@/components/ui";
import { CHAR_INDEX } from "@/data/characters";
import { dakutenRowFor } from "@/data/dakuten-rows";
import { WHY_SCRIPT } from "@/data/why";
import type { Lesson } from "@/lib/lesson";
import { setFacts, widerScope } from "@/lib/lesson";
import type { FactId } from "@/types";

export function NextLesson({
  lesson,
  onTeach,
  onQuizMe,
  onClaim,
}: {
  lesson: Lesson;
  /**
   * "Teach me here" — learn these in the app, then drill. Opens a session whose
   * TEACH PHASE steps each character one at a time (its mnemonic, how it's
   * written), then rolls into the drill — the same session/teach-walk.tsx the
   * kanji and word cards reach through Start. Kana is taught in-app now; the
   * guides the app learned kana from are credited on the Resources page.
   */
  onTeach: (facts: FactId[]) => void;
  /**
   * "Quiz me" — I've learned these (at Tofugu, or in the walkthrough) and
   * they're fair game. Marks the group SEEN (into the knowledge base, drillable)
   * and drops STRAIGHT into a drill, skipping the teach phase. It is NOT gated on
   * proving anything first: asking to be quizzed IS the statement that you've
   * seen it, and the drill supplies the accuracy. See the seen vs claimed split
   * in src/lib/claims.ts.
   *
   * Facts and not chars because the runtime is fact-native, and `string[]` here
   * is a seam a branded FactId slides through in silence.
   */
  onQuizMe: (facts: FactId[]) => void;
  /**
   * "I already know these" — I knew them before the app; don't waste my time.
   * Marks the group KNOWN and skips the drill, so the next thing surfaced is the
   * next new material rather than a drill. A different record from "Quiz me", on
   * purpose: what you route to next depends on which you meant.
   */
  onClaim: (facts: FactId[]) => void;
}) {
  const { group, chars } = lesson;
  // "Teach me here" is the way in: kana is taught in the app, the same stepped
  // teach phase (session/teach-walk.tsx) the kanji and word lessons use — so
  // kana is taught the same way as everything else rather than through a one-off
  // inline card or an external hand-off. The guides the app's approach came from
  // are credited on the Resources page. (`learn` still rides along on the Lesson
  // for that provenance; it just no longer renders a link here.)
  const readings = chars
    .map((c) => CHAR_INDEX[c]?.r[0])
    .filter(Boolean)
    .join(" · ");

  // Why THIS script, and only where the question is live: the first group of a
  // script is the juncture a beginner actually asks "why am I starting here?" —
  // day one for hiragana, the hand-off for katakana. On group two onward the
  // answer hasn't changed and repeating it would be the wall of text the pattern
  // exists to avoid. Absent for any script with no entry, so this is silent
  // rather than empty.
  const why = group.index === 1 ? WHY_SCRIPT[group.setId] : undefined;

  // Whether this group is a dakuten CONVERSION — taught as one card about a
  // mark rather than as five character cards. Read off the data, not off the
  // label, so it cannot drift from what the walk will actually render.
  const conversion = !!dakutenRowFor(chars[0]);

  // The wider drill scope, or null when it would select these same facts and the
  // fork would be a choice between two identical drills. See widerScope().
  const soFar = widerScope(group);

  return (
    <>
      <Card>
        <Lbl>
          Up next · {group.setLabel.toLowerCase()} · group {group.index} of{" "}
          {group.total}
        </Lbl>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-[22px] font-light tracking-[-0.3px]">
              {group.label}
            </h1>
            <p className="mt-0.5 text-[13px] text-text-muted">{readings}</p>
            {/* The same honesty the kanji lesson owes its parts, in the one
                place kana owes anything: a dakuten row is not a new set of
                shapes, and saying so is the difference between five characters
                and five characters you already half know. */}
            {group.extended ? (
              <p className="mt-1.5 text-[11px] text-text-muted/80">
                Built from kana you&rsquo;ve already seen, with a mark added.
              </p>
            ) : null}
          </div>
          <p className="font-kana text-[34px] font-extralight leading-tight tracking-[3px] opacity-85">
            {chars.join("")}
          </p>
        </div>

        {/* Why hiragana first (or katakana next), before the where-to-learn and
            the Start below it. Compact and closed by default — it explains the
            language, not the app, so it belongs on screen; but it is a pull, so
            only the one line shows until the reader opens it. */}
        {why ? <WhyDisclosure why={why} /> : null}

        {/* Learn it, THEN be asked. "Teach me here" steps each character with
            its own mnemonic and how it's written, inside the app — the only door
            now, because kana is taught in-house. The guides the app learned kana
            from are credited on the Resources page, not linked from the drill.
            No box: this sits directly on the card. */}
        <div className="mt-4">
          {/* What the walk will actually do, which is not the same for every
              phase. A dakuten row is taught as ONE card — the mark, the rule,
              the five results — so promising a picture and a stroke diagram per
              character would be describing a screen that no longer exists. */}
          <p className="text-[13px]">
            <span className="font-medium">Learn them first.</span>{" "}
            <span className="text-text-muted">
              {conversion
                ? "One card: the mark, what it does to the sound, and all five at once — before you’re quizzed."
                : "Step through each one — its picture, its sound, and how it’s written — before you’re quizzed."}
            </span>
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Btn onClick={() => onTeach(lesson.facts)}>Teach me here</Btn>
          </div>
        </div>

        {/* The two intents, kept apart because they route apart. "Quiz me" is
            the go button — it marks the group seen and drills it. "I already
            know these" claims it and skips. See onQuizMe / onClaim above. */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Btn onClick={() => onClaim(lesson.facts)}>
              I already know {chars.length === 1 ? "this" : `these ${chars.length}`}
            </Btn>
            <Btn onClick={() => onClaim(setFacts(group.setId))}>
              I know all {group.setLabel.toLowerCase()}
            </Btn>
          </div>
          {/* The same scope fork the end of the lesson offers, because this is
              the same drill reached by the other door — skipping the teach walk
              shouldn't also skip the choice of how much to be asked. "These
              only" keeps the accent; the cumulative run is the offer beside it.
              See scriptSoFar() for what "so far" is allowed to mean.

              The fork collapses when the wider scope resolves to these same
              facts — the first group of a script, where there is nothing before
              it to accumulate. What's left is the ordinary "Quiz me", NOT one of
              the two scoped labels kept on alone: "Quiz me on these only" names
              a scope, and naming a scope implies the other one is somewhere on
              screen. With one set there is no scope to name. */}
          <div className="flex flex-wrap gap-1.5">
            {soFar ? (
              <>
                <Btn onClick={() => onQuizMe(soFar)}>
                  Quiz me on all {group.setLabel.toLowerCase()} so far
                </Btn>
                <Btn go onClick={() => onQuizMe(lesson.facts)}>
                  Quiz me on these only
                </Btn>
              </>
            ) : (
              <Btn go onClick={() => onQuizMe(lesson.facts)}>
                Quiz me
              </Btn>
            )}
          </div>
        </div>
      </Card>

      {/* What each intent actually does, in its own terms — neither is a score
          and neither is a promise. See src/lib/claims.ts. Dismissible and shared
          across every lesson card — seen once, then out of the way. */}
      <ClaimExplainer>
        Quiz me adds the group to your knowledge base and starts a drill — the
        drill keeps the score, not the button. Saying you already know a group
        adds it too, but skips the drill and takes it out of your way; the app
        takes your word now and checks back in a few months.
      </ClaimExplainer>
    </>
  );
}
