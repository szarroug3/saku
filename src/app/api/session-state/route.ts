// GET  /api/session-state — the learner's IN-PROGRESS run envelope (the server
//                           copy the client seeds and reconciles its live session
//                           against, so a run started on one device appears on
//                           another).
// POST /api/session-state — store an incoming envelope, last-writer-wins.
//
// NOT /api/session. That one appends a FINISHED round to history (a different
// channel entirely — see the header on session-store.ts). This route carries the
// run you are STILL DOING: one envelope, last-writer-wins, cleared when the run
// ends. Keeping them separate is what stops a stale in-progress copy from
// resurrecting a finished run.
//
// Mirrors /api/settings: `getUserId` scopes the read/write (401 in Supabase mode
// with no session, which the client's reliable write path reads as "signed out,
// keep it local" or "token lapsed, refresh + retry"), and a thrown store error
// is turned into the shared HTTP response.

import { getUserId } from "@/lib/auth";
import { historyErrorResponse } from "@/lib/api-error";
import {
  EMPTY_ENVELOPE,
  type SessionStateEnvelope,
} from "@/lib/session-state";
import { loadSessionState, saveSessionState } from "@/lib/session-store";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const userId = await getUserId();
    return Response.json(await loadSessionState(userId), { headers: NO_STORE });
  } catch (e) {
    const res = historyErrorResponse(e);
    if (res) return res;
    throw e;
  }
}

export async function POST(request: Request) {
  let incoming: SessionStateEnvelope;
  try {
    const text = await request.text();
    incoming = text ? (JSON.parse(text) as SessionStateEnvelope) : EMPTY_ENVELOPE;
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400, headers: NO_STORE },
    );
  }
  try {
    const userId = await getUserId();
    const session = await saveSessionState(userId, incoming);
    return Response.json({ ok: true, session }, { headers: NO_STORE });
  } catch (e) {
    const res = historyErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
