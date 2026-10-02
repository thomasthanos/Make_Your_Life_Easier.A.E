import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { crc32, deflateRawSync } from "node:zlib";

const source = new URL("../extension/", import.meta.url);
const firefox = new URL("../extension/firefox/", import.meta.url);

const sharedFiles = [
  "psl.js",
  "background.js",
  "content.js",
  "passkeys.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "icons/32.png",
  "icons/128.png",
];

await mkdir(new URL("icons/", firefox), { recursive: true });

for (const file of sharedFiles) {
  await copyFile(new URL(file, source), new URL(file, firefox));
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const sum = crc32(data);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    local.writeUInt16LE(8, 8); // Deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(sum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);

    localParts.push(local, compressed);
    centralParts.push(central);
    offset += local.length + compressed.length;
  }

  const centralSize = centralParts.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

const loadedShared = await Promise.all(
  sharedFiles.map(async (name) => ({
    name,
    data: await readFile(new URL(name, source)),
  })),
);

// Chrome Web Store & Edge Add-ons reject the unpacked `key` field on upload.
const chromeManifest = JSON.parse(await readFile(new URL("manifest.json", source), "utf8"));
delete chromeManifest.key;
const chromeManifestBuf = Buffer.from(`${JSON.stringify(chromeManifest, null, 2)}\n`, "utf8");

const firefoxManifestBuf = await readFile(new URL("manifest.json", firefox));

await rm(new URL("extension.zip", source), { force: true });
await writeFile(
  new URL("myle-passwords-chrome.zip", source),
  buildZip([{ name: "manifest.json", data: chromeManifestBuf }, ...loadedShared]),
);
await writeFile(
  new URL("myle-passwords-firefox.zip", source),
  buildZip([{ name: "manifest.json", data: firefoxManifestBuf }, ...loadedShared]),
);

