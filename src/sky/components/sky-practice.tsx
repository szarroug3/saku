"use client";

// Practice: describe a deck, see what it holds, run it. Tracked as SAK-318
// to SAK-322.
//
// The left column is the recipe (SAK-319): what to draw from, what standing
// it should have, whether only things missed before, a radical it must be
// built from, what to be asked for, how many, and whether the choices may
// ever be offered. Presets and saved decks are recipes under a name
// (SAK-321), so a saved deck changes as the learner does. The right column
// is the deck the recipe resolves to now (SAK-320), shakiest first, with
// every item droppable and every edge case said out loud. Nothing here
// touches the review schedule (SAK-318): the run's answers go to whoever
// the route hands in, and the page says so at the top.

import { useEffect, useRef, useState } from "react";

import { SkyButton, SkyChip } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkyInput } from "@/sky/components/sky-input";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";
import { japaneseFont } from "@/sky/lib/japanese";
import { ASK, ASKS, cannotStart, DECK_SIZES, describe, EMPTY_RECIPE, PRESETS, shortfall, type Deck, type DeckSize, type PracticeCollection, type PracticeMisses, type PracticePreview, type Recipe } from "@/sky/lib/practice";
import { STANDING, STANDING_ORDER } from "@/sky/lib/standing";

export interface SkyPracticeProps {
  collections: readonly PracticeCollection[];
  /** The recipe resolved, now. */
  lookup: (recipe: Recipe, misses: PracticeMisses) => Promise<PracticePreview>;
  /** The page's first preview, for the recipe it opens on. */
  initial: { recipe: Recipe; preview: PracticePreview };
  /** Practice's own misses, kept by the route (never the schedule). */
  misses: PracticeMisses;
  /** The learner's saved decks, and how to change them. */
  decks: readonly Deck[];
  onDecks: (decks: readonly Deck[]) => void;
  /** Starts the run. */
  onStart: (recipe: Recipe, dropped: readonly string[]) => void;
  /** A recipe handed back from a run to save. */
  toSave?: Recipe;
  height?: string;
}

const LOOKUP_DELAY = 150;

const same = (a: Recipe, b: Recipe) => JSON.stringify(a) === JSON.stringify(b);

