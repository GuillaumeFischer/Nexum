const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nexumGame", {
  display: () => ipcRenderer.invoke("nexum:game-display"),
  setFullscreen: (fullscreen) =>
    ipcRenderer.invoke("nexum:game-display", fullscreen),
  onDisplayChange: (callback) => {
    const listener = (_, display) => callback(display);
    ipcRenderer.on("nexum:game-display-changed", listener);
    return () =>
      ipcRenderer.removeListener("nexum:game-display-changed", listener);
  },
});
