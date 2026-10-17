import DHT from "hyperdht";
import net from "node:net";
import { once } from "node:events";
import { timingSafeEqual, randomBytes } from "node:crypto";
import { encodeInvite, scopedIdentity } from "./invitation.mjs";
function sendLine(socket, data) {
  socket.write(JSON.stringify(data) + "\n");
}
export function readLine(socket, timeout = 20000) {
  return new Promise((resolve, reject) => {
    let data = Buffer.alloc(0);
    const timer = setTimeout(
      () => finish(Error("La connexion à l’hôte a expiré.")),
      timeout,
    );
    const finish = (err, value) => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
      socket.pause();
      err ? reject(err) : resolve(value);
    };
    const onError = (e) => finish(e),
      onClose = () => finish(Error("L’hôte a fermé la connexion.")),
      onData = (chunk) => {
        data = Buffer.concat([data, chunk]);
        if (data.length > 4096)
          return finish(Error("Message de connexion trop volumineux."));
        const end = data.indexOf(10);
        if (end < 0) return;
        if (end !== data.length - 1)
          return finish(Error("Message de connexion invalide."));
        try {
          finish(null, JSON.parse(data.subarray(0, end).toString()));
        } catch {
          finish(Error("Message de connexion invalide."));
        }
      };
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
    socket.resume();
  });
}
export function bridge(a, b) {
  const close = () => {
    a.destroy();
    b.destroy();
  };
  a.on("error", close);
  b.on("error", close);
  a.on("close", () => b.destroy());
  b.on("close", () => a.destroy());
  a.pipe(b);
  b.pipe(a);
}
export async function hostPeer({ session, manifest, identity, bootstrap }) {
  const dht = new DHT(bootstrap ? { bootstrap } : {}),
    keyPair = DHT.keyPair(
      Buffer.from(
        scopedIdentity(identity, "host:" + manifest.id + ":" + session.mineId),
        "hex",
      ),
    ),
    secret = randomBytes(16),
    connections = new Set();
  const server = dht.createServer((socket) => {
    if (connections.size >= 12) {
      socket.destroy();
      return;
    }
    connections.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => connections.delete(socket));
    void (async () => {
      const hello = await readLine(socket, 10000),
        token = Buffer.from(
          typeof hello.secret === "string" ? hello.secret : "",
          "hex",
        );
      if (
        token.length !== 16 ||
        !timingSafeEqual(token, secret) ||
        hello.gameId !== manifest.id ||
        hello.version !== manifest.version ||
        !/^[a-f0-9]{64}$/.test(hello.identity || "") ||
        typeof hello.name !== "string" ||
        !hello.name.trim() ||
        hello.name.length > 18
      )
        throw Error("Invitation ou version incompatible.");
      const client = session.join(hello.name, hello.identity),
        tcp = net.connect({ host: "127.0.0.1", port: session.port });
      tcp.on("error", () => socket.destroy());
      await once(tcp, "connect");
      sendLine(socket, { ok: true, bootstrap: client });
      bridge(socket, tcp);
    })().catch((error) => {
      if (!socket.destroyed) {
        try {
          sendLine(socket, { ok: false, error: error.message });
        } catch {}
        socket.end();
      }
    });
  });
  try {
    await Promise.race([
      server.listen(keyPair),
      new Promise((_, reject) => {
        const t = setTimeout(
          () =>
            reject(
              Error(
                "Le réseau d’invitation est indisponible. Réessaie dans un instant.",
              ),
            ),
          30000,
        );
        t.unref();
      }),
    ]);
  } catch (e) {
    await dht.destroy({ force: true });
    throw e;
  }
  return {
    invite: encodeInvite({
      gameId: manifest.id,
      version: manifest.version,
      publicKey: keyPair.publicKey,
      secret,
      room: session.mineId,
    }),
    async close() {
      for (const socket of connections) socket.destroy();
      await server.close();
      await dht.destroy({ force: true });
    },
  };
}
export async function guestPeer({ invite, name, identity, bootstrap }) {
  const dht = new DHT(bootstrap ? { bootstrap } : {}),
    clientIdentity = scopedIdentity(
      identity,
      invite.gameId + ":" + invite.publicKey.toString("hex"),
    ),
    sockets = new Set();
  async function open() {
    const socket = dht.connect(invite.publicKey);
    sockets.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket));
    const reply = readLine(socket, 30000);
    sendLine(socket, {
      gameId: invite.gameId,
      version: invite.version,
      secret: invite.secret.toString("hex"),
      name,
      identity: clientIdentity,
    });
    try {
      const result = await reply;
      if (!result.ok) throw Error(result.error || "Invitation refusée.");
      return { socket, bootstrap: result.bootstrap };
    } catch (e) {
      socket.destroy();
      throw e;
    }
  }
  try {
    let prepared = await open();
    const bootstrapData = prepared.bootstrap;
    return {
      bootstrap: bootstrapData,
      async tunnel() {
        if (prepared && !prepared.socket.destroyed) {
          const value = prepared.socket;
          prepared = null;
          return value;
        }
        const value = await open();
        if (value.bootstrap.token !== bootstrapData.token) {
          value.socket.destroy();
          throw Error("La session a changé. Rejoins de nouveau la partie.");
        }
        return value.socket;
      },
      async close() {
        for (const socket of sockets) socket.destroy();
        await dht.destroy({ force: true });
      },
    };
  } catch (e) {
    await dht.destroy({ force: true });
    throw e;
  }
}
