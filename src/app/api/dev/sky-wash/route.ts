// Dev-only: the wash editor's back end. GET returns the model parsed from
// src/app/sky-wash.css; POST validates a model, renders the file from it
// (knobs, the stardust tile and the Milky Way field from the star knobs, the
// generated layer list, keeping the trailing rules verbatim), writes it, and
// on request re-bakes public/sky/wash-baked.png. Refuses outside development.

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

import { pngDataUrl } from "@/sky/lib/png-encode";
import { stardustPixels, TILE_PX } from "@/sky/lib/sky-stars";
import { parseWashFile, renderWashFile, trailingRules, validateModel, type WashModel } from "@/sky/lib/sky-wash-file";

const run = promisify(execFile);
const FILE = path.join(process.cwd(), "src/app/sky-wash.css");

const devOnly = () => (process.env.NODE_ENV === "development" ? null : NextResponse.json({ error: "dev only" }, { status: 404 }));

export async function GET() {
  const blocked = devOnly(); if (blocked) return blocked;
  const css = await readFile(FILE, "utf8");
  try {
    return NextResponse.json({ model: parseWashFile(css) });
  } catch (err) {
    return NextResponse.json({ error: `sky-wash.css did not parse: ${String(err)}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const blocked = devOnly(); if (blocked) return blocked;
  const body = (await req.json().catch(() => null)) as { model?: WashModel; bake?: boolean } | null;
  if (!body?.model) return NextResponse.json({ error: "no model" }, { status: 400 });
  const problem = validateModel(body.model);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const css = await readFile(FILE, "utf8");
  const stardust = pngDataUrl(stardustPixels(body.model.stars), TILE_PX, TILE_PX);
  await writeFile(FILE, renderWashFile(body.model, stardust, trailingRules(css)));

  let baked = false;
  if (body.bake) {
    await run("node", ["scripts/bake-sky-wash.mjs"], { cwd: process.cwd() });
    baked = true;
  }
  return NextResponse.json({ ok: true, layers: body.model.layers.length, baked });
}
