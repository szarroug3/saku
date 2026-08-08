#!/usr/bin/env node

// Glyph-origin ingest: per jōyō kanji, the FUNCTION (semantic / phonetic / form)
// and applicable SENSE of each component, parsed from English Wiktionary's
// Translingual `{{Han compound}}` markup.
//
//   {{Han compound|C1|C2|ls=TYPE|c1=X|c2=Y|t1=…|t2=…}}
//     ls   = overall structure (psc phono-semantic, ic ideogrammic, …)
//     cN   = function of component N: s semantic, p phonetic, f form
//     tN   = the applicable SENSE gloss of component N
//   Positional params (no `=`) are the components, in order. alt N is a display
//   variant only (肝: 肉|alt1=⺼) — the positional glyph (肉) is what we keep.
//
// Source: en.wiktionary.org, CC BY-SA. Raw wikitext via ?action=raw. Throttled
// to ~2 req/sec, cached under the scratch dir so re-runs don't re-hit the net.
//
// Usage:
//   node scripts/ingest/kanji-etymology.mjs --sample   # pilot (60 chars) + report
//   node scripts/ingest/kanji-etymology.mjs            # full jōyō run + emit JSON
//
// Emits src/data/generated/kanji-etymology.json shaped per kanji:
//   { "河": { "type": "phono-semantic",
//             "components": [ { "glyph": "水", "function": "semantic", "sense": null },
//                             { "glyph": "可", "function": "phonetic", "sense": null } ] } }
// The JOIN to KanjiVG shape pieces is done at RUNTIME by the loader
// (src/data/kanji-etymology.ts); this file stays the raw parsed origin.

import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const GEN = join(REPO, "src", "data", "generated");
const CACHE = process.env.WIKT_CACHE ||
  "/private/tmp/claude-501/-Users-samreenzarroug/f03c886e-8641-4aec-ba48-d8d89776fd99/scratchpad/wikt-cache";

// KanjiVG comps + variant map, used to SCORE competing glyph-origin theories
// (河 lists 水+何 and 水+可; we keep the one that best explains the real shape).
const _comp = JSON.parse(readFileSync(join(GEN, "kanji-components.json"), "utf8"));
const COMPS = _comp.comps;
const VARIANTS = _comp.variants;
// Wiktionary-side form equivalences — mirror of EXTRA_FORMS in the loader.
const EXTRA_FORMS = {
  "⺼": "肉", "⺡": "水", "氵": "水", "⺾": "艸", "艹": "艸", "⺗": "心",
  "忄": "心", "辶": "辵", "⻌": "辵", "⻍": "辵", "𠆢": "人", "⺅": "人",
  "王": "玉", "礻": "示", "衤": "衣", "飠": "食", "⻞": "食", "每": "毎",
};
function canonical(g) {
  for (let i = 0; i < 4; i++) {
    const n = EXTRA_FORMS[g] ?? VARIANTS[g];
    if (n === undefined || n === g) break;
    g = n;
  }
  return g;
}
// How many of a parse's components line up with the kanji's KanjiVG pieces.
function alignScore(components, kanji) {
  const pieces = (COMPS[kanji] ?? []).map(canonical);
  const pool = [...pieces];
  let score = 0;
  for (const c of components) {
    const cc = canonical(c.glyph);
    const i = pool.indexOf(cc);
    if (i !== -1) {
      score++;
      pool.splice(i, 1);
    }
  }
  return score;
}

const UA =
  "saku-language-app/1.0 (educational Japanese app; https://github.com/; szarroug3@gmail.com)";

const SAMPLE = [
  // Required by the brief:
  "肝", "服", "明", "河", "語", "海", "時", "好", "林", "六", "一", "人", "山",
  // Extra spread: pictographs, psc, ideogrammic, common radicals:
  "水", "火", "木", "口", "日", "月", "田", "目", "大", "小", "中",
  "休", "体", "持", "情", "社", "学", "校", "村", "町", "森",
  "話", "読", "聞", "花", "草", "虫", "石", "空", "雨", "電",
  "男", "父", "母", "犬", "牛", "馬", "鳥", "魚", "米", "肉",
  "手", "足", "耳", "心", "門", "問", "間", "銅", "鉄", "銀",
].filter((c) => /\p{Script=Han}/u.test(c));

