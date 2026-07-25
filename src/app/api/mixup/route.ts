// POST /api/mixup — explicitly retire one open confusion record.

import { historyErrorResponse } from "@/lib/api-error";
import { getUserId } from "@/lib/auth";
import { clearMixup } from "@/lib/history";

const NO_STORE = { "Cache-Control": "no-store" };

interface MixupBody {
  key?: unknown;
  ts?: unknown;
}

export async function POST(request: Request) {
  let body: MixupBody;
  try {
    body = (await request.json()) as MixupBody;
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400, headers: NO_STORE },
    );
  }
  if (
    typeof body.key !== "string" ||
    !body.key.includes("·") ||
    typeof body.ts !== "number" ||
    !Number.isFinite(body.ts)
  ) {
    return Response.json(
      { error: "key must be a pair key and ts must be a timestamp" },
      { status: 400, headers: NO_STORE },
    );
  }
  try {
    const userId = await getUserId();
    await clearMixup(userId, body.key, body.ts);
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    const res = historyErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
