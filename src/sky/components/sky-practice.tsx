"use client";

// Practice: describe a deck, see what it holds, run it. Tracked as SAK-318
// to SAK-322.
//
// The left column is the recipe (SAK-319): what to draw from, what standing
// it should have, what to be asked for, how many, and whether the Quiz may
// offer its multiple-choice help. Saved recipes (SAK-321) are recipes under
// a name, so a saved one changes as the learner does; they show only once
// there are any. The right column is the deck the recipe resolves to now
// (SAK-320), shakiest first, with every item droppable and every edge case
// said out loud. Nothing here touches the review schedule (SAK-318): the
// run's answers go to whoever the route hands in, and the page says so at
// the top.

import { useEffect, useRef, useState } from "react";

import { SkyButton, SkyChip } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkyInput } from "@/sky/components/sky-input";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkyPanel } from "@/sky/components/sky-panel";
import { japaneseFont } from "@/sky/lib/japanese";
import { ASK, ASKS, cannotStart, DECK_SIZES, deckSize, shortfall, type DeckSize, type PracticeCollection, type PracticeMisses, type PracticePreview, type Recipe, type SavedRecipe } from "@/sky/lib/practice";
import { STANDING, STANDING_ORDER } from "@/sky/lib/standing";

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
  onStart: (recipe: Recipe, dropped: readonly string[]) => void;
  /** A recipe handed back from a run to save. */
  toSave?: Recipe;
  height?: string;
}

const LOOKUP_DELAY = 150;

const same = (a: Recipe, b: Recipe) => JSON.stringify(a) === JSON.stringify(b);

