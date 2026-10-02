// Pieces of the extension's page script (content.js) that need no page:
// `node --test scripts/tests/`.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../../extension/content.js", import.meta.url), "utf8");

/** One function of content.js, by name, run on its own. */
function pick(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `${name} is in content.js`);
  const end = source.indexOf("\n  }\n", start);
  return vm.runInNewContext(`(${source.slice(start, end + 4).trim()})`);
}

test("a 2FA key written on a setup page is told from other text", () => {
  const keyIn = pick("keyIn");
  // As sites write them: groups of four, either case, or one block.
  assert.equal(keyIn("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP"), "JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP");
  assert.equal(keyIn("  hxdm vjec jjws rb3h wizr 4ifu gftm xboz "), "hxdm vjec jjws rb3h wizr 4ifu gftm xboz");
  assert.equal(keyIn("HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ"), "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ");
  // The QR code's link, wherever it is written.
  assert.equal(
    keyIn('Or open otpauth://totp/Site:me?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=Site in your app'),
    "otpauth://totp/Site:me?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=Site",
  );
  // Not keys: words, mixed case, 0/1/8/9, too short.
  assert.equal(keyIn("AUTHENTICATIONREQUIRED"), null);
  assert.equal(keyIn("Scan this QR code with your app"), null);
  assert.equal(keyIn("HxDmVjEcJjWsRb3HwIzR4IfU"), null);
  assert.equal(keyIn("ORDER-1234-5678-9012-3456"), null);
  assert.equal(keyIn("JBSW Y3DP"), null);
});
