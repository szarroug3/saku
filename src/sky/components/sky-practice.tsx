"use client";

// Practice: describe a deck, see what it holds, run it. Tracked as SAK-318
// to SAK-322.
//
// The left column is the recipe (SAK-319): what to draw from, what standing
// it should have, what to be asked for, and how many. A collection with
// named parts (kana by script and row type, grammar by form, counting,
// keigo) has a menu of them on its chip. Saved recipes (SAK-321) are recipes under
// a name, so a saved one changes as the learner does; they show only once
// there are any. The right column is the deck the recipe resolves to now
// (SAK-320), shakiest first, with every item droppable and every edge case
// said out loud. Nothing here touches the review schedule (SAK-318): the
// run's answers go to whoever the route hands in, and the page says so at
// the top.

import { useEffect, useRef, useState } from "react";

import { ChipRow } from "@/sky/components/chip-row";
import { InlineAsk } from "@/sky/components/inline-ask";
import { RecipeNameForm } from "@/sky/components/recipe-name-form";
import { SkyButton, SkyChip } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkyInfo } from "@/sky/components/sky-info";
import { SkyInput } from "@/sky/components/sky-input";
import { SkyMenuChip } from "@/sky/components/sky-menu-chip";
import { SkyStepper } from "@/sky/components/sky-stepper";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";
import { UndoLine } from "@/sky/components/undo-line";
import { japaneseFont } from "@/sky/lib/japanese";
import { ASK, ASKS, cannotStart, cutsOf, deckSize, DEFAULT_SIZE, recipeKey, recipeSummary, sameRecipe, shortfall, type PracticeCollection, type PracticeMisses, type PracticePreview, type Recipe, type SavedRecipe } from "@/sky/lib/practice";
import { STANDING, STANDING_ORDER, standingWord } from "@/sky/lib/standing";

export interface SkyPracticeProps {
  collections: readonly PracticeCollection[];
  /** The recipe resolved, now. */
  lookup: (recipe: Recipe, misses: PracticeMisses) => Promise<PracticePreview>;
  /** The page's first preview, for the recipe it opens on. */
  initial: { recipe: Recipe; preview: PracticePreview };
  /** Practice's own misses, kept by the route (never the schedule). */
  misses: PracticeMisses;
  /** The learner's saved recipes, and how to change them. */
  saved: readonly SavedRecipe[];
  onSaved: (saved: readonly SavedRecipe[]) => void;
  /** Starts the run. */
  onStart: (recipe: Recipe) => void;
  /** A recipe handed back from a run to save. */
  height?: string;
}

const LOOKUP_DELAY = 150;

// Two recipes that describe the same deck are one recipe, whatever order the
// chips were clicked in (SAK-372). `sameRecipe` and `recipeKey` live in
// lib/practice.ts, with the reason written out there.
const same = sameRecipe;

