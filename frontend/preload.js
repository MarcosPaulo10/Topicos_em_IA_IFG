const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  onBackendReady: (callback) => {
    ipcRenderer.on("backend-ready", () => callback());
  },
});
