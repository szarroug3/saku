"use client";

// KANA entry — the redesigned Library page for one kana, on the content model.
//
// The reference "stuff" a kana page shows — the header (glyph, reading, standing,
// sound), then the drawing, the sound analogy, the story, the proving word — is
// read off the ITEM: its reading from the mnemonic, its memory hook from
// ContentItem.mnemonic. It reuses the shared header (EntryHeader) and mnemonic
// block (MnemonicView), the same components the shipped page and the lesson walk
// render, inside the glass entry surface.
//
// FETCHED BY ID by default — the Library route. The only genuinely heavy
// derivation a kana page reads is itemHeadline's {text, speak} — seeded per kana
// glyph by scripts/seed-content-entries.mjs and fetched here via useContentEntry.
// Everything else is already content-free or precomputed off library-index.ts:
// the mnemonic (data/mnemonics, keyed by glyph), the following-sound context
// (data/kana-context), the shape lookalikes (kanaConfusables), and the stroke
// fallback (precomputedStrokeFallback). typeLabel is the constant "kana"
// (contentTypeLabel's default branch for this kind — no need to fetch it).
//
// The teach walk (TeachItemView) and /dev/views already build a live
// `ContentItem` for every kind they show — they have the whole dictionary
// loaded regardless of kana — so passing `item` instead of `entry` skips the
// fetch. A live-only adapter computes itemHeadline and passes it here, keeping
// that dictionary dependency out of the Library route's shared renderer.
//
// SAK-72 PART A — A DERIVED (dakuten/handakuten) KANA COMPOSES ITS PAGE FROM
// ITS BASE, RATHER THAN GOING WITHOUT
// ============================================================================
// が has no row in MNEMONICS and no pair in LOOKALIKES (both deliberately —
// they are the base-kana tables), so before this it fell through to the plain
// header + generic stroke fallback SAK-14 left behind. が is not a new shape to
// learn, though: it is か plus one predictable mark, and the app already has
// two real sources for that relationship —
//
//   dakutenRowFor(glyph)         the k→g rule, the authored hook/aside, and the
//                                 pair [か, が] (data/dakuten-rows.ts)
//   derivedKanaConfusables(glyph) か plus any other kana marked off か
//                                 (lib/library/kana-family.ts)
//
// So `row`/`base` below are computed ONCE and feed both blocks, plus the
// Related section at the foot of the page. They are null/empty for a base
// kana (dakutenRowFor returns null), so these blocks are exactly as absent on
// か's own page as they were before — additive only.
//
// が's OWN stroke diagram (か's 3 strokes + the dakuten mark's own 2, both
// real KanjiVG data) is unaffected by any of this — see useGlyphStrokes in
// lib/strokes.ts. It was never gated on `row`; a derived kana just IS a
// single ingested glyph like any other.
//
// SAK-72 PART B — A YŌON KANA (きゃ) COMPOSES THE SAME WAY, ON A PARALLEL PATH
// ============================================================================
// きゃ is TWO Unicode codepoints (き + ゃ), not one precomposed glyph like が —
// dakutenRowFor never resolves it (see its own null case), so before this pass
// a yōon kana still fell through to nothing beyond the header. The shape of
// the fix is the same idea, two parallel sources instead of the dakuten ones:
//
//   yoonRowFor(glyph)            the [base, small] breakdown and reading
//                                 (data/yoon-rows.ts) — ONE shared rule
//                                 (COMBO_H/COMBO_K), not five per-row hooks,
//                                 because every yōon combo follows it alike
//   yoonConfusables(glyph)       base + full-size small kana + siblings
//                                 sharing the base (lib/library/kana-family.ts)
//
// `yoonRow` is computed once, null for every base and dakuten/handakuten kana
// (yoonRowFor only resolves the 72 taught combos), so this is exactly as
// additive as Part A. The two derived kinds are mutually exclusive — a glyph
// is never both a dakutenRowFor hit and a yoonRowFor hit — so `row` and
// `yoonRow` are never both non-null on the same page.
//
// CORRECTIONS AFTER LIVE REVIEW (same ticket, follow-up pass)
// ============================================================================
// Sam reviewed both parts live and asked for three changes, applied here:
//
//   1. NO stroke section at all for a yōon combo. She already knows how to
//      draw both of its component kana, so a diagram of the COMBO teaches
//      nothing new — unlike Part A's dakuten/handakuten diagrams, which are
//      real single-glyph KanjiVG data and stay exactly as they were. The
//      composed-diagram machinery Part B built for this (two-glyph
//      transform/compose in lib/strokes.ts and lib/svg-path.ts, the small
//      kana's own stroke ingestion) has been reverted along with it — nothing
//      else in the app used it.
//   2. NO base-mnemonic-reuse block (the "X's story, relabelled" strip that
//      used to sub in for a derived kana's missing mnemonic), on EITHER
//      derived path. It never earned its keep: showing the base's own
//      illustrated story under the derived glyph read as a second, thinner
//      mnemonic rather than a genuine aid. A derived kana's mnemonic block is
//      now simply absent, same as if it had never been drafted.
//   3. A real Related section (the same RelatedSection every other entry kind
//      uses) at the foot of the page, linking a derived kana to its real
//      components: for が that's か and the Dakuten mark page; for きゃ that's
//      き, the full-size や its small ゃ stands in for, and the Yōon term
//      page. This also makes each block's own inline "Built from X" link
//      redundant, so SoundShiftSection and ComboSection dropped theirs — one
//      link to the base per page, not two.

