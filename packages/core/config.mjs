import path from "node:path";
import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
export const ID = /^[a-z][a-z0-9-]{1,47}$/;
export const VERSION = /^\d+\.\d+\.\d+$/;
export function within(root, relative) {
  if (
    typeof relative !== "string" ||
    !relative ||
    relative.includes("\\") ||
    relative.includes(":") ||
    relative.split("/").some((s) => ["", "..", "."].includes(s))
  )
    throw Error("Chemin de jeu invalide.");
  const file = path.resolve(root, relative);
  if (!file.startsWith(path.resolve(root) + path.sep))
    throw Error("Chemin hors du jeu.");
  return file;
}
export async function readJSON(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT" && fallback !== undefined) return fallback;
    throw e;
  }
}
export async function writeJSON(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp-" + randomBytes(6).toString("hex");
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
}
export async function profileAt(dataRoot) {
  const file = path.join(dataRoot, "profile.json"),
    saved = await readJSON(file, null);
  if (saved) {
    if (!/^[a-f0-9]{64}$/.test(saved.identity || ""))
      throw Error(
        "Le profil est endommagé. Conserve le dossier de sauvegarde avant de le restaurer.",
      );
    if (saved.name === "Mineur") {
      saved.name = "Joueur";
      await writeJSON(file, saved);
    }
    return saved;
  }
  const profile = { name: "Joueur", identity: randomBytes(32).toString("hex") };
  await writeJSON(file, profile);
  return profile;
}
export function githubDistribution(d) {
  return (
    typeof d?.owner === "string" &&
    /^[a-zA-Z0-9-]{1,39}$/.test(d.owner) &&
    typeof d.repo === "string" &&
    /^[a-zA-Z0-9_.-]{1,100}$/.test(d.repo) &&
    (d.previousRepos === undefined ||
      (Array.isArray(d.previousRepos) &&
        d.previousRepos.length <= 5 &&
        d.previousRepos.every(
          (repo) =>
            typeof repo === "string" && /^[a-zA-Z0-9_.-]{1,100}$/.test(repo),
        )))
  );
}
export function validateCatalog(value, distribution, { local = false } = {}) {
  if (
    value?.schema !== 1 ||
    !Array.isArray(value.games) ||
    value.games.length > 100
  )
    throw Error("Catalogue de jeux invalide.");
  const ids = new Set();
  for (const game of value.games) {
    if (
      !ID.test(game.id) ||
      ids.has(game.id) ||
      !VERSION.test(game.version) ||
      typeof game.title !== "string" ||
      game.title.length > 80 ||
      !["node-web"].includes(game.engine) ||
      !Number.isSafeInteger(game.size) ||
      game.size < 1 ||
      game.size > 1024 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(game.sha256)
    )
      throw Error("Fiche de jeu invalide.");
    ids.add(game.id);
    if (local && game.archive) continue;
    const url = new URL(game.url),
      repositories = [distribution.repo, ...(distribution.previousRepos || [])];
    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      !repositories.some((repo) =>
        url.pathname.startsWith(
          `/${distribution.owner}/${repo}/releases/download/`,
        ),
      ) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw Error(
        "Le jeu doit provenir des versions du dépôt GitHub configuré.",
      );
  }
  return value;
}
