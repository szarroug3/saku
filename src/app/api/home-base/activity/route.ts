// GET /api/home-base/activity?since=<ISO>: the owner's quiz records for Home
// Base, the owner's private dashboard, which calls this server to server.
//
// No user session is involved. The caller proves itself with
// `Authorization: Bearer <HOME_BASE_TOKEN>`, and the records read are the ones
// on HOME_BASE_USER_ID's progress row, through the secret-key client since
// there is no cookie for Row Level Security to go by. Read only: nothing here
// writes. The rows' shape is in src/lib/home-base-activity.ts.

import { activitySince, bearerMatches } from "@/lib/home-base-activity";
import { createAdminClient } from "@/lib/supabase/admin";
import type { QuizSessionRecord } from "@/types/store";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  // The token first, and the same answer whether it is wrong, missing or not
  // configured, so a caller without it learns nothing about the setup.
  if (!bearerMatches(request.headers.get("authorization"), process.env.HOME_BASE_TOKEN)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const since = new URL(request.url).searchParams.get("since");
  const sinceMs = since ? Date.parse(since) : NaN;
  if (Number.isNaN(sinceMs)) {
    return Response.json({ error: "since must be an ISO time" }, { status: 400, headers: NO_STORE });
  }

  const userId = process.env.HOME_BASE_USER_ID;
  const supabase = createAdminClient();
  if (!userId || !supabase) {
    return Response.json({ error: "not configured" }, { status: 503, headers: NO_STORE });
  }

  const { data, error } = await supabase
    .from("progress")
    .select("history")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    return Response.json({ error: "could not read progress" }, { status: 502, headers: NO_STORE });
  }

  const history = (data?.history ?? {}) as { sessions?: unknown };
  const sessions = Array.isArray(history.sessions) ? (history.sessions as QuizSessionRecord[]) : [];
  const sessionsUrl = new URL("/sessions", request.url).toString();
  return Response.json({ activity: activitySince(sessions, sinceMs, sessionsUrl) }, { headers: NO_STORE });
}