import { ConfusionSection } from "@/components/library/confusion-section";
import { ContentEntryHeader } from "@/components/library/content-entry-header";
import { Section } from "@/components/library/entry-section";
import { RelatedSection, type RelatedLink } from "@/components/library/related-section";
import { Callout } from "@/components/lesson/callout";
import { MnemonicView } from "@/components/lesson/mnemonic-view";
import { HowItsWritten } from "@/components/lesson/how-its-written";
import { Pair } from "@/components/lesson/conversion-card";
import { HearButton } from "@/components/ui/hear-button";
import { FlatSurfaceProvider } from "@/components/ui";
import { kanaEntry } from "@/data/characters";
import { dakutenRowFor, hookRuns, type DakutenRow } from "@/data/dakuten-rows";
import { markEntry } from "@/data/marks";
import { getMnemonic } from "@/data/mnemonics";
import { contextPronunciation } from "@/data/kana-context";
import { COMBO_H, COMBO_K } from "@/data/phase-intros";
import { termEntry } from "@/data/terms";
import { yoonRowFor, type YoonRow } from "@/data/yoon-rows";
import { useContentEntry } from "@/lib/library/content-entries";
import { derivedKanaConfusables, fullSizeOf, yoonConfusables } from "@/lib/library/kana-family";
import { getKanaAux, getLibEntry } from "@/lib/library/server-lookups";
import { useServerLookup } from "@/lib/library/use-server-lookup";
import { conceptReachable, kanaGlyphReachable } from "@/lib/library/reachable";
import { useHistory } from "@/lib/use-history";
import { useQuizConfig } from "@/lib/quiz-config";
import type { Headline } from "@/lib/content/headline";
import type { ContentItem } from "@/lib/content/item";
import type { EntryId } from "@/types";

/** Every confusable id here is minted by kanaEntry (`kana:${glyph}` —
 * data/characters.ts), so the glyph is read straight off the id rather than a
 * server round trip per candidate. */
function glyphOfKanaEntryId(id: EntryId): string {
  return (id as unknown as string).slice("kana:".length);
}

/** The rule + hook/aside block for a DERIVED kana — が's "k→g, the karate kick
 * smashes the garden gate" strip. Scoped to the one glyph on this page (a
 * single Pair, not the five-wide lesson strip), so it reads as a fact about
 * THIS character rather than a repeat of the mark's own Library page. Renders
 * nothing when `row` is null (a base kana never reaches this — see the call
 * site). No link back to the base here — the page's own RelatedSection
 * carries that link once, at the foot of the page, rather than twice. */
