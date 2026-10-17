import { BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";

// Only the current game's main frame may read or change its own display mode.
export function createGameWindow({ id, title, url, show = true }) {
  const origin = new URL(url).origin;
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    title,
    fullscreen: true,
    show,
    autoHideMenuBar: true,
    backgroundColor: "#071016",
    webPreferences: {
      preload: fileURLToPath(new URL("./game-preload.cjs", import.meta.url)),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
      partition: "persist:game-" + id,
    },
  });
  const display = () => ({ fullscreen: window.isFullScreen() });
  ipcMain.handle("nexum:game-display", (event, fullscreen) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      new URL(event.senderFrame.url).origin !== origin
    )
      throw Error("Accès refusé.");
    if (fullscreen !== undefined) {
      if (typeof fullscreen !== "boolean")
        throw Error("Mode d’affichage invalide.");
      window.setFullScreen(fullscreen);
    }
    return display();
  });
  window.once("closed", () => ipcMain.removeHandler("nexum:game-display"));
  for (const event of ["enter-full-screen", "leave-full-screen"])
    window.on(event, () =>
      window.webContents.send("nexum:game-display-changed", display()),
    );
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F11") {
      event.preventDefault();
      if (!input.isAutoRepeat) window.setFullScreen(!window.isFullScreen());
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, next) => {
    if (new URL(next).origin !== origin) event.preventDefault();
  });
  return window;
}
