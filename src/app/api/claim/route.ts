// POST /api/claim — "I know these", or "actually, I don't".
//
// Its own route rather than a flag on /api/session, because a claim is not a
// session and the two must not share a write path. See src/lib/claims.ts: a
// session is what you did and a claim is what you said, and the moment they
// travel together someone folds one as the other.

import { historyErrorResponse } from "@/lib/api-error";
import { dropClaims, saveClaims } from "@/lib/history";
import type { FactId } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

interface ClaimBody {
  facts?: string[];
  /** false withdraws the claim. Absent means true — the common case is
   * claiming, and a body that forgets the flag should not silently unclaim. */
  known?: boolean;
}

export async function POST(request: Request) {
  let body: ClaimBody;
  try {
    const text = await request.text();
    body = text ? (JSON.parse(text) as ClaimBody) : {};
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
  // The server's clock, not the client's: this is the one timestamp the model
  // will read as "when you said it", and history.json is written here. Sessions
  // carry their own ts because they are a record of a past occasion; a claim
  // happens at the moment of the request.
  try {
    const hist =
      body.known === false ? dropClaims(facts) : saveClaims(facts, Date.now());
    return Response.json(
      { ok: true, claims: Object.keys(hist.claims ?? {}).length },
      { headers: NO_STORE },
    );
  } catch (e) {
    const res = historyErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
