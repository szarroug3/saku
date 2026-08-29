// The SERVING path, not just the data.
//
// The bug in tasks/04-p0-corpus-tagger.md was reported as a URL —
// /api/grammar-example?recipe=node returning 「ログアウトするんじゃなかったよ。」 —
// so the regression test is a URL too. Asserting on CORPUS alone would leave
// the route free to pick differently.
//
// The route is a Next 16 Route Handler over the Web Request/Response APIs
// (node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md),
// which means it is a plain async function of a Request and can be called
// directly here with no server and no harness.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { GET } from "./route.ts";
import { CORPUS_META } from "../../../data/grammar/corpus.ts";

const call = async (qs: string) =>
  GET(new Request(`http://t/api/grammar-example${qs}`));

describe("GET /api/grammar-example", () => {
  test("the 〜ので example it serves actually contains ので", async () => {
    const body = (await (await call("?recipe=node")).json()) as { jp: string } | null;
    assert.ok(body, "node has examples, so it must serve one");
    assert.ok(body.jp.includes("ので"), `served as an example of ので: ${body.jp}`);
    assert.notEqual(body.jp, "ログアウトするんじゃなかったよ。");
  });

  test("a pattern with no examples answers null, and does not 500", async () => {
    // stem-form is empty for a real, structural reason (see
    // grammar.NO_SIGNATURE / CORPUS_META.noSignature: its `pattern` string is
    // a display placeholder, not real text) and is the live case. A learner on
    // that lesson card must get a card without an example panel, not an error —
    // lesson-item-view.tsx renders nothing when the body is null, and PairedRow
    // collapses to its wide half. Nothing here is allowed to throw.
    assert.ok(
      Object.prototype.hasOwnProperty.call(CORPUS_META.noSignature, "stem-form"),
      "stem-form should still be a documented no-example recipe",
    );
    const res = await call("?recipe=stem-form");
    assert.equal(res.status, 200);
    assert.equal(await res.json(), null);
  });

  test("ta-ato-de now serves its SAK-276 hand-authored example, not null", async () => {
    // Was the "a pattern with no examples" live case (CORPUS_META.perPattern
    // still reports 0 real Tatoeba matches — it is genuinely corpus-scarce)
    // until authored.ts gave it one hand-picked reference sentence.
    assert.equal(CORPUS_META.perPattern["ta-ato-de"], 0);
    const body = (await (await call("?recipe=ta-ato-de")).json()) as { jp: string } | null;
    assert.ok(body, "ta-ato-de has a hand-authored example, so it must serve one");
    assert.ok(body.jp.includes("たあとで"), `served as an example of たあとで: ${body?.jp}`);
  });

  test("an unknown recipe is the same shape, not an error", async () => {
    const res = await call("?recipe=not-a-recipe");
    assert.equal(res.status, 200);
    assert.equal(await res.json(), null);
  });

  test("a missing recipe is a 400", async () => {
    assert.equal((await call("")).status, 400);
  });
});