export function SkyPractice({ collections, lookup, initial, misses, decks, onDecks, onStart, toSave, height }: SkyPracticeProps) {
  const [recipe, setRecipe] = useState<Recipe>(toSave ?? initial.recipe);
  // the preview the route resolved for the opening recipe serves as long as
  // the recipe is that one; anything else is looked up
  const [fetched, setFetched] = useState<{ recipe: Recipe; preview: PracticePreview } | null>(null);
  const preview: PracticePreview | null = same(recipe, initial.recipe) ? initial.preview : fetched && same(fetched.recipe, recipe) ? fetched.preview : null;
  const [dropped, setDropped] = useState<readonly string[]>([]);
  const [undo, setUndo] = useState<{ id: string; name: string } | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(!!toSave);
  const [renaming, setRenaming] = useState<{ name: string; to: string } | null>(null);
  const asked = useRef(0);

  // the preview follows the recipe, after a beat, and never lands out of order
  useEffect(() => {
    if (same(recipe, initial.recipe)) return;
    const n = ++asked.current;
    const t = setTimeout(() => { lookup(recipe, misses).then((p) => { if (n === asked.current) setFetched({ recipe, preview: p }); }); }, LOOKUP_DELAY);
    return () => clearTimeout(t);
  }, [recipe, misses, lookup, initial]);

  const set = (change: Partial<Recipe>) => { setRecipe({ ...recipe, ...change }); setDropped([]); setUndo(null); };
  const toggle = <T,>(list: readonly T[], x: T): T[] => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

  const kept = preview ? preview.items.filter((p) => !dropped.includes(p.item.id)) : [];
  const blocked = cannotStart(recipe, preview, kept.length);
  const short = preview ? shortfall(recipe, preview) : null;
  const kanjiInPlay = recipe.collections.length === 0 || recipe.collections.some((c) => c === "kanji" || c === "words");
  const chosen = decks.find((d) => same(d.recipe, recipe)) ?? PRESETS.find((d) => same(d.recipe, recipe));

  const drop = (id: string, name: string) => { setDropped([...dropped, id]); setUndo({ id, name }); };
  const save = () => {
    const name = saveName.trim();
    if (!name) return;
    onDecks([...decks.filter((d) => d.name !== name), { name, recipe }]);
    setSaveName(""); setSaving(false);
  };

  return (
    <SkyPageShell eyebrow="Practice" title="Practice" lede="Practice is never recorded against your review schedule. Miss everything here and not one interval moves." height={height}>
      <div className="grid min-h-0 flex-1 gap-4 font-sky-ui lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SkyPanel title="The recipe" className="flex min-h-0 flex-col overflow-y-auto">
          <Facet title="Start from">
            {PRESETS.map((d) => <SkyChip key={d.name} on={chosen?.name === d.name} onClick={() => set(d.recipe)}>{d.name}</SkyChip>)}
            {decks.map((d) => <SkyChip key={d.name} on={chosen?.name === d.name} onClick={() => set(d.recipe)} title="A deck you saved">{d.name}</SkyChip>)}
            <SkyChip on={!chosen && same(recipe, EMPTY_RECIPE)} onClick={() => set(EMPTY_RECIPE)}>Everything</SkyChip>
          </Facet>
          <Facet title="Draw from" note={recipe.collections.length ? undefined : "Everything, until you pick a collection."}>
            {collections.map((c) => <SkyChip key={c.id} on={recipe.collections.includes(c.id)} onClick={() => set({ collections: toggle(recipe.collections, c.id) })}>{c.title} · {c.total.toLocaleString()}</SkyChip>)}
          </Facet>
          <Facet title="Only things that are" note={recipe.statuses.length ? undefined : "Any standing, until you pick one."}>
            {STANDING_ORDER.map((s) => <SkyChip key={s} on={recipe.statuses.includes(s)} onClick={() => set({ statuses: toggle(recipe.statuses, s) })} className="capitalize">{STANDING[s].label}</SkyChip>)}
            <SkyChip on={recipe.missedOnly} onClick={() => set({ missedOnly: !recipe.missedOnly })} className={recipe.missedOnly ? "!border-sky-shaky !bg-sky-shaky !text-sky-gold-ink" : "!border-sky-shaky/60 !text-sky-shaky"}>Only ones I have missed</SkyChip>
          </Facet>
          {kanjiInPlay && (
            <Facet title="Built from" note="A radical every kanji, and every word written with one, must be built from.">
              <SkyChip on={recipe.component === null} onClick={() => set({ component: null })}>Any</SkyChip>
              {(preview?.components ?? []).map((c) => <SkyChip key={c.glyph} on={recipe.component === c.glyph} onClick={() => set({ component: recipe.component === c.glyph ? null : c.glyph })} className={japaneseFont(c.glyph)}>{c.glyph} · {c.count}</SkyChip>)}
              {recipe.component && !(preview?.components ?? []).some((c) => c.glyph === recipe.component) && <SkyChip on onClick={() => set({ component: null })} className={japaneseFont(recipe.component)}>{recipe.component}</SkyChip>}
            </Facet>
          )}
          <Facet title="Ask me for">
            {ASKS.map((a) => {
              const can = preview ? preview.asksAvailable[a] : true;
              return <SkyChip key={a} on={recipe.asks.includes(a)} disabled={!can} title={can ? ASK[a].meaning : "Nothing in this deck can be asked that way."} onClick={() => set({ asks: toggle(recipe.asks, a) })}>{ASK[a].label}</SkyChip>;
            })}
          </Facet>
          <Facet title="How many">
            {DECK_SIZES.map((n) => <SkyChip key={String(n)} on={recipe.size === n} onClick={() => set({ size: n as DeckSize })}>{n === "all" ? "All of them" : n}</SkyChip>)}
          </Facet>
          <Facet title="Difficulty">
            <SkyChip on={recipe.noNarrowing} onClick={() => set({ noNarrowing: !recipe.noNarrowing })} title="The choices are never offered on a typed card.">No narrowing down</SkyChip>
          </Facet>
          <Facet title="Saved decks" note={decks.length ? undefined : "A saved deck keeps the recipe, not today's list, so it changes as you do."}>
            {decks.length > 0 && (
              <ul className="flex w-full flex-col gap-1">
                {decks.map((d) => (
                  <li key={d.name} className="flex flex-wrap items-center gap-2 text-[13px]">
                    {renaming?.name === d.name ? (
                      <>
                        <SkyInput value={renaming.to} onChange={(e) => setRenaming({ ...renaming, to: e.target.value })} className="flex-1 !py-1 text-[13px]" />
                        <SkyButton onClick={() => { const to = renaming.to.trim(); if (to) onDecks(decks.map((x) => (x.name === d.name ? { ...x, name: to } : x))); setRenaming(null); }}>Rename</SkyButton>
                        <SkyButton variant="outline" onClick={() => setRenaming(null)}>Cancel</SkyButton>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => set(d.recipe)} className="text-left font-semibold text-sky-ink hover:text-sky-accent">{d.name}</button>
                        <span className="text-sky-muted">{describe(d.recipe, collections)}</span>
                        <span className="ml-auto flex gap-3 text-[12px] text-sky-muted">
                          <button type="button" className="underline hover:text-sky-ink" onClick={() => setRenaming({ name: d.name, to: d.name })}>Rename</button>
                          <button type="button" className="underline hover:text-sky-coral" onClick={() => onDecks(decks.filter((x) => x.name !== d.name))}>Delete</button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {saving ? (
              <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
                <SkyInput value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="A name for this recipe" className="flex-1 !py-1.5 text-[14px]" autoFocus />
                <SkyButton onClick={save} disabled={!saveName.trim()}>Save</SkyButton>
                <SkyButton variant="outline" onClick={() => setSaving(false)}>Cancel</SkyButton>
              </form>
            ) : (
              <SkyButton variant="outline" onClick={() => setSaving(true)}>Save this recipe</SkyButton>
            )}
          </Facet>
        </SkyPanel>

        <SkyPanel title="What you would get" className="flex min-h-0 flex-col">
          <p className="mt-2 shrink-0 text-[13px] text-sky-muted">{describe(recipe, collections)}</p>
          <p className="mt-2 shrink-0 text-[14px]">
            <span className="font-semibold text-sky-ink">{preview ? kept.length.toLocaleString() : "…"}</span> {kept.length === 1 ? "item" : "items"}
            {preview && preview.matched > preview.items.length && recipe.size !== "all" && <span className="text-sky-muted"> of {preview.matched.toLocaleString()} that match</span>}
          </p>
          {short && <p className="mt-1 shrink-0 text-[13px] text-sky-shaky">{short}</p>}
          {blocked && preview && <p className="mt-1 shrink-0 text-[13px] text-sky-slipping">{blocked}</p>}
          {undo && (
            <p className="mt-1 shrink-0 text-[12.5px] text-sky-muted">
              Dropped {undo.name}. <button type="button" className="underline hover:text-sky-ink" onClick={() => { setDropped(dropped.filter((id) => id !== undo.id)); setUndo(null); }}>Put it back</button>
            </p>
          )}
          <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {kept.map((p) => (
              <li key={p.item.id} className="grid grid-cols-[6rem_1fr_auto_auto] items-baseline gap-x-3 rounded-lg px-2 py-1.5 hover:bg-sky-card">
                <span className={`truncate font-sky-display text-[18px] leading-none ${STANDING[p.item.standing].text} ${japaneseFont(p.item.glyph)}`}>{p.item.glyph}</span>
                <span className="truncate text-[13px] text-sky-ink/90">{p.item.english !== p.item.glyph ? p.item.english : ""}</span>
                <span className="text-[12px] text-sky-shaky">{p.misses > 0 ? `missed ${p.misses} ${p.misses === 1 ? "time" : "times"}` : ""}</span>
                <button type="button" aria-label={`Drop ${p.item.english}`} onClick={() => drop(p.item.id, p.item.english)} className="text-[14px] leading-none text-sky-muted hover:text-sky-coral">×</button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex shrink-0 flex-wrap items-center gap-3">
            <SkyButton disabled={!!blocked} onClick={() => onStart(recipe, dropped)}>Start · {kept.length}</SkyButton>
            {blocked && <span className="text-[12.5px] text-sky-muted">{blocked}</span>}
          </div>
        </SkyPanel>
      </div>
    </SkyPageShell>
  );
}

function Facet({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-2">
      <Eyebrow>{title}</Eyebrow>
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {note && <p className="mt-1.5 text-[12px] text-sky-muted">{note}</p>}
    </div>
  );
}
