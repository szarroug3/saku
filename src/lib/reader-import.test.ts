import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkUrl, ImportError, isPrivateAddress, pageText } from "./reader-import";

describe("isPrivateAddress", () => {
  it("refuses this machine, private networks, link-local and the metadata address", () => {
    for (const a of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::"]) {
      assert.equal(isPrivateAddress(a), true, a);
    }
  });
  it("lets public addresses through", () => {
    for (const a of ["8.8.8.8", "142.250.72.14", "2606:4700:4700::1111"]) assert.equal(isPrivateAddress(a), false, a);
  });
  it("refuses anything that isn't an address", () => assert.equal(isPrivateAddress("example.com"), true));
});

describe("checkUrl", () => {
  it("takes an https page", () => assert.equal(checkUrl(" https://www3.nhk.or.jp/news/easy/ ").hostname, "www3.nhk.or.jp"));
  it("refuses other schemes, odd ports, credentials and local names", () => {
    for (const u of ["file:///etc/passwd", "ftp://example.com/", "http://example.com:8080/", "https://a:b@example.com/", "http://localhost/", "http://127.0.0.1/", "http://[::1]/", "http://intranet/", "http://metadata.google.internal/", "not a url"]) {
      assert.throws(() => checkUrl(u), ImportError, u);
    }
  });
});

describe("pageText", () => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>ニュース &amp; 天気</title><script>var x = "日本";</script><style>.a{}</style></head>
<body><nav><a>ホーム</a></nav><header>サイトの名前</header>
<article><h1>今日の天気</h1><p>東京は<ruby>晴<rt>は</rt></ruby>れです。<br>明日は雨&#12290;</p><p>Share this story</p><div>気温は&nbsp;二十度です。</div></article>
<footer>著作権</footer></body></html>`;
  const got = pageText(html);
  it("takes the title", () => assert.equal(got.title, "ニュース & 天気"));
  it("keeps the article's Japanese, a block to a line, without readings, menus, scripts or English lines", () => {
    assert.equal(got.text, "今日の天気\n東京は晴れです。\n明日は雨。\n気温は 二十度です。");
  });
  it("uses the whole body when there is no article or main", () => {
    assert.equal(pageText("<body><p>こんにちは</p><p>hello</p></body>").text, "こんにちは");
  });
});
