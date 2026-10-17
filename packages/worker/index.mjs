import path from "node:path";
import net from "node:net";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { readJSON, within, ID } from "../core/config.mjs";
import { decodeInvite, scopedIdentity } from "../network/invitation.mjs";
import { hostPeer, guestPeer } from "../network/peer.mjs";
import { gateway } from "./gateway.mjs";
let current = null,
  busy = false;
async function stop() {
  const value = current;
  current = null;
  if (value) {
    let failure;
    for (const item of [value.gateway, value.peer, value.session]) {
      try {
        await item?.close();
      } catch (error) {
        failure ??= error;
      }
    }
    if (failure) throw failure;
  }
}
async function execute(method, args) {
  if (method === "stop") {
    await stop();
    return { stopped: true };
  }
  const root = args.gameRoot,
    manifest = await readJSON(path.join(root, "game.json"));
  if (!ID.test(manifest.id)) throw Error("Jeu invalide.");
  const adapter = await import(
      pathToFileURL(within(root, manifest.adapter)).href
    ),
    saveDir = path.join(args.saveRoot, manifest.id);
  if (method === "mines") return adapter.listMines(saveDir);
  if (current)
    throw Error("Ferme la partie actuelle avant d’en ouvrir une autre.");
  const session = {};
  current = session;
  try {
    let bootstrap, tunnel;
    if (method === "host" || method === "solo") {
      session.session = await adapter.host({
        saveDir,
        name: args.profile.name,
        identity: scopedIdentity(args.profile.identity, manifest.id + ":owner"),
        mineId: args.mineId || null,
        solo: method === "solo",
      });
      bootstrap = { ...session.session.bootstrap, host: true };
      tunnel = async () => {
        const socket = net.connect({
          host: "127.0.0.1",
          port: session.session.port,
        });
        await once(socket, "connect");
        return socket;
      };
      if (method === "host")
        session.peer = await hostPeer({
          session: session.session,
          manifest,
          identity: args.profile.identity,
          bootstrap: args.bootstrap,
        });
    } else if (method === "join") {
      const invite = decodeInvite(args.invite);
      if (invite.gameId !== manifest.id || invite.version !== manifest.version)
        throw Error("L’hôte et toi devez installer la même version du jeu.");
      session.peer = await guestPeer({
        invite,
        name: args.profile.name,
        identity: args.profile.identity,
        bootstrap: args.bootstrap,
      });
      bootstrap = { ...session.peer.bootstrap, host: false };
      tunnel = () => session.peer.tunnel();
    } else throw Error("Action inconnue.");
    session.gateway = await gateway({
      clientRoot: within(root, manifest.client),
      bootstrap,
      tunnel,
    });
    return {
      url: session.gateway.url,
      invite: session.peer?.invite || null,
      mineId: bootstrap.code,
      kind: method,
      gameId: manifest.id,
      version: manifest.version,
    };
  } catch (e) {
    await stop();
    throw e;
  }
}
process.on("message", async (message) => {
  if (!message || !Number.isSafeInteger(message.id)) return;
  if (busy) {
    process.send?.({
      id: message.id,
      error: "Une opération de partie est déjà en cours.",
    });
    return;
  }
  busy = true;
  try {
    process.send?.({
      id: message.id,
      result: await execute(message.method, message.args || {}),
    });
  } catch (e) {
    process.send?.({ id: message.id, error: e.message });
  } finally {
    busy = false;
  }
});
let closing = false;
async function quit() {
  if (closing) return;
  closing = true;
  await stop().catch(() => {});
  process.exit(0);
}
process.on("disconnect", quit);
process.on("SIGTERM", quit);
process.on("SIGINT", quit);
