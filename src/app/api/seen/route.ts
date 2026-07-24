// POST /api/seen — "quiz me": these are in my knowledge base, drill them.
//
// Its own route, beside /api/claim and for the identical reason: a "quiz me" is
// not a session and not a claim. See src/lib/claims.ts — a session is what you
// did, a claim is what you said you know, and a "quiz me" is what you asked to
// be checked on. Three intents, three write paths, so no one folds one as
// another. The drill this precedes goes through /api/session on its own; this
// route only records the intent, so an abandoned drill still leaves the group
// seen rather than fresh.
//
// `remove: true` WITHDRAWS the seen marks instead, the exact mirror of
// /api/claim's `known: false`. It exists for one caller: discarding a curriculum
// lesson, which has to take back the seen the lesson's start laid down so the
// frontier does not stay advanced by a session that scored nothing. Recorded
// server-side, so the roll-back reaches other devices too and one of them cannot
// see the phantom advance.

import { getUserId } from "@/lib/auth";
import { historyErrorResponse } from "@/lib/api-error";
import { dropSeen, saveSeen } from "@/lib/history";
import type { FactId } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

interface SeenBody {
  facts?: string[];
  /** true withdraws the seen record. Absent means false — the common case is
   * recording a "quiz me", and a body that forgets the flag must not unsee. */
  remove?: boolean;
}

export async function POST(request: Request) {
  let body: SeenBody;
  try {
    const text = await request.text();
    body = text ? (JSON.parse(text) as SeenBody) : {};
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400, headers: NO_STORE },
    );
  }
  const facts = (body.facts ?? []) as FactId[];
  if (!Array.isArray(facts) || facts.some((f) => typeof f !== "string")) {
    return Response.json(
      { error: "facts must be an array of fact ids" },
      { status: 400, headers: NO_STORE },
    );
  }
  // The server's clock — the timestamp the model reads as "when you asked",
  // same discipline as /api/claim: history.json is written here, at the moment
  // of the request, not from a time the client chose.
  try {
    const userId = await getUserId();
    const hist = body.remove
      ? await dropSeen(userId, facts)
      : await saveSeen(userId, facts, Date.now());
    return Response.json(
      { ok: true, seen: Object.keys(hist.seen ?? {}).length },
      { headers: NO_STORE },
    );
  } catch (e) {
    const res = historyErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