function SoundShiftSection({ glyph, base, row }: { glyph: string; base: string; row: DakutenRow | null }) {
  const { cfg } = useQuizConfig();
  if (!row) return null;
  const runs = hookRuns(row.hook);
  return (
    <Section title="Sound shift">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <Pair base={base} converted={glyph} voiceName={cfg.voiceName} />
        <p className="flex items-center gap-2.5 text-[22px] font-light leading-none text-text">
          <span>{row.from}</span>
          <span aria-hidden className="text-[15px] text-text-muted">
            &rarr;
          </span>
          <span className="text-accent">{row.to}</span>
        </p>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-text">
        A {row.markName} changes the sound of the consonant while the vowel stays the same.
      </p>
      {runs.length ? (
        <p className="mt-2.5 max-w-[52ch] text-[15px] leading-relaxed text-text">
          {runs.map((r, i) =>
            r.hit ? (
              <span key={i} className="font-medium text-accent">
                {r.text}
              </span>
            ) : (
              <span key={i}>{r.text}</span>
            ),
          )}
        </p>
      ) : null}
      {row.aside || row.callout ? (
        <div className="mt-3 space-y-3">
          {row.aside ? <Callout label="Note.">{row.aside}</Callout> : null}
          {row.callout ? <Callout label="Heads up.">{row.callout}</Callout> : null}
        </div>
      ) : null}
    </Section>
  );
}

/** The composition block for a YŌON kana — きゃ's "き + small ゃ, one beat"
 * strip. Structurally the same idea as SoundShiftSection (a breakdown row, a
 * rule statement, supporting text), but the rule and supporting text are NOT
 * retyped here: every one of the 72 taught combos follows the SAME rule,
 * already fully written once per script in data/phase-intros.ts (COMBO_H /
 * COMBO_K), so this reads that prose rather than authoring 36 near-duplicate
 * hooks the way Part A's five dakuten rows each needed their own. Renders
 * nothing when `row` is null (a base kana or a dakuten/handakuten kana never
 * reaches this — see the call site). No link back to the base here — the
 * page's own RelatedSection carries that link once, at the foot of the page,
 * rather than twice. */
function ComboSection({ glyph, row }: { glyph: string; row: YoonRow | null }) {
  const { cfg } = useQuizConfig();
  if (!row) return null;
  const intro = row.setId === "hiragana" ? COMBO_H : COMBO_K;
  // The one paragraph of COMBO_H/COMBO_K that is actually about telling きゃ
  // apart from きや (the "size is the whole tell" line) — reused verbatim,
  // rather than the whole card's copy, since the opening paragraph and the
  // "no new shapes" closer are written for the teach walk's pacing and would
  // read as filler on a single-glyph reference page.
  const sizeIsTheTell = intro.body.find((p) => p.lead === "The size is the whole tell.");
  return (
    <Section title="Composition">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <p className="flex items-baseline gap-2.5 text-[22px] font-light leading-none text-text">
          <span className="font-kana">{row.base}</span>
          <span aria-hidden className="text-[15px] text-text-muted">
            +
          </span>
          <span className="font-kana">{row.small}</span>
          <span aria-hidden className="text-[15px] text-text-muted">
            &rarr;
          </span>
          <span className="font-kana text-accent">{glyph}</span>
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] text-text-muted">{row.reading}, one beat</span>
          <HearButton glyph={glyph} voiceName={cfg.voiceName} />
        </div>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-text">{intro.title}</p>
      {sizeIsTheTell ? (
        <p className="mt-2.5 max-w-[52ch] text-[15px] leading-relaxed text-text">
          {sizeIsTheTell.text}
        </p>
      ) : null}
    </Section>
  );
}

/** One entry as a Related link, read off the batch `related` map fetched by
 * getKanaAux (SAK-104: label/href used to come from entryName/entryHref
 * directly). Null when the id somehow names no real entry, which
 * `.filter(isRelatedLink)` below drops rather than rendering a dead link. */
function relatedLink(
  id: EntryId,
  related: Record<string, { label: string; href: string; glyph: string }>,
): RelatedLink | null {
  const e = related[id as unknown as string];
  return e ? { label: e.label, href: e.href } : null;
}

function isRelatedLink(l: RelatedLink | null): l is RelatedLink {
  return l !== null;
}

