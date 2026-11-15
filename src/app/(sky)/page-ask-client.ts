"use client";

// Questions about a page, the browser half (#BuildHybridAI). `answerWith` in
// src/sky/lib/page-ask.ts asks the models in order and checks each answer
// against the card and what the learner has learned. This file hands it the
// two models from firebase-ai.ts and reads the learned list from the server,
// once per page load and learner.

import { useMemo } from "react";

import type { AskAboutPage } from "@/sky/components/sky-page-ask";
import { answerWith, PAGE_ASK_SCHEMA, QUESTION_MAX, type Learned } from "@/sky/lib/page-ask";

import { pageAskLearned } from "./actions";
import { aiConfigured, askModel, modelPair, online } from "./firebase-ai";
import { useWho } from "./local";
import type { Who } from "./who";

function askerFor(who: Who): AskAboutPage {
  let learned: Promise<Learned> | undefined;
  return async (page, question, earlier = []) => {
    const q = question.trim().slice(0, QUESTION_MAX);
    if (!q) return null;
    learned ??= pageAskLearned(who);
    learned.catch(() => { learned = undefined; });
    return answerWith({ page, question: q, learned: await learned, earlier }, {
      first: async (prompt) => askModel((await modelPair(PAGE_ASK_SCHEMA)).hybrid, prompt),
      cloud: async (prompt) => askModel((await modelPair(PAGE_ASK_SCHEMA)).cloud, prompt),
      online,
    });
  };
}

/** The question box's asker, for whoever's history this page reads.
 * Undefined until that is known, or where the site has no Firebase set up,
 * and the cards then draw no box. */
export function usePageAsk(sample: boolean, signedIn: boolean): AskAboutPage | undefined {
  const who = useWho(sample, signedIn);
  return useMemo(() => (who && aiConfigured() ? askerFor(who) : undefined), [who]);
}
