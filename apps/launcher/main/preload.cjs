const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("atelier", {
  invoke: (method, args) => ipcRenderer.invoke("atelier:call", method, args),
  onChange: (callback) => {
    const listener = (_, state) => callback(state);
    ipcRenderer.on("atelier:state", listener);
    return () => ipcRenderer.removeListener("atelier:state", listener);
  },
});
