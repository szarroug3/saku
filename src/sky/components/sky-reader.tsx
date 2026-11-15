"use client";

// The reader (#BuildHybridAI). The learner pastes Japanese, or brings in a
// web page, and reads it with every word in the color of where they stand
// with it. A word Saku teaches opens its card beside the text, with Add to
// lesson and I know this. A word Saku doesn't teach opens the kanji in it.
// Selecting any part of the text offers Translate and Ask Gemini, Nano on
// the device first and the cloud when it can't, both held to Japanese that
// is in the passage or that the learner has learned.
//
// A view and nothing else: the reading, the card lookups and the asking are
// handed in by the route (src/app/(sky)/reader-client.tsx).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { LessonCard, type HearComponent, type PitchComponent } from "@/sky/components/lesson-card";
import { SkyButton, SkyTextButton } from "@/sky/components/sky-button";
import { Eyebrow } from "@/sky/components/sky-card";
import { SkyInput } from "@/sky/components/sky-input";
import { SkyPageAsk, type AskAboutPage } from "@/sky/components/sky-page-ask";
import { SkyPageShell } from "@/sky/components/sky-page-shell";
import { SkySurface } from "@/sky/components/sky-panel";
import type { AtlasEntry } from "@/sky/components/sky-atlas";
import { StandingChip } from "@/sky/components/standing-legend";
import type { Answer } from "@/sky/lib/ai-ask";
import { hasCard, passageAround, plainText, READ_MAX, type ReadText, type ReadWord } from "@/sky/lib/reader";
import { SELECTION_MAX, type TranslateRequest } from "@/sky/lib/reader-ask";
import { STANDING, STANDING_ORDER, type Standing } from "@/sky/lib/standing";

/** What the learner brought, kept so a reload reads it again. */
export interface ReaderInput {
  text: string;
  title?: string;
  source?: string;
}

export interface ReaderTools {
  /** Splits pasted text and matches it to the learner's sky. */
  read: (text: string) => Promise<ReadText>;
  /** Brings in a web page; a page that can't be brought in says why. */
  readPage: (url: string) => Promise<ReadText | { error: string }>;
  /** A card, opened. */
  entry: (id: string) => Promise<AtlasEntry>;
  /** "I know this", and "I don't know this" to take it back. Without them
   * the change is kept for the visit only. */
  claim?: (ids: readonly string[]) => Promise<void>;
  unclaim?: (ids: readonly string[]) => Promise<void>;
  /** Questions about a selection, the passage as the page. */
  ask?: AskAboutPage;
  /** Questions about a card, the box under it as everywhere else. */
  askCard?: AskAboutPage;
  /** A selection in English. */
  translate?: (r: TranslateRequest) => Promise<Answer | null>;
}

/** A short text to try the reader with, written for it. */
const EXAMPLE = [
  "私は毎日学校で日本語を勉強しています。",
  "昨日、友達と映画を見に行きました。とても面白かったです。",
  "週末は家で本を読みます。日曜日には母と買い物に行きます。",
].join("\n");

const WHERE: Record<string, string> = {
  on_device: "Gemini Nano on your device",
  in_cloud: "Gemini in the cloud",
};

type Panel =
  | { kind: "word"; word: ReadWord; id: string }
  | { kind: "kanji"; word: ReadWord }
  | { kind: "selection"; text: string };

const known = (s: Standing | undefined) => !!s && s !== "not-seen";

function wordClass(w: ReadWord, on: boolean): string {
  const tone = w.standing ? (known(w.standing) ? STANDING[w.standing].text : "text-sky-ink underline decoration-sky-accent decoration-dotted decoration-2 underline-offset-[6px]") : "text-sky-ink";
  return `cursor-pointer rounded-sm hover:bg-sky-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-accent ${tone} ${on ? "bg-sky-accent/15" : ""}`;
}

