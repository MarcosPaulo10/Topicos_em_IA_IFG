const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

const isDev = !app.isPackaged;
let mainWindow = null;
let pythonProcess = null;

const BACKEND_PORT = 8000;
const VITE_PORT = 5173;

function getBackendPythonPath() {
  return path.join(__dirname, "..", "backend", "venv", "Scripts", "python.exe");
}

function getBackendCwd() {
  return path.join(__dirname, "..", "backend");
}

function startBackend() {
  // Em dev o backend roda manualmente (uvicorn --reload) — evita duplicata na porta 8000
  if (isDev) {
    console.log("[backend] dev: backend sobe via npm run dev (porta 8000)");
    return;
  }

  const pythonPath = getBackendPythonPath();
  const backendCwd = getBackendCwd();

  pythonProcess = spawn(
    pythonPath,
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(BACKEND_PORT)],
    { cwd: backendCwd, stdio: "pipe" }
  );

  pythonProcess.stdout?.on("data", (data) => {
    console.log(`[backend] ${data}`);
  });

  pythonProcess.stderr?.on("data", (data) => {
    console.error(`[backend] ${data}`);
  });

  pythonProcess.on("error", (err) => {
    console.error("Falha ao iniciar backend:", err);
  });
}

function waitForBackend(maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      attempts += 1;
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(check, 500);
        } else {
          reject(new Error("Backend não respondeu a tempo"));
        }
      });

      req.on("error", () => {
        if (attempts < maxAttempts) {
          setTimeout(check, 500);
        } else {
          reject(new Error("Backend não respondeu a tempo"));
        }
      });

      req.setTimeout(1000, () => {
        req.destroy();
      });
    };

    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const url = isDev
    ? `http://localhost:${VITE_PORT}`
    : `file://${path.join(__dirname, "renderer", "dist", "index.html")}`;

  mainWindow.loadURL(url);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.webContents.send("backend-ready");
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("get-app-version", () => app.getVersion());

app.whenReady().then(async () => {
  startBackend();

  try {
    await waitForBackend();
    createWindow();
  } catch (err) {
    console.error(err);
    createWindow();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
});
