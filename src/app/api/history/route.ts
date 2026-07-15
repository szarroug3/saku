// GET /api/history — the full history file. Port of the legacy Python
// handler's /api/history branch.

import { loadHistory } from "@/lib/history";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  return Response.json(loadHistory(), { headers: NO_STORE });
}