/** The selected text without the readings drawn over words. */
function selectedText(container: HTMLElement | null): string {
  const sel = typeof window === "undefined" ? null : window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount || !container) return "";
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return "";
  const frag = range.cloneContents();
  frag.querySelectorAll("rt").forEach((rt) => rt.remove());
  return (frag.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function SkyReader({ tools, saved, onSave, picksHref, hear, pitch, height }: {
  /** Undefined until whose sky this reads is known. */
  tools?: ReaderTools;
  /** The text read last, read again on a reload. */
  saved: ReaderInput | null;
  onSave: (input: ReaderInput | null) => void;
  picksHref: (ids: readonly string[]) => string;
  hear?: HearComponent;
  pitch?: PitchComponent;
  height?: string;
}) {
  const [text, setText] = useState<ReadText | null>(null);
  const [state, setState] = useState<"ready" | "reading" | { error: string }>("ready");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [readings, setReadings] = useState(true);
  const restored = useRef(false);

  const open = useCallback(async (input: ReaderInput, read: () => Promise<ReadText | { error: string }>) => {
    setState("reading");
    try {
      const got = await read();
      if ("error" in got) return setState({ error: got.error });
      const shown = { ...got, ...(input.title ? { title: input.title } : {}), ...(input.source ? { source: input.source } : {}) };
      setText(shown);
      setPanel(null);
      setState("ready");
      onSave({ text: plainText(got), ...(shown.title ? { title: shown.title } : {}), ...(shown.source ? { source: shown.source } : {}) });
    } catch {
      setState({ error: "That couldn't be read. Try again in a moment." });
    }
  }, [onSave]);

  // the last text comes back on a reload, read against the sky as it is now
  useEffect(() => {
    if (restored.current || !tools || !saved?.text) return;
    restored.current = true;
    void open(saved, () => tools.read(saved.text));
  }, [tools, saved, open]);

  // "I know this" recolors the word everywhere it is in the text, and "I
  // don't know this" takes it back
  const markKnown = (id: string, standing: Standing) => setText((t) => t && {
    ...t,
    paragraphs: t.paragraphs.map((p) => p.map((w) => (w.entry === id ? { ...w, standing } : w))),
  });

  const body = !tools || (state === "reading" && !text) ? (
    <p className="text-[14px] text-sky-muted" role="status">{state === "reading" ? "Reading it…" : "Getting your sky…"}</p>
  ) : text ? (
    <Reading
      text={text}
      panel={panel}
      setPanel={setPanel}
      readings={readings}
      side={
        <Side
          panel={panel}
          setPanel={setPanel}
          text={text}
          tools={tools}
          picksHref={picksHref}
          hear={hear}
          pitch={pitch}
          onKnown={markKnown}
        />
      }
    />
  ) : (
    <Bring
      busy={state === "reading"}
      error={typeof state === "object" ? state.error : undefined}
      onText={(t) => void open({ text: t }, () => tools.read(t))}
      onUrl={(u) => void open({ text: "" }, () => tools.readPage(u))}
    />
  );

  const aside = text ? (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-[13px] text-sky-muted">
        <input type="checkbox" checked={readings} onChange={(e) => setReadings(e.target.checked)} className="accent-[var(--sky-accent)]" />
        Readings over new words
      </label>
      <SkyButton variant="outline" onClick={() => { setText(null); setPanel(null); setState("ready"); onSave(null); }}>New text</SkyButton>
    </div>
  ) : undefined;

  return (
    <SkyPageShell eyebrow="Reader" title={text?.title ?? "Read something in Japanese"} aside={aside} height={height}>
      {body}
    </SkyPageShell>
  );
}

/** Paste a text or name a page. */
function Bring({ busy, error, onText, onUrl }: { busy: boolean; error?: string; onText: (text: string) => void; onUrl: (url: string) => void }) {
  const [pasted, setPasted] = useState("");
  const [url, setUrl] = useState("");
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 overflow-y-auto">
      <SkySurface className="flex flex-col gap-3">
        <Eyebrow tight>Paste Japanese</Eyebrow>
        <textarea
          lang="ja"
          aria-label="Japanese to read"
          value={pasted}
          maxLength={READ_MAX}
          onChange={(e) => setPasted(e.target.value)}
          rows={7}
          placeholder="A news story, a song, a message from a friend…"
          className="w-full resize-y rounded-xl border border-sky-line bg-sky-card px-3 py-2 font-kana text-[16px] leading-relaxed text-sky-ink placeholder:font-sky-ui placeholder:text-sky-muted focus:border-sky-accent focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-3">
          <SkyButton disabled={busy || !pasted.trim()} onClick={() => onText(pasted)}>{busy ? "Reading…" : "Read it"}</SkyButton>
          <SkyTextButton onClick={() => setPasted(EXAMPLE)}>Try an example</SkyTextButton>
        </div>
      </SkySurface>
      <SkySurface className="flex flex-col gap-3">
        <Eyebrow tight>Or bring in a web page</Eyebrow>
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) onUrl(url.trim()); }}>
          <SkyInput type="url" aria-label="Web page address" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1 text-[14px]" />
          <SkyButton disabled={busy || !url.trim()} onClick={() => url.trim() && onUrl(url.trim())}>{busy ? "Bringing it in…" : "Bring it in"}</SkyButton>
        </form>
        <p className="text-[13px] text-sky-muted">Saku keeps the Japanese on the page and leaves out the rest.</p>
      </SkySurface>
      {error && <p className="text-[14px] text-sky-ink" role="alert">{error}</p>}
    </div>
  );
}

