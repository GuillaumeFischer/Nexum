import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { githubDistribution, readJSON } from "../packages/core/config.mjs";
const distribution = await readJSON("distribution.json"),
  pkg = await readJSON("package.json");
if (!githubDistribution(distribution)) throw Error("Dépôt non configuré.");
const files = [
  `${pkg.productName}-Setup-${pkg.version}.exe`,
  `${pkg.productName}-Setup-${pkg.version}.exe.blockmap`,
  "latest.yml",
];
for (const file of files) await fs.access("release/" + file);
const notes = "release/notes.md";
await fs.writeFile(
  notes,
  `${pkg.productName} ${pkg.version}\n\nNouvelle identité NEXUM : interface sombre et bleue, logo, bannière Deep Miners, bibliothèque, recherche et téléchargements. Les profils, jeux installés et sauvegardes de l’ancienne version sont conservés.\n\nTélécharge **${pkg.productName}-Setup-${pkg.version}.exe** et installe-le par-dessus l’ancienne version. Les mises à jour suivantes restent disponibles dans le launcher.\n\nWindows x64. L’installeur ne dispose pas de signature éditeur.\n`,
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
    pkg.productName + " " + pkg.version,
    "--notes-file",
    notes,
    "--latest",
  ],
  { stdio: "inherit" },
);
