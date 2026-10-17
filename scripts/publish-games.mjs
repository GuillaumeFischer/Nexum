import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { githubDistribution, readJSON } from "../packages/core/config.mjs";

const distribution = await readJSON("distribution.json");
if (!githubDistribution(distribution))
  throw Error("Configure le dépôt GitHub avant de publier.");
const repository = distribution.owner + "/" + distribution.repo;
const gh = (args, options = {}) =>
  execFileSync(process.env.ATELIER_GH || "gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
execFileSync(process.execPath, ["scripts/pack-games.mjs"], {
  stdio: "inherit",
});
const catalog = await readJSON("catalog/local.json");
for (const game of catalog.games) {
  const tag = `game-${game.id}-v${game.version}`,
    args = ["release", "view", tag, "--repo", repository, "--json", "assets"];
  let release;
  try {
    release = JSON.parse(gh(args));
  } catch (error) {
    if (!String(error.stderr).includes("release not found")) throw error;
  }
  if (release) {
    const asset = release.assets.find((a) => a.name === game.archive);
    if (!asset)
      throw Error(
        `La version ${tag} existe sans son archive. Conserve cette version et publie un nouveau numéro.`,
      );
    const response = await fetch(game.url, {
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok)
      throw Error("Impossible de vérifier la version déjà publiée.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (
      bytes.length !== game.size ||
      createHash("sha256").update(bytes).digest("hex") !== game.sha256
    )
      throw Error(
        `${tag} a changé : augmente le numéro de version du jeu avant de publier.`,
      );
    console.log(tag + " déjà publié et vérifié.");
    continue;
  }
  await fs.mkdir("artifacts", { recursive: true });
  const notes = "artifacts/notes-" + game.id + ".md";
  await fs.writeFile(
    notes,
    `${game.title} ${game.version}\n\nCette archive est installée et vérifiée automatiquement par Atelier Jeux.\n`,
  );
  gh(
    [
      "release",
      "create",
      tag,
      "artifacts/" + game.archive,
      "--repo",
      repository,
      "--target",
      "main",
      "--title",
      `${game.title} ${game.version}`,
      "--notes-file",
      notes,
      "--latest=false",
    ],
    { stdio: "inherit" },
  );
}