export function KanaEntryView({
  entry,
  item,
  liveHeadline,
  gateToReachable = false,
}: {
  entry?: EntryId;
  item?: ContentItem;
  liveHeadline?: Headline;
  /** SAK-30 correction: this view is reused as BOTH the standalone Library
   * page (where confusables/related links must always show — か's own page
   * should show カ as a mix-up the moment katakana exists as a concept at
   * all, regardless of whether this learner has reached it yet) and inside
   * the in-lesson teach walk (where the original SAK-30 gate still applies —
   * a lesson must not link ahead of what it has taught). Defaults to false
   * ("show everything", the Library page's own behavior); only the teach
   * walk's call site (teach-item-view.tsx, via live-item-entry-views.tsx)
   * passes true. */
  gateToReachable?: boolean;
}) {
  const fetched = useContentEntry<Headline>(item ? null : (entry ?? null));
  const headline = item ? liveHeadline : fetched;
  // SAK-30: both the shape lookalikes below and the foot-of-page Related links
  // are cross-references the page draws BEFORE the learner asked for them, so
  // neither may point at material not yet reachable — see reachable.ts's own
  // header for what "reachable" means here (has the learner been SHOWN this
  // at all, not mastered it).
  const { history } = useHistory();
  // SAK-104: libEntry/kanaConfusables/precomputedStrokeFallback/entryHref/
  // entryName all live in server-only modules now. Two hooks, both called
  // unconditionally (React hook rules): the fallback-glyph lookup (skipped
  // once `item` already supplies it), then the batch of glyph-dependent
  // lookups below (skipped until the glyph is known).
  const fetchedEntry = useServerLookup(getLibEntry, item ? null : [entry!]);
  const glyph = item ? item.glyph : fetchedEntry?.glyph;
  const resolvedEntry = item ? item.entry : entry!;

  // The dakuten/handakuten row this glyph is the CONVERTED half of — null for
  // every base kana and every yōon glyph (dakutenRowFor only resolves the 50
  // single-codepoint dakuten/handakuten glyphs; yōon is handled separately
  // below, via yoonRowFor). `base` is the row's own base half, read off its
  // `pairs`, so it can never name a character the row itself doesn't teach.
  const row = glyph ? dakutenRowFor(glyph) : null;
  const base = row?.pairs.find(([, converted]) => converted === glyph)?.[0];
  // SAK-72 Part B: the yōon equivalent of `row`/`base` above.
  const yoonRow = glyph ? yoonRowFor(glyph) : null;
  const yoonFullSize = yoonRow ? fullSizeOf(yoonRow.small) : null;
  const relatedCandidateIds: EntryId[] =
    row && base
      ? [kanaEntry(base), markEntry(row.markName)]
      : yoonRow
        ? [
            kanaEntry(yoonRow.base),
            ...(yoonFullSize ? [kanaEntry(yoonFullSize)] : []),
            termEntry("yoon"),
          ]
        : [];
  const aux = useServerLookup(getKanaAux, glyph ? [glyph, relatedCandidateIds] : null);
  const strokeFallback = aux?.strokeFallback;
  const related = aux?.related ?? {};

  // undefined = still loading, null/no glyph = no such entry (matches the live
  // component's behavior for an unresolved id).
  if (headline === undefined || headline === null || !glyph || !strokeFallback) return null;

  // A derived kana (dakuten/handakuten/yōon — が, ぱ, きゃ …) has no row in
  // MNEMONICS: see that file's header, "a kana with no row here shows no
  // block." That is a rule for the ONE mnemonic block below, not license to
  // bail the whole page — the header, pronunciation context, confusables and
  // stroke-order sections are all independently correct for these glyphs, so
  // only the mnemonic div is conditional on `m`. UNLIKE the two Part A/B
  // drafts, there is no base-mnemonic fallback any more (Sam's correction,
  // see this file's header): a derived kana simply has no mnemonic block
  // rather than a reused, relabelled one.
  const m = getMnemonic(glyph);
  const context = contextPronunciation(glyph);
  // How its sound bends to what follows it (ん borrows the next place, っ
  // doubles the next consonant) — the content of MnemonicView's `soundNote`
  // slot (SAK-179: this used to also render, verbatim, as its own standalone
  // "Heads up." section further down the page — a second call-out repeating
  // the first, from a completely separate system. Built once here and reused
  // by whichever of the two spots below actually needs it). Spans, not
  // block-level p/div, because this is going to sit inside <Callout>'s own
  // <p> (either directly, in MnemonicView, or in the no-mnemonic fallback
  // right below) and a div/p nested in a p gets silently hoisted out of the
  // callout's left-rule border by the browser's own parser.
  const soundNote = context ? (
    <>
      {context.summary}
      <span className="mt-2.5 flex flex-col gap-1.5">
        {context.rules.map((rule) => (
          <span key={rule.when} className="block text-[13px] leading-relaxed text-text-muted">
            <span className="text-text">{rule.when}</span> &rarr; said{" "}
            <span className="font-medium text-accent">{rule.sounds}</span>
            <span className="ml-1.5 font-kana">{rule.example}</span>
          </span>
        ))}
      </span>
    </>
  ) : null;

  // Base-kana lookalikes (kanaConfusables, from the hand-curated LOOKALIKES
  // table) plus, for a derived kana, its own family — the base plus any other
  // kana marked off that same base (は/ば/ぱ), or, for a yōon combo, its base
  // plus the full-size version of its small kana plus its sibling combos
  // (きゃ/きゅ/きょ). The three sources are mutually exclusive today (LOOKALIKES
  // names no derived glyph; derivedKanaConfusables and yoonConfusables are
  // each empty outside their own glyph shape), so this is a plain merge, not a
  // fallback chain.
  // SAK-30: か's "commonly mixed up with" showed カ before katakana had been
  // introduced at all. Each candidate is a kana entry (kana:<glyph>), so it
  // gates on that GLYPH's OWN script's track — カ waits for the katakana
  // track, not for カ itself to have been met (kanaGlyphReachable's own doc
  // says why: a lookalike call-out that only fired after the exact glyph was
  // already met could never warn about a mix-up before it happened).
  const confusables = [
    ...new Set([
      ...(aux?.kanaConfusableIds ?? []),
      ...derivedKanaConfusables(glyph),
      ...yoonConfusables(glyph),
    ]),
  ].filter((id) => {
    if (!gateToReachable) return true;
    return kanaGlyphReachable(glyphOfKanaEntryId(id), history);
  });

  // The foot-of-page "Related" links — the real components a derived kana is
  // built from, so a reader can tap straight to them instead of hunting the
  // Library for か or Yōon. Empty (and RelatedSection renders nothing) for a
  // base kana, where row and yoonRow are both null. The two branches are
  // mutually exclusive by construction (see `row`/`yoonRow` above), so this
  // is never a merge of both.
  //
  // Dakuten/handakuten: the base kana, plus the mark's own Writing-rules page
  // (row.markName is already "dakuten" or "handakuten" — markEntry's own id).
  // Yōon: the base kana, the FULL-SIZE version of the small kana (きゃ → や,
  // not ゃ — reusing kana-family.ts's own fullSizeOf rather than re-deriving
  // it), and the Yōon term page.
  // SAK-30: the Hiragana term card linked Katakana and Dakuten at lesson-1
  // card-2, before a single hiragana character had been taught. Each link
  // below is gated the same way: the base kana on its OWN script's track
  // (kanaGlyphReachable), the mark on the decoration concept it names
  // (conceptReachable — "dakuten"/"handakuten" are not tracks of their own,
  // see that function's doc), the Yōon term on the "yoon" concept (unnamed by
  // SAK-30, so `conceptReachable` leaves it ungated, same as before).
  const relatedLinks: RelatedLink[] = (
    row && base
      ? [
          !gateToReachable || kanaGlyphReachable(base, history)
            ? relatedLink(kanaEntry(base), related)
            : null,
          !gateToReachable || conceptReachable(row.markName, history)
            ? relatedLink(markEntry(row.markName), related)
            : null,
        ]
      : yoonRow
        ? [
            !gateToReachable || kanaGlyphReachable(yoonRow.base, history)
              ? relatedLink(kanaEntry(yoonRow.base), related)
              : null,
            yoonFullSize && (!gateToReachable || kanaGlyphReachable(yoonFullSize, history))
              ? relatedLink(kanaEntry(yoonFullSize), related)
              : null,
            !gateToReachable || conceptReachable("yoon", history)
              ? relatedLink(termEntry("yoon"), related)
              : null,
          ]
        : []
  ).filter(isRelatedLink);

  return (
    // NO CARD: the entry reads as a natural part of the page — a plain, unstyled
    // <article> (semantic anchor, no fill/border). Flat surface so the shared
    // "How it's written" section drops its own card fill.
    <FlatSurfaceProvider>
      <article>
        <ContentEntryHeader glyph={glyph} headline={headline} typeLabel="kana" />
        {/* Derived-kana only: the k→g-style rule and its hook/aside. Absent for
            a base kana (row is null) and for a yōon glyph (dakutenRowFor only
            resolves the 50 single-codepoint dakuten/handakuten glyphs —
            ComboSection right below is yōon's equivalent block). */}
        {row && base ? <SoundShiftSection glyph={glyph} base={base} row={row} /> : null}
        {/* Yōon-only: the "き + small ゃ, one beat" composition rule. Absent for
            a base kana and for a dakuten/handakuten kana (yoonRowFor only
            resolves the 72 taught combos) — row/yoonRow are never both
            non-null, so this and SoundShiftSection above never both render. */}
        {yoonRow ? <ComboSection glyph={glyph} row={yoonRow} /> : null}
        {/* Only when this glyph has its OWN mnemonic — a base kana. No reused,
            relabelled base-mnemonic block for a derived kana any more (Sam's
            correction): the learner already knows the base's shape, and a
            second, thinner story under a different reading wasn't earning
            its keep. */}
        {m ? (
          <div className="mt-5 border-t border-border/50 pt-6">
            {/* soundNote (ん/ン's context rules) renders right under the
                analogy line, in the same slot は/へ's particle-reading note
                uses (SAK-179) — one "Heads up.", not the two this page used
                to show. undefined, not null, when this glyph carries no
                context rule (every kana but ん/ン/っ/ッ), matching every
                other optional MnemonicView prop. */}
            <MnemonicView m={m} glyph={glyph} soundNote={soundNote ?? undefined} />
          </div>
        ) : null}
        {/* Fallback for a context kana with NO mnemonic of its own — っ/ッ,
            the sokuon, which has no row in MNEMONICS (see that file's
            header) so the block above never renders. ん/ン both have a
            mnemonic and get their Heads-up note through the soundNote slot
            above instead, so this and that block are never both showing the
            same content — see this file's `m` check. */}
        {!m && soundNote ? (
          <div className="mt-5">
            <Callout>{soundNote}</Callout>
          </div>
        ) : null}
        {/* Shape lookalikes, above the stroke diagram — the reference before the
            "how to draw it" that closes the page. */}
        <ConfusionSection confusables={confusables} glyph={glyph} />
        {/* Collapsed by default, like every other page: the "we don't recommend
            learning to write early" notice, Show expands the stroke diagram.
            ABSENT for a yōon combo (yoonRow non-null — Sam's correction): she
            already knows how to draw both of its component kana, so a
            diagram of the two-glyph COMBO teaches nothing new. Dakuten/
            handakuten (row non-null, real single-glyph KanjiVG data) and
            base kana are unaffected — this only removes the section for the
            one shape that never had a real diagram to begin with. */}
        {yoonRow ? null : (
          <div className="mt-5 border-t border-border/50 pt-5">
            <HowItsWritten
              item={{ entry: resolvedEntry, glyph, kind: "kana", facts: [] }}
              precomputedFallback={strokeFallback}
            />
          </div>
        )}
        {/* The real components this derived kana is built from — absent for a
            base kana, where relatedLinks is empty. Bottom of the page, after
            confusables/stroke-order, matching where every other entry kind
            (see term-entry-view.tsx) puts its own RelatedSection. */}
        <RelatedSection links={relatedLinks} />
      </article>
    </FlatSurfaceProvider>
  );
}