async function fetchRaw(char) {
  const cp = char.codePointAt(0).toString(16);
  const path = join(CACHE, `${cp}.wikitext`);
  try {
    const s = await stat(path);
    if (s.size > 0) return readFile(path, "utf8");
  } catch {
    /* not cached */
  }
  const url =
    "https://en.wiktionary.org/w/index.php?title=" +
    encodeURIComponent(char) +
    "&action=raw";
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 404) {
    await mkdir(CACHE, { recursive: true });
    await writeFile(path, "");
    return "";
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${char}`);
  const text = await res.text();
  await mkdir(CACHE, { recursive: true });
  await writeFile(path, text);
  await sleep(500); // ~2 req/sec, only after a real network hit
  return text;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Split a template body on top-level `|`, ignoring `|` inside nested {{ }} / [[ ]].
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth++;
      cur += two;
      i++;
    } else if (two === "}}" || two === "]]") {
      depth--;
      cur += two;
      i++;
    } else if (body[i] === "|" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += body[i];
    }
  }
  parts.push(cur);
  return parts;
}

// Pull EVERY `{{Han compound … }}` body from the wikitext (balanced braces).
// A page can list several competing glyph-origin theories (明 has four); the
// caller scores them against the kanji's real shape to pick the best fit.
function extractHanCompounds(text) {
  const marker = "{{Han compound";
  const out = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf(marker, from);
    if (start === -1) return out;
    let depth = 0;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      const two = text.slice(i, i + 2);
      if (two === "{{") {
        depth++;
        i++;
      } else if (two === "}}") {
        depth--;
        i++;
        if (depth === 0) {
          out.push(text.slice(start + 2, i - 1));
          end = i;
          break;
        }
      }
    }
    if (end === -1) return out; // unbalanced; stop
    from = end;
  }
}

// Cheap wiki-markup → plain text for sense glosses.
function cleanGloss(s) {
  if (s == null) return null;
  let out = s.trim();
  out = out.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1"); // [[a|b]] -> b
  out = out.replace(/\[\[([^\]]*)\]\]/g, "$1"); // [[a]] -> a
  out = out.replace(/\{\{[^}]*\}\}/g, ""); // drop templates
  out = out.replace(/'''?/g, "").trim(); // bold/italic
  return out === "" ? null : out;
}

function normType(ls) {
  if (!ls) return null;
  const t = ls.trim().toLowerCase();
  const map = {
    psc: "phono-semantic",
    ic: "ideogrammic",
    p: "pictographic",
    pict: "pictographic",
    pictograph: "pictographic",
    i: "indicative",
    scc: "semantic-compound",
  };
  return map[t] ?? t;
}

function fnFor(code, type) {
  if (code) {
    const c = code.trim().toLowerCase();
    if (c === "s") return "semantic";
    if (c === "p") return "phonetic";
    if (c === "f") return "form";
    return null; // unknown code → don't guess
  }
  // No per-component code. Ideogrammic components are semantic by definition.
  if (type === "ideogrammic") return "semantic";
  return null;
}

// Parse a Han compound body into { type, components:[{glyph,function,sense}] }.
export function parseHanCompound(body) {
  const raw = splitTopLevel(body);
  // First segment is the template name ("Han compound"); drop it.
  const params = raw.slice(1);
  const named = {};
  const positional = [];
  for (const p of params) {
    const m = /^\s*([A-Za-z][A-Za-z0-9]*)\s*=([\s\S]*)$/.exec(p);
    if (m) named[m[1].toLowerCase()] = m[2];
    else {
      const v = p.trim();
      if (v) positional.push(v);
    }
  }
  // A component is normally a bare glyph; if the source wrapped it in markup,
  // keep only the Han character(s) so junk never lands in `glyph`.
  for (let i = 0; i < positional.length; i++) {
    let v = positional[i];
    v = v.replace(/<[^>]+>/g, ""); // strip HTML (安's 女<sub>2</sub> → 女2)
    if (/[{}[\]=|<>]/.test(positional[i]) || v !== positional[i]) {
      const han = (v.match(/\p{Script=Han}/gu) ?? []).join("");
      positional[i] = han || v;
    }
  }
  const type = normType(named.ls ?? named.t2type ?? named.type);
  const components = positional.map((glyph, idx) => {
    const n = idx + 1;
    return {
      glyph,
      function: fnFor(named[`c${n}`], type),
      sense: cleanGloss(named[`t${n}`] ?? null),
    };
  });
  return { type, components };
}

// The duplication family (林 木木, 森 木木木, 炎 火火) is written not as a Han
// compound but as {{zh-etym-double|木|tree}} / {{zh-etym-triple|…}}: one glyph
// repeated, all copies semantic with the same sense.
function parseDuplication(text) {
  const m = /\{\{zh-etym-(double|triple)\|([^|}]+)(?:\|([^|}]*))?[^}]*\}\}/.exec(
    text,
  );
  if (!m) return null;
  const count = m[1] === "triple" ? 3 : 2;
  const glyph = m[2].trim();
  const sense = cleanGloss(m[3] ?? null);
  return {
    type: "ideogrammic",
    components: Array.from({ length: count }, () => ({
      glyph,
      function: "semantic",
      sense,
    })),
  };
}

// The wikitext of the ===Glyph origin=== subsection (Translingual is the first
// section on every CJK page, so the first such heading is the one we want).
function extractGlyphOriginRaw(text) {
  const m = /(={3,})\s*Glyph origin\s*\1\s*\n([\s\S]*?)(?:\n={2,}[^=]|\n----|$)/.exec(
    text,
  );
  if (!m) return null;
  const block = m[2].trim();
  return block === "" ? null : block;
}

const TYPE_LABEL = {
  psc: "Phono-semantic compound",
  ic: "Ideogrammic compound",
  scc: "Ideogrammic compound",
  i: "Ideographic",
  p: "Pictogram",
};

// Render a {{Han compound|…}} body to a plain readable clause.
function renderHanCompound(body) {
  const { type: _t, components } = parseHanCompound(body);
  const ls = /\|\s*ls\s*=\s*([a-z]+)/i.exec("|" + body);
  const label = ls ? TYPE_LABEL[ls[1].toLowerCase()] ?? "Compound" : "Compound";
  const parts = components
    .map((c) => {
      const fn = c.function ? `${c.function} ` : "";
      const sense = c.sense ? ` (${c.sense})` : "";
      return `${fn}${c.glyph}${sense}`;
    })
    .join(" + ");
  return `${label}: ${parts}`;
}

// Best-effort mechanical clean of glyph-origin wikitext into learner-facing
// prose. STRIPS scholarly noise (OC/MC reconstructions, IPA, ref tags) and
// resolves the common etym/link templates; does NOT rewrite meaning. Returns
// null when nothing readable survives. A second, human/LLM pass is expected to
// rewrite whatever this leaves awkward — this only removes markup.
function cleanOriginText(raw) {
  if (!raw) return null;
  let s = raw;

  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "").replace(/<ref[^>]*\/>/gi, "");
  s = s.replace(/<\/?[a-z][^>]*>/gi, "");

  // Image/file embeds → gone (drop the whole [[File:…|thumb|…|caption]]).
  s = s.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "");

  // Pictogram / ideogram lead templates → a plain word (so a bare "{{pictogram}}:
  // a horizontal stroke" reads "Pictogram: a horizontal stroke").
  s = s.replace(/\{\{pictogram[^}]*\}\}/gi, "Pictogram");
  s = s.replace(/\{\{ideogram(?:mic)?[^}]*\}\}/gi, "Ideogram");

  // Scaffolding / maintenance templates → gone.
  s = s.replace(/\{\{Han (?:etym|etyl|char|ref)[^}]*\}\}/gi, "");
  s = s.replace(/\{\{(?:attention|rf[a-z-]*|catlangname|senseid)[^}]*\}\}/gi, "");

  // Duplication templates → words.
  s = s.replace(/\{\{zh-etym-triple\|([^|}]+)(?:\|([^|}]*))?[^}]*\}\}/gi,
    (_m, g, gl) => (gl ? `tripled ${g} (${gl})` : `tripled ${g}`));
  s = s.replace(/\{\{zh-etym-double\|([^|}]+)(?:\|([^|}]*))?[^}]*\}\}/gi,
    (_m, g, gl) => (gl ? `doubled ${g} (${gl})` : `doubled ${g}`));

  // Han compound → readable clause (there may be several; render each).
  s = s.replace(/\{\{Han compound\|([^{}]*)\}\}/gi, (_m, inner) =>
    renderHanCompound("Han compound|" + inner));

  // Link/mention templates → their glyph text, stars and glosses dropped.
  //   {{och-l|*凡|tray}} {{zh-l|*森}} {{m|zh|水}} {{l|mul|水}} {{lang|zh|水}}
  s = s.replace(/\{\{(?:och-l|zh-l|ltc-l|och-p)\|\*?([^|}]+)[^}]*\}\}/gi, "$1");
  s = s.replace(/\{\{(?:m|l|lang|w|zh-m)\|[a-z-]+\|\*?([^|}]+)[^}]*\}\}/gi, "$1");
  s = s.replace(/\{\{(?:m|l)\|\*?([^|}]+)[^}]*\}\}/gi, "$1");
  // Any leftover template: keep CJK chars inside it, else drop.
  s = s.replace(/\{\{[^{}]*\}\}/g, (m) => {
    const han = (m.match(/\p{Script=Han}/gu) ?? []).join("");
    return han;
  });

  // Wikilinks → their display text.
  s = s.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1");
  s = s.replace(/\[\[([^\]]*)\]\]/g, "$1");

  // Reconstruction tokens: a leading * on a glyph is just noise (*森 → 森); a
  // * on a romanised/IPA reconstruction (*ŋaʔ, *[b]ək) drops whole.
  s = s.replace(/\*(?=\p{Script=Han})/gu, "");
  s = s.replace(/\*\[?[A-Za-zɑ-ʯˀ-ˑ][^\s,;.()]*/g, "");
  s = s.replace(/\/[^/\n]{1,40}\//g, ""); // /…/ IPA slashes

  s = s.replace(/'''?/g, ""); // bold/italic

  // Line-level tidy: drop enumerated alternate-form bullets (`* …`), which are
  // always the scholarly "other attested forms" noise, and the wikitext `:`
  // indent that leads many pictograph glosses.
  s = s
    .split("\n")
    .filter((ln) => !/^\s*\*/.test(ln))
    .map((ln) => ln.replace(/^\s*:+\s*/, "").trimEnd())
    .join("\n");

  s = s.replace(/ +([,;.])/g, "$1"); // space before punct
  s = s.replace(/\(\s*\)/g, ""); // empty parens left by stripping
  s = s.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
  // Drop a dangling leading dash/colon/period left when the lead template went.
  s = s.replace(/^[\s–—:.-]+/, "").replace(/\s+$/, "").trim();
  // A single space after sentence punctuation, and no space before a newline.
  s = s.replace(/[ \t]*\n[ \t]*/g, " ").trim();

  return s === "" ? null : s;
}

export function parseKanji(text, kanji) {
  const bodies = extractHanCompounds(text);
  let structured = null;
  if (bodies.length) {
    // Keep the theory that best explains the actual KanjiVG shape; ties keep the
    // first (the accepted etymology usually leads the section).
    let best = null;
    let bestScore = -1;
    for (const b of bodies) {
      const parsed = parseHanCompound(b);
      const score = kanji ? alignScore(parsed.components, kanji) : 0;
      if (score > bestScore) {
        bestScore = score;
        best = parsed;
      }
    }
    structured = best;
  } else {
    structured = parseDuplication(text);
    if (!structured) {
      if (/\{\{pictogram/i.test(text)) structured = { type: "pictographic", components: [] };
      else if (/\{\{ideogram/i.test(text)) structured = { type: "ideogrammic", components: [] };
    }
  }

  const originRaw = extractGlyphOriginRaw(text);
  const originText = cleanOriginText(originRaw);
  if (!structured && !originRaw) return null;
  return {
    type: structured?.type ?? null,
    components: structured?.components ?? [],
    originRaw,
    originText,
  };
}

async function jouyouSet() {
  const order = JSON.parse(await readFile(join(GEN, "order.json"), "utf8"));
  return order.map((r) => r.c);
}

async function main() {
  const sampleMode = process.argv.includes("--sample");
  const chars = sampleMode ? SAMPLE : await jouyouSet();
  const out = {};
  let done = 0;
  const failed = [];
  for (const c of chars) {
    let text;
    try {
      text = await fetchRaw(c);
    } catch (e) {
      failed.push([c, String(e)]);
      continue;
    }
    const parsed = parseKanji(text, c);
    if (parsed && (parsed.components.length > 0 || parsed.type || parsed.originRaw))
      out[c] = parsed;
    done++;
    if (!sampleMode && done % 100 === 0) {
      process.stderr.write(`  fetched ${done}/${chars.length}\n`);
    }
  }

  if (sampleMode) {
    console.log("=== PILOT: parsed Han compound per sample kanji ===\n");
    for (const c of chars) {
      const p = out[c];
      if (!p) {
        console.log(`${c}  —  (no Han compound / pictograph)`);
        continue;
      }
      const comps = p.components
        .map(
          (x) =>
            `${x.glyph}[${x.function ?? "?"}${x.sense ? `:"${x.sense}"` : ""}]`,
        )
        .join(" + ");
      console.log(`${c}  ${p.type ?? "?"}  →  ${comps || "(no components)"}`);
      if (p.originText) console.log(`     originText: ${p.originText}`);
      else if (p.originRaw) console.log(`     originText: (null — raw kept)`);
    }
    if (failed.length) {
      console.log("\nFAILED:", failed);
    }

    // Glyph-origin prose QUALITY SPLIT + LENGTH picture.
    const withRaw = Object.values(out).filter((p) => p.originRaw);
    const crossRefs = (t) =>
      (t.match(/\b(?:Compare|Unrelated|See also|Contrast|Related to)\b/gi) ?? [])
        .length;
    const isMessy = (t) =>
      t == null ||
      /[{}\[\]]|Baxter|Zhengzhang|Middle Chinese|Old Chinese|reconstruct/i.test(t) ||
      crossRefs(t) >= 2 ||
      t.length > 220;
    const clean = withRaw.filter((p) => !isMessy(p.originText));
    const messy = withRaw.filter((p) => isMessy(p.originText));
    const lens = withRaw
      .map((p) => p.originText?.length ?? 0)
      .sort((a, b) => a - b);
    const max = lens[lens.length - 1] ?? 0;
    const over120 = lens.filter((n) => n > 120).length;
    const over200 = lens.filter((n) => n > 200).length;
    const longest = withRaw
      .filter((p) => p.originText)
      .sort((a, b) => b.originText.length - a.originText.length)[0];
    console.log("\n=== originText QUALITY SPLIT ===");
    console.log(`with a glyph-origin section: ${withRaw.length}`);
    console.log(`  mechanically clean/readable: ${clean.length}`);
    console.log(`  messy/awkward/null (need rewrite): ${messy.length}`);
    console.log("\n=== originText LENGTH picture (decides inline vs hidden) ===");
    console.log(`  longest cleaned: ${max} chars`);
    console.log(`  over ~1 line (>120 chars): ${over120}/${withRaw.length}`);
    console.log(`  over 200 chars: ${over200}/${withRaw.length}`);
    if (longest)
      console.log(`  longest is for a kanji with ${longest.originText.length} chars`);
    // Write the sample output for the join/coverage report step.
    await writeFile(
      join(CACHE, "sample-parsed.json"),
      JSON.stringify(out, null, 2),
    );
    console.log(`\n(${Object.keys(out).length}/${chars.length} produced a record)`);
    return;
  }

  // Full run: emit the generated dataset, key-sorted for a stable diff.
  const sorted = {};
  for (const c of Object.keys(out).sort()) sorted[c] = out[c];
  const header = {
    _license:
      "Derived from English Wiktionary (en.wiktionary.org) glyph-origin markup, " +
      "CC BY-SA 4.0. See src/data/generated/LICENSE and src/data/attribution.ts.",
    _generator: "scripts/ingest/kanji-etymology.mjs",
  };
  await writeFile(
    join(GEN, "kanji-etymology.json"),
    JSON.stringify({ ...header, data: sorted }, null, 0) + "\n",
  );
  process.stderr.write(
    `\nWrote ${Object.keys(sorted).length} records to kanji-etymology.json\n`,
  );
  if (failed.length) {
    process.stderr.write(`FAILED ${failed.length}: ${JSON.stringify(failed.slice(0, 20))}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
