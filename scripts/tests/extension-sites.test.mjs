// The extension's idea of one site (background.js), run in a stand-in for the
// browser: `node --test scripts/tests/`.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const extension = new URL("../../extension/", import.meta.url);

async function background() {
  const listener = { addListener() {} };
  const context = vm.createContext({
    chrome: {
      runtime: { getURL: () => "chrome-extension://test/", onMessage: listener, id: "test" },
      tabs: { onRemoved: listener },
    },
    crypto: globalThis.crypto,
    URL,
  });
  context.globalThis = context;
  for (const file of ["psl.js", "background.js"]) {
    vm.runInContext(await readFile(new URL(file, extension), "utf8"), context, { filename: file });
  }
  return context;
}

test("hosts of one owner are one site", async () => {
  const { sameSite } = await background();
  assert.equal(sameSite("https://login.example.com/a", "https://example.com/b"), true);
  assert.equal(sameSite("https://accounts.example.com/", "https://www.example.com/"), true);
  assert.equal(sameSite("https://a.b.example.co.uk/", "https://example.co.uk/"), true);
  assert.equal(sameSite("http://localhost:3000/", "http://localhost:5173/"), true);
});

test("names on a shared suffix are not one site", async () => {
  const { sameSite } = await background();
  assert.equal(sameSite("https://attacker.github.io/", "https://github.io/"), false);
  assert.equal(sameSite("https://attacker.github.io/", "https://victim.github.io/"), false);
  assert.equal(sameSite("https://evil.blogspot.com/", "https://blogspot.com/"), false);
  assert.equal(sameSite("https://example.co.uk/", "https://co.uk/"), false);
  assert.equal(sameSite("https://a.example.com/", "https://example.org/"), false);
  assert.equal(sameSite("https://127.0.0.1/", "https://0.0.1/"), false);
});

test("wildcard and exception rules are followed", async () => {
  const { siteOf } = await background();
  assert.equal(siteOf("foo.bar.ck"), "foo.bar.ck");
  assert.equal(siteOf("a.www.ck"), "www.ck");
  assert.equal(siteOf("shop.city.kawasaki.jp"), "city.kawasaki.jp");
  assert.equal(siteOf("xn--80ak6aa92e.xn--p1ai"), "xn--80ak6aa92e.xn--p1ai");
});
