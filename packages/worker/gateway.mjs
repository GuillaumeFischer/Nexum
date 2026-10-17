import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { bridge } from "../network/peer.mjs";
import { within } from "../core/config.mjs";
const types = {
  ".ttf": "font/ttf",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};
export async function gateway({ clientRoot, bootstrap, tunnel }) {
  const sockets = new Set(),
    server = http.createServer(async (req, res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      const localOrigin = `http://127.0.0.1:${server.address().port}`;
      if (req.headers.host !== new URL(localOrigin).host || (req.headers.origin && req.headers.origin !== localOrigin)) {
        res.writeHead(403, {"Content-Type":"text/plain; charset=utf-8"});
        res.end('Accès local uniquement.');
        return;
      }
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' ws://127.0.0.1:*; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      );
      try {
        if (req.method !== "GET")
          throw Error("Route indisponible dans le launcher.");
        const url = new URL(req.url, "http://127.0.0.1"),
          name = decodeURIComponent(url.pathname).slice(1) || "index.html";
        if (name === "config.js") {
          res.writeHead(200, {
            "Content-Type": "text/javascript",
            "Cache-Control": "no-store",
          });
          res.end(
            "window.DEEP_MINERS_DESKTOP=" + JSON.stringify(bootstrap) + ";\n",
          );
          return;
        }
        const ext = path.extname(name);
        if (!types[ext]) throw Error("Introuvable.");
        const bytes = await fs.readFile(within(clientRoot, name));
        res.writeHead(200, { "Content-Type": types[ext] });
        res.end(bytes);
      } catch {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Ressource introuvable.");
      }
    });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket));
  });
  server.on("upgrade", (req, socket, head) => {
    socket.on("error", () => {});
    if (req.url !== "/ws" || req.headers.host !== `127.0.0.1:${server.address().port}`) {
      socket.destroy();
      return;
    }
    const origin = req.headers.origin;
    if (origin && origin !== `http://127.0.0.1:${server.address().port}`) {
      socket.destroy();
      return;
    }
    void (async () => {
      const remote = await tunnel();
      if (socket.destroyed) {
        remote.destroy();
        return;
      }
      const headers = {
        ...req.headers,
        host: "127.0.0.1",
        origin: "http://127.0.0.1",
      };
      remote.write(
        `GET /ws HTTP/1.1\r\n${Object.entries(headers)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\r\n")}\r\n\r\n`,
      );
      if (head.length) remote.write(head);
      bridge(socket, remote);
    })().catch(() => socket.destroy());
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
