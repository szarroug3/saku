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
