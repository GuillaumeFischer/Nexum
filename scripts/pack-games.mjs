import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { once } from "node:events";
import yazl from "yazl";
import { fileURLToPath } from "node:url";
import {
  readJSON,
  ID,
  VERSION,
  githubDistribution,
} from "../packages/core/config.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
await fs.mkdir(path.join(root, "artifacts"), { recursive: true });
const distribution = await readJSON(path.join(root, "distribution.json")),
  games = [];
for (const id of (await fs.readdir(path.join(root, "games"))).sort()) {
  if (!ID.test(id)) continue;
  const dir = path.join(root, "games", id),
    manifest = await readJSON(path.join(dir, "game.json"));
  if (manifest.id !== id || !VERSION.test(manifest.version))
    throw Error("Fiche du jeu invalide.");
  const name = `${id}-${manifest.version}-win-x64.zip`,
    file = path.join(root, "artifacts", name),
    zip = new yazl.ZipFile();
  async function walk(relative = "") {
    for (const entry of (
      await fs.readdir(path.join(dir, relative), { withFileTypes: true })
    ).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      if (
        ["node_modules", "data", ".env", ".git"].includes(entry.name) ||
        entry.name.startsWith(".env")
      )
        continue;
      const next = relative ? relative + "/" + entry.name : entry.name;
      if (entry.isSymbolicLink()) throw Error("Lien interdit dans un jeu.");
      if (entry.isDirectory()) await walk(next);
      else {
        const options = {
          mtime: new Date(2000, 0, 1, 12, 0, 0),
          forceDosTimestamp: true,
          mode: 0o100644,
        };
        if (/\.(m?js|cjs|json|html|css|md|txt|svg)$/.test(next))
          zip.addBuffer(Buffer.from((await fs.readFile(path.join(dir,next),'utf8')).replace(/\r\n/g,'\n')),next,options);
        else zip.addFile(path.join(dir,next),next,options);
      }
    }
  }
  await walk();
  const output = createWriteStream(file);
  zip.outputStream.pipe(output);
  zip.end();
  await once(output, "close");
  const bytes = await fs.readFile(file),
    tag = `game-${id}-v${manifest.version}`;
  games.push({
    ...manifest,
    url: githubDistribution(distribution)
      ? `https://github.com/${distribution.owner}/${distribution.repo}/releases/download/${tag}/${name}`
      : null,
    archive: name,
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
await fs.writeFile(
  path.join(root, "catalog", "local.json"),
  JSON.stringify({ schema: 1, games }, null, 2),
);
if (githubDistribution(distribution))
  await fs.writeFile(
    path.join(root, "catalog", "catalog.json"),
    JSON.stringify(
      {
        schema: 1,
        games: games.map(({ archive, adapter, client, ...game }) => game),
      },
      null,
      2,
    ),
  );
console.log(
  games
    .map((g) => g.id + " " + g.version + " : " + g.size + " octets")
    .join("\n"),
);
