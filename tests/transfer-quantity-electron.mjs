import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { setTimeout as pause } from "node:timers/promises";
import assert from "node:assert/strict";
import { gateway } from "../packages/worker/gateway.mjs";

const scratch = process.env.NEXUM_MENU_SCRATCH;
app.setPath("userData", path.join(scratch, "profile"));
let window, server, localGateway;
const checks = [],
  appRoot = process.env.NEXUM_MENU_APP_ROOT,
  gameRoot = process.env.NEXUM_MENU_GAME_ROOT;
const js = (code) => window.webContents.executeJavaScript(code);
async function wait(predicate, label) {
  for (let i = 0; i < 150; i++) {
    if (await predicate()) return;
    await pause(40);
  }
  throw Error("Délai dépassé : " + label);
}
const checked = (label) => {
  checks.push(label);
  console.log("OK · " + label);
};
async function key(code) {
  await js(
    `window.dispatchEvent(new KeyboardEvent('keydown',{code:'${code}',key:'${code}',bubbles:true,cancelable:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'${code}',key:'${code}',bubbles:true,cancelable:true}));`,
  );
}
const slider = (machine, resource, direction) =>
  `transfer-${machine}-${resource}-${direction}`;
async function choose(id, count) {
  await js(
    `(()=>{const s=document.getElementById(${JSON.stringify(id)});s.value=${JSON.stringify(String(count))};s.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
}
async function confirm(id) {
  await js(
    `document.getElementById(${JSON.stringify(id + "-confirm")}).click()`,
  );
}

async function run() {
  const { createServer } = await import(
    pathToFileURL(path.join(gameRoot, "server/index.mjs"))
  );
  const { createGameWindow } = await import(
    pathToFileURL(path.join(appRoot, "apps/launcher/main/game-window.mjs"))
  );
  server = createServer({
    launcher: true,
    storagePath: path.join(scratch, "saves/rooms.json"),
  });
  await new Promise((resolve, reject) => {
    server.server.once("error", reject);
    server.server.listen(0, "127.0.0.1", resolve);
  });
  const credentials = server.game.enter("create", {
    name: "QA quantités",
    practice: true,
    reconnectKey: "d".repeat(64),
  });
  localGateway = await gateway({
    clientRoot: path.join(gameRoot, "client"),
    bootstrap: {
      ...credentials,
      name: "QA quantités",
      reconnectKey: "d".repeat(64),
      host: true,
    },
    tunnel: async () => {
      const socket = net.connect(server.server.address().port, "127.0.0.1");
      await once(socket, "connect");
      return socket;
    },
  });
  window = createGameWindow({
    id: "transfer-qa",
    title: "QA quantités",
    url: localGateway.url,
    show: false,
  });
  await window.loadURL(localGateway.url);
  await wait(
    () => js("document.getElementById('roomCode').textContent.length===6"),
    "connexion",
  );
  await js("document.getElementById('start').click()");
  const room = server.rooms.get(credentials.code),
    me = room.players.get(credentials.token);
  await wait(() => room.phase === "running", "partie");
  const stock = {
    ...room.stock,
    stone: 300,
    iron: 100,
    gold: 46,
    crystal: 13,
    amethyst: 48,
    copper: 62,
    tin: 40,
    wood: 60,
  };
  room.stock = stock;
  Object.assign(me.cargo, { stone: 20, iron: 10 });
  room.installations = [
    { id: 1, kind: "chest", x: 18.5, y: 3.5, status: "idle", buffer: {} },
  ];
  server.game.broadcast(room);
  await pause(150);
  await key("KeyE");
  const deposit = slider(1, "stone", "deposit"),
    take = slider(1, "stone", "withdraw");
  await wait(() => js(`!!document.getElementById('${deposit}')`), "coffre");
  assert.deepEqual(
    await js(
      `(()=>{const d=document.getElementById('${deposit}'),w=document.getElementById('${take}');return[d.type,d.min,d.max,w.max];})()`,
    ),
    ["range", "1", "20", "40"],
  );
  checked(
    "Deux curseurs par minerai, bornés par le sac et le poids disponible",
  );
  await choose(deposit, 7);
  await js(
    "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
  );
  await fs.writeFile(
    path.join(scratch, "transfers-chest.png"),
    (await window.webContents.capturePage()).toPNG(),
  );
  assert.equal(
    await js(`document.getElementById('${deposit}-confirm').textContent`),
    "Déposer · 7",
  );
  await js(
    `window.qaRange=document.getElementById('${deposit}');qaRange.focus();qaRange.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));`,
  );
  room.stock.stone = 5;
  server.game.broadcast(room);
  await pause(150);
  assert.equal(
    await js(
      `window.qaRange===document.getElementById('${deposit}')&&qaRange.value==='7'`,
    ),
    true,
  );
  await js(
    "qaRange.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));",
  );
  await wait(
    () => js(`document.getElementById('${take}').max==='5'`),
    "stock partagé actualisé",
  );
  assert.equal(
    await js(
      `document.activeElement.id==='${deposit}'&&document.getElementById('${deposit}').value==='7'`,
    ),
    true,
  );
  checked("Le curseur reste utilisable pendant les mises à jour multijoueur");
  await js(`document.getElementById('${deposit}').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));window.dispatchEvent(new Event('blur'));`);
  room.stock.iron = 99; server.game.broadcast(room);
  await wait(()=>js("document.getElementById('transfer-1-iron-withdraw').closest('.machine-slot').textContent.includes('99 ici')"),'reprise après perte de focus');
  checked('Un glissement interrompu ne bloque pas les actualisations du stock');
  await confirm(deposit);
  await wait(() => me.cargo.stone === 13, "dépôt de sept");
  assert.equal(room.stock.stone, 12);
  await wait(
    () => js(`!document.getElementById('${take}-confirm').disabled`),
    "fin transfert",
  );
  await choose(take, 4);
  await confirm(take);
  await wait(() => me.cargo.stone === 17, "retrait de quatre");
  assert.equal(room.stock.stone, 8);
  checked(
    "Dépôt et retrait transmettent exactement la quantité choisie au serveur",
  );
  const ironTake = slider(1, "iron", "withdraw");
  await wait(
    () => js(`document.getElementById('${ironTake}').max==='21'`),
    "limite pondérée",
  );
  await choose(ironTake, 21);
  await confirm(ironTake);
  await wait(() => me.cargo.iron === 31, "retrait du fer");
  await wait(
    () =>
      js(
        `document.getElementById('${ironTake}').disabled&&document.getElementById('${ironTake}').value==='0'`,
      ),
    "sac plein",
  );
  checked(
    "Le poids du fer limite le retrait et le curseur se désactive quand le sac manque de place",
  );
  const stoneTake = slider(1, "stone", "withdraw");
  await choose(stoneTake, 1);
  room.stock.stone = 0;
  server.game.broadcast(room);
  await wait(
    () => js(`document.getElementById('${stoneTake}').disabled`),
    "stock épuisé",
  );
  assert.equal(
    await js(`document.getElementById('${stoneTake}-confirm').disabled`),
    true,
  );
  checked("Un stock épuisé désactive le curseur et sa confirmation");
  await js("document.getElementById('closeColony').click()");
  room.installations = [
    {
      id: 2,
      kind: "furnace",
      x: 18.5,
      y: 3.5,
      status: "power",
      buffer: { iron: 16, wood: 2, steel: 2 },
    },
  ];
  server.game.broadcast(room);
  await pause(150);
  await key("KeyE");
  const furnace = slider(2, "iron", "deposit");
  await wait(() => js(`!!document.getElementById('${furnace}')`), "four");
  assert.equal(await js(`document.getElementById('${furnace}').max`), "1");
  assert.equal(
    await js(
      `document.getElementById('${slider(2, "steel", "deposit")}')===null`,
    ),
    true,
  );
  await choose(furnace, 1);
  await confirm(furnace);
  await wait(() => room.installations[0].buffer.iron === 17, "dépôt four");
  checked(
    "Le four respecte sa capacité et propose seulement le retrait des produits finis",
  );
  await js("document.getElementById('closeColony').click()");
  room.installations = [
    {
      id: 3,
      kind: "wagon",
      x: 18.5,
      y: 3.5,
      status: "idle",
      buffer: { stone: 150 },
      riderIds: [],
    },
  ];
  server.game.broadcast(room);
  await pause(150);
  await js("document.getElementById('openWagonCargo').click()");
  const wagon = slider(3, "stone", "deposit");
  await wait(() => js(`!!document.getElementById('${wagon}')`), "wagon");
  assert.equal(await js(`document.getElementById('${wagon}').max`), "10");
  await choose(wagon, 10);
  await confirm(wagon);
  await wait(() => room.installations[0].buffer.stone === 160, "wagon plein");
  assert.equal(me.cargo.stone, 7);
  checked(
    "Le wagon utilise les mêmes curseurs et conserve sa limite de chargement",
  );
  await js(
    "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
  );
  await fs.writeFile(
    path.join(scratch, "transfers.png"),
    (await window.webContents.capturePage()).toPNG(),
  );
  await fs.writeFile(
    path.join(scratch, "report.json"),
    JSON.stringify(
      { ok: true, checks, gameRoot, historicalSuitesRerun: false },
      null,
      2,
    ),
  );
}
void app.whenReady().then(async () => {
  let failed;
  try {
    await run();
  } catch (error) {
    failed = error;
    console.error(error.stack);
    await fs.writeFile(
      path.join(scratch, "report.json"),
      JSON.stringify({ ok: false, checks, error: error.stack }, null, 2),
    );
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
    await localGateway?.close();
    server?.close();
    app.exit(failed ? 1 : 0);
  }
});