export function SkyPractice({ collections, lookup, initial, misses, saved, onSaved, onStart, height }: SkyPracticeProps) {
  const [recipe, setRecipe] = useState<Recipe>(initial.recipe);
  // the preview is looked up for the recipe without what is left out by
  // hand: leaving an item out is then a filter on what is already here, with
  // no round trip. The route's own preview serves for the opening recipe;
  // while a new one is on its way the last one stays on screen, so nothing
  // blinks (Sam, 2026-09-06).
  const base: Recipe = { ...recipe, excluded: [] };
  const [fetched, setFetched] = useState<{ recipe: Recipe; preview: PracticePreview } | null>(null);
  const fresh: PracticePreview | null = same(base, initial.recipe) ? initial.preview : fetched && same(fetched.recipe, base) ? fetched.preview : null;
  const loading = !fresh;
  const shown = fresh ?? fetched?.preview ?? initial.preview;
  // the last item left out, offered back
  const [undo, setUndo] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  // the saved recipe the Delete link is asking about
  const [dropping, setDropping] = useState(false);
  // the last number asked for, remembered for when "Limited" is picked
  // again after "All of them"
  const [count, setCount] = useState(typeof initial.recipe.size === "number" ? initial.recipe.size as number : DEFAULT_SIZE);
  // the saved recipe the page is working from, by name; it stays chosen as
  // the recipe drifts, so the drift can be written back to it
  const [loaded, setLoaded] = useState<string | null>(null);
  const asked = useRef(0);

  // the preview follows the recipe, after a beat, and never lands out of
  // order. The key is the recipe written one way, so a recipe that only
  // changed the order of a list does not send the page back for a preview it
  // already has; parsing it gives back a recipe that draws the same deck.
  const baseKey = recipeKey(base);
  useEffect(() => {
    const wanted = JSON.parse(baseKey) as Recipe;
    if (same(wanted, initial.recipe)) return;
    const n = ++asked.current;
    const t = setTimeout(() => { lookup(wanted, misses).then((p) => { if (n === asked.current) setFetched({ recipe: wanted, preview: p }); }); }, LOOKUP_DELAY);
    return () => clearTimeout(t);
  }, [baseKey, misses, lookup, initial]);

  const set = (change: Partial<Recipe>) => { setRecipe({ ...recipe, ...change }); setUndo(null); };
  const toggle = <T,>(list: readonly T[], x: T): T[] => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  // a collection turned off forgets its cuts, so the recipe reads as it looks
  const toggleCollection = (id: string) => {
    const { [id]: _gone, ...rest } = recipe.cuts ?? {};
    set({ collections: toggle(recipe.collections, id), cuts: recipe.collections.includes(id) ? rest : recipe.cuts ?? {} });
  };
  // picking a cut of a collection that is off turns it on
  const toggleCut = (collection: string, id: string) => {
    const next = toggle(cutsOf(recipe, collection), id);
    const { [collection]: _old, ...rest } = recipe.cuts ?? {};
    set({ cuts: next.length ? { ...rest, [collection]: next } : rest, collections: recipe.collections.includes(collection) ? recipe.collections : [...recipe.collections, collection] });
  };

  const excluded = recipe.excluded ?? [];
  const kept = shown.items.filter((p) => !excluded.includes(p.item.id));
  // the pool the deck is drawn from: everything that matches, less what is
  // left out by hand (counted among the listed; the run counts exactly)
  const pool = shown.matched - (shown.items.length - kept.length);
  const unseen = shown.matched - shown.items.length;
  const size = deckSize(recipe, pool);
  const preview: PracticePreview = { ...shown, items: kept, matched: pool };
  const blocked = cannotStart(recipe, preview);
  const short = shortfall(recipe, pool);
  const chosen = (loaded && saved.find((d) => d.name === loaded)) || saved.find((d) => same(d.recipe, recipe));
  const changed = !!chosen && !same(chosen.recipe, recipe);

  // leaving an item out is a change to the recipe, so a saved one can take it
  const drop = (id: string, name: string) => { setRecipe({ ...recipe, excluded: [...excluded, id] }); setUndo({ id, name }); };
  const restore = (ids: readonly string[]) => set({ excluded: excluded.filter((id) => !ids.includes(id)) });
  const save = (name: string) => {
    onSaved([...saved.filter((d) => d.name !== name), { name, recipe }]);
    setLoaded(name); setSaving(false);
  };
  const update = () => { if (chosen) onSaved(saved.map((x) => (x.name === chosen.name ? { ...x, recipe } : x))); };
  const remove = () => { if (chosen) onSaved(saved.filter((x) => x.name !== chosen.name)); setLoaded(null); };
  const rename = (from: string) => {
    const to = renaming?.trim();
    if (to && to !== from) { onSaved(saved.map((x) => (x.name === from ? { ...x, name: to } : x))); setLoaded(to); }
    setRenaming(null);
  };
  const load = (d: SavedRecipe) => { set(d.recipe); setLoaded(d.name); };

  return (
    <SkyPageShell eyebrow="Practice" title="What would you like to practice?" height={height}>
      <div className="grid min-h-0 flex-1 gap-4 font-sky-ui lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SkyPanel title="The recipe" className="flex min-h-0 flex-col overflow-y-auto">
          {saved.length > 0 && (
            <Facet title="Saved recipes">
              {/* a saved recipe carries what it draws from, the way a
                  collection's chip carries its count: "Everything" says
                  nothing about itself until you read every other chip
                  (SAK-372) */}
              {saved.map((d) => <SkyChip key={d.name} on={chosen?.name === d.name} onClick={() => load(d)} title={recipeSummary(d.recipe, collections)} className={japaneseFont(d.name)}>{d.name}</SkyChip>)}
              {chosen && (
                renaming !== null ? (
                  <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); rename(chosen.name); }}>
                    <SkyInput value={renaming} onChange={(e) => setRenaming(e.target.value)} className="flex-1 !py-1 text-[13px]" autoFocus />
                    <SkyButton onClick={() => rename(chosen.name)} disabled={!renaming.trim()}>Rename</SkyButton>
                    <SkyButton variant="outline" onClick={() => setRenaming(null)}>Cancel</SkyButton>
                  </form>
                ) : dropping ? (
                  // it asks now, like every other thing that cannot be got
                  // back (SAK-364); it used to delete on the click
                  <InlineAsk className="w-full" what="This recipe goes for good." confirm="Delete it" onConfirm={() => { remove(); setDropping(false); }} onKeep={() => setDropping(false)} />
                ) : (
                  <span className="flex w-full gap-3 text-[12px] text-sky-muted">
                    <button type="button" className="underline hover:text-sky-ink" onClick={() => setRenaming(chosen.name)}>Rename</button>
                    <button type="button" className="underline hover:text-sky-coral" onClick={() => setDropping(true)}>Delete</button>
                  </span>
                )
              )}
            </Facet>
          )}
          <Facet title="Draw from">
            {collections.map((c) => {
              const on = recipe.collections.includes(c.id);
              const total = `${c.total.toLocaleString()} to draw from`;
              if (!c.cuts) return <SkyChip key={c.id} on={on} onClick={() => toggleCollection(c.id)} title={total}>{c.title}</SkyChip>;
              const cutIds = cutsOf(recipe, c.id);
              const groups = [...new Set(c.cuts.map((cut) => cut.group ?? ""))];
              const menu = (
                <div className="flex flex-col gap-2.5">
                  {groups.map((g) => (
                    <div key={g}>
                      {g && <Eyebrow>{g}</Eyebrow>}
                      <ChipRow>
                        {c.cuts!.filter((cut) => (cut.group ?? "") === g).map((cut) => <SkyChip key={cut.id} on={cutIds.includes(cut.id)} onClick={() => toggleCut(c.id, cut.id)} className={japaneseFont(cut.label)}>{cut.label}</SkyChip>)}
                      </ChipRow>
                    </div>
                  ))}
                </div>
              );
              const names = cutIds.map((id) => c.cuts!.find((x) => x.id === id)?.label ?? id).join(", ");
              return <SkyMenuChip key={c.id} on={on} onClick={() => toggleCollection(c.id)} title={names ? `${c.title}: ${names}` : total} marked={cutIds.length > 0} menuLabel={`Which ${c.title.toLowerCase()}`} menu={menu}>{c.title}</SkyMenuChip>;
            })}
          </Facet>
          <Facet title="Only things that are">
            {STANDING_ORDER.map((s) => <SkyChip key={s} on={recipe.statuses.includes(s)} onClick={() => set({ statuses: toggle(recipe.statuses, s) })}>{standingWord(s)}</SkyChip>)}
          </Facet>
          <Facet title="Ask me for">
            {ASKS.map((a) => {
              const can = preview.asksAvailable[a];
              return <SkyChip key={a} on={recipe.asks.includes(a)} disabled={!can} title={can ? ASK[a].meaning : `Nothing in this deck can be asked that way. ${ASK[a].meaning}`} onClick={() => set({ asks: toggle(recipe.asks, a) })}>{ASK[a].label}</SkyChip>;
            })}
          </Facet>
          <Facet title="How many">
            <SkyChip on={recipe.size !== "all"} onClick={() => set({ size: count })}>Limited</SkyChip>
            <SkyChip on={recipe.size === "all"} onClick={() => set({ size: "all" })}>All of them</SkyChip>
            {recipe.size !== "all" && <SkyStepper value={recipe.size} onChange={(n) => { setCount(n); set({ size: n }); }} label="How many" />}
          </Facet>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {saving ? (
              <RecipeNameForm taken={saved.map((d) => d.name)} onSave={save} onCancel={() => setSaving(false)} />
            ) : chosen && changed ? (
              <>
                <SkyButton onClick={update}>Update {chosen.name}</SkyButton>
                <SkyButton variant="outline" onClick={() => setSaving(true)}>Save as new</SkyButton>
              </>
            ) : (
              <SkyButton variant="outline" onClick={() => setSaving(true)} disabled={!!chosen}>{chosen ? `Saved as ${chosen.name}` : "Save this recipe"}</SkyButton>
            )}
            {!saving && <SkyInfo className="ml-1.5" label="What a saved recipe keeps">A saved recipe keeps the recipe, not today&apos;s list, so it changes as you do.</SkyInfo>}
          </div>
        </SkyPanel>

        <SkyPanel title="What you would get" fit>
          <p className="mt-2 shrink-0 text-[14px]">
            <span className="font-semibold text-sky-ink">{size.toLocaleString()}</span> {size === 1 ? "item" : "items"}
            {recipe.size !== "all" && pool > size && <span className="text-sky-muted">, drawn at random from the {pool.toLocaleString()} below</span>}
          </p>
          {short && <p className="mt-1 shrink-0 text-[13px] text-sky-shaky">{short}</p>}
          {blocked && !loading && <p className="mt-1 shrink-0 text-[13px] text-sky-slipping">{blocked}</p>}
          {undo ? (
            <UndoLine
              className="mt-1 shrink-0"
              what={`Left out ${undo.name}`}
              onUndo={() => restore([undo.id])}
              also={excluded.length > 1 ? { label: `Undo all ${excluded.length}`, onClick: () => restore(excluded) } : undefined}
            />
          ) : excluded.length > 0 ? (
            // not the last thing you did any more, so it says what it is and
            // gives it its own verb rather than "Undo"
            <UndoLine
              className="mt-1 shrink-0"
              what={`${excluded.length === 1 ? "One item" : `${excluded.length} items`} left out by hand`}
              label={excluded.length === 1 ? "Put it back" : "Put them back"}
              onUndo={() => restore(excluded)}
            />
          ) : null}
          <ul className={`mt-4 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto transition-opacity ${loading ? "opacity-60" : ""}`}>
            {kept.map((p) => {
              // a thing named in English (a sentence rule) has no glyph: its
              // name takes both columns, in the UI face
              const named = p.item.english === p.item.glyph;
              return (
                <li key={p.item.id} className="grid grid-cols-[5.5rem_1fr_auto_auto] items-center gap-x-3 rounded-lg px-2 py-2 hover:bg-sky-card sm:grid-cols-[7rem_1fr_auto_auto] sm:gap-x-4">
                  {named
                    ? <span className={`col-span-2 truncate font-sky-ui text-[14px] font-semibold ${STANDING[p.item.standing].text}`} title={p.item.english}>{p.item.english}</span>
                    : <>
                        <span className={`truncate text-[17px] font-medium leading-tight ${STANDING[p.item.standing].text} ${japaneseFont(p.item.glyph)}`} title={p.item.glyph}>{p.item.glyph}</span>
                        <span className="truncate text-[13.5px] text-sky-ink/90" title={p.item.english}>{p.item.english}</span>
                      </>}
                  <span className="hidden text-[12px] text-sky-accent sm:inline">{p.misses > 0 ? `missed ${p.misses} ${p.misses === 1 ? "time" : "times"}` : ""}</span>
                  <button type="button" aria-label={`Leave out ${p.item.english}`} title="Leave it out" onClick={() => drop(p.item.id, p.item.english)} className="text-[14px] leading-none text-sky-muted hover:text-sky-coral">×</button>
                </li>
              );
            })}
            {unseen > 0 && <li className="px-2 py-1.5 text-[12.5px] text-sky-muted">and {unseen.toLocaleString()} more that match, not listed here</li>}
          </ul>
          <div className="mt-3 flex shrink-0 flex-wrap items-center gap-3">
            <SkyButton disabled={!!blocked} onClick={() => onStart(recipe)}>Start</SkyButton>
          </div>
        </SkyPanel>
      </div>
    </SkyPageShell>
  );
}

function Facet({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 first:mt-3">
      <Eyebrow>{title}</Eyebrow>
      <ChipRow>{children}</ChipRow>
      {note && <p className="mt-2 text-[12px] text-sky-muted">{note}</p>}
    </div>
  );
}
