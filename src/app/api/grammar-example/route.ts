// GET /api/grammar-example?recipe=<id> — the first worked example for a
// grammar recipe. A third route shape alongside the other two in this
// directory, and deliberately so, not an oversight:
//   - no auth check, like /api/tts and /api/pitch-tts: `examplesFor` is a
//     pure, deterministic Map lookup over the committed grammar corpus, the
//     same "public, non-sensitive" reasoning those two routes' own headers
//     give for their audio, not a per-user record;
//   - no try/catch: that same lookup (`BY_PATTERN.get(recipeId) ?? []`,
//     corpus.ts) cannot throw — there is no I/O, no parse, nothing external
//     on this path to catch a failure FROM;
//   - unconditional no-store rather than the audio routes' long-lived
//     immutable cache: this returns JSON to the client on every render’s
//     ordinary fetch cadence, not a byte payload meant to be reused across
//     requests the way a synthesized clip is.
import { examplesFor } from "@/data/grammar/corpus";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const recipe = new URL(request.url).searchParams.get("recipe");
  if (!recipe) {
    return Response.json(
      { error: "recipe is required" },
      { status: 400, headers: NO_STORE },
    );
  }
  const ex = examplesFor(recipe)[0];
  if (!ex) return Response.json(null, { headers: NO_STORE });
  return Response.json({ id: ex.id, jp: ex.jp, en: ex.en }, { headers: NO_STORE });
}