export function SkyPractice({ collections, lookup, initial, misses, saved, onSaved, onStart, toSave, height }: SkyPracticeProps) {
  const [recipe, setRecipe] = useState<Recipe>(toSave ?? initial.recipe);
  // the preview the route resolved for the opening recipe serves as long as
  // the recipe is that one; anything else is looked up
  const [fetched, setFetched] = useState<{ recipe: Recipe; preview: PracticePreview } | null>(null);
  const preview: PracticePreview | null = same(recipe, initial.recipe) ? initial.preview : fetched && same(fetched.recipe, recipe) ? fetched.preview : null;
  const [dropped, setDropped] = useState<readonly string[]>([]);
  const [undo, setUndo] = useState<{ id: string; name: string } | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(!!toSave);
  const [renaming, setRenaming] = useState<string | null>(null);
  // the saved recipe the page is working from, by name; it stays chosen as
  // the recipe drifts, so the drift can be written back to it
  const [loaded, setLoaded] = useState<string | null>(null);
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
  // the pool the deck is drawn from: everything that matched, less the drops
  const pool = preview ? preview.matched - dropped.length : 0;
  const unseen = preview ? preview.matched - preview.items.length : 0;
  const size = deckSize(recipe, pool);
  const blocked = cannotStart(recipe, preview, pool);
  const short = preview ? shortfall(recipe, pool) : null;
  const chosen = (loaded && saved.find((d) => d.name === loaded)) || saved.find((d) => same(d.recipe, recipe));
  const changed = !!chosen && !same(chosen.recipe, recipe);

  const drop = (id: string, name: string) => { setDropped([...dropped, id]); setUndo({ id, name }); };
  const save = () => {
    const name = saveName.trim();
    if (!name) return;
    onSaved([...saved.filter((d) => d.name !== name), { name, recipe }]);
    setLoaded(name); setSaveName(""); setSaving(false);
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
    <SkyPageShell eyebrow="Practice" title="Practice" lede="Practice is never recorded against your review schedule. Miss everything here and not one interval moves." height={height}>
      <div className="grid min-h-0 flex-1 gap-4 font-sky-ui lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SkyPanel title="The recipe" className="flex min-h-0 flex-col overflow-y-auto">
          {saved.length > 0 && (
            <Facet title="Saved recipes" note={changed && chosen ? `Changed from ${chosen.name}. Update it below, or save this as a new one.` : "A saved recipe keeps the recipe, not today's list, so it changes as you do."}>
              {saved.map((d) => <SkyChip key={d.name} on={chosen?.name === d.name} onClick={() => load(d)} className={japaneseFont(d.name)}>{d.name}</SkyChip>)}
              {chosen && (
                renaming !== null ? (
                  <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); rename(chosen.name); }}>
                    <SkyInput value={renaming} onChange={(e) => setRenaming(e.target.value)} className="flex-1 !py-1 text-[13px]" autoFocus />
                    <SkyButton onClick={() => rename(chosen.name)} disabled={!renaming.trim()}>Rename</SkyButton>
                    <SkyButton variant="outline" onClick={() => setRenaming(null)}>Cancel</SkyButton>
                  </form>
                ) : (
                  <span className="flex w-full gap-3 text-[12px] text-sky-muted">
                    <button type="button" className="underline hover:text-sky-ink" onClick={() => setRenaming(chosen.name)}>Rename</button>
                    <button type="button" className="underline hover:text-sky-coral" onClick={remove}>Delete</button>
                  </span>
                )
              )}
            </Facet>
          )}
          <Facet title="Draw from" note={recipe.collections.length ? undefined : "Everything, until you pick a collection."}>
            {collections.map((c) => <SkyChip key={c.id} on={recipe.collections.includes(c.id)} onClick={() => set({ collections: toggle(recipe.collections, c.id) })} title={`${c.total.toLocaleString()} to draw from`}>{c.title}</SkyChip>)}
          </Facet>
          <Facet title="Only things that are" note={recipe.statuses.length ? undefined : "Any standing, until you pick one."}>
            {STANDING_ORDER.map((s) => <SkyChip key={s} on={recipe.statuses.includes(s)} onClick={() => set({ statuses: toggle(recipe.statuses, s) })} className="capitalize">{STANDING[s].label}</SkyChip>)}
          </Facet>
          <Facet title="Ask me for">
            {ASKS.map((a) => {
              const can = preview ? preview.asksAvailable[a] : true;
              return <SkyChip key={a} on={recipe.asks.includes(a)} disabled={!can} title={can ? ASK[a].meaning : `Nothing in this deck can be asked that way. ${ASK[a].meaning}`} onClick={() => set({ asks: toggle(recipe.asks, a) })}>{ASK[a].label}</SkyChip>;
            })}
          </Facet>
          <Facet title="How many">
            {DECK_SIZES.map((n) => <SkyChip key={String(n)} on={recipe.size === n} onClick={() => set({ size: n as DeckSize })}>{n === "all" ? "All of them" : n}</SkyChip>)}
          </Facet>
          <Facet title="Help me" note={recipe.noNarrowing ? "The choices are never offered on a typed card. Hints and giving up stay." : "The Quiz may narrow a typed card down to choices when you ask."}>
            <SkyChip on={!recipe.noNarrowing} onClick={() => set({ noNarrowing: !recipe.noNarrowing })}>Multiple choice</SkyChip>
          </Facet>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {saving ? (
              <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
                <SkyInput value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="A name for this recipe" className="flex-1 !py-1.5 text-[14px]" autoFocus />
                <SkyButton onClick={save} disabled={!saveName.trim()}>Save</SkyButton>
                <SkyButton variant="outline" onClick={() => setSaving(false)}>Cancel</SkyButton>
              </form>
            ) : chosen && changed ? (
              <>
                <SkyButton onClick={update}>Update {chosen.name}</SkyButton>
                <SkyButton variant="outline" onClick={() => setSaving(true)}>Save as new</SkyButton>
              </>
            ) : (
              <SkyButton variant="outline" onClick={() => setSaving(true)} disabled={!!chosen}>{chosen ? `Saved as ${chosen.name}` : "Save this recipe"}</SkyButton>
            )}
          </div>
        </SkyPanel>

        <SkyPanel title="What you would get" className="flex min-h-0 flex-col">
          <p className="mt-2 shrink-0 text-[14px]">
            <span className="font-semibold text-sky-ink">{preview ? size.toLocaleString() : "…"}</span> {size === 1 ? "item" : "items"}
            {preview && recipe.size !== "all" && pool > size && <span className="text-sky-muted">, drawn at random from the {pool.toLocaleString()} below</span>}
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
            {unseen > 0 && <li className="px-2 py-1.5 text-[12.5px] text-sky-muted">and {unseen.toLocaleString()} more that match, not listed here</li>}
          </ul>
          <div className="mt-3 flex shrink-0 flex-wrap items-center gap-3">
            <SkyButton disabled={!!blocked} onClick={() => onStart(recipe, dropped)}>Start · {size}</SkyButton>
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
