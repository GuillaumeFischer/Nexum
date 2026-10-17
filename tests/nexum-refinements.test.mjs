import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  profileAt,
  validateCatalog,
  githubDistribution,
} from "../packages/core/config.mjs";

async function profileDirectory() {
  await fs.mkdir("test-output", { recursive: true });
  return fs.mkdtemp(path.resolve("test-output", "nexum-profile-"));
}

test("Le nouveau profil Joueur conserve son identité à la reconnexion", async () => {
  const directory = await profileDirectory();
  const created = await profileAt(directory);
  assert.equal(created.name, "Joueur");
  assert.match(created.identity, /^[a-f0-9]{64}$/);
  assert.deepEqual(await profileAt(directory), created);
});

test("Le renommage du pseudo par défaut préserve le personnage et les pseudos personnalisés", async () => {
  const directory = await profileDirectory();
  const file = path.join(directory, "profile.json");
  const original = {
    name: "Mineur",
    identity: "a".repeat(64),
    extra: { retained: true },
  };
  await fs.writeFile(file, JSON.stringify(original));
  const migrated = await profileAt(directory);
  assert.deepEqual(migrated, { ...original, name: "Joueur" });
  assert.deepEqual(JSON.parse(await fs.readFile(file, "utf8")), migrated);
  const custom = JSON.stringify({ ...original, name: "Explorateur42" }, null, 2);
  await fs.writeFile(file, custom);
  assert.equal((await profileAt(directory)).name, "Explorateur42");
  assert.equal(await fs.readFile(file, "utf8"), custom);
});

test("Le catalogue reste lisible par les anciens launchers et Nexum après renommage", async () => {
  const distribution = JSON.parse(
    await fs.readFile("distribution.json", "utf8"),
  );
  const catalog = JSON.parse(await fs.readFile("catalog/catalog.json", "utf8"));
  assert.equal(distribution.repo, "Nexum");
  assert.equal(githubDistribution(distribution), true);
  assert.equal(validateCatalog(catalog, distribution), catalog);
  assert.equal(
    validateCatalog(catalog, {
      owner: distribution.owner,
      repo: "atelier-jeux",
    }),
    catalog,
  );
  const canonical = structuredClone(catalog);
  canonical.games[0].url = canonical.games[0].url.replace(
    "/atelier-jeux/",
    "/Nexum/",
  );
  assert.equal(validateCatalog(canonical, distribution), canonical);
  const foreign = structuredClone(catalog);
  foreign.games[0].url = foreign.games[0].url.replace(
    "/GuillaumeFischer/",
    "/autre-compte/",
  );
  assert.throws(
    () => validateCatalog(foreign, distribution),
    /dépôt GitHub configuré/,
  );
  assert.equal(
    githubDistribution({ ...distribution, previousRepos: ["../autre"] }),
    false,
  );
});
