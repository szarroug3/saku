// GET  /api/settings — the learner's whole settings blob (the server copy the
//                       client seeds and reconciles its local cache against).
// POST /api/settings — merge a partial settings patch into that blob.
//
// Mirrors /api/history and /api/session: `getUserId` scopes the read/write (401
// in Supabase mode with no session, which the client's reliable write path reads
// as "signed out, cache locally" or "token lapsed, refresh + retry"), and a
// thrown store error is turned into the shared HTTP response.

import { getUserId } from "@/lib/auth";
import { historyErrorResponse } from "@/lib/api-error";
import { loadSettings, saveSettings } from "@/lib/settings";
import type { SettingsFile } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const userId = await getUserId();
    return Response.json(await loadSettings(userId), { headers: NO_STORE });
  } catch (e) {
    const res = historyErrorResponse(e);
    if (res) return res;
    throw e;
  }
}

export async function POST(request: Request) {
  let patch: SettingsFile;
  try {
    const text = await request.text();
    patch = text ? (JSON.parse(text) as SettingsFile) : {};
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400, headers: NO_STORE },
    );
  }
  try {
    const userId = await getUserId();
    const settings = await saveSettings(userId, patch);
    return Response.json({ ok: true, settings }, { headers: NO_STORE });
  } catch (e) {
    const res = historyErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
