// Brings a web page into the reader (#BuildHybridAI): the server fetches it
// and keeps the Japanese text.
//
// The server fetches an address the learner typed, so the fetch is held to
// public web pages. Only http and https on their usual ports, and every
// address a host name resolves to is checked when the connection is made
// (the `lookup` below), so a name can't point at this server, the cloud's
// metadata address or a private network, even by changing what it resolves
// to between a check and the fetch. Redirects are followed by hand, each one
// checked the same way. The page is cut off at PAGE_BYTES and TIMEOUT_MS.
//
// The text is taken out with regular expressions. It is the page's
// <article> or <main> when it has one, without scripts, styles, menus,
// headers and footers, a block element to a line, and only the lines with
// Japanese in them.

import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";

export class ImportError extends Error {}

const PAGE_BYTES = 3_000_000;
const TIMEOUT_MS = 10_000;
const REDIRECTS = 4;

/** Whether an address is somewhere the server must not fetch from: this
 * machine, a private network, link-local (the cloud's metadata service is
 * 169.254.169.254), multicast or reserved. */
export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0)
      || (a === 198 && (b === 18 || b === 19));
  }
  if (net.isIPv6(address)) {
    const v6 = address.toLowerCase();
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return v6 === "::" || v6 === "::1"
      || v6.startsWith("fc") || v6.startsWith("fd")
      || /^fe[89ab]/.test(v6)
      || v6.startsWith("ff")
      || v6.startsWith("64:ff9b:")
      || v6.startsWith("::ffff:");
  }
  return true;
}

/** A URL the server may fetch, or why not. */
export function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ImportError("That isn't a web address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ImportError("Only http and https pages can be brought in.");
  if (url.username || url.password) throw new ImportError("Addresses with a name and password in them can't be brought in.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new ImportError("Only pages on the usual web ports can be brought in.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) ? isPrivateAddress(host) : host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || !host.includes(".")) {
    throw new ImportError("That page isn't on the public web.");
  }
  return url;
}

/** dns.lookup, refusing any private address. Used for every connection. */
const publicLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => isPrivateAddress(a.address));
    if (bad || !list.length) return callback(new ImportError("That page isn't on the public web."), "", 0);
    if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

interface Fetched {
  body: Buffer;
  type: string;
  url: URL;
}

function fetchOnce(url: URL): Promise<{ status: number; location?: string; body: Buffer; type: string }> {
  return new Promise((resolve, reject) => {
    const get = url.protocol === "https:" ? https.get : http.get;
    const req = get(url, {
      lookup: publicLookup,
      timeout: TIMEOUT_MS,
      headers: { "user-agent": "Saku reader", accept: "text/html,text/plain;q=0.9", "accept-encoding": "gzip, deflate, br" },
    }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        res.resume();
        return resolve({ status, location: res.headers.location, body: Buffer.alloc(0), type: "" });
      }
      const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
      const stream = enc === "gzip" ? res.pipe(zlib.createGunzip()) : enc === "deflate" ? res.pipe(zlib.createInflate()) : enc === "br" ? res.pipe(zlib.createBrotliDecompress()) : res;
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on("data", (c: Buffer) => {
        size += c.length;
        if (size > PAGE_BYTES) {
          req.destroy();
          reject(new ImportError("That page is too big to bring in."));
          return;
        }
        chunks.push(c);
      });
      stream.on("end", () => resolve({ status, body: Buffer.concat(chunks), type: String(res.headers["content-type"] ?? "") }));
      stream.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new ImportError("That page took too long to answer.")));
    req.on("error", reject);
  });
}

async function fetchPage(start: URL): Promise<Fetched> {
  let url = start;
  for (let hop = 0; hop <= REDIRECTS; hop++) {
    const got = await fetchOnce(url).catch((e: unknown) => {
      throw e instanceof ImportError ? e : new ImportError("That page couldn't be reached.");
    });
    if (got.location) {
      url = checkUrl(new URL(got.location, url).toString());
      continue;
    }
    if (got.status < 200 || got.status >= 300) throw new ImportError(`That page answered with an error (${got.status}).`);
    return { body: got.body, type: got.type, url };
  }
  throw new ImportError("That page redirects too many times.");
}

/** The page's own character set, from its header or its meta tag. Japanese
 * pages are still sometimes in Shift_JIS or EUC-JP. */
function decode(body: Buffer, type: string): string {
  const head = body.subarray(0, 4096).toString("latin1");
  const named = type.match(/charset=["']?([\w-]+)/i)?.[1] ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(named.toLowerCase()).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };

function unescape(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

/** The Japanese text of an HTML page, a block to a line, and its title. */
export function pageText(html: string): { title?: string; text: string } {
  const title = unescape(
    html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]
      ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?? "",
  ).replace(/\s+/g, " ").trim() || undefined;
  let body = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const tag of ["script", "style", "noscript", "template", "svg", "nav", "header", "footer", "aside", "form", "button", "select", "iframe"]) {
    body = body.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi"), " ");
  }
  // a reading over a word sits inside the sentence, so it goes without a gap
  body = body.replace(/<(rt|rp)\b[\s\S]*?<\/\1>/gi, "");
  const main = body.match(/<article\b[\s\S]*<\/article>/i)?.[0] ?? body.match(/<main\b[\s\S]*<\/main>/i)?.[0] ?? body.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? body;
  const text = unescape(
    main
      .replace(/<(br|hr)\b[^>]*>/gi, "\n")
      .replace(/<\/?(p|div|section|li|ul|ol|h[1-6]|tr|td|th|blockquote|pre|dd|dt|figcaption|table)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((l) => l.replace(/[ \t 　]+/g, " ").trim())
    .filter((l) => JAPANESE.test(l))
    .join("\n");
  return { title, text };
}

/** A web page's Japanese text, its title and where it ended up. */
export async function importPage(raw: string): Promise<{ title?: string; source: string; text: string }> {
  const page = await fetchPage(checkUrl(raw));
  const type = page.type.toLowerCase();
  if (type && !type.includes("text/html") && !type.includes("text/plain") && !type.includes("xhtml")) {
    throw new ImportError("That address isn't a web page.");
  }
  const decoded = decode(page.body, page.type);
  const { title, text } = type.includes("text/plain") ? { title: undefined, text: decoded } : pageText(decoded);
  if (!JAPANESE.test(text)) throw new ImportError("There's no Japanese on that page.");
  return { title, source: page.url.toString(), text };
}
