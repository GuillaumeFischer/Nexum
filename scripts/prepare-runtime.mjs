import fs from "node:fs/promises";
import path from "node:path";
if (process.platform !== "win32" || process.arch !== "x64")
  throw Error("Fabrique la version Windows x64 sur Windows x64.");
await fs.mkdir("runtime", { recursive: true });
await fs.copyFile(process.execPath, path.join("runtime", "node.exe"));
const r = await fetch(
  `https://raw.githubusercontent.com/nodejs/node/v${process.versions.node}/LICENSE`,
  { signal: AbortSignal.timeout(30000) },
);
if (!r.ok) throw Error("Licence Node.js indisponible.");
await fs.writeFile("runtime/LICENSE-node.txt", await r.text());
console.log("Runtime Node " + process.versions.node + " inclus.");
