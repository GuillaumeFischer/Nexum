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
  `${pkg.productName} ${pkg.version}\n\nLe titre Deep Miners reprend la même typographie que sa carte dans la bibliothèque. Le bouton du profil ouvre les paramètres puis revient à l’accueil au second clic. Le pseudo par défaut devient Joueur ; les pseudos personnalisés et l’identité du personnage sont conservés.\n\nLe dépôt GitHub s’appelle désormais Nexum. Les anciens liens restent compatibles et les jeux, profils et sauvegardes sont préservés.\n\nTélécharge **${pkg.productName}-Setup-${pkg.version}.exe** et installe-le par-dessus l’ancienne version. Les mises à jour suivantes restent disponibles dans le launcher.\n\nWindows x64. L’installeur ne dispose pas de signature éditeur.\n`,
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
