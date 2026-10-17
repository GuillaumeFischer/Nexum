import { app, BrowserWindow } from "electron";
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
const appRoot = process.env.NEXUM_MENU_APP_ROOT,
  gameRoot = process.env.NEXUM_MENU_GAME_ROOT;
const checks = [];
let window, server, localGateway;
const report = path.join(scratch, "report.json");
async function waitFor(predicate, label) {
  for (let i = 0; i < 150; i++) {
    if (await predicate()) return;
    await pause(40);
  }
  throw Error("Délai dépassé : " + label);
}
function checked(label) {
  checks.push(label);
  console.log("OK · " + label);
}
const js = (code) => window.webContents.executeJavaScript(code);
const hidden = process.env.NEXUM_MENU_HIDDEN === "1";
async function input(type, keyCode) {
  if (!hidden) return window.webContents.sendInputEvent({ type, keyCode });
  if (keyCode === "F11") {
    if (type === "keyDown")
      await js(
        "window.nexumGame.display().then(state=>window.nexumGame.setFullscreen(!state.fullscreen))",
      );
    return;
  }
  const code = /^[A-Z]$/.test(keyCode)
    ? "Key" + keyCode
    : /^\d$/.test(keyCode)
      ? "Digit" + keyCode
      : keyCode;
  await js(
    `window.dispatchEvent(new KeyboardEvent('${type === "keyDown" ? "keydown" : "keyup"}',{code:${JSON.stringify(code)},key:${JSON.stringify(keyCode)},bubbles:true,cancelable:true}))`,
  );
}
async function key(keyCode) {
  await input("keyDown", keyCode);
  await input("keyUp", keyCode);
  await pause(70);
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
    name: "QA menu",
    practice: true,
    reconnectKey: "c".repeat(64),
  });
  localGateway = await gateway({
    clientRoot: path.join(gameRoot, "client"),
    bootstrap: {
      ...credentials,
      name: "QA menu",
      reconnectKey: "c".repeat(64),
      host: true,
    },
    tunnel: async () => {
      const socket = net.connect(server.server.address().port, "127.0.0.1");
      await once(socket, "connect");
      return socket;
    },
  });
  window = createGameWindow({
    id: "deep-miners-menu-qa",
    title: "Deep Miners — QA plein écran",
    url: localGateway.url,
    show: !hidden,
  });
  await window.loadURL(localGateway.url);
  await waitFor(
    () =>
      js(
        "document.getElementById('roomCode').textContent.length===6 && document.getElementById('loading').hidden",
      ),
    "connexion et graphismes",
  );
  assert.equal(window.isFullScreen(), true);
  assert.deepEqual(
    await js(
      "(()=>{const r=document.getElementById('viewport').getBoundingClientRect();return [r.x,r.y,r.width===innerWidth,r.height===innerHeight,getComputedStyle(document.querySelector('header')).display,document.documentElement.scrollHeight<=innerHeight];})()",
    ),
    [0, 0, true, true, "none", true],
  );
  await js("document.getElementById('start').click()");
  const room = server.rooms.get(credentials.code),
    player = room.players.get(credentials.token);
  await waitFor(() => room.phase === "running", "entrée dans la mine");
  checked("Démarrage plein écran et mine couvrant toute la fenêtre");
  for (let y = 8; y < 13; y++)
    for (let x = 8; x < 17; x++) {
      room.tiles[y][x] = 0;
      room.seen[y][x] = true;
    }
  Object.assign(player, {
    x: 10.5,
    y: 10.5,
    face: { x: 1, y: 0 },
    input: {},
    revealCell: null,
  });
  room.mapVersion++;
  room.revision++;
  server.game.broadcast(room);
  await pause(160);
  await input("keyDown", "D");
  await waitFor(() => player.x > 10.7, "déplacement avant menu");
  await key("Escape");
  await waitFor(
    () => js("document.getElementById('gameMenu').open"),
    "menu Échap",
  );
  await waitFor(
    () => !player.input.right,
    "arrêt immédiat transmis au serveur",
  );
  const stoppedX = player.x;
  await pause(300);
  assert(Math.abs(player.x - stoppedX) < 0.02);
  assert.equal(window.isFullScreen(), true);
  for (const code of ["B", "E", "2"]) await key(code);
  assert.deepEqual(
    await js(
      "[document.getElementById('gameMenu').open,document.getElementById('workshop').hidden,document.getElementById('colony').hidden]",
    ),
    [true, true, true],
  );
  await input("keyUp", "D");
  checked("Échap ouvre le menu, arrête le mineur et bloque les actions de jeu");
  assert.deepEqual(
    await js(
      "['zoom','quality','resolution','music','sounds','soundVolume','saveMine','fullscreen','leave'].map(id=>document.getElementById('gameMenu').contains(document.getElementById(id)))",
    ),
    Array(9).fill(true),
  );
  await js(
    "(()=>{for(const [id,value,type]of [['zoom','1.25','input'],['quality','low','change'],['resolution','economy','change'],['soundVolume','35','input']]){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event(type,{bubbles:true}));}document.getElementById('music').click();document.getElementById('sounds').click();})()",
  );
  assert.deepEqual(
    await js(
      "['dm-zoom','dm-quality','dm-resolution','dm-sound-volume','dm-music','dm-sounds'].map(key=>localStorage.getItem(key))",
    ),
    ["1.25", "low", "economy", "0.35", "off", "off"],
  );
  checked("Réglages graphiques et audio accessibles dans le menu et mémorisés");
  await js("document.getElementById('saveMine').click()");
  await waitFor(
    () =>
      js(
        "document.getElementById('notice').textContent.includes('Mine sauvegardée')",
      ),
    "confirmation de sauvegarde",
  );
  const saved = JSON.parse(
    await fs.readFile(path.join(scratch, "saves/rooms.json"), "utf8"),
  );
  assert.equal(saved.rooms.length, 1);
  assert.equal(saved.rooms[0].code, room.code);
  checked("Sauvegarde réelle depuis le menu dans la seule mine QA isolée");
  await js(
    "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
  );
  await fs.writeFile(
    path.join(scratch, "menu.png"),
    (await window.webContents.capturePage()).toPNG(),
  );
  await js("document.getElementById('fullscreen').click()");
  await waitFor(() => !window.isFullScreen(), "mode fenêtré");
  window.setSize(1000, 700);
  await pause(100);
  assert.equal(
    await js(
      "(()=>{const menu=document.getElementById('gameMenu'),r=menu.getBoundingClientRect();document.getElementById('saveMine').scrollIntoView({block:'end'});return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&document.getElementById('saveMine').getBoundingClientRect().bottom<=innerHeight;})()",
    ),
    true,
  );
  await key("F11");
  await waitFor(() => window.isFullScreen(), "retour plein écran F11");
  assert.equal(await js("document.getElementById('gameMenu').open"), true);
  checked(
    hidden
      ? "Menu adapté à la petite fenêtre et pont de plein écran opérationnel"
      : "Mode fenêtré, menu adapté à la petite fenêtre et F11 opérationnels",
  );
  await key("Escape");
  assert.equal(await js("document.getElementById('gameMenu').open"), false);
  await pause(180);
  assert(Math.abs(player.x - stoppedX) < 0.02);
  await key("Tab");
  assert.equal(await js("document.getElementById('colony').hidden"), false);
  await key("Escape");
  assert.deepEqual(
    await js(
      "[document.getElementById('colony').hidden,document.getElementById('gameMenu').open]",
    ),
    [true, false],
  );
  await key("Escape");
  assert.equal(await js("document.getElementById('gameMenu').open"), true);
  await js("document.getElementById('resumeGame').click()");
  checked(
    "Échap ferme d’abord l’inventaire puis ouvre le menu ; reprise sans déplacement résiduel",
  );
  await fs.writeFile(
    path.join(scratch, "game.png"),
    (await window.webContents.capturePage()).toPNG(),
  );
  const intruder = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(appRoot, "apps/launcher/main/game-preload.cjs"),
      sandbox: true,
      contextIsolation: true,
    },
  });
  try {
    await intruder.loadURL(
      "data:text/html,<title>QA origine différente</title>",
    );
    assert.equal(
      await intruder.webContents.executeJavaScript(
        "window.nexumGame.display().then(()=>false,()=>true)",
      ),
      true,
    );
  } finally {
    intruder.destroy();
  }
  checked("Le pont d’affichage refuse les autres fenêtres");
  assert.equal(
    await js(
      "(()=>{let quitRequested=false;window.close=()=>{quitRequested=true;};document.getElementById('openGameMenu').click();document.getElementById('leave').click();return quitRequested;})()",
    ),
    true,
  );
  checked("Le bouton de retour au launcher demande la fermeture de la partie");
  await fs.writeFile(
    report,
    JSON.stringify(
      { ok: true, checks, appRoot, gameRoot, historicalSuitesRerun: false },
      null,
      2,
    ),
  );
  if (process.env.NEXUM_MENU_PREVIEW === "1") {
    console.log(
      "QA prête pour le contrôle visuel, fermeture automatique dans 60 secondes.",
    );
    await Promise.race([once(window, "closed"), pause(60000)]);
  }
}

void app.whenReady().then(async () => {
  let failed;
  try {
    await run();
  } catch (error) {
    failed = error;
    console.error(error.stack);
    await fs.writeFile(
      report,
      JSON.stringify({ ok: false, checks, error: error.stack }, null, 2),
    );
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
    await localGateway?.close();
    server?.close();
    app.exit(failed ? 1 : 0);
  }
});