/** The text, word by word, beside the panel. */
function Reading({ text, panel, setPanel, readings, side }: { text: ReadText; panel: Panel | null; setPanel: (p: Panel | null) => void; readings: boolean; side: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const present = useMemo(() => {
    const seen = new Set<Standing>();
    for (const p of text.paragraphs) for (const w of p) if (w.standing) seen.add(w.standing);
    return STANDING_ORDER.filter((s) => seen.has(s));
  }, [text]);
  const openWord = (w: ReadWord) => {
    // a drag that selected text isn't a click on a word
    if (selectedText(ref.current)) return;
    if (w.entry) setPanel({ kind: "word", word: w, id: w.entry });
    else if (w.kanji?.length) setPanel({ kind: "kanji", word: w });
  };
  const onSelect = () => {
    const sel = selectedText(ref.current);
    if (sel) setPanel({ kind: "selection", text: sel.slice(0, SELECTION_MAX) });
  };
  const current = panel?.kind === "word" || panel?.kind === "kanji" ? panel.word : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {text.source && (
          <p className="text-[13px] text-sky-muted">
            From <a href={text.source} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-sky-ink">{new URL(text.source).hostname}</a>
          </p>
        )}
        {text.cut && <p className="text-[13px] text-sky-muted">That was long, so only the start of it is here.</p>}
        {present.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="What the colors mean">
            {present.map((s) => <StandingChip key={s} standing={s} />)}
          </div>
        )}
        <div ref={ref} onMouseUp={onSelect} onKeyUp={onSelect} className="flex flex-col gap-4">
          {text.paragraphs.map((p, i) => (
            <p key={i} lang="ja" className="font-kana text-[21px] leading-[2.3] text-sky-ink">
              {p.map((w, j) => {
                if (w.mark || !hasCard(w)) return <span key={j}>{w.text}</span>;
                const shown = readings && w.reading && w.reading !== w.text && !known(w.standing)
                  ? <ruby>{w.text}<rt className="select-none font-kana text-[11px] text-sky-muted">{w.reading}</rt></ruby>
                  : w.text;
                return (
                  <span
                    key={j}
                    role="button"
                    tabIndex={0}
                    aria-label={`${w.text}${w.reading && w.reading !== w.text ? `, ${w.reading}` : ""}`}
                    onClick={() => openWord(w)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWord(w); } }}
                    className={wordClass(w, current === w)}
                  >
                    {shown}
                  </span>
                );
              })}
            </p>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 shrink-0 flex-col max-md:max-h-[55%] md:w-[min(440px,45%)]">{side}</div>
    </div>
  );
}

/** What is open beside the text: a card, a word's kanji, or a selection. */
function Side({ panel, setPanel, text, tools, picksHref, hear, pitch, onKnown }: {
  panel: Panel | null;
  setPanel: (p: Panel | null) => void;
  text: ReadText;
  tools: ReaderTools;
  picksHref: (ids: readonly string[]) => string;
  hear?: HearComponent;
  pitch?: PitchComponent;
  onKnown: (id: string, standing: Standing) => void;
}) {
  if (!panel) {
    return (
      <SkySurface className="flex flex-col gap-2 text-[14px] text-sky-muted">
        <p>Click a word to open its card. Words with a dotted line are new to you.</p>
        <p>Select any part of the text to translate it or ask Gemini about it.</p>
      </SkySurface>
    );
  }
  if (panel.kind === "kanji") {
    const w = panel.word;
    return (
      <SkySurface className="flex flex-col gap-3">
        <p lang="ja" className="font-kana text-[28px] text-sky-ink">{w.text}{w.reading && w.reading !== w.text && <span className="ml-2 text-[16px] text-sky-muted">{w.reading}</span>}</p>
        <p className="text-[14px] text-sky-muted">Saku doesn&apos;t teach this word yet. You can open the kanji in it.</p>
        <div className="flex flex-wrap gap-2">
          {w.kanji?.map((k) => (
            <button key={k.id} type="button" onClick={() => setPanel({ kind: "word", word: w, id: k.id })} className={`rounded-lg border border-sky-line px-3 py-1 font-kana text-[22px] hover:border-sky-accent ${known(k.standing) ? STANDING[k.standing].text : "text-sky-ink"}`}>
              {k.glyph}
            </button>
          ))}
        </div>
      </SkySurface>
    );
  }
  if (panel.kind === "selection") return <Selection key={panel.text} selected={panel.text} text={text} tools={tools} />;
  return <WordCard key={panel.id} id={panel.id} tools={tools} picksHref={picksHref} hear={hear} pitch={pitch} onKnown={onKnown} onOpen={(id) => setPanel({ ...panel, id })} />;
}

