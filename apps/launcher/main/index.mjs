import {
  app,
  BrowserWindow,
  ipcMain,
  clipboard,
  shell,
  dialog,
  Menu,
} from "electron";
import updater from "electron-updater";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fork } from "node:child_process";
import {
  readJSON,
  writeJSON,
  profileAt,
  githubDistribution,
  validateCatalog,
  ID,
} from "../../../packages/core/config.mjs";
import { GameInstaller } from "../../../packages/core/installer.mjs";
import { decodeInvite } from "../../../packages/network/invitation.mjs";
const root = fileURLToPath(new URL("../../../", import.meta.url)),
  ui = path.join(root, "apps/launcher/ui/index.html");
if (process.env.ATELIER_DATA_DIR)
  app.setPath("userData", path.resolve(process.env.ATELIER_DATA_DIR));
let window,
  gameWindow,
  worker,
  profile,
  distribution,
  catalog = { schema: 1, games: [] },
  installed = {},
  installer,
  active = null,
  operation = null,
  notice = "",
  update = { status: "idle" },
  sessionStarting = false,
  quitting = false;
const pending = new Map();
let requestId = 0;
const dataRoot = () => app.getPath("userData");
function state() {
  return {
    version: app.getVersion(),
    profileName: profile?.name || "Mineur",
    games: catalog.games.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      players: g.players,
      version: g.version,
      multiplayer: g.multiplayer,
      installedVersion: installed[g.id]?.version || null,
    })),
    active,
    operation,
    notice,
    update,
    github: githubDistribution(distribution)
      ? `https://github.com/${distribution.owner}/${distribution.repo}`
      : null,
  };
}
function emit() {
  if (window && !window.isDestroyed())
    window.webContents.send("atelier:state", state());
}
async function loadCatalog() {
  try {
    if (githubDistribution(distribution)) {
      const response = await fetch(
        `https://raw.githubusercontent.com/${distribution.owner}/${distribution.repo}/${distribution.branch || "main"}/catalog/catalog.json`,
        { signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok) throw Error("Catalogue indisponible.");
      catalog = validateCatalog(await response.json(), distribution);
      await writeJSON(path.join(dataRoot(), "catalog.json"), catalog);
    } else if (!app.isPackaged)
      catalog = validateCatalog(
        await readJSON(path.join(root, "catalog/local.json")),
        distribution,
        { local: true },
      );
    else throw Error("Dépôt GitHub non configuré.");
    notice = "";
  } catch (e) {
    const cached = await readJSON(path.join(dataRoot(), "catalog.json"), null);
    if (cached) catalog = validateCatalog(cached, distribution);
    else if (app.isPackaged)
      catalog = validateCatalog(
        await readJSON(path.join(root, "catalog/catalog.json")),
        distribution,
      );
    notice = "Hors connexion : les jeux installés restent disponibles.";
  }
  installed = await installer.installed();
  emit();
  return state();
}
function workerRequest(method, args = {}) {
  if (!worker) {
    const executable = app.isPackaged
      ? path.join(process.resourcesPath, "runtime/node.exe")
      : process.env.ATELIER_NODE || "node";
    const env = { ...process.env };
    for (const key of [
      "ELECTRON_RUN_AS_NODE",
      "NODE_OPTIONS",
      "GH_TOKEN",
      "GITHUB_TOKEN",
      "DATABASE_URL",
    ])
      delete env[key];
    worker = fork(path.join(root, "packages/worker/index.mjs"), [], {
      execPath: executable,
      cwd: dataRoot(),
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    worker.stdout.on("data", () => {});
    worker.stderr.on("data", (data) => {
      void fs
        .appendFile(path.join(dataRoot(), "launcher.log"), String(data))
        .catch(() => {});
    });
    worker.on("message", (msg) => {
      const callback = pending.get(msg.id);
      if (callback) {
        pending.delete(msg.id);
        callback(msg);
      }
      if (msg.event === "notice") {
        notice = msg.message;
        emit();
      }
    });
    const child = worker;
    const unavailable = () => {
      if (worker !== child) return;
      worker = null;
      for (const callback of pending.values())
        callback({
          error:
            "La partie s’est arrêtée. Les dernières sauvegardes sont conservées.",
        });
      pending.clear();
      if (active) {
        active = null;
        notice = "La partie s’est arrêtée.";
        emit();
      }
    };
    worker.on("exit", unavailable);
    worker.on("error", unavailable);
  }
  return new Promise((resolve, reject) => {
    const id = ++requestId,
      timer = setTimeout(() => {
        pending.delete(id);
        reject(
          Error("La connexion à la partie prend trop de temps. Réessaie."),
        );
      }, 45000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      msg.error ? reject(Error(msg.error)) : resolve(msg.result);
    });
    worker.send({ id, method, args });
  });
}
async function stopSession() {
  if (worker) {
    try {
      await workerRequest("stop");
    } finally {
      worker?.disconnect();
      worker = null;
    }
  }
  active = null;
  if (gameWindow && !gameWindow.isDestroyed()) gameWindow.destroy();
  gameWindow = null;
  emit();
}
async function install(id) {
  const game = catalog.games.find((g) => g.id === id);
  if (!game) throw Error("Jeu inconnu.");
  if (active?.gameId === id)
    throw Error("Ferme la partie avant de mettre le jeu à jour.");
  if (operation) throw Error("Un téléchargement est déjà en cours.");
  operation = { gameId: id, phase: "download", received: 0, total: game.size };
  emit();
  try {
    await installer.install(game, {
      localArchive:
        !app.isPackaged && game.archive
          ? path.join(root, "artifacts", game.archive)
          : undefined,
    });
    installed = await installer.installed();
    notice = "Jeu prêt à jouer.";
  } finally {
    operation = null;
    emit();
  }
  return state();
}
async function launch(method, args) {
  if (active)
    throw Error("Quitte la partie actuelle pour en ouvrir une autre.");
  let id = args.id,
    invite;
  if (method === "join") {
    invite = decodeInvite(args.invite);
    id = invite.gameId;
    const game = catalog.games.find((g) => g.id === id);
    if (!game) throw Error("Ce jeu n’est pas encore dans le catalogue.");
    if (game.version !== invite.version)
      throw Error("L’hôte et toi devez mettre le jeu à la même version.");
    if (installed[id]?.version !== invite.version) await install(id);
  }
  const gameRoot = await installer.gameRoot(id);
  operation = { gameId: id, phase: method === "join" ? "join" : "host" };
  notice = "";
  emit();
  try {
    const result = await workerRequest(method, {
      gameRoot,
      saveRoot: path.join(dataRoot(), "saves"),
      profile,
      mineId: args.mineId || null,
      invite: args.invite,
    });
    active = result;
    gameWindow = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 960,
      minHeight: 640,
      title: catalog.games.find((g) => g.id === id)?.title || "Atelier Jeux",
      autoHideMenuBar: true,
      backgroundColor: "#071016",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        backgroundThrottling: false,
        partition: "persist:game-" + id,
      },
    });
    const origin = new URL(result.url).origin;
    gameWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    gameWindow.webContents.on("will-navigate", (event, url) => {
      if (new URL(url).origin !== origin) event.preventDefault();
    });
    gameWindow.on("close", (event) => {
      if (!quitting && active?.kind === "host") {
        event.preventDefault();
        void dialog
          .showMessageBox(gameWindow, {
            type: "question",
            buttons: ["Quitter et sauvegarder", "Continuer à héberger"],
            defaultId: 1,
            cancelId: 1,
            message: "Arrêter cette partie ?",
            detail:
              "Tes amis seront déconnectés. La mine sera sauvegardée sur ton PC.",
          })
          .then(({ response }) => {
            if (response === 0) void stopSession();
          });
      } else void stopSession();
    });
    await gameWindow.loadURL(result.url);
    return state();
  } catch (e) {
    await stopSession().catch(() => {});
    throw e;
  } finally {
    operation = null;
    emit();
  }
}
const { autoUpdater } = updater;
async function checkUpdate() {
  if (!app.isPackaged || !githubDistribution(distribution)) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.setFeedURL({
    provider: "github",
    owner: distribution.owner,
    repo: distribution.repo,
  });
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    update = { status: "unavailable" };
    emit();
  }
}
autoUpdater.on("update-available", (info) => {
  update = { status: "available", version: info.version };
  emit();
});
autoUpdater.on("download-progress", (p) => {
  update = { ...update, status: "download", percent: p.percent };
  emit();
});
autoUpdater.on("update-downloaded", (info) => {
  update = { status: "ready", version: info.version };
  emit();
});
autoUpdater.on("error", () => {
  update = { status: "unavailable" };
  emit();
});
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    window?.show();
    window?.focus();
  });
  // Let the entry module finish loading before waiting for Electron's ready event.
  void app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await fs.mkdir(dataRoot(), { recursive: true });
  profile = await profileAt(dataRoot());
  distribution = await readJSON(path.join(root, "distribution.json"));
  installer = new GameInstaller(path.join(dataRoot(), "games"), {
    onProgress: (p) => {
      operation = p;
      emit();
    },
  });
  window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: "Atelier Jeux",
    backgroundColor: "#0c1119",
    webPreferences: {
      preload: path.join(root, "apps/launcher/main/preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (e) => e.preventDefault());
  ipcMain.handle("atelier:call", async (event, method, args = {}) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame.url !== pathToFileURL(ui).href
    )
      throw Error("Accès refusé.");
    try {
      if (method === "state") return state();
      if (method === "refresh") return await loadCatalog();
      if (method === "profile") {
        if (
          typeof args.name !== "string" ||
          !args.name.trim() ||
          args.name.trim().length > 18
        )
          throw Error("Choisis un pseudo de 1 à 18 caractères.");
        profile.name = args.name.trim();
        await writeJSON(path.join(dataRoot(), "profile.json"), profile);
        emit();
        return state();
      }
      if (method === "install") return await install(args.id);
      if (["host", "solo", "join"].includes(method)) {
        if (sessionStarting || operation) throw Error('Une partie ou un téléchargement est déjà en préparation.');
        sessionStarting = true;
        try { return await launch(method, args); }
        finally { sessionStarting = false; }
      }
      if (method === "mines") {
        if (active) return [];
        return await workerRequest("mines", {
          gameRoot: await installer.gameRoot(args.id),
          saveRoot: path.join(dataRoot(), "saves"),
        });
      }
      if (method === "stop") {
        await stopSession();
        return state();
      }
      if (method === "copy") {
        if (active?.invite) clipboard.writeText(active.invite);
        return true;
      }
      if (method === "focus") {
        gameWindow?.show();
        gameWindow?.focus();
        return true;
      }
      if (method === "github") {
        if (githubDistribution(distribution))
          await shell.openExternal(
            `https://github.com/${distribution.owner}/${distribution.repo}/releases/latest`,
          );
        return true;
      }
      if (method === "saves") {
        await shell.openPath(path.join(dataRoot(), "saves"));
        return true;
      }
      if (method === "update-download") {
        if (active)
          throw Error("Quitte la partie avant de mettre le launcher à jour.");
        await autoUpdater.downloadUpdate();
        return state();
      }
      if (method === "update-install") {
        await stopSession();
        quitting = true;
        autoUpdater.quitAndInstall();
        return true;
      }
      throw Error("Action inconnue.");
    } catch (e) {
      notice = e.message;
      emit();
      throw e;
    }
  });
  await window.loadFile(ui);
  await loadCatalog();
  if (!process.env.ATELIER_STARTUP_CHECK) void checkUpdate();
  window.on("closed", () => {
    window = null;
    app.quit();
  });
  app.on("before-quit", (event) => {
    if (worker && !quitting) {
      event.preventDefault();
      quitting = true;
      void stopSession().finally(() => app.quit());
    }
  });
  if (process.env.ATELIER_STARTUP_CHECK) {
    const { verifyStartup } = await import('./startup-check.mjs');
    await verifyStartup({app, window, state:state(), report:process.env.ATELIER_STARTUP_CHECK});
  }
  }).catch(async error => {
    const log = path.join(dataRoot(),'startup-error.log');
    await fs.mkdir(dataRoot(),{recursive:true}).catch(()=>{});
    await fs.appendFile(log,new Date().toISOString()+' '+(error.stack||error.message)+'\n').catch(()=>{});
    dialog.showErrorBox('Atelier Jeux — démarrage impossible','Le launcher n’a pas pu démarrer. Tes sauvegardes sont conservées.\n\n'+error.message+'\n\nDiagnostic : '+log);
    app.exit(1);
  });
}
