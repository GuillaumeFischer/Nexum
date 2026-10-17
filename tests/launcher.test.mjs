import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import net from "node:net";
import { setTimeout as pause } from "node:timers/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import yazl from "yazl";
import { GameInstaller, extractZip } from "../packages/core/installer.mjs";
import { validateCatalog, profileAt } from "../packages/core/config.mjs";
import { encodeInvite, decodeInvite } from "../packages/network/invitation.mjs";
import { hostPeer, guestPeer } from "../packages/network/peer.mjs";
import { gateway } from "../packages/worker/gateway.mjs";
import { host, listMines } from "../games/deep-miners/server/launcher.mjs";
const root = fileURLToPath(new URL("../", import.meta.url)),
  require = createRequire(import.meta.url),
  testnet = require("hyperdht/testnet");
async function temporary(t) {
  await fs.mkdir(path.join(root, "test-output"), { recursive: true });
  const dir = await fs.mkdtemp(path.join(root, "test-output", "case-")),
    cleanup = [];
  t.dispose = (fn) => cleanup.push(fn);
  t.after(async () => {
    for (const fn of cleanup.reverse()) await fn();
    await fs.rm(dir, { recursive: true, force: true });
  });
  return dir;
}
async function zip(file, version = "1.0.0") {
  const z = new yazl.ZipFile();
  for (const [name, content] of Object.entries({
    "game.json": JSON.stringify({
      id: "sample-game",
      version,
      engine: "node-web",
      adapter: "server/main.mjs",
      client: "client",
    }),
    "server/main.mjs": "export const sample=true;",
    "client/index.html": "<h1>Jeu</h1>",
  }))
    z.addBuffer(Buffer.from(content), name);
  const out = createWriteStream(file);
  z.outputStream.pipe(out);
  z.end();
  await once(out, "close");
  const bytes = await fs.readFile(file);
  return {
    id: "sample-game",
    version,
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
test("Installation vérifiée, mise à jour atomique et profil conservé", async (t) => {
  const dir = await temporary(t),
    installer = new GameInstaller(path.join(dir, "games")),
    archive = path.join(dir, "game.zip"),
    game = await zip(archive),
    profile = await profileAt(dir);
  await installer.install(game, { localArchive: archive });
  assert.equal((await installer.installed())["sample-game"].version, "1.0.0");
  const newer = await zip(archive, "1.1.0");
  await installer.install(newer, { localArchive: archive });
  assert.equal((await installer.installed())["sample-game"].version, "1.1.0");
  assert.equal((await profileAt(dir)).identity, profile.identity);
  const broken = { ...newer, version: "1.2.0", sha256: "0".repeat(64) };
  await assert.rejects(
    installer.install(broken, { localArchive: archive }),
    /correspond/,
  );
  assert.equal((await installer.installed())["sample-game"].version, "1.1.0");
  assert.equal(
    (await fs.readdir(path.join(dir, "games/sample-game"))).filter((n) =>
      n.startsWith(".install"),
    ).length,
    0,
  );
});
test("Catalogue et archives refusent une origine étrangère et les chemins sortants", async (t) => {
  const dir = await temporary(t),
    file = path.join(dir, "bad.zip"),
    z = new yazl.ZipFile();
  z.addBuffer(Buffer.from("bad"), "file.txt");
  const out = createWriteStream(file);
  z.outputStream.pipe(out);
  z.end();
  await once(out, "close");
  let bytes = await fs.readFile(file);
  bytes = Buffer.from(
    bytes.toString("latin1").replaceAll("file.txt", "../a.txt"),
    "latin1",
  );
  await fs.writeFile(file, bytes);
  await assert.rejects(extractZip(file, path.join(dir, "unpack")));
  await assert.rejects(fs.access(path.join(dir, "a.txt")));
  const game = {
    id: "sample-game",
    title: "Jeu",
    version: "1.0.0",
    engine: "node-web",
    size: 10,
    sha256: "0".repeat(64),
    url: "https://example.com/game.zip",
  };
  assert.throws(
    () =>
      validateCatalog(
        { schema: 1, games: [game] },
        { owner: "owner", repo: "repo" },
      ),
    /GitHub/,
  );
});
test("Invitations vérifiées et erreurs de copie détectées", () => {
  const input = {
      gameId: "deep-miners",
      version: "0.13.0",
      publicKey: randomBytes(32),
      secret: randomBytes(16),
      room: "A0B1C2",
    },
    code = encodeInvite(input),
    value = decodeInvite(code);
  assert.equal(value.gameId, input.gameId);
  assert.equal(value.room, input.room);
  assert(value.secret.equals(input.secret));
  assert.throws(() => decodeInvite(code.slice(0, -2) + "AA"));
  assert.throws(() => decodeInvite("A01234"));
});
function connect(url, credentials) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url.replace("http:", "ws:") + "/ws"),
      messages = [],
      pending = new Map();
    let id = 0;
    const timer = setTimeout(() => reject(Error("Radio absente")), 10000);
    ws.addEventListener("error", () => reject(Error("Erreur radio")));
    ws.addEventListener("open", () =>
      ws.send(JSON.stringify({ type: "auth", ...credentials })),
    );
    ws.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data);
      messages.push(msg);
      if (msg.type === "ready") {
        clearTimeout(timer);
        resolve({
          ws,
          messages,
          command: (body) =>
            new Promise((resolve, reject) => {
              const n = ++id,
                t = setTimeout(
                  () => reject(Error("Commande sans réponse")),
                  5000,
                );
              pending.set(n, (msg) => {
                clearTimeout(t);
                msg.type === "error" ? reject(Error(msg.error)) : resolve(msg);
              });
              ws.send(JSON.stringify({ ...body, requestId: n }));
            }),
        });
      }
      if (pending.has(msg.requestId)) {
        pending.get(msg.requestId)(msg);
        pending.delete(msg.requestId);
      }
    });
  });
}
test(
  "Deep Miners hébergé : ressources récentes, partie à deux, sauvegarde et reprise du personnage",
  { timeout: 30000 },
  async (t) => {
    const dir = await temporary(t),
      identity = randomBytes(32).toString("hex"),
      session = await host({
        saveDir: dir,
        name: "Hôte",
        identity,
        solo: false,
      });
    t.dispose(() => session.close());
    const gw = await gateway({
      clientRoot: path.join(root, "games/deep-miners/client"),
      bootstrap: { ...session.bootstrap, host: true },
      tunnel: async () => {
        const socket = net.connect(session.port, "127.0.0.1");
        await once(socket, "connect");
        return socket;
      },
    });
    t.dispose(() => gw.close());
    for (const resource of [
      "trash-panel.js",
      "quickbar-controls.js",
      "rail-art.js",
      "assets/trash.webp",
      "assets/mineral-iron.webp",
    ]) {
      const response = await fetch(gw.url + "/" + resource);
      assert(response.ok, resource);
    }
    assert.match(
      await (await fetch(gw.url + "/config.js")).text(),
      /DEEP_MINERS_DESKTOP/,
    );
    const a = await connect(gw.url, session.bootstrap);
    t.dispose(() => a.ws.close());
    await a.command({ type: "start" });
    const guestIdentity = randomBytes(32).toString("hex"),
      guest = session.join("Ami", guestIdentity);
    assert.notEqual(guest.token, session.bootstrap.token);
    await a.command({ type: "equip", slot: -1 });
    const code = session.mineId;
    await session.close();
    const restored = await host({
      saveDir: dir,
      name: "Hôte",
      identity,
      mineId: code,
      solo: false,
    });
    t.dispose(() => restored.close());
    assert.equal(restored.mineId, code);
    assert.equal(restored.bootstrap.token, session.bootstrap.token);
    assert.equal(restored.join("Ami", guestIdentity).token, guest.token);
    assert.equal((await listMines(dir)).length, 1);
  },
);
test(
  "Connexion chiffrée par invitation entre deux clients du réseau DHT, puis radio du jeu",
  { timeout: 45000 },
  async (t) => {
    const dir = await temporary(t),
      network = await testnet(3);
    t.dispose(() => network.destroy());
    const identity = randomBytes(32).toString("hex"),
      session = await host({
        saveDir: dir,
        name: "Hôte P2P",
        identity,
        solo: false,
      });
    t.dispose(() => session.close());
    const manifest = JSON.parse(
        await fs.readFile(path.join(root, "games/deep-miners/game.json")),
      ),
      peer = await hostPeer({
        session,
        manifest,
        identity,
        bootstrap: network.bootstrap,
      });
    t.dispose(() => peer.close());
    const ownerRadio = await connect(
      "http://127.0.0.1:" + session.port,
      session.bootstrap,
    );
    t.dispose(() => ownerRadio.ws.close());
    await ownerRadio.command({ type: "start" });
    const invite = decodeInvite(peer.invite),
      guest = await guestPeer({
        invite,
        name: "Ami P2P",
        identity: randomBytes(32).toString("hex"),
        bootstrap: network.bootstrap,
      });
    t.dispose(() => guest.close());
    const gw = await gateway({
      clientRoot: path.join(root, "games/deep-miners/client"),
      bootstrap: guest.bootstrap,
      tunnel: () => guest.tunnel(),
    });
    t.dispose(() => gw.close());
    const radio = await connect(gw.url, guest.bootstrap);
    t.dispose(() => radio.ws.close());
    await radio.command({ type: "equip", slot: -1 });
    await pause(100);
    const state = radio.messages.filter((m) => m.type === "state").at(-1).state;
    assert.equal(state.players.length, 2);
    assert.equal(state.code, session.mineId);
  },
);
