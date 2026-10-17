import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fork } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
test(
  "Runtime distribué : ouvrir une mine, fermer le processus, reprendre le même personnage",
  { timeout: 30000 },
  async (t) => {
    await fs.mkdir(path.join(root, "test-output"), { recursive: true });
    const dir = await fs.mkdtemp(path.join(root, "test-output", "worker-"));
    let child,
      sequence = 0;
    const pending = new Map();
    function start() {
      child = fork(path.join(root, "packages/worker/index.mjs"), [], {
        execPath: path.join(root, "runtime/node.exe"),
        cwd: dir,
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      });
      child.stderr.on("data", (data) => {
        throw Error(String(data));
      });
      child.on("message", (message) => {
        pending.get(message.id)?.(message);
        pending.delete(message.id);
      });
    }
    async function request(method, args = {}) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error("Processus sans réponse")),
          10000,
        );
        pending.set(id, (message) => {
          clearTimeout(timer);
          message.error
            ? reject(Error(message.error))
            : resolve(message.result);
        });
        child.send({ id, method, args });
      });
    }
    async function close() {
      if (!child || child.exitCode !== null) return;
      const done = once(child, "exit");
      child.disconnect();
      await done;
    }
    t.after(async () => {
      await close();
      await fs.rm(dir, { recursive: true, force: true });
    });
    const args = {
      gameRoot: path.join(root, "games/deep-miners"),
      saveRoot: path.join(dir, "saves"),
      profile: {
        identity: randomBytes(32).toString("hex"),
        name: "Mineur local",
      },
    };
    async function credentials(url) {
      const body = await (await fetch(url + "/config.js")).text();
      return JSON.parse(
        body
          .slice(body.indexOf("=") + 1)
          .trim()
          .replace(/;$/, ""),
      );
    }
    start();
    const first = await request("solo", args),
      initial = await credentials(first.url);
    assert.equal(first.kind, "solo");
    assert.equal(initial.host, true);
    await close();
    start();
    const mines = await request("mines", args);
    assert.equal(mines.length, 1);
    assert.equal(mines[0].id, first.mineId);
    const second = await request("solo", { ...args, mineId: first.mineId }),
      restored = await credentials(second.url);
    assert.equal(restored.token, initial.token);
    assert.equal(restored.reconnectKey, initial.reconnectKey);
    await request("stop");
    await assert.rejects(fetch(second.url));
  },
);
