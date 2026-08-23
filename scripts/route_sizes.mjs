import fs from "fs";

const routes = {
  "/library": ".next/server/app/library/page_client-reference-manifest.js",
  "/library/[...entry]": ".next/server/app/library/[...entry]/page_client-reference-manifest.js",
  "/library/primitive/[glyph]": ".next/server/app/library/primitive/[glyph]/page_client-reference-manifest.js",
  "/lists": ".next/server/app/lists/page_client-reference-manifest.js",
  "/learn": ".next/server/app/learn/page_client-reference-manifest.js",
  "/progress": ".next/server/app/progress/page_client-reference-manifest.js",
  "/session": ".next/server/app/session/page_client-reference-manifest.js",
  "/current": ".next/server/app/current/page_client-reference-manifest.js",
  "/dev/scheduling": ".next/server/app/dev/scheduling/page_client-reference-manifest.js",
};

for (const [route, file] of Object.entries(routes)) {
  if (!fs.existsSync(file)) { console.log(route, "manifest not found"); continue; }
  const src = fs.readFileSync(file, "utf8");
  const marker = '"] = ';
  const idx = src.indexOf(marker);
  const jsonStr = src.slice(idx + marker.length).replace(/;\s*$/, "");
  const manifest = JSON.parse(jsonStr);
  const chunks = new Set();
  for (const mod of Object.values(manifest.clientModules)) {
    for (const c of mod.chunks || []) chunks.add(c);
  }
  let total = 0;
  for (const c of chunks) {
    const p = ".next" + c.replace(/^\/_next/, "/static").replace(/^\/static/, "/static");
    // c looks like /_next/static/chunks/xxx.js -> .next/static/chunks/xxx.js
    const localPath = ".next" + c.replace(/^\/_next/, "");
    try {
      total += fs.statSync(localPath).size;
    } catch (e) {
      console.log("  missing:", localPath);
    }
  }
  console.log(route, (total / 1024 / 1024).toFixed(2), "MB across", chunks.size, "chunks");
}
