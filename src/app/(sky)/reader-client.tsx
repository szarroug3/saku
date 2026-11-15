"use client";

// The reader's client side (#BuildHybridAI): the splitting, the page import
// and the cards through the app's own calls, bound to whose sky this reads,
// and the two Gemini tools through Firebase AI Logic (firebase-ai.ts).

import { useCallback, useMemo } from "react";

import { SkyReader, type ReaderInput, type ReaderTools } from "@/sky/components/sky-reader";
import { translateWith, TRANSLATE_SCHEMA } from "@/sky/lib/reader-ask";

import { atlasEntry, readPage, readText } from "./actions";
import { aiConfigured, askModel, modelPair, online } from "./firebase-ai";
import { HearButton } from "./hear-button";
import { skyHref } from "./hrefs";
import { useWho } from "./local";
import { usePageAsk } from "./page-ask-client";
import { PitchMark } from "./pitch-reading";
import { useStored, writeStored } from "./stored";
import { useRefreshed } from "./use-refresh";
import { claimIds, unclaimIds } from "./writes";

/** The text read last, this browser's: what the learner brought is theirs to
 * keep or clear, and nothing on the server keeps it. */
const READER_KEY = "sky:reader:text";

const TRANSLATE_MODELS = {
  first: async (prompt: string) => askModel((await modelPair(TRANSLATE_SCHEMA)).hybrid, prompt),
  cloud: async (prompt: string) => askModel((await modelPair(TRANSLATE_SCHEMA)).cloud, prompt),
  online,
};

function isInput(v: unknown): v is ReaderInput {
  return !!v && typeof v === "object" && typeof (v as ReaderInput).text === "string";
}

export function ReaderClient({ sample, signedIn }: { sample: boolean; signedIn: boolean }) {
  const who = useWho(sample, signedIn);
  const ask = usePageAsk(sample, signedIn, "text");
  const askCard = usePageAsk(sample, signedIn);
  const claim = useRefreshed(claimIds);
  const unclaim = useRefreshed(unclaimIds);
  const stored = useStored<unknown>(READER_KEY, null);
  const saved = isInput(stored) ? stored : null;
  const onSave = useCallback((input: ReaderInput | null) => writeStored(READER_KEY, input), []);
  const tools = useMemo<ReaderTools | undefined>(() => {
    if (!who) return undefined;
    return {
      read: (text) => readText(who, text),
      readPage: (url) => readPage(who, url),
      entry: (id) => atlasEntry(who, id),
      claim: sample ? undefined : claim,
      unclaim: sample ? undefined : unclaim,
      ask,
      askCard,
      translate: aiConfigured() ? (r) => translateWith(r, TRANSLATE_MODELS) : undefined,
    };
  }, [who, sample, claim, unclaim, ask, askCard]);
  return (
    <SkyReader
      tools={tools}
      saved={saved}
      onSave={onSave}
      picksHref={(ids) => skyHref("/observatory", { sample, picks: ids })}
      hear={HearButton}
      pitch={PitchMark}
    />
  );
}
