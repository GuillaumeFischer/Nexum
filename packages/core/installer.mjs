import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Transform, Readable } from "node:stream";
import yauzl from "yauzl";
import { within, readJSON, writeJSON, ID, VERSION } from "./config.mjs";
export async function extractZip(
  zipFile,
  target,
  { limit = 1024 * 1024 * 1024 } = {},
) {
  await fs.mkdir(target, { recursive: true });
  const zip = await new Promise((resolve, reject) =>
    yauzl.open(
      zipFile,
      { lazyEntries: true, validateEntrySizes: true },
      (err, z) => (err ? reject(err) : resolve(z)),
    ),
  );
  let total = 0,
    count = 0;
  await new Promise((resolve, reject) => {
    let failed = false;
    const fail = (e) => {
      if (!failed) {
        failed = true;
        zip.close();
        reject(e);
      }
    };
    zip.on("error", fail);
    zip.on("end", resolve);
    zip.on("entry", (entry) => {
      void (async () => {
        if (++count > 20000) throw Error("Archive trop volumineuse.");
        const name = entry.fileName,
          kind = (entry.externalFileAttributes >>> 16) & 0xf000;
        if (kind === 0xa000 || entry.generalPurposeBitFlag & 1)
          throw Error("Les liens et archives chiffrées ne sont pas admis.");
        if (name.endsWith("/")) {
          within(target, name.slice(0, -1));
          zip.readEntry();
          return;
        }
        const file = within(target, name);
        if ((total += entry.uncompressedSize) > limit)
          throw Error("Archive trop volumineuse.");
        await fs.mkdir(path.dirname(file), { recursive: true });
        const input = await new Promise((resolve, reject) =>
          zip.openReadStream(entry, (e, s) => (e ? reject(e) : resolve(s))),
        );
        await pipeline(input, createWriteStream(file, { flags: "wx" }));
        zip.readEntry();
      })().catch(fail);
    });
    zip.readEntry();
  });
}
export class GameInstaller {
  constructor(root, { onProgress = () => {} } = {}) {
    this.root = path.resolve(root);
    this.onProgress = onProgress;
    this.busy = new Set();
  }
  async installed() {
    const out = {};
    for (const name of await fs
      .readdir(this.root)
      .catch((e) => (e.code === "ENOENT" ? [] : Promise.reject(e)))) {
      if (!ID.test(name)) continue;
      const current = await readJSON(
        path.join(this.root, name, "current.json"),
        null,
      );
      if (
        current &&
        VERSION.test(current.version) &&
        (await fs
          .stat(path.join(this.root, name, current.version, "game.json"))
          .catch(() => false))
      )
        out[name] = current;
    }
    return out;
  }
  async install(game, { localArchive } = {}) {
    if (
      !ID.test(game.id) ||
      !VERSION.test(game.version) ||
      this.busy.has(game.id)
    )
      throw Error("Installation déjà en cours ou jeu invalide.");
    this.busy.add(game.id);
    const base = path.join(this.root, game.id),
      stage = path.join(base, ".install-" + randomBytes(8).toString("hex")),
      archive = stage + ".zip",
      dest = path.join(base, game.version);
    let promoted = false;
    try {
      await fs.mkdir(base, { recursive: true });
      let received = 0;
      const hash = createHash("sha256"),
        verify = new Transform({
          transform(chunk, encoding, cb) {
            received += chunk.length;
            if (received > game.size) {
              cb(Error("Téléchargement trop volumineux."));
              return;
            }
            hash.update(chunk);
            cb(null, chunk);
          },
        });
      verify.on("data", () =>
        this.onProgress({
          gameId: game.id,
          phase: "download",
          received,
          total: game.size,
        }),
      );
      let input;
      if (localArchive) input = createReadStream(localArchive);
      else {
        let url = new URL(game.url);
        for (let redirects = 0; ; redirects++) {
          if (
            redirects > 5 ||
            url.protocol !== "https:" ||
            ![
              "github.com",
              "release-assets.githubusercontent.com",
              "objects.githubusercontent.com",
            ].includes(url.hostname)
          )
            throw Error("Adresse de téléchargement refusée.");
          const r = await fetch(url, {
            redirect: "manual",
            signal: AbortSignal.timeout(120000),
            headers: { "User-Agent": "Atelier-Jeux" },
          });
          if ([301, 302, 303, 307, 308].includes(r.status)) {
            url = new URL(r.headers.get("location"), url);
            continue;
          }
          if (!r.ok) throw Error("Le téléchargement du jeu a échoué.");
          input = Readable.fromWeb(r.body);
          break;
        }
      }
      await pipeline(
        input,
        verify,
        createWriteStream(archive, { flags: "wx" }),
      );
      if (received !== game.size || hash.digest("hex") !== game.sha256)
        throw Error(
          "Le jeu téléchargé ne correspond pas à la version annoncée.",
        );
      this.onProgress({ gameId: game.id, phase: "extract" });
      await extractZip(archive, stage);
      const manifest = await readJSON(path.join(stage, "game.json"));
      if (
        manifest.id !== game.id ||
        manifest.version !== game.version ||
        manifest.engine !== "node-web"
      )
        throw Error("Le contenu du jeu ne correspond pas au catalogue.");
      await fs.access(within(stage, manifest.adapter));
      await fs.access(within(stage, manifest.client + "/index.html"));
      try {
        await fs.rename(stage, dest);
        promoted = true;
      } catch (e) {
        if (
          !["EEXIST", "ENOTEMPTY", "EPERM"].includes(e.code) ||
          !(await readJSON(path.join(dest, "game.json"), null))
        )
          throw e;
        const existing = await readJSON(path.join(base, "current.json"), null);
        if (
          existing?.version !== game.version ||
          existing.sha256 !== game.sha256
        )
          throw Error("Une installation de cette version existe déjà.");
      }
      await writeJSON(path.join(base, "current.json"), {
        version: game.version,
        sha256: game.sha256,
        installedAt: new Date().toISOString(),
      });
      this.onProgress({ gameId: game.id, phase: "ready" });
      return dest;
    } finally {
      this.busy.delete(game.id);
      await fs.rm(stage, { recursive: true, force: true });
      await fs.rm(archive, { force: true });
    }
  }
  async gameRoot(id) {
    if (!ID.test(id)) throw Error("Jeu inconnu.");
    const current = await readJSON(
      path.join(this.root, id, "current.json"),
      null,
    );
    if (!current || !VERSION.test(current.version))
      throw Error("Installe ce jeu avant de le lancer.");
    return path.join(this.root, id, current.version);
  }
}
