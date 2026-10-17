import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { githubDistribution, readJSON } from "../packages/core/config.mjs";
const distribution = await readJSON("distribution.json"),
  pkg = await readJSON("package.json");
if (!githubDistribution(distribution)) throw Error("Dépôt non configuré.");
const files = [
  `Atelier-Jeux-Setup-${pkg.version}.exe`,
  `Atelier-Jeux-Setup-${pkg.version}.exe.blockmap`,
  "latest.yml",
];
for (const file of files) await fs.access("release/" + file);
const notes = "release/notes.md";
await fs.writeFile(
  notes,
  `Atelier Jeux ${pkg.version}\n\nTélécharge **Atelier-Jeux-Setup-${pkg.version}.exe**, puis installe Deep Miners depuis ta bibliothèque.\n\nPour jouer à plusieurs, un joueur héberge une mine et partage son invitation. Les sauvegardes sont conservées sur son PC.\n\nWindows x64. Cette première version ne dispose pas de signature éditeur.\n`,
);
execFileSync(
  process.env.ATELIER_GH || "gh",
  [
    "release",
    "create",
    "v" + pkg.version,
    ...files.map((f) => "release/" + f),
    "--repo",
    distribution.owner + "/" + distribution.repo,
    "--target",
    "main",
    "--title",
    "Atelier Jeux " + pkg.version,
    "--notes-file",
    notes,
    "--latest",
  ],
  { stdio: "inherit" },
);