/** A word's card, as the Atlas shows it. */
function WordCard({ id, tools, picksHref, hear, pitch, onKnown, onOpen }: {
  id: string;
  tools: ReaderTools;
  picksHref: (ids: readonly string[]) => string;
  hear?: HearComponent;
  pitch?: PitchComponent;
  onKnown: (id: string, standing: Standing) => void;
  onOpen: (id: string) => void;
}) {
  const [entry, setEntry] = useState<AtlasEntry | null | "failed">(null);
  const [page, setPage] = useState(0);
  const [marking, setMarking] = useState(false);
  // what I know this or I don't know this made it, until the card is fetched
  // again with it
  const [marked, setMarked] = useState<Standing | null>(null);
  useEffect(() => {
    let live = true;
    tools.entry(id).then((e) => { if (live) setEntry(e); }, () => { if (live) setEntry("failed"); });
    return () => { live = false; };
  }, [id, tools]);
  if (entry === "failed") return <SkySurface className="text-[14px] text-sky-muted">This card couldn&apos;t be opened.</SkySurface>;
  if (!entry) return <SkySurface className="text-[14px] text-sky-muted"><p role="status">Opening the card…</p></SkySurface>;
  const found = entry.items.find((x) => x.id === entry.id) ?? entry.items[0];
  if (!found) return <SkySurface className="text-[14px] text-sky-muted">This card couldn&apos;t be opened.</SkySurface>;
  const item = marked ? { ...found, standing: marked } : found;
  const mark = async (toKnown: boolean) => {
    setMarking(true);
    try {
      await (toKnown ? tools.claim : tools.unclaim)?.([item.id]);
      const standing = toKnown ? "claimed" : "not-seen";
      setMarked(standing);
      onKnown(item.id, standing);
    } finally {
      setMarking(false);
    }
  };
  return (
    <LessonCard
      scroll
      item={item}
      teach={entry.teach}
      madeOf={[]}
      partOf={[]}
      standing
      related={entry.related}
      ask={tools.askCard}
      hear={hear}
      pitch={pitch}
      onSelect={onOpen}
      onRead={onOpen}
      page={page}
      onPage={setPage}
      footer={known(item.standing) ? (
        <SkyButton variant="outline" disabled={marking} onClick={() => void mark(false)}>{marking ? "Marking…" : "I don't know this"}</SkyButton>
      ) : (
        <>
          <SkyButton href={picksHref([item.id])}>Add to lesson</SkyButton>
          <SkyButton variant="outline" disabled={marking} onClick={() => void mark(true)}>{marking ? "Marking…" : "I know this"}</SkyButton>
        </>
      )}
    />
  );
}

/** A selection: Translate, and questions about it. */
function Selection({ selected, text, tools }: { selected: string; text: ReadText; tools: ReaderTools }) {
  const [translation, setTranslation] = useState<Answer | null | "asking" | "failed">(null);
  const [asking, setAsking] = useState(false);
  const passage = useMemo(() => passageAround(text, selected), [text, selected]);
  // the readings of the words in the passage go with it, so an answer can
  // write them in kana
  const page = useMemo(() => {
    const words = text.paragraphs.flat().filter((w) => w.reading && passage.includes(w.text)).map((w) => `${w.text} (${w.reading})`);
    return `${passage}\n\nThe part they selected: ${selected}${words.length ? `\nReadings: ${[...new Set(words)].join(", ")}` : ""}`;
  }, [text, passage, selected]);
  const translate = async () => {
    if (!tools.translate) return;
    setTranslation("asking");
    const got = await tools.translate({ selected, passage }).catch(() => null);
    setTranslation(got ?? "failed");
  };
  return (
    <SkySurface className="flex min-h-0 flex-col gap-3 overflow-y-auto">
      <Eyebrow tight>Selected</Eyebrow>
      <p lang="ja" className="font-kana text-[18px] leading-relaxed text-sky-ink">{selected}</p>
      {!tools.translate && !tools.ask ? (
        <p className="text-[13px] text-sky-muted">Translating and asking need Gemini, which isn&apos;t set up on this site.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tools.translate && <SkyButton disabled={translation === "asking"} onClick={() => void translate()}>{translation === "asking" ? "Translating…" : "Translate"}</SkyButton>}
          {tools.ask && !asking && <SkyButton variant="outline" onClick={() => setAsking(true)}>Ask Gemini about it</SkyButton>}
        </div>
      )}
      {translation === "failed" && <p className="text-[13px] text-sky-muted" role="status">Gemini couldn&apos;t translate that. Try again in a moment.</p>}
      {translation && typeof translation === "object" && (
        <div className="flex flex-col gap-1">
          <p className="text-[15px] leading-relaxed text-sky-ink">{translation.text}</p>
          <p className="text-[12px] text-sky-muted">Translated by {WHERE[translation.source] ?? "Gemini"}.</p>
        </div>
      )}
      {asking && tools.ask && <SkyPageAsk page={page} ask={tools.ask} about="this part" startOpen />}
    </SkySurface>
  );
}
